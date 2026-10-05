import { describe, expect, it } from 'vitest';
import { App, type AppOptions } from '../src/app';
import { campaignBudget } from '../src/core/campaign';
import { cheapLoadout, defaultLoadout, fitLoadout, validateLoadout, type Loadout } from '../src/core/loadout';
import { SAVE_KEY, SaveStore } from '../src/save';
import type { GameState } from '../src/core/types';
import { corridorRows, makeState, unit } from './helpers';

const START = { x: 240, y: 345 }; // Start mission button
const CONTINUE = { x: 240, y: 235 }; // Continue button on the result screen
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
    const bigKit: Loadout = Array.from({ length: 4 }, () => ({ weapon: 'rifle' as const, grenades: 3, clips: 1 }));
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
    app.click({ x: 200, y: 301 }); // a map tile (the Start button now sits below the map)
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
    app.click({ x: 270, y: 235 }); // fourth soldier's grenade minus, overlapping the Continue button
    expect(app.loadout[3].grenades).toBe(1);
    wait();
    app.click({ x: 270, y: 235 });
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
    expect(app.campaign.stash).toEqual({ rifle: 1, pistol: 0, grenade: 0, clip: 0 });
    wait();
    app.click(CONTINUE); // on to the next equipment screen
    expect(app.screen).toBe('equipment');
    wait();
    app.click(START);
    expect(stashes.at(-1)).toEqual({ rifle: 1, pistol: 0, grenade: 0, clip: 0 });
  });
});

describe('promotions after a mission', () => {
  it('announces a soldier whose kills reach a new rank', () => {
    const { app } = make({
      createMission: () => {
        const s = winTiny();
        unit(s, 'p1').kills = 2; // two kills this mission: Rookie to Private
        return s;
      },
    });
    app.click(START);
    endWin(app, 1000);
    expect(app.screen).toBe('result');
    expect(app.promoted).toEqual(['Alvarez (Private)']);
  });

  it('announces nothing for a soldier who died, who is replaced by a Rookie', () => {
    const { app } = make({
      createMission: () => {
        const s = winTiny();
        unit(s, 'p1').kills = 9;
        unit(s, 'p1').alive = false;
        return s;
      },
    });
    app.click(START);
    endWin(app, 1000);
    expect(app.promoted).toEqual([]);
    expect(app.campaign.roster[0].kills).toBe(0); // the replacement rookie
  });

  it('a later mission without promotions clears the list', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click(START);
    endWin(app, 1000);
    expect(app.promoted).toEqual([]);
    wait();
    app.click(CONTINUE);
    expect(app.promoted).toEqual([]);
  });
});

describe('loot after a mission', () => {
  it('a won mission puts the killed enemies weapons in the stash and shows them on the result card', () => {
    const { app } = make({
      createMission: () => {
        const s = makeState(corridorRows('PE'));
        unit(s, 'e1').alive = false; // killed: a rifle and a spare clip
        return s;
      },
    });
    app.click(START);
    endWin(app, 1000);
    expect(app.screen).toBe('result');
    expect(app.campaign.stash).toMatchObject({ rifle: 1, clip: 1 });
    expect(app.loot).toBe('1 rifle, 1 clip');
  });

  it('says when the stash was already full and some loot was left behind', () => {
    const { app } = make({
      createMission: () => {
        const s = makeState(corridorRows('PE'));
        unit(s, 'e1').alive = false;
        return s;
      },
    });
    app.campaign.stash = { rifle: 4, pistol: 0, grenade: 0, clip: 4 };
    app.click(START);
    endWin(app, 1000);
    expect(app.loot).toBe('1 rifle, 1 clip (stash full)');
  });

  it('a lost mission shows no loot', () => {
    const { app } = make({ createMission: loseAll });
    app.click(START);
    app.controller!.run({ type: 'Turn', unitId: 'e1', facing: 6 });
    app.update(1000);
    app.update(2100);
    expect(app.loot).toBe('');
  });
});

const CONTINUE_T = { x: 240, y: 174 }; // CONTINUE on the title screen
const NEW_T = { x: 240, y: 214 }; // NEW CAMPAIGN on the title screen

function memoryStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(SAVE_KEY, initial);
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

