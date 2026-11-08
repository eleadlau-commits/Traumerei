# Plugin API

The `traumerei` service: the one small, versioned list through which a plugin reaches the app.
What version 2 holds is written in [`app/core/API.md`](../API.md); `v2.js` is that list in code
(the six kernel tables of [`app/core/KERNEL.md`](../KERNEL.md)), and `tests/api.test.js` checks the three agree, so a change
to the API is always deliberate.

A plugin connects once, in its `start()`, and keeps what it gets:

```js
const t = this.use('traumerei')?.connect(this);
```

Each plugin gets its own copy, so what it adds through `t.slots` is its own
and is taken away when it is switched off. A plugin written for another API than the app offers
can't connect (`connect` throws, and Folio switches the plugin off with the reason).

**The code.** `Api.js` offers the service. `v2.js` is the list: `kernel({ lib, world, events })`
(the six tables, rules and carriers: frozen rows read off the world, proposals that land as one
undo step or refuse with a reason in words, and `on(fn)` per table), `surface(lib)` (the parts:
the world's rules and the drawing parts, chosen by name from the world service's `lib`, which a
plugin's tests call too) and `connect()`, which adds the slots, `ui` and `parts` for one plugin.
Version 1 (`v1.js`, the flat names) went in kernel phase 6. No saved data.
