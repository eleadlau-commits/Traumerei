// Text that is one Markdown code block (``` or ~~~ around it, as Claude replies in) loses its
// fence; any other text stays as it is.
export function unfence(text) {
  const s = String(text ?? '').replace(/\r\n?/g, '\n');
  const m = /^\s*(`{3,}|~{3,})[^\n`]*\n([\s\S]*?)\n?[ \t]*\1[`~]*\s*$/.exec(s);
  return m ? m[2] + '\n' : s;
}
