# Resolution Horizon Cleanup Contract

## Purpose

This document defines the cleanup that removes profession- and effect-owned
`extendsResolutionHorizon` policy while preserving delayed attacks, target
death, condition resolution, and intentional animation interruption.

The cleanup must preserve the two-phase simulator architecture:

- the scheduler materializes casts, committed packets, and bounded profession
  tasks;
- the resolver processes those events only through an explicit observation
  boundary or target death.

`resolutionEndTime` remains a useful engine concept. Individual skills,
traits, summons, buffs, conditions, and events must not choose it.

## How to use this contract

Implementation work must:

1. Preserve every invariant below.
2. Add the required contract tests before removing the final compatibility
   path.
3. Migrate all profession uses rather than leaving permanent exceptions.
4. Run the supported-build benchmark corpus before changing benchmark history.
5. Record validation evidence in the ledger at the end of this file.

Any deliberate semantic change must update this contract in the same change.

## Terms

**Rotation end**
: The end of the entered player-command timeline. It is derived from casts,
cast-lane reservations, concurrent actions, and explicit waits.

**Observation end**
: The latest time the resolver is permitted to process. It is represented by
`resolutionEndTime` in a scheduled event stream.

**Effective end**
: Target death when the target dies before observation end; otherwise
observation end.

**Scheduled packet**
: A timestamped application materialized from a skill, trait, summon, combo,
or other mechanic.

**Committed packet**
: A scheduled packet that remains valid after its originating cast is
interrupted.

**Persistent actor**
: A summon, upkeep, field, or other mechanic that may schedule repeated work
after its creating cast.

## Current problem

The current scheduler derives `resolutionEndTime` from events carrying
`extendsResolutionHorizon`. That turns local skill metadata into a global
encounter decision.

Extending the resolver horizon for one event also permits unrelated events,
condition ticks, procs, and profession reactions to resolve through the later
time. It may therefore change total damage, target death, the DPS window, and
benchmark results for reasons unrelated to the marked event.

The working-tree audit on 2026-08-14 found 65
`extendsResolutionHorizon: true` propagation sites across 21 profession files.
The sites include delayed strikes, wells, projectiles, summoned attacks,
conditions, upkeep effects, traits, helper parameters, and marker-only horizon
sentinels. This is not one coherent game mechanic.

## Non-negotiable invariants

### Command timeline

- Only entered commands and their cast-lane rules determine rotation end.
- A delayed packet must not extend rotation end.
- An observation tail must not create a player action or change rotation
  duration.
- An explicit `wait` command is player inactivity and therefore does extend
  rotation end.

### Continuing rotations

Delayed packets from earlier casts resolve normally while later commands are
in progress. No special horizon metadata is needed.

For example:

```text
0.000  Well starts
0.600  Well cast ends; the next skill starts
1.000  A Well pulse lands
1.400  The next skill would complete
```

If the pulse is nonlethal, it receives its normal damage attribution and the
next skill continues. If the pulse is lethal, effective end is `1.000`; the
time spent beginning the next skill remains in the DPS window, but packets and
completion effects after death do not resolve.

### Resolution boundary

- Observation policy is supplied by the simulation request or calling mode.
- Observation end must be finite and must not precede rotation end.
- Target death always clips observation end.
- The resolver applies one global effective end consistently to scheduled
  events, generated condition ticks, proc reporting, cast attribution, and
  result filtering.
- No event field may enlarge the global observation boundary.
- The resolver must not search event metadata for an observation policy.
- Saved build and rotation metadata must not select an observation policy.

### Terminal observation modes

The public names may change, but the simulator must support behavior
equivalent to:

```ts
type ObservationPolicy =
  | { readonly kind: "rotation" }
  | { readonly kind: "tail"; readonly durationMs: number }
  | { readonly kind: "absolute"; readonly endTimeMs: number };
```

Rules:

1. `rotation` is the default and sets observation end to rotation end.
2. `tail` observes a finite duration after rotation end without adding a
   player command.
3. `absolute` observes through a finite simulation-clock timestamp. It is for
   an explicit fixed-clock simulation request.
