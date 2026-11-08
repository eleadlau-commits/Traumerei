// Provoke: a reader (kernel phase 9). It reads the open room and suggests what the maker has not
// said yet: two thoughts that speak of the same thing (a link), or a handful that belong together
// (a group, with a name). It decides nothing. Every suggestion is a mark of its own, of kind
// `suggestion`, linked to the thoughts it is about by `provokes` rows and carrying an open gap to
// the maker (KERNEL.md, Law 5): the maker judges it. Keep makes what it proposes (a `resonates`
// link, or a group with the thoughts as parts) and resolves the gap by that link; Refuse resolves it
// by judgement. Both are moments, so Ctrl+Z takes them back, and both stay in the tables: the
// verdicts are what Provoke learns from (reader.js `learn`), and they travel in the .traum file.
// Nothing it once suggested is suggested again.
//
// Suggestions sit in a room of their own, "Provoke" (made the first time), so the rooms they are
// about stay as the maker left them. The left dock's Provoke tab lists those about the open room
// with Keep and Refuse; Ctrl+Alt+V reads the room.
//
// The reading is in reader.js: TF-IDF and character trigrams, nearest neighbours through an
// inverted index, Louvain communities, cluster names by class TF-IDF, and a logistic regression
// pulled toward a prior. Nothing leaves the browser, unless Settings → Provoke names a local model
// (an Ollama server): then its embeddings are blended into the likeness.
//
// A plugin: it reaches the app only through the plugin API (app/core/API.md), and only proposes;
// it never writes a table. Saved data: the local model's address, if one is set (`model`).

import { Feature, ui } from 'folio';
import { read, learn, PRIOR, FEATURES } from './reader.js';

const { el } = ui;
const KEY = 'provoke';
const DESK = 'Provoke';

export const KIND = {
  kind: 'suggestion', name: 'Suggestion',
  tidy: (f, h) => {
    const says = h.oneLine(f.says);
    if (!says) return null;
    const out = { says, act: f.act === 'group' ? 'group' : 'link' };
    if (f.title) out.title = h.oneLine(f.title);
    if (f.why) out.why = h.oneLine(f.why);
    if (f.features) out.features = h.oneLine(f.features);
    return out;
  },
  text: (th) => th.says || '',
  node: (th, el) => el('div', { class: 'provoke-kind' }, el('div', { class: 'label' }, 'Provoke suggests'), el('div', {}, th.says || ''), th.why ? el('div', { class: 'hint' }, th.why) : null),
};

