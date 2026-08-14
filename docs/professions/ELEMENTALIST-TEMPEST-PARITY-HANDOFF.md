# Elementalist Tempest Parity Handoff

Handoff date: 2026-08-13

## Status

All 13 upstream Tempest build/rotation fixtures execute through the native
Elementalist implementation. Every aggregate DPS result is within the 1.2%
actionable threshold; the observed range is -0.739% to +1.186%.

The audit compares native output directly with the retained upstream clone. It
checks aggregate damage and duration, material rotation timing, warnings,
static attributes, named-ability strike and condition damage, casts, hits,
condition applications, and effective stack-seconds. All observed differences
are classified. The aggregate gate is green, but the actionable command remains
red because Condi Alacrity Pistol has three shared-scheduler timeline changes.

## Completed corrections

- Overloads carry Elementalist profession-mechanic ownership so Fireworks
  activates on the correct packets.
- Fresh Air preserves resets from already-scheduled future hits.
- Hammer orbs emit their full packet sequence, and Grand Finale cancels and
  replaces remaining orbs with delayed projectiles.
- Transcendent Tempest orders before same-time completion effects.
- Tempestuous Aria and Persisting Flames use the upstream duration and stacking
  windows.
- Strength of Stone, Elemental Explosion, starting-attunement overload dwell,
  and the fixed reference Fire Elemental packet profile are represented.
- Critical sigils originate from surviving resolved hits, so cancelled Hammer
  packets cannot proc them.

## Accepted shared policies

- Reference conditions use one whole-second condition-wide clock. Native uses
  per-application ticks and fractional final intervals.
- Reference Nourishment banks deterministic expected progress during ICD and
  reports a flat strike packet. Native uses no banking and life-siphon
  semantics.

These differences remain visible in strict per-ability diagnostics. They do not
create an actionable Tempest failure and must not be hidden with
Elementalist-local multipliers.

The remaining Condi Alacrity Pistol timing discrepancy belongs to concurrent
command arbitration in the shared scheduler. It cannot be corrected in the
Elementalist profession without a rotation-specific workaround.

## Reproduction

```powershell
npm run build:modules
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-power-tempest-reference.mjs --summary
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-power-tempest-reference.mjs --check-actionable --summary
```

Use `--variant=<name>` and `--skill=<name>` for focused diagnostics. The
reference clone remains at `reference-repos/Elementalist-Simulator/`.
