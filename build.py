#!/usr/bin/env python3
"""Compiles the app: run `python build.py`. Run `python build.py --help` for every command.

The compiler itself is in folio/compiler/folioc.py; this file just starts it.
"""

import os
import sys
from pathlib import Path

ROOT = Path(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, str(ROOT / 'folio' / 'compiler'))

from folioc import main  # noqa: E402

# Träumerei's own commands, kept out of Folio's compiler (tools/).
OWN = {
    'release': 'set one version in app.json, tauri.conf.json and Cargo.toml (release --check <tag> checks them)',
    'pack-plugin': 'pack a plugin into one importable <id>.traumplug file',
}


def own(argv: list[str]) -> int | None:
    if not argv:
        return None
    if argv[0] == 'release':
        from tools import release
        return release.main(argv[1:])
    if argv[0] == 'pack-plugin':
        from tools import pack_plugin
        return pack_plugin.main(argv[1:])
    return None


if __name__ == '__main__':
    sys.path.insert(0, str(ROOT))
    code = own(sys.argv[1:])
    if code is None:
        if sys.argv[1:2] in (['-h'], ['--help']):
            print('Träumerei commands:\n' + '\n'.join(f'  {k:<12} {v}' for k, v in OWN.items()) + '\n')
        code = main(sys.argv[1:], ROOT)
    sys.exit(code)
