# Engineer

Native shared-engine profession. Entry point `engineer.html` boots the shared application shell. `profession.ts` is the
stable export and composes the Core-first tuple from `catalog.ts`. A runtime contains Core plus at most one of Scrapper,
Holosmith, Mechanist, or Amalgam. Each specialization owns its data, state, mechanics, and UI under
`specializations/<name>/`.

## Data

- Generated identity metadata lives in `data/`; consult its header for snapshot provenance.
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

- Single-target, outgoing-damage focused. Player health stays at 100%; target health remains modeled. Incoming attacks,
  active defense, ally healing/barrier/cleanse, pathing, secondary targets, and competitive (PvP/WvW) splits are out of
  model.
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
- `core/traits/<line>/index.ts` and each elite's `traits/index.ts` — trait definitions, profiles, modifiers, attribute
  contributions, and triggers. Supporting helpers remain beside their definitions.
- `core/mechanics/activations.ts` — ordered trait trigger points; mechanics retain kit/toolbelt state and recharge.
- Scrapper traits own combo rewards and Function Gyro ammo; specialization state retains the pending Stability pulse.
- Holosmith traits own heat policies and Solar Focusing Lens rewards; mechanics own heat cadence and transitions.
- Mechanist traits own command selection, arm procs, and attribute inheritance; mechanics own the independent mech lane
  and packet ownership.
- Amalgam traits own Morph/Evolve rewards and recharge policy; the committed Morph task preserves cross-trait ordering.
- `specializations/mechanist/mechanics/mech.ts` — persistent mech attacks and commands.
- `core/module.ts` and each specialization's `module.ts` — native module registration and phase ownership.

Build and live attributes share `engineerProfession.attributeContributions`. Module declarations supply skill and
mechanic attributes; selected trait definitions supply their own bonuses and conversions. The shared evaluator starts
from equipment attribute seeds and resolves conversion inputs once per calculation using the active balance context.
