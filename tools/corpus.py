"""The stress corpus (docs/CORPUS.md): plugins written to test the plugin API, not for people.
They stay in app/plugins/ so `python build.py test` runs them through the conformance suite, but
standalone.py leaves them out of the product (the web copy and the Windows app). Anyone who wants
one packs it (`python build.py pack-plugin <id>`) and imports it in Settings → Plugins."""

CORPUS = (
    'kanban', 'calendar', 'outline', 'grid', 'timeline', 'random',
    'checkbox', 'quote', 'code-block', 'audio-note', 'pdf-page', 'table',
    'cites', 'contradicts', 'example-of', 'translates', 'duplicates', 'links',
    'word-count', 'oldest-gap', 'link-graph', 'print-view', 'room-outline',
    'markdown-vault', 'csv-marks', 'json-tables', 'anki-deck', 'plain-text',
    'word-linker', 'due-finder', 'nonsense-reader',
    'focus-mode', 'room-stats', 'export-room',
)

# Plugins shipped apart from the app, as their own .traumplug beside each Release (release.yml),
# for people to import: the source stays here for the tests, the product leaves them out.
APART = ('provoke',)

# Everything standalone.py leaves out of the product.
LEFT_OUT = CORPUS + APART
