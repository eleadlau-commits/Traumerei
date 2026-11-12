"""`python build.py release <version>`: writes one version into the three places it lives
(app/app.json, desktop/src-tauri/tauri.conf.json, desktop/src-tauri/Cargo.toml).
`python build.py release --check <tag>` exits with an error unless the three agree with the tag
(release.yml runs it on every v* tag, so a Release can't carry a mismatched version)."""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / 'app' / 'app.json'
CONF = ROOT / 'desktop' / 'src-tauri' / 'tauri.conf.json'
CARGO = ROOT / 'desktop' / 'src-tauri' / 'Cargo.toml'
VERSION = re.compile(r'^\d+\.\d+\.\d+$')
CARGO_LINE = re.compile(r'^version = "(.+?)"', re.M)


def versions(root: Path = ROOT) -> dict:
    app = root / APP.relative_to(ROOT)
    conf = root / CONF.relative_to(ROOT)
    cargo = root / CARGO.relative_to(ROOT)
    return {
        'app/app.json': json.loads(app.read_text('utf-8'))['version'],
        'tauri.conf.json': json.loads(conf.read_text('utf-8'))['version'],
        'Cargo.toml': CARGO_LINE.search(cargo.read_text('utf-8')).group(1),
    }


def write(version: str, root: Path = ROOT):
    """Sets the version in the three files, changing only the version text in each."""
    for path in (root / APP.relative_to(ROOT), root / CONF.relative_to(ROOT)):
        text = path.read_text('utf-8')
        path.write_text(re.sub(r'("version":\s*")[^"]*(")', rf'\g<1>{version}\g<2>', text, count=1), 'utf-8')
    cargo = root / CARGO.relative_to(ROOT)
    cargo.write_text(CARGO_LINE.sub(f'version = "{version}"', cargo.read_text('utf-8'), count=1), 'utf-8')


def check(tag: str, root: Path = ROOT) -> str:
    """'' when the tag (with or without its v) and the three versions agree, else the problem."""
    want = tag[1:] if tag.startswith('v') else tag
    found = versions(root)
    wrong = [f'{name} says {v}' for name, v in found.items() if v != want]
    return f'The tag says {want}, but ' + ', '.join(wrong) + f'. Run python build.py release {want} and merge it first.' if wrong else ''


def main(argv: list[str]) -> int:
    if argv[:1] == ['--check'] and len(argv) == 2:
        problem = check(argv[1])
        if problem:
            print(f'::error::{problem}')
            return 1
        print(f'All three say {argv[1].lstrip("v")}.')
        return 0
    if len(argv) != 1 or not VERSION.match(argv[0].lstrip('v')):
        print('Usage: python build.py release <version>, like 1.0.2 (or release --check v1.0.2)')
        return 2
    version = argv[0].lstrip('v')
    write(version)
    print(f'Set {version} in app/app.json, tauri.conf.json and Cargo.toml. '
          f'Add it to CHANGELOG.md, merge, then tag main v{version}.')
    return 0
