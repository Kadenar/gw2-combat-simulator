# Elementalist Evoker Parity Handoff

Handoff date: 2026-08-13

## Scope

This audit compares all 10 Evoker build/rotation fixtures supported by the
native tool directly with the upstream reference repository. It checks
aggregate output, timeline drift, warnings, static attributes, per-ability
strike and condition damage, casts, hits, condition applications, and effective
stack-seconds.

Run it after building modules:

```powershell
npm run build:modules
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-evoker-reference.mjs --summary
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-evoker-reference.mjs --check-actionable --summary
```

Use `--variant=<name>` and `--skill=<name>` for focused diagnostics. Every
aggregate DPS result is within 1.2%, but the actionable command remains red
because shared-scheduler timeline and duration drift exceeds the recorded caps.
It also enforces unexpected-warning checks and zero unclassified differences.

## Current result

| Variant                  | Reference DPS | Native DPS |   Delta | Duration delta | Timeline changes | Warnings | Unexpected warnings |
| ------------------------ | ------------: | ---------: | ------: | -------------: | ---------------: | -------: | ------------------: |
| Condi Air SE             |    43,199.071 | 43,646.420 | +1.036% |        +0.003% |                9 |        0 |                   0 |
| Condi Alacrity Pistol/Wh |    38,202.731 | 38,496.189 | +0.768% |        +0.192% |                3 |        0 |                   0 |
| Condi Pistol/Dagger      |    43,272.833 | 43,611.144 | +0.782% |        +0.202% |                6 |        0 |                   0 |
| Condi Pistol/Warhorn     |    43,481.845 | 43,478.546 | -0.008% |        +0.202% |               13 |        0 |                   0 |
| Condi Quick Air SE       |    39,561.096 | 39,992.152 | +1.090% |        +0.101% |                5 |        0 |                   0 |
| Inferno SE               |    37,804.646 | 37,634.533 | -0.450% |             0% |                0 |        2 |                   0 |
| Inferno Quick SE         |    36,819.389 | 36,656.771 | -0.442% |             0% |                0 |        2 |                   0 |
| Power Alacrity Toad      |    34,236.731 | 33,981.901 | -0.744% |        +0.270% |                5 |        0 |                   0 |
| Power Hare               |    38,930.827 | 39,170.345 | +0.615% |             0% |               14 |        0 |                   0 |
| Power Quick Hare         |    36,541.989 | 36,212.068 | -0.903% |        +1.463% |               13 |        0 |                   0 |

All retained local Evoker fixtures match their upstream build and rotation inputs. Static attributes match apart from existing reference/native rounding.

## Completed Evoker corrections

- Evoker attunement swaps now preserve the remaining short recharge of off-attunements when a requested swap waits for readiness. This is implemented in Elementalist core with an explicit Evoker gate.
- An active familiar cast now blocks overlapping actions until its cast completes. Basic familiars reset charges before the completed parent weapon skill or Rejuvenate reapplies its charge progression, matching the reference's concurrent-child ordering.
- Evasive Arcana remains a core Elementalist trait effect but no longer grants Evoker familiar charges. The reference does not treat the dodge trait skill as an Evoker weapon-skill charge source.
- Electric Enchantment can materialize stacks left at the end of a reference rotation onto eligible resolved player strikes from the combat window. Hare's Agility immediately materializes its five granted stacks through the same Evoker-local path.
- Power Alacrity Toad now produces the reference familiar sequence without warnings, including the previously missing three Calcify casts and one Seismic Impact.

These changes are confined to Elementalist core behavior with an explicit Evoker gate and `specializations/evoker/`. No shared resolver or scheduler behavior was changed during this pass.

## Removed native presets

The following unsupported presets and their orphaned native assets were removed from the Elementalist manifest and native tool:

- Condi Alacrity Otter (Pistol/Warhorn)
- Power Alacrity Toad Severance
- Condi Arcane SE

The shared Power Alacrity Toad rotation remains because the retained Power Alacrity Toad preset uses it. Upstream reference fixtures were not changed.

## Diagnosed policy differences

All 77 native-versus-reference ability component divergences are classified:

- 39 `condition-tick-cadence`: accepted ELM-701 behavior. Reference uses a condition-wide whole-second clock; native uses per-application ticks and fractional final intervals.
- 12 `concurrent-readiness-timeline`: downstream timing differences from the shared scheduler behavior below.
- 14 `resolved-proc-causality`: reference familiar and Electric Enchantment resolution can use final or restored scheduler state; native applies Elementalist-local reactions to resolved events.
- 7 `critical-food-policy`: accepted ELM-703 behavior.
- 2 `critical-sigil-causality`: shared deterministic critical-proc progression differs for Sigil of Earth.
- 3 `reference-reporting`: Bloodstone Explosion reports condition applications but zero applied stack-seconds upstream.
- 0 unclassified.

All 14 condition application/effective-duration divergences are also
classified: six condition-duration rounding, three Bloodstone
reference-reporting, two Sigil of Earth causality, and three
attunement-timeline causality. None are unclassified.

## Shared-engine finding retained by scope

The reference concurrent runtime can run a child command at a future timestamp
and then restore the parent timestamp before continuing the serial lane. The
shared native scheduler advances time monotonically. That makes some concurrent
familiar/attunement rows early or moves later serial actions, most visibly in
Power Quick Hare's +1.463% duration delta.

Exact timestamp parity would require shared scheduler support for nonmonotonic
child execution or an equivalent command-lane model. That change was not made
because this parity pass is restricted to Elementalist. The current drift now
exceeds the recorded caps, so the actionable command correctly remains red
despite every aggregate DPS result staying within 1.2%.

The two Inferno variants each expose two invalid Transmute Fire attempts because no Fire Aura is active. The reference silently rejects the same commands, so the audit classifies these as expected rather than unexpected warnings.

## Regression coverage

`tests/professions/elementalist/native-mechanics.test.js` locks:

- delayed Evoker off-attunement recharge preservation;
- familiar cast readiness and concurrent parent charge ordering;
- Rejuvenate charge restoration after a concurrent familiar;
- Evasive Arcana's exclusion from familiar charge generation;
- final Electric Enchantment materialization.

`tests/professions/elementalist/elementalist.test.js` verifies that the 39 retained Elementalist presets and their build/rotation assets migrate through the native codec with no orphaned files. The comparison script audits every retained Evoker fixture and rejects any new actionable divergence.
