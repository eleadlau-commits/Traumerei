"""`python tools/room_types_guide.py`: copies docs/ROOM-TYPES.md and docs/room-types/month-calendar.md
into app/plugins/room-types/guide.js, the words Copy guide puts on the clipboard. Run it after
changing either file; tools/tests/test_room_types.py fails while they differ."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GUIDE = ROOT / 'docs' / 'ROOM-TYPES.md'
CALENDAR = ROOT / 'docs' / 'room-types' / 'month-calendar.md'
OUT = ROOT / 'app' / 'plugins' / 'room-types' / 'guide.js'


def text() -> str:
    g, c = GUIDE.read_text('utf-8'), CALENDAR.read_text('utf-8')
    return ('// Room types: the guide a model follows (docs/ROOM-TYPES.md) and the calendar file\n'
            '// (docs/room-types/month-calendar.md), copied here word for word; tools/tests/test_room_types.py\n'
            '// checks they match. After changing either .md, run: python tools/room_types_guide.py\n'
            f'export const GUIDE = {json.dumps(g, ensure_ascii=False)};\n'
            f'export const CALENDAR = {json.dumps(c, ensure_ascii=False)};\n'
            '// What Copy guide puts on the clipboard: the guide, then the calendar file.\n'
            'export const COPIED = `${GUIDE}\\n## The calendar file\\n\\n~~~markdown\\n${CALENDAR}~~~\\n`;\n')


if __name__ == '__main__':
    OUT.write_text(text(), 'utf-8', newline='\n')
    print(f'Wrote {OUT.relative_to(ROOT)}')
