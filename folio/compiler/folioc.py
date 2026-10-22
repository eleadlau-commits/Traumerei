"""The Folio compiler.

Reads app/app.json and every folder in app/features/, checks each feature's feature.json,
works out which features can be included and in what order, and writes the finished app to
dist/. Like LaTeX, it prints a log of what it did and carries on past problems: a broken or
incomplete feature is left out with a reason, never the whole app.

Uses only Python's standard library, so it runs anywhere Python 3.9 or newer is installed.
Run `python build.py --help` for the commands.
"""

from __future__ import annotations

import argparse
import copy
import datetime
import functools
import hashlib
import html
import json
import os
import plistlib
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from dataclasses import dataclass, field
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PLATFORMS = ('web', 'android', 'ios')
CAPACITOR_VERSION = '^7.0.0'

# Slots and events the framework itself provides (see folio/runtime/Shell.js and App.js).
FRAMEWORK_SLOTS = {
    'views': 'Screens you switch between with the tabs at the top.',
    'header.buttons': 'Rows in the menu.',
    'header.status': 'Short text in the menu and next to view titles.',
    'header.actions': 'Icon buttons in the top bar, left of the account button.',
    'account': 'Who is signed in, and their account page (the menu and the account button use the first item).',
    'settings': 'Sections in the Settings window.',
}
FRAMEWORK_EVENTS = {'app:ready', 'app:resume', 'app:tick', 'app:online', 'app:offline'}
FRAMEWORK_SERVICES: set[str] = set()

FEATURE_KEYS = {'name', 'description', 'version', 'main', 'styles', 'templates', 'requires', 'uses',
                'platforms', 'enabled', 'web', 'native'}
NATIVE_KEYS = {'packages', 'capacitor', 'android', 'ios'}
FOLDER_NAME = re.compile(r'^[a-z][a-z0-9]*(-[a-z0-9]+)*$')
NOT_SHIPPED = {'tests', 'extras', 'native'}  # feature subfolders that never go into the app
GRADLE_NAME = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')
BUNDLE_ID = re.compile(r'^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$')
TEAM_ID = re.compile(r'^[A-Z0-9]{10}$')
IOS_DEVICES = ('iphone', 'iphone-and-ipad')

# Added to start.js in test builds. Once the app has started, it uses it like a person would
# (every view, the first item in each, Settings, every top-bar button), then reports back to
# the test server: which features are running and any problems.
TEST_PROBE = """
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const closeWindows = () => document.querySelectorAll('dialog[open]').forEach((d) => d.close());
app.start().then(async () => {
  const shell = app.shell;
  const startView = shell.currentView?.id;
  const tryView = async (id) => {
    shell.selectView(id);
    await wait(50);
    document.querySelector('.view:not([hidden]) [role="button"]')?.click();
    await wait(100);
    closeWindows();
  };
  for (const view of shell.views) {
    await tryView(view.id);
    for (const inner of view.subviews?.() || []) await tryView(inner);
  }
  shell.openSettings();
  await wait(100);
  closeWindows();
  shell.openMenu();
  const rows = document.querySelectorAll('dialog[open] .menu-row').length;
  closeWindows();
  for (let i = 0; i < rows; i++) {
    shell.openMenu();
    const row = document.querySelectorAll('dialog[open] .menu-row')[i];
    if (row && row.textContent !== 'Refresh timetable') row.click();
    await wait(100);
    closeWindows();
  }
  for (const button of document.querySelectorAll('.topbar .top-action, .topbar .account')) {
    button.click();
    await wait(100);
    closeWindows();
  }
  if (startView) shell.selectView(startView);
  await wait(300);
}).catch((err) => app.report(null, err, 'starting')).finally(() => {
  const html = document.documentElement;
  fetch('/__folio_report', {
    method: 'POST',
    body: JSON.stringify({
      kind: 'app',
      state: html.dataset.folio,
      active: (html.dataset.folioActive || '').split(',').filter(Boolean),
      problems: app.problems.map((p) => `${p.feature || 'app'}: ${p.message}${p.where ? ` (${p.where})` : ''}`),
    }),
  }).catch(() => {});
});"""

IMPORT_RE = re.compile(
    r"""(?:^|[\s;])import\s*(?:[\w*{}\s,$]+?\s*from\s*)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)""",
    re.M)
# defineSlot('name', 'description…'): the first piece of the description, for the build report.
SLOT_DESCRIPTION_RE = re.compile(
    r"""defineSlot\(\s*['"]([\w.:-]+)['"]\s*,\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")""")
SCANS = {
    'defines': re.compile(r"""defineSlot\(\s*['"]([\w.:-]+)['"]"""),
    'adds': re.compile(r"""this\.add\(\s*['"]([\w.:-]+)['"]"""),
    'provides': re.compile(r"""this\.provide\(\s*['"]([\w.:-]+)['"]"""),
    'uses': re.compile(r"""this\.use\(\s*['"]([\w.:-]+)['"]"""),
    'emits': re.compile(r"""this\.emit\(\s*['"]([\w.:-]+)['"]"""),
    'listens': re.compile(r"""this\.on\(\s*['"]([\w.:-]+)['"]"""),
}


# ---------------------------------------------------------------------------------------------
# Log
# ---------------------------------------------------------------------------------------------

def _can_print(text: str) -> bool:
    try:
        text.encode(sys.stdout.encoding or 'ascii')
        return True
    except (UnicodeEncodeError, LookupError):
        return False


class Log:
    """Prints progress like LaTeX does, and keeps every line for the build report."""

    def __init__(self, quiet: bool = False):
        self.quiet = quiet
        self.lines: list[tuple[str, str]] = []
        self.warnings = 0
        self.errors = 0
        fancy = _can_print('✓⚠✗·')
        self.symbols = {'ok': '✓' if fancy else '+', 'warn': '⚠' if fancy else '!',
                        'error': '✗' if fancy else 'x', 'info': '·' if fancy else '-', 'title': '', 'plain': ''}

    def _out(self, kind: str, text: str, indent: int = 2):
        self.lines.append((kind, text))
        if self.quiet:
            return
        symbol = self.symbols[kind]
        prefix = ' ' * indent + (symbol + ' ' if symbol else '')
        print(prefix + text if kind != 'title' else text, flush=True)

    def title(self, text):
        self._out('title', text, 0)

    def ok(self, text):
        self._out('ok', text)

    def info(self, text):
        self._out('info', text)

    def plain(self, text):
        self._out('plain', text)

    def warn(self, text):
        self.warnings += 1
        self._out('warn', text)

    def error(self, text):
        self.errors += 1
        self._out('error', text)


# ---------------------------------------------------------------------------------------------
# Features
# ---------------------------------------------------------------------------------------------

@dataclass
class FeatureInfo:
    id: str
    path: Path
    manifest: dict = field(default_factory=dict)
    reason: str = ''      # why it was left out ('' = included)
    kind: str = ''        # 'mistake', 'off' or 'needs': the kind of reason
    warnings: list = field(default_factory=list)
    scan: dict = field(default_factory=dict)

    @property
    def name(self) -> str:
        return self.manifest.get('name', self.id) if isinstance(self.manifest, dict) else self.id

    @property
    def version(self) -> str:
        return str(self.manifest.get('version', '1.0.0'))

    @property
    def requires(self) -> list:
        return list(self.manifest.get('requires', []))

    @property
    def uses(self) -> list:
        return list(self.manifest.get('uses', []))

    @property
    def platforms(self) -> list:
        return list(self.manifest.get('platforms', PLATFORMS))

    @property
    def native(self) -> dict:
        return self.manifest.get('native', {}) or {}

    def leave_out(self, kind: str, reason: str):
        if not self.reason:
            self.kind, self.reason = kind, reason


class CycleError(Exception):
    def __init__(self, members):
        super().__init__(' → '.join(members))
        self.members = members


