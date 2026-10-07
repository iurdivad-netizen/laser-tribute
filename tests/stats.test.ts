import { describe, expect, it } from 'vitest';
import { hitChance } from '../src/core/combat';
import { applyRank } from '../src/core/ranks';
import { shotLine, shotPreview, soldierCard, weaponAccuracy, weaponLine } from '../src/core/stats';
import type { WeaponId } from '../src/core/types';
import { corridorRows, makeState, unit } from './helpers';

function duel(weapon: WeaponId, gap: number) {
  const s = makeState(corridorRows('P' + '.'.repeat(gap - 1) + 'E'));
  const p = unit(s, 'p1');
  p.weapon = weapon;
  p.facing = 2;
  return { s, p, e: unit(s, 'e1') };
}

const row = (u: ReturnType<typeof unit>, section: string, label: string): string | undefined =>
  soldierCard(u).find((x) => x.heading === section)?.rows.find((r) => r[0] === label)?.[1];

describe('weaponAccuracy and weaponLine', () => {
  it('is the weapon accuracy for a rookie, and shows damage and both accuracies', () => {
    const { p } = duel('rifle', 3);
    expect(weaponAccuracy(p, 'snap')).toBeCloseTo(0.5);
    expect(weaponAccuracy(p, 'aimed')).toBeCloseTo(0.85);
    expect(weaponLine(p)).toBe('DMG 30 ACC 50/85');
  });

  it('adds the rank bonus and the scope, and caps at 95%', () => {
    const { p } = duel('rifle', 3);
    applyRank(p, 9); // Captain: +12%
    p.attachment = 'scope'; // +10%
    expect(weaponAccuracy(p, 'snap')).toBeCloseTo(0.72);
    expect(weaponAccuracy(p, 'aimed')).toBeCloseTo(0.95);
    expect(weaponLine(p)).toBe('DMG 30 ACC 72/95');
  });

  it('shows the burst of the SMG and the other new weapons', () => {
    expect(weaponLine(duel('smg', 3).p)).toBe('DMG 12x3 ACC 45/60');
    expect(weaponLine(duel('shotgun', 3).p)).toBe('DMG 45 ACC 60/75');
    expect(weaponLine(duel('sniper', 3).p)).toBe('DMG 55 ACC 40/90');
    expect(weaponLine(duel('pistol', 3).p)).toBe('DMG 18 ACC 55/75');
  });
});

describe('shotPreview', () => {
  it('uses the real hit chance, the damage and the crit', () => {
    const { s, p, e } = duel('rifle', 3);
    const v = shotPreview(s, p, e, 'snap');
    expect(v.chance).toBeCloseTo(hitChance(s, p, e, 'snap'));
    expect(v).toMatchObject({ damage: 30, critChance: 0.08, critDamage: 45, rounds: 1, inRange: true, covered: false });
    expect(shotPreview(s, p, e, 'aimed').critChance).toBeCloseTo(0.15);
  });

  it('counts the armour of the target, the scope crit and the burst', () => {
    const { s, p, e } = duel('smg', 3);
    e.gadget = 'armour';
    p.attachment = 'scope';
    const v = shotPreview(s, p, e, 'snap');
    expect(v.rounds).toBe(3);
    expect(v.damage).toBe(9); // 12 minus 30%
    expect(v.critChance).toBeCloseTo(0.18);
    const rifle = duel('rifle', 3);
    rifle.e.gadget = 'armour';
    expect(shotPreview(rifle.s, rifle.p, rifle.e, 'snap').damage).toBe(21);
    expect(shotPreview(rifle.s, rifle.p, rifle.e, 'snap').critDamage).toBe(32);
  });

  it('flags a target out of range and a target in cover', () => {
    const far = duel('pistol', 9);
    expect(shotPreview(far.s, far.p, far.e, 'snap').inRange).toBe(false);
    const cover = makeState(['#########', '#....E..#', '#....#..#', '#P......#']); // the wall under the target is nearer to the shooter
    const shooter = unit(cover, 'p1');
    shooter.facing = 2;
    expect(shotPreview(cover, shooter, unit(cover, 'e1'), 'snap').covered).toBe(true);
  });
});

describe('shotLine', () => {
  it('reads hit chance, damage and crit chance', () => {
    const { s, p, e } = duel('rifle', 3);
    expect(shotLine(shotPreview(s, p, e, 'snap'))).toBe('45% HIT  30 DMG  8% CRIT');
  });

  it('shows the rounds of a burst, COVER, and OUT OF RANGE', () => {
    const smg = duel('smg', 3);
    expect(shotLine(shotPreview(smg.s, smg.p, smg.e, 'snap'))).toMatch(/12x3 DMG/);
    const far = duel('pistol', 9);
    expect(shotLine(shotPreview(far.s, far.p, far.e, 'aimed'))).toBe('OUT OF RANGE');
    const covered = { chance: 0.3, damage: 30, critChance: 0.08, critDamage: 45, rounds: 1, inRange: true, covered: true };
    expect(shotLine(covered)).toMatch(/COVER/);
  });
});

