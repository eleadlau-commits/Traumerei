"""Which plugins are built into the app, and which ship as files (E's rule, 15 Nov 2026).

Only corpus plugins are built in; they live in app/plugins/. Every other plugin ships as a file
and lives in app/optional/ (the optional plugins): `python build.py test` runs it through the
suites, standalone.py leaves it out of the product (the web copy and the Windows app), and each
merge to main (plugins.yml, the rolling "plugins-latest" release) and each release carry it as a
.traumplug (`python build.py pack-plugin --all`), imported in Settings → Plugins. The folder says
whether it is in the starter set (E, 16 Nov 2026):
- app/optional/starter/<id>/: also packed together into starter-set.traumplug.
- app/optional/extra/<id>/: only on its own (Book, Provoke).

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


STARTER, EXTRA = 'optional/starter', 'optional/extra'  # in app/: in the starter set, or only on its own
OPTIONAL = (STARTER, EXTRA)
FOLDERS = ('plugins',) + OPTIONAL  # app/plugins/: the corpus; app/optional/*/: the optional plugins


def plugins(*folders: str, root: Path = ROOT) -> list[str]:
    """Every plugin in app/plugins/ and app/optional/*/ (or in the folders named), by folder name."""
    return sorted(p.parent.name for f in (folders or FOLDERS) for p in (root / 'app' / f).glob('*/feature.json'))


def find(plugin_id: str, root: Path = ROOT) -> Path | None:
    """A plugin's folder (app/optional/starter/<id>/, app/optional/extra/<id>/ or app/plugins/<id>/),
    or None when there is no such plugin."""
    for f in OPTIONAL + ('plugins',):
        if (root / 'app' / f / plugin_id / 'feature.json').is_file():
            return root / 'app' / f / plugin_id
    return None


def folder_of(plugin_id: str) -> Path:
    """A plugin's folder: in app/optional/starter/ or app/optional/extra/, else app/plugins/<id>/."""
    return find(plugin_id) or ROOT / 'app' / 'plugins' / plugin_id


# Plugins shipped apart from the app, as their own .traumplug on every merge to main
# (plugins.yml) and beside each Release (release.yml): every plugin in app/optional/*/.
APART = tuple(plugins(*OPTIONAL))
# The ones also packed together into starter-set.traumplug: every plugin in app/optional/starter/.
IN_STARTER = tuple(plugins(STARTER))


def misplaced() -> list[str]:
    """Plugins in the wrong folder: one in app/plugins/ that isn't corpus, or a corpus plugin in
    app/optional/, or an optional plugin outside app/optional/starter/ and app/optional/extra/."""
    stray = sorted(p.parent.name for p in (ROOT / 'app' / 'optional').glob('*/feature.json'))
    return ([f'app/plugins/{p}/ is not a corpus plugin: move it to app/optional/starter/ or app/optional/extra/' for p in plugins('plugins') if p not in ROOM_TYPES + CORPUS]
            + [f'app/{f}/{p}/ is a corpus plugin: it belongs in app/plugins/' for f in OPTIONAL for p in plugins(f) if p in ROOM_TYPES + CORPUS]
            + [f'app/optional/{p}/ is in neither app/optional/starter/ nor app/optional/extra/: move it to one' for p in stray])

# Everything standalone.py leaves out of the product.
LEFT_OUT = CORPUS + APART
