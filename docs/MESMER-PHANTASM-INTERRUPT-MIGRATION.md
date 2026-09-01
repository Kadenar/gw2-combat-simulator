# Mesmer phantasm interrupt migration

Status: Proposed  
Last updated: 2026-08-31

## Problem statement

Phantasmal Swordsman and Phantasmal Warlock currently declare their launch point through the Mesmer-only
`phantasmSummonProgress` field. The Core Mesmer completion handler uses that fraction to retain the phantasm after an
interrupt, but the shared scheduler, rotation editor, and log reconstruction only understand `interruptCommitMs`.

That split produces contradictory results:

- An interrupted Phantasmal Swordsman at 720 ms can summon and later deal phantasm damage inside the Mesmer handler.
- The shared scheduler still marks the action `cancelled` because the skill has no `interruptCommitMs`.
- The rotation editor reports that no damage commit time exists.
- EVTC and dps.report reconstruction cannot safely preserve the observed 720 ms or 760 ms cast and instead falls back
  to the full Quickness cast.

The simulator therefore cannot consistently represent the measured shortened casts even though its Mesmer-specific
logic already knows that the phantasm launched.

## Existing contracts

| Field | Owner | Meaning |
| --- | --- | --- |
| `interruptMs` | Rotation command | When this activation was stopped |
| `interruptCommitMs` | Skill or effect metadata | Earliest interruption that counts as a committed launch |
| `persistsAfterInterrupt` | Effect metadata | A committed effect may keep future packets after interruption |
| `phantasmSummonProgress` | Mesmer metadata | Mesmer-only duplicate of the launch cutoff, stored as a cast fraction |

`interruptCommitMs` and `persistsAfterInterrupt` solve different problems. The cutoff proves that the action launched;
persistence controls what remains scheduled after that launch.

## Why `persistsAfterInterrupt` is not sufficient today

Mesmer phantasms use the replacing `mesmer.phantasm` handler. Catalog preparation moves their effects from `effects`
to `mesmerEffects`, leaving the shared declarative scheduler with an empty effect list. The shared scheduler therefore
never evaluates `persistsAfterInterrupt` for those phantasm effects.

The custom phantasm path also schedules more than declarative packets: summon and attack events, trait procs,
Chronophantasma repeats, and clone or blade conversion. Moving that entire state machine into the declarative effect
materializer is not required to fix the commit bug.

The minimum migration should use the shared commit metadata while retaining Mesmer's existing lifecycle scheduler.

## Target behavior

### Phantasmal Swordsman

The measured Quickness cast lasts 880 ms. The phantasm commits at 720 ms, while the separate player strike lands at
approximately 759 ms.

| Interrupt | Action committed | Phantasm lifecycle | Player strike |
| ---: | --- | --- | --- |
| 719 ms | No | No | No |
| 720 ms | Yes | Yes | No |
| 750 ms | Yes | Yes | No |
| 760 ms | Yes | Yes | Yes |

The 720 ms commit must make the action non-cancelled and preserve the later phantasm attacks and conversion. It must
not pull the independent player strike earlier than its actual packet time.

### Phantasmal Warlock

The measured Quickness cast lasts 840 ms and the phantasm commits at 640 ms.

| Interrupt | Action committed | Phantasm lifecycle |
| ---: | --- | --- |
| 639 ms | No | No |
| 640 ms | Yes | Yes |

## Proposed migration

### Phase 1: add the shared metadata

- Add `interruptCommitMs: 720` to Phantasmal Swordsman.
- Add `interruptCommitMs: 640` to Phantasmal Warlock.
- Temporarily retain `phantasmSummonProgress` so this phase changes the scheduler, editor, and reconstruction contract
  without changing the custom Mesmer lifecycle.
- Add focused assertions that 720 ms and 760 ms Swordsman commands are emitted as committed actions and deal the
  expected independent sources of damage.

This phase fixes the immediate representation failure. It intentionally duplicates the cutoff only for the duration
of the migration.

