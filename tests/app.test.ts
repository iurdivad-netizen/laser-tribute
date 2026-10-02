import { describe, expect, it } from 'vitest';
import { App, type AppOptions } from '../src/app';
import { campaignBudget } from '../src/core/campaign';
import { cheapLoadout, defaultLoadout, type Loadout } from '../src/core/loadout';
import type { GameState } from '../src/core/types';
import { corridorRows, makeState, unit } from './helpers';

const START = { x: 240, y: 315 }; // Start mission button
const CONTINUE = { x: 240, y: 213 }; // Continue button on the result screen
const NEW_CAMPAIGN = { x: 240, y: 252 }; // New campaign button on the end screen

/** A tiny winnable map: no enemies, so the first command ends the mission as a win. */
const winTiny = (): GameState => makeState(corridorRows('P..'));

/** Four soldiers, no enemies: the first command wins. p2 dead with 3 kills, p1 has 2 kills. */
const winWithCasualty = (): GameState => {
  const s = makeState(corridorRows('PPPP'));
  unit(s, 'p2').alive = false;
  unit(s, 'p2').kills = 3;
  unit(s, 'p1').kills = 2;
  return s;
};

/** All four soldiers dead on the enemy's turn: the first enemy command loses the mission. */
const loseAll = (): GameState => {
  const s = makeState(corridorRows('PPPPE'));
  for (const id of ['p1', 'p2', 'p3', 'p4']) unit(s, id).alive = false;
  s.turn = 'enemy';
  return s;
};

/** An App with a clock the test controls, so post-switch input locks can be waited out. */
function make(opts: AppOptions = {}) {
  let t = 0;
  const app = new App({ clock: () => t, ...opts });
  return { app, wait: () => { t += 500; } };
}

/** Ends a winTiny-style mission: a Turn command wins, then the delay elapses. */
function endWin(app: App, t: number): void {
  app.controller!.key('e');
  app.update(t);
  app.update(t + 1100);
}

/** Plays one winTiny mission and presses Continue. */
function playWin(app: App, wait: () => void, t: number): void {
  app.click(START);
  endWin(app, t);
  wait();
  app.click(CONTINUE);
  wait();
}