describe('App saving and loading', () => {
  const store = (mem = memoryStorage()) => ({ mem, store: new SaveStore(mem, 3) });

  /** A storage holding the save left by one won mission, plus a fresh App started over it. */
  function reopened() {
    const { mem, store: s } = store();
    const first = make({ store: s, createMission: winTiny });
    playWin(first.app, first.wait, 0);
    return { mem, ...make({ store: new SaveStore(mem, 3) }) };
  }

  it('opens on the equipment screen when there is no save', () => {
    const { app } = make({ store: store().store });
    expect(app.screen).toBe('equipment');
  });

  it('autosaves after a won mission, and a fresh App over the same storage opens on the title with that campaign', () => {
    const { mem, store: s } = store();
    const { app } = make({ store: s, createMission: winWithCasualty });
    app.click(START);
    endWin(app, 0);
    expect(mem.data.has(SAVE_KEY)).toBe(true);
    const reloaded = new App({ store: new SaveStore(mem, 3) });
    expect(reloaded.screen).toBe('title');
    expect(reloaded.campaign).toEqual(app.campaign);
    expect(reloaded.loadout).toEqual(fitLoadout(app.loadout, campaignBudget(app.campaign), app.campaign.stash));
  });

  it('CONTINUE opens the saved equipment screen, by click and by Enter', () => {
    for (const how of ['click', 'enter']) {
      const { app, wait } = reopened();
      expect(app.screen).toBe('title');
      wait();
      if (how === 'click') app.click(CONTINUE_T); else app.key('Enter');
      expect(app.screen).toBe('equipment');
      expect(app.campaign.missionIndex).toBe(1);
      expect(validateLoadout(app.loadout, campaignBudget(app.campaign), app.campaign.stash)).toBeNull();
    }
  });

  it('NEW CAMPAIGN needs a second press, then clears the save and starts fresh', () => {
    const { mem, app, wait } = reopened();
    wait();
    app.click(NEW_T);
    expect(app.screen).toBe('title');
    expect(mem.data.has(SAVE_KEY)).toBe(true);
    wait();
    app.click(NEW_T);
    expect(app.screen).toBe('equipment');
    expect(app.campaign.missionIndex).toBe(0);
    expect(mem.data.has(SAVE_KEY)).toBe(false);
  });

  it('the N key works the same way, and the first press arms without clearing', () => {
    const { mem, app, wait } = reopened();
    wait();
    app.key('n');
    expect(app.screen).toBe('title');
    expect(mem.data.has(SAVE_KEY)).toBe(true);
    wait();
    app.key('N');
    expect(app.screen).toBe('equipment');
    expect(mem.data.has(SAVE_KEY)).toBe(false);
  });

  it('the confirmation lapses after 3 seconds', () => {
    const { mem, app, wait } = reopened();
    wait();
    app.click(NEW_T);
    for (let i = 0; i < 7; i++) wait(); // 3.5 s
    app.click(NEW_T);
    expect(app.screen).toBe('title');
    expect(mem.data.has(SAVE_KEY)).toBe(true);
  });

  it('a held N or a double click cannot wipe the save', () => {
    const held = reopened();
    held.wait();
    held.app.key('n');
    held.app.key('n', true); // keyboard auto-repeat
    held.app.key('n', true);
    expect(held.app.screen).toBe('title');
    expect(held.mem.data.has(SAVE_KEY)).toBe(true);

    const dbl = reopened();
    dbl.wait();
    dbl.app.click(NEW_T);
    dbl.app.click(NEW_T); // the second click of a double click, a few ms later
    expect(dbl.app.screen).toBe('title');
    expect(dbl.mem.data.has(SAVE_KEY)).toBe(true);
  });

  it('a held Enter does not chain from the title into the mission', () => {
    const { app, wait } = reopened();
    wait();
    app.key('Enter', true);
    expect(app.screen).toBe('title');
  });

  it('clears the save when the campaign is won or lost', () => {
    const won = store();
    const a = make({ store: won.store, createMission: winTiny });
    playWin(a.app, a.wait, 0);
    playWin(a.app, a.wait, 10_000);
    expect(won.mem.data.has(SAVE_KEY)).toBe(true);
    a.app.click(START);
    endWin(a.app, 20_000);
    expect(a.app.campaign.status).toBe('won');
    expect(won.mem.data.has(SAVE_KEY)).toBe(false);

    const lost = store();
    let n = 0;
    const b = make({ store: lost.store, createMission: () => (n++ === 0 ? winTiny() : loseAll()) });
    playWin(b.app, b.wait, 0);
    expect(lost.mem.data.has(SAVE_KEY)).toBe(true); // a save exists before the loss
    b.app.click(START);
    b.app.controller!.run({ type: 'Turn', unitId: 'e1', facing: 6 });
    b.app.update(20_000);
    b.app.update(21_100);
    expect(b.app.campaign.status).toBe('lost');
    expect(lost.mem.data.has(SAVE_KEY)).toBe(false);
  });

  it('ignores a bad save, leaves it in place, and opens on equipment', () => {
    const mem = memoryStorage('{"version":1,"campaign":{"status":"active"}}');
    const { app } = make({ store: new SaveStore(mem, 3) });
    expect(app.screen).toBe('equipment');
    expect(mem.data.size).toBe(1);
  });

  it('fits a saved loadout that no longer fits the budget', () => {
    const { mem, store: s } = store();
    const first = make({ store: s, createMission: winTiny });
    playWin(first.app, first.wait, 0);
    const o = JSON.parse(mem.data.get(SAVE_KEY)!);
    o.loadout = o.loadout.map(() => ({ weapon: 'rifle', grenades: 3, clips: 4 })); // far over budget
    o.campaign.stash = { rifle: 0, pistol: 0, grenade: 0, clip: 0 };
    mem.data.set(SAVE_KEY, JSON.stringify(o));
    const { app } = make({ store: new SaveStore(mem, 3) });
    expect(validateLoadout(app.loadout, campaignBudget(app.campaign), app.campaign.stash)).toBeNull();
  });

  it('plays on when storage throws on every call', () => {
    const broken = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('denied'); },
    };
    const { app, wait } = make({ store: new SaveStore(broken, 3), createMission: winTiny });
    expect(app.screen).toBe('equipment');
    playWin(app, wait, 0);
    expect(app.screen).toBe('equipment');
    expect(app.campaign.missionIndex).toBe(1);
  });

  it('draws the title screen without error', () => {
    const { app } = reopened();
    const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;
    expect(app.screen).toBe('title');
    expect(() => app.draw(ctx, 0)).not.toThrow();
  });
});
