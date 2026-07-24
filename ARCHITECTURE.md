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
  app/             browser composition and persistence adapters
```

`js/sim`, `js/core`, and `js/data` contain compatibility exports for the
pre-refactor public module paths. New code must import the owning platform or
profession module directly.

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
    eventHandlers,
  },
  ui: {
    paletteGroups,
    resourceView,
  },
});
```

All hooks are optional. Missing validation accepts the cast, missing modifier
hooks return their input, and other hooks are no-ops. Hook arrays accept
`{ id, order, handler }`; lower order runs first and declaration order breaks
ties deterministically.

Shared scheduler state is limited to time, cooldowns, ammo, weapon set, skill
uses, pending events, and `profession`. Profession resources and mechanic
timers live under `state.profession`.

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
  profession: "mesmer",
  // profession build fields
}
```

Each profession owns defaults, explicit version migrations, validation, and
sanitization. The existing `gw2-mesmer-simulator-v2` localStorage key is kept
so saved builds migrate in place. Browser state uses a compatibility view of
rotation entries; storage and the simulator contract use normalized commands.

## Adding another profession

1. Add `js/professions/<id>/` with catalog, build, state, rules, UI view models,
   and a `defineProfession()` composition.
2. Register stable skill/trait IDs and namespaced custom event handlers.
3. Add the profession to `js/app/composition.js` or a future profession picker.
4. Add an end-to-end fixture that imports no other profession.
5. Run `npm test` and `npm run check`.

No engine, GW2, or shared UI branch should be needed. If a new rule is truly
shared by multiple professions, add it to `platform/gw2`; otherwise keep it in
the profession module.
