# Provoke

Shipped apart from the app (tools/corpus.py `APART`): `release.yml` packs it into
`provoke.traumplug` beside the installer on every Release, and people import it in Settings →
Plugins. The source stays here, so the tests and the conformance suite still run it.

A reader (kernel phase 9): reads the open room and suggests what you have not said yet: two
thoughts that speak of the same thing, or a handful that belong together, with a name. It
decides nothing.

- **A suggestion is a mark.** Kind `suggestion` (`says`, `act` link or group, `title`, `why`,
  `features`), in a room of its own called Provoke, linked to the thoughts it is about by
  `provokes` rows, with an open gap **to maker** (KERNEL.md, Law 5). The rooms it reads stay as
  you left them.
- **You judge it.** Keep makes what it proposes (a `resonates` link, or a group with the thoughts
  as parts) and resolves the gap by that link; Refuse resolves it by judgement. One step each,
  so Ctrl+Z takes it back. Nothing judged is suggested again.
- **It learns.** Each suggestion keeps the numbers it was scored on (`features`: bias, likeness,
  shared words, mutual, size, days apart); the verdicts in the gaps table train a logistic
  regression pulled toward a prior, so a few refusals bend it and many overrule it. The verdicts
  are rows of the tables, so they travel in the .traum file and a later local model can learn
  from them too.
- **How it reads** (`reader.js`, pure functions): TF-IDF over word stems plus hashed character
  trigrams; nearest neighbours through an inverted index (a 1,500-thought room in about a quarter
  of a second); groups by Louvain on the neighbour graph; names by class TF-IDF. Nothing leaves
  the browser, unless Settings → Provoke names an Ollama server and embedding model: then its
  embeddings are blended into the likeness (start Ollama with `OLLAMA_ORIGINS` set to the page).
- **Where:** the Provoke tab in the left dock (⋯ More → Provoke), Ctrl+Alt+V reads the open room,
  and an Editor section on a thought a suggestion is about.

- **Through the AI framework** (`app/core/AI.md`): Provoke asks for the `link` and `group` tasks
  (and `embed` when a real embedder is there) and is the home of suggestions and verdicts. Its
  reader is the first provider (`provider.js`, id `provoke-reader`, for `link`, `group`, `label`,
  `embed`), marked a fallback, so our own system or a local model comes first once it is there.
  Each suggestion keeps `task` and `by` (`<provider>@<version>`); Keep and Refuse go back to that
  provider (`t.ai.verdict`). A local model named in Settings → Provoke is added as an embed
  provider on its OpenAI-style address (`/v1/embeddings`).

It reaches the app only through the plugin API and only proposes: it never writes a table, and it
works with the rule kit (`t.parts`) taken away.

- **What it adds:** a kind `suggestion`, link kinds `provokes` and `resonates`, a command, a ⋯
  More entry, an Editor section, a Settings section.
- **What it needs:** the plugin API.
- **What it saves:** the local model's address, if one is set.
- **Check it:** `app/plugins/provoke/tests/reader.test.js` (the reader) and
  `app/core/api/tests/provoke.test.js` (phase 9's gate); it is in the conformance suite too.
