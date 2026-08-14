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
inputs. Each fixture runs through the upstream engine and the native shared
engine.

Run the regression gate after building:

```powershell
npm run build:modules
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-power-tempest-reference.mjs --check-actionable --summary
```

Omit `--summary` for per-skill and timeline diagnostics. Add
`--variant=<name>` or `--skill=<name>` to isolate a build or skill.

The actionable gate covers all 13 migrated Tempest fixtures. It fails above 1.2% DPS
drift, 0.15% duration drift, three material timeline differences, any native
warning, any condition application/effective-stack-duration mismatch, any
critical-sigil or unclassified component difference, or any Condi Alac Pistol
timeline difference. The separate strict `--check` also fails accepted
condition-cadence and Nourishment component differences.

## Current result

| Variant              | Reference DPS | Native DPS | Native delta |
| -------------------- | ------------: | ---------: | -----------: |
| Cele alac            |    21,045.626 | 21,181.879 |      +0.647% |
| Condi alac pistol    |    32,501.804 | 32,646.700 |      +0.446% |
| Condi alac scepter   |    35,068.371 | 35,309.401 |      +0.687% |
| Condi pistol/warhorn |    41,519.589 | 42,012.186 |      +1.186% |
| Condi scepter        |    41,468.581 | 41,580.176 |      +0.269% |
| Inferno alac         |    34,233.625 | 33,980.502 |      -0.739% |
| Inferno              |    39,388.303 | 39,230.560 |      -0.401% |
| Power alac hammer    |    30,835.294 | 30,826.911 |      -0.027% |
| Power alac sword     |    33,064.071 | 33,039.359 |      -0.075% |
| Power hammer         |    41,653.679 | 41,663.333 |      +0.023% |
| Power scepter        |    40,801.292 | 40,779.904 |      -0.052% |
| Power spear          |    41,429.318 | 41,435.843 |      +0.016% |
| Power sword          |    41,570.438 | 41,551.557 |      -0.045% |

All native runs complete without warnings. Aggregate DPS passes for every
fixture. Strict per-ability differences are
classified as shared condition-tick cadence or Nourishment policy; there are no
critical-sigil, unclassified, or mechanic failures. Condition application
counts and effective stack-seconds match for every ability, including 39 Sigil
of Earth applications in Condi Alac Scepter.

The actionable command remains red only because Condi Alacrity Pistol has
three timeline changes where exact parity is required. Its aggregate delta is
+0.446%; the timing difference is shared concurrent-command arbitration, not a
Tempest-local damage rule.

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

Two confirmed findings were corrected in the shared engine:

- Air, Earth, and Torment sigils now materialize after damage resolution, so
  cancelled packets cannot trigger them. Scheduler-only predictions remain
  available for profession state and rotation legality.
- Cooldown-delayed concurrent commands remain queued while an earlier eligible
  serial command runs. State-gated serial commands yield to pending concurrent
  work, preserving attunement and other shared state transitions.

Two diagnosed model-policy differences remain accepted:

- The reference uses one condition-wide whole-second clock; native uses
  per-application ticks and fractional final damage.
- Reference Nourishment banks deterministic progress during ICD and labels its
  packet as flat strike-base damage; native rejects ICD-blocked hits and models
  the packet as life-siphon damage.

The condition cadence and Nourishment differences remain visible in the strict
per-ability diagnostics so they cannot conceal new divergence.

## Fixture drift

The audit deliberately reads build and rotation fixtures from the ignored
upstream clone. It reports local fixture drift separately so local preset edits
cannot silently redefine the baseline. Twelve local fixture pairs match
upstream exactly. Power Sword intentionally differs because its local preset
uses the EVTC Fire Elemental profile and explicit Flame Barrage commands; the
upstream comparison continues to use the fixed reference profile.
