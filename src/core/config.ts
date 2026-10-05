import type { AttachmentId, GadgetId, WeaponId } from './types';

export const NOT_ENOUGH_AP = 'Not enough action points';

export const CONFIG = {
  tileSize: 16,
  soldierHp: 50,
  enemyHp: 40,
  soldierGrenades: 1,
  maxAp: 60,
  moveCost: 4,
  diagonalCost: 6,
  turnCostPer45: 1,
  doorCost: 2,
  /** Longest route (in tiles) through a closed door that an enemy will hunt along. */
  huntRadius: 12,
  pickupCost: 3,
  sightRange: 10,
  coverMultiplier: 0.6,
  maxHitChance: 0.95,
  grenade: { apCost: 24, range: 8, damage: 40, radius: 1 },
  knife: { apCost: 20, damage: 60, accuracy: 0.9 },
  reloadAp: 15,
  spareClips: 1,
  maxClips: 4,
} as const;

export const GADGET_IDS: readonly GadgetId[] = ['medkit', 'armour', 'scanner'];

export const GADGETS = {
  medkit: { name: 'Medkit', price: 12, apCost: 12, heal: 25 },
  armour: { name: 'Armour', price: 20, reductionPct: 30 },
  scanner: { name: 'Scanner', price: 15, apCost: 10, radius: 8 },
} as const;

export const CRIT = { snap: 0.08, aimed: 0.15, multiplier: 1.5 } as const;

export const ATTACHMENT_IDS: readonly AttachmentId[] = ['scope'];

export const ATTACHMENTS = {
  scope: { name: 'Scope', price: 18, accuracy: 0.1, crit: 0.1 },
} as const;

export interface WeaponDef {
  name: string;
  damage: number;
  range: number;
  snapAp: number;
  aimedAp: number;
  snapAccuracy: number;
  aimedAccuracy: number;
  /** Rounds in a full magazine. */
  magazine: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    name: 'Pistol', damage: 18, range: 8,
    snapAp: 12, aimedAp: 24, snapAccuracy: 0.55, aimedAccuracy: 0.75, magazine: 8,
  },
  rifle: {
    name: 'Rifle', damage: 30, range: 14,
    snapAp: 15, aimedAp: 30, snapAccuracy: 0.5, aimedAccuracy: 0.85, magazine: 5,
  },
};