describe('soldierCard', () => {
  it('lists the soldier, weapon, grenade and kit sections', () => {
    const { p } = duel('rifle', 3);
    expect(soldierCard(p).map((x) => x.heading)).toEqual(['SOLDIER', 'WEAPON', 'GRENADE', 'KIT']);
    expect(row(p, 'SOLDIER', 'RANK')).toBe('ROOKIE');
    expect(row(p, 'SOLDIER', 'HP')).toBe('50/50');
    expect(row(p, 'SOLDIER', 'AP')).toBe('60/60');
    expect(row(p, 'SOLDIER', 'ACC BONUS')).toBe('+0%');
    expect(row(p, 'SOLDIER', 'KILLS')).toBe('0');
  });

  it('shows the rank bonuses, hurt HP and the mission kills', () => {
    const { p } = duel('rifle', 3);
    applyRank(p, 5); // Sergeant
    p.hp = 41;
    p.kills = 3;
    expect(row(p, 'SOLDIER', 'RANK')).toBe('SERGEANT');
    expect(row(p, 'SOLDIER', 'HP')).toBe('41/70');
    expect(row(p, 'SOLDIER', 'AP')).toBe('68/68');
    expect(row(p, 'SOLDIER', 'ACC BONUS')).toBe('+8%');
    expect(row(p, 'SOLDIER', 'KILLS')).toBe('3');
  });

  it('shows the weapon numbers with the soldier bonus and scope', () => {
    const { p } = duel('rifle', 3);
    expect(row(p, 'WEAPON', 'NAME')).toBe('RIFLE');
    expect(row(p, 'WEAPON', 'DAMAGE')).toBe('30');
    expect(row(p, 'WEAPON', 'RANGE')).toBe('14');
    expect(row(p, 'WEAPON', 'SNAP AP')).toBe('15');
    expect(row(p, 'WEAPON', 'AIM AP')).toBe('30');
    expect(row(p, 'WEAPON', 'SNAP ACC')).toBe('50%');
    expect(row(p, 'WEAPON', 'AIM ACC')).toBe('85%');
    expect(row(p, 'WEAPON', 'SNAP CRIT')).toBe('8%');
    expect(row(p, 'WEAPON', 'AIM CRIT')).toBe('15%');
    expect(row(p, 'WEAPON', 'AMMO')).toBe('5/5');
    expect(row(p, 'WEAPON', 'CLIPS')).toBe('1');
    expect(row(p, 'WEAPON', 'FALLOFF')).toBe('50%');
    applyRank(p, 9);
    p.attachment = 'scope';
    expect(row(p, 'WEAPON', 'SNAP ACC')).toBe('72%');
    expect(row(p, 'WEAPON', 'AIM ACC')).toBe('95%');
    expect(row(p, 'WEAPON', 'SNAP CRIT')).toBe('18%');
    expect(row(p, 'SOLDIER', 'KILLS')).toBe('0');
  });

  it('shows burst, sight and close penalty where the weapon has them', () => {
    expect(row(duel('smg', 3).p, 'WEAPON', 'DAMAGE')).toBe('12 x3');
    const sniper = duel('sniper', 3).p;
    expect(row(sniper, 'WEAPON', 'RANGE')).toBe('16');
    expect(row(sniper, 'WEAPON', 'SIGHT')).toBe('14');
    expect(row(sniper, 'WEAPON', 'CLOSE')).toBe('x0.5 WITHIN 3');
    expect(row(duel('rifle', 3).p, 'WEAPON', 'SIGHT')).toBeUndefined();
    expect(row(duel('shotgun', 3).p, 'WEAPON', 'FALLOFF')).toBe('90%');
  });

  it('describes the grenade kind and the kit', () => {
    const { p } = duel('rifle', 3);
    p.throwable = 'smoke';
    p.grenades = 2;
    expect(row(p, 'GRENADE', 'TYPE')).toBe('SMOKE');
    expect(row(p, 'GRENADE', 'COUNT')).toBe('2');
    expect(row(p, 'GRENADE', 'AP')).toBe('18');
    expect(row(p, 'GRENADE', 'RANGE')).toBe('8');
    expect(row(p, 'GRENADE', 'BLAST')).toBe('5x5');
    expect(row(p, 'GRENADE', 'EFFECT')).toBe('SMOKE 3 TURNS');
    p.throwable = 'frag';
    expect(row(p, 'GRENADE', 'BLAST')).toBe('3x3');
    expect(row(p, 'GRENADE', 'EFFECT')).toBe('40 DMG');
    p.throwable = 'flash';
    expect(row(p, 'GRENADE', 'EFFECT')).toBe('STUN 30 AP');
    p.throwable = 'incendiary';
    expect(row(p, 'GRENADE', 'EFFECT')).toBe('15 DMG + FIRE 3 TURNS');
    expect(row(p, 'KIT', 'GADGET')).toBe('NONE');
    expect(row(p, 'KIT', 'SCOPE')).toBe('NO');
    p.gadget = 'medkit';
    p.attachment = 'scope';
    expect(row(p, 'KIT', 'GADGET')).toBe('MEDKIT');
    expect(row(p, 'KIT', 'SCOPE')).toBe('YES');
  });
});
