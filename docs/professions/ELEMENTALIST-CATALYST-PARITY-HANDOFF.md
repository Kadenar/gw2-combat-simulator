# Elementalist Catalyst Parity Handoff

Handoff date: 2026-08-13

## Scope

This audit compares all 11 upstream Catalyst build/rotation fixtures directly
with the native shared engine. It checks aggregate output, timeline drift,
warnings, static attributes, per-ability strike and condition damage, casts,
hits, condition applications, and effective stack-seconds.

Run it after building modules:

```powershell
npm run build:modules
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-catalyst-reference.mjs --summary
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-catalyst-reference.mjs --check-actionable --summary
```

Use `--variant=<name>` and `--skill=<name>` for focused diagnostics. The actionable gate currently exits 1 for the shared-engine findings listed below; it should not be treated as green until those are either approved and corrected or explicitly accepted.

## Current result

| Variant                     | Reference DPS | Native DPS |    Delta | Timeline changes | Warnings |
| --------------------------- | ------------: | ---------: | -------: | ---------------: | -------: |
| Condi pistol                |    38,454.727 | 38,399.746 |  -0.143% |                1 |        0 |
| Condi quick pistol/dagger   |    33,094.641 | 33,010.515 |  -0.254% |                0 |        0 |
| Condi quick pistol/warhorn  |    34,323.072 | 35,725.943 |  +4.087% |                7 |        0 |
| Inferno                     |    38,780.754 | 38,461.799 |  -0.822% |                0 |        0 |
| Inferno quick               |    34,610.935 | 34,353.767 |  -0.743% |                2 |        0 |
| Power scepter BttH          |    38,624.650 | 38,324.620 |  -0.777% |                0 |        1 |
| Power spear                 |    39,013.020 | 39,213.184 |  +0.513% |                0 |        0 |
| Power sword BttH            |    38,430.765 | 38,193.844 |  -0.616% |                0 |        0 |
| Power sword Fresh Air       |    40,478.890 | 31,186.477 | -22.956% |               13 |        2 |
| Power quick scepter BttH    |    32,106.913 | 32,208.274 |  +0.316% |                4 |        0 |
| Power quick sword Fresh Air |    33,558.651 | 23,687.901 | -29.413% |               21 |        1 |

All local Catalyst build and rotation fixtures match upstream. Static attributes match apart from reference/native rounding of at most two stat points.

## Completed Catalyst corrections

- Elemental Empowerment now lives in the Catalyst module. Its eligible pool contains only base, gear, rune, infusion, and food stats; utility, Jade Bot, trait, and sigil contributions are excluded. Three permanent stacks start at Combat Start, seven timed stacks fill the cap, and new grants replace the oldest timed stack.
- Vicious Empowerment is driven by resolved control and Immobilize events with its 0.25-second ICD. It no longer procs from discarded precombat packets. The quick pistol/warhorn fixture now has the same 30 procs and sources as upstream.
- Catalyst energy from hits is applied by timestamped specialization tasks. Future scheduled hits no longer grant energy early, sphere-active suppression is checked at the hit timestamp, and Sphere Specialist keeps its intended exception.
- Shattering Ice activates at cast completion and procs from actual resolved player strikes. Delayed hits that were already scheduled can now trigger it, and the Power Spear fixture matches the upstream count of 36 proc hits.
- Steamshrieker is preserved by build migration and implemented as a Catalyst-local resolved combo reaction. Water-field Blast and Leap finishers produce the expected Burning applications.
- Churning Earth and both zero-damage Aerial Agility movements carry explicit zero-coefficient finisher packets, so combo mechanics are not lost merely because the finisher deals no damage.
- Precombat Empowering Auras and Sunspot's same-time aura-before-strike order now follow the reference Elementalist behavior.

Shattering Ice is not a core Elementalist skill. The native catalog and API metadata identify it as a Catalyst Augment, so its activation/proc state correctly belongs under `specializations/catalyst/` while the generic hit resolver only dispatches the resolved-damage reaction.

## Diagnosed policy differences

The 126 native-versus-reference ability component rows are classified as
follows:

- 34 `condition-tick-cadence`: accepted ELM-701 behavior. Reference uses a condition-wide whole-second clock; native uses per-application ticks and fractional final intervals.
- 8 `critical-food-policy`: accepted ELM-703 behavior.
- 35 `resolved-proc-causality`: reference scheduling can make a triggering hit benefit from same-time Vicious Empowerment or Elemental Epitome state. Native applies resolved reactions after the triggering hit.
- 45 `fresh-air-intent-tie`: downstream differences from the shared scheduler issue below.
- 4 `reference-reporting`: Bloodstone Explosion reports condition applications but zero applied stack-seconds upstream.
- 0 unclassified.

Of 29 condition application/effective-duration rows, 21 are sub-percent
duration rounding with equal application counts, four are Bloodstone reporting
differences, one is a Sigil of Earth application-count difference, and three
are downstream Fresh Air timeline differences.

## Shared-engine findings requiring direction

No shared resolver or scheduler change was made during this Catalyst pass.

1. Fresh Air sphere/attunement arbitration: the shared scheduler delays repeated
   attunement intents behind concurrent sphere work. Power Sword Fresh Air is
   22.452% longer and Quick Power Sword Fresh Air is 36.986% longer than the
   reference, producing downstream rejected actions and DPS deltas of -22.956%
   and -29.413%. Correcting command-lane arbitration is a shared scheduler
   change; Catalyst-local timing overrides would be rotation-specific.
2. Quick pistol/warhorn chronology: seven interrupt/concurrent timing changes
   accumulate and move the DPS window by 0.213%. The +4.087% aggregate delta is
   dominated by the shared condition-tick model: Burning applications and
   applied durations closely match while tick-integrated Burning damage does
   not. A Catalyst duration patch would conceal the shared policy difference.
3. Critical Sigil of Earth: Condi Pistol produces 46 native applications versus 45 upstream. This is shared deterministic critical-proc progression, not Catalyst logic, and requires approval before changing equipment resolution.

Power Scepter BttH's single energy warning is expected. Upstream also rejects the same Air sphere at 95.408 seconds with 8/10 energy; native exposes that rejection as a warning.

## Regression coverage

`tests/professions/elementalist/catalyst-parity-regressions.test.js` locks:

- eligible Elemental Empowerment attribute sources and its 3+7 stack model;
- zero-damage Blast/Leap finisher metadata;
- 37 Steamshrieker applications in Condi Pistol;
- the 30 resolved Vicious Empowerment procs and their control/Immobilize sources;
- chronological energy behavior in three representative fixtures;
- precombat Empowering Auras and Sunspot event ordering;
- 36 Shattering Ice proc hits in Power Spear.
