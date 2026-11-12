# The Träumerei AI framework: the contract

This page is the single source of truth for AI in Träumerei. Anything that does AI work for the
app (a small model, a symbolic system, a future kind of AI, a person) fits it by doing **tasks**
as a **provider**. The contract is written in Träumerei's terms, never in today's AI's: no tokens,
prompts or weights appear in it. Code: `app/core/ai/` (the framework), `app/core/api/ai.js` (what a
plugin sees as `t.ai`), tests in `app/core/ai/tests/`.

It changes like the plugin API: **by additions only**. A new task, a new version of a task, a new
hint or a new service may be added; nothing listed here is renamed, changed or taken away.

## The hard rule

**The AI never changes the world directly.** A provider is handed the read half of the six tables
(`ctx.reads`, the `READS` list of `API.md`), never a propose. What it returns goes back to the
plugin that called, and anything that would change the world reaches the maker as a
**suggestion** they keep or refuse (see Suggestions and verdicts). A proposed gap is not open
until the maker keeps it.

## Three layers

| Layer | What it is | Where it plugs in |
|---|---|---|
| **Task** | A job in Träumerei's terms, with a versioned input and output schema. | Listed in `app/core/ai/tasks.js`; read with `t.ai.tasks()`, `t.ai.schema(task)`. |
| **Provider** | Does one or more tasks, and says how (hints). | `t.slots.providers.add(provider)` |
| **Engine** (optional) | A runtime that loads a model once for several providers (our own player, a bundled llama.cpp, Ollama, any OpenAI-style server). Engines speak the OpenAI-style API where one applies. | `t.slots.engines.add(engine)` |

Any plugin can **call** a task (`t.ai.call`): tasks are a shared service, not Provoke's. Search
may find by meaning, Russell may ask where a chapter sits, Provoke asks for links and groups.

## Tasks, version 1

Every task's input and output is an object. A mark, as a task sees it, is an **item**:
`{ id, text, at? }` (its id, its words as plain text, when it was made in ms). Every `score` is a
number from 0 to 1. `features` is an optional list of numbers a provider attaches to a result
for its own learning: it is stored on the suggestion and handed back with the verdict.

| Task | Input | Output |
|---|---|---|
| `embed` | `{ items }` | `{ vectors }` (binary layout below). Batched: callers' items are joined and the vectors split back. |
| `search` | `{ query, items, most? }` | `{ hits: [{ id, score }] }`, best first |
| `link` | `{ items, most? }` | `{ links: [{ from, to, score, why?, words?, features? }] }` |
| `group` | `{ items, most? }` | `{ groups: [{ marks (2+ ids), score, title?, why?, words?, features? }] }` |
| `label` | `{ items }` | `{ title, score }` |
| `judge` | `{ act ('link' \| 'group' \| 'label' \| 'gap'), items, says?, features? }` | `{ score, why? }`: how likely the maker is to keep it |
| `suggest` | `{ items, most? }` | `{ suggestions: [{ act, marks, says, score, title?, direction?, why?, features? }] }`: finished suggestions of any kind |
| `gap` | `{ items, most? }` | `{ gaps: [{ mark, direction ('to world' \| 'from world' \| 'to maker'), says, score, why?, features? }] }` |

The schemas themselves are data: `t.ai.schema(task)` gives `{ name, version, note, input, output }`
as JSON Schema (plain JSON), so a provider in any language reads the same thing. The framework
checks every input before it runs and every answer after; an answer that does not fit its schema
counts as a failure and the next provider is tried.

## How data moves (fixed)

- **Vectors** travel as `{ dim, data }`: `data` is one `Float32Array` of `n × dim` numbers, row by
  row in item order. In JSON Schema it is written `{ "x-binary": "float32" }`. Whenever the bytes
  leave memory (to a worker, over a local connection) they are little-endian float32, and a
  worker receives the buffer transferred, not copied. Never write into a vector you were handed:
  results are cached and shared.
- **Small data** is plain JSON. Every result is frozen.
- **Work runs in the background**: through the scheduler, never blocking a keystroke. A provider
  that does real work runs in a worker (see Bridges); results can stream (`ctx.part`).
