import { describe, expect, it } from 'vitest';
import { GestureRecognizer, type GestureHandlers } from '../src/input/gestures';

function setup() {
  const log: string[] = [];
  const handlers: GestureHandlers = {
    tap: (p, k) => log.push(`tap ${p.x},${p.y} ${k}`),
    drag: (dx, dy) => log.push(`drag ${dx},${dy}`),
    longPress: (p) => log.push(`long ${p.x},${p.y}`),
  };
  return { g: new GestureRecognizer(handlers), log };
}

describe('GestureRecognizer', () => {
  it('a short press without movement is a tap at the release position', () => {
    const { g, log } = setup();
    g.down(100, 200, 'touch', 0);
    g.up(103, 202, 120);
    expect(log).toEqual(['tap 103,202 touch']);
  });

  it('moving beyond the touch slop is a drag and fires no tap', () => {
    const { g, log } = setup();
    g.down(100, 100, 'touch', 0);
    g.move(105, 100, 20); // inside the slop: nothing yet
    expect(log).toEqual([]);
    g.move(130, 100, 40); // outside: the first drag includes the movement since the press
    g.move(140, 110, 60);
    g.up(140, 110, 80);
    expect(log).toEqual(['drag 30,0', 'drag 10,10']);
  });

  it('the mouse slop is smaller than the touch slop', () => {
    const touch = setup();
    touch.g.down(0, 0, 'touch', 0);
    touch.g.move(7, 0, 10);
    touch.g.up(7, 0, 20);
    expect(touch.log).toEqual(['tap 7,0 touch']);
    const mouse = setup();
    mouse.g.down(0, 0, 'mouse', 0);
    mouse.g.move(7, 0, 10);
    mouse.g.up(7, 0, 20);
    expect(mouse.log[0]).toBe('drag 7,0');
  });

  it('holding still fires one long press and then no tap on release', () => {
    const { g, log } = setup();
    g.down(50, 60, 'touch', 0);
    g.tick(300);
    expect(log).toEqual([]);
    g.tick(520);
    g.tick(900);
    g.up(50, 60, 950);
    expect(log).toEqual(['long 50,60']);
  });

  it('a long press is not fired once the finger has moved into a drag', () => {
    const { g, log } = setup();
    g.down(0, 0, 'touch', 0);
    g.move(40, 0, 100);
    g.tick(800);
    g.up(40, 0, 900);
    expect(log).toEqual(['drag 40,0']);
  });

  it('a press held longer than the long-press time but released without a tick is still not a tap', () => {
    const { g, log } = setup();
    g.down(5, 5, 'touch', 0);
    g.up(5, 5, 800);
    expect(log).toEqual(['long 5,5']);
  });

  it('cancel resets without events, and a second press replaces the first', () => {
    const { g, log } = setup();
    g.down(0, 0, 'touch', 0);
    g.cancel();
    g.up(0, 0, 50);
    expect(log).toEqual([]);
    g.down(0, 0, 'touch', 100);
    g.down(9, 9, 'touch', 110);
    g.up(9, 9, 150);
    expect(log).toEqual(['tap 9,9 touch']);
  });
});
