# Consolidation Analysis & Spec — Guardian / Mesmer / Necromancer

Scope: Guardian, Mesmer, Necromancer. Elementalist is explicitly excluded
(legacy, pre-dates the general design). Focus: where each profession diverges
from core engine handling and where logic can be pulled up into the shared
`platform/` and `app/` layers. Bugs are noted where seen but are secondary.

Reference for "intended design" throughout is the project's own
[ARCHITECTURE.md](ARCHITECTURE.md).

> **Status:** The app-integration consolidation (§5 WI-1/2/3) is
> **implemented and validated** (285 tests + `npm run check` green). The
> Mesmer engine items (WI-5, WI-6) were **investigated and deliberately not
> done**: both fail a "won't break anything" bar for concrete, evidenced
> reasons (§5). WI-4 was withdrawn earlier (§3.3). No safe Mesmer-engine
> consolidation remains without a dedicated, fixture-guarded migration.

---

## 1. Executive summary

The platform defines a clean, hook-driven profession contract
(`defineProfession`) and a generic engine (`platform/engine/scheduler.js` +
`platform/gw2/declarative-simulation.js` + `platform/gw2/resolver/*`).

| Profession | Engine path | Verdict |
|---|---|---|
| **Necromancer** | Declarative shared engine via `contract.js` hooks | ✅ Reference-compliant |
| **Guardian** | Declarative shared engine via `mechanics/contract.js` hooks | ✅ Reference-compliant |
| **Mesmer** | Own scheduler orchestration + `simulateSequence`, reached via `simulation.simulate`; **but built on shared platform primitives** | ⚠️ Partially divergent |

Two problems were identified, of very different size and risk:

1. **App-integration layer was copy-pasted per profession** — `app/adapter.js`,
   `app/app-runtime.js`, and `core/calc-attributes.js` were ~90–95%
   duplicated across all three (and every future profession). This is the
   **larger, safer, higher-leverage** consolidation. ✅ **Done this pass.**

2. **Mesmer runs a bespoke simulation orchestration.** Important correction to
   the first-pass read: Mesmer does **not** fork the engine primitives. Its
   `scheduler/` and `resolver/` files are **thin shims** that inject
   Mesmer-specific behavior into the shared platform primitives (see §3.1).
   What remains genuinely Mesmer-owned is (a) a bespoke scheduler *wiring*
   that composes clone/phantasm/continuum/mirage controllers, which
   ARCHITECTURE.md explicitly permits for "actor-specific timing", and (b) the
   hand-rolled `simulateSequence` builder in `mesmer/simulation.js`, which
   re-implements generic lifecycle logic the platform scheduler already
   provides. Only (b) is unjustified duplication, and retiring it is XL/high
   risk (§5 WI-5).

Guardian and Necromancer remain the reference citizens.

---

## 2. The reference contract (what "compliant" looks like)

`defineProfession` (`js/platform/engine/profession.js`) composes a frozen
profession from optional hooks; the generic scheduler
(`js/platform/engine/scheduler.js`) drives the whole cast lifecycle and calls
the profession only through hooks: `validateCast`, `scheduleSkill`,
`afterCast`, `advance`, `snapshot`, `modify*`, plus
`resolverHooks.eventHandlers` / `eventReactions`.

