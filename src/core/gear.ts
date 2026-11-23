import { ATTACHMENT_IDS, GADGET_IDS, unlockedThrowables, unlockedWeapons } from './config';
import type { AttachmentId, GadgetId, ThrowableId, WeaponId } from './types';

/** The gear the squad may carry. */
export interface Unlocks {
  weapons: readonly WeaponId[];
  throwables: readonly ThrowableId[];
  gadgets: readonly GadgetId[];
  attachments: readonly AttachmentId[];
}

/**
 * What may be carried and what locked gear costs. `premium` null: locked gear cannot be carried (the tutorial and the
 * campaign); a number: locked gear can be carried at its base price times that number (the story marketplace).
 */
export interface GearRules {
  unlocks: Unlocks;
  premium: number | null;
}

/** A unlock level (the tutorial and the campaign, as always) or full rules (the story). */
export type GearArg = number | GearRules;

export type GearKind = 'weapon' | 'throwable' | 'gadget' | 'attachment';

/** Today's sets for a level: weapons and throwables unlock by level, gadgets and the scope are always there. */
export function unlocksFromLevel(level: number): Unlocks {
  return {
    weapons: unlockedWeapons(level),
    throwables: unlockedThrowables(level),
    gadgets: GADGET_IDS,
    attachments: ATTACHMENT_IDS,
  };
}

export function gearRulesOf(arg: GearArg): GearRules {
  return typeof arg === 'number' ? { unlocks: unlocksFromLevel(arg), premium: null } : arg;
}

export function unlocked(rules: GearRules, kind: GearKind, id: string): boolean {
  const u = rules.unlocks;
  const list: readonly string[] =
    kind === 'weapon' ? u.weapons : kind === 'throwable' ? u.throwables : kind === 'gadget' ? u.gadgets : u.attachments;
  return list.includes(id);
}

/** 1 for unlocked gear or when there is no premium; the premium for locked gear. */
export function priceFactor(rules: GearRules, kind: GearKind, id: string): number {
  return rules.premium !== null && !unlocked(rules, kind, id) ? rules.premium : 1;
}
