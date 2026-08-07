# GW2 resolver reaction layer

## Status

Implemented and approved after architecture review on 2026-08-07.

The change is a net positive. It removes concrete relic, food, and resolver-time
Severance policy from generic resolver handlers, makes condition-application
recursion explicit, and preserves scheduler ownership of proc materialization.

The review corrected two blocking omissions in the original proposal:

- `weakness_vulnerability` already had a resolver-time relic consumer, so the
  canonical registry also needs `weakness-vulnerability.resolved`;
- native reaction declarations now live in `native-module-types.ts` and
  `native-mechanics.ts`, not only in `native-profession.ts`.

No legacy-key compatibility adapter was introduced. The final implementation
accepts canonical stages only.

## Purpose

The resolver previously used two dispatch styles:

1. profession behavior arrived through dynamically selected `eventReactions`;
2. common equipment behavior was imported and called directly from generic
   resolver modules.

That made generic handlers responsible for knowing which relic, food, and sigil
subsystems participated at each lifecycle boundary. It also left the important
"successful condition application" boundary implicit.

The reaction layer composes profession and equipment contributions once per
simulation pass into a typed, ordered GW2-local registry. Synchronous numeric,
state-construction, and pre-resolution work remains explicit capabilities rather
than being disguised as event reactions.

This is dependency and lifecycle cleanup. It does not change coefficients,
durations, cooldowns, event identities, proc ownership, or result shapes.

## Architecture

```text
resolve profession runtime
          |
          +-- canonical profession reaction stages
          |
          +-- createGw2ResolverExtensions(...)
                  |
                  +-- one ordered reaction registry
                  |     +-- profession hooks
                  |     +-- relic adapters
                  |     +-- resolver-side Severance adapter
                  |     +-- critical-food adapter
                  |
                  +-- equipment state factory
                  +-- relic strike-multiplier capability
                  +-- relic condition-duration capability
                  +-- passive relic timeline capability
          |
          +-- query, hit resolution, condition resolution,
              generic event handlers, runtime state, timeline resolver
```

`declarative-simulation.ts` is the composition root. It creates one
`Gw2ResolverExtensions` object and passes the same registry to event and condition
resolution.

The scope of this cleanup is resolver wiring. Existing critical-chance query
composition, static sigil calculations, and the public query's backward-compatible
relic-duration fallback remain in `query.ts`; moving those is a separate
architecture change. Production resolver construction passes the duration
capability explicitly.

## Canonical resolver stages

`Gw2ResolverReactions` is closed over `Gw2ResolverStage` instead of using an open
string record.

| Canonical stage | Dispatch boundary | Ordered consumers |
| --- | --- | --- |
| `blast-combo.resolved` | canonical blast-combo event | relic |
| `buff.applied` | after boon history/state insertion | Severance, relic, profession |
| `damage.resolved` | after base strike recording | relic damage-resolved, profession, food, relic after-hit |
| `condition.applied` | after accepted application/state/tick insertion | profession, relic |
| `condition-tick.resolved` | after tick damage resolution | profession |
| `control.resolved` | canonical control event | relic, profession |
| `blind.resolved` | canonical blind event | profession |
| `peitha.resolved` | canonical Peitha event | relic, profession |
| `weakness-vulnerability.resolved` | canonical weakness/vulnerability event | relic |
| `weapon-set.changed` | after common active-set update | profession |
| `food-proc.created` | after food event creation, before enqueue | profession decorator |

Stable registration order breaks equal numeric-order ties. Named bands make the
relative positions explicit:

```ts
const GW2_REACTION_ORDER = Object.freeze({
  EARLY_COMMON: -200,
  COMMON: -100,
  PROFESSION: 0,
  LATE_COMMON: 100,
  FINAL_COMMON: 200,
});
```

The registry reuses the engine's existing `createEventReactions()` normalizer, so
duplicate-ID rejection, stable sorting, and "last non-undefined result" semantics
remain consistent with profession hook composition. The result behavior is
required for `food-proc.created`, whose profession reaction may decorate the
derived event before enqueue.

`defineGw2ResolverReactions()` validates direct non-native authoring maps without
widening profession-specific handler signatures. It accepts the same function or
ordered-hook source shapes supported by the engine composer, rejects unknown
stages at runtime for JavaScript callers, and enforces exact stage keys at typed
declaration sites.

Native professions use `NativeResolvedReaction.stage: Gw2ResolverStage`.
Helpers such as `onResolvedDamage()`, `onConditionApplied()`, `onBuffApplied()`,
and `onFoodProcCreated()` emit canonical stages. The native compiler indexes by
`declaration.stage`. The engine-wide event-reaction contract remains unchanged.

## Behavioral invariants

### Damage

For each `damage` event:

1. build the hit-resolution context, including the existing sampled critical fact;
2. apply and record base strike damage;
3. run the relic `damageResolved` hook;
4. run the profession `damage.resolved` reaction;
5. evaluate and, when eligible, enqueue the critical-hit food proc;
6. run the relic `afterHit` hook.

Profession, sigil, and food behavior consume the same critical fact. Moving food
logic must not add, remove, or reorder random draws. The profession
`food-proc.created` decorator runs before the derived damage event is enqueued.

### Buffs and Severance

For each `buff` event:

1. insert the boon application and compute active stacks;
2. update `ctx.sigil.severanceUntil` for `sigil-severance`;
3. run the relic boon hook;
4. run the profession `buff.applied` reaction.

