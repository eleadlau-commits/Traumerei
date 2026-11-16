#!/usr/bin/env python3
"""Pack a Träumerei plugin folder into one importable <id>.traumplug, with no repo and no npm.

    python traumplug.py path/to/my-plugin [--out DIR]

The folder holds `feature.json` (with its `plugin` block), the main file it names, any files the
main file imports by a relative path (`./rules.js`), and `style.css` if listed in `styles`. Use
this only where the Träumerei repo is not at hand: in the repo, `python build.py check <id>` runs
every check and packs with the real bundler.

What it checks first (as the app does when a person imports the file, app/core/plugins/imported.js):
the id, name, version, the plugin block (api, minApp, kind and needs from the one list), that it
requires only "api", imports nothing bare but 'folio', and asks for no service but 'traumerei'.
If `node` is installed, it also checks the package parses.

The package (format traumplug/1) is one JavaScript module:
    export const manifest = {...}; export const css = "..."; export default (__folio__) => { ...; return Class; };
"""

import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

FORMAT = 'traumplug/1'
KINDS = ('mode', 'item', 'view', 'editor', 'command', 'link', 'reader', 'format', 'page', 'look', 'tool', 'dock', 'provider')
NEEDS = ('files', 'network', 'sidecar', 'store', 'ai', 'surface')
FOLIO = ('App', 'Feature', 'ui', 'time', 'VERSION')
API = 3
ID = re.compile(r'^[a-z][a-z0-9-]*$')
VERSION = re.compile(r'^\d+\.\d+\.\d+$')
IMPORT = re.compile(r'^\s*import\s+(?P<what>[\s\S]*?)\s+from\s+[\'"](?P<src>[^\'"]+)[\'"]\s*;?\s*$', re.M)
BARE_IMPORT = re.compile(r'^\s*import\s+[\'"][^\'"]+[\'"]\s*;?\s*$', re.M)


class Problem(Exception):
    pass


def check_manifest(m: dict, pid: str) -> None:
    if not ID.match(pid):
        raise Problem(f'The id "{pid}" must be lowercase words joined by dashes (the folder name).')
    if not isinstance(m.get('name'), str) or not m['name']:
        raise Problem('feature.json has no "name".')
    if m.get('version') and not VERSION.match(m['version']):
        raise Problem('"version" must look like 1.0.0.')
    p = m.get('plugin')
    if not isinstance(p, dict):
        raise Problem('feature.json has no "plugin" block.')
    if not isinstance(p.get('api'), int) or not 1 <= p['api'] <= API:
        raise Problem(f'"plugin.api" must be a whole number up to {API}.')
    if not VERSION.match(str(p.get('minApp', ''))):
        raise Problem('"plugin.minApp" must say the oldest app it works with, like 1.1.2.')
    for k in p.get('kind', []):
        if k not in KINDS:
            raise Problem(f'"plugin.kind" has "{k}"; use only: {", ".join(KINDS)}.')
    for k in p.get('needs', []):
        if k not in NEEDS:
            raise Problem(f'"plugin.needs" has "{k}"; use only: {", ".join(NEEDS)}.')
    if p.get('sidecar') and 'sidecar' not in p.get('needs', []):
        raise Problem('A sidecar needs "sidecar" in "plugin.needs".')
    for r in m.get('requires', []):
        if r != 'api':
            raise Problem(f'"requires" has "{r}"; an imported plugin may require only "api".')


def strip_exports(code: str) -> str:
    code = re.sub(r'^(\s*)export\s+default\s+(class|function|async\s+function)\b', r'\1\2', code, flags=re.M)
    code = re.sub(r'^(\s*)export\s+(const|let|var|function|async\s+function|class)\b', r'\1\2', code, flags=re.M)
    if re.search(r'^\s*export\s*\{', code, re.M):
        raise Problem('Write `export const/function` in place, not `export { … }` lists.')
    return code


def default_name(code: str) -> str:
    m = re.search(r'^\s*export\s+default\s+class\s+(\w+)', code, re.M)
    if not m:
        raise Problem('The main file needs `export default class <Name> extends Feature { … }`.')
    return m.group(1)


