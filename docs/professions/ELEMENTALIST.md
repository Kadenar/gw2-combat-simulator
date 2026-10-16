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
- `core/module.ts` registers Core through `defineNativeModule()`. Its `data`, `state`, `attributes`, `hooks`,
  `modifiers`, `traitDefinitions`, and `presentation` sections are the Core ownership boundary.
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

Core trait definitions live in `core/traits/<line>/index.ts`; each elite owns definitions in
`specializations/<name>/traits/index.ts`. Definitions own profiles, modifiers, attribute contributions, and ordinary
triggers. Supporting helpers stay beside their definitions; mechanics own resource clocks and ordered dispatch.

Preserve these boundaries when changing behavior:

- Core orders Persisting Flames before Shattering Stone on damage and after Strength of Stone on Burning applications.
  Shared state owns proc cooldowns, Fresh Air wakes, and timed buffs.
- Core availability checks elemental commands, weapon resources, attunements, bundles, and equipment selection in that
  precedence, including successful short-circuits and retry deadlines. Elemental attack impacts validate both summon and
  action generations before emitting effects.
- The shared cooldown controller is the sole owner of attunement recharge progress. Keeping an existing attunement
  deadline keeps the work already earned under earlier recharge rates.
- Tempest mechanics own overload availability and scheduling; traits own aura rewards and singularity tuning. The
  completing trait boundary fires before overload completion, and the completed boundary after it.
- Weaver mechanics own dual-attunement and stance execution, with trait calls at initialization, accepted entry, and
  committed completion. Completion traits run before the Fervent Stance dual-attack reward.
- Catalyst mechanics own spheres and energy; traits own empowerment and aura/combo reactions. Accepted-hit energy gains
  precede Catalyst damage reactions, and augment effects are selected at commitment rather than cast start.
- Evoker mechanics own familiar casts and deferred resource settlement; traits own familiar rewards, recharge policies,
  and enchantment payloads.

Build and live queries share `elementalistProfession.attributeContributions`. Core skill attributes come from
`core/skills/attributes.ts`; selected traits add their declarations. The shared evaluator starts from equipment seeds,
uses the active balance context, and reads live attunements, boons, and stacks. Detached previews select contributions
from their own inputs.

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

- Generated identity metadata lives in `data/`; consult its header for snapshot provenance.
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

The simulator is single-target and outgoing-damage focused. Player health stays at 100%; target health remains modeled.
Incoming attacks, active defense, ally healing and cleansing, pathing, secondary targets, and competitive PvP/WvW splits
are outside the model. Deterministic simulations average critical damage by default, with rolled critical damage
available in simulation settings. RNG simulations always use rolled critical damage. An EVTC can differ from either the
expected damage or the simulated seed's critical-hit outcomes.
