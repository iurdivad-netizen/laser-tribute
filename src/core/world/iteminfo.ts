import { ATTACHMENTS, GADGETS, THROWABLES, WEAPONS, WEAPON_IDS, THROWABLE_IDS, GADGET_IDS } from '../config';
import type { GearKind } from '../gear';
import { unlocked } from '../gear';
import { attachmentPrice, gadgetPrice, throwablePrice, weaponPrice } from '../loadout';
import type { GadgetId, ThrowableId, WeaponId } from '../types';
import { BASE_RULES, NODES, nodeById, researchDays, storyGearRules } from './base';
import { rankFor } from '../ranks';
import type { World } from './world';

export type ItemRef =
  | { kind: 'weapon'; id: WeaponId }
  | { kind: 'throwable'; id: ThrowableId }
  | { kind: 'gadget'; id: GadgetId }
  | { kind: 'scope' }
  /** A research upgrade (a base level), by node id. */
  | { kind: 'node'; id: string };

export interface ItemCard {
  title: string;
  rows: [label: string, value: string][];
  /** One short line on when to choose the item (no numbers, so it cannot go stale). */
  goodFor: string;
}

/** The 13 items: the weapons, the grenades, the gadgets and the scope. */
export const ALL_ITEMS: readonly ItemRef[] = [
  ...WEAPON_IDS.map((id): ItemRef => ({ kind: 'weapon', id })),
  ...THROWABLE_IDS.map((id): ItemRef => ({ kind: 'throwable', id })),
  ...GADGET_IDS.map((id): ItemRef => ({ kind: 'gadget', id })),
  { kind: 'scope' },
];

const GOOD_FOR: Record<string, string> = {
  pistol: 'A cheap backup: light, quick to fire, short reach.',
  rifle: 'The all-rounder: good reach and accuracy at a fair price.',
  shotgun: 'Hits hardest up close, and falls off fast with distance.',
  smg: 'Fires a burst: many small hits, best at medium range.',
  sniper: 'Kills from far away; weak when the target is close.',
  frag: 'Blast damage, and it breaks doors.',
  smoke: 'Blocks sight for a few turns: cover to cross open ground.',
  flash: 'Drains the action points of everyone it catches.',
  incendiary: 'Sets the ground on fire for a few turns, burning whoever stays.',
  medkit: 'Heals a soldier in the field.',
  armour: 'Cuts the damage the soldier takes.',
  scanner: 'Shows enemies near a spot, even through walls.',
  scope: 'More accuracy and crit chance for the shooter.',
};

const pct = (n: number): string => `${Math.round(n * 100)}%`;

function throwableEffect(id: ThrowableId): string {
  const t = THROWABLES[id];
  switch (id) {
    case 'frag': return `${t.damage} DMG`;
    case 'smoke': return `SMOKE ${t.hazard?.turns} TURNS`;
    case 'flash': return `STUN ${t.apPenalty} AP`;
    case 'incendiary': return `${t.damage} DMG + FIRE ${t.hazard?.turns} TURNS`;
  }
}

type GearRef = Exclude<ItemRef, { kind: 'node' }>;
const gearKind = (ref: GearRef): GearKind => (ref.kind === 'scope' ? 'attachment' : ref.kind);
const idOf = (ref: GearRef): string => (ref.kind === 'scope' ? 'scope' : ref.id);

