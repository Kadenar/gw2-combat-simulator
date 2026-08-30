# Profession content architecture migration

This document records the behavior-preserving migration from generic profession module files to concept-oriented
profession content. The baseline is commit `688cde3aec19cc9a3ecd1c50763dff1e8afd35e1`.

The migration changes authoring ownership and discoverability. It does not replace the scheduler/resolver pipeline,
duplicate skill or trait definitions, or change combat behavior.

## Non-negotiable invariants

- The engine remains separated into scheduling/execution and resolution.
- A skill has one owner-local behavioral fragment. Generated API metadata may continue to supply identity and
  presentation fields.
- A trait or profession mechanic has one semantic Core or specialization owner.
- Runtime composition contains Core and only the active specialization.
- Scheduler and resolver state are independent objects. Scheduler changes needed by resolution cross the phase
  boundary as chronological events.
- Hook IDs, hook order, handler IDs, event types, modifier IDs, skill IDs, and state-snapshot payloads remain stable
  during organizational changes.
- Generated and static data remain separate from behavioral modules.
- Browser-only behavior does not move into the simulation domain.

## Target ownership model

Engine code is organized by phase. Profession content is organized by GW2 concept:

```text
content/professions/<profession>/
  definition.ts
  modules.ts
  catalog.ts
  build/
    build.ts
    attributes.ts
  data/
    catalog.ts
    ... generated/static inputs
  state/
    index.ts
  core/
    module.ts
    state.ts
    skills.ts | skills/
    traits.ts | traits/
    mechanics/
    profiles.ts
    presentation.ts
  specializations/<specialization>/
    module.ts
    state.ts
    skills.ts | skills/
    traits.ts | traits/
    mechanics/
    profiles.ts
    presentation.ts
  app/
    assumptions.ts | ... browser integration
```

The tree is intentionally asymmetric. Directories exist only when they make a real concept easier to find. A cohesive
small `skills.ts`, `traits.ts`, or `state.ts` remains valid.

Large cross-phase mechanics may use phase-specific files inside one concept home:

```text
mechanics/continuum-split/
  index.ts
  state.ts
  execution.ts
  resolution.ts
```

Top-level mirrored profession `execution/` and `resolution/` trees are prohibited because they split semantic
ownership and encourage duplicate definitions.

## Ranger reference layout

Ranger is the first profession migrated to the target model. Its layout demonstrates the intended asymmetry:

- Core skills are grouped in `core/skills/`; the large canonical skill catalog remains one `index.ts`, while cast
  handlers and hammer-specific helpers have explicit homes beside it.
- Core trait modifiers and cast rules live in `core/traits/modifiers.ts`.
- Pets, resource advancement, weapon state, event reactions, and availability live in `core/mechanics/` because they
  are profession systems rather than a single skill or trait.
- Specialization mechanics use GW2 concept names such as `mechanics/celestial-avatar.ts`, `mechanics/beastmode.ts`,
  and `mechanics/unleash.ts`; generic `rules.ts` and `resolver.ts` filenames are no longer used.
- Small trait or skill collections remain grouped. The reference layout does not require one file per definition.

Each Ranger `module.ts` is the visible phase boundary. It keeps shared modifiers at `mechanics.modifiers`, registers
cast and scheduling behavior under `mechanics.execution`, and registers reactions and resolver event hooks under
`mechanics.resolution`. Skill handlers are registered only through `mechanics.execution.skillHandlers`; canonical
skill mechanics remain in the owner-local skill definition module.

The Core execution hook file is deliberately a composition adapter. It coordinates several Core concepts for the
scheduler but does not become a second owner for pets, resources, traits, or weapons. Resolution implementations stay
with their owning concept and are only assembled by `module.ts`.

## Guardian and Necromancer layouts

Guardian and Necromancer follow the reference principles without copying Ranger's exact directories:

- Guardian puts virtues, Justice reactions, weapon state, and specialization systems such as tomes and Radiant Forge
  under `mechanics/`. Mantras and spear behavior stay with `skills/`. Guardian's Core execution adapter composes
  spear, weapon, and trait hooks while their implementations remain with their semantic owners.
- Necromancer groups life force, shroud lifecycle, minions, conditions, and state reconciliation under `mechanics/`.
  Weapon and flip handlers stay under `skills/`. Elite mechanics have explicit homes for Blight, Reaper Shroud,
  spirits, Soul Shards, and shades.
- Both professions use `mechanics.execution` and `mechanics.resolution` exclusively at the module boundary. Their
  canonical skill mechanics remain in owner-local `skills/index.ts` files and are not duplicated by phase.

Concept names are preferred over `rules.ts` and `resolver.ts`, but a concept may still contain several coordinated
behaviors. For example, `mechanics/tomes-and-mantras.ts` assembles Firebrand scheduling policy while the canonical
Tome and Mantra implementations stay in `mechanics/tomes.ts` and `skills/mantras.ts`.

## Engineer, Thief, and Warrior layouts

The medium-complexity professions use the same ownership rules with profession-specific concepts:

- Engineer groups kit skill declarations under `core/skills/kits/`, keeps sword, spear, dodge, and flip behavior with
  skills, and places kit, turret, heat, Photon Forge, mech, and evolved-form systems under `mechanics/`. Scrapper's
  predominantly trait-owned scheduling and resolver behavior stays under `traits/`.
- Thief keeps weapon, dodge, spear-chain, and venom behavior under `skills/`; initiative, endurance, Steal, stealth,
  and weapon state live under `mechanics/`. Artifact, malice, and Shadow Shroud behavior use specialization mechanic
  homes. Family-level Thieves Guild dispatch remains at the profession root because it deliberately selects an active
  specialization-owned summon without making Core depend on elite content.
- Warrior keeps generic actions and skill definitions under `skills/`, trait modifiers under `traits/`, and
  adrenaline/endurance systems under `mechanics/`. Berserk, Dragon Trigger, Gunsaber, Flow, chants, Motivation, and
  Full Counter remain owned by their specializations. Family-level ammunition and resource routers remain at the
  profession root because they are explicit cross-slice boundaries.

A phase section is present only when the module contributes to that phase. For example, a specialization with only
scheduler behavior does not add an empty `mechanics.resolution` object for symmetry.

## Stacked delivery plan

| Phase | Goal |
| --- | --- |
| 0 | Record the baseline and add architecture invariants before moving code |
| 1 | Establish conventions and add a backward-compatible phase-explicit native module contract |
| 2 | Perform obvious build, catalog, presentation, application, and existing-concept moves |
| 3 | Migrate Ranger as the reference profession |
| 4A | Migrate Guardian and Necromancer |
| 4B | Migrate Engineer, Thief, and Warrior |
| 4C | Migrate Elementalist and Revenant |
| 4D | Migrate Mesmer last because it has the highest scheduler-coordination risk |
| 5 | Retire compatibility facades and legacy raw hook registration |
| 6 | Enforce dependency direction and prohibit regression to generic ownership |

Every phase is based on the preceding branch. Each pull request must remain reviewable as a delta against its immediate
predecessor and must run the complete repository check and test suites.

## Review checklist

For every phase:

1. Compare normalized runtime module ownership before and after.
2. Preserve explicit ordering when hook arrays are reassembled.
3. Verify Core runtimes and every active specialization runtime.
4. Compare scheduled event streams for moved mechanics, not only final DPS.
5. Verify patch-preview authoring metadata when profiles or modifier declarations move.
6. Verify public end-state projection and state snapshot serialization.
7. Confirm generated-data scripts do not emit into behavioral directories.
