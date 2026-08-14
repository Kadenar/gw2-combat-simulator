# Elementalist Weaver Parity Handoff

Handoff date: 2026-08-13

## Scope

This audit compares all five upstream Weaver build/rotation fixtures directly
with the native shared engine. It checks aggregate output, timeline drift,
warnings, static attributes, per-ability strike and condition damage, casts,
hits, condition applications, and effective stack-seconds.

Run it after building modules:

```powershell
npm run build:modules
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-weaver-reference.mjs --summary
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-weaver-reference.mjs --check-actionable --summary
```

Use `--variant=<name>` and `--skill=<name>` for focused diagnostics. The actionable gate currently exits 1 for the shared-engine findings listed below; it should not be treated as green until those are approved and corrected or explicitly accepted.

## Current result

| Variant             | Reference DPS | Native DPS | DPS delta | Damage delta | Duration delta | Timeline changes | Warnings | Unexpected warnings |
| ------------------- | ------------: | ---------: | --------: | -----------: | -------------: | ---------------: | -------: | ------------------: |
| Condi pistol        |    43,479.943 | 41,864.427 |   -3.716% |      -2.226% |        +1.547% |                7 |        0 |                   0 |
| Condi pistol/dagger |    43,727.651 | 42,279.041 |   -3.313% |      -3.312% |        +0.001% |                1 |        1 |                   0 |
| Condi scepter       |    44,788.085 | 42,228.142 |   -5.716% |      -3.286% |        +2.576% |               15 |        0 |                   0 |
| Power spear         |    38,432.851 | 31,674.179 |  -17.586% |      -2.039% |       +18.864% |               46 |        1 |                   1 |
| Power sword         |    39,225.976 | 39,115.543 |   -0.282% |      -0.231% |        +0.051% |                8 |        1 |                   0 |

All local Weaver build and rotation fixtures match upstream. Final reference and native attributes match exactly for every fixture.

## Completed Weaver corrections

- Fully attuned Elements of Rage now activates during setup, so a precombat double-attunement carries into the opening packet as it does upstream.
- Elements of Rage duration follows the reference's general condition-duration multiplier for Weaver. The condition fixtures therefore receive the expected 12.805333-second window instead of a fixed eight seconds.
- Unravel grants Elements of Rage only when it actually collapses a dual attunement. It no longer grants the trait while already fully attuned.
- Elementalist spear etchings count completed attunement casts among their three upgrade casts. Power Spear now produces all six expected Volcano casts and 72 hits without warnings.

These changes are confined to Elementalist core behavior with explicit Weaver gates or the Weaver specialization module. No shared resolver or scheduler behavior was changed during this pass.

## Diagnosed policy differences

All 93 native-versus-reference ability component divergences are classified:

- 68 `condition-tick-cadence`: accepted ELM-701 behavior. Reference uses a condition-wide whole-second clock; native uses per-application ticks and fractional final intervals.
- 17 `concurrent-readiness-timeline`: downstream damage-window changes from the shared scheduler behavior below.
- 5 `critical-food-policy`: accepted ELM-703 behavior.
- 3 `critical-sigil-causality`: deterministic critical-proc progression differs for Sigil of Earth.
- 0 unclassified.

All three condition-application/effective-duration divergences are classified:

- 1 `critical-sigil-causality`: Condi Scepter differs in deterministic Sigil of Earth applications.
- 2 `attunement-timeline-causality`: Power Spear's shifted attunement timeline changes Primordial Stance and Burning Precision applications.
- 0 unclassified.

## Shared-engine findings requiring direction

1. Concurrent readiness: pending concurrent attunements can advance or block
   the serial lane differently from upstream. The current platform behavior
   stretches Condi Pistol by 1.547%, Condi Scepter by 2.576%, and Power Spear
   by 18.864%. Power Spear loses 2.039% total damage and reaches -17.586% DPS,
   including one downstream Galvanize legality warning. Correcting this requires
   a shared command-arbitration change.
2. Condition integration: Condi Pistol/Dagger has only 0.001% duration drift
   and one material timeline row, so its -3.313% is dominated by shared model
   policy rather than a Weaver damage rule. Its remaining component rows are
   the accepted per-application/fractional tick policy plus shared critical-food
   and Sigil of Earth policies. A Weaver-local adjustment would conceal those
   differences.
3. Critical Sigil of Earth: the Condi fixtures differ by up to two deterministic proc applications. This belongs to shared equipment resolution and requires approval before further changes.
4. Critical food reporting/progression remains the accepted ELM-703 native policy.

Condi Pistol/Dagger's Earth Attunement warning and Power Sword's Fire Swipe
chain warning are expected: the upstream simulator rejects the same rotation
commands with equivalent errors. Power Spear's Galvanize warning is unexpected
but downstream of the shared attunement timeline, not a Weaver legality rule.

## Regression coverage

`tests/professions/elementalist/weaver-parity-regressions.test.js` locks:

- successful execution of all five Weaver fixtures with only upstream-mirrored warnings;
- precombat Elements of Rage activation and its 12.805333-second condition-scaled duration;
- the exact opening Glyph of Storms (Air) packet under Elements of Rage;
- six upgraded Volcano casts and 72 hits from attunement-driven spear etching progression.

The comparison script additionally rejects unclassified ability/mechanic rows and unexpected native warnings.
