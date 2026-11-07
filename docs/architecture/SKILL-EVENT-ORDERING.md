# Event ordering navigation

Rotation order and event order answer different questions. The rotation supplies player inputs; the shared queue orders
work produced by those inputs. Read the linked code for the current comparator, phase selection, priorities, and
cancellation behavior.

## Trace simultaneous work

1. Start at [cast-execution.ts](../../js/games/gw2/platform/execution/cast-execution.ts) for a command, or the owning
   profession's skill, trait, or mechanic for generated work.
2. Follow [effect emission](../../js/games/gw2/platform/effects/emission.ts) or
   [task scheduling](../../js/games/gw2/platform/simulation/task-scheduler.ts) to see how work receives its identity and
   ownership.
3. Read [event-phase.ts](../../js/games/gw2/platform/resolver/event-phase.ts) for phase assignment and
   [queue.ts](../../js/kernel/events/queue.ts) for comparison and stable insertion.
4. Follow [coordinator.ts](../../js/games/gw2/platform/simulation/coordinator.ts) into
   [effect delivery](../../js/games/gw2/platform/resolver/effect-delivery.ts) to see what executes and what it schedules
   next.

## Different kinds of order

| Concept                                  | Where to inspect it                                                                                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rotation command order                   | [execution/](../../js/games/gw2/platform/execution/)                                                                                                                    |
| Queue priority and causal placement      | [queue.ts](../../js/kernel/events/queue.ts), [emission.ts](../../js/games/gw2/platform/effects/emission.ts)                                                             |
| Condition sampling and settlement phases | [event-phase.ts](../../js/games/gw2/platform/resolver/event-phase.ts), [condition-resolution.ts](../../js/games/gw2/platform/resolver/condition-resolution.ts)          |
| Internal work and flip cleanup priority  | [work-contract.ts](../../js/games/gw2/platform/simulation/work-contract.ts), [skill-flip-controller.ts](../../js/games/gw2/platform/execution/skill-flip-controller.ts) |
| Module hook composition                  | [runtime-hooks.ts](../../js/games/gw2/platform/profession-definition/runtime-hooks.ts)                                                                                  |
| Trait trigger ordering                   | [trigger-rules.ts](../../js/games/gw2/platform/profession-definition/trigger-rules.ts), owning trait registrations                                                      |
| Modifier application order               | [combat/modifiers.ts](../../js/games/gw2/platform/combat/modifiers.ts)                                                                                                  |
| Combo field selection                    | [combos/](../../js/games/gw2/platform/combos/)                                                                                                                          |

For a behavior change, trace both the producer and the receiver. Moving a callback between owners can change when it
observes state even if its body stays the same.

## Executable examples

[Event-ordering tests](../../tests/games/gw2/platform/events/event-ordering.test.js) cover shared queue behavior.
Profession tests sit beside their corresponding family under
[tests/games/gw2/professions/](../../tests/games/gw2/professions/).

[Clock navigation](SIMULATION-EVENT-CLOCK.md) locates time arithmetic and observation boundaries.
[Condition ticks](SHARED-CONDITION-TICKS.md) locates sampling and payout behavior.