def bundle(folder: Path, main: str) -> str:
    """The plugin's code, its relative imports inlined once each (dependencies first)."""
    done: list[Path] = []
    pieces: list[str] = []
    folio_names: set[str] = set()

    def visit(path: Path, stack: tuple):
        path = path.resolve()
        if path in done:
            return
        if path in stack:
            raise Problem(f'{path.name} imports itself through a loop.')
        if not path.is_file():
            raise Problem(f'{path.name} is imported but not in the folder.')
        code = path.read_text('utf-8')
        if BARE_IMPORT.search(code):
            raise Problem(f'{path.name}: side-effect imports are not allowed.')
        aliases = []
        for m in IMPORT.finditer(code):
            what, src = m.group('what').strip(), m.group('src')
            if src == 'folio':
                inner = re.fullmatch(r'\{([^}]*)\}', what)
                if not inner:
                    raise Problem(f"{path.name}: import from 'folio' as `import {{ Feature, ui }} from 'folio'`.")
                for name in [n.strip() for n in inner.group(1).split(',') if n.strip()]:
                    if name.split(' as ')[0].strip() not in FOLIO:
                        raise Problem(f"{path.name}: 'folio' offers only {', '.join(FOLIO)}.")
                    folio_names.add(name)
            elif src.startswith('./') or src.startswith('../'):
                if not src.endswith('.js'):
                    raise Problem(f'{path.name}: write the file name in full, "{src}.js".')
                if what.startswith('*'):
                    raise Problem(f'{path.name}: import names (`import {{ a, b }} from "{src}"`), not `* as`.')
                inner = re.fullmatch(r'\{([^}]*)\}', what)
                if not inner:
                    raise Problem(f'{path.name}: import names (`import {{ a, b }} from "{src}"`), not a default.')
                for name in [n.strip() for n in inner.group(1).split(',') if n.strip()]:
                    if ' as ' in name:
                        a, b = [x.strip() for x in name.split(' as ')]
                        aliases.append(f'const {b} = {a};')
                visit(path.parent / src, stack + (path,))
            else:
                raise Problem(f'{path.name}: "{src}" is a bare import; a plugin brings no packages (only \'folio\').')
        body = IMPORT.sub('', code)
        pieces.append(f'// ---- {path.name}\n' + '\n'.join(aliases) + '\n' + strip_exports(body))
        done.append(path)

    visit(folder / main, ())
    head = f"const {{ {', '.join(sorted(folio_names))} }} = __folio__;\n" if folio_names else ''
    return head + '\n'.join(pieces)


def pack(folder: Path, out: Path) -> Path:
    folder = folder.resolve()
    pid = folder.name
    raw = json.loads((folder / 'feature.json').read_text('utf-8'))
    check_manifest(raw, pid)
    main = raw.get('main', 'index.js')
    main_code = (folder / main).read_text('utf-8')
    cls = default_name(main_code)
    code = bundle(folder, main)
    for _, name in re.findall(r'\.use\(\s*([\'"])([\w.:-]+)\1', code):
        if name != 'traumerei':
            raise Problem(f'It asks for "{name}"; a plugin reaches the app only through the plugin API (use(\'traumerei\')).')
    if raw.get('templates'):
        raise Problem('"templates" are not carried in a package.')
    css = '\n'.join((folder / s).read_text('utf-8') for s in raw.get('styles', []))
    manifest = {'format': FORMAT, 'id': pid, 'name': raw['name'], 'description': raw.get('description', ''),
                'version': raw.get('version', '0.1.0'), 'requires': raw.get('requires', ['api']), 'plugin': raw['plugin']}
    text = (f'// Träumerei plugin package ({FORMAT}): {manifest["name"]} {manifest["version"]}. '
            f'Packed by traumplug.py; import it in Settings → Plugins.\n'
            f'export const manifest = {json.dumps(manifest, ensure_ascii=False)};\n'
            f'export const css = {json.dumps(css, ensure_ascii=False)};\n'
            f'export default (__folio__) => {{\n{code}\nreturn {cls};\n}};\n')
    node = shutil.which('node')
    if node:
        with tempfile.TemporaryDirectory() as d:
            probe = Path(d) / 'probe.mjs'
            probe.write_text(text, 'utf-8')
            r = subprocess.run([node, '--check', str(probe)], capture_output=True, text=True)
            if r.returncode:
                raise Problem('The package does not parse:\n' + (r.stderr or r.stdout)[-1500:])
    out.mkdir(parents=True, exist_ok=True)
    path = out / f'{pid}.traumplug'
    path.write_text(text, 'utf-8')
    return path


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith('--')]
    out = Path.cwd()
    if '--out' in argv:
        i = argv.index('--out')
        out = Path(argv[i + 1])
        args = [a for a in args if a != argv[i + 1]]
    if len(args) != 1:
        print(__doc__)
        return 2
    try:
        path = pack(Path(args[0]), out)
    except Problem as p:
        print(f'✗ {p}')
        return 1
    print(f'✓ Wrote {path} ({max(1, path.stat().st_size // 1024)} KB). Import it in Träumerei: Settings → Plugins → Import plugin…')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
