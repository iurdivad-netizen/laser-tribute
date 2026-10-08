# Laser Tribute Milestone 23: map themes

## Goal

Give each map type its own look by recolouring the existing floor, wall and door tiles with per-theme gradient maps. Five themes (Concrete, Timber, Steel, Cave, Stone) cover the ten campaign map types and the tutorial's three missions. The build pipeline, the generated image data, the saves and the core rules do not change.

Not in this milestone: autotiled walls (their own later milestone), new hand-drawn tile pieces (the override slot is ready for them), per-variation themes, themed items, corpses, soldiers or effects, anything in saves or core rules.

## Decisions (from the brainstorm)

- Themes are recoloured versions of the existing tiles (option A); more distinct hand-drawn pieces can come later through overrides.
- Autotiled walls are out of scope for now.
- Grouping: Concrete = Outpost, Compound; Timber = Warehouse, Village; Steel = Factory, Station; Cave = Mine, Bunker; Stone = Fortress, Citadel. The tutorial's missions (Outpost, Warehouse, Compound) follow the same table by name.
- Approach 1: recolour at runtime from a small theme table, cached; no change to the converter, the generated data or the drift tests.
- The recolouring is a gradient map, not hue and saturation factors, because the base floor is a near-grey that a saturation factor would leave grey.

## Constraints

- Only the six tile pieces are recoloured (`floor_a`, `floor_b`, `floor_c`, `wall`, `door_closed`, `door_open`). Items, corpses, soldiers and effect sprites are untouched, so units read the same on every map.
- `base` is the identity: it returns the original image objects.
- The recolouring is pure and cached per theme and image: a redraw costs nothing extra.
- A theme comes from the map type id, not from the save. Saves hold only the campaign and the loadout and do not change.
- No PixelLab generations are spent.
- Every existing test keeps passing without edits, except where they name the theme type.

## Themes

`ThemeId` becomes `'base' | 'timber' | 'steel' | 'cave' | 'stone'` (`base` is shown as Concrete).

```ts
interface Ramp { shadow: string; mid: string; light: string }   // hex colours
interface Theme {
  name: string;
  floor?: Ramp;        // absent: the piece is left as it is (base)
  wall?: Ramp;
  door?: Ramp;
  /** Replaces one role with a named image (no recolouring), for a hand-drawn piece. */
  overrides?: Partial<Record<'floorA' | 'floorB' | 'floorC' | 'wall' | 'doorClosed' | 'doorOpen', ImageName>>;
}
```

`THEMES: Record<ThemeId, Theme>`. The existing `Theme` shape in `src/art/theme.ts` (`floors`, `wall`, `doorClosed`, `doorOpen` image names) stays as the role-to-image table of a theme; the ramps and overrides sit beside it.

Proposed ramps (shadow, mid, light), tuned by eye in the dev gallery:

| Theme | Floor | Wall | Doors |
|---|---|---|---|
| Concrete (`base`) | as today | as today | as today |
| Timber | `#2a1c12` `#4a3322` `#6b4e33` | `#4a3a28` `#8a6a44` `#c7a066` | `#2e1410` `#6a2a1c` `#a8482c` |
| Steel | `#1c2430` `#2e3a4a` `#46566a` | `#33424f` `#6a7f94` `#aebdcb` | `#40220f` `#a65a1c` `#e08a30` |
| Cave | `#201a14` `#33291f` `#4a3c2c` | `#2e261e` `#5a4a38` `#8c7656` | `#2a1a0f` `#5c3a1c` `#8c5c2c` |
| Stone | `#33363c` `#4c5058` `#6a6f78` | `#5a5e66` `#9a9ea6` `#d4d6da` | `#2c1e16` `#6a4a2a` `#a87c44` |

## Recolouring

`recolour(fig: Figure, ramp: Ramp, name: string): Figure` in `src/art/recolour.ts` (pure):

1. For each opaque pixel compute its relative luminance `L` (sRGB, 0 to 1).
2. Find `lo` and `hi`, the least and greatest `L` among the image's opaque pixels. The normalised brightness is `t = (L - lo) / (hi - lo)`, and `t = 0.5` when `hi == lo` (a flat image).
3. Map `t` through the ramp: `t` in 0 to 0.5 blends `shadow` to `mid`, `t` in 0.5 to 1 blends `mid` to `light`, per channel in sRGB.
4. Transparent pixels stay null. The result has the same size and the given name.

