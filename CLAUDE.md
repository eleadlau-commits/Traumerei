# Träumerei: how to build here

Read `README.md` for building, testing and publishing, and the README of the feature you are
changing. Never commit `standalone/traumerei.html`: an Action rebuilds it after each merge.

## Core and plugins

**New work is a plugin.** Start it with `python build.py new-plugin <id>` and follow
`app/plugins/README.md` (Make a plugin). Change core only for what every room needs, or to give
the plugin API something plugins lack.

Features live in two folders (app.json's `folders`). `app/core/` holds what every room needs
(world, rooms, floors, room, frame, docks, keys, pages). `app/plugins/` holds everything that can be
switched off without breaking the app; each plugin's `feature.json` has a `plugin` block (the plugin
API version it was written for, the oldest app version it works with, what it adds, when it
loads). See `folio/README.md` §3. A plugin reaches the app only through the `traumerei` service,
the plugin API (`app/core/API.md`); the compiler leaves out a plugin that reaches past it. Keep
app.json's `plugins.exempt` empty: when a plugin needs something the API lacks, add it to the API
(v2.js, API.md and its test together).

AI work goes through the AI framework: its contract is `app/core/AI.md` (tasks, providers,
engines; the AI never changes the world, every result is a suggestion the maker keeps or refuses).

## The kernel

The app is being rebuilt on six tables and eight laws (`app/core/KERNEL.md`): marks, places,
links, distance, gaps, moments. The API's namespaces are named after them; new plugin code uses
the tables (`t.marks`, `t.places`, …); the rule kit in `t.parts` is for a rule's own gestures and
views. Version 1's flat names went in phase 6. The `.traum` file is the tables (Law 8): what a
plugin keeps outside them is not saved.
Judge a feature by what it composes from the six primitives; one that needs a seventh is a red flag.

## The splitting rule

Build Träumerei so each piece can be changed by reading only that piece.

- **One owner.** New work lives in the one feature (`app/core/<id>/` or `app/plugins/<id>/`) that owns it, or in a
  new feature of its own when it is a separate thing. Each feature has its own folder,
  `feature.json`, README, styles and saved data.
- **Talk only through Folio.** Features reach each other only through services, slots and
  events (see `folio/README.md`), never another feature's files, fields or state. Each service
  has a short written list of what it offers, in its feature's README; that list is all another
  feature may use. Don't add to shared state bags or mix new parts onto one class.
- **One look, in Folio.** The whole look (colours, type, words as buttons, panels, the veil,
  hairlines) lives once, in `folio/runtime/base.css`; see its class list in `folio/README.md`.
  Features use those classes and names and keep only their layout in their own CSS file(s). Never
  copy a piece of the look into a feature: change it in `base.css`, or add a shared class there.
- **Say where a change lives.** Every plan names the feature a change lives in and the services
  it uses, and flags any change that crosses a feature boundary before building it.

The world (saved rooms and thoughts, their rules, saving and undo) is the `world` feature: other
features use its `world` service (`app/core/world/README.md`).
