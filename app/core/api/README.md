# Plugin API

The `traumerei` service: the one small, versioned list through which a plugin reaches the app.
What version 2 holds is written in [`app/core/API.md`](../API.md); `v2.js` is that list in code
(the six kernel tables of [`app/core/KERNEL.md`](../KERNEL.md), over `v1.js`, the compatibility
surface that goes in kernel phase 6), and `tests/api.test.js` checks the three agree, so a change
to the API is always deliberate.

A plugin connects once, in its `start()`, and keeps what it gets:

```js
const t = this.use('traumerei')?.connect(this);
```

Each plugin gets its own copy, so what it adds through `t.modes`, `t.keys` or `t.more` is its own
and is taken away when it is switched off. A plugin written for a newer API than the app offers
can't connect (`connect` throws, and Folio switches the plugin off with the reason).

**The code.** `Api.js` offers the service. `v2.js` is the list: `kernel({ lib, world, events })`
(the six tables as frozen rows read off the world, proposals that land as one undo step or refuse
with a reason in words, and `on(fn)` per table) and `connect()`, which lays the tables over v1's
`connect()`. `v1.js` holds `surface(lib)` (the world's rules and the shared parts, chosen by name
from the world service's `lib`, which a plugin's tests call too) and v1's `connect()` (the world
itself, saving, the plugin's own data and the places to plug in). No saved data.
