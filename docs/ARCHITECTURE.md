# Profession-neutral simulator architecture

The simulator is composed in three layers:

```text
js/
  platform/
    engine/        deterministic scheduling, events, handlers, contracts
    gw2/           common combat, equipment, sigils, relics, attributes
    ui/            palette/resource/timeline/log/result/chart view models
  professions/
    mesmer/        Mesmer catalog, build schema, state, rules, and mechanics
    elementalist/  Elementalist engine, data, app adapter, and optimizer
    guardian/      Guardian API catalog, virtues, rules, and declarative skills
    necromancer/   Necromancer catalog, shrouds, summons, rules, and adapter
  app/             browser composition and persistence adapters
```

The obsolete `js/core`, `js/data`, and `js/sim` compatibility trees have been
removed. Common GW2 attribute assembly and derived-stat finalization live in
`js/platform/gw2/attributes.js`; profession calculators own only their resolved
trait and skill deltas. New code must import the owning platform or profession
module directly.

The Elementalist scheduler, resolver, data loader, optimizer, and profession
mechanics remain under its profession directory. Common damage formulas,
attribute assembly, equipment data, event ordering, file I/O, and UI
primitives use the platform or shared app layers. Its custom scheduled-stream
handoff remains profession-owned because it carries Elementalist lookahead and
runtime state that is not part of the generic event schema.

Each profession owns its build-specific trait calculations. The shared
`calculateCommonAttributes()` function assembles equipment, consumables,
infusions, sigils, and base derived stats. Guardian, Mesmer, and Necromancer
pass their resolved deltas to `finalizeBuildAttributes()`, which applies the
deltas and consistently rebuilds critical chance, critical damage, boon
duration, and condition duration. Elementalist remains on its profession-owned
attribute engine.

Profession-specific browser rendering follows the same boundary. The shared
shell receives a profession application adapter for its build codec, storage
key, runtime/config builder, renderer hooks, filenames, specialization
fallback, supported relic list, and background contribution worker. The
shared rotation renderer consumes profession palette/resource view models and
canonical result state. Specialized Mesmer timeline/log details are optional
branches over those contracts; Guardian tome and forge availability is
supplied by its profession UI definition.

The shared Mesmer/Guardian/Necromancer rotation palette renders both configured weapon
sets. Only the active set is context-enabled; inactive-set skills remain
visible so their cooldown state can still be inspected.

The shared profession selector routes between all four applications while
preserving one visual system and independent persisted builds.

## Dependency rules

- `platform/engine` imports no GW2, UI, or profession modules.
- `platform/gw2` may import `platform/engine`, but no profession.
- `platform/ui` consumes contract view models and imports no profession.
- A profession may import engine and shared GW2 modules.
- `app` is the composition root and may import every layer.

`tests/platform-architecture.test.js` enforces these rules and rejects
profession terminology inside the platform tree.

## Declarative profession mechanics layout

Mesmer, Guardian, and Necromancer use the same module roles:

- `data/<profession>-api-metadata.js` is generated presentation and identity
  metadata. It is never a source of coefficients or damaging conditions.
- `data/traits-data.js` is the only module that exports the flattened runtime
  `TRAITS` collection; it derives that view from specialization metadata.
- `mechanics/skill-mechanics.js` is the single authoritative ID-keyed source
  for every field that can affect simulation results.
- `autoattack-chains.js` owns autoattack-chain declarations and derivation.
- `handlers.js`, when needed, registers imperative skill behavior that cannot
  be represented by declarative effects.