/** The card for an item: its numbers from the config tables, its price, and (given the story world) whether it is owned or costs the premium. */
export function itemCard(ref: ItemRef, w: World | null): ItemCard {
  if (ref.kind === 'node') {
    const card = nodeCard(ref.id, w);
    if (!card) throw new Error(`no upgrade node ${ref.id}`);
    return card;
  }
  const rows: [string, string][] = [];
  let title: string;
  let base: number;
  let paid: (rules: ReturnType<typeof storyGearRules>) => number;
  switch (ref.kind) {
    case 'weapon': {
      const d = WEAPONS[ref.id];
      title = d.name.toUpperCase();
      rows.push(
        ['DAMAGE', d.burst && d.burst > 1 ? `${d.damage}x${d.burst}` : `${d.damage}`],
        ['RANGE', `${d.range}`],
        ['SNAP AP', `${d.snapAp}`],
        ['AIM AP', `${d.aimedAp}`],
        ['SNAP ACC', pct(d.snapAccuracy)],
        ['AIM ACC', pct(d.aimedAccuracy)],
        ['MAGAZINE', `${d.magazine}`],
        ['FALLOFF', pct(d.falloff ?? 0.5)],
      );
      if (d.sight !== undefined) rows.push(['SIGHT', `${d.sight}`]);
      if (d.closePenalty) rows.push(['CLOSE', `x${d.closePenalty.multiplier} WITHIN ${d.closePenalty.within}`]);
      base = d.price;
      paid = (rules) => weaponPrice(ref.id, rules);
      break;
    }
    case 'throwable': {
      const d = THROWABLES[ref.id];
      const side = 2 * d.radius + 1;
      title = d.name.toUpperCase();
      rows.push(['AP', `${d.apCost}`], ['RANGE', `${d.range}`], ['BLAST', `${side}x${side}`], ['EFFECT', throwableEffect(ref.id)]);
      base = d.price;
      paid = (rules) => throwablePrice({ throwable: ref.id }, rules);
      break;
    }
    case 'gadget': {
      const g = GADGETS[ref.id];
      title = g.name.toUpperCase();
      if (ref.id === 'medkit') rows.push(['HEAL', `${GADGETS.medkit.heal}`], ['AP', `${GADGETS.medkit.apCost}`]);
      else if (ref.id === 'armour') rows.push(['DAMAGE', `-${GADGETS.armour.reductionPct}%`]);
      else rows.push(['AP', `${GADGETS.scanner.apCost}`], ['RADIUS', `${GADGETS.scanner.radius}`]);
      base = g.price;
      paid = (rules) => gadgetPrice(ref.id, rules);
      break;
    }
    case 'scope': {
      title = 'SCOPE';
      rows.push(['ACCURACY', `+${pct(ATTACHMENTS.scope.accuracy)}`], ['CRIT', `+${pct(ATTACHMENTS.scope.crit)}`]);
      base = ATTACHMENTS.scope.price;
      paid = (rules) => attachmentPrice('scope', rules);
      break;
    }
  }
  rows.push(['PRICE', `${base}`]);
  if (w) {
    const rules = storyGearRules(w.research.done);
    rows.push(['STATUS', unlocked(rules, gearKind(ref), idOf(ref)) ? 'OWNED' : `PREMIUM ${paid(rules)} CR`]);
  }
  return { title, rows, goodFor: GOOD_FOR[idOf(ref)] };
}

/** The item a research node gives, or null for a base upgrade (or an unknown node). */
export function itemOfNode(nodeId: string): ItemRef | null {
  const g = NODES.find((n) => n.id === nodeId)?.gives;
  if (!g) return null;
  if (g.weapon) return { kind: 'weapon', id: g.weapon };
  if (g.throwable) return { kind: 'throwable', id: g.throwable };
  if (g.gadget) return { kind: 'gadget', id: g.gadget };
  if (g.attachment) return { kind: 'scope' };
  return null;
}

const TRACK_GOOD_FOR: Record<string, string> = {
  beds: 'More beds let you keep more soldiers on the roster.',
  labs: 'Research finishes sooner, so new gear arrives earlier.',
  contracts: 'More credits every day from the regions you hold.',
  hospital: 'A better chance to save a soldier who falls in a won fight.',
  training: 'Raises how far a soldier can be trained between fights.',
};

/** The card for a research upgrade (a base level), or null for a gear node or an unknown id. */
export function nodeCard(nodeId: string, w: World | null): ItemCard | null {
  const n = nodeById(nodeId);
  if (!n || itemOfNode(nodeId) !== null) return null;
  const g = n.gives;
  const done = w ? w.research.done : [];
  let track: string;
  let effect: string;
  if (g.beds !== undefined) {
    track = 'beds';
    effect = `+${BASE_RULES.bedsPerLevel} BEDS (TOTAL ${BASE_RULES.startBeds + BASE_RULES.bedsPerLevel * g.beds})`;
  } else if (g.labs !== undefined) {
    track = 'labs';
    effect = `RESEARCH ${pct(BASE_RULES.labFactor[g.labs])} OF DAYS`;
  } else if (g.contracts !== undefined) {
    track = 'contracts';
    effect = '+1 CREDIT/DAY/REGION';
  } else if (g.hospital !== undefined) {
    track = 'hospital';
    effect = `${pct(BASE_RULES.hospitalChance[g.hospital])} SECOND CHANCE`;
  } else {
    const cap = BASE_RULES.trainCaps[(g.training ?? 1) - 1];
    track = 'training';
    effect = `CAP ${cap} (${rankFor(cap).name.toUpperCase()})`;
  }
  const rows: [string, string][] = [['EFFECT', effect], ['COST', `${n.cost}`], ['DAYS', `${researchDays(n, done)}`]];
  if (n.needs.length > 0) rows.push(['NEEDS', n.needs.map((id) => nodeById(id)?.name.toUpperCase() ?? id).join(', ')]);
  if (w) {
    const status = done.includes(n.id) ? 'RESEARCHED' : w.research.active?.node === n.id ? 'IN PROGRESS' : n.needs.every((id) => done.includes(id)) ? 'AVAILABLE' : 'LOCKED';
    rows.push(['STATUS', status]);
  }
  return { title: n.name.toUpperCase(), rows, goodFor: TRACK_GOOD_FOR[track] };
}
