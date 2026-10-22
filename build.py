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

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:], ROOT))
