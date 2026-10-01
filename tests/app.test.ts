import { describe, expect, it } from 'vitest';
import { App, type AppOptions } from '../src/app';
import type { GameState } from '../src/core/types';
import { corridorRows, makeState, unit } from './helpers';

const START = { x: 240, y: 315 }; // Start mission button
const AGAIN = { x: 240, y: 213 }; // Play again button

/** A tiny winnable map: no enemies, so the first command ends the mission as a win. */
const winTiny = (): GameState => makeState(corridorRows('P..'));

/** A tiny lost map: the only soldier is dead and it is the enemy's turn. */
const loseTiny = (): GameState => {
  const s = makeState(corridorRows('P..E'));
  unit(s, 'p1').alive = false;
  s.turn = 'enemy';
  return s;
};

/** An App with a clock the test controls, so post-switch input locks can be waited out. */
function make(opts: AppOptions = {}) {
  let t = 0;
  const app = new App({ clock: () => t, ...opts });
  return { app, wait: () => { t += 500; } };
}

function finish(app: App, t: number): void {
  app.controller!.key('e'); // winTiny: a Turn command ends the mission as a win
  app.update(t); // starts the end-of-mission delay
}

describe('App flow', () => {
  it('opens on the equipment screen with the default loadout', () => {
    const app = new App();
    expect(app.screen).toBe('equipment');
    expect(app.loadout.map((s) => s.weapon)).toEqual(['rifle', 'rifle', 'pistol', 'pistol']);
    expect(app.controller).toBeNull();
  });

  it('starts a mission with the chosen loadout', () => {
    const app = new App();
    app.click({ x: 100, y: 172 }); // weapon button of P3: pistol to rifle
    expect(app.loadout[2].weapon).toBe('rifle');
    app.click(START);
    expect(app.screen).toBe('mission');
    expect(unit(app.controller!.state, 'p3').weapon).toBe('rifle');
    expect(unit(app.controller!.state, 'p4').weapon).toBe('pistol');
  });

  it('Enter starts the mission from the equipment screen', () => {
    const app = new App();
    expect(app.key('Enter')).toBe(true);
    expect(app.screen).toBe('mission');
  });

  it('a blocked equipment click changes nothing', () => {
    const app = new App();
    app.click({ x: 100, y: 172 }); // P3 to rifle: credits 117
    const before = app.loadout;
    app.click({ x: 100, y: 224 }); // P4 to rifle needs 12 more credits
    expect(app.loadout).toBe(before);
  });

  it('shows the result a second after the mission ends', () => {
    const app = new App({ createMission: winTiny });
    app.click(START);
    finish(app, 1000);
    expect(app.controller!.state.status).toBe('won');
    app.update(1500);
    expect(app.screen).toBe('mission'); // still within the delay
    app.update(2100);
    expect(app.screen).toBe('result');
    expect(app.result).toMatchObject({ won: true, survivors: 1, squadSize: 1 });
  });

  it('waits until the controller is idle before showing the result', () => {
    const app = new App({ createMission: winTiny });
    app.click(START);
    finish(app, 1000);
    app.controller!.ui.busy = true;
    app.update(9000);
    expect(app.screen).toBe('mission');
    app.controller!.ui.busy = false;
    app.update(9100);
    expect(app.screen).toBe('result');
  });

  it('reports a lost mission through the same flow', () => {
    const app = new App({ createMission: loseTiny });
    app.click(START);
    app.controller!.run({ type: 'Turn', unitId: 'e1', facing: 6 });
    app.update(1000);
    app.update(2100);
    expect(app.screen).toBe('result');
    expect(app.result).toMatchObject({ won: false, survivors: 0 });
  });

  it('Play again returns to equipment with the default loadout', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click({ x: 100, y: 172 }); // change P3 so a reset is visible
    app.click(START);
    finish(app, 1000);
    app.update(2100);
    wait();
    app.click(AGAIN);
    expect(app.screen).toBe('equipment');
    expect(app.loadout[2].weapon).toBe('pistol');
    expect(app.controller).toBeNull();
    expect(app.result).toBeNull();
  });

  it('Enter on the result screen plays again', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click(START);
    finish(app, 1000);
    app.update(2100);
    wait();
    expect(app.key('Enter')).toBe(true);
    expect(app.screen).toBe('equipment');
  });

  it('gives every run a fresh state and a new seed', () => {
    const seeds = [111, 222, 333];
    const { app, wait } = make({
      newSeed: () => seeds.shift()!,
      createMission: (seed) => {
        const s = winTiny();
        s.rngState = seed;
        return s;
      },
    });
    app.click(START);
    const first = app.controller!.state;
    expect(first.rngState).toBe(111);
    finish(app, 1000);
    app.update(2100);
    wait();
    app.click(AGAIN);
    wait();
    app.click(START);
    expect(app.controller!.state.rngState).toBe(222);
    expect(app.controller!.state).not.toBe(first);
    expect(app.controller!.state.status).toBe('playing');
  });
});

describe('input routing', () => {
  it('ignores keys and clicks meant for the hidden mission while the result is showing', () => {
    const app = new App({ createMission: winTiny });
    app.click(START);
    finish(app, 1000);
    app.update(2100);
    const state = app.controller!.state;
    expect(app.key(' ')).toBe(false);
    expect(app.key('e')).toBe(false);
    app.click({ x: 40, y: 40 }); // a map tile under the card
    app.move({ x: 40, y: 40 });
    app.cancel();
    expect(app.controller!.state).toBe(state);
    expect(app.screen).toBe('result');
  });

  it('does not send equipment clicks to a running mission', () => {
    const { app, wait } = make();
    app.click(START);
    wait();
    const before = app.loadout;
    app.click({ x: 100, y: 172 }); // same pixels as P3's weapon button
    expect(app.loadout).toBe(before);
  });

  it('does not start a mission from the result or mission screens', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click(START);
    wait();
    const controller = app.controller;
    app.click(START); // pixels of the Start button, but a mission is showing
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
    app.click({ x: 200, y: 301 }); // once the guard has expired, clicks work again
    expect(app.controller!.ui.busy).toBe(true);
  });

  it('ignores a click right after Play again so it cannot change the new loadout', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click(START);
    finish(app, 1000);
    app.update(2100);
    wait();
    app.click(AGAIN);
    expect(app.screen).toBe('equipment');
    app.click({ x: 260, y: 224 }); // P4 grenade minus, overlapping the Play again button
    expect(app.loadout[3].grenades).toBe(1);
    wait();
    app.click({ x: 260, y: 224 });
    expect(app.loadout[3].grenades).toBe(0);
  });

  it('does not chain Enter through screens, whether repeated or pressed twice quickly', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click(START);
    finish(app, 1000);
    app.update(2100);
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
