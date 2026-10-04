import { describe, expect, it } from 'vitest';
import type { SoundName } from '../src/audio/effects';
import type { SoundPlayer } from '../src/audio/sound';
import { App, type AppOptions } from '../src/app';
import type { GameState } from '../src/core/types';
import { createUiState } from '../src/input/uiState';
import { drawPanel } from '../src/render/panel';
import { textWidth } from '../src/ui/font';
import { onText } from '../src/ui/text';
import { corridorRows, makeState } from './helpers';

const START = { x: 240, y: 345 };
const CONTINUE = { x: 240, y: 235 };

class FakeSound implements SoundPlayer {
  played: SoundName[] = [];
  unlocks = 0;
  mutes = 0;
  deltas: number[] = [];
  muted = false;
  volume = 0.5;
  play(name: SoundName) { this.played.push(name); }
  unlock() { this.unlocks += 1; }
  toggleMute() { this.mutes += 1; return 'Sound off'; }
  changeVolume(d: number) { this.deltas.push(d); return 'Volume 60%'; }
}

const winTiny = (): GameState => makeState(corridorRows('P..'));

function make(opts: AppOptions = {}) {
  let t = 0;
  const sound = new FakeSound();
  const app = new App({ clock: () => t, sound, ...opts });
  return { app, sound, wait: () => { t += 500; } };
}

/** Records the text drawn through drawText while a canvas stand-in swallows the rest. Call stop() after drawing. */
function recorder() {
  const texts: { text: string; x: number }[] = [];
  const stop = onText((r) => texts.push({ text: r.text, x: r.x }));
  const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;
  return { ctx, texts, stop };
}

describe('unlocking audio', () => {
  it('the first click and the first key press unlock the audio', () => {
    const { app, sound } = make();
    app.click({ x: 5, y: 5 });
    expect(sound.unlocks).toBe(1);
    app.key('x');
    expect(sound.unlocks).toBe(2);
  });
});

describe('sound keys', () => {
  it('M toggles mute on the equipment screen and during a mission', () => {
    const { app, sound, wait } = make({ createMission: winTiny });
    expect(app.key('m')).toBe(true);
    expect(app.key('M')).toBe(true);
    expect(sound.mutes).toBe(2);
    app.click(START);
    wait();
    expect(app.screen).toBe('mission');
    expect(app.key('m')).toBe(true);
    expect(sound.mutes).toBe(3);
  });

  it('- lowers and = or + raises the volume by 0.1', () => {
    const { app, sound } = make();
    app.key('-');
    app.key('=');
    app.key('+');
    expect(sound.deltas).toEqual([-0.1, 0.1, 0.1]);
  });

  it('other keys still reach the controller: K enters stab mode', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click(START);
    wait();
    app.key('k');
    expect(app.controller!.ui.mode).toBe('stab');
  });

  it('shows the message for a moment on any screen', () => {
    const { app } = make();
    app.key('m');
    const { ctx, texts, stop } = recorder();
    app.draw(ctx, 0);
    stop();
    expect(texts.some((t) => t.text === 'Sound off')).toBe(true);
  });

  it('shows the key hint on the equipment screen but not during a mission', () => {
    const { app, wait } = make({ createMission: winTiny });
    let r = recorder();
    app.draw(r.ctx, 0);
    r.stop();
    expect(r.texts.some((t) => t.text.includes('M: sound on/off'))).toBe(true);
    app.click(START);
    wait();
    r = recorder();
    app.draw(r.ctx, 0);
    r.stop();
    expect(r.texts.some((t) => t.text.includes('M: sound on/off'))).toBe(false);
  });
});

describe('sound hint placement', () => {
  it('is shown on the equipment and end screens but not over the mission panel or the result card', () => {
    const { app } = make();
    const shown = (screen: 'equipment' | 'result' | 'end' | 'mission') => {
      app.screen = screen;
      const r = recorder();
      app.draw(r.ctx, 0);
      r.stop();
      return r.texts.some((t) => t.text.includes('M: sound on/off'));
    };
    expect(shown('equipment')).toBe(true);
    expect(shown('end')).toBe(true);
    expect(shown('result')).toBe(false);
  });
});

describe('interface clicks', () => {
  it('plays a click only when an equipment control changes the loadout', () => {
    const { app, sound, wait } = make();
    app.click({ x: 100, y: 172 }); // P3 pistol to rifle: allowed
    expect(sound.played).toEqual(['click']);
    wait();
    app.click({ x: 100, y: 224 }); // P4 pistol to rifle: blocked (not enough credits)
    expect(sound.played).toEqual(['click']);
    wait();
    app.click({ x: 5, y: 5 }); // empty space
    expect(sound.played).toEqual(['click']);
  });

  it('plays a click for Start and Continue (with the win jingle in between)', () => {
    const { app, sound, wait } = make({ createMission: winTiny });
    app.click(START);
    expect(sound.played).toEqual(['click']);
    app.controller!.key('e'); // end the turn: the tiny map has no enemies, so the mission is won
    app.update(1000);
    app.update(2100);
    wait();
    app.click(CONTINUE);
    expect(sound.played).toEqual(['click', 'win', 'click']); // Start, the win jingle when the mission ends, Continue
  });

  it('passes the sound player to the controller', () => {
    const { app, sound, wait } = make({ createMission: winTiny });
    app.click(START);
    wait();
    sound.played.length = 0;
    app.controller!.run({ type: 'Reload', unitId: 'p1' }); // rejected: the magazine is full
    expect(sound.played).toEqual(['error']);
  });
});

describe('panel hint', () => {
  it('shows the mute key and stays inside the left well', () => {
    const s = makeState(corridorRows('P..E'));
    const ui = createUiState('p1');
    const { ctx, texts, stop } = recorder();
    drawPanel(ctx, s, ui, 0);
    stop();
    const hint = texts.find((t) => t.text.includes('M MUTE'))!;
    expect(hint).toBeDefined();
    expect(hint.x + textWidth(hint.text)).toBeLessThanOrEqual(148);
  });
});
