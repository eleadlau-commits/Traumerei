"""`python build.py new-plugin <id> [--starter | --corpus] […]`: Folio's new-plugin, with Träumerei's
rule on top (CLAUDE.md): only corpus plugins are built in.

Without --corpus the new plugin ships as a file: it lives in app/optional/extra/ (on its own), or
with --starter in app/optional/starter/ (also packed into starter-set.traumplug); standalone.py
leaves it out of the app (tools/corpus.py counts it among APART), and each merge to main and each
release carry it as <id>.traumplug. With --corpus it stays in app/plugins/ and joins
the stress corpus: it starts off, is listed in tools/corpus.py's CORPUS, and needs a line in
docs/CORPUS.md.
"""

import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def join_corpus(pid: str, root: Path = ROOT) -> None:
    corpus = root / 'tools' / 'corpus.py'
    text = corpus.read_text('utf-8')
    text, n = re.subn(r"(CORPUS = \(\n(?:.*\n)*?)(\))", lambda m: f"{m.group(1)}    '{pid}',\n{m.group(2)}", text, count=1)
    if not n:
        raise SystemExit('tools/corpus.py has no CORPUS list to add to.')
    corpus.write_text(text, 'utf-8')
    manifest = root / 'app' / 'plugins' / pid / 'feature.json'
    m = json.loads(manifest.read_text('utf-8'))
    m['plugin']['starts'] = 'off'
    manifest.write_text(json.dumps(m, indent=2, ensure_ascii=False) + '\n', 'utf-8')


def main(argv: list[str], folio_new_plugin) -> int:
    corpus, starter = '--corpus' in argv, '--starter' in argv
    if corpus and starter:
        print('--corpus and --starter: a plugin is one or the other.')
        return 2
    rest = [a for a in argv if a not in ('--corpus', '--starter')]
    code = folio_new_plugin(rest)
    if code or not rest or rest[0].startswith('-'):
        return code
    pid = rest[0]
    if corpus:
        join_corpus(pid)
        print(f'{pid} joins the stress corpus: it starts off and is left out of the app. '
              f'Add a line for `{pid}` to docs/CORPUS.md.')
    else:
        where = 'optional/starter' if starter else 'optional/extra'
        (ROOT / 'app' / where).mkdir(parents=True, exist_ok=True)
        shutil.move(str(ROOT / 'app' / 'plugins' / pid), str(ROOT / 'app' / where / pid))
        print(f'Made app/{where}/{pid}/. '
              f'{pid} ships as a file, not in the app: python build.py pack-plugin {pid} makes '
              f'{pid}.traumplug, every merge to main publishes it (plugins-latest) and every release carries it'
              + (', inside starter-set.traumplug too.' if starter else '; not in the starter set (--starter, or move it to app/optional/starter/).'))
    return 0
