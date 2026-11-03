# Profession-neutral simulator architecture

This overview describes composition, ownership, and runtime invariants. Use [MODULES.md](./MODULES.md) to locate an
implementation owner, the [platform ownership guide](../../js/games/gw2/platform/README.md) for service boundaries, and
[PROGRAMMATIC-SIMULATION.md](./PROGRAMMATIC-SIMULATION.md) for input and output contracts.

## Layers

```text
js/
  kernel/          game-neutral clock, queues, randomness, and observation
  ui/              game-neutral view models and DOM/rotation primitives
  browser/         game-neutral page entry, game boundary, and shell
  games/gw2/
    platform/      shared GW2 engine, combat, builds, equipment, and simulation
    professions/   profession-owned builds, skills, state, mechanics, and presentation
    app/           GW2 browser composition, persistence, and presentation
    integrations/  logs, keybinds, chat codes, and patch-preview adapters
```

Dependency rules are enforced by ESLint and architecture tests:

- `kernel` imports no GW2, UI, application, or profession modules; `ui` consumes game-neutral contracts only.
- The GW2 platform may import the kernel, but no concrete profession or application modules.
- Profession runtimes depend on the kernel and platform. Profession `app/` adapters may also depend on the GW2 app.
- `browser` and the GW2 `app` are the composition roots for neutral and game-specific browser concerns.

The shared shell receives registered profession application adapters. Each adapter supplies build persistence,
runtime/configuration binding, and presentation contributions. Shared views consume those contributions rather than
branching on profession identity.

## Native profession modules

`defineNativeModule()` declares a Core or elite module as one vertical slice: authored data, state factory and public
projection, lifecycle hooks, declarative modifiers, attributes, trait definitions, and presentation.
`defineNativeProfession()` composes a Core-first module tuple and exposes `runtimeFor(config)`. Runtime composition
selects Core plus the active elite; unknown elites are rejected. Each run creates fresh state:
`{ core, specialization: { kind, state } }`.

### Catalog and ownership

Owner-local skill files contain complete declarations, including presentation, selection metadata, costs, recharge, and
intrinsic behavior. `data/ids.ts` maintains identities; catalog assembly builds indexes without joining external skill
metadata. Trait definitions own their profiles, rules, triggers, and build contributions. Shared mechanic behavior stays
with its Core or elite owner.

`createNativeModuleData()` gathers module data, and `assembleNativeApplicationCatalog()` builds the full editor catalog.
Runtime selection reuses canonical records in fresh collections for Core and the selected elite. Assembly validates
ownership, references, weapon hands, chains, and flips; selected catalogs cannot resolve references into inactive
modules. Skill specialization follows the owning module. Shared Weaponmaster Training weapons belong to Core.

Build eligibility is a shared baseline: excluded skills are unavailable, and elite skills require their owning
specialization. Profession availability can add restrictions but cannot bypass this gate. Equipment, resources,
cooldowns, and live mechanic state impose separate checks.

### Rules and hooks

Modifiers are authored as declarative `modifierRules`, with optional damage-bucket policies. Catalog admission validates
and detaches declarations; selected runtime composition compiles evaluators once. Compiled `modify*` methods are query
operations, not authoring hooks. Equipment and profession additions share one damage calculation, and each damage-bucket
policy has at most one owner across selected modules.

`defineTrait()` expands definitions once during module construction. Selection gates apply to ordinary rules and
triggers; already-created effects may retain explicit lifetime ownership. Module and trait hooks use the same ordered
composer. Unknown fields and duplicate named handlers fail validation.

