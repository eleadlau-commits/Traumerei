#!/usr/bin/env python3
"""Makes standalone/mask-renderer.html: the whole page in one file that opens with a double-click
(from file://, no server). Run `python standalone.py` after changing anything in app/.

It compiles the app with Folio (python build.py), then bundles the framework and the feature into
one inline script with esbuild (fetched by npx, so it needs Node.js). Folio loads features with
import(); here the feature is bundled in and handed to Folio through a tiny blob: module.
"""

import base64
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WEB = ROOT / 'dist' / 'web'
OUT = ROOT / 'standalone' / 'mask-renderer.html'


def main():
    subprocess.run([sys.executable, 'build.py'], cwd=ROOT, check=True)
    start = (WEB / 'start.js').read_text('utf-8')
    config = re.search(r'const config = (\{.*?\n\});', start, re.S).group(1)
    features = json.loads(re.search(r'const features = (\[.*?\n\]);', start, re.S).group(1))

    lines = ["import { App } from 'folio';"]
    for i, f in enumerate(features):
        lines.append(f"import F{i} from './{f['path']}';")
        lines.append(f"globalThis.__folioFeature{i} = F{i};")
        lines.append(f"const url{i} = URL.createObjectURL(new Blob(['export default globalThis.__folioFeature{i};'], {{ type: 'text/javascript' }}));")
    entries = ', '.join(f"{{ ...features[{i}], path: url{i} }}" for i in range(len(features)))
    lines += [f'const config = {config};',
              f'const features = {json.dumps(features)};',
              f'new App(config, [{entries}]).start();']
    entry = WEB / 'standalone-entry.js'
    entry.write_text('\n'.join(lines) + '\n', 'utf-8')

    bundle = subprocess.run(
        ['npx', '--yes', 'esbuild@0.24.0', str(entry), '--bundle', '--format=iife', '--charset=utf8',
         f'--alias:folio={WEB / "folio" / "folio.js"}'],
        cwd=ROOT, check=True, capture_output=True, text=True).stdout
    entry.unlink()

    html = (WEB / 'index.html').read_text('utf-8')
    icon = base64.b64encode((ROOT / 'app' / 'icons' / 'icon-192.png').read_bytes()).decode()
    css = (WEB / 'app.css').read_text('utf-8')
    html = re.sub(r'<link rel="manifest"[^>]*>\n', '', html)
    html = re.sub(r'<link rel="apple-touch-icon"[^>]*>\n', '', html)
    html = re.sub(r'<link rel="icon"[^>]*>', f'<link rel="icon" type="image/png" href="data:image/png;base64,{icon}">', html)
    html = html.replace('<link rel="stylesheet" href="app.css">', '<style>\n' + css.replace('</style', '<\\/style') + '\n</style>')
    html = re.sub(r'<script type="importmap">.*?</script>\n', '', html)
    html = html.replace('<script type="module" src="start.js"></script>\n', '')
    script = '<script>\n' + bundle.replace('</script', '<\\/script') + '</script>\n'
    html = html.replace('</body>', script + '</body>')
    OUT.parent.mkdir(exist_ok=True)
    note = "<!-- Made by standalone.py from app/. Don't edit: change app/ and run python standalone.py. -->\n"
    OUT.write_text(html.replace('<!doctype html>\n', '<!doctype html>\n' + note, 1), 'utf-8')
    print(f'Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    main()
