/** The knobs of one map type. The shared builder in layout.ts turns them into walls, rooms, doors and cover. */
export interface Recipe {
  id: string;
  name: string;
  width: number;
  height: number;
  enemies: number;
  /** Pickups lying on the map. */
  items: { r: number; p: number; g: number };
  /** Smallest wall-to-wall span of a room along each axis (the room inside is two tiles smaller). */
  minW: number;
  minH: number;
  /** A piece of the map this size or smaller (both axes) is not split further. */
  maxLeaf: number;
  /** Chance that a piece splittable both ways is cut left/right rather than top/bottom. */
  vertical: number;
  /** Chance that the wall between two pieces gets a 2 to 3 tile archway instead of a door. */
  arch: number;
  /** Single cover blocks per 100 open floor tiles. */
  cover: number;
  /** A big open area in the middle of the map, or null. */
  yard: { w: number; h: number } | null;
}

export const RECIPES: Recipe[] = [
  { id: 'outpost', name: 'Outpost', width: 30, height: 20, enemies: 4, items: { r: 1, p: 1, g: 2 },
    minW: 5, minH: 5, maxLeaf: 15, vertical: 0.5, arch: 0, cover: 0, yard: { w: 10, h: 6 } },
  { id: 'warehouse', name: 'Warehouse', width: 30, height: 20, enemies: 5, items: { r: 1, p: 1, g: 2 },
    minW: 4, minH: 7, maxLeaf: 12, vertical: 0.85, arch: 0.5, cover: 3, yard: null },
  { id: 'compound', name: 'Compound', width: 30, height: 20, enemies: 6, items: { r: 1, p: 1, g: 2 },
    minW: 6, minH: 5, maxLeaf: 12, vertical: 0.5, arch: 0.2, cover: 1, yard: { w: 12, h: 8 } },
  { id: 'bunker', name: 'Bunker', width: 32, height: 22, enemies: 6, items: { r: 1, p: 1, g: 3 },
    minW: 4, minH: 4, maxLeaf: 9, vertical: 0.5, arch: 0, cover: 0, yard: null },
  { id: 'village', name: 'Village', width: 36, height: 24, enemies: 7, items: { r: 1, p: 1, g: 3 },
    minW: 5, minH: 5, maxLeaf: 8, vertical: 0.5, arch: 0.6, cover: 1, yard: { w: 14, h: 8 } },
  { id: 'factory', name: 'Factory', width: 38, height: 26, enemies: 8, items: { r: 1, p: 1, g: 3 },
    minW: 7, minH: 6, maxLeaf: 18, vertical: 0.5, arch: 0.4, cover: 4, yard: null },
  { id: 'station', name: 'Station', width: 40, height: 26, enemies: 9, items: { r: 2, p: 1, g: 3 },
    minW: 6, minH: 5, maxLeaf: 12, vertical: 0.5, arch: 0.3, cover: 2, yard: { w: 14, h: 10 } },
  { id: 'mine', name: 'Mine', width: 42, height: 28, enemies: 10, items: { r: 2, p: 1, g: 3 },
    minW: 4, minH: 4, maxLeaf: 11, vertical: 0.5, arch: 0.7, cover: 3, yard: null },
  { id: 'fortress', name: 'Fortress', width: 46, height: 30, enemies: 11, items: { r: 2, p: 1, g: 3 },
    minW: 6, minH: 5, maxLeaf: 13, vertical: 0.5, arch: 0.2, cover: 2, yard: { w: 20, h: 12 } },
  { id: 'citadel', name: 'Citadel', width: 48, height: 32, enemies: 12, items: { r: 2, p: 1, g: 3 },
    minW: 5, minH: 5, maxLeaf: 12, vertical: 0.5, arch: 0.3, cover: 3, yard: { w: 16, h: 10 } },
];