Author callbacks receive query, mutation, or lifecycle capabilities appropriate to their role. They do not receive the
command cursor, heap, or report collections. See [profession file roles](./MODULES.md#profession-file-roles) for
authoring layout and the [platform ownership guide](../../js/games/gw2/platform/README.md) for calculation and
capability boundaries.

## Runtime and simulation

`simulateGw2()` validates input and invokes one runtime. Its main owners are:

- `simulation/runtime.ts`: per-run service assembly.
- `simulation/coordinator.ts`: the single heap, clock, causal scope, and advancement loop.
- `execution/cast-execution.ts`: readiness, reservations, acceptance, commitment, and completion.
- `resolver/effect-delivery.ts`: packet admission, preparation, target gates, and reaction settlement.
- `results/project-runtime.ts`: projection of the settled run without advancing it.

Commands, internal tasks, and combat packets share one clock and queue. Internal work carries detached payloads and
lifetime ownership without public packet identity. Cast commitment and lifetime generations determine which work
survives cancellation; committed projectiles can outlive their cast. Pending work enters gameplay history only when
executed.

Execution owns cooldowns, ammo, and follow-up windows separately from profession state. Flip readiness and visibility
close at their deadline. Generic flip cleanup runs in the Ordinary phase after queued gameplay and its same-time
consequences, before rotation commands at that deadline; work enqueued by those commands runs afterward. Identity checks
protect rearmed windows, and natural-expiry handlers can claim their matching occurrence before generic cleanup.

Score and detailed output modes execute the same mechanics and use the same gameplay history and seeded randomness.
Detailed mode additionally retains reports and diagnostics. Rotation, tail, and absolute observation policies bound
delayed work without extending rotation duration recursively. Combat reports stop at `combatEndTime`; after target
death, commands may continue while hostile effects and hit-dependent grants are suppressed.

`planningState` is a detached observation, not a checkpoint. It includes execution state and composed profession facts
under stable state IDs. Projectors are pure, duplicate IDs are rejected, and the observer deep-clones the public record.
The shared flip projection lives at `planningState.profession[STATE.AVAILABLE_FLIPS]`. Availability observations
describe profession gates, separately from scheduler cooldown and lane checks.

Player health is fixed at 100%; target health remains live. Attribute-preview health is a separate input. Application
builds assume permanent console Quickness and Alacrity; player cast durations are authored with Quickness already
included, while independent summons retain their own timing and received-boon policies.

See [event clock](./SIMULATION-EVENT-CLOCK.md), [same-time ordering](./SKILL-EVENT-ORDERING.md),
[observation boundaries](./PROGRAMMATIC-SIMULATION.md#observation-boundaries), and
[state snapshots](./ROTATION_STATE_SNAPSHOT.md) for precise contracts.

## Events and resolution

Behavior keys on stable skill and actor identities; display labels do not determine ownership or rules. Each activation
has a stable identity shared by its packets. Weapon-strength profiles are captured while the originating weapon or form
is known.

The resolver handles standard combat events; professions register namespaced handlers and stage-specific reactions. Only
`damage.resolving` returns packet patches. Other stages notify handlers of resolved facts, and effects are submitted
through the emission service. Critical effects reuse the hit's actual outcome rather than predicting it during
scheduling.

Seeded streams drive critical outcomes and proc chances. Deterministic damage may use an expected critical multiplier;
stochastic damage uses the same sampled critical outcome for damage, proc eligibility, and reporting. See
[randomness](./PROGRAMMATIC-SIMULATION.md#randomness) and [condition settlement](./SHARED-CONDITION-TICKS.md).

## Skills and rotations

Catalogs validate declarations and references; procedural behavior belongs in module hooks. Rotation normalization
resolves input names to stable IDs, and saved presets use canonical commands. The driver executes casts, waits, combat
start, and cooldown resets through shared execution services.

Cast acceptance reserves lane, resource, and recharge decisions. Costs are paid at their declared boundary, before
completion rewards. Commitment controls side effects and cancellation; named tasks and resolved reactions operate on the
same live state as subsequent commands. Temporary availability blocks can retry after intervening work; permanent blocks
are invalid.

Use the [rotation command reference](./PROGRAMMATIC-SIMULATION.md#rotation-commands) and
[skill ordering guide](./SKILL-EVENT-ORDERING.md) for command shapes, timing, and lifecycle details.

## Builds and attributes

Professions own versioned build schemas, defaults, profession-specific normalization, and resource validation. The
shared build codec handles common equipment, selection, target, and rotation fields. Browser persistence stays in
application adapters; execution consumes normalized configuration.

Shared attribute calculation combines equipment and base stats with profession contributions. A profession's headless
`build/context.ts` binding provides canonical per-weapon-set attributes and simulation configuration from the build's
starting state. Create a new context when inputs change. The workspace, optimizer workers, and benchmark jobs use this
same calculation path; displayed weapon sets and previous results do not participate.

Build context receives pure loadout resolvers and assumption definitions rather than reading UI state. Attribute
provenance prevents static rules from applying twice; dynamic modifiers read live combat facts.

## Boss encounter execution

Optional encounter configuration adds target health pools, phase transitions, and damage windows to the existing
runtime. Splits allow preparation while blocking boss damage; intermissions also hold rotation commands. Neither resets
player state or starts another clock. Group damage never contributes to player damage totals.

The boss-scenario application owns persistence and plan compilation. Ordinary observation boundaries still limit the
run. See [boss encounters](./PROGRAMMATIC-SIMULATION.md#boss-encounters) for configuration and results.

## Adding another profession

The roster lives in `js/games/gw2/profession-registry.ts`; [profession guides](../professions/) describe existing
families.

1. Create the build codec, Core and elite modules, and Core-first native profession composition. Assemble the
   application catalog from those modules rather than hand-building runtime fragments.
2. Declare stable identities, weapon hands, required hooks, and presentation contributions with their owners.
3. Add the page and lazy application/runtime loaders to the profession registry.
4. Add focused Node coverage for the profession's contracts and run `npm run check`.

New professions should not require branches in the engine or shared UI. Promote behavior into the platform only when
multiple professions share it.
