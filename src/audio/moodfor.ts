import type { FightMood, Mood } from './music';

/** What the app knows about a story: whether one is on, and whether a fight of it is being prepared. */
export interface StoryState {
  active: boolean;
  fight: boolean;
}

/**
 * The music mood for a screen. The title keeps its driving beat; the story's map has the planet theme and its base side
 * the dark base theme; a scene never changes the music; missions and everything else follow the mood tracker.
 */
export function moodFor(screen: string, story: StoryState, tracked: FightMood, current: Mood): Mood {
  switch (screen) {
    case 'title':
      return 'action';
    case 'difficulty':
    case 'planet':
      return 'planet';
    case 'base':
    case 'panel':
    case 'squad':
      return 'base';
    case 'equipment':
      return story.fight ? 'base' : tracked;
    case 'scene':
      return current;
    case 'end':
      return story.active ? 'planet' : tracked;
    default:
      return tracked;
  }
}