4. A target death before the chosen boundary ends resolution immediately.
5. Negative, non-finite, or contradictory boundaries are rejected.
6. Observation policy must be available before profession task materialization
   so bounded actors can emit through the requested window.

Saved benchmark rotations contain authored actions, not observation policy.
Benchmark runners and corpus-capture tools use the default rotation boundary.
Imported logs remain external comparison targets; their timestamps must not
be fed back into the simulation. A non-benchmark caller that intentionally
needs a fixed-clock simulation may select `absolute` directly in its request.

### Packet scheduling

- Finite delayed packets are materialized from authored timing even when their
  timestamps are after observation end.
- Observation end controls resolution, not whether finite packets exist in the
  scheduled stream.
- A later command automatically makes earlier packets observable when their
  timestamps fall within the continuing rotation.
- Packet timing, coefficients, conditions, combo ownership, and actor
  ownership remain unchanged by this cleanup.

### Interruption persistence

`persistsAfterInterrupt` controls cancellation only.

- Packets at or before the interruption time remain because they already
  occurred.
- Future packets without `persistsAfterInterrupt` are cancelled.
- Future packets with `persistsAfterInterrupt` survive only after the skill's
  commit point.
- Interruption before `interruptCommitMs` cancels the activation's future
  packets.
- A skill that can retain future packets must declare an explicit commit point;
  `interruptCommitMs: 0` means immediate commitment.
- `persistsAfterInterrupt` must not change rotation end, observation end, DPS
  duration, or profession task lifetime.

This permits a rotation entry to cut a modeled aftercast after the in-game
commit point while retaining the projectile, field, channel packets, or other
effects that Guild Wars 2 does not cancel.

### Conditions

- Condition applications use their authored natural duration.
- Condition damage is integrated only through effective end.
- Extending observation for one test or simulation legitimately extends every
  active condition because the caller explicitly selected a later encounter
  boundary.
- No skill may create a marker event solely to obtain additional condition
  ticks.

### Persistent actors and profession tasks

- Every persistent actor needs an explicit start, lifetime or stop condition,
  and bounded scheduling rule.
- Recurring actors schedule only while active and only through the requested
  observation window.
- A summon or upkeep effect must not extend the observation window merely
  because it could produce another attack.
- Target death stops resolver-side actor output.
- Scheduler task draining must have a finite bound and must not follow a
  recurring actor indefinitely.
- `extendsProfessionTaskHorizon` may not be used as a replacement for
  `extendsResolutionHorizon`. Any remaining need for it must be documented and
  audited separately.

### Result fields

- `duration` continues to describe the entered rotation timeline.
- `dpsWindow` ends at effective end and begins at the existing combat/DPS start
  boundary.
- `deathTime` records the lethal timestamp when present.
- `events`, `resolvedEvents`, `procSteps`, cast counts, and damage breakdowns
  exclude work after effective end.
- An explicit observation tail may make `dpsWindow` longer than `duration`.
- An explicit wait increases both the entered rotation duration and the
  minimum possible observation end.

## Ownership contract

### Platform engine

The platform engine owns:

- normalized observation-policy validation;
- rotation end and observation end as separate timestamps;
- scheduled-stream transport of those timestamps;
- generic interruption and commit behavior;
- finite task draining.

The platform engine must remain profession-neutral.

### GW2 resolver

The GW2 resolver owns:

- target-death clipping;
- chronological processing through effective end;
- condition integration through effective end;
- result filtering and DPS-window calculation.

### Profession modules

Profession modules own:

- packet timing and damage mechanics;
- explicit effect persistence and interrupt commit points;
- summon, field, upkeep, and transformation lifetimes;
- profession reactions to events within the supplied observation window.

Profession modules must not own or extend the global observation boundary.

### Tests and callers

- Scheduler packet tests should inspect the scheduled stream directly when
  resolver behavior is not under test.
- Resolver packet tests should provide an explicit observation tail or a real
  following action.
- Tests must not depend on unrelated skill metadata to keep the resolver open.
- Benchmark fixtures, runners, and metric-capture tools must not load an
  observation policy from saved build or rotation metadata.
- Saved rotations must not gain synthetic waits merely to hide a horizon bug.
  A wait is valid only when it represents actual player inactivity.

## Prohibited implementations

