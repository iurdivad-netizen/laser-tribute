import type { AttachmentId, GadgetId, ThrowableId, WeaponId } from './types';

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
  price: number;
  /** The campaign level (mission number) at which the shop offers it. */
  unlockAt: number;
  /** Rounds fired per shot action (default 1); each rolls its own hit and crit. */
  burst?: number;
  /** Range penalty: the range factor is 1 - falloff * distance / range (default 0.5). */
  falloff?: number;
  /** Accuracy multiplier when the target is within `within` tiles. */
  closePenalty?: { within: number; multiplier: number };
  /** How far the carrier sees (default CONFIG.sightRange). */
  sight?: number;
}

export const WEAPON_IDS: readonly WeaponId[] = ['pistol', 'rifle', 'shotgun', 'smg', 'sniper'];

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    name: 'Pistol', damage: 18, range: 8,
    snapAp: 12, aimedAp: 24, snapAccuracy: 0.55, aimedAccuracy: 0.75, magazine: 8, price: 10, unlockAt: 1,
  },
  rifle: {
    name: 'Rifle', damage: 30, range: 14,
    snapAp: 15, aimedAp: 30, snapAccuracy: 0.5, aimedAccuracy: 0.85, magazine: 5, price: 25, unlockAt: 1,
  },
  shotgun: {
    name: 'Shotgun', damage: 45, range: 6,
    snapAp: 15, aimedAp: 25, snapAccuracy: 0.6, aimedAccuracy: 0.75, magazine: 4, price: 22, unlockAt: 2, falloff: 0.9,
  },
  smg: {
    name: 'SMG', damage: 12, range: 9,
    snapAp: 18, aimedAp: 28, snapAccuracy: 0.45, aimedAccuracy: 0.6, magazine: 12, price: 28, unlockAt: 4, burst: 3,
  },
  sniper: {
    name: 'Sniper', damage: 55, range: 16,
    snapAp: 25, aimedAp: 35, snapAccuracy: 0.4, aimedAccuracy: 0.9, magazine: 3, price: 40, unlockAt: 6,
    falloff: 0.2, closePenalty: { within: 3, multiplier: 0.5 }, sight: 14,
  },
};

export interface ThrowableDef {
  name: string;
  apCost: number;
  range: number;
  radius: number;
  price: number;
  unlockAt: number;
  /** Damage to every unit in the blast (either side). */
  damage?: number;
  breaksDoors?: boolean;
  /** Leaves a hazard on every non-wall tile of the blast for `turns` turns. */
  hazard?: { kind: 'smoke' | 'fire'; turns: number };
  /** AP every unit in the blast loses at the start of its next turn. */
  apPenalty?: number;
}

export const THROWABLE_IDS: readonly ThrowableId[] = ['frag', 'smoke', 'flash', 'incendiary'];

export const THROWABLES: Record<ThrowableId, ThrowableDef> = {
  frag: { name: 'Frag', apCost: 24, range: 8, radius: 1, price: 8, unlockAt: 1, damage: 40, breaksDoors: true },
  smoke: { name: 'Smoke', apCost: 18, range: 8, radius: 2, price: 10, unlockAt: 2, hazard: { kind: 'smoke', turns: 3 } },
  flash: { name: 'Flashbang', apCost: 18, range: 8, radius: 2, price: 10, unlockAt: 4, apPenalty: 30 },
  incendiary: { name: 'Incendiary', apCost: 24, range: 8, radius: 1, price: 14, unlockAt: 6, damage: 15, hazard: { kind: 'fire', turns: 3 } },
};

export const HAZARD = { fireDamage: 10 } as const;

/** The tutorial offers only the level 1 kit. */
export const TUTORIAL_LEVEL = 1;

export const unlockedWeapons = (level: number): WeaponId[] => WEAPON_IDS.filter((id) => WEAPONS[id].unlockAt <= level);
export const unlockedThrowables = (level: number): ThrowableId[] => THROWABLE_IDS.filter((id) => THROWABLES[id].unlockAt <= level);
