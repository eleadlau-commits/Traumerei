// Audio note: a kind of thought that is a recording, picked as a file (or dropped on the room),
// with a line of words to find it by.
// A corpus plugin (kernel phase 8): written against app/core/API.md alone. Saves nothing else:
// the sound is kept in the mark itself, as a data URL.
import { Feature } from 'folio';

const asUrl = (file) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(r.error); r.readAsDataURL(file); });
export const KIND = {
  kind: 'audio-note', name: 'Audio note',
  tidy: (f, h) => (typeof f.src === 'string' && f.src.startsWith('data:audio/') ? { src: f.src, text: h.oneLine(f.text) } : null),
  text: (th) => th.text || 'Audio note',
  node: (th, el) => el('div', { class: 'audio-kind' }, el('audio', { controls: true, src: th.src, preload: 'none' }), th.text ? el('div', {}, th.text) : null),
  fields: [{ key: 'text', type: 'line', label: 'Words' }],
  add: { note: 'A recording', file: 'audio/*' },
  takes: (file) => /^audio\//.test(file?.type || ''),
  fromFile: async (file) => ({ src: await asUrl(file), text: file.name.replace(/\.[^.]+$/, '') }),
};

export function install(t) { t.slots.kinds.add(KIND); }

export default class AudioNote extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
