# Shared condition ticks

## Timing contract

Boon and condition durations round half-even to whole milliseconds after duration bonuses. Fixed-duration grants still
round; generic profession buffs retain authored durations. Natural expiration is application time plus rounded duration,
with no 40ms ceiling or further snapping. Application timestamps retain canonical microsecond precision.

All condition owners use encounter-second pulses at 1s, 2s, 3s, and so on. First positive player damage sets the DPS
reporting window without shifting these pulses. Empty target windows stop unnecessary queued work; subsequent
applications resume on the same encounter clock.

Each condition application samples its owner's current stats and modifiers at a pulse for the elapsed interval since its
last sample. If it expires between pulses, it samples the final partial interval at that exact expiration time. That
remainder stays buffered until the next whole-second payout. Changes after expiry cannot alter stored damage. There are
no intermediate 40ms samples or 1ms simulation steps. Expiry sampling affects only applications expiring at that
timestamp, so one application's expiry cannot change another application's sampling schedule.

For a two-second burn applied at 0.960s with a constant rate of 100 damage per stack-second:

| Packet time | Sample time | Elapsed time | Damage |
| ----------- | ----------- | ------------ | ------ |
| 1.000s      | 1.000s      | 0.040s       | 4      |
| 2.000s      | 2.000s      | 1.000s       | 100    |
| 3.000s      | 2.960s      | 0.960s       | 96     |

A duration of 1.01s applied at 0.375s expires at 1.385s. Its first sample covers 0.625s at 1s, and its expiry sample
covers the remaining 0.385s, payable at 2s. Stopping observation at 1.5s omits that future payout; no endpoint packet is
invented.

## Rounding, ownership, and attribution

Each application buffers `rate * elapsedSeconds * stacks` without rounding, including partial expiry damage. At each
global pulse, all contributions for the same condition and owner are summed, regardless of source skill, and half-even
rounding runs once. One stack at 29.5 damage per second deals 30; two stacks deal 59 whether applied together or by
different skills. Distinct conditions and independent owners retain separate packets.

Application damage, elapsed stack-seconds, and reporting attribution stay together. Owner/condition groups retain
application references and allocate the rounded packet total using floors plus the largest fractional remainders; stable
application order breaks ties. Those integer reporting shares do not add a second damage rounding. Groups commit
atomically before dispatching one `condition-tick.resolved` reaction. Detailed and score modes use identical arithmetic.
Cancelled and fully settled applications leave the working group; stale queued wakes are inert.

Player skills, player-owned effects, and ordinary summons use player condition attributes, equipment, traits, and Might.
Ranger pets and mechs marked `independentConditionOwner` retain their own condition profiles and owner groups. Original
source metadata remains available for attribution. Configured permanent target conditions use the same pulse clock,
sample target Vulnerability at each pulse, and retain separate environment totals without player reactions.

## Ordering and boundaries

At a canonical timestamp the resolver runs Sample, Settle, then Ordinary. All owners sample before any condition payout
changes health. Settlement commits condition damage before same-time strikes and buffs, regardless of ordinary priority.
A same-time ordinary buff affects the next eligible sample. An application created on a pulse owes no preceding time.

Non-damage reactions emitted during settlement inherit Settle at that timestamp. Direct damage remains Ordinary; future
events receive their normal phase. Priority, causal order, and insertion order break ties within a phase. Resolved
queries expose only events whose handlers have already executed.

Status windows remain half-open: active at application, inactive at expiry. This is independent of final accrual and its
later payout. Forced removal discards pending damage; natural expiry retains its sampled remainder. Explicit Combat
Start gates payouts, and expiry remainders sampled before Combat Start are discarded. Precombat whole-second wakes
advance without creating catch-up damage. Environment samples ending at Combat Start are excluded.

The loop checks death after a complete packet. Other condition packets at the lethal timestamp may finish, while
subsequent independent attacks are rejected. Application records continue to drive health milestones and Necromancer
scheduler feedback. Direct damage events marked `damageKind: condition` retain direct packet semantics.

## Reference and deliberate differences

Duration rounding follows
[gw2combat's effect duration calculation](https://github.com/Mk-Chan/gw2combat/blob/master/src/utils/effect_utils.hpp).
Pulse/expiry sampling follows
[its condition resolution](https://github.com/Mk-Chan/gw2combat/blob/master/src/system/effects.cpp). The
encounter-second clock matches its default zero condition-tick offset.

The user explicitly requires one rounding for the complete owner/condition stack and conditions-before-strikes ordering.
The inspected reference rounds each application group separately, and its public loop calls strike/effect application
before condition settlement and cleans up expired effects afterward. This project retains its existing
Sample/Settle/Ordinary phases and half-open status queries. These differences, authored skill timing, and
profession/balance data mean this is not a claim of complete simulator parity.