- Retaining `extendsResolutionHorizon` under a new name on skills or events.
- Automatically extending observation to the latest damage-bearing event.
- Automatically extending observation to every
  `persistsAfterInterrupt` packet.
- Letting the latest condition expiry, summon attack, or recurring task choose
  encounter length implicitly.
- Adding profession-specific resolver exceptions.
- Reading observation policy from saved benchmark metadata or deriving it
  from a comparison log's boundary.
- Updating benchmark history without identifying whether a change comes from
  timing, target death, condition integration, or observation policy.
- Adding waits to production rotations solely to preserve obsolete tests.

## Migration plan

### Phase 0: Characterization

- [x] Generate a complete inventory of direct flags, helper parameters,
      catalog metadata, marker sentinels, and tests that depend on them.
- [x] Capture supported-build results before the migration.
- [x] Classify every use as a finite packet, interruption case, persistent
      actor, condition-tail sentinel, or stale test dependency.
- [x] Add the core behavior fixtures listed in the validation matrix.

Gate: every existing use is classified; no use is deleted only because its
current focused test happens to pass.

### Phase 1: Observation-policy plumbing

- [x] Add the simulation-level observation policy.
- [x] Pass the normalized observation end to the scheduler and resolver.
- [x] Keep rotation duration independent from an observation tail.
- [x] Preserve target-death clipping.
- [x] Reject invalid boundaries.

Gate: platform fixtures prove rotation, tail, absolute, and target-death
behavior without any profession metadata.

### Phase 2: Packet and interruption migration

- [x] Remove horizon flags from finite strikes, projectiles, wells, fields,
      conditions, controls, buffs, and trait procs.
- [x] Preserve authored packet timestamps.
- [x] Add or verify explicit `interruptCommitMs` values for persistent effects.
- [x] Verify pre-commit cancellation and post-commit persistence.
- [x] Replace isolated resolver-test dependencies with explicit observation.

Gate: every migrated profession passes delayed-packet and interrupt fixtures,
and a continuing rotation resolves the same pre-death packets without a tail.

### Phase 3: Persistent actor migration

- [x] Replace artificial horizon markers with explicit actor lifetimes.
- [x] Bound summon, upkeep, field, ally-proc, and repeating profession work by
      lifetime and observation end.
- [x] Ensure target death suppresses later actor output.
- [x] Verify that default rotation observation cannot run recurring tasks
      forever.

Gate: persistent actor fixtures pass with short, long, and death-clipped
observation windows.

### Phase 4: Remove compatibility surface

- [x] Remove `extendsResolutionHorizon` from scheduler logic.
- [x] Remove it from effect metadata allowlists and shared types.
- [x] Remove helper parameters that propagate it.
- [x] Remove all profession and generated-data occurrences.
- [x] Add an architecture test that rejects the field in source and catalog
      data.
- [x] Document the public observation-policy API.

Gate: `rg "extendsResolutionHorizon" js tests` finds only the architecture
guard's prohibited-token fixture, if that test requires the literal.

### Phase 5: Benchmark validation

- [x] Run all supported non-stale build benchmarks before changing history.
- [x] Separate observation-boundary changes from packet, coefficient, timing,
      and build changes.
- [x] Compare target death, DPS window, total damage, strike damage, condition
      damage, and final damaging packet for every changed build.
- [x] Investigate every material change; do not blanket-accept new output.
- [x] Update benchmark history only after the result is accepted.

Gate: no unexplained supported-build regression remains.

## Required validation matrix

| Behavior                                   | Required assertion                                                  |
| ------------------------------------------ | ------------------------------------------------------------------- |
| Delayed packet during a later cast         | Packet resolves without horizon metadata                            |
| Lethal delayed packet during a later cast  | Death occurs at the packet; later cast time before death is counted |
| Default terminal packet after rotation end | Packet is scheduled but not resolved                                |
| Explicit observation tail                  | Packet resolves; rotation duration is unchanged                     |
| Explicit wait                              | Packet resolves; rotation duration includes the wait                |
| Absolute fixed-clock boundary              | Resolution ends at the caller-supplied timestamp                    |
| Target death before observation end        | All later events and ticks are excluded                             |
| Interruption before commit                 | Future persistent packets are cancelled                             |
| Interruption after commit                  | Future persistent packets remain scheduled                          |
| Interrupted packet during a later cast     | Packet resolves through the normal continuing rotation              |
| Unrelated active condition                 | It gains no extra ticks from another skill's metadata               |
| Persistent actor                           | It respects lifetime, observation end, and target death             |
| Infinite or recurring task                 | Scheduler and resolver terminate deterministically                  |
| Architecture boundary                      | Profession and catalog code cannot declare horizon extension        |