Profession-specific state machines remain in named feature modules beside
these boundaries. Skill entries reference those handlers explicitly.

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
    createResolverState, // optional clean resolver-time initial state
    projectEndState,      // optional public profession-state projection
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
    resourceViews, // zero, one, or multiple resource view models
    isPaletteSkillAvailable,       // optional contextual castability
    paletteSkillUnavailableMessage, // optional disabled-state explanation
  },
});
```

All hooks are optional. Missing validation accepts the cast, missing modifier
hooks return their input, and other hooks are no-ops. Scheduler hooks and
resolver event reactions accept
`{ id, order, handler }`; lower order runs first and declaration order breaks
ties deterministically.

Guardian, Mesmer, and Necromancer scalar combat bonuses are declared as
per-effect rules in their `attribute-rules.js` modules. The shared
`platform/gw2/modifier-rules.js` adapter compiles those rules into the existing
critical chance, critical damage, strike damage, condition damage, and
condition duration hooks. It owns flat scalar sequencing and the single GW2
outgoing additive-damage bucket rebuild; profession modules own predicates and
runtime state. Ordered attribute conversions remain narrow imperative hooks.
Elementalist is excluded until its resolver path adopts the shared GW2
profession hooks.

Shared scheduler state is limited to time, cooldowns, ammo, weapon set, skill
uses, pending events, and `profession`. Profession resources and mechanic
timers live under `state.profession`. Typed scheduler tasks carry serializable
payloads and are dispatched to namespaced profession handlers.

The neutral engine accepts scheduler policy callbacks. `platform/gw2` supplies
the shared GW2 policy for Quickness-adjusted casts, Alacrity-adjusted recharge,
ammo, and the configured starting weapon set. Profession hooks may then modify
cast duration, recharge duration, or maximum ammo without copying the common
state machine.

Application and test callers use `simulateGw2()`, which always runs the shared
GW2 scheduler, event-stream builder, resolver, and result builder. Canonical
sequence results keep time, cooldowns, ammo, and active weapon set under
`endState`; profession mechanics are exposed only through
`endState.profession`.

The platform scheduler handles ordinary declarative skills and invokes
profession hooks for complex behavior. Mesmer clone attacks, resource gains,
expected procs, and Continuum expiry are profession-owned typed tasks on that
clock. Phantasms are finite skill handlers. Mesmer does not own a scheduler,
resolver wrapper, or result builder.

## Events

Event schema version 1 is defined in `platform/engine/events.js`. Every event
has:

```js
{
  type,
  at,
  source,
  sourceId,
  actorType, // "player", "summon", "effect", or "unknown"
}
```

`source` is a display/origin label and must not drive combat behavior.
Player-only sigils, relics, and traits use `actorType`. The resolver retains a
legacy source-label fallback for older scheduled streams.

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
simulator mechanics, explicit overrides, and extra skills. Callable
`skillHandlers` are registered by handler ID and dispatched by the profession
contract. Validation rejects duplicate skill IDs, missing callable handlers or
parent skills, invalid effects, invalid slots, and unavailable weapon metadata.
Canonical catalogs may also carry validated trait and specialization metadata.
Resolver behavior looks skills up by `skillId`; display-name lookup is retained
only for legacy streams and application-boundary rotation migration.

Mesmer, Guardian, and Necromancer skill mechanics use one timing contract:

- `castTimeMs` is the base action duration. `quicknessCastTimeMs` is optional
  measured compatibility data; otherwise the GW2 policy applies action-rate
  scaling and 40 ms quantization.
- `rechargeAnchor` is optional and defaults to `castEnd`; `castStart` supports
  actions whose recharge begins before a modeled aftercast ends.
- `lockouts` optionally declares skill-family availability windows as
  `{ group, durationMs }`. Activating the skill blocks only other skills that
  declare the same group; unrelated actions, cast timing, effects, and
  cooldowns are unchanged.
- explicitly timed effects declare `timingAnchor: "castStart" | "castEnd"`
  and `timingScale: "cast" | "fixed"`;
- evenly spaced effects use `atMs` plus optional `intervalMs`; irregular exact
  packets use chronological `ticks`, with coefficient data on each strike
  tick;
- all `*Ms` values are milliseconds. Legacy `activation`, `castTime`,
  `packetOffsets`, `atMsList`, inferred cast scaling, and special cast-end
  offset fields are rejected at catalog assembly.

Shared weapon data owns family strength and broad capabilities. Each canonical
profession catalog owns exact `weaponHands` metadata. Application adapters
derive their weapon selector data by combining those two sources.

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

Serial casts and shift-queued concurrent instants wait for finite cooldown,
ammo, or profession availability, including when a concurrent instant becomes
ready after its parent cast ends. Permanent availability blocks are still
invalid. Once a queued command advances to its ready time, later rotation
commands proceed from that chronological point. Cast completion and typed
tasks run chronologically, and availability is reevaluated after intermediate
tasks.

Declarative multi-hit effects emit one canonical damage event per hit. Optional
hit intervals preserve channels and persistent attacks, including effects that
finish after their cast. The GW2 scheduler policy rejects weapon skills that
are not equipped on the active set, while allowing callers without equipment
configuration to use isolated mechanic fixtures.

## Builds

The current persisted schema is:

```js
{
  schemaVersion: 3,
  profession: "mesmer", // or "elementalist" / "guardian" / "necromancer"
  // profession build fields
}
```

Each profession owns defaults, explicit version migrations, and
resource-specific normalization and validation. Native professions configure
the shared `platform/gw2/build-codec.js` factory, which owns common schema
migration, sanitization, and validation for gear, weapons, sigils, relics,
infusions, specializations, selected skills, targets, and canonical
rotations. The existing `gw2-mesmer-simulator-v2` localStorage key is kept so
saved builds migrate in place. Browser state uses a compatibility view of
rotation entries; storage and the simulator contract use normalized commands.

## Included professions

- `mesmer`: native profession-contract implementation using the shared
  canonical generated/mechanics/override catalog pipeline, with specialized
  clone, phantasm, shatter, Continuum Split, and Mirage scheduling.
- `elementalist`: direct reference-engine port exposed through an
  `elementalistProfession` contract adapter.
- `guardian`: declarative shared-engine implementation with a reproducible
  current API snapshot, an explicit supplement for API-omitted bundle skills,
  complete executable skill coverage, all specialization mechanics, Guardian
  trait rules, build validation, and a shared-shell browser application.
- `necromancer`: declarative shared-engine implementation with a reproducible
  API snapshot, API-omitted shroud/Lich/Ritualist supplements, life force,
  Reaper/Harbinger/Ritualist shrouds, Scourge shades, blight, minions,
  spirits, trait reactions, build validation, and a shared-shell application.

## Adding another profession

1. Add `js/professions/<id>/` with catalog, build, state, rules, UI view models,
   and a `defineProfession()` composition.
2. Register stable skill/trait IDs, namespaced custom event handlers, and only
   the standard event reactions the profession needs.
   Declare exact hand availability in `weaponHands` and register callable
   custom cast behavior in `skillHandlers`.
3. Add the profession page and one lazy entry to
   `js/app/profession-registry.js`; use `loadAppAdapter: null` only for a
   standalone legacy application.
4. Add an end-to-end fixture that imports no other profession.
5. Run `npm test` and `npm run check`.

No engine, GW2, or shared UI branch should be needed. New professions should
use `platform/engine` scheduler state/cooldowns and the `platform/gw2`
scheduler event factory and resolver. If a new rule is truly shared by
multiple professions, add it to `platform/gw2`; otherwise keep it in the
profession module as a scheduler mechanic or resolver reaction.
