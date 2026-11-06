# Träumerei: how to build here

Read `README.md` for building, testing and publishing, and the README of the feature you are
changing. Never commit `standalone/traumerei.html`: an Action rebuilds it after each merge.

## The splitting rule

Build Träumerei so each piece can be changed by reading only that piece.

- **One owner.** New work lives in the one feature (`app/features/<id>/`) that owns it, or in a
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
features use its `world` service (`app/features/world/README.md`).
