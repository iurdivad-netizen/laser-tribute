import type { GameState, WeaponId } from './types';

export const LOADOUT = {
  budget: 120,
  prices: { pistol: 10, rifle: 25, grenade: 8 },
  maxGrenades: 3,
} as const;

export const SQUAD_SIZE = 4;

export interface SoldierLoadout {
  weapon: WeaponId;
  grenades: number;
}

export type Loadout = SoldierLoadout[];

export function defaultLoadout(): Loadout {
  return [
    { weapon: 'rifle', grenades: 1 },
    { weapon: 'rifle', grenades: 1 },
    { weapon: 'pistol', grenades: 1 },
    { weapon: 'pistol', grenades: 1 },
  ];
}

export function soldierCost(s: SoldierLoadout): number {
  return LOADOUT.prices[s.weapon] + LOADOUT.prices.grenade * s.grenades;
}

export function loadoutCost(l: Loadout): number {
  return l.reduce((sum, s) => sum + soldierCost(s), 0);
}

export function validateLoadout(l: Loadout): string | null {
  if (l.length !== SQUAD_SIZE) return `A loadout needs exactly ${SQUAD_SIZE} soldiers`;
  for (const [i, s] of l.entries()) {
    if (s.weapon !== 'pistol' && s.weapon !== 'rifle') return `Soldier ${i + 1} needs a weapon`;
    if (!Number.isInteger(s.grenades) || s.grenades < 0 || s.grenades > LOADOUT.maxGrenades) {
      return `Soldier ${i + 1} must carry 0 to ${LOADOUT.maxGrenades} grenades`;
    }
  }
  const cost = loadoutCost(l);
  if (cost > LOADOUT.budget) return `Loadout costs ${cost}, budget is ${LOADOUT.budget}`;
  return null;
}

export function applyLoadout(state: GameState, l: Loadout): GameState {
  const error = validateLoadout(l);
  if (error) throw new Error(error);
  const soldiers = state.units.filter((u) => u.side === 'player');
  if (soldiers.length !== l.length) throw new Error('Loadout does not match the squad size');
  const next = structuredClone(state);
  next.units
    .filter((u) => u.side === 'player')
    .forEach((u, i) => {
      u.weapon = l[i].weapon;
      u.grenades = l[i].grenades;
    });
  return next;
}
