import unittest

from tools import room_types_guide


class RoomTypesGuideTest(unittest.TestCase):
    def test_guide_js_matches_the_docs(self):
        self.assertEqual(room_types_guide.OUT.read_text('utf-8'), room_types_guide.text(),
                         'app/plugins/room-types/guide.js differs from docs/ROOM-TYPES.md or the calendar file: '
                         'run python tools/room_types_guide.py')


if __name__ == '__main__':
    unittest.main()
