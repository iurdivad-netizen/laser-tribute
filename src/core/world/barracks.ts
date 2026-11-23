import type { RosterSoldier } from '../campaign';
import { cheapLoadout, loadoutCost } from '../loadout';
import { BASE_RULES } from './base';
import type { World } from './world';

const SQUAD_SIZE = 4;

/**
 * The four soldiers a mission takes: the ready soldiers named in the squad, in squad order, topped up with loaned
 * mercenaries ("Loan 1", "Loan 2", ...) who have no kills and no training. `mercs` is how many were added.
 */
export function deployed(w: World): { roster: RosterSoldier[]; mercs: number } {
  const roster: RosterSoldier[] = [];
  for (const name of w.squad.slice(0, SQUAD_SIZE)) {
    const s = w.soldiers.find((x) => x.name === name);
    if (s && s.status === 'ready') roster.push({ name: s.name, kills: s.kills, trained: s.trained });
  }
  const mercs = SQUAD_SIZE - roster.length;
  for (let k = 1; k <= mercs; k++) roster.push({ name: `Loan ${k}`, kills: 0 });
  return { roster, mercs };
}

/** The four ready soldiers with the most effective kills (kills plus training), ties in pool order; fewer if fewer are ready. */
export function autoSquad(w: World): string[] {
  return w.soldiers
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.status === 'ready')
    .sort((a, b) => b.s.kills + b.s.trained - (a.s.kills + a.s.trained) || a.i - b.i)
    .slice(0, SQUAD_SIZE)
    .map(({ s }) => s.name);
}

/** Chooses the squad. Throws unless it is at most four distinct ready soldiers from the pool. */
export function setSquad(w: World, names: string[]): World {
  if (names.length > SQUAD_SIZE) throw new Error('a squad has at most four soldiers');
  if (new Set(names).size !== names.length) throw new Error('a soldier cannot be picked twice');
  for (const name of names) {
    const s = w.soldiers.find((x) => x.name === name);
    if (!s) throw new Error(`${name} is not in the barracks`);
    if (s.status !== 'ready') throw new Error(`${name} is not ready`);
  }
  return { ...w, squad: [...names] };
}

/**
 * What the equipment screen can spend: credits less the loan fees of the mercenaries who will fill the squad, but never
 * less than the cheapest kit costs, so a broke player can always field a squad (the shortfall is simply not paid).
 */
export function kitBudget(w: World): number {
  return Math.max(loadoutCost(cheapLoadout()), w.credits - BASE_RULES.mercFee * deployed(w).mercs);
}
