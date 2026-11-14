# Default AI

Träumerei's own AI system: the provider with id **`default`**, which the AI framework
(`app/core/AI.md`) tries first on every task it does. Shipped apart from the app (tools/corpus.py
`APART`), like Provoke: `python build.py pack-plugin default` writes `packed/default.traumplug`,
and people import it in Settings → Plugins. Step 1 does **`embed`**; every other task falls back
to the next provider (today Provoke's reader).

## What it adds, needs and keeps

- **Adds** one provider (`provider.js`), id `default`. The plugin is called `default` too, because
  `t.ai.sidecar.provider` names its provider after the plugin (app/core/ai/sidecar.js).
- **Needs** `ai`, `store` (its models), `sidecar` (its engine), `network` (downloads only).
  Desktop app 1.0.1 or later. On the web copy it is listed but never available.
- **Keeps** nothing in the `.traum` file. Its store folder
  (`%APPDATA%\app.traumerei.desktop\plugins\default\`) holds the engine program, the model files,
  `engine.json` and the saved vectors (`vectors-<model>.bin`, made from your thoughts; it stays on
  this computer).

## How it answers

1. The first call asks the person once to allow the engine (`traumerei-engine-<version>.exe`,
   about 22 MB), which the app downloads and starts on a free 127.0.0.1 port (the plugin block's
   `sidecar`).
2. Then the model files its machine tier uses (`models.js`, `PICK`) download into the store, each
   asked with its size: all-MiniLM-L6-v2 int8, 23 MB, and its tokenizer.
3. `engine.json` is written to name them; the engine checks each file's sha256 before loading.
4. Calls go over the framework's HTTP bridge (`POST /traumerei/ai/v1/embed`).

Every tier uses the same embedder (it is light enough without a GPU); the tier sets how many
copies run side by side (`WORKERS`: 2 on `every-pc`, 4 on `mid` and `gpu`).

## The engine (`engine/`)

`traumerei-engine`, Rust, ONNX Runtime (MIT) linked in, tokenizers (Apache-2.0). One program, no
window, 127.0.0.1 only, and only a page of the app (or a caller that isn't a page) may call it.

```
traumerei-engine --port <port> --store <folder> [--threads N] [--idle S] [--remember N]
GET  /traumerei/ai/v1/health   → { ok, engine, version, tasks, kept }
POST /traumerei/ai/v1/embed    { version, input: { items } } → { output: { vectors } }
```

It loads the model on the first embed and exits by itself after 30 minutes with no call. It
keeps up to 100,000 vectors, in memory and in `vectors-<model>.bin` in the store (filed under each
text's sha256; the texts are not kept), so a room read again costs only its new thoughts: a
1,500-thought room seen before, plus 30 new thoughts, answers in about 80 ms. The plugin warms the
open room in the background (`Default.js`) once the engine is allowed, so that is the usual case;
only a room never read before pays the full cost (about 2 ms a thought on a 4-core CPU).
Build: `cargo build --release` (downloads ONNX Runtime). Without that download:
`cargo build --release --no-default-features --features dylib` and run with `ORT_DYLIB_PATH` set
to a `libonnxruntime`.

### engine.json (format `traumerei-engine/1`)

Owned by this plugin (`models.js` `engineConfig`), read by the engine:

```json
{ "format": "traumerei-engine/1",
  "embed": { "name": "minilm-l6-v2-int8", "model": "minilm-l6-v2-int8.onnx", "model_sha256": "<64 hex>",
             "tokenizer": "minilm-l6-v2.tokenizer.json", "tokenizer_sha256": "<64 hex>",
             "pooling": "mean", "max_tokens": 128, "workers": 4 } }
```

File names are plain names in the store folder. `pooling` is `mean` or `cls`; `prefix` (optional)
goes before every text.

## Checks

- `python build.py test` runs `tests/provider.test.js` (fakes for the sidecar and store; the
  model table must pin revisions, sizes and checksums; engine.json's shape).
- `.github/workflows/engine.yml`, on every pull request touching this folder: engine tests,
  Windows and Linux builds, the models downloaded and checked (`tests/fetch-models.mjs`), and
  the exam (`tests/exam.mjs`): the framework's `compare` against `provoke-reader` on quality
  (same-topic neighbours on the 60-thought general exam, `tests/cases.js`), cold speed (1, 300
  and 1,500 thoughts never seen) and reread speed (a seen 1,500-thought room plus 30 new), in the
  interactive and background budgets. The Windows program is attached
  as `traumerei-engine-windows` with its size and sha256.
- By hand: import `default.traumplug` in the desktop app on a PC without a GPU, allow the
  engine, allow the two downloads, then read a room with Provoke (Ctrl+Alt+V): Settings → AI
  shows `default` answering embed.
