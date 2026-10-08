# Elementalist

Elementalist is a native profession family built on the shared GW2 engine. The browser route is `elementalist.html`; the
application registry lazily loads the engine-facing `elementalistProfession` from `profession.ts` and the browser-facing
`elementalistAppAdapter` from `app/app-definition.ts`.

At runtime, `defineNativeProfession()` resolves the Core module plus at most one of Tempest, Weaver, Catalyst, or
Evoker. The shared engine owns scheduling, event resolution, GW2 formulas, equipment, conditions, and generic UI
composition. Elementalist modules own only profession-specific data, state, mechanics, and presentation.

## Architecture

Unless noted otherwise, paths below are relative to `js/games/gw2/professions/elementalist/`.

- `catalog.ts` declares the Core-first module tuple and assembles the complete application catalog. Module order also
  controls catalog name collisions, with Core identities taking precedence. Runtime catalogs use the same contributions
  but contain Core plus only the selected specialization.
- `profession.ts` composes the build codec, modules, autoattack-chain transition policy, family UI, and catalog options
  into the stable profession contract. The browser adapter applies active patch-preview decoration separately.
- `core/module.ts` registers Core through `defineNativeModule()`. Its `data`, `state`, `hooks`, `modifiers`,
  `traitDefinitions`, and `presentation` sections are the Core ownership boundary.
- `specializations/<name>/module.ts` registers each elite specialization through the same ownership sections. Elite
  state and behavior stay inside the active specialization slice rather than leaking into Core.
- `data/module-data.ts` joins owner-authored skill mechanics to generated GW2 API identity metadata, applies
  Elementalist-specific catalog transformations, and returns only the catalog entries owned by the requesting module.
- `family-state.ts` projects the nested runtime state into the stable public end-state record exposed by simulation
  results.
- `build/build.ts` owns build defaults, schema migration, validation, and conversion to the application build shape.
  Schema version 4 preserves both configured weapon sets and the selected starting set. Elementalist uses attunement and
  bundle transitions rather than ordinary in-combat equipment swaps.
- `app/app-definition.ts` adapts the profession contract for the shared browser shell, including build-time attributes,
  starting resources, weapon selection, and skill availability.

Persisting Flames is defined in `core/traits/fire/index.ts`; `core/traits/fire/persisting-flames.ts` retains its
pre-emission effect/field transformations. Ordered calls in `core/mechanics/reactions.ts` grant its buffs before
Shattering Stone on damage and after Strength of Stone on Burning applications; shared resolver state retains the buff
lifetime. Tooltips read the modifier's authoritative stack cap. The remaining Core definitions live in their five
`core/traits/<line>/index.ts` owners.

Core registers 45 trait definitions; Tempest registers 11, Weaver 9, Catalyst 10, and Evoker 11 from their
`specializations/<name>/traits/index.ts` owners, which also export each elite's registration array. Profiles,
declarative modifiers, build contributions, and ordinary triggers live with those definitions. The Core index collects
line definitions in registration order; `core/traits/dispatch.ts` preserves ordered runtime calls. Supporting behavior
lives inside the owning line's folder: Air and Earth use `attunement-entry.ts`, Arcane uses `attunement-swap.ts`, and
Fire uses `attunement-transition.ts` for entry and exit effects. Lines also own `critical-procs.ts` where needed; only
shared hit eligibility stays in `core/traits/critical-eligibility.ts`. Elite support stays beside its definitions. Live
attribute passes and critical procs retain explicit calls so resource and reaction order stay unchanged. Shared state
still owns ICDs, Fresh Air wakes, Bountiful Power progress, and timed buff applications.

Tempest keeps overload availability, lockouts, Lightning Jolt, and scheduler work in mechanics. Its trait helpers own
hit-derived alacrity, completion auras, shout rewards, and aura windows. The shared overload profile retains its
existing patch IDs and supplies singularity tuning to Transcendent Tempest. Weaver retains dual-attunement and stance
execution in mechanics, with explicit trait calls at initialization, accepted entry, and committed completion. Catalyst
traits own empowerment renewal and aura/combo reactions while sphere execution and resource accounting remain in
mechanics. Evoker traits own familiar rewards, synthetic entry policy, recharge adjustments, and enchantment payloads;
skill casts and deferred resource settlement retain their existing scheduler boundaries.

## Owned systems

- **Core** — attunements, weapon and slot skills, cast and recharge rules, autoattack transitions, auras, endurance,
  conjures, summoned elementals, core trait reactions, and weapon resources such as pistol bullets, hammer orbs, and
  spear etchings.
- **Tempest** — overload availability and scheduling, Tempest skill handlers, aura reactions, modifiers, state, and UI.
- **Weaver** — dual attunements, dual-attunement weapon skills, Weaver cast rules, modifiers, state, and UI.
- **Catalyst** — energy, Jade Spheres, Elemental Empowerment, combo and aura reactions, modifiers, state, and UI.
- **Evoker** — specialized-element familiars, charges, empowerment, recharge rules, skill handlers, modifiers, state,
  and UI.

## Data

- The checked-in GW2 API identity snapshot is dated 2026-08-12.
- Refresh it with `npm run update:elementalist-data`.
- Generated API metadata supplies identities, icons, descriptions, traits, and specialization records. It is not the
  source of coefficients, damaging conditions, timings, or state-machine behavior; those live in the owning `core/` or
  `specializations/<name>/` modules.
- Runtime simulation is network-free.

## Presets and tests

`data/gw2/builds/elementalist/manifest.json` is the supported preset inventory. Focused behavior, ownership, state, and
UI tests live under `tests/games/gw2/professions/elementalist/`; saved-build simulations live under
`tests/games/gw2/app/benchmarks/elementalist.test.js`.

## Modeling boundaries

The simulator is single-target and outgoing-damage focused. Incoming attacks, active defense, ally healing and
cleansing, pathing, secondary targets, and competitive PvP/WvW splits are outside the model. Deterministic simulations
average critical damage by default, with rolled critical damage available in simulation settings. RNG simulations always
use rolled critical damage. An EVTC can differ from either the expected damage or the simulated seed's critical-hit
outcomes.