The generic scheduler owns concurrent-offset casts, interrupt truncation,
combat-start, waits, ammo/cooldown bookkeeping, step recording, event
ordering, and the resolver hand-off
([scheduler.js:242-451](js/platform/engine/scheduler.js#L242-L451)).
`simulateDeclarativeGw2` owns the query and canonical `endState`
([declarative-simulation.js:196-312](js/platform/gw2/declarative-simulation.js#L196-L312)).

**Necromancer** wires exactly this via
[necromancer/contract.js](js/professions/necromancer/contract.js).
**Guardian** wires the same shape via
[guardian/mechanics/contract.js](js/professions/guardian/mechanics/contract.js),
split across mechanic files. Neither copies engine code. Both prove the
contract handles complex kits (shrouds/Lich/shades; tomes/virtues/forge).

---

## 3. Divergence inventory

### 3.1 Mesmer — bespoke orchestration on shared primitives

**Already shared (thin shims — no consolidation needed):** each of these
Mesmer files simply configures the platform primitive with Mesmer hooks.

| Mesmer file | Delegates to | Injects |
|---|---|---|
| `scheduler/scheduler-state.js` | `platform/engine` `createSchedulerState` | `infiniteForge` flag |
| `scheduler/cooldown-controller.js` | `platform/engine` `createCooldownController` | Split Second / Shatter Storm ammo |
| `scheduler/event-factory.js` | `platform/gw2` `createGw2SchedulerEventFactory` | blade decoration, expected-proc queueing |
| `resolver/resolve-timeline.js` | `platform/gw2` `resolveGw2Timeline` | Mesmer handlers + clone-death filter |
| `resolver/condition-resolution.js` | `platform/gw2` `createGw2ConditionResolution` | Mesmer condition reactions |
| `resolver/hit-resolution.js` | `platform/gw2` `createGw2HitResolution` | `targetHealthMultiplier` |
| `resolver/runtime-state.js` | `platform/gw2` `createGw2ResolverRuntimeState` | Mesmer state seed |

**Genuinely Mesmer-owned (justified — keep separate):** clone/phantasm/
continuum/mirage mechanics and expected-proc tracking
(`scheduler/{cast,continuum,resource,skill-effects}-controller.js`,
`scheduler/expected-procs.js`, `resolver/{event-handlers,resolver-profile,
resolver-query,combat-stats,damage-modifiers}.js`). ARCHITECTURE.md
§"Profession contract" sanctions this: *"A profession with actor-specific
timing, such as Mesmer clone and phantasm attacks, composes its own mechanic
controllers over the shared scheduler state, cooldown controller, and GW2
event factory."*

**The one unjustified duplication — `mesmer/simulation.js`:**
`simulateSequence` (~370 lines) hand-rolls concurrent-weave placement,
interrupt truncation, combat-start, step recording, and end-state
cooldown/ammo export — all of which the generic scheduler's `cast()`/`run()`
and `declarative-simulation`'s `endState()` already do generically. Its own
`createScheduler` (`scheduler/scheduler.js`) drives `cast`/`advanceTo` in
parallel to the platform scheduler rather than composing over it. This is the
real remaining structural liability, and the only place Mesmer copies logic
it should not. Retiring it is WI-5 (XL/high risk).

Secondary: `resolver/condition-resolution.js` and `resolver/resolver-profile.js`
rebuild reactions with `createEventReactions(mesmerResolverEventReactions)`
([condition-resolution.js:11](js/professions/mesmer/resolver/condition-resolution.js#L11)),
while `defineProfession` also builds `profession.eventReactions` from the same
source. The `resolverHooks` in `mesmer/definition.js` is therefore dead for the
production path (WI-6).

### 3.2 App-integration layer — copy-pasted across all three ✅ FIXED

Before this pass:

- **`app/adapter.js`** — three structurally identical files differing only in
  literals (`storageKey`, `globalName`, `filenames`, `resetPrompt`,
  `specializationFallback`) and two closures (`isSkillAvailable`,
  `defaultOffhand`).
- **`app/app-runtime.js`** — `guardian`↔`necromancer` differed by ~5 lines;
  `mesmer` only by code style + two config hooks. `eliteSpecialization`,
  `recalculate`, `modifierCandidates`, `modifierContributionRequest`,
  `calculateModifierContributions`, `runSimulation` were byte-for-byte copies.
- **`core/calc-attributes.js`** — the same ~20-line wrapper three times.

See §"Work completed" for how these were factored.

### 3.3 Composition wiring — Mesmer is the synchronous default (by design)

[app/composition.js](js/app/composition.js) eagerly imports Mesmer and exports
it as `activeProfession` / `activeProfessionAppAdapter`; the others lazy-load.
**Revised finding:** this is **not** merely legacy bias. `app/app-state.js`
consumes `activeProfessionAppAdapter` synchronously at module load
([app-state.js:3](js/app/app-state.js#L3): `STORAGE_KEY =
activeProfessionAppAdapter.storageKey`) and as default parameters, and tests
depend on the default resolving to Mesmer synchronously. Making Mesmer lazy
requires reworking the default-adapter resolution to be async — larger than a
quick win. **WI-4 is withdrawn** (see §5).

---

## 4. Consolidation targets

| # | Extract | Status |
|---|---|---|
| A | `createGw2AppAdapter(options)` factory | ✅ Done → `app/create-app-adapter.js` |
| B | `createProfessionRuntime(descriptor)` shared orchestration | ✅ Done → `app/create-profession-runtime.js` |
| C | `createCalculateAttributes(applyRules)` | ✅ Done → `platform/gw2/attributes.js` |
| D | Retire Mesmer `simulateSequence`; fall through to `simulateDeclarativeGw2` | ⛔ WI-5 — not safe as a contained change (§5) |
| E | Remove "dead" `resolverHooks` double-wiring | ⛔ WI-6 — not dead; enforced by tests (§5) |
| F | ~~Make Mesmer lazy-loaded~~ | ❌ Withdrawn (see §3.3) |

---

## 5. Work spec sheet

### WI-1 — Shared app-adapter factory *(A)* — ✅ DONE
- `app/create-app-adapter.js` owns weapon-data assembly, relic list, renderer
  wiring, and the frozen adapter shape. Each `app/adapter.js` is now a config
  call. Adapter object shape byte-identical to before.

### WI-2 — Shared runtime orchestration *(B)* — ✅ DONE
- `app/create-profession-runtime.js` owns `eliteSpecialization`, `recalculate`,
  `simulationConfig`, `modifierCandidates`, `modifierContributionRequest`,
  `calculateModifierContributions`, `computeModifierContributions`,
  `runSimulation`. Two optional seams — `buildConfigInputs` (into
  `createGw2SimulationConfig`) and `buildConfigExtras` (merged onto the
  config) — carry the only profession-specific bits (Guardian tome pages;
  Necromancer initial resource/blight; Mesmer clone-start resource +
  Malicious Sorcery). `eliteSpecialization` now derives elite names from the
  catalog for every profession, removing Mesmer's hardcoded list.

### WI-3 — Shared calc-attributes wrapper *(C)* — ✅ DONE
- `createCalculateAttributes(applyRules)` in `platform/gw2/attributes.js`;
  the three `core/calc-attributes.js` wrappers are one call each.

### WI-4 — Mesmer lazy-load parity — ❌ WITHDRAWN
- Not safe without reworking synchronous default-adapter resolution (§3.3).
  Not worth the risk for the structural gain.

### WI-5 — Retire Mesmer `simulateSequence` *(D — the big one)* — ⛔ NOT SAFE AS A CONTAINED CHANGE
- **Effort:** XL · **Risk:** High · **Investigated; deferred.**
- **Blocker (evidenced):** Mesmer's scheduler is a *different cast model* from
  the platform scheduler, not just a different wiring of the same one:
  - **Auto-wait vs reject.** Mesmer's `cast`
    ([cast-controller.js:145-164](js/professions/mesmer/scheduler/cast-controller.js#L145-L164))
    advances `state.time` to a skill's ready time when it is on cooldown
    (`config.autoWaitForCooldowns`), with bespoke Continuum-expiry handling.
    The platform scheduler instead marks an on-cooldown cast **invalid** and
    does not advance
    ([scheduler.js:263-279](js/platform/engine/scheduler.js#L263-L279)). Mesmer
    rotations (and `simulateRotation`'s cooldown-cycling loop) rely on the
    auto-wait; the platform has no such policy.
  - **Activation model differs.** Mesmer uses `baseActivation / quickness`
    with a `Math.max(0.05, …)` floor and a 0.5s default for positive-id skills
    ([cast-controller.js:177-183](js/professions/mesmer/scheduler/cast-controller.js#L177-L183));
    the platform uses `baseDurationSeconds` + scheduler policy. Different cast
    durations → different event timings.
  - **Post-hoc concurrency shifting.** `simulateSequence` shifts whole blocks
    of already-emitted events (plus Continuum cooldowns, ammo, pending
    resources) for concurrent weaves; the platform computes the start *before*
    emitting. Opposite ordering of operations.
  - Consequence: swapping the scheduler changes cast semantics and would break
    a large fraction of the 285 tests unless the platform scheduler first grows
    a matching auto-wait policy and Mesmer's exact activation defaults. That is
    a multi-step migration behind golden-master fixtures, **not** a change that
    "won't break anything."
- **Recommended path when undertaken:** first add an opt-in `autoWaitForCooldowns`
  policy to the platform scheduler (benefits all professions), reconcile the
  activation defaults, then migrate Mesmer controller-by-controller against a
  golden-master oracle. Dedicated effort, not a cleanup pass.

### WI-6 — Remove Mesmer "dead" reaction wiring *(E)* — ⛔ NOT SAFE / NOT ACTUALLY DEAD
- **Effort:** S · **Risk:** Low-looking but blocked. **Investigated; withdrawn.**
- **Correction:** the `resolverHooks` in `mesmer/definition.js` are **not** dead.
  [platform-architecture.test.js:784-796](tests/platform-architecture.test.js#L784-L796)
  asserts `mesmerProfession.eventReactions.damage`/`.control` are functions and
  that `eventHandlers` exposes only `mesmer.*` namespaced keys. That wiring is
  the enforced profession-contract surface; removing it breaks tests.
- The only genuine redundancy is that `resolver/resolver-profile.js` and
  `resolver/condition-resolution.js` *also* call
  `createEventReactions(mesmerResolverEventReactions)` on the same source. It
  cannot be replaced by consuming `profession.eventReactions` because that
  creates an import cycle (`definition.js → simulation.js → resolve-timeline.js
  → resolver-profile.js → definition.js`), leaving `mesmerProfession` in the
  temporal dead zone at module-eval time. Both paths already import the same
  source module, so this is cheap, harmless duplication — no safe win here.

---

## 6. Structural/consistency notes (non-blocking)

- **Guardian vs Necromancer file layout differs** without a functional reason
  (Guardian splits `mechanics/*` + `mechanics/contract.js`; Necromancer keeps
  a flatter `mechanics.js` + `skill-handlers.js` + root `contract.js`). Both
  compliant. Pick one convention and document it under §"Adding another
  profession". Optional.
- **`ids.js`** exists for Guardian/Necromancer but not Mesmer (Mesmer uses
  name-keyed lookups). Aligning Mesmer to stable IDs matches the platform rule
  and pairs naturally with WI-5.
- **`resolver/timeline-index.js`** (Mesmer) may overlap
  `platform/gw2/timeline-index.js`; confirm during WI-5 whether it can be a
  shim like the other resolver files.

---

## 7. Bugs noted in passing (secondary)

- **Elementalist has no `app/adapter.js` loader** in
  [composition.js](js/app/composition.js#L35-L49) (`appAdapterLoaders` lists
  only mesmer/guardian/necromancer) though `professionOptions`/
  `professionLoaders` include it. Selecting Elementalist yields a null adapter.
  Out of scope but flagged.
- **Mesmer dead `resolverHooks`** (§3.1 / WI-6): a latent edit-trap — wiring in
  `mesmer/definition.js` never takes effect on the production path.

---

## Work completed in this pass

New shared modules:
- `js/app/create-app-adapter.js` (69 lines)
- `js/app/create-profession-runtime.js` (235 lines)
- `createCalculateAttributes()` added to `js/platform/gw2/attributes.js`

Per-profession files collapsed to thin descriptors:

| File | Before (lines) | After (lines) |
|---|---|---|
| `*/app/adapter.js` | 62 / 62 / 61 | 45 / 43 / 44 |
| `*/app/app-runtime.js` | 188 / 196 / 188 | 22 / 39 / 26 |
| `*/core/calc-attributes.js` | 23 / 18 / 23 | 12 / 10 / 12 |

Net **−667 / +126** lines across the touched profession files (the two shared
factories absorb the removed duplication and every future profession reuses
them). Behavior preserved: `npm run check` (243 files) and the full suite
(285 tests) pass, including the Mesmer attribute/contribution tests that
import these modules directly.

Remaining recommended work: WI-5 (+WI-6) — the Mesmer `simulateSequence`
retirement — is the only substantive consolidation left, and is deliberately
left for a dedicated, fixture-guarded effort.
