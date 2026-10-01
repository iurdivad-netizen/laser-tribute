# Laser Tribute

A turn-based squad tactics game in the spirit of Laser Squad and X-COM, running in the browser.

## Play

    npm install
    npm run dev

Open the printed local address.

## Controls

| Input | Action |
|---|---|
| Click soldier, keys 1 to 4, Tab | Select a soldier |
| Click floor | Move (hover shows the AP cost) |
| S / A, then click an enemy | Snap shot / aimed shot |
| T, then click a tile | Throw a grenade |
| D, then click a door | Open or close a door |
| P | Pick up the item underfoot |
| Q / E | Turn left / right |
| Space or Enter | End turn |
| Esc or right-click | Cancel |

## Develop

    npm test            run the rules tests
    npm run typecheck   TypeScript strict check
    npm run build       static site in dist/

Game rules live in `src/core` and know nothing about the browser. See `docs/superpowers/` for the design spec and the implementation plan.