- **Schemas are versioned**: a result carries the task's version and the provider's version.
- **Models load lazily**: `load()` is called the first time the budget gives a provider room,
  `unload()` when its room is needed.

## A provider

```js
t.slots.providers.add({
  id: 'my-reader', name: 'My reader', version: '1.2.0',
  tasks: ['embed', 'link'],
  hints: { where: 'local', runs: 'worker', speed: 'fast', memory: 300, gpu: 0 },
  engine: null,                   // or the id of an engine it shares
  available: () => true,          // optional: false (or a rejection) passes it over for now
  load: async () => {}, unload: async () => {}, // optional: lazy load, and giving its room back
  run: async (task, input, ctx) => ({ /* the task's output */ }),
  verdict: (v) => {},             // optional: hears Keep or Refuse on its results
});
```

`ctx` is frozen: `{ version (the task's), context (the room it reads, or null), signal (an
AbortSignal, or null), part(x) (stream a partial answer), reads (the read half of the tables),
verdicts() (the maker's verdicts for this task) }`.

**Hints** (all optional): `where` `local` | `remote` (anything that sends data off this machine
is `remote`); `runs` `main` | `worker` | `sidecar`; `speed` `fast` | `medium` | `slow`; `memory`
in MB and `gpu` a share from 0 to 1 (for the budget; an engine's own figures count instead when
the provider names one). New hints may be added.

**An engine**: `{ id, name, kind? ('openai' for an OpenAI-style server), memory?, gpu?, load?(), unload?() }`.
Providers that name it share one load and one place in the budget.

## Picking a provider, and falling back

Each task has one **default provider**, chosen in Settings → AI. Without a choice, the default is
**our own system**: the provider with id `default` (reserved for it; it is being designed in a
separate planning project). Until it exists, the next in line is used, which today is Provoke's
reader. A call tries, in order:

1. the provider chosen in Settings for this task,
2. `default`, our own system,
3. every other provider of the task: local before remote, then fast before slow, then in the order added.

A provider is **passed over**, and the next one tried, when it is not there, says it is not
`available`, is barred by the privacy policy or a missing permission, its engine is missing, the
budget has no room for it, it throws, or its answer does not fit the schema. The result names
who answered and lists who was passed over and why. Combining several providers' answers on one
task is for later (an addition).

## Calling a task

```js
const r = await t.ai.call('link', { items: t.marks.in(room).map((m) => t.ai.item(m.id)) }, { context: room, priority: 'idle' });
if (r.ok) r.output.links; // and r.provider = { id, version }, r.version, r.ms, r.cached, r.tried
else r.reason;            // in words; r.tried says what each provider said
```

Options: `context` (the room the input comes from: the privacy policy needs it, and a remote
provider never runs without it), `priority` (`now`, `soon` (default), `idle`), `signal` (an
AbortSignal: a call cancelled before it starts never runs), `part(x)` (hears streamed parts),
`only` (one provider id, no fallback), `fresh` (skip the cache).

| `t.ai` member | What it gives |
|---|---|
| `tasks()` | `[{ name, version, note }]` |
| `schema(task)` | the task's schemas as plain data, or `null` |
| `providers(task?)` | `[{ id, name, version, tasks, engine, hints }]`; for a task, in the order they are tried |
| `first(task, context?)` | the id of the provider a call would try first now, or `null` |
| `call(task, input, opts?)` | a Promise of the result (above) |
| `verdict(v)` | routes a verdict to the provider that made the result (`true` when it listened) |
| `verdicts(task?)` | the maker's verdicts, read from the tables (below), oldest first |
| `exam({ provider, task, cases? })` | the evaluation harness (below) |
| `item(id)` | a mark as a task item, `{ id, text, at? }`, or `null` |

Slots: `t.slots.providers`, `t.slots.engines`, `t.slots.aiServices`. Like every slot, what a
plugin adds goes when it is switched off.

## Suggestions and verdicts

Verdicts are stored **once, in the world's tables**, so they travel in the `.traum` file and any
provider can read them:

