import type { WeaponId } from './types';

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
