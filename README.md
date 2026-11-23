# Laser Tribute

A turn-based squad tactics game in the spirit of Laser Squad and X-COM, running in the browser.

## Play

Online: https://iurdivad-netizen.github.io/laser-tribute/ (deployed from `master` by GitHub Actions).

Locally:

    npm install
    npm run dev

Open the printed local address, or double-click `play.bat` on Windows.

There are two modes. The **Tutorial** is three hand-drawn missions (Outpost, Warehouse, Compound) with the starting kit. The **Campaign** is ten generated missions (Outpost to Citadel, five variations of each map type, getting bigger and harder from 4 to 12 enemies) with a persistent squad. On the title screen press N for a new campaign, T for the tutorial, or Enter to continue a saved game.

Before each mission you equip four named soldiers from a shared budget and press Start (or Enter). The budget starts at 120 and grows with each won mission (+20) and with each kill by soldiers who are still alive (+5), so protect your veterans. A soldier who dies is gone for good and replaced by a rookie. After each mission a result screen shows how it went; Continue (or Enter) moves on. Win every mission for Campaign complete; if all four soldiers die the campaign is lost. Progress is saved automatically between missions.

## Gear

Better gear unlocks as the campaign advances (the tutorial offers only the first kit).

| Weapon | Price | Unlocks at mission | Notes |
|---|---|---|---|
| Pistol | 10 | 1 | 8-round magazine |
| Rifle | 25 | 1 | 5 rounds, long range |
| Shotgun | 22 | 2 | heavy damage, falls off fast with distance |
| SMG | 28 | 4 | 3-round bursts |
| Sniper | 40 | 6 | very long range and sight, weak up close |

Throwables (up to 3 per soldier, one kind each): Frag (mission 1, breaks doors), Smoke (2, blocks sight for 3 turns), Flashbang (4, drains the AP of everyone in the blast), Incendiary (6, burns for 3 turns). Gadgets: Medkit (heals 25), Armour (-30% damage), Scanner (reveals nearby enemies), plus a Scope attachment. Spare clips cost 5 each (up to 4); every soldier starts with one included. Guns hold a limited magazine: reload with R (15 AP, uses a clip). Enemies follow the same rules and carry weapons from the unlocked list.

## Controls

| Input | Action |
|---|---|
| Click soldier, keys 1 to 4, Tab | Select a soldier |
| Click floor | Move (hover shows the AP cost) |
| S / A, then click an enemy | Snap shot / aimed shot (each visible enemy in reach shows its hit chance) |
| T, then click a tile | Throw a grenade |
| K, then click an adjacent enemy | Stab with the combat knife (20 AP, very high damage) |
| D, then click a door | Open or close a door |
| G | Use the gadget (medkit, scanner) |
| P | Pick up the item underfoot |
| R | Reload the selected soldier |
| L | Alert: keep the soldier's AP and fire once at each enemy that moves into view |
| Q / E, F | Turn left / right, face a clicked direction |
| I | Soldier card |
| Z | Zoom |
| M, - and = | Mute, volume down, volume up |
| Space or Enter | End turn |
| Esc or right-click | Cancel |

Every action button shows its AP cost. Found weapons and grenades from a won mission go into a squad stash that makes the same gear free on the next equipment screens, and so does loot from killed enemies (their weapons and spare clips; the stash keeps at most 4 weapons and 4 clips). Each soldier's row shows the net price after the stash. On touch screens the same actions are on-screen buttons, and the menus accept taps slightly beside small buttons.

## Enemy roles

From campaign mission 3 some enemies have a role, shown by a coloured pip over the figure. The **officer** (gold) gives every enemy within 6 tiles +10% accuracy, so kill him first. The **rusher** (orange, from mission 4) carries an SMG, hunts the squad through doors from any distance and never falls back. The **flanker** (purple, from mission 5) heads for the far side of the squad and does not stop to trade shots until you are close, so watch your back. The **sniper** (cyan, from mission 6) holds his post with a sniper rifle and long sight, so approach him with care or smoke. Everyone else is a plain rifleman.

## Ranks

Soldiers are promoted by their own kills, which persist through the campaign: Private at 2 kills (+10 HP, +4 AP, +4% accuracy), Sergeant at 5 (+20 HP, +8 AP, +8%), Captain at 9 (+30 HP, +12 AP, +12%). Soldier accuracy adds to the weapon's accuracy (capped at 95%) and also improves the knife. The result screen announces promotions.

## Graphics

All art is 16x16 pixel tiles on a 480x400 canvas. Soldiers are PixelLab-generated sprites; maps have five themes (base, timber, steel, cave, stone) with props and floor decals, and the title screen, frames and item icons are drawn in code (`src/art`, `src/ui`, `src/screens`). The interface uses a 5x7 pixel font. In dev mode (`npm run dev`) type `gallery()` in the browser console to see every sprite enlarged.

## Sound

Everything is generated in the browser (no sound files). Effects: shots, hits, stabs, grenades, doors, deaths, reloads, footsteps and a mission-end jingle; gunfire, explosions, doors and deaths you cannot see are heard quietly. The soundtrack is a calm mystery theme that turns into a driving action beat while an enemy is in sight, and the title screen plays the action theme. Browsers only allow sound after a click or key press. Mute and volume are remembered between visits.

## Develop

    npm test            run the rules tests
    npm run typecheck   TypeScript strict check
    npm run build       static site in dist/

Game rules live in `src/core` and know nothing about the browser. See `docs/superpowers/` for the design spec and the implementation plan.