At least one native integration fixture must cover a well or field, a delayed
projectile, an interrupted channel, a summon, an upkeep or repeating actor,
and a condition build.

## Required validation commands

At minimum, each implementation phase must run:

```powershell
npx prettier --write <files-touched-by-the-phase>
npm run build:modules
node --import ./scripts/testing/register-dist-loader.mjs --test --test-isolation=none <focused-test-files>
npm test
npm run check
git diff --check
```

Focused tests may be used while implementing, but the phase gate requires the
relevant platform, profession, and supported-build coverage.

## Completion criteria

The cleanup is complete only when:

- observation boundaries are selected exclusively by callers;
- delayed packets work during continuing rotations without special metadata;
- interruption persistence has explicit commit semantics;
- persistent actors are bounded by lifetime and observation policy;
- no production source declares `extendsResolutionHorizon`;
- saved benchmark metadata and tooling cannot select observation policy;
- supported benchmark changes are explained and accepted;
- all required tests and checks pass.

## Validation ledger

Append one entry per completed phase. Do not overwrite earlier evidence.

```md
### Phase N — YYYY-MM-DD

- Implementation revision: `<commit or working-tree identifier>`
- Implementing agent: `<name/id>`
- Contract deviations: None / `<documented deviation>`
- Files migrated: `<paths or inventory reference>`
- Focused tests: `<command and pass/fail counts>`
- Platform/profession tests: `<command and result>`
- Supported-build corpus: `<build count and changed results>`
- Benchmark investigations: `<none or summary>`
- Full check: `<command and result>`
- Validation result: PASS / FAIL
- Remaining blockers: None / `<list>`
```

### Phase 0 — 2026-08-14

- Implementation revision: `working tree 2026-08-14`
- Implementing agent: `Codex /root`
- Contract deviations: None
- Files migrated: `RESOLUTION-HORIZON-CLEANUP-INVENTORY.md`
- Focused tests: Core characterization fixtures included in the final 11/11 contract run.
- Platform/profession tests: Baseline captured before semantic edits.
- Supported-build corpus: 94 supported rotation-backed builds captured.
- Benchmark investigations: Baseline includes duration, DPS, total, strike, condition, and warnings.
- Full check: Final `npm run check` passed; final `npm test` passed 1333/1353.
- Validation result: PASS
- Remaining blockers: Repository-wide failures listed under Phase 5.

### Phase 1 — 2026-08-14

- Implementation revision: `working tree 2026-08-14`
- Implementing agent: `Codex /root`
- Contract deviations: None
- Files migrated: Engine observation policy, scheduler, GW2 simulation, resolver, and app runtime APIs.
- Focused tests: Rotation, tail, absolute, invalid-boundary, and death fixtures passed.
- Platform/profession tests: Final contract run passed 11/11.
- Supported-build corpus: Callers pass saved-rotation observation policy explicitly.
- Benchmark investigations: Rotation duration remains independent from observation tails.
- Full check: `npm run check` passed.
- Validation result: PASS
- Remaining blockers: None in phase scope.

### Phase 2 — 2026-08-14

- Implementation revision: `working tree 2026-08-14`
- Implementing agent: `Codex /root`
- Contract deviations: None
- Files migrated: Finite profession packets, interruption metadata, and dependent profession tests.
- Focused tests: Pre/post-commit, later-cast, field, projectile, well, and condition fixtures passed.
- Platform/profession tests: Migrated caller/profession regressions passed 16/16.
- Supported-build corpus: Authored packet timing and coefficients were unchanged.
- Benchmark investigations: Fixed log boundaries replaced event-owned tails.
- Full check: `npm run check` passed.
- Validation result: PASS
- Remaining blockers: None in phase scope.

