# Elementalist native elemental audit

Date: 2026-08-16

## Outcome

Glyph of Elementals uses native Fire and Earth Elemental actors. The elite
skill selector exposes `Glyph of Elementals (Fire)` and
`Glyph of Elementals (Earth)`, and the scheduler automatically summons the
selected actor. Saved rotations no longer need to cast the glyph.

Each active actor replaces its glyph with its matching command:

- Fire Elemental: Flame Barrage;
- Earth Elemental: Stomp.

The actors own their strike damage and use shared summon boon handling.
Player-owned conditions and boons retain player attribution where ArcDPS
records them that way.

## Earth Elemental evidence

Source: `20260718-152802.zevtc`, a Hammer Catalyst log recorded by ArcDPS build 20260715.

The Earth Elemental agent has species ID 6523 and is owned by the Elementalist
player instance. Its recorded base attributes are 2,061 toughness, 800 healing
power, and 35 condition damage. The actor has the `Elemental Pet` marker and
the player has the 120-second `Earth Elemental Summoned` buff.

### Autonomous attacks

| Skill            | EVTC ID | Impact | Animation end | AI recovery | Recharge | Base damage |
| ---------------- | ------: | -----: | ------------: | ----------: | -------: | ----------: |
| Punch            |    2664 |  0.36s |         1.00s |       2.30s |        - |         600 |
| Enervating Punch |    2665 |  0.52s |         1.52s |       2.60s |       8s |       1,200 |

Punch is the filler action. Enervating Punch is prioritized when its recharge
is ready and applies three seconds of `Weakness`. The base-damage values are
deterministic centers chosen from the observed noncritical damage rolls; the
shared summon damage path adds critical chance, critical damage, and eligible
party boons.

### Stomp command

Stomp uses EVTC skill ID 2666. It has a 1.56-second impact, a 3.52-second full
animation, and an 18-second recharge. Its strike uses 1,500 base damage. The
impact grants three seconds of `Protection` to allies, applies five seconds of
`Crippled`, and applies eleven seconds of `Immobilized`. Conditions retain
player attribution. A Stomp command interrupts the Earth Elemental's current
autonomous action. AI resumes 0.08 seconds after subsequent command animations;
the first-command recovery is 0.56 seconds.

The log contains seven Stomps. Six have direct animation starts. The opening
precast begins before the log snapshot, so the importer reconstructs its start
from the unmatched animation stop and recorded animation duration.

## EVTC reconstruction

The Elementalist profile now reconstructs the four attunement buffs and
suppresses false weapon swaps caused by those transitions. Raw skill IDs 5736
and 5737 resolve to `Glyph of Storms (Fire)` and
`Glyph of Storms (Air)`, respectively. Earth Elemental Stomp is reconstructed
from species-6523 actor animations owned by the selected player.

For the source log, reconstruction produces:

- parser `elementalist:catalyst`;
- seven Stomp commands;
- 24 attunement commands;
- two Fire and two Air Glyph of Storms casts;
- no unsupported-action warnings.

The retained warning reports eight genuinely interrupted player casts and
preserves their recorded durations.

## Remaining limitations

- Air and Ice Elemental AI still need combat-log evidence.
- Earth base-damage centers and recovery timings are derived from this single
  log and should be refined if logs without external boons expose tighter
  samples.
- EVTC parity is not claimed; the importer preserves observed inputs while the
  simulator uses its deterministic damage model.
