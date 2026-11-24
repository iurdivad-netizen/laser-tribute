import type { PlanetArtId } from '../screens/planetart';

/** Hands out the painted planet images once they have decoded; until then, `null`. */
export interface PlanetArt {
  image(id: PlanetArtId): CanvasImageSource | null;
}

interface Loadable {
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  complete: boolean;
  naturalWidth: number;
}

export const NO_ART: PlanetArt = { image: () => null };

const defaultMake = (): Loadable | null => (typeof Image === 'undefined' ? null : (new Image() as unknown as Loadable));

/**
 * Decodes each image on first request. `onLoad` fires once per image that finishes, so the screen can redraw.
 * A failed decode stays null and is not retried; without `Image` (node tests) nothing loads.
 */
export function createPlanetArt(
  data: Partial<Record<PlanetArtId, string>>,
  onLoad: () => void,
  make: () => Loadable | null = defaultMake,
): PlanetArt {
  const images = new Map<PlanetArtId, Loadable | null>();
  const load = (id: PlanetArtId): Loadable | null => {
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
  for (const id of Object.keys(data) as PlanetArtId[]) load(id);
  return {
    image(id) {
      const img = load(id);
      return img && img.complete && img.naturalWidth > 0 ? (img as unknown as CanvasImageSource) : null;
    },
  };
}
