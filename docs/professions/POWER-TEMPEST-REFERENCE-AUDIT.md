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
drift, 0.15% duration drift, three material timeline differences, any native
warning, any named ability damage component above the 2% plus absolute-floor
tolerance, or any condition application/effective-stack-duration mismatch.

## Current result

| Variant              | Reference DPS | Local legacy DPS | Native DPS | Native vs legacy | Ability failures |
| -------------------- | ------------: | ---------------: | ---------: | ---------------: | ---------------: |
| Cele alac            |    21,045.626 |       21,045.626 | 21,181.879 |          +0.647% |               11 |
| Condi alac pistol    |    32,501.804 |       32,501.804 | 32,646.700 |          +0.446% |                6 |
| Condi alac scepter   |    35,068.371 |       35,128.480 | 35,408.245 |          +0.796% |                4 |
| Condi pistol/warhorn |    41,519.589 |       41,592.355 | 42,000.938 |          +0.982% |                8 |
| Condi scepter        |    41,468.581 |       41,536.983 | 41,580.176 |          +0.104% |                1 |
| Inferno alac         |    34,233.625 |       34,233.625 | 33,980.502 |          -0.739% |                5 |
| Inferno              |    39,388.303 |       39,388.303 | 39,230.560 |          -0.400% |                5 |
| Power alac hammer    |    30,835.294 |       30,835.294 | 30,826.911 |          -0.027% |                8 |
| Power alac sword     |    33,064.071 |       33,064.071 | 33,039.359 |          -0.075% |                3 |
| Power hammer         |    41,653.679 |       41,653.679 | 41,681.559 |          +0.067% |                7 |
| Power scepter        |    40,801.292 |       40,810.406 | 40,779.904 |          -0.075% |                4 |
| Power spear          |    41,429.318 |       41,429.318 | 41,435.843 |          +0.016% |                4 |
| Power sword          |    41,570.438 |       41,579.949 | 41,551.557 |          -0.068% |                3 |

All native runs complete without warnings. Aggregate DPS passes for every
fixture, but the strict gate fails on 69 per-build ability component rows. The
harness diagnoses all 69: 58 condition-tick-cadence rows, nine Nourishment
rows, and two critical-sigil rows. There are no unclassified strike or
Elementalist-local failures. Condition application counts and effective
stack-seconds match except for Sigil of Earth in Condi Alac Scepter (39 legacy,
40 native).

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

No shared resolver or scheduler behavior has been changed. Elementalist-owned
corrections cover the profession mechanics, but exact ability parity now
requires explicit decisions about shared policies:

- The reference uses one condition-wide whole-second clock; native uses
  per-application ticks and fractional final damage.
- Critical sigils are currently materialized from scheduler-side candidates,
  allowing a subsequently cancelled Hammer orb to create a proc.
- Reference Nourishment banks deterministic progress during ICD and labels its
  packet as flat strike-base damage; native rejects ICD-blocked hits and models
  the packet as life-siphon damage.
- A recharge-delayed concurrent action advances native's serial scheduling
  lane in one Condi Alac Pistol sequence.

The critical-sigil causality and concurrent-lane findings remain valid
candidates for shared correction, subject to explicit confirmation and
cross-profession tests. The condition cadence and Nourishment differences are
accepted legacy model policies and will not be implemented. They remain visible
in the per-ability diagnostics so they cannot conceal new divergence.

## Fixture drift

The audit deliberately reads build and rotation fixtures from the ignored
upstream clone. It reports local fixture drift separately so local preset edits
cannot silently redefine the baseline. Twelve local fixture pairs match
upstream exactly. Power Sword intentionally differs because its local preset
uses the EVTC Fire Elemental profile and explicit Flame Barrage commands; the
upstream comparison continues to use the fixed reference profile.
