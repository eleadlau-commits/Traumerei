// The floor rule, with no screen: every floor of the rooms page is one fixed board (`board`:
// { cols, rows }, from a preset), and a room placed for you goes on its own floor if there is a
// free spot of its size, or else on a new floor at the end. Other floors are not searched.

import { room, roomsOn, cells, roomAt, addPage, pageCount, MESSY } from './world.js';

// The sizes a floor can be, one for every floor. Medium is the default.
export const PRESETS = [
  { id: 'small', name: 'Small', cols: 6, rows: 4 },
  { id: 'medium', name: 'Medium', cols: 8, rows: 5 },
  { id: 'large', name: 'Large', cols: 10, rows: 6 },
];
export const DEFAULT = 'medium';
export const preset = (id) => PRESETS.find((p) => p.id === id) || PRESETS.find((p) => p.id === DEFAULT);
export const sizeName = (board) => `${board.cols} × ${board.rows}`;

const setPage = (r, page) => { if (page > 0) r.page = page; else delete r.page; };
const inside = (r, col, row, board) => col >= 0 && row >= 0 && col + (r.size || 1) <= board.cols && row + (r.size || 1) <= board.rows;

// Whether room `r` could sit at (col, row) of floor `page` (its own by default): on the board and
// clear of every other room there.
export function free(w, r, col, row, board, page = r.page || 0) {
  return inside(r, col, row, board) && cells({ ...r, col, row }).every(([c, rr]) => !roomAt(w, c, rr, r.id, page));
}

// The first free spot for room `r` on floor `page` (left to right, top to bottom), or null.
export function spot(w, r, page, board) {
  for (let row = 0; row < board.rows; row++) for (let col = 0; col < board.cols; col++) {
    if (free(w, r, col, row, board, page)) return { col, row };
  }
  return null;
}

// Places room `id` for you: in `cell` if it is free, else the first free spot on its own floor,
// else a new floor at the end. Returns { page, from, spilled } (from: the floor it was meant for),
// or null when it can't be placed (no such room, or archived).
export function place(w, id, board, cell = null) {
  const r = room(w, id);
  if (!r || r.archived) return null;
  const from = r.page || 0;
  delete r.col; delete r.row; // so its old cell doesn't hold its own place
  let at = cell && free(w, r, cell.col, cell.row, board, from) ? cell : spot(w, r, from, board);
  let page = from;
  if (!at) {
    page = addPage(w);
    setPage(r, page);
    at = spot(w, r, page, board) || { col: 0, row: 0 };
  }
  r.col = at.col;
  r.row = at.row;
  return { page, from, spilled: page !== from };
}

// Gives every room on floor `page` that has no cell, sits outside the board or overlaps another a
// place (Messy thoughts first, then the rest in order). Returns the rooms that went to new floors,
// as place() describes them ({ room, page, from }).
export function settle(w, page, board) {
  const all = roomsOn(w, page).sort((a, b) => (b.id === MESSY) - (a.id === MESSY));
  const taken = new Set();
  const loose = [];
  for (const r of all) {
    const ok = r.col != null && inside(r, r.col, r.row, board) && cells(r).every(([c, rr]) => !taken.has(`${c},${rr}`));
    if (!ok) { loose.push(r); delete r.col; delete r.row; continue; }
    for (const [c, rr] of cells(r)) taken.add(`${c},${rr}`);
  }
  const spilled = [];
  for (const r of loose) {
    const out = place(w, r.id, board);
    if (out?.spilled) spilled.push({ room: r, ...out });
  }
  return spilled;
}

// Moves room `id` to (col, row) of its floor, if that is on the board and free (not a locked or
// archived room). Returns whether it moved.
export function move(w, id, col, row, board) {
  const r = room(w, id);
  if (!r || r.locked || r.archived || !free(w, r, col, row, board)) return false;
  r.col = col;
  r.row = row;
  return true;
}

// A room's size (1 or 2 cells a side), if the cells it would take are on the board and free.
export function resize(w, id, size, board) {
  const r = room(w, id);
  if (!r || r.locked) return false;
  const was = r.size || 1;
  r.size = size === 2 ? 2 : 1;
  if (r.col == null || free(w, r, r.col, r.row, board)) return true;
  r.size = was;
  return false;
}

// Moves room `id` to floor `page`, at the first free spot there (not Messy thoughts, nor a locked
// or archived room). Returns true, false when it can't go, or 'full' when that floor has no spot
// of its size.
export function toFloor(w, id, page, board) {
  const r = room(w, id);
  if (!r || id === MESSY || r.locked || r.archived || (r.page || 0) === page) return false;
  const at = spot(w, r, page, board);
  if (!at) return 'full';
  setPage(r, page);
  r.col = at.col;
  r.row = at.row;
  return true;
}

// The floors with a room outside `board` (none: every room fits a floor that size), counted from 0.
export function outside(w, board) {
  const out = [];
  for (let page = 0; page < pageCount(w); page++) {
    if (roomsOn(w, page).some((r) => r.col != null && !inside(r, r.col, r.row, board))) out.push(page);
  }
  return out;
}
