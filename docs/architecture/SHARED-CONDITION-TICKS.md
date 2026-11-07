# Condition damage navigation

Condition applications, damage sampling, and payouts have separate lifetimes. Start with
[condition-resolution.ts](../../js/games/gw2/platform/resolver/condition-resolution.ts), which owns accepted
applications, buffering, settlement, and companion retirement.

## Reading path

| Question                                         | Owner                                                                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| How does a condition enter the runtime?          | [effect-delivery.ts](../../js/games/gw2/platform/resolver/effect-delivery.ts)                                                                          |
| When does it sample or pay damage?               | [condition-resolution.ts](../../js/games/gw2/platform/resolver/condition-resolution.ts)                                                                |
| Which work runs first at a shared timestamp?     | [event-phase.ts](../../js/games/gw2/platform/resolver/event-phase.ts), [queue.ts](../../js/kernel/events/queue.ts)                                     |
| How are duration and expiry calculated?          | [effect-timing.ts](../../js/games/gw2/platform/combat/effect-timing.ts)                                                                                |
| Whose attributes and modifiers apply?            | [combat-query.ts](../../js/games/gw2/platform/combat-calculation/combat-query.ts)                                                                      |
| How does damage affect target health?            | [target-health.ts](../../js/games/gw2/platform/combat/state/target-health.ts)                                                                          |
| How are observations and damage totals reported? | [resolved-events.ts](../../js/games/gw2/platform/results/resolved-events.ts), [damage-report.ts](../../js/games/gw2/platform/results/damage-report.ts) |

Natural expiry, forced retirement, and the end of observation are different boundaries. Follow the lifetime owner when
investigating an unpaid remainder; a clipped report alone does not describe why a condition stopped contributing.

## Executable examples

- [Shared condition ticks](../../tests/games/gw2/platform/resolver/shared-condition-ticks.test.js) covers sampling,
  settlement, and shared-clock behavior.
- [Condition resolution](../../tests/games/gw2/platform/resolver/condition-resolution.test.js) covers application
  ownership and retirement.
- [Condition duration](../../tests/games/gw2/platform/resolver/condition-duration.test.js) covers duration calculation.
- [Condition-owner queries](../../tests/games/gw2/platform/combat-calculation/condition-owner-query.test.js) covers
  attribute ownership.

Use these owners and tests for exact rounding and boundary behavior. [Clock navigation](SIMULATION-EVENT-CLOCK.md) and
[event ordering](SKILL-EVENT-ORDERING.md) locate the surrounding runtime.
