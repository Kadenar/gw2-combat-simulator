# Engineer

Native shared-engine profession. Entry point `engineer.html` boots the shared
application shell. `definition.ts` is the stable export and composes the
Core-first tuple from `modules.ts`. A runtime contains Core plus at most one of
Scrapper, Holosmith, Mechanist, or Amalgam. Each specialization owns its data,
state, mechanics, and UI under `specializations/<name>/`.

## Data

- API identity snapshot: 2026-07-28 (official GW2 API).
- Refresh: `npm run update:profession-data -- --profession Engineer`.
- Runtime simulation is network-free. Coefficients, timings, modifiers, and
  state-machine rules are checked into owner-local `skills/`, `traits/`, and
  `mechanics/` modules.

## Implemented systems

- **Core** - eight terrestrial weapon families and both equipment sets;
  engineering kits as weapon-bar replacements (a kit swap emits a sigil-swap
  trigger without changing the equipped set); tool-belt skills derived from the
  selected heal/utility/elite; ammo, cooldowns, autoattack chains, damage,
  conditions, controls, boons, and offensive traits.
- **Holosmith** - Photon Forge, passive and skill heat, the six-second kit
  lockout, overheat, and piecewise cooling.
- **Mechanist** - trait-selected F1-F3 commands, summon/recall state, inherited
  mech attributes with base caps, persistent mech basic attacks, signets, and
  damage-relevant mech trait reactions. The mech resolves an independent
  attribute set inherited from the owner and emits summon-owned strikes and
  conditions.
- **Amalgam** - F2-F4 morph loadout persistence and Evolve state.
- **Scrapper** - Hammer, gyros, Function Gyro, superspeed, and whirl-finisher /
  kinetic trait reactions.

## Modeling boundaries

- Single-target, outgoing-damage focused. Incoming attacks, active defense,
  ally healing/barrier/cleanse, pathing, secondary targets, and competitive
  (PvP/WvW) splits are out of model.
- Mech health, death, pathing, target acquisition, and autonomous command use
  are not modeled; commands are explicit rotation actions and the mech is
  assumed in Mechanical Genius range.
- Deterministic simulations use expected critical damage, so a supplied EVTC
  can differ when it realizes an unusually high or low crit count.

## Authoritative locations

- `core/state.ts` and each `specializations/<name>/state.ts` — owned state.
- `core/skills/` and each specialization's `skills/` — skill packets,
  cooldowns, and timings.
- `core/mechanics/` and specialization `mechanics/` directories — resources,
  availability, state transitions, and event behavior.
- `core/traits/` and specialization `traits/` directories — modifiers and
  trait reactions.
- `specializations/mechanist/mechanics/mech.ts` — persistent mech attacks and
  commands.
- `core/module.ts` and each specialization's `module.ts` — native module
  registration and phase ownership.
