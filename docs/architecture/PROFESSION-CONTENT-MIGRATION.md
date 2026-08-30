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
