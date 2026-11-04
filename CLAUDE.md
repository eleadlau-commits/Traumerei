# Träumerei: how to build here

Read `README.md` for building, testing and publishing, and the README of the feature you are
changing. Never commit `standalone/mask-renderer.html`: an Action rebuilds it after each merge.

## The splitting rule

Build Träumerei so each piece can be changed by reading only that piece.

- **One owner.** New work lives in the one feature (`app/features/<id>/`) that owns it, or in a
  new feature of its own when it is a separate thing. Each feature has its own folder,
  `feature.json`, README, styles and saved data.
- **Talk only through Folio.** Features reach each other only through services, slots and
  events (see `folio/README.md`), never another feature's files, fields or state. Each service
  has a short written list of what it offers, in its feature's README; that list is all another
  feature may use. Don't add to shared state bags or mix new parts onto one class.
- **Own styles, no Folio look.** Each feature keeps its own CSS file(s). Folio is used for
  structure only, never for its look (`folio/runtime/base.css`'s classes and colours).
- **Say where a change lives.** Every plan names the feature a change lives in and the services
  it uses, and flags any change that crosses a feature boundary before building it.

The world (saved rooms and thoughts, their rules, saving and undo) is the `world` feature: other
features use its `world` service (`app/features/world/README.md`).
