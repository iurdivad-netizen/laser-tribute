import type { GameState, ItemKind, Side, TileKind } from '../core/types';
import type { Figure } from './figure';
import { imageOf, type ImageName } from './image';
import { floorVariant } from './sprite';

export type ThemeId = 'base';

export interface Theme {
  floors: readonly [ImageName, ImageName, ImageName];
  wall: ImageName;
  doorClosed: ImageName;
  doorOpen: ImageName;
}

/** The look of a map's tiles. One theme today; a map type can name another one later. */
export const THEMES: Record<ThemeId, Theme> = {
  base: { floors: ['floor_a', 'floor_b', 'floor_c'], wall: 'wall', doorClosed: 'door_closed', doorOpen: 'door_open' },
};

/** The theme of the mission being drawn: the single place that will read a field on the map later. */
export function themeFor(_state: GameState): ThemeId {
  return 'base';
}

/** The image of a tile. `open` is whether the player last saw the door open; it only matters for doors. */
export function tileImage(theme: string, kind: TileKind, open: boolean, x: number, y: number): Figure {
  const t = (THEMES as Record<string, Theme>)[theme] ?? THEMES.base;
  if (kind === 'wall') return imageOf(t.wall);
  if (kind === 'door') return imageOf(open ? t.doorOpen : t.doorClosed);
  return imageOf(t.floors[floorVariant(x, y)]);
}

const ITEM_IMAGES: Record<ItemKind, ImageName> = { rifle: 'item_rifle', pistol: 'item_pistol', grenade: 'item_grenade', shotgun: 'item_shotgun', smg: 'item_smg', sniper: 'item_sniper' };

export function itemImage(kind: ItemKind): Figure {
  return imageOf(ITEM_IMAGES[kind]);
}

export function corpseImage(side: Side): Figure {
  return imageOf(side === 'player' ? 'corpse_player' : 'corpse_enemy');
}