### Phase 2: make the scheduler result authoritative

- In Core Mesmer cast completion, replace the `phantasmSummonProgress` threshold calculation with the scheduler's
  action result: an interrupted phantasm continues only when `context.action.cancelled !== true`.
- Use the same scheduler result for Troubadour Harmonize instead of recalculating the summon fraction.
- Continue passing `playerEffectEnd: context.effectiveEnd` so the player's strike remains independently interruptible.
- Continue anchoring `phantasmSummonAt` to `context.effectiveEnd` for a committed shortened cast.
- Delete `phantasmSummonProgress` from the Mesmer skill type and both skill definitions.

After this phase, `interruptCommitMs` is the single launch cutoff used by the scheduler, UI, reconstruction, Core
Mesmer, and Troubadour.

### Phase 3: consider generic lifecycle persistence only if needed

Do not migrate the full phantasm state machine to declarative effects as part of this fix. That would require generic
persistence support for resource conversion and custom scheduled tasks in addition to effect packets.

Revisit this only if another profession needs the same persistent summon lifecycle. At that point, extend the shared
lifecycle/task contract and migrate all consumers together rather than adding another Mesmer-specific flag.

## Required timing decision

`phantasmSummonProgress` currently scales the cutoff with the actual cast duration. `interruptCommitMs` is currently
compared as an absolute elapsed duration by the scheduler.

Before deleting the fraction, verify the non-Quickness behavior in game or from logs:

- If 720 ms and 640 ms are fixed launch times regardless of Quickness, use the existing absolute
  `interruptCommitMs` semantics and accept the current fraction as inaccurate outside the Quickness timeline.
- If the launch point scales with the cast, add an opt-in generic cast-scaled commit mode and make the scheduler,
  editor, and reconstruction use the same projected cutoff. Do not silently rescale every existing
  `interruptCommitMs`, because other skills currently rely on absolute milliseconds.

The Quickness cases should not wait on this decision: Phase 1 can land independently and fixes the known 720 ms and
760 ms failures.

## Focused acceptance tests

- Swordsman at 719 ms: action is cancelled; no player hit, summon, phantasm attack, or conversion.
- Swordsman at 720 ms: action is committed; summon, later phantasm attacks, and conversion occur; player hit does not.
- Swordsman at 750 ms: same as 720 ms; player hit still does not occur.
- Swordsman at 760 ms: action is committed; player hit and phantasm lifecycle both occur.
- Warlock at 639 ms: action is cancelled and no phantasm lifecycle occurs.
- Warlock at 640 ms: action is committed and its phantasm lifecycle occurs.
- Chronophantasma: a committed shortened cast retains the repeat attack and delayed conversion.
- Troubadour Harmonize: grants its resource once after a committed phantasm and not before the cutoff.
- Rotation editor: exposes 720 ms and 640 ms as the minimum damage commit cutoffs.
- EVTC and dps.report reconstruction: retain observed action-tick-aligned committed casts instead of replacing them
  with the full Quickness cast.
- Non-Quickness variants: match the timing decision above before `phantasmSummonProgress` is removed.

## Files expected to change

- `js/games/gw2/content/professions/mesmer/core/skills/weapons/sword.ts`
- `js/games/gw2/content/professions/mesmer/core/skills/weapons/staff.ts`
- `js/games/gw2/content/professions/mesmer/core/skills/cast-lifecycle.ts`
- `js/games/gw2/content/professions/mesmer/specializations/troubadour/mechanics/instrument-rules.ts`
- `js/games/gw2/content/professions/mesmer/types.d.ts`
- Focused Mesmer rotation, editor, and reconstruction tests

The platform scheduler should not need a Mesmer-specific branch. It changes only if the non-Quickness evidence proves
that an opt-in generic scaled cutoff is required.

## Completion criteria

The migration is complete when shortened Swordsman and Warlock casts are represented consistently at every layer,
`phantasmSummonProgress` has no remaining references, and one scheduler commitment result controls both the action and
the custom phantasm lifecycle.
