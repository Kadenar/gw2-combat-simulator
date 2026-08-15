# Elementalist native elemental audit

Date: 2026-08-15

## Outcome

Glyph of Elementals now has one simulation behavior: the native Fire Elemental
actor. The user can no longer select native AI versus fixed reference packets,
and the duplicate `Reference elemental booned` assumption is gone.

The supported Elementalist corpus contains 39 presets. Twenty-nine equip Glyph
of Elementals. Power Tempest Sword already commanded Flame Barrage; the other
28 Glyph rotations were updated. The remaining 10 presets do not equip the
elite and were not given Flame Barrage commands.

Every Glyph preset now casts Glyph of Elementals as rotation command 1. The
840 ms cast completes before or at the explicit combat marker; presets without
a marker complete it before their first damaging event. For rotations that
previously summoned during combat, the opening was delayed by the 840 ms
precast while existing command order and relative offset intent were retained.

## Findings and cleanup

The retired implementation was spread across more than the assumptions UI:

- `elementalSimulationProfile` selected native AI or a fixed packet replay.
- `glyphBoonedElementals` applied a separate 1.7 multiplier to fixed strike
  packets instead of using native summon and party-boon handling.
- Glyph skill data owned a 120-second, 107-effect fixed reference schedule.
- Cast duration, recharge, lifecycle, availability, and event observation all
  branched on the selected profile.
- All 39 saved build files persisted both retired assumptions.

The cleanup removed the selector controls, runtime configuration fields,
reference schedule, Glyph `referenceEffects`, reference replay scheduler, boon
multiplier, and profile branches. Glyph's native summon lifecycle and custom
post-expiry recharge are now unconditional. Old snapshots still load, but the
build normalizer deletes both retired fields instead of preserving them.

Flame Burst party might continues through the native summon event path with
party recipients and the shared duration policy. Damage is owned by the Fire
Elemental actor; Glyph itself no longer emits damage packets.

## Rotation audit

All 29 Glyph presets summon before combat and assume alacrity, so Flame
Barrage's 15-second recharge is 12 seconds. Each affected rotation requests the
first command as soon as the elemental is available and combat placement
allows, then requests it every 12 seconds until the rotation ends or the
elemental's 120-second lifetime expires. These insertions are deliberately not
DPS-optimized.

The final corpus produced 259 valid Flame Barrage casts. Most casts occurred at
the exact requested time. Condi Evoker Pistol/Warhorn was delayed by 48 ms,
Condi SE Evoker by 53 ms, and both Inferno Evoker variants by 285 ms. Later
commands followed the actual recharge time. No delay exceeded the audit
threshold of 1 second.

### Tempest

| Preset                      | Casts | First-last (s) | Max delay | Simulated DPS | Warnings |
| --------------------------- | ----: | -------------: | --------: | ------------: | -------: |
| Celestial Alacrity Tempest  |     4 |     0.84-36.84 |      0 ms |        20,852 |        0 |
| Power (Sword)               |     9 |     3.94-99.94 |      0 ms |        41,914 |        0 |
| Power (Scepter)             |     9 |    9.70-105.70 |      0 ms |        39,123 |        0 |
| Power (Spear)               |     9 |     3.94-99.94 |      0 ms |        41,586 |        0 |
| Power (Hammer)              |     9 |    8.94-104.94 |      0 ms |        39,749 |        0 |
| Power Alacrity (Sword)      |    10 |    0.84-108.84 |      0 ms |        32,573 |        0 |
| Power Alacrity (Hammer)     |    10 |    6.64-114.64 |      0 ms |        29,590 |        0 |
| Condi (Pistol/Warhorn)      |     8 |    10.84-94.84 |      0 ms |        41,935 |        0 |
| Condi (Scepter)             |     8 |     4.30-88.30 |      0 ms |        40,680 |        0 |
| Condi Alacrity (Pistol/Wh.) |    10 |    3.54-111.54 |      0 ms |        32,800 |        1 |
| Condi Alacrity (Scepter)    |     8 |     0.84-84.84 |      0 ms |        34,202 |        0 |
| Inferno                     |     9 |    9.70-105.70 |      0 ms |        40,757 |        0 |
| Inferno Alacrity            |    10 |    4.30-112.30 |      0 ms |        34,429 |        0 |

