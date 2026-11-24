import type { PlanetArtId } from '../screens/planetart';

/** Hands out painted images once they have decoded; until then, `null`. */
export interface Art<Id extends string> {
  image(id: Id): CanvasImageSource | null;
}

export type PlanetArt = Art<PlanetArtId>;

interface Loadable {
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  complete: boolean;
  naturalWidth: number;
}

/** No art at all: every image is missing, so every screen draws its plain fallback. Fits any set of ids. */
export const NO_ART: Art<never> & { image(id: string): null } = { image: () => null };

const defaultMake = (): Loadable | null => (typeof Image === 'undefined' ? null : (new Image() as unknown as Loadable));

/**
 * Decodes each image on first request. `onLoad` fires once per image that finishes, so the screen can redraw.
 * A failed decode stays null and is not retried; without `Image` (node tests) nothing loads.
 */
export function createArt<Id extends string>(
  data: Partial<Record<Id, string>>,
  onLoad: () => void,
  make: () => Loadable | null = defaultMake,
): Art<Id> {
  const images = new Map<Id, Loadable | null>();
  const load = (id: Id): Loadable | null => {
    if (!images.has(id)) {
      const uri = data[id];
      const img = uri ? make() : null;
      if (img && uri) {
        img.onload = () => onLoad();
        img.onerror = () => undefined;
        img.src = uri;
      }
      images.set(id, img);
    }
    return images.get(id) ?? null;
  };
  // every image starts decoding now, so the first frame of the screen and a place changing hands never wait for one
  for (const id of Object.keys(data) as Id[]) load(id);
  return {
    image(id) {
      const img = load(id);
      return img && img.complete && img.naturalWidth > 0 ? (img as unknown as CanvasImageSource) : null;
    },
  };
}

/** The planet's painted images (see `createArt`). */
export const createPlanetArt = createArt<PlanetArtId>;
