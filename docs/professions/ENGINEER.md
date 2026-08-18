# Engineer

Native shared-engine profession. Entry point `engineer.html` boots the shared
application shell. `definition.ts` is the stable export; `family.ts` composes
Core with exactly one of Holosmith, Mechanist, Amalgam, or Scrapper. Each
specialization owns its skills, state, rules, resolver reactions, and UI under
`specializations/<name>/`.

## Data

- API identity snapshot: 2026-07-28 (official GW2 API).
- Refresh: `npm run update:profession-data -- --profession Engineer`.
- Runtime simulation is network-free. Coefficients, timings, and state-machine
  rules are manually reviewed and checked into the mechanics modules.

## Implemented systems

- **Core** — eight terrestrial weapon families and both equipment sets;
  engineering kits as weapon-bar replacements (a kit swap emits a sigil-swap
  trigger without changing the equipped set); tool-belt skills derived from the
  selected heal/utility/elite; ammo, cooldowns, autoattack chains, damage,
  conditions, controls, boons, and offensive traits.
- **Holosmith** — Photon Forge, passive and skill heat, the six-second kit
  lockout, overheat, and piecewise cooling.
- **Mechanist** — trait-selected F1–F3 commands, summon/recall state, inherited
  mech attributes with base caps, persistent mech basic attacks, signets, and
  damage-relevant mech trait reactions. The mech resolves an independent
  attribute set inherited from the owner and emits summon-owned strikes and
  conditions.
- **Amalgam** — F2–F4 morph loadout persistence and Evolve state.
- **Scrapper** — Hammer, gyros, Function Gyro, superspeed, and whirl-finisher /
  kinetic trait reactions.
- All 108 traits have a validated coverage disposition.

## Modeling boundaries

- Single-target, outgoing-damage focused. Incoming attacks, active defense,
  ally healing/barrier/cleanse, pathing, secondary targets, and competitive
  (PvP/WvW) splits are out of model.
- Mech health, death, pathing, target acquisition, and AI auto-casting are not
  modeled; commands are explicit rotation actions and the mech is assumed in
  Mechanical Genius range.
- Deterministic simulations use expected critical damage, so a supplied EVTC
  can differ when it realizes an unusually high or low crit count.

## Authoritative locations

- `core/state.ts` and each `specializations/<name>/state.ts` — owned state.
- `core/rules.ts` and each specialization's `rules.ts` — attributes and modifiers.
- `specializations/mechanist/mech.ts` — persistent mech attacks and commands.
- each module's `skills.ts` — skill packets, cooldowns, and timings.
- `core/resolver.ts` and specialization `resolver.ts` files — trait reactions.