### Phase 3 — 2026-08-14

- Implementation revision: `working tree 2026-08-14`
- Implementing agent: `Codex /root`
- Contract deviations: None
- Files migrated: Elementals, Necromancer minions and spirits, Revenant upkeep and actors, and recurring tasks.
- Focused tests: Native summon/upkeep fixtures and persistent-actor contract fixtures passed.
- Platform/profession tests: Power Ritualist, Corrupted Talent, Druid, and Flow Stabilizer regressions passed.
- Supported-build corpus: Anguish replacement-boundary regression was fixed; 16 autos restored.
- Benchmark investigations: Recurring output is bounded by actor state and the caller window.
- Full check: `npm run check` passed.
- Validation result: PASS
- Remaining blockers: None in phase scope.

### Phase 4 — 2026-08-14

- Implementation revision: `working tree 2026-08-14`
- Implementing agent: `Codex /root`
- Contract deviations: None
- Files migrated: Scheduler compatibility scan, catalog/type surface, helpers, sentinels, tests, and documentation.
- Focused tests: Architecture guard passed in the final 11/11 contract run.
- Platform/profession tests: Prohibited-token search returned no production/test occurrence.
- Supported-build corpus: No synthetic waits were added.
- Benchmark investigations: Public policy API and ownership boundaries documented.
- Full check: `npm run check` and `git diff --check` passed.
- Validation result: PASS
- Remaining blockers: None in phase scope.

### Phase 5 — 2026-08-14

- Implementation revision: `working tree 2026-08-14`
- Implementing agent: `Codex /root`
- Contract deviations: None
- Files migrated: Saved fixed-window rotations, benchmark callers, capture script, and inventory.
- Focused tests: Contract/native 11/11 and migrated profession/caller regressions 16/16 passed.
- Platform/profession tests: `npm run build:modules` and `npm run check` passed.
- Supported-build corpus: 94 builds; 25 cleanup-attributed changes and 2 later concurrent Power Weaver changes.
- Benchmark investigations: Cleanup changes are classified by actor output, condition integration, DPS window, and death clipping; aggregate Power Ritualist, Scourge, and Power Daredevil baselines were verified.
- Full check: `npm test` passed 1333/1353; `npm run check` and `git diff --check` passed.
- Validation result: FAIL
- Remaining blockers: 20 repository-wide failures from concurrent Elementalist work, stale benchmark expectations, four pre-existing architecture violations, Mesmer Signet timing, Ranger UI anchoring, Scourge Haunt attribution, and Power Daredevil Thieves Guild attribution.

### Phase 5 correction — 2026-08-14

- Implementation revision: `working tree 2026-08-14`
- Implementing agent: `Codex /root`
- Contract deviations: The intermediate saved-log policy approach was rejected because it made benchmark targets simulation inputs. This entry supersedes the saved-policy claims in the earlier Phase 1, Phase 2, and Phase 5 evidence without overwriting that history.
- Files migrated: Removed 34 saved-rotation policies; removed policy loading from the benchmark runner, corpus capture, and direct benchmark regressions; added a fixture/tooling architecture guard; corrected architecture documentation.
- Focused tests: Resolution contract/native integration passed 12/12; Power Ritualist passed 1/1 with 16 Anguish auto-attacks; caller regressions passed 14/16, with the two failures exposing unchanged Revenant comparison targets.
- Platform/profession tests: `npm run build:modules` and `npm run check` passed.
- Supported-build corpus: All 94 builds completed using the default rotation boundary; 68 exactly matched displayed benchmark DPS and 26 remained comparison mismatches.
- Benchmark investigations: Across the 34 rejected policies, 3 had raised DPS by up to 269, 27 had lowered DPS by up to 11,375, and 4 were neutral; every non-neutral case had gained damage from the later cutoff.
- Full check: `npm test` passed 1337/1356; `npm run check` and `git diff --check` passed before this ledger append.
- Validation result: FAIL
- Remaining blockers: 19 repository-wide test failures remain, including deliberately exposed benchmark mismatches and unrelated existing architecture/profession regressions. Benchmark targets were not rewritten to match simulator output.
