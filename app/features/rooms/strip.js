// Part of the rooms feature: the floors as one tall strip, Floor 1 at the top. The canvas shows one
// floor at a time and slides only to whole floors (about 0.4 s, or a jump with reduced motion), so
// it never rests between two. One wheel or trackpad gesture asks for one floor up or down.
// It knows nothing of rooms: it is handed one node per floor, and says when a floor is asked for.
//
// new Strip({ onFloor(page) }): onFloor is called when a wheel gesture asks for another floor.
// .el: the canvas to put in the page. show(floors, page, { slide }): the floors (a node or a list
// of nodes each, in order, each floor laid in a .rooms-floor), showing `page`; slide: from the
// floor that showed. slideTo(page): only slides (the floors stay as they are). floor(i): floor i's
// .rooms-floor. sliding: a slide is on.

const SLIDE = 400;                     // ms
const EASE = 'cubic-bezier(.65, 0, .25, 1)';
const QUIET = 220;                     // ms of no wheel events that ends a gesture
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export class Strip {
  constructor({ onFloor = () => {} } = {}) {
    this.onFloor = onFloor;
    this.page = 0;
    this.count = 0;
    this.track = document.createElement('div');
    this.track.className = 'rooms-strip';
    this.el = document.createElement('div');
    this.el.className = 'rooms-grid-wrap rooms-strip-view';
    this.el.append(this.track);
    this.el.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
  }

  get height() { return this.el.clientHeight; }
  get sliding() { return !!this.anim; }
  floor(i) { return this.track.children[i] || null; }

  show(floors, page, { slide = false } = {}) {
    const from = this.page;
    this.track.replaceChildren(...floors.map((node) => {
      const box = document.createElement('div');
      box.className = 'rooms-floor';
      box.append(...[].concat(node));
      return box;
    }));
    this.count = floors.length;
    if (slide && from !== page && from < this.count) this.slideTo(page, from);
    else if (this.anim && page === this.page) return; // a redraw during a slide lets it finish
    else { this.stop(); this.page = page; this.place(page); }
  }

  // Slides to floor `page` (from the one at rest, or `from`).
  slideTo(page, from = this.page) {
    page = Math.max(0, Math.min(this.count - 1, page));
    this.stop();
    this.page = page;
    if (from === page || reduced() || !this.track.animate) { this.place(page); return; }
    const H = this.height;
    this.place(page);
    this.anim = this.track.animate([{ transform: `translateY(${-from * H}px)` }, { transform: `translateY(${-page * H}px)` }], { duration: SLIDE, easing: EASE });
    const done = () => { this.anim = null; };
    this.anim.finished.then(done, done);
  }

  stop() { this.anim?.cancel(); this.anim = null; }
  place(page) { this.track.style.transform = `translateY(${-page * this.height}px)`; }

  // One gesture, one floor: the first wheel event past a small push asks for the next floor, and
  // the rest of that gesture (a trackpad's long tail) is let go until it goes quiet. A floor that
  // scrolls itself (cells at their smallest) scrolls first. Ctrl+wheel (zoom) is left alone.
  wheel(e) {
    if (e.ctrlKey) return;
    const box = this.track.children[this.page];
    const d = e.deltaY;
    if (box && box.scrollHeight > box.clientHeight + 1) {
      const atTop = box.scrollTop <= 0, atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 1;
      if ((d < 0 && !atTop) || (d > 0 && !atEnd)) return;
    }
    e.preventDefault();
    clearTimeout(this.quiet);
    this.quiet = setTimeout(() => { this.gesture = false; }, QUIET);
    if (this.gesture || this.anim || Math.abs(d) < 4) return;
    this.gesture = true;
    const next = this.page + Math.sign(d);
    if (next >= 0 && next < this.count) this.onFloor(next);
  }
}