### Catalyst

| Preset                         | Casts | First-last (s) | Max delay | Simulated DPS | Warnings |
| ------------------------------ | ----: | -------------: | --------: | ------------: | -------: |
| Power (Sword FA)               |     9 |     0.84-96.84 |      0 ms |        39,303 |        0 |
| Power (Scepter BttH)           |     9 |    6.60-102.60 |      0 ms |        41,285 |        1 |
| Power Quickness (Sword FA)     |    10 |    0.84-108.84 |      0 ms |        33,038 |        0 |
| Power Quickness (Scepter BttH) |    10 |    7.80-115.80 |      0 ms |        33,677 |        0 |
| Condi (Pistol/Dagger)          |     9 |   13.76-109.76 |      0 ms |        37,365 |        0 |
| Condi Quickness (Pistol/Wh.)   |    10 |    8.68-116.68 |      0 ms |        32,374 |        1 |
| Condi Quickness (Pistol/Dag.)  |    10 |   12.08-120.08 |      0 ms |        32,320 |        0 |
| Inferno                        |     8 |     6.80-90.80 |      0 ms |        40,374 |        0 |
| Inferno Quickness              |     9 |    6.80-102.80 |      0 ms |        36,429 |        0 |

### Evoker

| Preset                           | Casts | First-last (s) | Max delay | Simulated DPS | Warnings |
| -------------------------------- | ----: | -------------: | --------: | ------------: | -------: |
| Condi (Pistol/Dagger)            |     8 |     7.00-91.00 |      0 ms |        43,386 |        0 |
| Condi (Pistol/Warhorn)           |     8 |     7.00-91.05 |     48 ms |        43,305 |        0 |
| Condi SE (Air)                   |     8 |     0.84-84.89 |     53 ms |        44,215 |        0 |
| Condi Quickness SE (Air)         |     9 |     1.62-97.62 |      0 ms |        40,217 |        0 |
| Condi Alacrity Toad (Pistol/Wh.) |     9 |    5.36-101.36 |      0 ms |        38,415 |        1 |
| Inferno SE                       |    10 |    0.84-109.13 |    285 ms |        38,974 |        1 |
| Inferno Quickness SE             |    10 |    0.84-109.13 |    285 ms |        38,073 |        1 |

## Non-elemental rotation warnings

Six simulations retain warnings that were also present in the native baseline
before Flame Barrage insertion. None involve Glyph of Elementals, Flame
Barrage, or the summoned actor:

- Condi Alacrity Tempest Pistol/Warhorn, Condi Quickness Catalyst
  Pistol/Warhorn, and Condi Alacrity Toad Evoker Pistol/Warhorn attempt
  Elemental Explosion without all four bullets.
- Power Catalyst Scepter BttH attempts Deploy Jade Sphere (Air) below 10
  energy.
- Inferno Evoker SE and Inferno Quickness Evoker SE attempt Transmute Fire
  without an active Fire Aura.

## Validation

- `npm run check`: passed, including the production build, typecheck, source
  syntax checks, generated-output checks, and bundled-site checks.
- Targeted native elemental and asset suite: 83 of 83 tests passed.
- New preset corpus test: all 29 Glyph presets passed; it checks that Glyph is
  command 1 and completes before combat, plus Flame Barrage cast count,
  validity, timing, autonomous summon actions, and absence of fixed Glyph
  damage packets.
- Full Elementalist suite: 113 of 114 tests passed. The remaining failure is
  the existing Power Catalyst Spear energy assertion: Deploy Jade Sphere
  (Fire) is attempted below 10 energy. That preset does not equip Glyph of
  Elementals, and its rotation was outside this audit.
- Prettier was run on every touched supported file.

## Remaining limitations

- The native actor is always the Fire Elemental. Air, Ice, and Earth elemental
  behavior still needs combat-log evidence.
- The added commands intentionally prioritize Flame Barrage availability over
  rotation optimization. A later benchmark pass may find better placements.
- The saved presets currently assume permanent alacrity. If that assumption is
  removed, the scheduler will delay early commands until the actual recharge,
  but the persisted 12-second command placement should be revisited.