const first = (text, most = 60) => { const s = String(text || '').split('\n')[0].trim(); return s.length > most ? `${s.slice(0, most - 1)}…` : s; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// The suggestions there are, each with what it is about: { id, act, subjects, gap, mark }.
export function suggestions(t) {
  return t.marks.ofKind('suggestion').map((s) => ({ id: s.id, mark: s, act: s.act, subjects: t.links.from(s.id, 'provokes').map((l) => l.to), gap: t.gaps.of(s.id) }));
}
const keyOf = (act, ids) => `${act}:${[...ids].sort().join(',')}`;
const isOpen = (s) => s.gap && s.gap.state === 'open';
const stale = (s) => s.subjects.length < (s.act === 'group' ? 3 : 2);

// What the maker said of past suggestions, as examples to learn from: kept (the gap was resolved
// by a link: what Keep made) or refused (by judgement).
export function verdicts(t) {
  const out = { link: [], group: [] };
  for (const s of suggestions(t)) {
    if (!s.gap || s.gap.state !== 'resolved' || !s.mark.features) continue;
    const x = s.mark.features.split(' ').map(Number);
    if (x.length !== FEATURES.length || x.some((v) => !Number.isFinite(v))) continue;
    (out[s.act] || out.link).push({ x, y: s.gap.resolvedBy && s.gap.resolvedBy !== 'judgement' ? 1 : 0 });
  }
  return out;
}
export const weights = (t) => { const v = verdicts(t); return { link: learn(v.link, PRIOR.link), group: learn(v.group, PRIOR.group), seen: v.link.length + v.group.length }; };

// The room the suggestions sit in: where the first one is at home, else a new one.
function desk(t) {
  for (const s of t.marks.ofKind('suggestion')) { const home = t.places.home(s.id); if (home && t.marks.get(home)) return home; }
  const r = t.marks.make({ kind: 'room', content: DESK });
  return r.ok ? r.id : null;
}

// Reads a room and lays down what it suggests, in one step. embed(texts) → vectors, optional.
// Returns { ok, made, reason? }.
export async function provoke(t, room, { embed = null, most = 6 } = {}) {
  if (!room || !t.marks.get(room)) return { ok: false, reason: 'Go into a room to read it' };
  if (t.distance.shut(room)) return { ok: false, reason: 'This room is locked' };
  const docs = t.marks.in(room).filter((m) => m.kind !== 'group' && m.kind !== 'suggestion' && m.kind !== 'room')
    .map((m) => ({ id: m.id, text: t.marks.text(m.id), at: m.at, grouped: t.links.holders(m.id).length > 0 })).filter((d) => d.text.trim());
  const all = suggestions(t);
  const said = new Set(all.map((s) => keyOf(s.act, s.subjects)));
  const linked = (a, b) => t.links.from(a).some((l) => l.to === b) || t.links.from(b).some((l) => l.to === a);
  const skip = (kind, ids) => said.has(keyOf(kind, ids)) || (kind === 'link' ? linked(ids[0], ids[1])
    : ids.every((id) => t.links.holders(id).some((g) => ids.every((o) => t.links.holders(o).includes(g)))));
  let dense = null;
  if (embed && docs.length) { try { dense = await embed(docs.map((d) => d.text)); } catch { dense = null; } }
  const w = weights(t);
  let found = read(docs, { weights: w, skip, most, dense });
  // A pair inside a suggested group is said by the group.
  const inGroup = new Set(found.filter((p) => p.kind === 'group').flatMap((p) => p.marks));
  found = found.filter((p) => p.kind === 'group' || !(inGroup.has(p.marks[0]) && inGroup.has(p.marks[1])));
  const gone = all.filter((s) => isOpen(s) && stale(s));
  if (!found.length && !gone.length) return { ok: true, made: 0 };
  const text = (id) => `“${first(t.marks.text(id), 40)}”`;
  return t.together(() => {
    for (const s of gone) t.marks.delete(s.id); // its thoughts went: nothing is left to judge
    if (!found.length) return { ok: true, made: 0 };
    const at = desk(t);
    if (!at) return { ok: false, reason: 'Provoke could not make its room' };
    let made = 0;
    for (const p of found) {
      const says = p.kind === 'link' ? `${text(p.marks[0])} and ${text(p.marks[1])} may speak of the same thing`
        : `${p.marks.length} thoughts may belong together: ${cap(p.title)}`;
      const why = p.words.length ? `They share ${p.words.join(', ')}` : '';
      const r = t.marks.make({ kind: 'suggestion', in: at, content: { says, act: p.kind, title: p.title ? cap(p.title) : '', why, features: p.x.map((v) => +v.toFixed(4)).join(' ') } });
      if (!r.ok) continue;
      for (const m of p.marks) t.links.link(r.id, m, 'provokes');
      t.gaps.open(r.id, 'to maker');
      made++;
    }
    return { ok: true, made };
  });
}

// Keeps a suggestion: makes what it proposes and resolves its gap by the link made. One step.
export function keep(t, id) {
  const s = suggestions(t).find((x) => x.id === id);
  if (!s) return { ok: false, reason: 'No such suggestion' };
  if (!isOpen(s)) return { ok: false, reason: 'This suggestion has been judged already' };
  if (stale(s)) return { ok: false, reason: 'The thoughts it was about are gone' };
  return t.together(() => {
    let by = null;
    if (s.act === 'link') {
      const r = t.links.link(s.subjects[0], s.subjects[1], 'resonates', null, { note: s.mark.why || '' });
      if (!r.ok) return r;
      by = r.id;
    } else {
      const g = t.marks.make({ kind: 'group', content: { title: s.mark.title || 'Together' }, in: t.places.home(s.subjects[0]) });
      if (!g.ok) return g;
      for (const m of s.subjects) { const r = t.links.link(m, g.id, 'part of'); if (r.ok && !by) by = r.id; }
      if (!by) return { ok: false, reason: 'None of the thoughts could join the group' };
    }
    const r = t.gaps.resolve(id, by);
    return r.ok ? { ok: true, id, by } : r;
  });
}

// Refuses a suggestion: its gap resolved by judgement; it stays, so it is not suggested again.
export const refuse = (t, id) => (suggestions(t).some((x) => x.id === id) ? t.gaps.resolve(id, 'judgement') : { ok: false, reason: 'No such suggestion' });

// The open suggestions about a room (any of their thoughts at home there), oldest first.
export const about = (t, room) => suggestions(t).filter((s) => isOpen(s) && !stale(s) && s.subjects.some((m) => t.places.home(m) === room))
  .sort((a, b) => a.gap.openedAt - b.gap.openedAt);

// A local model's embeddings (Ollama's /api/embed), remembered by text for the session.
export function ollama({ url, model }, fetcher = globalThis.fetch) {
  const seen = new Map();
  return async (texts) => {
    const need = texts.filter((x) => !seen.has(x));
    if (need.length) {
      const res = await fetcher(`${url.replace(/\/$/, '')}/api/embed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, input: need }) });
      if (!res.ok) throw new Error(`The local model answered ${res.status}`);
      const { embeddings } = await res.json();
      need.forEach((x, i) => seen.set(x, embeddings[i]));
    }
    return texts.map((x) => seen.get(x));
  };
}

export function install(t, { storage = null, feature = null } = {}) {
  const model = () => storage?.get('model', null) || null;
  const embed = () => { const m = model(); return m?.url && m?.model ? ollama(m) : null; };
  t.slots.kinds.add(KIND);
  t.slots.linkKinds.add({ kind: 'provokes', name: 'Provokes', note: 'a suggestion of Provoke\'s, to the thoughts it is about' });
  t.slots.linkKinds.add({ kind: 'resonates', name: 'Resonates', note: 'the two speak of the same thing (suggested by Provoke, kept by you)', both: true });
  const run = async () => {
    const room = t.ui.chosen()?.context;
    const r = await provoke(t, room, { embed: embed() });
    t.ui.toast(!r.ok ? r.reason : r.made ? `Provoke has ${r.made} suggestion${r.made > 1 ? 's' : ''}` : 'Provoke has nothing new to suggest');
    feature?.show();
    return r;
  };
  t.slots.commands.add({ id: 'provoke.read', keys: ['Ctrl+Alt+V'], zone: 'room', order: 73, words: 'Provoke: read this room and suggest links and groups',
    when: () => !!t.ui.chosen()?.context, run });
  t.slots.more.add({ id: 'provoke', label: 'Provoke', order: 31, icon: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>', run: () => feature?.toggle(), on: () => !!t.ui.docks?.left?.isShowing(KEY),
    title: () => 'Show or hide Provoke: suggestions to judge' });
  t.slots.editor.add({ id: 'provoke', order: 47, when: (x) => suggestions(t).some((s) => isOpen(s) && s.subjects.includes(x.id)),
    render: (x) => el('div', { class: 'provoke-section' }, el('div', { class: 'label' }, 'Provoke'),
      ...suggestions(t).filter((s) => isOpen(s) && s.subjects.includes(x.id)).map((s) => item(t, s, x.refresh))) });
  return { run, embed };
}

// One suggestion with its two words.
function item(t, s, after = () => {}) {
  const act = (r) => { if (!r.ok) t.ui.toast(r.reason); after(); };
  const word = (text, title, onclick) => el('button', { type: 'button', class: 'word', title, onclick }, text);
  return el('li', { class: 'provoke-item' },
    el('div', { class: 'provoke-says' }, s.mark.says),
    s.mark.why ? el('div', { class: 'provoke-why' }, s.mark.why) : null,
    el('div', { class: 'provoke-words' },
      word('Keep', s.act === 'link' ? 'Link the two as resonating' : 'Make the group', () => act(keep(t, s.id))),
      word('Refuse', 'Turn it down: it will not be suggested again', () => act(refuse(t, s.id)))));
}

export default class Provoke extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Needs the plugin API');
    this.t = t;
    this.hands = install(t, { storage: this.storage, feature: this });
    t.gaps.on(() => this.render());
    t.marks.on(() => this.render());
    this.on('room:open', () => setTimeout(() => this.render(), 0));
    this.add('settings', { id: 'provoke', title: 'Provoke', order: 80, render: () => this.settings() });
  }

  get dock() { return this.t.ui.docks?.left || null; }
  toggle() { if (this.dock?.isShowing(KEY)) this.dock.close(KEY, true); else this.show(); }

  async show() {
    if (!this.dock) return;
    if (!this.dock.isOpen(KEY)) {
      this.body = el('div', { class: 'provoke' });
      this.handle = await this.dock.open({ key: KEY, tab: 'Provoke', kind: '', title: '', label: 'Provoke', body: this.body,
        onClose: () => { this.handle = null; this.body = null; } });
      if (!this.handle) return;
    } else this.dock.show(KEY);
    this.render();
  }

  render() {
    if (!this.body) return;
    const t = this.t;
    const room = t.ui.chosen()?.context;
    const open = room ? about(t, room) : [];
    const w = weights(t);
    this.handle?.setTitle?.(open.length ? `${open.length} to judge` : 'Nothing to judge');
    const bits = [el('div', { class: 'provoke-words' },
      el('button', { type: 'button', class: 'word', disabled: room ? null : '', title: 'Read this room (Ctrl+Alt+V)', onclick: () => this.hands.run() }, 'Read this room'))];
    if (open.length) bits.push(el('ul', { class: 'provoke-list' }, ...open.map((s) => item(t, s, () => this.render()))));
    else bits.push(el('p', { class: 'hint' }, room ? 'Nothing to judge here. Read the room, and Provoke suggests thoughts that speak of the same thing and thoughts that belong together.' : 'Go into a room, and Provoke reads it.'));
    bits.push(el('p', { class: 'hint' }, w.seen ? `Learned from ${w.seen} verdict${w.seen > 1 ? 's' : ''}.` : 'It learns from what you keep and refuse.'));
    this.body.replaceChildren(...bits);
  }

  settings() {
    const m = this.storage.get('model', null) || {};
    const field = (key, placeholder) => {
      const input = el('input', { type: 'text', value: m[key] || '', placeholder, 'aria-label': placeholder });
      input.addEventListener('change', () => { const next = { ...(this.storage.get('model', null) || {}), [key]: input.value.trim() }; this.storage.set('model', next.url || next.model ? next : null); });
      return input;
    };
    return el('div', { class: 'provoke-settings' },
      el('p', { class: 'hint' }, 'Provoke reads in the browser. To blend in a local model\'s sense of meaning, name an Ollama server and an embedding model (start Ollama with OLLAMA_ORIGINS set to this page\'s address). Leave empty to read without one.'),
      field('url', 'http://localhost:11434'), field('model', 'nomic-embed-text'));
  }
}
