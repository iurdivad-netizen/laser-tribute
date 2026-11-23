import type { GearRules, Unlocks } from '../gear';
import type { AttachmentId, GadgetId, ThrowableId, WeaponId } from '../types';

export interface ResearchNode {
  id: string;
  name: string;
  cost: number;
  days: number;
  needs: readonly string[];
  /** What finishing it gives: one gear item, or a level in one base track. */
  gives: {
    weapon?: WeaponId;
    throwable?: ThrowableId;
    gadget?: GadgetId;
    attachment?: AttachmentId;
    beds?: number;
    labs?: number;
    contracts?: number;
    hospital?: number;
    training?: number;
  };
}

const node = (
  id: string, name: string, cost: number, days: number, needs: string[], gives: ResearchNode['gives'],
): ResearchNode => ({ id, name, cost, days, needs, gives });

/** The research tree. Starting values; project 4 tunes them. */
export const NODES: readonly ResearchNode[] = [
  node('shotgun', 'Shotgun', 40, 4, [], { weapon: 'shotgun' }),
  node('smg', 'SMG', 70, 5, ['shotgun'], { weapon: 'smg' }),
  node('sniper', 'Sniper rifle', 110, 6, ['smg'], { weapon: 'sniper' }),
  node('smoke', 'Smoke grenade', 30, 3, [], { throwable: 'smoke' }),
  node('flash', 'Flashbang', 45, 4, ['smoke'], { throwable: 'flash' }),
  node('incendiary', 'Incendiary', 70, 5, ['flash'], { throwable: 'incendiary' }),
  node('armour', 'Armour', 50, 4, [], { gadget: 'armour' }),
  node('scanner', 'Scanner', 45, 4, [], { gadget: 'scanner' }),
  node('scope', 'Scope', 40, 3, [], { attachment: 'scope' }),
  node('beds1', 'Barracks I', 60, 4, [], { beds: 1 }),
  node('beds2', 'Barracks II', 100, 5, ['beds1'], { beds: 2 }),
  node('beds3', 'Barracks III', 140, 6, ['beds2'], { beds: 3 }),
  node('labs1', 'Labs I', 80, 5, [], { labs: 1 }),
  node('labs2', 'Labs II', 140, 6, ['labs1'], { labs: 2 }),
  node('contracts1', 'Supply contracts I', 70, 4, [], { contracts: 1 }),
  node('contracts2', 'Supply contracts II', 110, 5, ['contracts1'], { contracts: 2 }),
  node('contracts3', 'Supply contracts III', 160, 6, ['contracts2'], { contracts: 3 }),
  node('hospital1', 'Field hospital I', 80, 5, [], { hospital: 1 }),
  node('hospital2', 'Field hospital II', 140, 6, ['hospital1'], { hospital: 2 }),
  node('training1', 'Training facility I', 80, 5, [], { training: 1 }),
  node('training2', 'Training facility II', 140, 6, ['training1'], { training: 2 }),
  node('training3', 'Training facility III', 200, 7, ['training2'], { training: 3 }),
];

/** Every number of the base in one place (starting values for project 4 to tune). */
export const BASE_RULES = {
  startCredits: 150,
  /** Locked gear costs its base price times this on the equipment screen. */
  premium: 1.5,
  /** Credits per kill by the squad, paid at the result. */
  bounty: 5,
  startBeds: 6,
  bedsPerLevel: 2,
  hireCost: 40,
  /** Per loaned mercenary per mission. */
  mercFee: 10,
  trainDays: 4,
  woundedDays: 6,
  /** Second-chance probability by hospital level 0, 1, 2. */
  hospitalChance: [0, 0.25, 0.5],
  /** The effective-kill ceiling training can reach at training level 1, 2, 3 (Private, Sergeant, Captain). */
  trainCaps: [2, 5, 9],
  /** Research day multiplier by labs level 0, 1, 2. */
  labFactor: [1, 0.75, 0.5],
  waitOptions: [1, 3],
} as const;

export interface BaseLevels {
  beds: number;
  labs: number;
  contracts: number;
  hospital: number;
  training: number;
}

export function nodeById(id: string): ResearchNode | undefined {
  return NODES.find((n) => n.id === id);
}

/** The highest level reached in each base track (0 when none). */
export function levelsOf(done: readonly string[]): BaseLevels {
  const out: BaseLevels = { beds: 0, labs: 0, contracts: 0, hospital: 0, training: 0 };
  for (const id of done) {
    const g = nodeById(id)?.gives;
    if (!g) continue;
    for (const key of Object.keys(out) as (keyof BaseLevels)[]) {
      const level = g[key];
      if (level !== undefined && level > out[key]) out[key] = level;
    }
  }
  return out;
}

export const bedCount = (done: readonly string[]): number =>
  BASE_RULES.startBeds + BASE_RULES.bedsPerLevel * levelsOf(done).beds;

/** How many days a node takes with the labs built so far (at least 1). */
export function researchDays(n: ResearchNode, done: readonly string[]): number {
  return Math.max(1, Math.ceil(n.days * BASE_RULES.labFactor[levelsOf(done).labs]));
}

/** What the squad may carry: the starting kit plus every researched gear node. */
export function unlocksOf(done: readonly string[]): Unlocks {
  const weapons: WeaponId[] = ['pistol', 'rifle'];
  const throwables: ThrowableId[] = ['frag'];
  const gadgets: GadgetId[] = ['medkit'];
  const attachments: AttachmentId[] = [];
  for (const id of done) {
    const g = nodeById(id)?.gives;
    if (!g) continue;
    if (g.weapon) weapons.push(g.weapon);
    if (g.throwable) throwables.push(g.throwable);
    if (g.gadget) gadgets.push(g.gadget);
    if (g.attachment) attachments.push(g.attachment);
  }
  return { weapons, throwables, gadgets, attachments };
}

export const storyGearRules = (done: readonly string[]): GearRules => ({
  unlocks: unlocksOf(done),
  premium: BASE_RULES.premium,
});
