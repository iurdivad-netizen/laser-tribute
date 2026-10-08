import { THEME_IDS, type ThemeId } from '../core/themes';
import type { GameState, ItemKind, Side, TileKind } from '../core/types';
import type { Figure } from './figure';
import { imageOf, type ImageName } from './image';
import { recolour, type Ramp } from './recolour';
import { floorVariant } from './sprite';

export type { ThemeId };

type Role = 'floorA' | 'floorB' | 'floorC' | 'wall' | 'doorClosed' | 'doorOpen';

export interface Theme {
  name: string;
  floors: readonly [ImageName, ImageName, ImageName];
  wall: ImageName;
  doorClosed: ImageName;
  doorOpen: ImageName;
  /** Gradient maps for the piece groups; a group without one keeps the base image. */
  ramps?: { floor?: Ramp; wall?: Ramp; door?: Ramp };
  /** Replaces one role with a named image (no recolouring): the place for a hand-drawn piece. */
  overrides?: Partial<Record<Role, ImageName>>;
}

const BASE_PIECES = { floors: ['floor_a', 'floor_b', 'floor_c'], wall: 'wall', doorClosed: 'door_closed', doorOpen: 'door_open' } as const;

/** The look of a map's tiles: the base pieces, recoloured by a ramp per group. Ramps are tuned by eye in the dev gallery. */
export const THEMES: Record<ThemeId, Theme> = {
  base: { name: 'Concrete', ...BASE_PIECES },
  timber: {
    name: 'Timber', ...BASE_PIECES,
    ramps: {
      floor: { shadow: '#2a1c12', mid: '#4a3322', light: '#6b4e33' },
      wall: { shadow: '#4a3a28', mid: '#8a6a44', light: '#c7a066' },
      door: { shadow: '#4a2a14', mid: '#d8913e', light: '#fff0c0' },
    },
  },
  steel: {
    name: 'Steel', ...BASE_PIECES,
    ramps: {
      floor: { shadow: '#1c2430', mid: '#2e3a4a', light: '#46566a' },
      wall: { shadow: '#33424f', mid: '#6a7f94', light: '#aebdcb' },
      door: { shadow: '#4a260f', mid: '#e08a30', light: '#ffd9a0' },
    },
  },
  cave: {
    name: 'Cave', ...BASE_PIECES,
    ramps: {
      floor: { shadow: '#201a14', mid: '#33291f', light: '#4a3c2c' },
      wall: { shadow: '#2e261e', mid: '#7a6446', light: '#c0a878' },
      door: { shadow: '#4a3016', mid: '#c8903f', light: '#f0d090' },
    },
  },
  stone: {
    name: 'Stone', ...BASE_PIECES,
    ramps: {
      floor: { shadow: '#2a2825', mid: '#3b3935', light: '#4d4a45' },
      wall: { shadow: '#5a5e66', mid: '#9a9ea6', light: '#d4d6da' },
      door: { shadow: '#3a281a', mid: '#b88a4c', light: '#f2d9a8' },
    },
  },
};

/** The theme of the mission being drawn: the one the mission was created with. */
export function themeFor(state: GameState): ThemeId {
  return state.theme;
}

const recoloured = new Map<string, Figure>();

/** The image of a piece in a theme: the override, else the base image recoloured by the group's ramp, else the base image. */
function piece(id: ThemeId, group: 'floor' | 'wall' | 'door', image: ImageName, override?: ImageName): Figure {
  if (override) return imageOf(override);
  const ramp = THEMES[id].ramps?.[group];
  if (!ramp) return imageOf(image);
  const key = `${id}:${image}`;
  let fig = recoloured.get(key);
  if (!fig) {
    fig = recolour(imageOf(image), ramp, `${image}@${id}`);
    recoloured.set(key, fig);
  }
  return fig;
}

const FLOOR_ROLES: Role[] = ['floorA', 'floorB', 'floorC'];

/** The image of a tile. `open` is whether the player last saw the door open; it only matters for doors. */
export function tileImage(theme: string, kind: TileKind, open: boolean, x: number, y: number): Figure {
  const id: ThemeId = (THEME_IDS as readonly string[]).includes(theme) ? (theme as ThemeId) : 'base';
  const t = THEMES[id];
  if (kind === 'wall') return piece(id, 'wall', t.wall, t.overrides?.wall);
  if (kind === 'door') {
    return open ? piece(id, 'door', t.doorOpen, t.overrides?.doorOpen) : piece(id, 'door', t.doorClosed, t.overrides?.doorClosed);
  }
  const v = floorVariant(x, y);
  return piece(id, 'floor', t.floors[v], t.overrides?.[FLOOR_ROLES[v]]);
}

const ITEM_IMAGES: Record<ItemKind, ImageName> = { rifle: 'item_rifle', pistol: 'item_pistol', grenade: 'item_grenade', shotgun: 'item_shotgun', smg: 'item_smg', sniper: 'item_sniper' };

export function itemImage(kind: ItemKind): Figure {
  return imageOf(ITEM_IMAGES[kind]);
}

export function corpseImage(side: Side): Figure {
  return imageOf(side === 'player' ? 'corpse_player' : 'corpse_enemy');
}
