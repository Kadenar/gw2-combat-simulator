# Power Vindicator benchmark validation

## Inputs and result

- Defaults: Power Vindicator, Sword/Sword and Greatsword, Alliance/Assassin,
  Vindicator `1-1-1`, with Energy and Hydromancy variants.
- Both use Force/Air on Sword/Sword. The greatsword uses Force/Energy in the
  benchmark variant and Force/Hydromancy in the alternate.
- Both supplied defaults use Berserker's gear except for a Dragon's back item,
  plus Dragonhunter runes and Relic of the Thief.
- Log: `power vindicator (bugged) bench.zevtc`, EVTC build date 2026-04-16.
- Recorded damage: 3,996,040.
- EVTC duration: 93.448 seconds.
- Recorded DPS: 42,762.
- Target death packet: 91.442 seconds.
- Supplied Energy-build simulator replay: 3,970,825 damage over 90.845 seconds,
  45,203 DPS (+5.7% versus the recorded DPS).

The replay preserves the benchmark's pre-cast Spear of Archemorus,
Eternity's Requiem, and Mist Unleashed. It then follows four alternating
Sword/Sword–Assassin and Greatsword–Alliance phases.

The important input counts are:

| Input | Count |
| --- | ---: |
| Dodge / Death Drop | 25 |
| Energy Meld | 10 |
| Preparation Thrust | 28 |
| Brutal Blade | 15 |
| Rift Slash | 15 |
| Chilling Isolation | 12 |
| Shackling Wave | 4 |
| Deathstrike | 4 complete casts |
| Eternity's Requiem | 7 including the pre-cast |
| Spear of Archemorus | 7 including the pre-cast |
| Phantom's Onslaught | 3 complete casts |
| Nomad's Advance | 3 |
| Swap Legends | 7 |
| Swap Weapons | 8 including the pre-combat swap |

EVTC emits a second activation record for Deathstrike and Phantom's
Onslaught. Those records are follow-up stages, not additional player inputs,
and were collapsed in the rotation.

## Endurance and dodge/auto overlap

The EVTC contains 25 genuine Dodge inputs. They are legal with the Energy
default; the Hydromancy default intentionally does not include this replay:

- 25 dodges spend 1,250 endurance.
- Endurance regenerates at 5 per second, or 7.5 with Vigor. The 10-per-second
  value is a cap, not the rate granted by Vigor alone.
- Ten Energy Meld casts grant 25 endurance each.
- Sigil of Energy restores 50 endurance when its nine-second internal
  cooldown is ready.
- Revenant legend swaps also activate weapon-swap sigils on the currently
  equipped set. The replay produces seven Energy-sigil activations while the
  greatsword set is active.

The log also starts the current weapon autoattack during the Vindicator dodge
sequence. The simulator now exposes a Vindicator-only **Dodge + Auto** icon
immediately beside the standard Dodge icon. It adds one endurance-spending
Dodge and the current auto-chain step as concurrent actions; it does not add
or duplicate a free dodge. Both actions can be clicked or dragged into the
rotation.

If a Dodge reaches its scheduled position without 50 endurance, the scheduler
now waits exactly long enough for passive regeneration to reach 50 rather than
discarding the Dodge. This uses 5 endurance per second normally and 7.5 with
Vigor. The rotation builder displays live endurance bars for Vindicator and
Thief so endurance-based damage modifiers remain visible while editing.

All 25 Dodge inputs are endurance-legal in the corrected replay. One separate
resource edge remains: the last Chilling Isolation in the first Assassin phase
is about 0.2 energy short under continuous accounting. The observed inputs,
current costs, and Impossible Odds' net -1 energy per second reproduce that
near-zero boundary. The replay preserves the cast and reports it rather than
silently changing a skill cost or the attached `2-1-3` Invocation traits; this
is consistent with a client energy-tick boundary or a small build/log mismatch.

Call of the Alliance is correctly tied to Song of the Mists. It grants 5
endurance on activation and 3 per enemy hit (8 against this single target).
The attached Invocation `2-1-3` selection uses Roiling Mists, not Song of the
Mists, so Call of the Alliance is implemented but does not contribute to this
benchmark's endurance.

