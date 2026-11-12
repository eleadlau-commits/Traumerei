"""`python build.py pack-plugin <id> [--out DIR]`: packs app/plugins/<id>/ into one file,
`<id>.traumplug`, that a person can import in Settings → Plugins.

A package (format `traumplug/1`) is one JavaScript module with three exports:

    export const manifest = { format, id, name, description, version, requires, plugin };
    export const css = "…";                        // the plugin's styles, inlined
    export default (folio) => class extends folio.Feature { … };

The plugin's own files are bundled by esbuild into the factory; `import … from 'folio'` is not
bundled but read from the `folio` the app hands the factory, so the package has no bare imports
and loads from a blob URL. A sidecar declared in the plugin block (`plugin.sidecar`: program,
checksum, permissions) is passed through untouched; the app decides what to do with it.
"""

import json
import shutil
import tempfile
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FORMAT = 'traumplug/1'
ESBUILD = 'esbuild@0.24.0'
# What 'folio' offers a feature (folio/runtime/folio.js). The factory hands these over by name.
FOLIO_NAMES = ('App', 'Feature', 'ui', 'time', 'VERSION')


def manifest_of(folder: Path, plugin_id: str) -> dict:
    m = json.loads((folder / 'feature.json').read_text('utf-8'))
    if 'plugin' not in m:
        raise SystemExit(f'{plugin_id} has no "plugin" block in feature.json, so it is not a plugin.')
    if m.get('templates'):
        raise SystemExit(f'{plugin_id} uses "templates"; packages carry code and styles only.')
    return {
        'format': FORMAT, 'id': plugin_id, 'name': m.get('name', plugin_id),
        'description': m.get('description', ''), 'version': m.get('version', '0.1.0'),
        'requires': m.get('requires', []), 'plugin': m['plugin'],
    }


def bundle(folder: Path, main: str, work: Path) -> str:
    """The plugin's code as the body of a function that has `__folio__` in scope."""
    shim = work / 'folio-shim.js'
    shim.write_text(''.join(f'export const {n} = __folio__.{n};\n' for n in FOLIO_NAMES), 'utf-8')
    entry = work / 'entry.js'
    entry.write_text(f"export {{ default }} from {json.dumps((folder / main).as_posix())};\n", 'utf-8')
    out = subprocess.run(
        [shutil.which('npx') or 'npx', '--yes', ESBUILD, str(entry), '--bundle', '--format=iife',
         '--global-name=__plugin__', '--minify-whitespace', '--charset=utf8', f'--alias:folio={shim}'],
        cwd=ROOT, check=True, capture_output=True, text=True, encoding='utf-8')
    return out.stdout


def pack(plugin_id: str, out_dir: Path, root: Path = ROOT) -> Path:
    folder = root / 'app' / 'plugins' / plugin_id
    if not (folder / 'feature.json').is_file():
        raise SystemExit(f'No plugin app/plugins/{plugin_id}/.')
    m = manifest_of(folder, plugin_id)
    raw = json.loads((folder / 'feature.json').read_text('utf-8'))
    css = '\n'.join((folder / s).read_text('utf-8') for s in raw.get('styles', []))
    # Outside dist/: the compiler empties dist/ only when it made everything in it.
    work = Path(tempfile.mkdtemp(prefix=f'pack-{plugin_id}-'))
    try:
        code = bundle(folder, raw.get('main', 'index.js'), work)
    finally:
        shutil.rmtree(work, ignore_errors=True)
    text = (f'// Träumerei plugin package ({FORMAT}): {m["name"]} {m["version"]}. '
            f'Made by python build.py pack-plugin {plugin_id}; import it in Settings → Plugins.\n'
            f'export const manifest = {json.dumps(m, ensure_ascii=False)};\n'
            f'export const css = {json.dumps(css, ensure_ascii=False)};\n'
            f'export default (__folio__) => {{\n{code}return __plugin__.default;\n}};\n')
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f'{plugin_id}.traumplug'
    path.write_text(text, 'utf-8')
    return path


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith('--')]
    out = ROOT / 'packed'
    if '--out' in argv:
        i = argv.index('--out')
        if i + 1 >= len(argv):
            print('--out needs a folder')
            return 2
        out = Path(argv[i + 1]).resolve()
        args = [a for a in args if a != argv[i + 1]]
    if len(args) != 1:
        print('Usage: python build.py pack-plugin <id> [--out folder]   (default folder: packed/)')
        return 2
    path = pack(args[0], out)
    print(f'Wrote {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path} ({path.stat().st_size // 1024} KB)')
    return 0