`themeImage` (inside `tileImage`) keeps a `Map<string, Figure>` keyed by `theme/role-image-name`; the first call builds, later calls return the same object.

## Tile lookup

`tileImage(theme, kind, open, x, y)` keeps its signature and meaning. For the given theme it picks the role image name (as today: floor variant by position, wall, closed or open door), then returns the override image if the theme names one for that role, else the base image recoloured with the theme's ramp for that piece group (floor, wall or door), else the base image. An unknown theme id falls back to `base`.

## Choosing the theme

- `MAP_THEMES: Record<string, ThemeId>` in `src/art/theme.ts` keyed by map type id: `outpost`, `compound` to `base`; `warehouse`, `village` to `timber`; `factory`, `station` to `steel`; `mine`, `bunker` to `cave`; `fortress`, `citadel` to `stone`. `themeOfMap(id)` returns `base` for an unknown id.
- `GameState` gets `theme: ThemeId` (set to `base` by `parseMap`, so every test state is unchanged).
- `createMission(def, ...)` sets `state.theme = themeOfMap(def.id)`. The generated and the hand-drawn missions both carry their map type id in `def.id`; the plan checks that the generated ids are the recipe ids and adds the mapping if they are not.
- `themeFor(state)` returns `state.theme`.
- Saves, the mission records and the core rules do not read the field.

## Readability rules (tested for every theme)

- **Floors:** WCAG contrast between each floor piece and the squad body colour (`#174fa2`, the helmet shade) and the enemy body colour (`#852131`) stays at least 1.3 (the base floor's values today are the reference; the test records the minimum seen for `base` and requires every theme's minimum to be at least 80% of it).
- **Items:** the metal grey `#d0d0d0` against each floor stays at least 3.
- **Blood:** the pool colour `#b3262c` against each floor stays at least 1.6.
- **Wall against floor:** the mean luminance of the wall differs from the floor's by at least 0.04 in every theme.
- **Doors:** the mean door colour differs from the mean floor colour and from the mean wall colour by at least 0.04 in luminance or 40 degrees in hue.
- **Distinct themes:** the five themes' images differ pairwise on every piece group; `base` returns the original image objects.

## Dev gallery

The gallery shows, for each theme, its three floors, its wall and its two doors in a row, labelled, so the palettes can be judged and tuned by eye. The gallery test is updated for the new rows.

## Testing

- **Recolour:** exact at the stops (the darkest pixel maps to `shadow`, the lightest to `light`, a mid pixel to `mid`), keeps null pixels, a brighter source pixel never maps darker, a flat image maps to `mid`, same size and the given name, deterministic.
- **Lookup:** `base` returns the original objects (`tileImage('base', ...)` equals `imageOf(...)`); other themes return recoloured, cached, identical objects on repeat calls; overrides replace only their role; an unknown theme falls back to `base`; floor variants still follow `floorVariant(x, y)`.
- **Mapping:** every campaign map type id and the three tutorial ids resolve to the table's theme; an unknown id gives `base`; `createMission` sets `state.theme` for a hand-drawn and a generated mission.
- **Readability:** the rules above, for each theme.
- **Renderer:** a state with `theme: 'steel'` draws steel tile images; items, corpses and units are unchanged objects; the existing tile, fog and draw-order tests pass unchanged.
- **Whole game:** a look at all ten map types and the tutorial in the dev server (screenshots).

## Build order

1. `recolour` and the theme table with the ramps and the cached `tileImage`, with tests.
2. `GameState.theme`, `MAP_THEMES`, `themeOfMap`, `createMission` and `themeFor`, with tests.
3. The readability tests, the palettes tuned to pass them and to look right, the gallery rows.
4. A look at every map type in the game and the screenshot check.

Then one fresh review of the whole branch and one fix pass.

## Open for tuning after you have seen it

The exact ramp colours, which map types share a theme, and any piece that reads poorly (a theme can then override that piece with a drawn image).

## Later (not now)

Autotiled walls; hand-drawn pieces per theme through the override slot; per-variation themes; themed props.