Expired applications remain in boon history for timestamp queries.

### Conditions

An accepted condition draft:

1. snapshots resolved duration;
2. creates the resolved application;
3. appends it to results and condition state;
4. schedules tick events;
5. dispatches the profession `condition.applied` reaction;
6. dispatches the relic condition hook;
7. returns the application.

Zero-stack and zero-duration drafts return `null` without dispatch. The only
condition-stage dispatch site is `applyCondition()`. Relic-created conditions call
that same function, so nested applications repeat the complete sequence and reach
profession reactions exactly once. Existing relic source and identity guards still
prevent invalid self-trigger loops.

### Weakness and vulnerability

`weakness_vulnerability` is a real resolver boundary used by Relic of
Aristocracy. It dispatches `weakness-vulnerability.resolved`; leaving this event as
a direct relic call would violate the generic-handler dependency goal.

## Non-event capabilities

The registry is not used for synchronous calculations or construction:

- `createGw2HitResolution()` receives the relic strike multiplier;
- `createGw2CombatQuery()` receives the relic condition-duration bonus;
- `resolveGw2Timeline()` receives the passive pre-resolution timeline hook;
- `createGw2ResolverRuntimeState()` receives the equipment state factory.

The runtime's public fields remain unchanged:

```ts
{
  relic,
  sigil: { severanceUntil: 0 },
  food: { criticalProgress: 0, readyAt: 0 },
}
```

Sigil proc generation remains in `platform/gw2/scheduler`. Only the resolver-side
Severance state update moved into the reaction adapters.

## File ownership

New resolver files:

- `resolver/reaction-registry.ts` owns canonical validation and ordered dispatch;
- `resolver/equipment-reactions.ts` owns event-driven relic, food, and Severance
  adapters;
- `resolver/extensions.ts` owns one-pass assembly and non-event capabilities.

Key modified files:

- `types.d.ts` defines stages, registry, contributions, and extensions;
- `native-module-types.ts`, `native-mechanics.ts`, and `native-profession.ts` use
  typed stage-native declarations;
- `declarative-simulation.ts` composes extensions once;
- `event-handlers.ts` performs common transitions and dispatches stages;
- `condition-resolution.ts` owns the single successful-application dispatch;
- `hit-resolution.ts`, `query.ts`, `runtime-state.ts`, and
  `resolve-timeline.ts` consume explicit capabilities;
- native profession modules declare canonical reaction stages;
- `tests/platform/gw2/gw2-resolver-reactions.test.js` covers direct registry and recursive
  condition behavior.

No `tsconfig.build.json` change is needed because its existing `js/**/*.ts` include
already discovers the new source files.

## Validation coverage

Direct tests cover:

- missing-stage no-op behavior;
- numeric ordering and stable ties;
- duplicate hook ID and unknown-stage rejection;
- last-defined return semantics;
- rejected versus accepted condition dispatch;
- state and tick visibility before condition hooks;
- nested Relic of the Fractal applications reaching profession reactions.

Existing resolver and profession suites cover:

- seeded critical and food random consumption;
- food event decoration and proc identity;
- Severance timing and critical contribution expiry;
- relic blast, boon, control, Peitha, weakness/vulnerability, strike, duration,
  and passive timeline behavior;
- same-timestamp derived-event insertion order;
- Core and elite native runtime reaction-key conformance;
- isolated equipment state per simulation.

The staged baseline contained five stale benchmark assertions unrelated to this
refactor. A clean index-snapshot comparison reproduced all five before the reaction
layer was present. They were reconciled separately by updating deterministic
manifest DPS values, current Amalgam event counts/damage, and narrow EVTC relative
error bounds. No reaction-layer behavior was changed to satisfy them.

Validation commands:

```powershell
npm run build
npm run typecheck
npm test -- tests/platform/gw2/gw2-resolver-reactions.test.js
npm test -- tests/platform/gw2/resolver-architecture.test.js
npm run check
npm test
```

## Acceptance criteria

The implementation is complete when:

- the focused and full suites pass;
- deterministic and seeded stochastic resolver fixtures retain their behavior;
- generic event handlers contain no relic, food, or Severance policy;
- generic condition resolution contains no direct relic policy;
- hit resolution, runtime state, and timeline resolution import no concrete relic
  policy;
- condition application has one post-application dispatch site;
- nested relic applications invoke profession condition reactions once per
  accepted application;
- `weakness_vulnerability` is routed through the registry;
- scheduler ownership of proc generation remains unchanged;
- the registry is composed once per simulation pass;
- only canonical stage keys exist in GW2 profession runtime reactions;
- registry construction rejects unknown stages and duplicate hook IDs;
- no legacy-key adapter or fallback exists;
- no unsafe partially initialized registry is exposed;
- no new circular import is introduced.

## Review outcome

`APPROVE`.

The architecture removes real coupling without changing the scheduler/event model.
The added machinery is proportionate: one small registry reuses the existing engine
normalizer, one adapter module owns concrete equipment policy, and one extensions
facade prevents repeated composition. The condition lifecycle becomes materially
safer because direct and recursively generated applications now share one tested
boundary.

The main remaining discipline is scope control. Future numeric equipment cleanup
should use explicit capabilities, while new event-driven behavior should register at
an existing canonical stage or introduce a separately reviewed stage.
