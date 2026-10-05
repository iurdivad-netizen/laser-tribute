import { describe, expect, it } from 'vitest';
import { App } from '../src/app';
import { createMission, MISSIONS } from '../src/core/missions';
import { createUiState } from '../src/input/uiState';
import { VIEW } from '../src/render/layout';
import { Effects } from '../src/render/effects';
import { drawGame } from '../src/render/renderer';
import { drawCampaignEnd } from '../src/screens/end';
import { drawResult } from '../src/screens/result';
import { drawTitle } from '../src/screens/title';
import { unsupportedChars } from '../src/ui/font';
import { onText, type TextRun } from '../src/ui/text';

const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;

function collect(draw: () => void): TextRun[] {
  const runs: TextRun[] = [];
  const stop = onText((r) => runs.push(r));
  draw();
  stop();
  return runs;
}

const rect = (r: TextRun) => {
  const x = r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2);
  return { x, y: r.y, w: r.width, h: 7 };
};

function check(name: string, runs: TextRun[]) {
  expect(runs.length, name).toBeGreaterThan(0);
  for (const r of runs) {
    expect(unsupportedChars(r.text), `${name}: ${r.text}`).toEqual([]);
    const b = rect(r);
    expect(b.x, `${name}: ${r.text}`).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w, `${name}: ${r.text}`).toBeLessThanOrEqual(VIEW.width);
    expect(b.y + b.h, `${name}: ${r.text}`).toBeLessThanOrEqual(VIEW.height);
  }
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const a = rect(runs[i]);
      const b = rect(runs[j]);
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      expect(overlap, `${name}: "${runs[i].text}" overlaps "${runs[j].text}"`).toBe(false);
    }
  }
}

describe('every screen lays out inside the canvas, with the longest content', () => {
  it('the equipment screen at the start and in a later mission with long names', () => {
    const fresh = new App({ clock: () => 0 });
    check('equipment (new)', collect(() => fresh.draw(ctx, 0)));

    const later = new App({ clock: () => 0 });
    later.campaign.missionsWon = 2;
    later.campaign.roster = [
      { name: 'Lindqvist 2', kills: 99 }, { name: 'Kowalski 2', kills: 12 }, { name: 'Fontaine', kills: 5 }, { name: 'Dubois', kills: 2 },
    ];
    later.campaign.stash = { rifle: 2, pistol: 1, grenade: 3, clip: 0, medkit: 0, armour: 0, scanner: 0 };
    check('equipment (late)', collect(() => later.draw(ctx, 0)));
  });

  it('the mission view, with a long message and the longest soldier name', () => {
    const roster = [
      { name: 'Lindqvist 2', kills: 9 }, { name: 'B', kills: 0 }, { name: 'C', kills: 0 }, { name: 'D', kills: 0 },
    ];
    const state = createMission(MISSIONS[0], 1, roster);
    const ui = createUiState('p1');
    ui.message = 'Lindqvist 2 on alert: fires once at each enemy that moves into view';
    ui.messageUntil = Infinity;
    state.units.find((u) => u.id === 'p1')!.alert = true;
    state.turnNumber = 99;
    check('mission', collect(() => drawGame(ctx, state, ui, new Effects(), 0)));
  });

  it('the result card and the end screen', () => {
    check('result', collect(() => drawResult(ctx, {
      result: { won: true, survivors: 2, squadSize: 4, enemiesKilled: 8, enemyCount: 8, turns: 12 },
      missionName: 'Compound',
      fallen: ['Lindqvist 2', 'Kowalski', 'Fontaine', 'Eriksen'],
      nextBudget: 215,
      loot: '4 rifles, 4 clips, 12 grenades (stash full)',
      promoted: ['Lindqvist 2 (Sergeant)', 'Alvarez (Captain)', 'Brandt (Private)', 'Chen (Sergeant)'],
    })));
    check('end', collect(() => drawCampaignEnd(ctx, {
      won: false, missionsWon: 1, missionCount: 3, totalKills: 9,
      survivors: [], fallen: ['Lindqvist 2', 'Kowalski 2', 'Fontaine 2', 'Eriksen 2'],
    })));
  });

  it('the title screen, with the largest numbers and the confirmation text', () => {
    for (const armed of [false, true]) {
      check('title', collect(() => drawTitle(ctx, {
        missionNumber: 3, missionCount: 3, soldiers: 4, budget: 9999, armed,
      })));
    }
  });
});

describe('the layout checker itself', () => {
  const run = (text: string, x: number, y: number): TextRun => ({ text, x, y, colour: '#fff', align: 'left', width: text.length * 6 - 1 });

  it('catches text that runs off the canvas, text on top of other text, and unsupported characters', () => {
    expect(() => check('t', [run('HELLO', 470, 10)])).toThrow();
    expect(() => check('t', [run('HELLO', 10, 10), run('WORLD', 20, 12)])).toThrow();
    expect(() => check('t', [run('CAFÉ', 10, 10)])).toThrow();
    expect(() => check('t', [run('HELLO', 10, 10), run('WORLD', 10, 30)])).not.toThrow();
  });
});

describe('no leftover system fonts', () => {
  const sources = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

  it('finds the source files', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20);
  });

  it('no source file draws text with the system font or sets a font', () => {
    for (const [file, source] of Object.entries(sources)) {
      expect(source, file).not.toMatch(/\.fillText\(/);
      expect(source, file).not.toMatch(/monospace/);
    }
  });
});
