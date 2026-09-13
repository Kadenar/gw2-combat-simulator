# Shared condition ticks

Status: implemented with the user-specified whole-second clock, 40ms buffering, and buffer-time stat sampling.

## Timing contract

All conditions and owners follow one global one-second cadence anchored at simulation time zero. The first condition
activates queued processing; it does not change that phase. Empty target windows stop unnecessary queued work, and later
applications still join the same whole-second cadence. No configurable phase offset is currently exposed.

Each application samples its condition owner's current stats and modifiers on each global 40ms step, capped by natural
expiry. A target-wide queued sampler accumulates unrounded contributions while mutable combat state is current;
whole-second payouts consume those stored values without querying stats again. Existing natural durations still round
upward to 40ms. Integer buffer-step counts preserve the full lifetime without rounding split contributions twice.

A buff gained halfway through a second affects only subsequent samples. A modifier that expires before payout still
contributes to the samples taken while it was active. Environment conditions sample target Vulnerability on the same
40ms grid. All owners sample a whole-second boundary before any condition packet at that timestamp changes health.

For a two-second burn applied at 0.960s with a constant rate of 100 damage per stack-second:

| Packet time | Buffered time | Damage |
| ----------- | ------------- | ------ |
| 1.000s      | 0.040s        | 4      |
| 2.000s      | 1.000s        | 100    |
| 3.000s      | 0.960s        | 96     |

Natural expiry at 2.960s stops buffering, but the remaining damage waits until 3.000s. Expiry and observation cutoffs
never create extra packets. An off-grid application at 0.730s with a rounded 0.520s duration buffers seven steps
(0.280s) by 1.000s and six more (0.240s) before expiry, preserving the complete lifetime.

Configured golem conditions use the same whole-second cadence and separate environment totals. Explicit Combat Start
gates damage without shifting the clock, including when combat starts between whole seconds.

## Packets, ownership, and attribution

The global timer determines timestamps. Damage resolves in separate packets for each canonical condition and condition
owner. Player skills, explicitly player-owned effects, and all summons share player rounding by default. Ranger pets and
mech packets carry `independentConditionOwner: true` and instead group by their concrete `summonOwner`. An independent
summon without an owner ID remains isolated per application. Unclassified actors also remain isolated. Environment
conditions retain separate totals and never enter player reactions.

Pet preparation and derived pet conditions preserve their independent ownership. Mech emission and derived conditions
retain the concrete `engineer.mech` identity and the independent marker. Other summons can retain companion IDs for boon
audiences and lifetimes without creating separate condition rounding groups. This includes minions, spirits, elementals,
Thieves Guild, clones, and phantasms.

Each application retains its own lifetime and buffer. Condition queries resolve the owner independently of the strike
actor: non-pet/non-mech summons use player attributes, Might, equipment condition bonuses, trait modifiers, and duration
bonuses. This includes Thieves Guild conditions, clones, and minions. Pet and mech conditions retain independent
scaling. The scheduler and resolver use the same duration query. Each 40ms sample reads current owner stats; payout only
rounds and attributes accumulated contributions. Original summon metadata remains on the application for reporting and
lifetime tracking. Strike queries retain the summon actor and its independent strike profile. Skill IDs and display
labels do not determine condition owners.

Applications remain the canonical lifetime and reporting records. Owner groups reference them rather than duplicating
mutable duration state. Each application retains its sampling cursor, buffered step count, and sum of sampled damage
rates. A group retains one effective queued wake, at an integer second on the global cadence. Settled and forcibly
removed applications leave the working group, so repeated wake scans do not grow with encounter history. A wake token
makes obsolete queued events inert.

At a pulse, the resolver sums each contributor's buffered unrounded damage and calls the existing half-even rounding
function once. Stats and modifiers are not resampled during payout. Integer reporting shares use floors followed by
largest fractional remainders; stable application order breaks ties. Two equal 29.5 contributions therefore commit 59
damage, attributed as 30 and 29.

All application shares, condition totals, skill breakdowns, and target damage are committed before dispatching one
`condition-tick.resolved` reaction. The reaction result contains the packet total and its contributions. No production
profession currently subscribes to this stage. Detailed and score modes use identical arithmetic; only reporting arrays
and rows are optional. Existing application damage ticks continue to drive health milestones and Necromancer scheduler
feedback, with no second packet-history format or saved-preset migration.

## Ordering and boundaries

Shared buffer and payout wakes use default priority and do not inherit an application's causal order. Normal causally
tagged skill and state events at the same timestamp precede them. Explicit priorities retain their meaning; untagged
ties follow stable insertion order. Distinct owner/condition packets are individually atomic and retain deterministic
queue ordering.

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
cross-condition timeline, empty clock gaps, 40ms buffers, short durations, observation boundaries, permanent conditions,
buffer-time stats, transient modifiers, environment sampling, summon ownership, atomic packets, precombat settlement,
causal/priority/insertion ordering, lethal packets, and cancellation/stale wakes. Existing condition formula/duration
and Ranger removal tests cover their original contracts using synchronized pulses.

Run `npm run check` for repository validation and `npm run benchmarks:compare` for supported preset comparisons.
Numerical preset regressions retain the maximum 1% relative DPS tolerance; expected values must not be silently rebased
to accommodate changes or warnings.

The player-condition inheritance correction updates two stored Mesmer simulation baselines: Chronomancer Condition
(Staff-Scepter/Pistol), 46,841 to 47,422 DPS; and Mirage Condition (Staff-Axe/Torch) - Dune Cloak, 41,030 to 41,889 DPS.
These changes record the corrected owner-stat behavior, not new in-game measurements. Other preset baselines and the 1%
regression tolerance are unchanged.
