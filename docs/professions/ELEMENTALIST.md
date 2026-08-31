# Elementalist

Elementalist is a native profession family built on the shared GW2 engine. The
browser route is `elementalist.html`; the application registry lazily loads the
engine-facing `elementalistProfession` from `definition.ts` and the browser-facing
`elementalistAppAdapter` from `app/app-definition.ts`.

At runtime, `defineNativeProfession()` resolves the Core module plus at most one of
Tempest, Weaver, Catalyst, or Evoker. The shared engine owns scheduling, event
resolution, GW2 formulas, equipment, conditions, and generic UI composition.
Elementalist modules own only profession-specific data, state, mechanics, and
presentation.

## Architecture

Unless noted otherwise, paths below are relative to
`js/games/gw2/content/professions/elementalist/`.

- `modules.ts` declares the Core-first module tuple. Module order also controls
  catalog name collisions, with Core identities taking precedence.
- `definition.ts` composes the build codec, modules, autoattack-chain transition
  policy, family UI, patch preview, and catalog options into the stable profession
  contract.
- `core/module.ts` registers Core through `defineNativeModule()`. Its `data`,
  `state`, `mechanics`, and `presentation` sections are the Core ownership boundary.
- `specializations/<name>/module.ts` registers each elite specialization through
  the same four sections. Elite state and behavior stay inside the active
  specialization slice rather than leaking into Core.
- `catalog/module-data.ts` joins owner-authored skill mechanics to generated GW2 API
  identity metadata, applies Elementalist-specific catalog transformations, and
  returns only the catalog entries owned by the requesting module.
- `catalog.ts` assembles the complete application catalog from all modules. Runtime
  catalogs are derived from the same contributions and contain Core plus only the
  selected specialization.
- `state.ts` projects the nested runtime state into the stable public end-state
  record exposed by simulation results.
- `build/build.ts` owns build defaults, schema migration, validation, and conversion
  to the application build shape. Elementalist builds are normalized to one weapon
  set.
- `app/app-definition.ts` adapts the profession contract for the shared browser
  shell, including build-time attributes, starting resources, weapon selection, and
  skill availability.

## Owned systems

- **Core** — attunements, weapon and slot skills, cast and recharge rules,
  autoattack transitions, auras, endurance, conjures, summoned elementals, core
  trait reactions, and weapon resources such as pistol bullets, hammer orbs, and
  spear etchings.
- **Tempest** — overload availability and scheduling, Tempest skill handlers, aura
  reactions, modifiers, state, and UI.
- **Weaver** — dual attunements, dual-attunement weapon skills, Weaver cast rules,
  modifiers, state, and UI.
- **Catalyst** — energy, Jade Spheres, Elemental Empowerment, combo and aura
  reactions, modifiers, state, and UI.
- **Evoker** — specialized-element familiars, charges, empowerment, recharge rules,
  skill handlers, modifiers, state, and UI.

## Data

- The checked-in GW2 API identity snapshot is dated 2026-08-12.
- Refresh it with `npm run update:elementalist-data`.
- Generated API metadata supplies identities, icons, descriptions, traits, and
  specialization records. It is not the source of coefficients, damaging
  conditions, timings, or state-machine behavior; those live in the owning
  `core/` or `specializations/<name>/` modules.
- Runtime simulation is network-free.

## Presets and tests

`data/gw2/builds/elementalist/manifest.json` is the supported preset inventory.
Focused behavior, ownership, state, and UI tests live under
`tests/professions/elementalist/`; saved-build simulations live under
`tests/app/benchmarks/elementalist.test.js`. The trait coverage manifest in
`tests/fixtures/trait-coverage/elementalist.js` is an implementation inventory,
not a substitute for behavioral tests.

## Modeling boundaries

The simulator is single-target and outgoing-damage focused. Incoming attacks,
active defense, ally healing and cleansing, pathing, secondary targets, and
competitive PvP/WvW splits are outside the model. Deterministic simulations use
expected critical damage, so an EVTC log can differ when its realized critical-hit
count is unusually high or low.
