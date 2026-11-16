"""Which plugins are built into the app, and which ship as files (E's rule, 15 Nov 2026).

Only corpus plugins are built in; they live in app/plugins/. Every other plugin ships as a file
and lives in app/optional/ (the extra plugins): `python build.py test` runs it through the suites,
standalone.py leaves it out of the product (the web copy and the Windows app), and each merge to
main (plugins.yml, the rolling "plugins-latest" release) and each release carry it as a
.traumplug, with all but Book and Provoke together in starter-set.traumplug
(`python build.py pack-plugin --all`), imported in Settings → Plugins.

The corpus has two parts:
- ROOM_TYPES: the ways of seeing a room, built into the app and on (Joyce, Pessoa, Russell,
  Proust; Borges and Twin join them as they leave core).
- CORPUS: the stress corpus (docs/CORPUS.md), plugins written to test the plugin API, not for
  people: they start off and are left out of the product too (`--corpus` keeps them in).
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

ROOM_TYPES = ('joyce', 'pessoa', 'borges', 'twin', 'russell', 'proust')

CORPUS = (
    'kanban', 'calendar', 'outline', 'grid', 'timeline', 'random',
    'checkbox', 'quote', 'code-block', 'audio-note', 'pdf-page', 'table',
    'cites', 'contradicts', 'example-of', 'translates', 'duplicates', 'links',
    'word-count', 'oldest-gap', 'link-graph', 'print-view', 'room-outline',
    'markdown-vault', 'csv-marks', 'json-tables', 'anki-deck', 'plain-text',
    'word-linker', 'due-finder', 'nonsense-reader',
    'focus-mode', 'room-stats', 'export-room',
    # the open core's proofs (open-core plan, one per step)
    'page-flow', 'first-letters', 'spell-marks', 'bold-italic', 'figure', 'docx',
    'word-count-strip', 'sketch', 'chart',
    'highlighter',
    'manuscript',
)


FOLDERS = ('plugins', 'optional')  # app/plugins/: the corpus; app/optional/: the extra plugins


def plugins(folder: str | None = None) -> list[str]:
    """Every plugin in app/plugins/ and app/optional/ (or in one of them), by folder name."""
    return sorted(p.parent.name for f in ((folder,) if folder else FOLDERS) for p in (ROOT / 'app' / f).glob('*/feature.json'))


def folder_of(plugin_id: str) -> Path:
    """A plugin's folder: app/optional/<id>/ for an extra plugin, else app/plugins/<id>/."""
    extra = ROOT / 'app' / 'optional' / plugin_id
    return extra if extra.is_dir() else ROOT / 'app' / 'plugins' / plugin_id


# Plugins shipped apart from the app, as their own .traumplug on every merge to main
# (plugins.yml) and beside each Release (release.yml): every plugin in app/optional/.
APART = tuple(plugins('optional'))


def misplaced() -> list[str]:
    """Plugins in the wrong folder: one in app/plugins/ that isn't corpus, or a corpus plugin in
    app/optional/."""
    return ([f'app/plugins/{p}/ is not a corpus plugin: move it to app/optional/' for p in plugins('plugins') if p not in ROOM_TYPES + CORPUS]
            + [f'app/optional/{p}/ is a corpus plugin: it belongs in app/plugins/' for p in APART if p in ROOM_TYPES + CORPUS])

# Everything standalone.py leaves out of the product.
LEFT_OUT = CORPUS + APART
