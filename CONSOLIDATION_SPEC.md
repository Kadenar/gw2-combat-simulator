# Consolidation status — Guardian / Mesmer / Necromancer

Scope: Guardian, Mesmer, Necromancer. Elementalist remains explicitly
excluded.

Status: implemented.

The dedicated Mesmer standard-simulator migration superseded the deferred
WI-5/WI-6 analysis that previously lived here.

## Current state

Guardian, Mesmer, and Necromancer all enter the same public pipeline:

```text
simulateGw2
  → platform engine scheduler
  → canonical scheduled-event stream
  → shared GW2 resolver
  → canonical result builder
```

The platform engine owns rotation normalization, the chronological clock,
finite cooldown waiting for serial and shift-queued concurrent casts, cast
start/completion, cooldowns, ammo, typed tasks, deterministic ordering, and the
resolver handoff.

Mesmer supplies only profession state and hooks:

- structured build, chain, flip, ambush, and resource availability;
- cast/recharge/ammo modifiers;
- typed clone, resource, expected-proc, Infinite Forge, and Continuum tasks;
- shatter, phantasm, Mirage, instrument, and Continuum handlers;
- resolver attribute rules, custom handlers, and standard-event reactions;
- public state projection under `endState.profession`.

The private Mesmer simulator, scheduler tree, resolver constructors, and
clone-death resolver filter were removed. Clone replacement and shattering
cancel task ownership before future clone events are emitted.

## Shared capabilities added

- ordered structured availability with finite retry timestamps;
- task-aware waiting and progress guards;
- chronological in-flight cast reservations;
- cast-start and cast-completion hooks;
- typed serializable tasks ordered by time, priority, and insertion;
- task cancellation by ID or owner;
- scheduled-event observation for scheduling-relevant deterministic procs;
- profession end-state projection;
- one unconditional `simulateGw2()` orchestration.

## Validation

The repository test suite covers Guardian, Mesmer, and Necromancer behavior,
including cooldown waiting, concurrency, interruptions, weapon validation,
clone cancellation, phantasms, Mirage, instruments, expected procs,
Continuum restore/expiry, relics, damage, and canonical end state.

Required verification:

```powershell
npm test
npm run check
rg "professions/mesmer/simulation|simulateSequence" js tests
rg "simulation:\s*Object" js/professions/mesmer
```
