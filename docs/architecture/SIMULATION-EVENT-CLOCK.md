# Simulation clock navigation

The simulator advances to queued work and execution boundaries on one logical clock. This guide locates the code that
controls time; exact arithmetic, deadlines, and limits are defined there.

## Follow a deadline

| Question                                                | Implementation                                                                                                                                                 |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How are seconds canonicalized?                          | [kernel/core/clock.ts](../../js/kernel/core/clock.ts)                                                                                                          |
| How is queued work ordered?                             | [kernel/events/queue.ts](../../js/kernel/events/queue.ts)                                                                                                      |
| What advances the runtime clock?                        | [simulation/coordinator.ts](../../js/games/gw2/platform/simulation/coordinator.ts)                                                                             |
| How are tasks and cancellation admitted?                | [task-scheduler.ts](../../js/games/gw2/platform/simulation/task-scheduler.ts), [internal-work.ts](../../js/games/gw2/platform/simulation/internal-work.ts)     |
| How are action ticks calculated?                        | [combat/action-tick.ts](../../js/games/gw2/platform/combat/action-tick.ts)                                                                                     |
| How are cast times and reservations used?               | [cast-timing.ts](../../js/games/gw2/platform/execution/cast-timing.ts), [cast-execution.ts](../../js/games/gw2/platform/execution/cast-execution.ts)           |
| How do cooldowns settle?                                | [execution/cooldowns.ts](../../js/games/gw2/platform/execution/cooldowns.ts), [combat/recharge.ts](../../js/games/gw2/platform/combat/recharge.ts)             |
| How are effect expiry and condition payouts calculated? | [effect-timing.ts](../../js/games/gw2/platform/combat/effect-timing.ts), [condition resolution](../../js/games/gw2/platform/resolver/condition-resolution.ts)  |
| Where does observation stop?                            | [kernel/execution/observation.ts](../../js/kernel/execution/observation.ts), [combat-execution.ts](../../js/games/gw2/platform/simulation/combat-execution.ts) |

## Resource and proc lifecycle

[Resource owners](../../js/games/gw2/platform/combat/resources/) settle balances and report readiness or depletion.
[Proc registration](../../js/games/gw2/platform/combat/procs/registry.ts) handles proc claims. Follow their callers in
execution and resolution when investigating ordering around a spend, grant, or hit.

## Observation and reporting

A rotation's end, the observation horizon, and the combat cutoff are distinct concepts. Their result fields live in
[results/types.ts](../../js/games/gw2/platform/results/types.ts);
[result projection](../../js/games/gw2/platform/results/project-runtime.ts) reads the settled runtime. Use the
[programmatic guide](PROGRAMMATIC-SIMULATION.md#observation-boundaries) to choose an observation policy.

For simultaneous work, continue with [event ordering](SKILL-EVENT-ORDERING.md). For condition sampling and expiry, use
[condition ticks](SHARED-CONDITION-TICKS.md).

## Focused tests

[Clock tests](../../tests/kernel/clock.test.js),
[observation windows](../../tests/games/gw2/platform/simulation/observation-windows.test.js), and
[recharge lifecycle tests](../../tests/games/gw2/platform/execution/recharge-lifecycle.test.js) provide executable
examples. Follow [AGENTS.md](../../AGENTS.md#testing-policy) when adding coverage.