- a **suggestion** is a mark of kind `suggestion` (today in the room Provoke keeps for them) with
  fields `says`, `act` (`link`, `group`, `label`, `gap`), `task`, `by` (`<provider id>@<version>`),
  and optionally `title`, `why`, `features` (numbers joined by spaces);
- its subjects are its links of kind `provokes`, to the marks it is about;
- it carries a gap `to maker`. **Keep** makes what it proposes and resolves the gap by the link it
  made; **Refuse** resolves it by `judgement`. Both are moments Ctrl+Z takes back.

`t.ai.verdicts(task?)` reads them: `{ suggestion, task, act, provider, version, kept, says,
features, items, at }`. When the maker judges, the plugin that holds the suggestions calls
`t.ai.verdict({ provider, version, task, kept, features, suggestion })`, which reaches that
provider's `verdict(v)`.

## Shared services

| Service | Built-in default | Swappable |
|---|---|---|
| **Scheduler** | priority (`now`, `soon`, `idle`), two jobs at a time, cancel before start, batching for tasks that batch (`embed`) | yes |
| **Cache** | results by content hash of the input, plus task, provider and their versions; the 500 most recently used kept | yes |
| **Budget** | memory (MB, 2048 by default, Settings) and a GPU share per provider or engine; loaded models stay until room is needed, then the least recently used is unloaded; a provider that cannot fit is passed over | yes |
| **Privacy policy** | enforced before any remote provider runs (below) | no |
| **Feedback** | `verdict(v)` routing; verdicts stored in the tables | no |
| **Evaluation harness** | `exam` (below) | no |

A replacement: `t.slots.aiServices.add({ id, replaces: 'scheduler' | 'cache' | 'budget', make(defaults) })`.
`make` is handed the built-in ones (so a replacement can wrap them) and returns an object of the
same shape: a cache `{ get(key), set(key, value) }`, a scheduler `{ run(job) → Promise }` (job
`{ provider, task, priority, signal, input, go(input) → Promise }`), a budget
`{ acquire(holder) → Promise<{ ok, release() } | { ok: false, reason }> }`. The last one added wins.

## Privacy policy

- **Cloud providers are off by default.** A provider with `where: 'remote'` runs only once the
  person turns cloud providers on in Settings → AI.
- **Per room**, a room can keep everything on this machine: no remote provider runs on input from
  it, whatever the cloud switch says. A remote provider never runs for a call that does not name
  its room (`context`).
- A **sidecar** (`runs: 'sidecar'`) runs only in the desktop app, and only once the person has
  allowed that provider in Settings → AI.

## Evaluation harness

`t.ai.exam({ provider, task, cases })` scores a provider on an exam: `cases` is
`[{ input, mark(output) → 0..1 }]`. For `judge`, without cases, the exam is the maker's own
verdicts: a provider scores 1 on a case when its score falls on the side of the verdict (0.5 the
line). Each call is held to the task's **speed budget** (`BUDGETS` in `tasks.js`: a fixed start
plus a time per item, translation at the provider's edge included). The result is
`{ provider, task, cases, score, ms: { mean, max }, over, failed, passed }`; a provider over budget
fails, however well it scores. `compare` (in `exam.js`) runs two providers on one exam, so a new
system can prove itself against the old one. The CI speed budgets (`tests/speed.mjs`) stay as
they are; providers' exams are tests in their own feature.

## Bridges: a provider in any language

Three standard ways in. A provider with its own internal format translates at its own edge; the
harness counts that time in the task's budget.

- **JS**: a plugin that adds a provider (above).
- **WebAssembly**: Rust, C++, Go and others, run sandboxed in a worker.
- **Sidecar process**: desktop only, a separate program talking over a local connection, with the
  person's permission.

The desktop shell (Tauri) is where engines and sidecars run; the web copy gets JS and WebAssembly
providers only.

## Settings → AI

Lists the tasks, the provider chosen for each and the ones it falls back to, the cloud switch,
the rooms that keep everything on this machine, the sidecars allowed to run, and the memory
budget. These choices are the person's: they are kept by the `ai` feature and never handed to
plugins.

## Out of scope here

The default system itself (models, player, trainer, judge) is planned in its own project, which
builds against this page. Its provider's id is `default`.
