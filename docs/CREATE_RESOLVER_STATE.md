# Aligning `createResolverState` across professions

This is a working note for a later cleanup. It explains what
`createResolverState` does, how Mesmer, Guardian, and Necromancer currently
differ, and the concrete steps to bring the three into one consistent shape.

No behavior changes are proposed that alter DPS — this is about making the
scheduler → resolver state seam explicit and consistent.

## Background: the two-pass model

Every GW2 profession runs the same pipeline in
`js/platform/gw2/declarative-simulation.js`:

```text
scheduler  ──►  scheduled event stream  ──►  resolver  ──►  damage totals
(pass 1)                                     (pass 2)
```

Pass 1 (scheduler) builds the ordered event stream and ends with a profession
state snapshot. Pass 2 (resolver) walks that stream, resolves hits/conditions,
and runs profession `eventHandlers` / `eventReactions` that read and mutate a
profession state object.

`createResolverState` is the optional profession hook that answers a single
question: **what profession state does the resolver pass start from?**

It is consumed once, in `simulateDeclarativeGw2`:

```js
professionState:
  typeof profession.createResolverState === "function"
    ? profession.createResolverState(config, scheduled)   // fresh state
    : (scheduled.stream.resolverHandoff?.professionState   // scheduler snapshot
       ?? profession.createProfessionState(config)),       // last-ditch fallback
```

That value becomes `ctx.profession` in the resolver
(`js/platform/gw2/resolver/runtime-state.js`). Note it is used **directly, not
cloned**. (The similarly named `createResolverState` in
`js/platform/engine/resolver.js` is a different function on a different code
path — the minimal base-engine resolver — and it *does* clone. Do not confuse
the two.)

## Current state (the inconsistency)

| Profession | `createResolverState` | Resolver starts from | Coupling |
|------------|-----------------------|----------------------|----------|
| Guardian | *absent* | scheduler's **ending snapshot** (`structuredClone` of final scheduler state) | tight — relies on the handoff fallback |
| Necromancer | `config => createNecromancerState(config)` | **fresh full state** | none — ignores the scheduler |
| Mesmer | `() => ({ ineptitudeReadyAt: 0, sharperImagesProgress: 0, bloodsongProgress: 0 })` | **minimal purpose-built state** | none |

Why each is what it is:

- **Mesmer (minimal).** Its resolver only touches three accumulators
  (Ineptitude cooldown, Sharper Images progress, Bloodsong progress). All the
  rich scheduler state (clones, blades, continuum, flips) was already consumed
  producing events, so the resolver needs none of it.
- **Necromancer (fresh full).** Its reactions read/write `barbedPrecisionProgress`,
  `vampiricPresenceReadyAt`, `demonicLoreReadyAt`, and `dreadUntil`, which live
  across the full state shape. Rebuilding the whole state is the cheapest correct
  way to guarantee those fields exist and start clean.
- **Guardian (handoff).** It is the only one whose resolver *continues* the
  scheduler state instead of starting clean. Its handlers replay
  `guardian.virtue-activated` / tome / radiant-forge events and read fields such
  as `justiceHitCount`, `ashesCharges`, and `ashesNextTriggerAt`.

The divergence is **partly essential** (Guardian genuinely needs the handoff;
Mesmer/Necro genuinely can start fresh) and **partly stylistic** (Necro rebuilds
a large object to use ~4 fields, while Mesmer declares exactly what it needs).

## Risks the alignment should remove

1. **Mesmer's inline literal can silently drift.** Add a fourth resolver-mutated
   field and forget to add it here → `undefined += x` → `NaN`, with no error.
2. **Guardian's reliance on the fallback is invisible.** Nothing at Guardian's
   `defineProfession` call says "the resolver reuses the scheduler snapshot" — it
   is an *absence*. A future edit that adds `createResolverState` to Guardian
   could break it with no obvious cause. It also inherits the scheduler's
   *ending* counters, which is only correct if handlers reset them — an
   undocumented invariant.
3. **Name collision** (`createResolverState` engine fn vs profession hook) is a
   minor readability trap.

## Target model

Make all three professions **define `createResolverState` explicitly**, so the
seam is always visible at the `defineProfession` call and there is no reliance on
the implicit fallback. Pick the variant that matches each profession's real
need, but name and document it.

### Step 1 — Guardian: make the handoff explicit

Guardian must keep starting from the scheduler snapshot. Make that intent
explicit instead of leaning on the fallback branch.

In `js/professions/guardian/state.js` (or the resolver module), add:

```js
// The Guardian resolver continues from the scheduler's ending state because its
// virtue/tome/radiant-forge handlers replay transitions computed during pass 1.
export function createGuardianResolverState(_config, scheduled) {
  return scheduled.stream.resolverHandoff.professionState;
}
```

Wire it in `js/professions/guardian/definition.js`:

```js
resources: {
  createProfessionState: createGuardianState,
  createResolverState: createGuardianResolverState,
},
```

Before landing: confirm whether the ashes/justice reactions treat the inherited
counters (`justiceHitCount`, `ashesCharges`, …) as cumulative. If they do, the
handoff of *ending* values is a latent double-count and the handlers should
reset them at resolution start. Add a test that asserts the reset if needed.

### Step 2 — Necromancer and Mesmer: one fresh-state idiom

Both start clean, so give them the same shape of hook: a named
`create<Profession>ResolverState()` in the profession's `state.js`, documented
with which reactions own each field.

Mesmer — replace the inline literal with a guarded, documented factory:

```js
// state.js — fields the Mesmer resolver pass accumulates. Keep in sync with
// resolver/event-handlers.js and mechanics/trait-rules.js.
export function createMesmerResolverState() {
  return {
    ineptitudeReadyAt: 0,   // trait-rules: triggerIneptitude cooldown
    sharperImagesProgress: 0, // trait-rules: Sharper Images bleed accumulation
    bloodsongProgress: 0,   // event-handlers: Bloodsong bleed accumulation
  };
}
```

```js
// definition.js
resources: {
  createProfessionState: createMesmerState,
  createResolverState: createMesmerResolverState,
  projectEndState: projectMesmerEndState,
},
```

Necromancer — decide one of:

- **Keep the full recreate** (`createNecromancerState`) if a future resolver
  reaction may need more of the state shape. It is safe today; the only cost is
  allocating shroud/cooldown structures the resolver never reads. If kept, add a
  one-line comment at the definition site explaining why it recreates the full
  state rather than a minimal one.
- **Trim to a minimal resolver state** (`createNecromancerResolverState()`)
  mirroring Mesmer's pattern, containing only `barbedPrecisionProgress`,
  `vampiricPresenceReadyAt`, `demonicLoreReadyAt`, `dreadUntil`. Lower footprint,
  same drift risk as Mesmer, so document the field ownership the same way.

Recommendation: trim it, so Necro and Mesmer share the exact idiom (named
minimal factory in `state.js`, wired in `definition.js`, field ownership
commented).

### Step 3 — verification

- `npm test` (full suite) — the DPS/oracle tests are the guardrail; nothing
  should change.
- `npm run check` — tsc + lint for unused imports after moving factories.
- If Guardian's counters were found cumulative in Step 1, add a regression test
  for the reset.

## Definition of done

- Guardian, Necromancer, and Mesmer each define `createResolverState`
  explicitly; no profession relies on the implicit `resolverHandoff` fallback.
- Fresh-state professions (Necro + Mesmer) use the same named-factory idiom in
  `state.js`, with per-field ownership comments.
- Guardian's handoff dependency and any counter-reset invariant are documented in
  code.
- Full test suite and `npm run check` pass with no DPS changes.
