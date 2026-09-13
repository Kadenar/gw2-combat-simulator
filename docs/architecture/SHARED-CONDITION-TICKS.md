# Shared condition ticks

Status: implemented. The user-supplied timing example supersedes the original proposal's per-condition clocks and
expiry-time settlement. No independent game-log verification was supplied with the example.

## Timing contract

The first condition on the target starts one global one-second timer. Every condition and damage owner joins that
cadence. An application contributes its elapsed, unsettled active duration at each synchronized pulse, capped by its
natural expiry. A condition that expires between pulses settles its remainder on the next pulse; expiry itself does not
create a damage event. Once the final pending contributions have settled and no conditions remain, the timer stops. The
next application starts a fresh timer.

Configured golem conditions are present at simulation time zero, including non-damaging statuses. They anchor the timer
at zero and prevent it from stopping. Explicit Combat Start gates damage, not the clock. This also keeps environment and
player conditions synchronized when Combat Start is not on a whole second.

The supplied example applies a six-second Vital Shot bleed at 0.100s, another at 2.700s, and a three-second Spider Venom
poison at 2.700s. Bleeding starts the clock; Poisoned joins it. Both later applications contribute 0.4 seconds at
3.100s. Poison settles its final 0.6 seconds at 6.100s, and the second bleed settles its final 0.6 seconds at 9.100s.
The target then desynchronizes. Applications at 11.600s restart the clock, with the next pulse at 12.600s.

For 125 Condition Damage, Bleeding deals `22 + 0.06 * 125 = 29.5` per stack-second. The example's bleeding packets are:

| Packet time            | Unrounded contribution | Rounded damage |
| ---------------------- | ---------------------- | -------------- |
| 1.100s, 2.100s         | 29.5 each              | 30 each        |
| 3.100s                 | `29.5 * (1 + 0.4)`     | 41             |
| 4.100s, 5.100s, 6.100s | `29.5 * 2`             | 59 each        |
| 7.100s, 8.100s         | 29.5 each              | 30 each        |
| 9.100s                 | `29.5 * 0.6`           | 18             |

Each bleed retains exactly six stack-seconds. Natural durations still round upward to the existing 40ms grid. Split
intervals do not round upward individually; subtraction noise is removed at picosecond precision before multiplication.

## Packets, ownership, and attribution

The global timer determines timestamps. Damage still resolves in separate packets for each canonical condition and
actual damage owner. Player skills and explicitly player-owned effects share a rounding group. Summons use concrete
`summonOwner` identities, regardless of inherited player modifiers. Unclassified actors remain isolated per application.
Environment conditions retain separate totals and never enter player reactions.

Existing Ranger pets, Mesmer clones, Necromancer minions/spirits, and Elementalist elementals provide companion IDs.
Phantasms now provide an ID per summoned entity, with a separate ID for a resummoned repeat. Mech emission and derived
conditions retain the concrete `engineer.mech` identity. Skill IDs and display labels are not owner identities. Existing
trait effects explicitly attributed to the player retain that ownership.

Applications remain the canonical lifetime and reporting records. Owner groups reference them rather than duplicating
mutable duration state. Each application has a settlement cursor. A group retains one effective queued wake, derived
from the global anchor plus an integer pulse index. Settled and forcibly removed applications leave the working group,
so repeated wake scans do not grow with encounter history. A wake token makes obsolete queued events inert.

At a pulse, the resolver samples each contributor's current stats and source-specific modifiers against the same
pre-packet combat state. It sums unrounded contributions and calls the existing half-even rounding function once.
Integer reporting shares use floors followed by largest fractional remainders; stable application order breaks ties. Two
equal 29.5 contributions therefore commit 59 damage, attributed as 30 and 29.

All application shares, condition totals, skill breakdowns, and target damage are committed before dispatching one
`condition-tick.resolved` reaction. The reaction result contains the packet total and its contributions. No production
profession currently subscribes to this stage. Detailed and score modes use identical arithmetic; only reporting arrays
and rows are optional. Existing application damage ticks continue to drive health milestones and Necromancer scheduler
feedback, with no second packet-history format or saved-preset migration.

## Ordering and boundaries

Shared wakes use default priority and do not inherit an application's causal order. Normal causally tagged skill and
state events at the same timestamp precede them. Explicit priorities retain their meaning; untagged ties follow stable
insertion order. Distinct owner/condition packets are individually atomic and retain deterministic queue ordering.

A packet exactly at Combat Start is eligible. Earlier wakes advance settlement without damage or reactions, so there is
no later catch-up hit. Stopping observation between pulses produces no endpoint packet, even if natural expiry has
already passed. The last contribution is visible only if its synchronized pulse is observed.

The event loop checks death after a complete packet. Other condition packets at the lethal timestamp may finish, while
subsequent independent attacks are rejected. Applications with `removedAt <= packetTime` contribute nothing and receive
no invented final partial damage. Ranger pet-swap cancellation continues to work in detailed and score modes.

Direct damage events marked `damageKind: condition` remain direct packets. Confusion's configured activation-rate
approximation and condition damage formulas are unchanged.

## Validation

`tests/platform/gw2/shared-condition-ticks.test.js` covers combined rounding, attribution, owner isolation, the supplied
cross-condition timeline, clock restart, short durations, observation boundaries, permanent conditions, dynamic stats,
atomic packets, precombat settlement, causal/priority/insertion ordering, lethal packets, and cancellation/stale wakes.
Existing condition formula/duration and Ranger removal tests cover their original contracts using synchronized pulses.

Run `npm run check` for repository validation and `npm run benchmarks:compare` for supported preset comparisons.
Numerical preset regressions retain the maximum 1% relative DPS tolerance; expected values must not be silently rebased
to accommodate changes or warnings.
