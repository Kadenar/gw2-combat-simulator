# Skill timing audit: 40 ms boundaries

Audited the current working tree on 2026-09-24 after a successful `npm run build:modules`.

Loaded all nine assembled profession catalogs: **1797 skills and 826 balance profiles**. **215 skills** have at least
one cast field off the 40 ms grid: **125 player-timing skills** and **90 summon-timing skills**. Of the latter, **58**
also have off-grid explicit Quickness durations.

## Scope and interpretation

- Checks the actual assembled values after catalog merging and generated packet expansion, including internal skills and
  summons. Duplicate names remain separate by skill ID.
- Cast checks cover `castTimeMs` and explicit `quicknessCastTimeMs`. Values within 0.000001 ms of a 40 ms multiple are
  treated as aligned.
- Damage checks cover strike and condition-application `atMs`, every `ticks[].atMs`, and `intervalMs`, including balance
  profiles. Offsets are relative to their declared cast-start or cast-end anchor.
- This is an authored catalog timing audit. It does not enumerate every procedural handler, build-dependent runtime cast
  variant, travel delay, absolute simulation timestamp, condition tick, cooldown, or interruption cutoff.
- Summon base durations and explicit Quickness durations are distinct timing references. An off-grid base value alone
  does not imply its Quickness duration is off-grid. Summon classification follows
  `independentCast || quicknessCastTimeMs != null`, matching the shared timing helper.
- Effects without an explicit offset may occur at cast completion and inherit an off-grid cast duration; they are not
  separate authored-offset findings.
- Refreshed after the requested Guardian, Mesmer, Revenant, Necromancer, and Thief corrections; resolved entries are
  removed from this list.
- Reassessed on 2026-09-24: entries whose cast times are now on the 40 ms grid (Mesmer, Ranger, and Warrior
  corrections) and skills no longer in the assembled catalogs (Warrior aquatic and aquatic primal bursts) are removed.

## Cast summary

| Profession   | Player casts | Summon base casts | Summon Quickness casts | Unique affected skills |
| ------------ | -----------: | ----------------: | ---------------------: | ---------------------: |
| elementalist |            4 |                 0 |                      0 |                      4 |
| engineer     |            2 |                11 |                      0 |                     13 |
| guardian     |            0 |                 0 |                      0 |                      0 |
| mesmer       |           17 |                 0 |                      0 |                     17 |
| necromancer  |            0 |                 0 |                      0 |                      0 |
| ranger       |           54 |                79 |                     58 |                    133 |
| revenant     |            0 |                 0 |                      0 |                      0 |
| thief        |            0 |                 0 |                      0 |                      0 |
| warrior      |           48 |                 0 |                      0 |                     48 |
| **Total**    |      **125** |            **90** |                 **58** |                **215** |

Summon Quickness counts overlap the summon base counts.

## Damage-offset findings

