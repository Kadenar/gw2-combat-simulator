# Profession-neutral simulator architecture

The simulator is composed in three layers:

```text
js/
  platform/
    engine/        deterministic scheduling, events, handlers, contracts
    gw2/           common combat, equipment, sigils, relics, attributes
    ui/            palette/resource/timeline/log/result/chart view models
  professions/
    mesmer/        Mesmer catalog, build schema, resources, rules, simulation
    elementalist/  Elementalist engine, data, app adapter, and optimizer
  app/             browser composition and persistence adapters
```

Most of `js/core` and `js/data` contain compatibility exports for pre-refactor
public module paths. The obsolete `js/sim` compatibility tree has been
removed. `js/core/calc-attributes.js` is intentionally profession-neutral and
delegates only to common GW2 attribute assembly. New code must import the
owning platform or profession module directly.

The Elementalist scheduler, resolver, data loader, optimizer, and profession
mechanics remain under its profession directory. Common damage formulas,
attribute assembly, equipment data, event ordering, file I/O, and UI
primitives use the platform or shared app layers. Its custom scheduled-stream
handoff remains profession-owned because it carries Elementalist lookahead and
runtime state that is not part of the generic event schema.

Each profession owns its final build attribute calculation. The shared
`calculateCommonAttributes()` function assembles equipment, consumables,
infusions, sigils, and base derived stats; the Mesmer and Elementalist
calculators then apply only their own trait and skill rules.

Profession-specific browser rendering follows the same boundary. Mesmer
palette rules, Continuum Shift markers, Mirage effects, and phantasm/clone log
formatting live under `js/professions/mesmer/app`; shared result transforms,
chart queries, timeline operations, and small app UI helpers remain in the
platform or `js/app` layers.

The shared profession selector routes between the Mesmer and Elementalist
applications while preserving one visual system and independent persisted
builds.

## Dependency rules

- `platform/engine` imports no GW2, UI, or profession modules.
- `platform/gw2` may import `platform/engine`, but no profession.
- `platform/ui` consumes contract view models and imports no profession.
- A profession may import engine and shared GW2 modules.
- `app` is the composition root and may import every layer.

`tests/platform-architecture.test.js` enforces these rules and rejects
profession terminology inside the platform tree.

## Profession contract

Create professions with `defineProfession()`:

```js
export const exampleProfession = defineProfession({
  id: "example",
  name: "Example",
  catalog,
  build: {
    createBuildDefaults,
    migrateBuild,
    validateBuild,
  },
  resources: {
    createProfessionState,
  },
  attributeRules,
  castRules,
  schedulerHooks,
  resolverHooks: {
    eventHandlers,  // exclusive custom event types
    eventReactions, // reactions to standard GW2 event types
  },
  ui: {
    paletteGroups,
    resourceView,
  },
});
```

All hooks are optional. Missing validation accepts the cast, missing modifier
hooks return their input, and other hooks are no-ops. Scheduler hooks and
resolver event reactions accept
`{ id, order, handler }`; lower order runs first and declaration order breaks
ties deterministically.

Shared scheduler state is limited to time, cooldowns, ammo, weapon set, skill
uses, pending events, and `profession`. Profession resources and mechanic
timers live under `state.profession`.

The platform scheduler handles ordinary declarative skills. A profession with
actor-specific timing, such as Mesmer clone and phantasm attacks, composes its
own mechanic controllers over the shared scheduler state, cooldown controller,
and GW2 event factory. It must still emit the canonical event stream; it does
not copy common cooldown, ammo, or event-representation logic.

## Events

Event schema version 1 is defined in `platform/engine/events.js`. Every event
has:

```js
{
  type,
  at,
  source,
  sourceId,
}
```

Common types are `action`, `damage`, `condition`, `condition_tick`, `control`,
`blind`, `weapon_set`, and `proc`. A profession adds a namespaced type such as
`example.resource` by registering it in `resolverHooks.eventHandlers`.
Duplicate registrations, missing required handlers, and unknown namespaced
events throw explicit errors.

Standard event types are owned by `platform/gw2/resolver`. A profession reacts
to them through `resolverHooks.eventReactions` without replacing the common
handler:

```js
resolverHooks: {
  eventHandlers: {
    "example.resource": handleResource,
  },
  eventReactions: {
    damage: handleProfessionCriticalTraits,
    control: handleProfessionInterruptTraits,
  },
}
```

Common handlers resolve damage and conditions, drain the queue, enforce combat
and target-death bounds, and apply sigils and relics. Reactions receive the
resolved context plus capabilities such as `hitContext` and `applyCondition`.
For example, Ineptitude is a Mesmer `control`/`blind` reaction; control relics
and control-triggered sigils remain common GW2 behavior.

## Skills, traits, and rotations

Behavior uses stable IDs. A canonical catalog merges generated metadata,
simulator mechanics, explicit overrides, and extra skills. Validation rejects
duplicate skill IDs, missing handlers or parent skills, invalid effects,
invalid slots, and unavailable weapon metadata.

Normalized rotations use:

```js
{ type: "cast", skillId }
{ type: "wait", durationMs }
{ type: "combat-start" }
{ type: "cast", skillId, concurrentOffsetMs: 100 }
{ type: "cast", skillId, interruptAfterMs: 500 }
```

Legacy display-name entries are converted at the application boundary.
Concurrent and interrupted casts are scheduler operations; their timing is
decided before effects and cooldowns are scheduled.

## Builds

The current persisted schema is:

```js
{
  schemaVersion: 3,
  profession: "mesmer", // or "elementalist"
  // profession build fields
}
```

Each profession owns defaults, explicit version migrations, validation, and
sanitization. The existing `gw2-mesmer-simulator-v2` localStorage key is kept
so saved builds migrate in place. Browser state uses a compatibility view of
rotation entries; storage and the simulator contract use normalized commands.

## Included professions

- `mesmer`: native profession-contract implementation.
- `elementalist`: direct reference-engine port exposed through an
  `elementalistProfession` contract adapter.

## Adding another profession

1. Add `js/professions/<id>/` with catalog, build, state, rules, UI view models,
   and a `defineProfession()` composition.
2. Register stable skill/trait IDs, namespaced custom event handlers, and only
   the standard event reactions the profession needs.
3. Add the profession to `js/app/composition.js` or a future profession picker.
4. Add an end-to-end fixture that imports no other profession.
5. Run `npm test` and `npm run check`.

No engine, GW2, or shared UI branch should be needed. New professions should
use `platform/engine` scheduler state/cooldowns and the `platform/gw2`
scheduler event factory and resolver. If a new rule is truly shared by
multiple professions, add it to `platform/gw2`; otherwise keep it in the
profession module as a scheduler mechanic or resolver reaction.
