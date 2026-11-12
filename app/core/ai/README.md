# AI

The AI framework. Its contract, the one page everything else builds against, is
[`app/core/AI.md`](../AI.md); this folder is the code behind it.

- `tasks.js`: the tasks, their versioned schemas as data, the schema checker and the speed budgets.
- `service.js`: picking a provider with fallback, the privacy policy, and the three swappable
  services (scheduler, cache, budget). Pure: the tests run it as it is.
- `exam.js`: the evaluation harness.
- `bridges.js`: ready-made providers for a Web Worker, a local connection and an OpenAI-style server.
- `settings.js`: Settings → AI.
- `Ai.js`: the feature. Defines the slots `ai.providers`, `ai.engines`, `ai.services`, keeps the
  person's choices, and offers the `ai` service.

## The `ai` service

For the plugin API (which hands plugins `t.ai`, `app/core/api/ai.js`) and Settings. Plugins never
use it directly.

| Member | What it is |
|---|---|
| `call(task, input, opts)` | runs a task (AI.md, Calling a task) |
| `list(task?)`, `order(task)`, `first(task, context?)`, `barred(id, context?)` | the providers, the order they're tried in, the first that may run, why one may not |
| `verdict(v)` | routes a verdict to its provider |
| `tasks()`, `schema(task)` | the task names, one task's schemas as data |
| `exam(o)`, `verdictCases(verdicts)` | the evaluation harness |
| `service(name)`, `defaults` | the scheduler, cache or budget in use; the built-in ones |
| `choices` | the person's choices: `chosen`/`choose(task, id)`, `cloud`/`setCloud`, `blocked`/`block(room, on)`, `allowed`/`allow(id, on)`, `memory`/`setMemory` |
| `slots` | the slot names |
| `bridges` | `worker(o)`, `http(o)`, `openai(o)` |

Saved data: `choice`, `cloud`, `blocked`, `allowed`, `memory`.