def absolute(path) -> Path:
    """The full path, with '..' worked out. Unlike Path.resolve(), it doesn't follow redirected
    folders, which on Windows can make paths longer than the 260-character limit."""
    return Path(os.path.abspath(path))


def deep_merge(base: dict, extra: dict) -> dict:
    """Merges `extra` into `base`: dictionaries merge, lists combine without repeats."""
    for key, value in extra.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            deep_merge(base[key], value)
        elif isinstance(value, list) and isinstance(base.get(key), list):
            base[key] = base[key] + [v for v in value if v not in base[key]]
        else:
            base[key] = value
    return base


def merge_plist(base: dict, extra: dict) -> dict:
    """Adds Info.plist entries to base: dictionaries are merged, lists are added to (without
    repeats), anything else is replaced."""
    for key, value in extra.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            merge_plist(base[key], value)
        elif isinstance(value, list) and isinstance(base.get(key), list):
            base[key] += [x for x in value if x not in base[key]]
        else:
            base[key] = copy.deepcopy(value)
    return base


class Project:
    """One app made with Folio: the framework in folio/ and the app in app/."""

    def __init__(self, root: Path, app_dir: Path | None = None):
        self.root = absolute(root)
        self.framework = self.root / 'folio'
        self.runtime = self.framework / 'runtime'
        self.app_dir = absolute(app_dir) if app_dir else self.root / 'app'
        self.features_dir = self.app_dir / 'features'

    @property
    def framework_version(self) -> str:
        try:
            return (self.framework / 'VERSION').read_text('utf-8').strip()
        except OSError:
            return '?'

    # ---- app.json ----

    def load_app(self, log: Log) -> dict | None:
        path = self.app_dir / 'app.json'
        try:
            app = json.loads(path.read_text('utf-8-sig'))
        except FileNotFoundError:
            log.error(f'Missing {self._rel(path)}. Every app needs one; see folio/README.md.')
            return None
        except json.JSONDecodeError as e:
            log.error(f'{self._rel(path)} has a mistake on line {e.lineno}: {e.msg}')
            return None
        ok = True
        for key in ('id', 'name'):
            if not isinstance(app.get(key), str) or not app.get(key):
                log.error(f'app.json needs "{key}".')
                ok = False
        if ok and not FOLDER_NAME.match(app['id']):
            log.error('app.json "id" must be lowercase words joined by dashes, e.g. "timetable".')
            ok = False
        if not ok:
            return None
        app.setdefault('version', '1.0.0')
        app.setdefault('description', '')
        app.setdefault('lang', 'en')
        theme = app.setdefault('theme', {})
        theme.setdefault('accent', '#3d5afe')
        theme.setdefault('accentDark', '#8c9eff')
        theme.setdefault('background', '#f5f6fa')
        theme.setdefault('backgroundDark', '#0f1117')
        app.setdefault('native', {}).setdefault('appId', f"io.folio.{app['id'].replace('-', '')}")
        problem = self.check_app_ios(app['native'].get('ios', {}))
        if problem:
            log.error(f'app.json: {problem}')
            return None
        icons = self.app_dir / 'icons'
        for name in ('icon-192.png', 'icon-512.png', 'apple-touch-icon.png'):
            if not (icons / name).exists():
                log.warn(f'app/icons/{name} is missing, so the app has no icon there.')
        return app

    @staticmethod
    def check_app_ios(ios) -> str:
        """Checks "native.ios" in app.json: the iPhone app's own id if it differs from "appId",
        Info.plist entries for the whole app, and which devices it runs on. Returns a problem, or ''."""
        if not isinstance(ios, dict) or any(k not in ('appId', 'plist', 'devices') for k in ios):
            return '"native.ios" can only contain appId, plist and devices'
        if 'appId' in ios and not (isinstance(ios['appId'], str) and BUNDLE_ID.match(ios['appId'])):
            return '"native.ios.appId" must look like "com.example.app"'
        if not isinstance(ios.get('plist', {}), dict):
            return '"native.ios.plist" must look like { "Key": "value" }'
        if ios.get('devices', 'iphone-and-ipad') not in IOS_DEVICES:
            return f'"native.ios.devices" must be one of {", ".join(IOS_DEVICES)}'
        return ''

    # ---- Finding and checking features ----

    def discover(self, log: Log) -> list[FeatureInfo]:
        features = []
        if not self.features_dir.is_dir():
            log.warn('There is no app/features folder, so the app has no features.')
            return features
        for folder in sorted(self.features_dir.iterdir()):
            if not folder.is_dir() or folder.name.startswith(('.', '_')):
                continue
            manifest_path = folder / 'feature.json'
            if not manifest_path.exists():
                log.warn(f'{folder.name}/ has no feature.json, so it was ignored.')
                continue
            feature = FeatureInfo(folder.name, folder)
            try:
                # utf-8-sig also accepts the invisible mark some Windows editors put at the start.
                feature.manifest = json.loads(manifest_path.read_text('utf-8-sig'))
            except json.JSONDecodeError as e:
                feature.leave_out('mistake', f'feature.json has a mistake on line {e.lineno}: {e.msg}')
            if not feature.reason:
                self.check(feature)
            features.append(feature)
        return features

    def check(self, f: FeatureInfo):
        m = f.manifest
        if not isinstance(m, dict):
            return f.leave_out('mistake', 'feature.json must be an object ({ ... })')
        if not FOLDER_NAME.match(f.id):
            return f.leave_out('mistake', 'folder name must be lowercase words joined by dashes, e.g. "campus-card"')
        for key in m:
            if key not in FEATURE_KEYS:
                f.warnings.append(f'feature.json has an unknown setting "{key}" (a typo?)')
        for key in ('name', 'description', 'main'):
            if not isinstance(m.get(key), str) or not m.get(key).strip():
                return f.leave_out('mistake', f'feature.json needs "{key}"')
        if not m['main'].endswith('.js') or not (f.path / m['main']).is_file():
            return f.leave_out('mistake', f'its main file "{m["main"]}" is missing')
        for key in ('styles', 'requires', 'uses', 'platforms'):
            if key in m and (not isinstance(m[key], list) or not all(isinstance(x, str) for x in m[key])):
                return f.leave_out('mistake', f'"{key}" in feature.json must be a list of names, like ["a", "b"]')
        for style in m.get('styles', []):
            if not (f.path / style).is_file():
                return f.leave_out('mistake', f'its style file "{style}" is missing')
        if 'templates' in m and not (isinstance(m['templates'], str) and (f.path / m['templates']).is_file()):
            return f.leave_out('mistake', f'its templates file "{m.get("templates")}" is missing')
        if f.id in f.requires or f.id in f.uses:
            return f.leave_out('mistake', 'it lists itself in "requires" or "uses"')
        bad = [p for p in f.platforms if p not in PLATFORMS]
        if bad or not f.platforms:
            return f.leave_out('mistake', f'"platforms" can only contain {", ".join(PLATFORMS)}')
        if 'enabled' in m and not isinstance(m['enabled'], bool):
            return f.leave_out('mistake', '"enabled" must be true or false')
        native = m.get('native', {})
        if not isinstance(native, dict) or any(k not in NATIVE_KEYS for k in native):
            return f.leave_out('mistake', f'"native" can only contain {", ".join(sorted(NATIVE_KEYS))}')
        if 'packages' in native and not (isinstance(native['packages'], dict)
                                         and all(isinstance(v, str) for v in native['packages'].values())):
            return f.leave_out('mistake', '"native.packages" must look like { "package-name": "^1.0.0" }')
        problem = self.check_android_extras(f, native.get('android', {})) or self.check_ios_extras(f, native.get('ios', {}))
        if problem:
            return f.leave_out('mistake', problem)
        web = m.get('web', {})
        if not isinstance(web, dict) or any(k != 'manifest' for k in web):
            return f.leave_out('mistake', '"web" can only contain "manifest"')
        self.scan_code(f)

    @staticmethod
    def check_android_extras(f: FeatureInfo, android) -> str:
        """Checks "native.android.files" (files to copy into the Android project) and
        "native.android.gradle" (settings for its variables.gradle). Returns a problem, or ''."""
        if not isinstance(android, dict):
            return '"native.android" must be an object'
        files = android.get('files', {})
        if not isinstance(files, dict):
            return '"native.android.files" must look like { "app/file.json": "native/file.json" }'
        for to, source in files.items():
            if not (isinstance(to, str) and isinstance(source, str)):
                return '"native.android.files" must look like { "app/file.json": "native/file.json" }'
            for path in (to, source):
                if path.startswith(('/', '\\')) or '..' in Path(path).parts or ':' in path:
                    return f'"native.android.files" can only use paths inside the project and the feature: "{path}"'
            if not (f.path / source).is_file():
                return f'its Android file "{source}" is missing'
        gradle = android.get('gradle', {})
        if not (isinstance(gradle, dict) and all(isinstance(k, str) and GRADLE_NAME.match(k) for k in gradle)
                and all(isinstance(v, (bool, int, str)) for v in gradle.values())):
            return '"native.android.gradle" must look like { "settingName": true }'
        return ''

    @staticmethod
    def check_ios_extras(f: FeatureInfo, ios) -> str:
        """Checks "native.ios": "plist" (Info.plist entries), "files" (files to add to the iPhone
        app, e.g. GoogleService-Info.plist) and "pods" (lines for the Podfile's app target).
        Returns a problem, or ''."""
        if not isinstance(ios, dict) or any(k not in ('plist', 'files', 'pods') for k in ios):
            return '"native.ios" can only contain plist, files and pods'
        if not isinstance(ios.get('plist', {}), dict):
            return '"native.ios.plist" must look like { "Key": "value" }'
        files = ios.get('files', {})
        shape = '"native.ios.files" must look like { "GoogleService-Info.plist": "native/GoogleService-Info.plist" }'
        if not isinstance(files, dict):
            return shape
        for to, source in files.items():
            if not (isinstance(to, str) and isinstance(source, str)):
                return shape
            for path in (to, source):
                if path.startswith(('/', '\\')) or '..' in Path(path).parts or ':' in path:
                    return f'"native.ios.files" can only use paths inside the project and the feature: "{path}"'
            if not (f.path / source).is_file():
                return f'its iPhone file "{source}" is missing'
        pods = ios.get('pods', [])
        if not (isinstance(pods, list) and all(isinstance(x, str) and x.strip().startswith('pod ') and '\n' not in x for x in pods)):
            return '"native.ios.pods" must be a list of Podfile lines, like ["pod \'Name\', :path => \'...\'"]'
        return ''

    def scan_code(self, f: FeatureInfo):
        """Reads the feature's JavaScript to check its imports and note which slots, services and
        events it uses. This is a best-effort reading, used for warnings and the build report."""
        found = {key: set() for key in SCANS}
        descriptions = {}
        for js in sorted(f.path.rglob('*.js')):
            relative = js.relative_to(f.path)
            if relative.parts[0] in NOT_SHIPPED:
                continue
            text = js.read_text('utf-8', errors='replace')
            for key, pattern in SCANS.items():
                found[key].update(pattern.findall(text))
            for name, single, double in SLOT_DESCRIPTION_RE.findall(text):
                descriptions[name] = (single or double).replace("\\'", "'").replace('\\"', '"')
            for match in IMPORT_RE.finditer(text):
                spec = match.group(1) or match.group(2)
                problem = self.check_import(f, js, spec)
                if problem:
                    return f.leave_out('mistake', f'{relative.as_posix()} {problem}')
        f.scan = {key: sorted(values) for key, values in found.items()}
        f.scan['slot_descriptions'] = descriptions

    def check_import(self, f: FeatureInfo, js: Path, spec: str) -> str:
        if spec in ('folio', 'folio/testing'):
            return ''
        if spec.startswith(('https://', 'http://')):
            f.warnings.append(f'loads code from the internet ({spec}), so it needs a connection the first time')
            return ''
        if spec.startswith('.'):
            target = absolute(js.parent / spec)
            try:
                target.relative_to(absolute(f.path))
            except ValueError:
                return (f'imports "{spec}", which is outside its own folder. Features may only import '
                        '"folio" and their own files; to use another feature, use its service.')
            if not target.is_file():
                return f'imports "{spec}", which doesn\'t exist'
            return ''
        return f'imports "{spec}". Features may only import "folio" and their own files.'

    # ---- Deciding what's in and in what order ----

    def resolve(self, features: list[FeatureInfo], without=()) -> list[FeatureInfo]:
        by_id = {f.id: f for f in features}
        for f in features:
            if f.id in without:
                f.leave_out('off', 'left out of this build')
            elif f.manifest.get('enabled') is False:
                f.leave_out('off', 'switched off in its feature.json ("enabled": false)')
        while True:
            candidates = {f.id: f for f in features if not f.reason}
            changed = True
            while changed:
                changed = False
                for f in list(candidates.values()):
                    missing = next((r for r in f.requires if r not in candidates), None)
                    if missing:
                        other = by_id.get(missing)
                        f.leave_out('needs', f'needs "{missing}", which is '
                                    + ('not installed' if other is None else 'left out'))
                        del candidates[f.id]
                        changed = True
            try:
                return self._order(candidates)
            except CycleError as cycle:
                for member in cycle.members:
                    by_id[member].leave_out('mistake', f'its "requires" go round in a circle: {cycle}')

    def _order(self, candidates: dict) -> list[FeatureInfo]:
        """Orders features so each starts after what it requires and uses."""
        order, state = [], {}

        def visit(f, path):
            state[f.id] = 'visiting'
            for dep in sorted(set(f.requires)):
                if dep not in candidates:
                    continue
                if state.get(dep) == 'visiting':
                    start = path.index(dep) if dep in path else 0
                    raise CycleError(path[start:] + [f.id, dep])
                if state.get(dep) != 'done':
                    visit(candidates[dep], path + [f.id])
            for dep in sorted(set(f.uses)):
                # "uses" only affects the order, so an order that can't be met is just ignored.
                if dep in candidates and state.get(dep) is None:
                    visit(candidates[dep], path + [f.id])
            state[f.id] = 'done'
            order.append(f)

        for fid in sorted(candidates):
            if state.get(fid) is None:
                visit(candidates[fid], [])
        return order

    def lint(self, features: list[FeatureInfo], included: list[FeatureInfo]) -> list[str]:
        """Warnings about likely mistakes in how features connect to each other."""
        warnings = []
        defined = {s: f.id for f in included for s in f.scan.get('defines', [])}
        defined_anywhere = {s for f in features for s in f.scan.get('defines', [])}
        provided = {s: f.id for f in included for s in f.scan.get('provides', [])}
        provided_anywhere = {s for f in features for s in f.scan.get('provides', [])}
        for f in included:
            for slot in f.scan.get('adds', []):
                if slot not in FRAMEWORK_SLOTS and slot not in defined and slot not in defined_anywhere:
                    warnings.append(f'{f.id} adds to "{slot}", but no feature defines that slot (spelling?)')
            for service in f.scan.get('uses', []):
                owner = provided.get(service)
                if owner is None and service not in provided_anywhere and service not in FRAMEWORK_SERVICES:
                    warnings.append(f'{f.id} uses the service "{service}", but no feature provides it (spelling?)')
                elif owner and owner != f.id and owner not in f.requires and owner not in f.uses:
                    warnings.append(f'{f.id} uses "{service}" from {owner}, but doesn\'t list {owner} in '
                                    '"requires" or "uses", so it might start first')
        return warnings

    # ---- Building ----

    def build(self, out: Path, log: Log, build_number=None, without=(), test=False) -> tuple[int, dict]:
        """Compiles the app into `out`. Returns (exit code, details for reports and tests)."""
        log.title(f'Compiling with Folio {self.framework_version}')
        app = self.load_app(log)
        if app is None:
            return 1, {}
        log.plain(f'{app["name"]} {app["version"]}' + (f' (build {build_number})' if build_number else ''))
        features = self.discover(log)
        included = self.resolve(features, without)

        log.title('')
        log.title('Features')
        for f in included:
            log.ok(f'{f.id:<16} {f.version:<8} {f.name}')
            for warning in f.warnings:
                log.warn(f'{f.id}: {warning}')
        for f in features:
            if f.reason:
                (log.error if f.kind == 'mistake' else log.warn if f.kind == 'needs' else log.info)(
                    f'{f.id:<16} left out: {f.reason}')
        lint = self.lint(features, included)
        for warning in lint:
            log.warn(warning)

        out = absolute(out)
        if not self._prepare(out, log):
            return 1, {}
        web = out / 'web'
        web.mkdir(parents=True)

        self._copy_runtime(web, test)
        for f in included:
            self._copy_feature(f, web, test)
        templates = ''.join(self._templates(f) for f in included)
        (web / 'app.css').write_text(self._css(app, included), 'utf-8')
        registry = [{
            'id': f.id, 'name': f.name, 'description': f.manifest['description'], 'version': f.version,
            'requires': f.requires, 'uses': f.uses, 'platforms': f.platforms,
            'path': f'features/{f.id}/{f.manifest["main"]}',
        } for f in included]
        config = {'id': app['id'], 'name': app['name'], 'description': app.get('description', ''), 'version': app['version'],
                  'build': str(build_number) if build_number else '', 'framework': self.framework_version,
                  'test': test}
        seed = test and (self.app_dir / 'tests' / 'seed.js').is_file()
        if test and (self.app_dir / 'tests').is_dir():
            shutil.copytree(self.app_dir / 'tests', web / 'app-tests')
        (web / 'start.js').write_text(self._start_js(config, registry, seed), 'utf-8')
        (web / 'index.html').write_text(self._index_html(app, templates, test), 'utf-8')
        manifest = self._web_manifest(app, included)
        (web / 'manifest.webmanifest').write_text(json.dumps(manifest, indent=2), 'utf-8')
        if (self.app_dir / 'icons').is_dir():
            shutil.copytree(self.app_dir / 'icons', web / 'icons',
                            ignore=shutil.ignore_patterns('icon-only.png'))
        if (self.app_dir / 'fonts').is_dir():
            shutil.copytree(self.app_dir / 'fonts', web / 'fonts')
        test_files = []
        if test:
            test_files = self._test_page(web, included)
        (web / 'sw.js').write_text(self._service_worker(app, web), 'utf-8')
        native_warnings = self._native(app, included, out)
        for warning in native_warnings:
            log.warn(warning)

        details = {'app': app, 'features': features, 'included': included, 'lint': lint + native_warnings,
                   'build': build_number, 'test_files': test_files}
        (out / 'report.html').write_text(self._report(details, log), 'utf-8')
        (out / 'build-log.txt').write_text('\n'.join(t for _, t in log.lines) + '\n', 'utf-8')

        left_out = len(features) - len(included)
        log.title('')
        log.title(f'Compiled {len(included)} feature{"s" * (len(included) != 1)}'
                  + (f', left out {left_out}' if left_out else '')
                  + f'. Output in {self._rel(out)}{os.sep}')
        return 0, details

    def _prepare(self, out: Path, log: Log) -> bool:
        marker = out / '.folio-output'
        if out.exists():
            if not marker.exists() and any(out.iterdir()):
                log.error(f'{self._rel(out)} has files Folio didn\'t make, so it wasn\'t emptied. '
                          'Choose another output folder.')
                return False
            shutil.rmtree(out)
        out.mkdir(parents=True)
        marker.write_text('This folder is made by the Folio compiler. Everything in it is replaced on each build.\n')
        return True

    def _copy_runtime(self, web: Path, test: bool):
        target = web / 'folio'
        target.mkdir()
        for js in sorted(self.runtime.glob('*.js')):
            if js.name == 'offline.js' or (js.name == 'testing.js' and not test):
                continue
            shutil.copy2(js, target / js.name)

    def _copy_feature(self, f: FeatureInfo, web: Path, test: bool):
        bundled = set(f.manifest.get('styles', [])) | {f.manifest.get('templates', ''), 'feature.json'}

        def ignore(folder, names):
            skip = set()
            for name in names:
                path = Path(folder) / name
                rel = path.relative_to(f.path).as_posix()
                if path.is_dir() and name in NOT_SHIPPED and Path(folder) == f.path and not (test and name == 'tests'):
                    skip.add(name)
                elif path.is_file() and (rel in bundled or name.endswith('.md')):
                    skip.add(name)
            return skip

        shutil.copytree(f.path, web / 'features' / f.id, ignore=ignore)

    def _templates(self, f: FeatureInfo) -> str:
        name = f.manifest.get('templates')
        if not name:
            return ''
        text = (f.path / name).read_text('utf-8')
        text = re.sub(r'<template(\s+)id="([\w-]+)"', lambda m: f'<template{m.group(1)}id="{f.id}--{m.group(2)}"', text)
        return f'\n<!-- feature: {f.id} -->\n{text.strip()}\n'

    def _css(self, app: dict, included: list[FeatureInfo]) -> str:
        theme = app['theme']
        parts = [(self.runtime / 'base.css').read_text('utf-8'),
                 '/* ---- Theme from app/app.json ---- */\n'
                 f':root {{ --accent: {theme["accent"]}; }}\n'
                 f'@media (prefers-color-scheme: dark) {{ :root {{ --accent: {theme["accentDark"]}; }} }}\n']
        theme_css = self.app_dir / 'theme.css'
        if theme_css.is_file():
            parts.append('/* ---- app/theme.css ---- */\n' + theme_css.read_text('utf-8'))
        for f in included:
            for style in f.manifest.get('styles', []):
                parts.append(f'/* ---- feature: {f.id} ({style}) ---- */\n' + (f.path / style).read_text('utf-8'))
        return '\n'.join(parts)

    def _import_map(self, test: bool) -> str:
        imports = {'folio': './folio/folio.js', 'folio/': './folio/'}
        if test:
            imports['folio/testing'] = './folio/testing.js'
        return json.dumps({'imports': imports})

    def _start_js(self, config: dict, registry: list, seed: bool) -> str:
        lines = [
            '// Made by the Folio compiler. Don\'t edit this file: change app/app.json or a feature folder,',
            '// then compile again (python build.py).',
            "import { App } from 'folio';",
        ]
        if seed:
            lines.append("import seed from './app-tests/seed.js';")
        lines += [
            f'const config = {json.dumps(config, indent=2)};',
            f'const features = {json.dumps(registry, indent=2)};',
            f'const app = new App(config, features{", { seed }" if seed else ""});',
            'app.start();' if not config['test'] else TEST_PROBE,
            '',
        ]
        return '\n'.join(lines)

    def _index_html(self, app: dict, templates: str, test: bool) -> str:
        page = (self.runtime / 'shell.html').read_text('utf-8')
        values = {
            'lang': html.escape(app['lang']),
            'name': html.escape(app['name']),
            'description': html.escape(app['description']),
            'background': html.escape(app['theme']['background']),
            'backgroundDark': html.escape(app['theme']['backgroundDark']),
            'importmap': self._import_map(test),
            'entry': 'start.js',
            'templates': templates,
        }
        for key, value in values.items():
            page = page.replace('{{' + key + '}}', value)
        return page

    def _web_manifest(self, app: dict, included: list[FeatureInfo]) -> dict:
        manifest = {
            'name': app['name'],
            'short_name': app.get('shortName', app['name']),
            'description': app['description'],
            'start_url': './',
            'scope': './',
            'display': 'standalone',
            'background_color': app['theme']['background'],
            'theme_color': app['theme']['accent'],
            'icons': [
                {'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
                {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
                {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
            ],
        }
        for f in included:
            deep_merge(manifest, f.manifest.get('web', {}).get('manifest', {}))
        return manifest

    def _test_page(self, web: Path, included: list[FeatureInfo]) -> list[str]:
        files = []
        framework_tests = self.framework / 'tests'
        if framework_tests.is_dir():
            target = web / 'folio-tests'
            target.mkdir()
            for t in sorted(framework_tests.glob('*.test.js')):
                shutil.copy2(t, target / t.name)
                files.append(f'./folio-tests/{t.name}')
        for f in included:
            for t in sorted((web / 'features' / f.id / 'tests').glob('*.test.js')):
                files.append(f'./features/{f.id}/tests/{t.name}')
        page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Tests</title>
<script type="importmap">{self._import_map(True)}</script>
<script type="module">
import {{ run }} from 'folio/testing';
const files = {json.dumps(files)};
const out = document.getElementById('results');
const result = await run(files);
out.textContent = result.results.map((r) => `${{r.ok ? 'PASS' : 'FAIL'}}  ${{r.file.replace('./', '')}}: ${{r.name}}${{r.ok ? '' : `\\n        ${{r.error}}`}}`).join('\\n')
  + `\\n\\n${{result.passed}} passed, ${{result.failed}} failed`;
out.dataset.status = result.failed ? 'fail' : 'pass';
fetch('/__folio_report', {{ method: 'POST', body: JSON.stringify({{ kind: 'tests', ...result }}) }}).catch(() => {{}});
</script>
</head>
<body><pre id="results" data-status="running">Running…</pre></body>
</html>
'''
        (web / 'tests.html').write_text(page, 'utf-8')
        return files

    def _service_worker(self, app: dict, web: Path) -> str:
        files, digest = ['./'], hashlib.sha256()
        for path in sorted(p for p in web.rglob('*') if p.is_file()):
            rel = path.relative_to(web).as_posix()
            if rel in ('sw.js', 'tests.html') or rel.startswith(('app-tests/', 'folio-tests/')) or '/tests/' in rel:
                continue
            files.append('./' + rel)
            digest.update(rel.encode())
            digest.update(path.read_bytes())
        text = (self.runtime / 'offline.js').read_text('utf-8')
        return (text.replace("'__CACHE__'", json.dumps(f'{app["id"]}-{digest.hexdigest()[:12]}'))
                    .replace('__FILES__', json.dumps(files, indent=2)))

    def _native(self, app: dict, included: list[FeatureInfo], out: Path) -> list[str]:
        """Writes what Capacitor needs to build the Android and iPhone apps."""
        warnings = []
        native_features = [f for f in included if 'android' in f.platforms or 'ios' in f.platforms]
        deps = {'@capacitor/android': CAPACITOR_VERSION, '@capacitor/core': CAPACITOR_VERSION,
                '@capacitor/ios': CAPACITOR_VERSION}
        for f in native_features:
            for package, version in f.native.get('packages', {}).items():
                if package in deps and deps[package] != version:
                    warnings.append(f'{f.id} wants {package} {version}, but another feature wants {deps[package]}')
                deps.setdefault(package, version)
        package_json = {
            'name': app['id'], 'version': app['version'], 'private': True, 'description': app['description'],
            'dependencies': dict(sorted(deps.items())),
            'devDependencies': {'@capacitor/cli': CAPACITOR_VERSION},
        }
        (out / 'package.json').write_text(json.dumps(package_json, indent=2) + '\n', 'utf-8')

        capacitor = {'appId': app['native']['appId'], 'appName': app['name'], 'webDir': 'web',
                     'android': {'adjustMarginsForEdgeToEdge': 'auto'}}
        for f in native_features:
            deep_merge(capacitor, f.native.get('capacitor', {}))
        deep_merge(capacitor, app['native'].get('capacitor', {}))
        (out / 'capacitor.config.json').write_text(json.dumps(capacitor, indent=2) + '\n', 'utf-8')

        android = {'permissions': [], 'features': [], 'files': [], 'gradle': {}}
        app_ios = app['native'].get('ios', {})
        ios = {'appId': app_ios.get('appId', app['native']['appId']), 'version': app['version'], 'devices': app_ios.get('devices', 'iphone-and-ipad'),
               'plist': merge_plist({}, app_ios.get('plist', {})), 'files': [], 'pods': []}
        for f in native_features:
            a = f.native.get('android', {})
            if 'android' in f.platforms:
                android['permissions'] += [p for p in a.get('permissions', []) if p not in android['permissions']]
                android['features'] += [x for x in a.get('features', []) if x not in android['features']]
                # Files for the Android project are kept next to native.json until the project exists.
                for to, source in a.get('files', {}).items():
                    kept = Path('android-files') / f.id / source
                    (out / kept).parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(f.path / source, out / kept)
                    android['files'].append({'from': kept.as_posix(), 'to': to})
                for name, value in a.get('gradle', {}).items():
                    if name in android['gradle'] and android['gradle'][name] != value:
                        warnings.append(f'{f.id} wants the Android setting {name} = {value!r}, '
                                        f'but another feature wants {android["gradle"][name]!r}')
                    android['gradle'].setdefault(name, value)
            if 'ios' in f.platforms:
                i = f.native.get('ios', {})
                merge_plist(ios['plist'], i.get('plist', {}))
                # Like Android's, files for the iPhone app wait next to native.json.
                for to, source in i.get('files', {}).items():
                    kept = Path('ios-files') / f.id / source
                    (out / kept).parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(f.path / source, out / kept)
                    ios['files'].append({'from': kept.as_posix(), 'to': to})
                ios['pods'] += [line.strip() for line in i.get('pods', []) if line.strip() not in ios['pods']]
        (out / 'native.json').write_text(json.dumps({'android': android, 'ios': ios}, indent=2) + '\n', 'utf-8')

        icon = self.app_dir / 'icons' / 'icon-only.png'
        if icon.exists():
            (out / 'assets').mkdir(exist_ok=True)
            shutil.copy2(icon, out / 'assets' / 'icon-only.png')
        return warnings

    def _report(self, details: dict, log: Log) -> str:
        e = html.escape
        app, features, included = details['app'], details['features'], details['included']
        included_ids = {f.id for f in included}

        def names(values):
            return ', '.join(values) or '—'

        rows = []
        for f in included + [f for f in features if f.reason]:
            status = 'Included' if f.id in included_ids else f'Left out: {f.reason}'
            native = f.native
            extras = []
            if native.get('packages'):
                extras.append('packages: ' + ', '.join(native['packages']))
            if native.get('android', {}).get('permissions'):
                extras.append('Android: ' + ', '.join(native['android']['permissions']))
            rows.append(
                f'<tr class="{"in" if f.id in included_ids else "out"}"><td><b>{e(f.name)}</b><br><code>{e(f.id)}</code>'
                f' {e(f.version)}</td><td>{e(f.manifest.get("description", "") if isinstance(f.manifest, dict) else "")}'
                f'<br><small>{e(status)}</small></td><td>{e(names(f.requires))}</td><td>{e(names(f.uses))}</td>'
                f'<td>{e(names(f.platforms))}</td><td>{e("; ".join(extras) or "—")}</td></tr>')

        slots = {}
        for name, description in FRAMEWORK_SLOTS.items():
            slots[name] = {'by': 'folio', 'description': description, 'added': []}
        for f in included:
            for s in f.scan.get('defines', []):
                slot = slots.setdefault(s, {'description': '', 'added': []})
                slot['by'] = f.id
                slot['description'] = f.scan.get('slot_descriptions', {}).get(s, '')
            for s in f.scan.get('adds', []):
                slots.setdefault(s, {'by': '?', 'description': '', 'added': []})['added'].append(f.id)
        slot_rows = ''.join(
            f'<tr><td><code>{e(name)}</code></td><td>{e(info.get("by", "?"))}</td>'
            f'<td>{e(names(info["added"]))}</td><td>{e(info.get("description", ""))}</td></tr>'
            for name, info in sorted(slots.items()))

        services = {}
        for f in included:
            for s in f.scan.get('provides', []):
                services.setdefault(s, {'by': [], 'users': []})['by'].append(f.id)
            for s in f.scan.get('uses', []):
                services.setdefault(s, {'by': [], 'users': []})['users'].append(f.id)
        service_rows = ''.join(
            f'<tr><td><code>{e(name)}</code></td><td>{e(names(info["by"]))}</td><td>{e(names(info["users"]))}</td></tr>'
            for name, info in sorted(services.items()))

        events = {}
        for f in included:
            for ev in f.scan.get('emits', []):
                events.setdefault(ev, {'by': [], 'heard': []})['by'].append(f.id)
            for ev in f.scan.get('listens', []):
                events.setdefault(ev, {'by': [], 'heard': []})['heard'].append(f.id)
        for ev in FRAMEWORK_EVENTS:
            events.setdefault(ev, {'by': [], 'heard': []})['by'].insert(0, 'folio')
        event_rows = ''.join(
            f'<tr><td><code>{e(name)}</code></td><td>{e(names(info["by"]))}</td><td>{e(names(info["heard"]))}</td></tr>'
            for name, info in sorted(events.items()))

        log_lines = '\n'.join(f'{log.symbols[k]} {t}' if log.symbols.get(k) else t for k, t in log.lines)
        built = datetime.datetime.now().strftime('%d %b %Y, %H:%M')
        return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(app["name"])}: build report</title>
<style>
body {{ font: 15px/1.5 system-ui, sans-serif; margin: 0 auto; max-width: 1100px; padding: 24px 16px; color: #151925; background: #f5f6fa; }}
h1 {{ margin: 0 0 4px; }} h2 {{ margin-top: 32px; }}
table {{ width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; }}
th, td {{ text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid #e3e6ee; }}
th {{ background: #eceef5; font-size: 13px; }}
tr.out td {{ color: #8a90a0; }} small {{ color: #5f6678; }} code {{ font-size: 13px; }}
pre {{ background: #fff; padding: 12px; border-radius: 12px; overflow: auto; font-size: 13px; }}
.muted {{ color: #5f6678; }}
@media (prefers-color-scheme: dark) {{ body {{ background: #0f1117; color: #e8eaf0; }} table, pre {{ background: #181b24; }}
  th {{ background: #232733; }} td, th {{ border-color: #2c313e; }} small, .muted {{ color: #9aa1b2; }} }}
</style></head><body>
<h1>{e(app["name"])} {e(app["version"])}</h1>
<p class="muted">Compiled {built} with Folio {e(self.framework_version)}{f" · build {e(str(details['build']))}" if details['build'] else ""} ·
{len(included)} features included, {len(features) - len(included)} left out · {log.warnings} warnings</p>
<h2>Features</h2>
<p class="muted">In the order they start. Each feature's code, styles and README are in <code>app/features/&lt;id&gt;/</code>.</p>
<table><tr><th>Feature</th><th>What it does</th><th>Requires</th><th>Uses if present</th><th>Platforms</th><th>Phone app extras</th></tr>
{"".join(rows)}</table>
<h2>Slots</h2>
<p class="muted">Places where features add things. Read from the code, so treat it as a guide.</p>
<table><tr><th>Slot</th><th>Defined by</th><th>Added to by</th><th>What goes in it</th></tr>{slot_rows}</table>
<h2>Services</h2>
<table><tr><th>Service</th><th>Provided by</th><th>Used by</th></tr>{service_rows}</table>
<h2>Events</h2>
<table><tr><th>Event</th><th>Sent by</th><th>Heard by</th></tr>{event_rows}</table>
<h2>Compiler log</h2>
<pre>{e(log_lines)}</pre>
</body></html>
'''

    def _rel(self, path: Path) -> str:
        try:
            return absolute(path).relative_to(self.root).as_posix()
        except ValueError:
            return str(path)


# ---------------------------------------------------------------------------------------------
# Serving and testing in a browser
# ---------------------------------------------------------------------------------------------

class QuietHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html',
        '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
        '.png': 'image/png', '.ics': 'text/calendar',
    }

    def log_message(self, *args):
        pass

    # Always send fresh files, so the browser never runs an older copy of the code.
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    # Test builds send their results here (see TEST_PROBE and the tests page).
    def do_POST(self):
        if self.path != '/__folio_report':
            self.send_error(404)
            return
        body = self.rfile.read(int(self.headers.get('Content-Length', 0) or 0))
        try:
            self.server.reports.append(json.loads(body))
        except ValueError:
            pass
        self.send_response(204)
        self.end_headers()


def start_server(directory: Path, port: int = 0) -> ThreadingHTTPServer:
    handler = functools.partial(QuietHandler, directory=str(directory))
    server = ThreadingHTTPServer(('127.0.0.1', port), handler)
    server.reports = []
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def find_browser() -> str | None:
    if os.environ.get('FOLIO_BROWSER'):
        return os.environ['FOLIO_BROWSER']
    for name in ('google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome', 'msedge'):
        path = shutil.which(name)
        if path:
            return path
    candidates = [
        r'C:\Program Files\Google\Chrome\Application\chrome.exe',
        r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
        r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
        r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ]
    return next((c for c in candidates if Path(c).exists()), None)


def _stop(process: subprocess.Popen):
    """Stops a browser and everything it started."""
    try:
        if os.name == 'nt':
            subprocess.run(['taskkill', '/T', '/F', '/PID', str(process.pid)], capture_output=True)
        else:
            os.killpg(process.pid, 9)
    except OSError:
        pass
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        pass


def browser_report(browser: str, server: ThreadingHTTPServer, path: str, timeout: float = 60) -> dict | None:
    """Opens a page from `server` in a hidden browser with a fresh profile and waits for the page
    to report back (test builds do this when they're done). Returns the report, or None."""
    server.reports.clear()
    profile = tempfile.mkdtemp(prefix='folio-browser-')
    url = f'http://127.0.0.1:{server.server_address[1]}/{path}'
    command = [browser, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
               '--disable-extensions', '--disable-background-networking', f'--user-data-dir={profile}', url]
    if sys.platform.startswith('linux'):
        command[1:1] = ['--no-sandbox', '--disable-dev-shm-usage']  # needed on GitHub's machines
    extra = {'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == 'nt' else {'start_new_session': True}
    process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **extra)
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline and not server.reports and process.poll() in (None, 0):
        time.sleep(0.1)
    _stop(process)
    shutil.rmtree(profile, ignore_errors=True)
    return server.reports[0] if server.reports else None


def run_compiler_tests(project: Project, log: Log) -> bool:
    tests_dir = project.framework / 'tests'
    if not any(tests_dir.glob('test_*.py')):
        log.info('no compiler tests found')
        return True
    sys.path.insert(0, str(project.framework / 'compiler'))
    suite = unittest.defaultTestLoader.discover(str(tests_dir), pattern='test_*.py', top_level_dir=str(tests_dir))
    result = unittest.TextTestRunner(stream=open(os.devnull, 'w'), verbosity=0).run(suite)
    for test, trace in result.failures + result.errors:
        log.error(f'{test.id()}\n{trace}')
    if result.wasSuccessful():
        log.ok(f'{result.testsRun} compiler tests passed')
    return result.wasSuccessful()


def run_tests(project: Project, args) -> int:
    log = Log()
    log.title('1. Compiler tests')
    ok = run_compiler_tests(project, log)

    browser = find_browser()
    if not browser:
        log.title('')
        log.warn('Couldn\'t find Chrome or Edge, so the browser tests were skipped. '
                 'Set FOLIO_BROWSER to a browser\'s path to run them.')
        return 0 if ok and not args.require_browser else 1

    tmp = Path(tempfile.mkdtemp(prefix='folio-test-'))
    try:
        log.title('')
        log.title('2. Feature and framework tests')
        quiet = Log(quiet=True)
        code, details = project.build(tmp / 'full', quiet, without=(), test=True)
        if code:
            for _, line in quiet.lines:
                log.plain(line)
            return 1
        for f in details['features']:
            if f.kind == 'mistake':
                log.error(f'{f.id} was left out because of a mistake: {f.reason}')
                ok = False
            elif f.kind == 'needs':
                log.warn(f'{f.id} was left out: {f.reason}')
        server = start_server(tmp / 'full' / 'web')
        report = browser_report(browser, server, 'tests.html')
        if not report:
            log.error('The test page didn\'t finish. Run `python build.py serve --test` and open '
                      'http://localhost:8000/tests.html to see why.')
            ok = False
        else:
            for r in report['results']:
                if not r['ok']:
                    log.error(f'{r["file"].replace("./", "")}: {r["name"]}\n        {r["error"]}')
            (log.ok if not report['failed'] else log.error)(f'{report["passed"]} passed, {report["failed"]} failed')
            ok = ok and not report['failed']

        def check_app(label: str, server, path: str = 'index.html') -> bool:
            result = browser_report(browser, server, path)
            if result and result.get('state') == 'ready' and not result.get('problems'):
                log.ok(f'{label}: works ({len(result["active"])} features running)')
                return True
            if not result:
                log.error(f'{label}: the app didn\'t report back, so it may not have started')
            else:
                log.error(f'{label}: {len(result["problems"])} problem(s)')
                for problem in result['problems'][:5]:
                    log.plain(f'      {problem}')
            return False

        log.title('')
        log.title('3. The whole app works: every view, a session, Settings and each menu button')
        all_ids = [f.id for f in details['included']]
        for view in ('home', 'day', 'week', 'agenda'):
            ok = check_app(f'starting on {view}', server, f'index.html#view={view}') and ok
        server.shutdown()

        if not args.quick:
            log.title('')
            log.title('4. Delete-a-folder test: the app still works without each feature')
            runs = [(f'without {fid}', (fid,)) for fid in all_ids] + [('without any features', tuple(all_ids))]
            for number, (label, without) in enumerate(runs):
                out = tmp / f'without-{number}'
                code, _ = project.build(out, Log(quiet=True), without=without, test=True)
                if code:
                    log.error(f'{label}: didn\'t compile')
                    ok = False
                    continue
                server = start_server(out / 'web')
                ok = check_app(label, server) and ok
                server.shutdown()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    log.title('')
    log.title('All tests passed.' if ok else 'Some tests failed. See the lines marked above.')
    return 0 if ok else 1


# ---------------------------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------------------------

def cmd_build(project: Project, args) -> int:
    without = tuple(x.strip() for x in (args.without or '').split(',') if x.strip())
    code, _ = project.build(Path(args.out), Log(), build_number=args.build, without=without, test=args.test)
    return code


def cmd_check(project: Project, args) -> int:
    log = Log()
    log.title(f'Checking with Folio {project.framework_version}')
    if project.load_app(log) is None:
        return 1
    features = project.discover(log)
    included = project.resolve(features)
    for f in included:
        log.ok(f'{f.id}')
        for warning in f.warnings:
            log.warn(f'{f.id}: {warning}')
    for f in features:
        if f.reason:
            (log.error if f.kind == 'mistake' else log.warn if f.kind == 'needs' else log.info)(
                f'{f.id}: left out: {f.reason}')
    for warning in project.lint(features, included):
        log.warn(warning)
    log.title('')
    log.title('No mistakes found.' if not log.errors else f'{log.errors} mistake(s) found.')
    return 1 if log.errors else 0


def cmd_list(project: Project, args) -> int:
    log = Log(quiet=True)
    features = project.discover(log)
    included = project.resolve(features)
    included_ids = [f.id for f in included]
    print(f'{"Feature":<16} {"Status":<10} {"Requires":<24} {"Uses if present":<24} Platforms')
    for f in included + [f for f in features if f.reason]:
        status = f'#{included_ids.index(f.id) + 1}' if f.id in included_ids else 'left out'
        print(f'{f.id:<16} {status:<10} {", ".join(f.requires) or "-":<24} {", ".join(f.uses) or "-":<24} '
              f'{", ".join(f.platforms)}')
        if f.reason:
            print(f'{"":<16} {f.reason}')
    print('\n#n is the order features start in.')
    return 0


def cmd_new_feature(project: Project, args) -> int:
    fid = args.id
    if not FOLDER_NAME.match(fid):
        print('Use lowercase words joined by dashes, e.g. "study-timer".')
        return 1
    target = project.features_dir / fid
    if target.exists():
        print(f'app/features/{fid} already exists.')
        return 1
    class_name = ''.join(part.capitalize() for part in fid.split('-'))
    name = args.name or fid.replace('-', ' ').capitalize()
    requires = [r.strip() for r in (args.requires or '').split(',') if r.strip()]
    template = project.framework / 'templates' / 'feature'
    shutil.copytree(template, target)
    replacements = {'__ID__': fid, '__NAME__': name, '__CLASS__': class_name,
                    '__REQUIRES_TEXT__': ', '.join(requires) or 'nothing',
                    '__REQUIRES__': json.dumps(requires),
                    '__DESCRIPTION__': args.description or f'TODO: say in one sentence what {name} does.'}
    for path in target.rglob('*'):
        if path.is_file():
            text = path.read_text('utf-8')
            for key, value in replacements.items():
                text = text.replace(key, value)
            path.write_text(text, 'utf-8')
    (target / 'Main.js').rename(target / f'{class_name}.js')
    print(f'Created app/features/{fid}/ with {class_name}.js, style.css, README.md and tests/.')
    print('Next: describe it in feature.json and README.md, then compile with `python build.py`.')
    return 0


def cmd_serve(project: Project, args) -> int:
    code = cmd_build(project, args)
    if code:
        return code
    server = start_server(Path(args.out) / 'web', args.port)
    url = f'http://localhost:{server.server_address[1]}/'
    print(f'\nServing at {url}' + (f'  (tests: {url}tests.html)' if args.test else '') + '\nPress Ctrl+C to stop.')
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        server.shutdown()
    return 0


def cmd_android_manifest(project: Project, args) -> int:
    """Adds the Android permissions that features asked for to the Android project's manifest."""
    native = json.loads((Path(args.out) / 'native.json').read_text('utf-8'))['android']
    path = Path(args.manifest)
    text = path.read_text('utf-8')
    added = []
    lines = []
    for permission in native.get('permissions', []):
        full = permission if '.' in permission else f'android.permission.{permission}'
        if f'"{full}"' not in text:
            lines.append(f'    <uses-permission android:name="{full}" />')
            added.append(full)
    for feat in native.get('features', []):
        name = feat['name'] if isinstance(feat, dict) else feat
        required = 'true' if isinstance(feat, dict) and feat.get('required') else 'false'
        if f'"{name}"' not in text:
            lines.append(f'    <uses-feature android:name="{name}" android:required="{required}" />')
            added.append(name)
    if lines:
        text = text.replace('<application', '\n'.join(lines).lstrip() + '\n\n    <application', 1)
        path.write_text(text, 'utf-8')
    print('Added to the Android manifest: ' + (', '.join(added) if added else 'nothing'))
    return 0


def gradle_value(value) -> str:
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, int):
        return str(value)
    return "'" + value.replace('\\', '\\\\').replace("'", "\\'") + "'"


def cmd_android_project(project: Project, args) -> int:
    """Copies the files features asked for into the Android project, and adds their settings to
    its variables.gradle."""
    out = Path(args.out)
    native = json.loads((out / 'native.json').read_text('utf-8'))['android']
    android = Path(args.android)
    for item in native.get('files', []):
        target = android / item['to']
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(out / item['from'], target)
        print(f'Copied into the Android project: {item["to"]}')
    gradle = native.get('gradle', {})
    if gradle:
        lines = '\n'.join(f'    {name} = {gradle_value(value)}' for name, value in gradle.items())
        with (android / 'variables.gradle').open('a', encoding='utf-8') as f:
            f.write(f'\n// Added by Folio, from features\' feature.json\next {{\n{lines}\n}}\n')
        print('Added to variables.gradle: ' + ', '.join(gradle))
    if not native.get('files') and not gradle:
        print('Nothing to add to the Android project')
    return 0


def cmd_ios_project(project: Project, args) -> int:
    """Prepares the iPhone project Capacitor made (e.g. dist/ios/App) for building: features'
    Info.plist entries, files added to the app (copied in and listed in the Xcode project), lines
    for the Podfile, and the app's id, version, build number, devices and Apple team."""
    native = json.loads((Path(args.out) / 'native.json').read_text('utf-8'))['ios']
    ios = Path(args.ios)
    pbx = ios / 'App.xcodeproj' / 'project.pbxproj'
    if not pbx.is_file():
        print(f'{ios} isn\'t an iPhone project made by Capacitor (no App.xcodeproj). Run "npx cap add ios" first.')
        return 1
    if args.team and not TEAM_ID.match(args.team):
        print(f'"{args.team}" isn\'t an Apple team id (10 capital letters and numbers, from developer.apple.com → Membership).')
        return 1

    plist_path = ios / 'App' / 'Info.plist'
    with plist_path.open('rb') as f:
        info = plistlib.load(f)
    merge_plist(info, native.get('plist', {}))
    with plist_path.open('wb') as f:
        plistlib.dump(info, f)
    print('Added to Info.plist: ' + (', '.join(native['plist']) if native.get('plist') else 'nothing'))

    files = native.get('files', [])
    if files:
        try:
            from pbxproj import XcodeProject
        except ImportError:
            print('Adding files to the iPhone app needs the pbxproj package: pip install pbxproj')
            return 1
        xcode = XcodeProject.load(str(pbx))
        group = xcode.get_or_create_group('App')
        for item in files:
            target = ios / 'App' / item['to']
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(Path(args.out) / item['from'], target)
            xcode.add_file(f'App/{item["to"]}', parent=group, target_name='App', force=False)
            print(f'Added to the iPhone app: {item["to"]}')
        xcode.save()

    pods = native.get('pods', [])
    if pods:
        podfile = ios / 'Podfile'
        text = podfile.read_text('utf-8')
        marker = '# Add your Pods here'
        if marker not in text:
            print(f'Couldn\'t find "{marker}" in the Podfile, so its lines weren\'t added.')
            return 1
        new = [p for p in pods if p not in text]
        text = text.replace(marker, marker + ''.join(f'\n  {p}' for p in new), 1)
        podfile.write_text(text, 'utf-8')
        print('Added to the Podfile: ' + (', '.join(new) if new else 'nothing new'))

    text = pbx.read_text('utf-8')
    settings = {
        'PRODUCT_BUNDLE_IDENTIFIER': native['appId'],
        'MARKETING_VERSION': native.get('version', '1.0.0'),
        'CURRENT_PROJECT_VERSION': str(args.build or 1),
    }
    if native.get('devices') == 'iphone':
        settings['TARGETED_DEVICE_FAMILY'] = '1'
    for name, value in settings.items():
        text, count = re.subn(rf'(\b{name} = )[^;]*;', lambda m: m.group(1) + pbx_value(value) + ';', text)
        if not count and name != 'TARGETED_DEVICE_FAMILY':
            print(f'Couldn\'t find {name} in the Xcode project.')
            return 1
    if args.team:
        text = re.sub(r'\n(\s*)DEVELOPMENT_TEAM = [^;]*;', '', text)
        text, count = re.subn(r'(\n(\s*)CODE_SIGN_STYLE = Automatic;)', rf'\1\n\2DEVELOPMENT_TEAM = {args.team};', text)
        if not count:
            print('Couldn\'t find where to set the Apple team in the Xcode project.')
            return 1
    pbx.write_text(text, 'utf-8')
    print(f'iPhone app: {native["appId"]}, version {settings["MARKETING_VERSION"]} '
          f'(build {settings["CURRENT_PROJECT_VERSION"]})' + (f', team {args.team}' if args.team else '')
          + (', iPhone only' if native.get('devices') == 'iphone' else ''))
    return 0


def pbx_value(value: str) -> str:
    """A value as the Xcode project file writes it: bare if it's simple, otherwise in quotes."""
    return value if re.fullmatch(r'[A-Za-z0-9_.\-/]+', value) else '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'


def cmd_version(project: Project, args) -> int:
    app = project.load_app(Log(quiet=True))
    if not app:
        return 1
    print(app['version'])
    return 0


def main(argv: list[str], root: Path) -> int:
    try:
        sys.stdout.reconfigure(errors='replace')
    except (AttributeError, ValueError):
        pass
    parser = argparse.ArgumentParser(
        prog='python build.py',
        description='Folio: compiles the app in app/ into dist/. With no command, it compiles.')
    sub = parser.add_subparsers(dest='command', metavar='command')

    def output_options(p):
        p.add_argument('--out', default=str(root / 'dist'), help='output folder (default: dist)')
        p.add_argument('--build', help='build number to show in the app, e.g. from GitHub')
        p.add_argument('--without', help='leave these features out, e.g. --without notes,maps')
        p.add_argument('--test', action='store_true', help='include the tests page and sample data')

    output_options(sub.add_parser('build', help='compile the app into dist/ (the default)'))
    sub.add_parser('check', help='check every feature for mistakes, without compiling')
    sub.add_parser('list', help='list the features, what they need, and the order they start in')
    p = sub.add_parser('new-feature', help='create a new feature folder from the template')
    p.add_argument('id', help='folder name, e.g. study-timer')
    p.add_argument('--name', help='name shown to people, e.g. "Study timer"')
    p.add_argument('--description', help='one sentence saying what it does')
    p.add_argument('--requires', help='features it needs, e.g. sessions,timetable')
    p = sub.add_parser('serve', help='compile, then run the app on this computer')
    output_options(p)
    p.add_argument('--port', type=int, default=8000)
    p = sub.add_parser('test', help='run all tests, including the delete-a-folder test')
    p.add_argument('--quick', action='store_true', help='skip the delete-a-folder test')
    p.add_argument('--require-browser', action='store_true', help='fail if no browser is found (for GitHub)')
    p = sub.add_parser('android-manifest', help='add features\' Android permissions (used by GitHub)')
    p.add_argument('manifest', help='path to AndroidManifest.xml')
    p.add_argument('--out', default=str(root / 'dist'))
    p = sub.add_parser('android-project', help='copy features\' Android files and settings (used by GitHub)')
    p.add_argument('android', help='path to the Android project, e.g. dist/android')
    p.add_argument('--out', default=str(root / 'dist'))
    p = sub.add_parser('ios-project', help='prepare the iPhone project for building (used by GitHub)')
    p.add_argument('ios', help='path to the iPhone project, e.g. dist/ios/App')
    p.add_argument('--out', default=str(root / 'dist'))
    p.add_argument('--build', help='build number, e.g. from GitHub')
    p.add_argument('--team', help='Apple team id, for signing')
    sub.add_parser('version', help='print the app\'s version from app.json')

    if not argv or argv[0].startswith('-') and argv[0] not in ('-h', '--help'):
        argv = ['build', *argv]
    args = parser.parse_args(argv)
    project = Project(root)
    commands = {
        'build': cmd_build, 'check': cmd_check, 'list': cmd_list, 'new-feature': cmd_new_feature,
        'serve': cmd_serve, 'test': lambda p, a: run_tests(p, a), 'android-manifest': cmd_android_manifest,
        'android-project': cmd_android_project, 'ios-project': cmd_ios_project, 'version': cmd_version,
    }
    return commands[args.command](project, args)
