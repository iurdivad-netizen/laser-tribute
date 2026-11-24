# Research upgrade info cards — design

Small change, approved in conversation 2026-11-24.

## Intent
A Lab upgrade row (Barracks I-III, Labs I-II, Supply contracts I-III, Field hospital I-II, Training facility I-III: the 13 nodes whose `gives` is a base level) does nothing when its name is tapped. The building INFO screen explains buildings in general, not what one upgrade buys. Players should see what an upgrade does before spending credits.

## Design
- `nodeCard(nodeId, w): ItemCard | null` in `src/core/world/iteminfo.ts` (same `ItemCard` shape, so `drawItemCard` and ITEM_CARD are reused). Null for gear nodes and unknown ids.
- Rows (all values from `NODES` / `BASE_RULES` / `levelsOf`, never literals): EFFECT (per track: beds `+2 BEDS (TOTAL n)`, labs `RESEARCH n% OF DAYS`, contracts `+1 CREDIT/DAY/REGION`, hospital `n% SECOND CHANCE`, training `CAP n (RANK)`), COST, DAYS (with the current labs level), NEEDS (previous level, omitted for level I), STATUS (RESEARCHED / IN PROGRESS / AVAILABLE / LOCKED; the NEEDS row carries the missing level's name). Title is the node name uppercased. goodFor: one number-free sentence per track.
- Lab rows: `panelHit` gives `{kind:'name'}` for the name area of every Lab row (gear rows already do). App opens the card for upgrade rows; the item-card modal, lock-on-open and lock-on-close behaviour is reused.
- Out of scope: Tutorial, Campaign, equipment screen, other panels, balance numbers.

## Approaches
1. Reuse the item card screen (chosen): identical layout, no new screen, minimal code.
2. A separate building-card screen: rejected, same layout.
3. Inline effect text in the Lab row: rejected, no room at 480 px.

## Left to the builder
Exact wording of goodFor lines and EFFECT strings within the 22-character value limit; app wiring follows the existing `cardItem` pattern (a card state that can hold a node card).
