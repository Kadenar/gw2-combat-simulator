# Elementalist Native Migration Audit

Audit date: 2026-08-13

## Outcome

The native Elementalist implementation was evaluated directly against all 39
supported upstream build/rotation fixtures at reference commit
`e96714400af1fae655eda701e7f9c975db948783`.

- Tempest: 13 fixtures; every aggregate delta is within 1.186%.
- Catalyst: 11 fixtures; eight are within 1.2%, and three exceed it because of
  shared condition-integration and scheduler policy.
- Weaver: five fixtures; one is within 1.2%, and four exceed it because of
  shared condition-integration, scheduling, critical-food, and critical-sigil
  policy.
- Evoker: 10 fixtures; every aggregate delta is within 1.090%.
- Every per-ability and mechanic difference is classified. There are no open
  Elementalist-local parity gaps in the audited fixture set.

The actionable threshold is 1.2% aggregate DPS. The audit also checks static
attributes, warnings, material timeline changes, per-ability strike and
condition damage, casts, hits, condition applications, and effective
stack-seconds. Component comparisons use a 2% relative threshold with an
absolute floor so opposite strike/condition differences cannot cancel.

## Elementalist-local corrections

The migration work completed the following native behavior:

- rotation legality, delayed cooldowns, attunement dwell, aura consumption,
  weapon swaps, and Evoker swap/recharge rules;
- Pistol bullets, Hammer orbs and Grand Finale, Spear etchings, Primordial
  Stance, overload timing, and declared endurance gains;
- Tempest, Weaver, Catalyst, Evoker, and core trait behavior, including
  duration scaling, precombat guards, aura/control reactions, and profession
  state ownership;
- Catalyst Elemental Empowerment, energy chronology, Vicious Empowerment,
  Steamshrieker combos, Shattering Ice, and zero-damage finishers;
- Weaver precombat and condition-scaled Elements of Rage, Unravel gating, and
  attunement-driven etching progression;
- Evoker familiar readiness/order, charge ownership, delayed attunement
  recharge, and Electric Enchantment materialization;
- large/small hitbox assumptions and the EVTC-derived Fire Elemental actor;
- direct reference parity gates for all 39 supported presets and rotations.

Unsupported Evoker presets without upstream fixtures were removed from the
native manifest rather than being treated as verified implementations.

## Remaining discrepancies outside Elementalist scope

No net source change under `js/platform/gw2/` or `js/platform/engine/` was made
by this final audit. The remaining over-threshold cases cannot be corrected
honestly inside `js/professions/elementalist/`:

| Suite    | Variant                     | DPS delta | Shared cause                                                                                                                   |
| -------- | --------------------------- | --------: | ------------------------------------------------------------------------------------------------------------------------------ |
| Catalyst | Condi quick pistol/warhorn  |   +4.087% | Reference uses a condition-wide whole-second clock; native integrates per application and includes fractional final intervals. |
| Catalyst | Power sword Fresh Air       |  -22.956% | Concurrent sphere/attunement arbitration stretches the rotation by 22.452% and rejects downstream actions.                     |
| Catalyst | Power quick sword Fresh Air |  -29.413% | The same shared arbitration stretches the rotation by 36.986% and rejects a sphere.                                            |
| Weaver   | Condi pistol                |   -3.716% | Shared condition integration plus concurrent readiness and deterministic critical-proc policy.                                 |
| Weaver   | Condi pistol/dagger         |   -3.313% | Near-exact timeline; remaining delta is shared condition, critical-food, and critical-sigil policy.                            |
| Weaver   | Condi scepter               |   -5.716% | Shared condition integration plus concurrent readiness and deterministic critical-proc policy.                                 |
| Weaver   | Power spear                 |  -17.586% | Shared attunement/concurrent arbitration stretches the rotation by 18.864%, changing downstream skills and one legality check. |

Elementalist-local compensation factors were rejected because they would hide
shared behavior and break the causal per-ability checks. Detailed evidence is
retained in the Catalyst and Weaver handoff documents.

## Non-blocking data limits

- The Thorns boss-aura cadence is encounter configuration, not Elementalist
  profession state.
- Air, Ice, and Earth Elemental AI lacks representative combat-log evidence.
  The native simulator follows the upstream fixture contract by using Fire;
  new summon models should not be invented without evidence.

## Retirement and retained reference

The standalone Elementalist implementation, its application route, build/site
entries, CSV runtime assets, and local parity tests were removed after the
Elementalist-local audit gaps were closed. The audit harness now compares the
native engine directly with the upstream clone.

`reference-repos/Elementalist-Simulator/` remains intact and ignored by Git for
future reference and repeatable audits.

## Reproduction

```powershell
npm run build:modules
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-power-tempest-reference.mjs --check-actionable --summary
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-catalyst-reference.mjs --check-actionable --summary
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-weaver-reference.mjs --check-actionable --summary
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-evoker-reference.mjs --check-actionable --summary
```

The actionable commands remain red for the shared-engine findings documented
above and in the suite handoffs. Tempest and Evoker remain inside the aggregate
DPS threshold but exceed timeline-specific caps; Catalyst and Weaver also have
aggregate failures. The gates still reject new warnings, unclassified
differences, or Elementalist-local regressions.
