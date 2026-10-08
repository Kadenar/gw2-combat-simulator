# Engineer

Native shared-engine profession. Entry point `engineer.html` boots the shared application shell. `profession.ts` is the
stable export and composes the Core-first tuple from `catalog.ts`. A runtime contains Core plus at most one of Scrapper,
Holosmith, Mechanist, or Amalgam. Each specialization owns its data, state, mechanics, and UI under
`specializations/<name>/`.

## Data

- API identity snapshot: 2026-07-28 (official GW2 API).
- Refresh: `npm run update:profession-data -- --profession Engineer`.
- Runtime simulation is network-free. Coefficients, timings, modifiers, and state-machine rules are checked into
  owner-local `skills/`, `traits/`, and `mechanics/` modules.

## Implemented systems

- **Core** - eight terrestrial weapon families and both equipment sets; engineering kits as weapon-bar replacements (a
  kit swap emits a sigil-swap trigger without changing the equipped set); tool-belt skills derived from the selected
  heal/utility/elite; ammo, cooldowns, autoattack chains, damage, conditions, controls, boons, and offensive traits.
- **Holosmith** - Photon Forge, passive and skill heat, the six-second kit lockout, overheat, and piecewise cooling.
- **Mechanist** - trait-selected F1-F3 commands, an always-present mech, inherited mech attributes with base caps,
  persistent mech basic attacks, signets, and damage-relevant mech trait reactions. The mech resolves an independent
  attribute set inherited from the owner and emits summon-owned strikes and conditions.
- **Amalgam** - F2-F4 morph loadout persistence and Evolve state.
- **Scrapper** - Hammer, gyros, Function Gyro, superspeed, and whirl-finisher / kinetic trait reactions.

## Modeling boundaries

- Single-target, outgoing-damage focused. Incoming attacks, active defense, ally healing/barrier/cleanse, pathing,
  secondary targets, and competitive (PvP/WvW) splits are out of model.
- Mech summon/recall, health, death, pathing, target acquisition, and autonomous command use are not modeled; commands
  are explicit rotation actions and the mech is assumed in Mechanical Genius range.
- Deterministic simulations average critical damage by default, with rolled critical damage available in simulation
  settings. RNG simulations always use rolled critical damage. An EVTC can differ from either the expected damage or the
  simulated seed's critical-hit outcomes.

## Authoritative locations

- `core/state.ts` and each `specializations/<name>/state.ts` — owned state.
- `core/skills/` and each specialization's `skills/` — skill packets, cooldowns, and timings.
- `core/mechanics/` and specialization `mechanics/` directories — resources, availability, state transitions, and event
  behavior.
- `core/traits/` — five trait-line folders own 36 definitions in their `index.ts` files; the parent `index.ts` preserves
  registration order. `dispatch.ts` preserves cross-line reactions. Supporting behavior lives in the owning line:
  `alchemy/elixirs.ts`, `explosives/explosions.ts`, `firearms/condition-procs.ts`, `firearms/modifiers.ts`,
  `firearms/critical-procs.ts`, `firearms/emissions.ts`, and `tools/toolbelt.ts`. Mechanics retain kit/toolbelt state
  and cooldown execution.
- `specializations/scrapper/traits/index.ts` — eight registered definitions own gyro triggers, Function Gyro ammo, combo
  rewards, build conversion, and the live Stability pulse. `traits/behavior.ts` includes Kinetic Accelerators combo
  rewards; Scrapper state retains the pending pulse timestamp.
- `specializations/holosmith/traits/index.ts` — seven definitions own heat policies, Lens grants/consumption, Forge
  action eligibility, and trait modifiers. `traits/behavior.ts` includes Solar Focusing Lens grants and consumption;
  mechanics retain heat cadence and transition sequencing.
- `specializations/mechanist/traits/index.ts` — ten definitions own command rows, arm procs, frame inheritance, and
  core/signet adjustments; mechanics retain the independent mech lane and packet ownership.
- `specializations/amalgam/traits/index.ts` — nine definitions own Morph/Evolve payoffs, trait build contributions,
  variant selection, and accepted-control recharge reductions. `traits/behavior.ts` owns the shared Morph/Evolve and
  Carbolic Composition helpers. The committed Morph task retains cross-trait ordering.
- Supporting elite behavior remains under each `traits/` directory; mechanic callers import those helpers directly.
- `specializations/mechanist/mechanics/mech.ts` — persistent mech attacks and commands.
- `core/module.ts` and each specialization's `module.ts` — native module registration and phase ownership.
