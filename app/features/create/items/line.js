// A line: a passing thought, written until Enter. Ctrl+Enter puts a new line inside it.
export default {
  kind: 'line',
  name: 'Thought',
  tidy(f, h) {
    const text = h.lines(String(f.text ?? '').split('\n').map(h.oneLine).join('\n'));
    return text ? { text } : null;
  },
  text: (th) => th.text || '',
  node: (th, el) => el('span', { class: 'create-thought', 'data-id': th.id }, th.text),
};
