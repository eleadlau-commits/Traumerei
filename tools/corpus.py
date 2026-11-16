"""Which plugins are built into the app, and which ship as files (E's rule, 15 Nov 2026).

Only corpus plugins are built in. Every other plugin ships as a file: its source stays in
app/plugins/ so `python build.py test` runs it through the suites, standalone.py leaves it out of
the product (the web copy and the Windows app), and each release carries it as a .traumplug, with
all of them together in starter-set.traumplug (`python build.py pack-plugin --all`), imported in
Settings → Plugins.

The corpus has two parts:
- ROOM_TYPES: the ways of seeing a room, built into the app and on (Joyce, Pessoa, Russell,
  Proust; Borges and Twin join them as they leave core).
- CORPUS: the stress corpus (docs/CORPUS.md), plugins written to test the plugin API, not for
  people: they start off and are left out of the product too (`--corpus` keeps them in).
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

ROOM_TYPES = ('joyce', 'pessoa', 'russell', 'proust')

CORPUS = (
    'kanban', 'calendar', 'outline', 'grid', 'timeline', 'random',
    'checkbox', 'quote', 'code-block', 'audio-note', 'pdf-page', 'table',
    'cites', 'contradicts', 'example-of', 'translates', 'duplicates', 'links',
    'word-count', 'oldest-gap', 'link-graph', 'print-view', 'room-outline',
    'markdown-vault', 'csv-marks', 'json-tables', 'anki-deck', 'plain-text',
    'word-linker', 'due-finder', 'nonsense-reader',
    'focus-mode', 'room-stats', 'export-room',
)


def plugins() -> list[str]:
    """Every plugin in app/plugins/, by folder name."""
    return sorted(p.parent.name for p in (ROOT / 'app' / 'plugins').glob('*/feature.json'))


# Plugins shipped apart from the app, as their own .traumplug beside each Release (release.yml):
# every plugin that isn't corpus. A new plugin is one of them unless it joins the corpus.
APART = tuple(p for p in plugins() if p not in ROOM_TYPES + CORPUS)

# Everything standalone.py leaves out of the product.
LEFT_OUT = CORPUS + APART
