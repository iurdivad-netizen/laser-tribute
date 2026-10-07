import { ATTACHMENTS, CONFIG, CRIT, GADGETS, THROWABLES, WEAPONS } from './config';
import { critChance, damageTaken, hitChance, isCovered } from './combat';
import { distance } from './geometry';
import type { GameState, ShotMode, Unit } from './types';

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** The weapon accuracy of a mode with the soldier's rank bonus and the scope, capped, before range and cover. */
export function weaponAccuracy(u: Unit, mode: ShotMode): number {
  const w = WEAPONS[u.weapon];
  const scope = u.attachment === 'scope' ? ATTACHMENTS.scope.accuracy : 0;
  return Math.min(CONFIG.maxHitChance, (mode === 'snap' ? w.snapAccuracy : w.aimedAccuracy) + u.accuracy + scope);
}

/** The weapon numbers for the detail line, for example `DMG 30 ACC 50/85` (a burst: `DMG 12x3`). */
export function weaponLine(u: Unit): string {
  const w = WEAPONS[u.weapon];
  const burst = w.burst && w.burst > 1 ? `x${w.burst}` : '';
  return `DMG ${w.damage}${burst} ACC ${Math.round(weaponAccuracy(u, 'snap') * 100)}/${Math.round(weaponAccuracy(u, 'aimed') * 100)}`;
}

export interface ShotPreview {
  /** The chance that one round hits, with range, falloff and cover. */
  chance: number;
  /** Damage of one round after the target's armour; `critDamage` is the same for a critical hit. */
  damage: number;
  critChance: number;
  critDamage: number;
  rounds: number;
  inRange: boolean;
  covered: boolean;
}

export function shotPreview(s: GameState, shooter: Unit, target: Unit, mode: ShotMode): ShotPreview {
  const w = WEAPONS[shooter.weapon];
  return {
    chance: hitChance(s, shooter, target, mode),
    damage: damageTaken(target, w.damage),
    critChance: critChance(shooter, mode),
    critDamage: damageTaken(target, Math.floor(w.damage * CRIT.multiplier)),
    rounds: w.burst ?? 1,
    inRange: distance(shooter.pos, target.pos) <= w.range,
    covered: isCovered(s, shooter.pos, target.pos),
  };
}

/** The status line while aiming at a hovered enemy: `45% HIT  30 DMG  8% CRIT`, a burst `12x3 DMG`, then COVER if he is. */
export function shotLine(v: ShotPreview): string {
  if (!v.inRange) return 'OUT OF RANGE';
  const dmg = v.rounds > 1 ? `${v.damage}x${v.rounds}` : `${v.damage}`;
  return `${pct(v.chance)} HIT  ${dmg} DMG  ${pct(v.critChance)} CRIT${v.covered ? '  COVER' : ''}`;
}

export interface CardSection {
  heading: string;
  rows: [label: string, value: string][];
}

const EFFECTS: Record<string, (t: (typeof THROWABLES)[keyof typeof THROWABLES]) => string> = {
  frag: (t) => `${t.damage} DMG`,
  smoke: (t) => `SMOKE ${t.hazard?.turns} TURNS`,
  flash: (t) => `STUN ${t.apPenalty} AP`,
  incendiary: (t) => `${t.damage} DMG + FIRE ${t.hazard?.turns} TURNS`,
};

/** Everything the soldier card shows for a soldier, section by section. */
export function soldierCard(u: Unit): CardSection[] {
  const w = WEAPONS[u.weapon];
  const t = THROWABLES[u.throwable];
  const weapon: CardSection['rows'] = [
    ['NAME', w.name.toUpperCase()],
    ['DAMAGE', w.burst && w.burst > 1 ? `${w.damage} x${w.burst}` : `${w.damage}`],
    ['RANGE', `${w.range}`],
  ];
  if (w.sight !== undefined) weapon.push(['SIGHT', `${w.sight}`]);
  weapon.push(
    ['SNAP AP', `${w.snapAp}`],
    ['AIM AP', `${w.aimedAp}`],
    ['SNAP ACC', pct(weaponAccuracy(u, 'snap'))],
    ['AIM ACC', pct(weaponAccuracy(u, 'aimed'))],
    ['SNAP CRIT', pct(critChance(u, 'snap'))],
    ['AIM CRIT', pct(critChance(u, 'aimed'))],
    ['AMMO', `${u.ammo}/${w.magazine}`],
    ['CLIPS', `${u.clips}`],
    ['FALLOFF', pct(w.falloff ?? 0.5)],
  );
  if (w.closePenalty) weapon.push(['CLOSE', `x${w.closePenalty.multiplier} WITHIN ${w.closePenalty.within}`]);
  const side = 2 * t.radius + 1;
  return [
    {
      heading: 'SOLDIER',
      rows: [
        ['NAME', u.name.toUpperCase()],
        ['RANK', (u.rank || 'ENEMY').toUpperCase()],
        ['HP', `${u.hp}/${u.maxHp}`],
        ['AP', `${u.ap}/${u.maxAp}`],
        ['ACC BONUS', `+${Math.round(u.accuracy * 100)}%`],
        ['KILLS', `${u.kills}`],
      ],
    },
    { heading: 'WEAPON', rows: weapon },
    {
      heading: 'GRENADE',
      rows: [
        ['TYPE', t.name.toUpperCase()],
        ['COUNT', `${u.grenades}`],
        ['AP', `${t.apCost}`],
        ['RANGE', `${t.range}`],
        ['BLAST', `${side}x${side}`],
        ['EFFECT', EFFECTS[u.throwable](t)],
      ],
    },
    {
      heading: 'KIT',
      rows: [
        ['GADGET', u.gadget ? GADGETS[u.gadget].name.toUpperCase() : 'NONE'],
        ['SCOPE', u.attachment === 'scope' ? 'YES' : 'NO'],
      ],
    },
  ];
}
