// How a thought's words wrap at a width, as the room draws them (t.ui.measure): the lines they
// take, the height of a line and of the whole, in world units. A rule lays out with it (a page that
// ends mid-paragraph), so it is a pure function of the words and the width: measured with the
// room's reading font on a hidden canvas, or estimated where there is no screen (the tests).

const LINE = 1.45; // the room's line height, in ems (room/style.css: .room-float)
let ctx = null, size = 0, font = '';

function setUp() {
  if (ctx || typeof document === 'undefined') return ctx;
  try {
    const css = getComputedStyle(document.documentElement);
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;font-size:var(--t-title);font-family:var(--font-read)';
    document.body.appendChild(probe);
    const st = getComputedStyle(probe);
    size = parseFloat(st.fontSize) || 20;
    font = `${st.fontSize} ${st.fontFamily || css.getPropertyValue('--font-read') || 'serif'}`;
    probe.remove();
    ctx = document.createElement('canvas').getContext('2d');
    if (ctx) ctx.font = font;
  } catch { ctx = null; }
  return ctx;
}

const widthOf = (s) => (setUp() ? ctx.measureText(s).width : s.length * 9.5);
const fontSize = () => (setUp() ? size : 20);

const memo = new Map();
export function measure(text, width) {
  const words = String(text ?? ''), w = Math.max(20, Number(width) || 260);
  const key = `${w}|${words}`;
  const had = memo.get(key);
  if (had) return had;
  let lines = 0;
  for (const para of words.split('\n')) {
    let line = '';
    lines++;
    for (const word of para.split(/(\s+)/)) {
      if (!word) continue;
      const next = line + word;
      if (line && !/^\s+$/.test(word) && widthOf(next.trimEnd()) > w) { lines++; line = word.trimStart(); }
      else line = next;
    }
  }
  const lineHeight = fontSize() * LINE;
  const out = Object.freeze({ lines, lineHeight, height: lines * lineHeight });
  if (memo.size > 5000) memo.clear();
  memo.set(key, out);
  return out;
}
