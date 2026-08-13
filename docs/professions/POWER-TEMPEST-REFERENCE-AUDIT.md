# Tempest Reference Audit

Audit date: 2026-08-13

## Baseline

The upstream `SnappyJoeGW2/Elementalist-Simulator` repository is cloned at
`reference-repos/Elementalist-Simulator/`. The directory is ignored by Git.

- Branch: `master`
- Commit: `e96714400af1fae655eda701e7f9c975db948783`
- Commit date: 2026-07-16
- Commit subject: `15 July patch update`

The audit harness uses the upstream build and rotation files as its fixture
inputs. Each fixture runs through the upstream engine, this repository's
embedded legacy engine, and the native engine.

Run the regression gate after building:

```powershell
npm run build:modules
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-power-tempest-reference.mjs --check --summary
```

Omit `--summary` for per-skill and timeline diagnostics. Add
`--variant=<name>` or `--skill=<name>` to isolate a build or skill.

The gate covers all 13 migrated Tempest fixtures. It fails above 1.2% DPS
drift, 0.15% duration drift, three material timeline differences, or any native
warning.

## Current result

| Variant              | Reference DPS | Native DPS | DPS delta | Duration delta | Timeline changes |
| -------------------- | ------------: | ---------: | --------: | -------------: | ---------------: |
| Cele alac            |    21,045.626 | 21,146.098 |   +0.477% |        +0.009% |                1 |
| Condi alac pistol    |    32,501.804 | 32,613.485 |   +0.344% |        +0.122% |                3 |
| Condi alac scepter   |    35,068.371 | 35,479.802 |   +1.173% |         0.000% |                0 |
| Condi pistol/warhorn |    41,519.589 | 41,918.569 |   +0.961% |         0.000% |                0 |
| Condi scepter        |    41,468.581 | 41,829.587 |   +0.871% |         0.000% |                0 |
| Inferno alac         |    34,233.625 | 33,895.447 |   -0.988% |         0.000% |                0 |
| Inferno              |    39,388.303 | 39,136.256 |   -0.640% |        +0.003% |                3 |
| Power alac hammer    |    30,835.294 | 30,834.768 |   -0.002% |         0.000% |                0 |
| Power alac sword     |    33,064.071 | 33,025.944 |   -0.115% |         0.000% |                0 |
| Power hammer         |    41,653.679 | 41,691.114 |   +0.090% |         0.000% |                0 |
| Power scepter        |    40,801.292 | 40,754.291 |   -0.115% |        +0.010% |                2 |
| Power spear          |    41,429.318 | 41,416.344 |   -0.031% |         0.000% |                0 |
| Power sword          |    41,570.438 | 41,529.755 |   -0.098% |         0.000% |                0 |

All native runs complete without warnings. All six power fixtures are within
0.115% DPS of upstream. The remaining condition-build spread is bounded by
condition tick and modifier-window timing; it does not involve missing casts or
rotation drift.

The audit supplies an effectively unkillable positive target health. This uses
the shared engine's existing rotation-end scoring behavior while matching the
upstream engine's unkillable golem.

## Corrected findings

### Fireworks and Overloads

Overload packets now identify themselves as Elementalist profession-mechanic
attacks. The existing Fireworks relic rule consequently activates on Overloads,
matching upstream. Derived effects such as Lightning Jolt and Electric
Discharge remain unequipped effects and do not inherit profession-mechanic
weapon strength.

### Fresh Air lookahead

Fresh Air now preserves a reset from an already-scheduled future hit when an
intervening attunement swap updates cooldowns. This removes the Power Alacrity
Hammer rotation's 1.036-second Air-attunement delay without changing the shared
scheduler.

### Hammer skills

Hammer orbs emit all 15 one-second packets. Grand Finale replaces the remaining
orb packets with one 1.4-coefficient projectile per active orb and applies its
0.68-second travel delay.

### Tempest modifier order

Transcendent Tempest applies before same-time completion effects. Tempestuous
Aria and Persisting Flames use their upstream duration and stacking windows,
including the two additional fire-field packets from Persisting Flames.

### Missing profession mechanics

The native implementation now covers Strength of Stone's Immobilize trigger
and strict three-second interval, Elemental Explosion without stored pistol
bullets, starting-attunement Overload dwell, and the explicit upstream Fire
Elemental packet profile used by migrated snapshots.

## Shared-engine scope

The experimental two-pass resolver/scoring change was reverted. The final
Tempest corrections use Elementalist-owned event metadata, state, catalog data,
and scheduler hooks. No resolver behavior is required for this parity result.

## Fixture drift

The audit deliberately reads build and rotation fixtures from the ignored
upstream clone. It reports local fixture drift separately so local preset edits
cannot silently redefine the baseline.
