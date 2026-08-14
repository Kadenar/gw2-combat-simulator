# Resolution horizon cleanup inventory

Characterization captured before migration on 2026-08-14 found 65 direct
`extendsResolutionHorizon: true` propagation sites in 21 profession files,
plus helper parameters, catalog allowlists, scheduler scans, profession-task
flags, marker sentinels, and dependent tests. The supported rotation corpus
contained 94 non-stale builds.

## Classification

| Class                                                                                    | Migrated owners                                                                                                                                                                     | Replacement                                                                                                                                 |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Finite strikes, projectiles, wells, fields, conditions, controls, buffs, and trait procs | Engineer spear and Amalgam; Firebrand tomes; Necromancer Core, Harbinger, Reaper, and Ritualist; Revenant Core, Conduit, Herald, and Renegade; Thief Core and Specter; Spellbreaker | Authored packet timestamps remain finite; callers select observation when terminal packets must resolve.                                    |
| Interruption persistence                                                                 | Engineer, Necromancer, Ranger, Revenant, Thief, and Warrior catalog skills                                                                                                          | Every effect that can survive interruption now has an explicit skill-level `interruptCommitMs`; catalog construction rejects omissions.     |
| Persistent actors and recurring work                                                     | Elementalist elementals, Necromancer minions and Ritualist spirits, Revenant upkeep and Renegade actors, Warrior profession tasks                                                   | Generation/lifetime checks and typed tasks; recurring minion and spirit handlers keep one next cycle in flight and stop at observation end. |
| Condition-tail sentinels                                                                 | Elementalist elemental and Weaver marker events; terminal condition and field flags in profession effects                                                                           | Sentinels were removed. Natural condition duration remains authored, while integration stops at the caller boundary or death.               |
| Helper propagation                                                                       | Revenant boon, legend-trait, upkeep, and Conduit helpers; Thief condition helpers                                                                                                   | Horizon parameters and conditional metadata spreads were deleted.                                                                           |
| Compatibility surface                                                                    | Engine catalog metadata allowlist, scheduler event scans, shared event types, GW2 resolver boundary widening                                                                        | Replaced by normalized simulation-level observation policy and separate stream rotation/observation timestamps.                             |
| Stale test dependency                                                                    | Warrior task expectation and terminal profession packet tests                                                                                                                       | Architecture guard plus explicit tails, waits, continuing rotations, or scheduled-stream assertions according to the behavior under test.   |

The architecture guard scans production source and build/catalog JSON without
embedding the prohibited token as a source literal. The migration intentionally
does not add synthetic waits to saved rotations.

## Baseline and benchmark classification

The pre-migration corpus recorded duration, DPS, total, strike, condition,
warnings, and the derived observation window for all 94 builds. An intermediate
migration embedded absolute observation policies in 34 saved rotations to
preserve prior log windows. That made a benchmark-derived timestamp a
simulation input and was rejected.

The audit of those 34 temporary policies found that 3 increased DPS by up to
269, 27 decreased DPS by up to 11,375, and 4 were neutral. Every non-neutral
case gained damage from the extended cutoff, while the longer DPS denominator
determined the final direction. This confirmed that the policy was materially
tuning reported benchmark numbers rather than merely preserving output.

The policies are now removed. Benchmark runners and corpus-capture tools use
the default rotation boundary, exactly as the interactive simulator does.
Imported logs and saved benchmark values remain comparison targets only; a
mismatch must be investigated rather than converted into an observation input.
Comparisons continue to record DPS start/window, death time, last hit, and the
final damaging packet alongside aggregate damage.

The recurring-spirit migration initially exposed a replacement-boundary bug:
an eager generation change suppressed Anguish auto-attacks at 35.14, 51.66,
and 67.90 seconds. Timestamped owner-stop tasks now keep the outgoing spirit
active until the replacement cast takes effect. Power Ritualist again records
16 Anguish auto-attacks and matches its captured aggregate baseline. Its 34
displayed Gravedigger hits are 16 direct Gravedigger strikes plus 18 Leeching
Bolts whose source skill is Gravedigger; the raw breakdown keeps those rows
separate.