describe('App flow', () => {
  it('opens on the equipment screen for Mission 1 with the default loadout', () => {
    const app = new App();
    expect(app.screen).toBe('equipment');
    expect(app.campaign.missionIndex).toBe(0);
    expect(app.loadout).toEqual(defaultLoadout());
    expect(app.controller).toBeNull();
  });

  it('starts a mission with the chosen loadout and the roster names', () => {
    const app = new App();
    app.click({ x: 100, y: 172 }); // weapon button of the third soldier: pistol to rifle
    expect(app.loadout[2].weapon).toBe('rifle');
    app.click(START);
    expect(app.screen).toBe('mission');
    expect(unit(app.controller!.state, 'p3').weapon).toBe('rifle');
    expect(unit(app.controller!.state, 'p4').weapon).toBe('pistol');
    expect(unit(app.controller!.state, 'p1').name).toBe('Alvarez');
  });

  it('Enter starts the mission from the equipment screen', () => {
    const app = new App();
    expect(app.key('Enter')).toBe(true);
    expect(app.screen).toBe('mission');
  });

  it('a blocked equipment click changes nothing', () => {
    const app = new App();
    app.click({ x: 100, y: 172 }); // third soldier to rifle: credits 117
    const before = app.loadout;
    app.click({ x: 100, y: 224 }); // fourth soldier to rifle needs 12 more credits
    expect(app.loadout).toBe(before);
  });

  it('records the mission and shows the result a second after it ends', () => {
    const { app } = make({ createMission: winTiny });
    app.click(START);
    app.controller!.key('e');
    app.update(1000);
    expect(app.controller!.state.status).toBe('won');
    app.update(1500);
    expect(app.screen).toBe('mission'); // still within the delay
    app.update(2100);
    expect(app.screen).toBe('result');
    expect(app.result).toMatchObject({ won: true, survivors: 1, squadSize: 1 });
    expect(app.campaign).toMatchObject({ missionsWon: 1, missionIndex: 1, status: 'active' });
  });

  it('waits until the controller is idle before showing the result', () => {
    const { app } = make({ createMission: winTiny });
    app.click(START);
    app.controller!.key('e');
    app.update(1000);
    app.controller!.ui.busy = true;
    app.update(9000);
    expect(app.screen).toBe('mission');
    app.controller!.ui.busy = false;
    app.update(9100);
    expect(app.screen).toBe('result');
  });

  it('Continue after a win opens the next mission with a bigger budget and the same kit', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click({ x: 100, y: 172 }); // change the third soldier so the kept kit is visible
    app.click(START);
    endWin(app, 1000);
    wait();
    app.click(CONTINUE);
    expect(app.screen).toBe('equipment');
    expect(app.campaign.missionIndex).toBe(1);
    expect(campaignBudget(app.campaign)).toBe(140); // 120 + 20 for the win, no kills
    expect(app.loadout[2].weapon).toBe('rifle'); // the previous kit still fits
    expect(app.controller).toBeNull();
  });

  it('kills by living soldiers raise the next budget', () => {
    const { app, wait } = make({
      createMission: () => {
        const s = winTiny();
        unit(s, 'p1').kills = 2;
        return s;
      },
    });
    app.click(START);
    endWin(app, 1000);
    wait();
    app.click(CONTINUE);
    expect(campaignBudget(app.campaign)).toBe(150); // 120 + 20 + 2 * 5
  });

  it('replaces a fallen soldier with a rookie and his kills leave the budget', () => {
    const { app, wait } = make({ createMission: winWithCasualty });
    app.click(START);
    endWin(app, 1000);
    wait();
    app.click(CONTINUE);
    expect(app.campaign.fallen).toEqual([{ name: 'Brandt', kills: 3 }]);
    expect(app.campaign.roster[1]).toEqual({ name: 'Eriksen', kills: 0 });
    expect(campaignBudget(app.campaign)).toBe(150); // 120 + 20 + 2 kills by Alvarez; Brandt's 3 are gone
  });

  it('falls back to the cheap kit when the previous kit no longer fits the budget', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click(START);
    const bigKit: Loadout = Array.from({ length: 4 }, () => ({ weapon: 'rifle' as const, grenades: 3 }));
    app.loadout = bigKit; // 196, more than the next budget of 140
    endWin(app, 1000);
    wait();
    app.click(CONTINUE);
    expect(app.loadout).toEqual(cheapLoadout());
  });

  it('a lost mission ends the campaign: Continue shows the end screen, New campaign resets', () => {
    const { app, wait } = make({ createMission: loseAll });
    app.click({ x: 100, y: 172 });
    app.click(START);
    app.controller!.run({ type: 'Turn', unitId: 'e1', facing: 6 });
    app.update(1000);
    app.update(2100);
    expect(app.screen).toBe('result');
    expect(app.result).toMatchObject({ won: false, survivors: 0 });
    expect(app.campaign.status).toBe('lost');
    wait();
    app.click(CONTINUE);
    expect(app.screen).toBe('end');
    wait();
    app.click(NEW_CAMPAIGN);
    expect(app.screen).toBe('equipment');
    expect(app.campaign).toMatchObject({ missionIndex: 0, missionsWon: 0, status: 'active', fallen: [] });
    expect(app.loadout).toEqual(defaultLoadout());
  });

  it('winning the last mission shows Campaign complete, never a fourth mission', () => {
    const { app, wait } = make({ createMission: winTiny });
    playWin(app, wait, 1000);
    expect(app.screen).toBe('equipment');
    expect(app.campaign.missionIndex).toBe(1);
    playWin(app, wait, 10000);
    expect(app.campaign.missionIndex).toBe(2);
    app.click(START);
    endWin(app, 20000);
    expect(app.campaign).toMatchObject({ status: 'won', missionsWon: 3 });
    wait();
    app.click(CONTINUE);
    expect(app.screen).toBe('end');
    wait();
    app.key('Enter'); // New campaign
    expect(app.screen).toBe('equipment');
    expect(app.campaign.missionIndex).toBe(0);
  });

  it('gives every mission a fresh state and a new seed', () => {
    const seeds = [111, 222, 333];
    const { app, wait } = make({
      newSeed: () => seeds.shift()!,
      createMission: (_def, seed) => {
        const s = winTiny();
        s.rngState = seed;
        return s;
      },
    });
    app.click(START);
    const first = app.controller!.state;
    expect(first.rngState).toBe(111);
    endWin(app, 1000);
    wait();
    app.click(CONTINUE);
    wait();
    app.click(START);
    expect(app.controller!.state.rngState).toBe(222);
    expect(app.controller!.state).not.toBe(first);
    expect(app.controller!.state.status).toBe('playing');
  });
});

