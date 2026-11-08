// Part of the pages feature: the Settings page's sections, read from Folio. Each is
// { id, title, icon (a ui.ICONS name), body (nodes) }: the 'settings' slot's sections in their
// order (a section that draws nothing is left out), then Folio's Features and About.

const ICONS = { // the rail's icon for each section, by its id; anything else gets ⋯
  'renderer-colour': 'palette',
  'renderer-theme': 'note',
  'home-typeface': 'book',
  'room-look': 'home',
  'floors-size': 'floor',
  'time-history': 'clock',
  'renderer-advanced': 'gear',
};

export function settingsSections(slot, folio) {
  const out = [];
  for (const s of slot.items) {
    let body = null;
    try { body = s.render(); } catch (err) { console.warn(`Settings: ${s.id}`, err); }
    if (body) out.push({ id: s.id, title: s.title || 'Settings', icon: ICONS[s.id] || 'dots', body });
  }
  if (folio?.featuresSection) out.push({ id: 'folio-features', title: 'Features', icon: 'dots', body: folio.featuresSection() });
  if (folio?.aboutParts) out.push({ id: 'folio-about', title: 'About', icon: 'info', body: folio.aboutParts().filter(Boolean) });
  return out;
}