| Profession  | Skill / profile                                                  | Off-grid offsets (ms)                        | Location                                                                                                                                                                                                                                         |
| ----------- | ---------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Revenant    | Unrelenting Assault (26699)                                      | 260, 405, 550, 695                           | [sword.ts:21](../js/games/gw2/professions/revenant/core/skills/weapons/sword.ts#L21)                                                                                                                                         |
| Necromancer | Sandstorm Shroud - Pulses (necromancer.scourge.sandstorm-shroud) | 3500 for both strike and Torment application | [profiles.ts:157](../js/games/gw2/professions/necromancer/specializations/scourge/profiles.ts#L157) |

Unrelenting Assault generates five strikes at 260, 405, 550, 695, and 840 ms from cast start; only the final packet is
aligned. Its cast duration is aligned at 840 ms. Sandstorm Shroud uses a fixed 3500 ms offset from cast start. No other
strike/condition offsets or intervals in the loaded skills and profiles were off-grid.

## Full cast findings

**Bold values are off-grid.** Aligned explicit Quickness values are shown for context. A dash means no explicit
Quickness value; it does not mean zero. All values are milliseconds.

### Elementalist

[Catalog](../js/games/gw2/professions/elementalist/catalog.ts)

| Skill ID | Skill                     | Timing model | Cast / base ms | Explicit Quickness ms |
| -------- | ------------------------- | ------------ | -------------: | --------------------: |
| -34      | __pickup_Fiery Greatsword | Player       |        **300** |                     - |
| -32      | __pickup_Frost Bow        | Player       |        **300** |                     - |
| -33      | __pickup_Lightning Hammer | Player       |        **300** |                     - |
| 40332    | Pressure Blast            | Player       |        **650** |                     - |

### Engineer

[Catalog](../js/games/gw2/professions/engineer/catalog.ts)

| Skill ID | Skill               | Timing model | Cast / base ms | Explicit Quickness ms |
| -------- | ------------------- | ------------ | -------------: | --------------------: |
| 63141    | Barrier Burst       | Summon       |       **3750** |                     - |
| 63345    | Core Reactor Shot   | Summon       |       **1500** |                  1000 |
| 63365    | Explosive Knuckle   | Summon       |        **500** |                     - |
| 63298    | Hard Strike         | Summon       |        **250** |                   200 |
| 63263    | Heavy Smash (Mech)  | Summon       |        **500** |                   360 |
| 63121    | Jade Mortar         | Summon       |       **1620** |                  1080 |
| 6004     | Net Shot            | Player       |        **570** |                     - |
| 6176     | Regenerating Mist   | Player       |        **300** |                     - |
| 63185    | Rocket Punch (Mech) | Summon       |        **500** |                   360 |
| 63334    | Rolling Smash       | Summon       |        **750** |                     - |
| 63236    | Sky Circus          | Summon       |       **3180** |                  2120 |
| 63188    | Spark Revolver      | Summon       |       **2100** |                  1400 |
| 63288    | Twin Strike (Mech)  | Summon       |        **500** |                   360 |

### Guardian

[Catalog](../js/games/gw2/professions/guardian/catalog.ts)

No remaining off-grid cast findings.

### Mesmer

[Catalog](../js/games/gw2/professions/mesmer/catalog.ts)

| Skill ID | Skill                    | Timing model |    Cast / base ms | Explicit Quickness ms |
| -------- | ------------------------ | ------------ | ----------------: | --------------------: |
| 62568    | Blade Leap               | Player       |           **500** |                     - |
| 41065    | Crystal Sands            | Player       |           **371** |                     - |
| 71800    | Effervescence            | Player       | **166.666666667** |                     - |
| 10176    | Ether Feast              | Player       | **666.666666667** |                     - |
| 71892    | Friendly Fire            | Player       |           **500** |                     - |
| 72005    | Inspiring Imagery        | Player       |           **500** |                     - |
| 71897    | Journey                  | Player       | **333.333333333** |                     - |
| 10213    | Mantra of Recovery       | Player       |          **1500** |                     - |
| 42851    | Mirage Advance           | Player       |           **500** |                     - |
| 45230    | Mirage Thrust            | Player       |           **500** |                     - |
| 10177    | Mirror                   | Player       | **833.333333333** |                     - |
| 72007    | Phantasmal Sharpshooter  | Player       |           **500** |                     - |
| 10282    | Phantasmal Warden        | Player       |           **460** |                     - |
| 72008    | Singularity Shot         | Player       | **333.333333333** |                     - |
| 76971    | Tale of the August Queen | Player       | **666.666666667** |                     - |
| 76695    | Tale of the Second Scion | Player       | **666.666666667** |                     - |
| 10186    | Temporal Curtain         | Player       |           **740** |                     - |

### Necromancer

[Catalog](../js/games/gw2/professions/necromancer/catalog.ts)

No remaining off-grid cast findings. Sandstorm Shroud remains in the damage-offset findings above.

### Ranger

[Catalog](../js/games/gw2/professions/ranger/catalog.ts)

| Skill ID | Skill                   | Timing model | Cast / base ms | Explicit Quickness ms |
| -------- | ----------------------- | ------------ | -------------: | --------------------: |
| 12632    | "Guard!"                | Player       |        **333** |                     - |
| 12631    | "Protect Me!"           | Player       |        **333** |                     - |
| 12516    | "Strength of the Pack!" | Player       |        **667** |                     - |
| 31535    | Ancestral Grace         | Player       |        **833** |                     - |
| 21776    | Aqua Surge              | Player       |        **500** |                     - |
| 31889    | Astral Wisp             | Player       |        **333** |                     - |
| 44948    | Bear Stance             | Player       |        **500** |                     - |
| 42180    | Blinding Roar           | Summon       |       **1500** |                  1000 |
| 12723    | Blinding Slash          | Summon       |      **499.5** |               **333** |
| 66622    | Bloodthirsty Charge     | Summon       |     **1750.5** |              **1167** |
| 12695    | Boil                    | Summon       |      **499.5** |               **333** |
| 12722    | Brash Slash             | Summon       |      **499.5** |               **333** |
| 72044    | Burgeon                 | Player       |        **333** |                     - |
| 12598    | Call Lightning          | Player       |        **333** |                     - |
| 40487    | Call Lightning          | Summon       |        **750** |               **500** |
| 12716    | Chilling Howl           | Summon       |       **1500** |                  1000 |
| 12721    | Chilling Slash          | Summon       |      **499.5** |               **333** |
| 12748    | Chilling Whirl          | Summon       |     **2749.5** |              **1833** |
| 12600    | Cold Snap               | Player       |        **500** |                     - |
| 12508    | Concussion Shot         | Player       |        **167** |                     - |
| 31459    | Consuming Flame         | Summon       |     **2500.5** |              **1667** |
| 31796    | Cosmic Ray              | Player       |        **333** |                     - |
| 12523    | Counterattack Kick      | Player       |        **333** |                     - |
| 41864    | Crippling Anguish       | Summon       |        **900** |                   600 |
| 12507    | Crippling Shot          | Player       |        **333** |                     - |
| 12470    | Crossfire               | Player       |        **333** |                     - |
| 71885    | Cultivate               | Player       |        **500** |                     - |
| 12708    | Dazing Screech          | Summon       |      **499.5** |               **333** |
| 12709    | Dazing Screech          | Summon       |      **499.5** |               **333** |
| 12731    | Deadly Venom            | Summon       |      **499.5** |               **333** |
| 71002    | Dimension Breach        | Summon       |     **1000.5** |               **667** |
| 12699    | Electrocute             | Summon       |      **499.5** |               **333** |
| 12688    | Enfeebling Maul         | Summon       |       **1500** |                  1000 |
| 12685    | Enfeebling Roar         | Summon       |     **1249.5** |               **833** |
| 41156    | Fang Grapple            | Summon       |       **1500** |                  1000 |
| 12757    | Feeding Frenzy          | Summon       |      **499.5** |               **333** |
| 12670    | Fire Breath             | Summon       |       **1500** |                  1000 |
| 12499    | Flame Trap              | Player       |        **333** |                     - |
| 71999    | Flourish                | Player       |        **500** |                     - |
| 12756    | Forage Feathers         | Summon       |     **1000.5** |               **667** |
| 12754    | Forage Rock             | Summon       |     **1000.5** |               **667** |
| 12755    | Forage Scale            | Summon       |     **1000.5** |               **667** |
| 12732    | Forage Sword            | Summon       |     **1000.5** |               **667** |
| 63163    | Forest's Fortification  | Player       |        **667** |                     - |
| 12696    | Frost Breath            | Summon       |       **1500** |                  1000 |
| 12697    | Frost Nova              | Summon       |      **499.5** |               **333** |
| 12497    | Frost Spirit            | Player       |        **167** |                     - |
| 31451    | Furious Pounce          | Summon       |       **1500** |                  1000 |
| 12712    | Furious Screech         | Summon       |     **1000.5** |               **667** |
| 63716    | Gale Breath             | Summon       |     **1000.5** |               **667** |
| 72088    | Germinate               | Player       |        **333** |                     - |
| 31407    | Glyph of Rejuvenation   | Player       |        **333** |                     - |
| 31677    | Glyph of the Stars      | Player       |        **667** |                     - |
| 65109    | Guardian's Roar         | Summon       |      **499.5** |               **333** |
| 43636    | Head Toss               | Summon       |        **750** |               **500** |
| 12489    | Healing Spring          | Player       |        **333** |                     - |
| 75783    | Honey Toss              | Summon       |        **750** |               **500** |
| 12718    | Howl of the Pack        | Summon       |       **1500** |                  1000 |
| 65418    | Hunker Down             | Summon       |      **499.5** |               **333** |
| 12656    | Icy Bite                | Summon       |      **250.5** |               **167** |
| 12689    | Icy Maul                | Summon       |       **1500** |                  1000 |
| 12693    | Icy Pounce              | Summon       |       **1500** |                  1000 |
| 12667    | Icy Roar                | Summon       |     **1249.5** |               **833** |
| 12749    | Immobilizing Whirl      | Summon       |     **2749.5** |              **1833** |
| 79766    | Innocent Display        | Summon       |     **1750.5** |              **1167** |
| 12701    | Insect Swarm            | Summon       |       **1500** |                  1000 |
| 12715    | Intimidating Howl       | Summon       |       **1500** |                  1000 |
| 44980    | Jacaranda's Embrace     | Summon       |       **2220** |                  1480 |
| 20975    | Lacerating Slash        | Summon       |      **499.5** |               **333** |
| 12704    | Lashtail Venom          | Summon       |      **499.5** |               **333** |
| 71688    | Ley Energy Pulse        | Summon       |        **750** |               **500** |
| 31639    | Lightning Assault       | Summon       |      **499.5** |               **333** |
| 12698    | Lightning Breath        | Summon       |       **1500** |                  1000 |
| 12657    | Maul                    | Summon       |       **1260** |                   840 |
| 12658    | Mighty Roar             | Summon       |      **499.5** |               **333** |
| 73110    | Mongoose's Frenzy       | Player       |        **667** |                     - |
| 12501    | Muddy Terrain           | Player       |        **500** |                     - |
| 63130    | Nature's Binding        | Player       |        **500** |                     - |
| 12601    | Nature's Renewal        | Player       |        **500** |                     - |
| 71963    | Oaken Cudgel            | Player       |        **500** |                     - |
| 72913    | Owl's Flight            | Player       |        **500** |                     - |
| 72843    | Panopticon              | Summon       |     **1000.5** |               **667** |
| 12729    | Paralyzing Venom        | Summon       |      **499.5** |               **333** |
| 63319    | Perilous Gift           | Player       |        **500** |                     - |
| 78873    | Piercing Shriek         | Summon       |        **750** |               **500** |
| 12674    | Poison Barbs            | Summon       |     **2500.5** |              **1667** |
| 12687    | Poison Cloud            | Summon       |      **499.5** |               **333** |
| 12700    | Poison Cloud            | Summon       |      **499.5** |               **333** |
| 12702    | Poison Cloud            | Summon       |      **499.5** |               **333** |
| 12468    | Poison Volley           | Player       |        **167** |                     - |
| 12675    | Poisonous Cloud         | Summon       |       **2700** |                  1800 |
| 12690    | Poisonous Maul          | Summon       |       **1500** |                  1000 |
| 43375    | Prelude Lash            | Player       |        **167** |                     - |
| 40588    | Primal Cry              | Player       |        **833** |                     - |
| 12713    | Protecting Screech      | Summon       |     **1000.5** |               **667** |
| 12691    | Purge Conditions        | Summon       |      **499.5** |               **333** |
| 12599    | Quake                   | Player       |        **500** |                     - |
| 12517    | Quick Shot              | Player       |        **167** |                     - |
| 74314    | Rallying Roar           | Summon       |      **499.5** |               **333** |
| 12703    | Regenerate              | Summon       |      **499.5** |               **333** |
| 12717    | Regenerate              | Summon       |      **499.5** |               **333** |
| 12679    | Rending Barbs           | Summon       |     **4000.5** |              **2667** |
| 12664    | Rending Maul            | Summon       |     **1750.5** |              **1167** |
| 12680    | Rending Pounce          | Summon       |       **1500** |                  1000 |
| 42963    | Savannah Strike         | Summon       |        **750** |               **500** |
| 12666    | Shake It Off            | Summon       |      **499.5** |               **333** |
| 31568    | Smoke Cloud             | Summon       |        **750** |               **500** |
| 31710    | Solar Beam              | Player       |        **833** |                     - |
| 12597    | Solar Flare             | Player       |        **500** |                     - |
| 16427    | Sonic Barrier           | Summon       |      **499.5** |               **333** |
| 16426    | Sonic Shriek            | Summon       |       **1500** |                  1000 |
| 77271    | Soothing Breeze         | Player       |        **500** |                     - |
| 72993    | Spider's Web            | Player       |        **333** |                     - |
| 31367    | Spike Barrage           | Summon       |     **1999.5** |              **1333** |
| 12476    | Spike Trap              | Player       |        **333** |                     - |
| 44626    | Spiritual Reprieve      | Player       |        **667** |                     - |
| 12724    | Spit                    | Summon       |     **1249.5** |               **833** |
| 12681    | Stalk                   | Summon       |      **499.5** |               **333** |
| 12495    | Stone Spirit            | Player       |        **167** |                     - |
| 12744    | Stunning Rush           | Summon       |     **2749.5** |              **1833** |
| 31496    | Sublime Conversion      | Player       |        **333** |                     - |
| 12521    | Swoop                   | Player       |        **500** |                     - |
| 12714    | Terrifying Howl         | Summon       |       **1500** |                  1000 |
| 71903    | Thistleguard            | Player       |        **333** |                     - |
| 12483    | Troll Unguent           | Player       |        **500** |                     - |
| 45797    | Unflinching Fortitude   | Player       |        **167** |                     - |
| 31700    | Vine Surge              | Player       |        **500** |                     - |
| 21773    | Water Spirit            | Player       |        **500** |                     - |
| 12730    | Weakening Venom         | Summon       |      **499.5** |               **333** |
| 76619    | Whirlwind               | Player       |        **500** |                     - |
| 71841    | Wild Strikes            | Player       |       **1167** |                     - |
| 77211    | Wind Shear              | Player       |        **333** |                     - |
| 42809    | Worldly Impact          | Player       |        **500** |                     - |

### Revenant

[Catalog](../js/games/gw2/professions/revenant/catalog.ts)

No remaining off-grid cast findings. Unrelenting Assault remains in the damage-offset findings above.

### Thief

[Catalog](../js/games/gw2/professions/thief/catalog.ts)

No remaining off-grid cast findings.

### Warrior

[Catalog](../js/games/gw2/professions/warrior/catalog.ts)

Grouped by the weapon each skill belongs to, then primal bursts, then heal/utility/elite slots. Weapon and slot come
from the assembled catalog entry. Bursts carry no weapon in the API data, so they are attached to a weapon through
[`WARRIOR_REGULAR_BURSTS_BY_WEAPON`](../js/games/gw2/professions/warrior/core/presentation.ts) and the Berserker
`PRIMAL_BURSTS_BY_WEAPON` map, matching by burst name so adrenaline-tier and Spellbreaker variants land with their
weapon. **Module** is the native module that defines the fragment (Core, Berserker, Spellbreaker, Bladesworn,
Paragon), which is not always the specialization that grants the skill.

#### Weapon skills

Each weapon lists its off-grid weapon skills by slot, followed by that weapon's adrenaline burst.

##### Greatsword

| Skill ID | Skill | Slot | Module | Cast ms | Explicit Quickness ms |
| --- | --- | --- | --- | ---: | ---: |
| 42707 | Arcing Slice | Burst (F1) | Spellbreaker | **333** | - |

##### Longbow

| Skill ID | Skill | Slot | Module | Cast ms | Explicit Quickness ms |
| --- | --- | --- | --- | ---: | ---: |
| 42803 | Combustive Shot | Burst (F1) | Spellbreaker | **500** | - |

##### Rifle

| Skill ID | Skill | Slot | Module | Cast ms | Explicit Quickness ms |
| --- | --- | --- | --- | ---: | ---: |
| 34296 | Brutal Shot | 4 | Core | **500** | - |

##### Shield

| Skill ID | Skill | Slot | Module | Cast ms | Explicit Quickness ms |
| --- | --- | --- | --- | ---: | ---: |
| 14361 | Shield Bash | 4 | Core | **500** | - |

##### Spear

| Skill ID | Skill | Slot | Module | Cast ms | Explicit Quickness ms |
| --- | --- | --- | --- | ---: | ---: |
| 73006 | Harrier's Toss | Burst (F1) | Core | **333** | - |
| 73014 | Harrier's Toss | Burst (F1) | Spellbreaker | **333** | - |
| 73024 | Harrier's Toss | Burst (F1) | Core | **333** | - |
| 73042 | Harrier's Toss | Burst (F1) | Core | **333** | - |

##### Staff

| Skill ID | Skill | Slot | Module | Cast ms | Explicit Quickness ms |
| --- | --- | --- | --- | ---: | ---: |
| 72024 | Balanced Strike | 1 | Core | **333** | - |
| 72049 | Inspiring Whirl | 1 | Core | **500** | - |
| 72001 | Reverse Strike | 1 | Core | **333** | - |
| 72002 | Valiant Leap | 2 | Core | **500** | - |
| 71860 | Line Breaker | 3 | Core | **1167** | - |
| 72026 | Snap Pull | 4 | Core | **500** | - |
| 71889 | Defiant Roar | 5 | Core | **333** | - |
| 71922 | Path to Victory | Burst (F1) | Core | **333** | - |
| 71932 | Path to Victory | Burst (F1) | Core | **333** | - |
| 71950 | Path to Victory | Burst (F1) | Core | **333** | - |
| 72089 | Path to Victory | Burst (F1) | Spellbreaker | **333** | - |

##### Sword

| Skill ID | Skill | Slot | Module | Cast ms | Explicit Quickness ms |
| --- | --- | --- | --- | ---: | ---: |
| 14498 | Impale | 4 | Core | **333** | - |
| 14501 | Rip | 4 | Core | **500** | - |
| 14557 | Adrenaline Rush | 5 | Core | **333** | - |
| 14400 | Riposte | 5 | Core | **1500** | - |
| 80203 | Bloodthirster | Burst (F1) | Core | **500** | - |

##### Warhorn

| Skill ID | Skill | Slot | Module | Cast ms | Explicit Quickness ms |
| --- | --- | --- | --- | ---: | ---: |
| 14393 | Charge | 4 | Core | **333** | - |
| 14394 | Call of Valor | 5 | Core | **333** | - |

#### Primal bursts (Berserker)

| Skill ID | Skill | Weapon | Cast ms | Explicit Quickness ms |
| --- | --- | --- | ---: | ---: |
| 69290 | Slicing Maelstrom | Dagger | **500** | - |
| 29679 | Skull Grinder | Mace | **333** | - |
| 29644 | Gun Flame | Rifle | **500** | - |
| 71875 | Rampart Splitter | Staff | **333** | - |

#### Heal, utility, and elite skills

| Skill ID | Skill | Slot | Category | Module | Cast ms | Explicit Quickness ms |
| --- | --- | --- | --- | --- | ---: | ---: |
| 76755 | "We Shall Return!" | Heal | Command | Paragon | **667** | - |
| 62978 | Combat Stimulant | Heal | - | Bladesworn | **500** | - |
| 41100 | Natural Healing | Heal | Meditation | Spellbreaker | **667** | - |
| 77040 | "Find Their Weakness!" | Utility | Command | Paragon | **333** | - |
| 77114 | "On Your Knees!" | Utility | Command | Paragon | **167** | - |
| 14407 | Banner of Discipline | Utility | Banner | Core | **500** | - |
| 14405 | Banner of Strength | Utility | Banner | Core | **500** | - |
| 43123 | Break Enchantments | Utility | Meditation | Spellbreaker | **167** | - |
| 14502 | Kick | Utility | Physical | Core | **842** | - |
| 14404 | Signet of Might | Utility | Signet | Core | **333** | - |
| 14388 | Stomp | Utility | Physical | Core | **500** | - |
| 14354 | Throw Bolas | Utility | Physical | Core | **333** | - |
| 76562 | "We Will Never Yield!" | Elite | Command | Paragon | **667** | - |
| 14419 | Battle Standard | Elite | Banner | Core | **1333** | - |
| 14483 | Rampage | Elite | Physical | Core | **667** | - |

#### Profession mechanic skills

| Skill ID | Skill | Slot | Module | Cast ms | Explicit Quickness ms |
| --- | --- | --- | --- | ---: | ---: |
| 77342 | Chant of Action | Profession_2 | Paragon | **167** | - |
| 76782 | Chant of Recuperation | Profession_3 | Paragon | **167** | - |
| 77155 | Chant of Freedom | Profession_4 | Paragon | **167** | - |
