# Laser Tribute

A turn-based squad tactics game in the spirit of Laser Squad and X-COM, running in the browser.

## Play

Online: https://iurdivad-netizen.github.io/laser-tribute/ (deployed from `master` by GitHub Actions).

Locally:

    npm install
    npm run dev

Open the printed local address, or double-click `play.bat` on Windows.

The game is a three-mission campaign with a persistent squad. Before each mission you equip four named soldiers from a shared budget (pistol 10, rifle 25, grenade 8, up to 3 grenades each, extra spare clips 5 each up to 4) and press Start (or Enter). The budget starts at 120 and grows with each won mission (+20) and with each kill by soldiers who are still alive (+5), so protect your veterans. A soldier who dies is gone for good and replaced by a rookie. After each mission a result screen shows how it went; Continue (or Enter) moves on. Guns hold a limited magazine (pistol 8 rounds, rifle 5): reload with R, which costs 15 AP and uses a spare clip. Every soldier starts with one spare clip included in the weapon price. Enemies follow the same rules. Win all three missions for Campaign complete; if all four soldiers die the campaign is lost, and New campaign starts again.

## Controls

| Input | Action |
|---|---|
| Click soldier, keys 1 to 4, Tab | Select a soldier |
| Click floor | Move (hover shows the AP cost) |
| S / A, then click an enemy | Snap shot / aimed shot |
| T, then click a tile | Throw a grenade |
| K, then click an adjacent enemy | Stab with the combat knife (every soldier has one; 20 AP, very high damage) |
| D, then click a door | Open or close a door |
| P | Pick up the item underfoot |
| R | Reload the selected soldier (15 AP, uses a spare clip) |
| L | Alert: keep the soldier's AP and fire once at each enemy that moves into his view |
| Q / E | Turn left / right |
| Space or Enter | End turn |
| Esc or right-click | Cancel |

Every action button shows its AP cost. Found weapons and grenades from a won mission go into a squad stash that makes the same gear free on the next equipment screens.

## Ranks

Soldiers are promoted by their own kills, which persist through the campaign: Private at 2 kills (+10 HP, +4 AP, +4% accuracy), Sergeant at 5 (+20 HP, +8 AP, +8%), Captain at 9 (+30 HP, +12 AP, +12%). Soldier accuracy adds to the weapon's accuracy (capped at 95%) and also improves the knife. The result screen announces promotions.

## Develop

    npm test            run the rules tests
    npm run typecheck   TypeScript strict check
    npm run build       static site in dist/

Game rules live in `src/core` and know nothing about the browser. See `docs/superpowers/` for the design spec and the implementation plan.
