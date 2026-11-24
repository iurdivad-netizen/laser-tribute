import { describe, expect, it } from 'vitest';
import { MOODS, MoodTracker, type Mood } from '../src/audio/music';
import { moodFor } from '../src/audio/moodfor';

const story = { active: true, fight: false };
const none = { active: false, fight: false };

describe('moodFor in a story', () => {
  it('gives the planet theme to the map, and the base theme to the base side', () => {
    for (const screen of ['difficulty', 'planet']) expect(moodFor(screen, story, 'calm', 'calm'), screen).toBe('planet');
    for (const screen of ['base', 'panel', 'squad']) expect(moodFor(screen, story, 'calm', 'calm'), screen).toBe('base');
  });

  it('keeps the title on action and the missions on the tracker', () => {
    expect(moodFor('title', story, 'calm', 'calm')).toBe('action');
    for (const tracked of ['calm', 'action'] as const) {
      for (const screen of ['mission', 'result']) expect(moodFor(screen, story, tracked, 'planet'), screen).toBe(tracked);
    }
  });

  it('prepares a story fight with the base theme, other equipment screens follow the tracker', () => {
    expect(moodFor('equipment', { active: true, fight: true }, 'calm', 'planet')).toBe('base');
    expect(moodFor('equipment', story, 'calm', 'planet')).toBe('calm');
    expect(moodFor('equipment', story, 'action', 'planet')).toBe('action');
  });

  it('never changes the music for a scene', () => {
    for (const current of MOODS) for (const tracked of ['calm', 'action'] as const) {
      expect(moodFor('scene', story, tracked, current), `${current} ${tracked}`).toBe(current);
    }
  });

  it('ends the story on the planet theme', () => {
    expect(moodFor('end', story, 'calm', 'base')).toBe('planet');
  });

  it('follows the tracker for an unknown screen', () => {
    expect(moodFor('somewhere', story, 'action', 'calm')).toBe('action');
  });
});

describe('moodFor outside a story', () => {
  it('never gives the Tutorial or the Campaign the planet or base theme', () => {
    for (const screen of ['equipment', 'mission', 'result', 'end', 'scene']) {
      for (const tracked of ['calm', 'action'] as const) {
        const mood = moodFor(screen, none, tracked, tracked);
        expect(['planet', 'base'], `${screen} ${tracked}`).not.toContain(mood);
      }
    }
    expect(moodFor('end', none, 'calm', 'calm')).toBe('calm');
  });
});

describe('the moods', () => {
  it('are four, and the tracker still gives only calm or action', () => {
    expect([...MOODS]).toEqual(['calm', 'action', 'planet', 'base']);
    const t = new MoodTracker();
    const seen: Mood[] = [t.update(false, 0), t.update(true, 10), t.update(false, 20)];
    for (const m of seen) expect(['calm', 'action']).toContain(m);
  });
});