Current endurance rules:

- [Endurance](https://wiki.guildwars2.com/wiki/Endurance)
- [Energy Meld](https://wiki.guildwars2.com/wiki/Energy_Meld)
- [Reaver's Curse](https://wiki.guildwars2.com/wiki/Reaver%27s_Curse)
- [Superior Sigil of Energy](https://wiki.guildwars2.com/wiki/Superior_Sigil_of_Energy)
- [Song of the Mists](https://wiki.guildwars2.com/wiki/Song_of_the_Mists)

## Cast and impact timing findings

| Skill | Previous simulator value | Validated value |
| --- | ---: | ---: |
| Chilling Isolation | 680 ms with Quickness | 480 ms |
| Mist Unleashed | 520 ms with Quickness | 480 ms; hit at 400 ms |
| Energy Meld | no explicit Quickness value | 440 ms |
| Nomad's Advance | 750 ms | 960 ms fixed movement/aftercast |
| Spear of Archemorus | 800/600 ms | 600/480 ms |
| Spear impact | at cast completion | 2,960 ms after completion in this log |
| Death Drop landing lock | not modeled correctly | 200 ms |
| Death Drop landing hit | 800 ms after landing input | 160 ms into landing lock |

Death Drop has two EVTC stages: the generic dodge starts about 600 ms before
the Death Drop landing activation, and the landing activation lasts about
200 ms. The simulator models the 200 ms action lock because weapon actions
overlap the aerial stage. The complete observed dodge-to-impact interval is
about 760 ms, consistent with the documented 0.8-second evade sequence.

Spear projectile travel is target-distance dependent. The 2,960 ms delay is
the repeated value in this stationary benchmark and is intentionally scoped
to reproducing this log.

Reference pages:

- [Spear of Archemorus](https://wiki.guildwars2.com/wiki/Spear_of_Archemorus)
- [Nomad's Advance](https://wiki.guildwars2.com/wiki/Nomad%27s_Advance)
- [Death Drop](https://wiki.guildwars2.com/wiki/Death_Drop)
- [October 4, 2022 Vindicator update](https://wiki.guildwars2.com/wiki/Game_updates/2022-10-04)

## Vindicator trait audit

The attached `1-1-1` selection is Leviathan Strength, Reaver's Curse, and
Forerunner of Death. The three minor traits are always active.

| Trait | Simulator disposition |
| --- | --- |
| Tenacious Ruin | Implemented by the selected Vindicator dodge replacement |
| Leviathan Strength | Implemented: +10% strike damage below full endurance |
| Amnesty of Shing Jea | Out of the single-target damage model; support boons |
| Redemptor's Sermon | Out of model; healing and protection |
| Balance in Discord | Out of model; self-healing/boons on invocation |
| Reaver's Curse | Implemented: 50% Energy Meld recharge reduction, six-second enhanced dodge, +100% dodge damage |
| Angsiyan's Trust | Implemented: removes Energy Meld cost and grants 25 energy in combat |
| Song of Arboreum | Implemented: 40 endurance and nine seconds of Vigor from Energy Meld |
| Empire Divided | Implemented: +240 Power above 50% health; healing branch is out of model |
| Forerunner of Death | Implemented: Death Drop coefficient 3.3 and +25% strike damage for ten seconds after impact |
| Vassals of the Empire | Strike profile implemented; boon output is outside the single-target damage model; not selected |
| Saint of zu Heltzer | Out of model; healing-only dodge replacement |

The Forerunner modifier is applied after the triggering Death Drop, not to
that same hit. Reaver's Curse is consumed by the next landing.

Current trait references:

- [Vindicator traits](https://wiki.guildwars2.com/wiki/Vindicator)
- [Leviathan Strength](https://wiki.guildwars2.com/wiki/Leviathan_Strength)
- [Forerunner of Death](https://wiki.guildwars2.com/wiki/Forerunner_of_Death)
- [Empire Divided](https://wiki.guildwars2.com/wiki/Empire_Divided)
- [Song of Arboreum](https://wiki.guildwars2.com/wiki/Song_of_Arboreum)
