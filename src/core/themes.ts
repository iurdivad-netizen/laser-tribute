export type ThemeId = 'base' | 'timber' | 'steel' | 'cave' | 'stone';

export const THEME_IDS: readonly ThemeId[] = ['base', 'timber', 'steel', 'cave', 'stone'];

/** Which look each map type has (the campaign's ten map types, and the tutorial's three missions by name). */
export const MAP_THEMES: Record<string, ThemeId> = {
  outpost: 'base', compound: 'base',
  warehouse: 'timber', village: 'timber',
  factory: 'steel', station: 'steel',
  mine: 'cave', bunker: 'cave',
  fortress: 'stone', citadel: 'stone',
};

/** The theme of a map type id; `base` for an unknown id (and for inherited keys such as `constructor`). */
export function themeOfMap(id: string): ThemeId {
  return Object.hasOwn(MAP_THEMES, id) ? MAP_THEMES[id] : 'base';
}