describe('input routing', () => {
  it('ignores mission keys and clicks while the result is showing', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click(START);
    endWin(app, 1000);
    wait(); // let the input guard expire so the clicks below really reach the result screen
    const state = app.controller!.state;
    expect(app.key(' ')).toBe(false);
    expect(app.key('e')).toBe(false);
    app.click({ x: 40, y: 40 });
    app.move({ x: 40, y: 40 });
    app.cancel();
    expect(app.controller!.state).toBe(state);
    expect(app.screen).toBe('result');
  });

  it('only Enter and the New campaign button act on the end screen', () => {
    const { app, wait } = make({ createMission: loseAll });
    app.click(START);
    app.controller!.run({ type: 'Turn', unitId: 'e1', facing: 6 });
    app.update(1000);
    app.update(2100);
    wait();
    app.click(CONTINUE);
    wait();
    expect(app.screen).toBe('end');
    expect(app.key(' ')).toBe(false);
    expect(app.key('e')).toBe(false);
    app.click({ x: 40, y: 40 });
    app.click(START); // the Start button pixels, but the end screen is showing
    expect(app.screen).toBe('end');
  });

  it('does not send equipment clicks to a running mission', () => {
    const { app, wait } = make();
    app.click(START);
    wait();
    const before = app.loadout;
    app.click({ x: 100, y: 172 });
    expect(app.loadout).toBe(before);
  });

  it('does not start a mission from the mission screen', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click(START);
    wait();
    const controller = app.controller;
    app.click(START);
    expect(app.controller).toBe(controller);
  });
});

describe('input guard after a screen switch', () => {
  it('ignores the second click of a double-click on Start instead of ordering a move', () => {
    const { app, wait } = make();
    app.click(START);
    const p1 = () => unit(app.controller!.state, 'p1').pos;
    const before = { ...p1() };
    app.click({ x: 200, y: 301 }); // top strip of the Start button is a map tile
    expect(p1()).toEqual(before);
    expect(app.controller!.ui.busy).toBe(false);
    wait();
    app.click({ x: 200, y: 301 });
    expect(app.controller!.ui.busy).toBe(true);
  });

  it('ignores a click right after Continue so it cannot change the new loadout', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click(START);
    endWin(app, 1000);
    wait();
    app.click(CONTINUE);
    expect(app.screen).toBe('equipment');
    app.click({ x: 260, y: 224 }); // fourth soldier's grenade minus, overlapping the Continue button
    expect(app.loadout[3].grenades).toBe(1);
    wait();
    app.click({ x: 260, y: 224 });
    expect(app.loadout[3].grenades).toBe(0);
  });

  it('does not chain Enter through screens, whether repeated or pressed twice quickly', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click(START);
    endWin(app, 1000);
    wait();
    app.key('Enter'); // Result to Equipment
    expect(app.screen).toBe('equipment');
    app.key('Enter', true); // key auto-repeat
    expect(app.screen).toBe('equipment');
    app.key('Enter'); // pressed again within the guard
    expect(app.screen).toBe('equipment');
    wait();
    app.key('Enter');
    expect(app.screen).toBe('mission');
  });

  it('ignores Enter auto-repeat on the equipment screen too', () => {
    const app = new App();
    app.key('Enter', true);
    expect(app.screen).toBe('equipment');
  });
});

describe('found gear carries to the next mission', () => {
  it('a found rifle lands in the stash and is passed to the next mission for free', () => {
    const stashes: unknown[] = [];
    const { app, wait } = make({
      createMission: (_def, _seed, _roster, _loadout, _budget, stash) => {
        stashes.push({ ...stash });
        const s = winTiny();
        unit(s, 'p1').weapon = 'rifle'; // the soldier picked up a rifle during the mission
        return s;
      },
    });
    app.click({ x: 100, y: 68 }); // P1 weapon button: rifle to pistol
    expect(app.loadout[0].weapon).toBe('pistol');
    app.click(START);
    endWin(app, 1000);
    expect(app.campaign.stash).toEqual({ rifle: 1, pistol: 0, grenade: 0 });
    wait();
    app.click(CONTINUE); // on to the next equipment screen
    expect(app.screen).toBe('equipment');
    wait();
    app.click(START);
    expect(stashes.at(-1)).toEqual({ rifle: 1, pistol: 0, grenade: 0 });
  });
});
