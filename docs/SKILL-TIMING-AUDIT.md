# Skill timing audit: 40 ms boundaries

Rechecked existing findings against the assembled catalogs on 2026-10-04. Covers authored cast durations and
strike/condition offsets and intervals, including balance profiles; excludes procedural runtime timing.

All values are milliseconds. **Bold values are off the 40 ms grid** (tolerance: 0.000001 ms). A dash means no explicit
Quickness duration. Summon timing uses `independentCast || quicknessCastTimeMs != null`.

## Damage offsets

| Profession  | Skill / profile                                                  | Off-grid offsets (ms)                       | Source                                                                                     |
| ----------- | ---------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Necromancer | Sandstorm Shroud - Pulses (necromancer.scourge.sandstorm-shroud) | 3500 from cast start for strike and Torment | [profiles.ts](../js/games/gw2/professions/necromancer/specializations/scourge/profiles.ts) |
| Revenant    | Unrelenting Assault (26699)                                      | 260, 405, 550, 695 from cast start          | [sword.ts](../js/games/gw2/professions/revenant/core/skills/weapons/sword.ts)              |

## Cast durations

### Elementalist

[Catalog](../js/games/gw2/professions/elementalist/catalog.ts)

| Skill ID | Skill                        | Timing model | Cast / base ms | Explicit Quickness ms |
| -------- | ---------------------------- | ------------ | -------------: | --------------------: |
| -34      | \_\_pickup\_Fiery Greatsword | Player       |        **300** |                     - |
| -32      | \_\_pickup\_Frost Bow        | Player       |        **300** |                     - |
| -33      | \_\_pickup\_Lightning Hammer | Player       |        **300** |                     - |
| 40332    | Pressure Blast               | Player       |        **650** |                     - |

### Engineer

[Catalog](../js/games/gw2/professions/engineer/catalog.ts)

| Skill ID | Skill               | Timing model | Cast / base ms | Explicit Quickness ms |
| -------- | ------------------- | ------------ | -------------: | --------------------: |
| 6004     | Net Shot            | Player       |        **570** |                     - |
| 6176     | Regenerating Mist   | Player       |        **300** |                     - |
| 63141    | Barrier Burst       | Summon       |       **3750** |                     - |
| 63345    | Core Reactor Shot   | Summon       |       **1500** |                  1000 |
| 63365    | Explosive Knuckle   | Summon       |        **500** |                     - |
| 63298    | Hard Strike         | Summon       |        **250** |                   200 |
| 63263    | Heavy Smash (Mech)  | Summon       |        **500** |                   360 |
| 63121    | Jade Mortar         | Summon       |       **1620** |                  1080 |
| 63185    | Rocket Punch (Mech) | Summon       |        **500** |                   360 |
| 63334    | Rolling Smash       | Summon       |        **750** |                     - |
| 63236    | Sky Circus          | Summon       |       **3180** |                  2120 |
| 63188    | Spark Revolver      | Summon       |       **2100** |                  1400 |
| 63288    | Twin Strike (Mech)  | Summon       |        **500** |                   360 |

### Mesmer

[Catalog](../js/games/gw2/professions/mesmer/catalog.ts)

| Skill ID | Skill                    | Timing model |    Cast / base ms | Explicit Quickness ms |
| -------- | ------------------------ | ------------ | ----------------: | --------------------: |
| 62568    | Blade Leap               | Player       |           **500** |                     - |
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

### Ranger

[Catalog](../js/games/gw2/professions/ranger/catalog.ts)

| Skill ID | Skill                 | Timing model | Cast / base ms | Explicit Quickness ms |
| -------- | --------------------- | ------------ | -------------: | --------------------: |
| 12632    | "Guard!"              | Player       |        **333** |                     - |
| 12631    | "Protect Me!"         | Player       |        **333** |                     - |
| 31535    | Ancestral Grace       | Player       |        **833** |                     - |
| 21776    | Aqua Surge            | Player       |        **500** |                     - |
| 31889    | Astral Wisp           | Player       |        **333** |                     - |
| 44948    | Bear Stance           | Player       |        **500** |                     - |
| 72044    | Burgeon               | Player       |        **333** |                     - |
| 12598    | Call Lightning        | Player       |        **333** |                     - |
| 12600    | Cold Snap             | Player       |        **500** |                     - |
| 12508    | Concussion Shot       | Player       |        **167** |                     - |
| 31796    | Cosmic Ray            | Player       |        **333** |                     - |
| 12523    | Counterattack Kick    | Player       |        **333** |                     - |
| 12507    | Crippling Shot        | Player       |        **333** |                     - |
| 12470    | Crossfire             | Player       |        **333** |                     - |
| 71885    | Cultivate             | Player       |        **500** |                     - |
| 12499    | Flame Trap            | Player       |        **333** |                     - |
| 71999    | Flourish              | Player       |        **500** |                     - |
| 12497    | Frost Spirit          | Player       |        **167** |                     - |
| 72088    | Germinate             | Player       |        **333** |                     - |
| 31407    | Glyph of Rejuvenation | Player       |        **333** |                     - |
| 31677    | Glyph of the Stars    | Player       |        **667** |                     - |
| 12489    | Healing Spring        | Player       |        **333** |                     - |
| 73110    | Mongoose's Frenzy     | Player       |        **667** |                     - |
| 12501    | Muddy Terrain         | Player       |        **500** |                     - |
| 63130    | Nature's Binding      | Player       |        **500** |                     - |
| 12601    | Nature's Renewal      | Player       |        **500** |                     - |
| 71963    | Oaken Cudgel          | Player       |        **500** |                     - |
| 72913    | Owl's Flight          | Player       |        **500** |                     - |
| 63319    | Perilous Gift         | Player       |        **500** |                     - |
| 12468    | Poison Volley         | Player       |        **167** |                     - |
| 43375    | Prelude Lash          | Player       |        **167** |                     - |
| 12599    | Quake                 | Player       |        **500** |                     - |
| 12517    | Quick Shot            | Player       |        **167** |                     - |
| 31710    | Solar Beam            | Player       |        **833** |                     - |
| 12597    | Solar Flare           | Player       |        **500** |                     - |
| 77271    | Soothing Breeze       | Player       |        **500** |                     - |
| 72993    | Spider's Web          | Player       |        **333** |                     - |
| 12476    | Spike Trap            | Player       |        **333** |                     - |
| 44626    | Spiritual Reprieve    | Player       |        **667** |                     - |
| 12495    | Stone Spirit          | Player       |        **167** |                     - |
| 31496    | Sublime Conversion    | Player       |        **333** |                     - |
| 12521    | Swoop                 | Player       |        **500** |                     - |
| 71903    | Thistleguard          | Player       |        **333** |                     - |
| 12483    | Troll Unguent         | Player       |        **500** |                     - |
| 45797    | Unflinching Fortitude | Player       |        **167** |                     - |
| 31700    | Vine Surge            | Player       |        **500** |                     - |
| 21773    | Water Spirit          | Player       |        **500** |                     - |
| 76619    | Whirlwind             | Player       |        **500** |                     - |
| 71841    | Wild Strikes          | Player       |       **1167** |                     - |
| 77211    | Wind Shear            | Player       |        **333** |                     - |
| 42180    | Blinding Roar         | Summon       |       **1500** |                  1000 |
| 12723    | Blinding Slash        | Summon       |      **499.5** |               **333** |
| 12695    | Boil                  | Summon       |      **499.5** |               **333** |
| 12722    | Brash Slash           | Summon       |      **499.5** |               **333** |
| 40487    | Call Lightning        | Summon       |        **750** |               **500** |
| 12716    | Chilling Howl         | Summon       |       **1500** |                  1000 |
| 12721    | Chilling Slash        | Summon       |      **499.5** |               **333** |
| 12748    | Chilling Whirl        | Summon       |     **2749.5** |              **1833** |
| 31459    | Consuming Flame       | Summon       |     **2500.5** |              **1667** |
| 41864    | Crippling Anguish     | Summon       |        **900** |                   600 |
| 12708    | Dazing Screech        | Summon       |      **499.5** |               **333** |
| 12709    | Dazing Screech        | Summon       |      **499.5** |               **333** |
| 12731    | Deadly Venom          | Summon       |      **499.5** |               **333** |
| 71002    | Dimension Breach      | Summon       |     **1000.5** |               **667** |
| 12699    | Electrocute           | Summon       |      **499.5** |               **333** |
| 12688    | Enfeebling Maul       | Summon       |       **1500** |                  1000 |
| 12685    | Enfeebling Roar       | Summon       |     **1249.5** |               **833** |
| 41156    | Fang Grapple          | Summon       |       **1500** |                  1000 |
| 12757    | Feeding Frenzy        | Summon       |      **499.5** |               **333** |
| 12670    | Fire Breath           | Summon       |       **1500** |                  1000 |
| 12756    | Forage Feathers       | Summon       |     **1000.5** |               **667** |
| 12754    | Forage Rock           | Summon       |     **1000.5** |               **667** |
| 12755    | Forage Scale          | Summon       |     **1000.5** |               **667** |
| 12732    | Forage Sword          | Summon       |     **1000.5** |               **667** |
| 12696    | Frost Breath          | Summon       |       **1500** |                  1000 |
| 12697    | Frost Nova            | Summon       |      **499.5** |               **333** |
| 12712    | Furious Screech       | Summon       |     **1000.5** |               **667** |
| 63716    | Gale Breath           | Summon       |     **1000.5** |               **667** |
| 65109    | Guardian's Roar       | Summon       |      **499.5** |               **333** |
| 43636    | Head Toss             | Summon       |        **750** |               **500** |
| 75783    | Honey Toss            | Summon       |        **750** |               **500** |
| 12718    | Howl of the Pack      | Summon       |       **1500** |                  1000 |
| 65418    | Hunker Down           | Summon       |      **499.5** |               **333** |
| 12656    | Icy Bite              | Summon       |      **250.5** |               **167** |
| 12689    | Icy Maul              | Summon       |       **1500** |                  1000 |
| 12693    | Icy Pounce            | Summon       |       **1500** |                  1000 |
| 12667    | Icy Roar              | Summon       |     **1249.5** |               **833** |
| 12749    | Immobilizing Whirl    | Summon       |     **2749.5** |              **1833** |
| 79766    | Innocent Display      | Summon       |     **1750.5** |              **1167** |
| 12701    | Insect Swarm          | Summon       |       **1500** |                  1000 |
| 12715    | Intimidating Howl     | Summon       |       **1500** |                  1000 |
| 44980    | Jacaranda's Embrace   | Summon       |       **2220** |                  1480 |
| 12704    | Lashtail Venom        | Summon       |      **499.5** |               **333** |
| 71688    | Ley Energy Pulse      | Summon       |        **750** |               **500** |
| 31639    | Lightning Assault     | Summon       |      **499.5** |               **333** |
| 12698    | Lightning Breath      | Summon       |       **1500** |                  1000 |
| 12658    | Mighty Roar           | Summon       |      **499.5** |               **333** |
| 72843    | Panopticon            | Summon       |     **1000.5** |               **667** |
| 12729    | Paralyzing Venom      | Summon       |      **499.5** |               **333** |
| 78873    | Piercing Shriek       | Summon       |        **750** |               **500** |
| 12674    | Poison Barbs          | Summon       |     **2500.5** |              **1667** |
| 12687    | Poison Cloud          | Summon       |      **499.5** |               **333** |
| 12700    | Poison Cloud          | Summon       |      **499.5** |               **333** |
| 12702    | Poison Cloud          | Summon       |      **499.5** |               **333** |
| 12675    | Poisonous Cloud       | Summon       |       **2700** |                  1800 |
| 12690    | Poisonous Maul        | Summon       |       **1500** |                  1000 |
| 12713    | Protecting Screech    | Summon       |     **1000.5** |               **667** |
| 12691    | Purge Conditions      | Summon       |      **499.5** |               **333** |
| 74314    | Rallying Roar         | Summon       |      **499.5** |               **333** |
| 12703    | Regenerate            | Summon       |      **499.5** |               **333** |
| 12717    | Regenerate            | Summon       |      **499.5** |               **333** |
| 12679    | Rending Barbs         | Summon       |     **4000.5** |              **2667** |
| 12664    | Rending Maul          | Summon       |     **1750.5** |              **1167** |
| 12680    | Rending Pounce        | Summon       |       **1500** |                  1000 |
| 42963    | Savannah Strike       | Summon       |        **750** |               **500** |
| 12666    | Shake It Off          | Summon       |      **499.5** |               **333** |
| 31568    | Smoke Cloud           | Summon       |        **750** |               **500** |
| 16427    | Sonic Barrier         | Summon       |      **499.5** |               **333** |
| 16426    | Sonic Shriek          | Summon       |       **1500** |                  1000 |
| 31367    | Spike Barrage         | Summon       |     **1999.5** |              **1333** |
| 12724    | Spit                  | Summon       |     **1249.5** |               **833** |
| 12681    | Stalk                 | Summon       |      **499.5** |               **333** |
| 12744    | Stunning Rush         | Summon       |     **2749.5** |              **1833** |
| 12714    | Terrifying Howl       | Summon       |       **1500** |                  1000 |
| 12730    | Weakening Venom       | Summon       |      **499.5** |               **333** |

### Warrior

[Catalog](../js/games/gw2/professions/warrior/catalog.ts)

| Skill ID | Skill                  | Timing model | Cast / base ms | Explicit Quickness ms |
| -------- | ---------------------- | ------------ | -------------: | --------------------: |
| 77040    | "Find Their Weakness!" | Player       |        **333** |                     - |
| 77114    | "On Your Knees!"       | Player       |        **167** |                     - |
| 76755    | "We Shall Return!"     | Player       |        **667** |                     - |
| 76562    | "We Will Never Yield!" | Player       |        **667** |                     - |
| 14557    | Adrenaline Rush        | Player       |        **333** |                     - |
| 42707    | Arcing Slice           | Player       |        **333** |                     - |
| 72024    | Balanced Strike        | Player       |        **333** |                     - |
| 14407    | Banner of Discipline   | Player       |        **500** |                     - |
| 14405    | Banner of Strength     | Player       |        **500** |                     - |
| 14419    | Battle Standard        | Player       |       **1333** |                     - |
| 80203    | Bloodthirster          | Player       |        **500** |                     - |
| 43123    | Break Enchantments     | Player       |        **167** |                     - |
| 34296    | Brutal Shot            | Player       |        **500** |                     - |
| 14394    | Call of Valor          | Player       |        **333** |                     - |
| 77342    | Chant of Action        | Player       |        **167** |                     - |
| 77155    | Chant of Freedom       | Player       |        **167** |                     - |
| 76782    | Chant of Recuperation  | Player       |        **167** |                     - |
| 14393    | Charge                 | Player       |        **333** |                     - |
| 62978    | Combat Stimulant       | Player       |        **500** |                     - |
| 42803    | Combustive Shot        | Player       |        **500** |                     - |
| 71889    | Defiant Roar           | Player       |        **333** |                     - |
| 29644    | Gun Flame              | Player       |        **500** |                     - |
| 73006    | Harrier's Toss         | Player       |        **333** |                     - |
| 73014    | Harrier's Toss         | Player       |        **333** |                     - |
| 73024    | Harrier's Toss         | Player       |        **333** |                     - |
| 73042    | Harrier's Toss         | Player       |        **333** |                     - |
| 14498    | Impale                 | Player       |        **333** |                     - |
| 72049    | Inspiring Whirl        | Player       |        **500** |                     - |
| 14502    | Kick                   | Player       |        **842** |                     - |
| 71860    | Line Breaker           | Player       |       **1167** |                     - |
| 41100    | Natural Healing        | Player       |        **667** |                     - |
| 71922    | Path to Victory        | Player       |        **333** |                     - |
| 71932    | Path to Victory        | Player       |        **333** |                     - |
| 71950    | Path to Victory        | Player       |        **333** |                     - |
| 72089    | Path to Victory        | Player       |        **333** |                     - |
| 14483    | Rampage                | Player       |        **667** |                     - |
| 71875    | Rampart Splitter       | Player       |        **333** |                     - |
| 72001    | Reverse Strike         | Player       |        **333** |                     - |
| 14501    | Rip                    | Player       |        **500** |                     - |
| 14400    | Riposte                | Player       |       **1500** |                     - |
| 14361    | Shield Bash            | Player       |        **500** |                     - |
| 29679    | Skull Grinder          | Player       |        **333** |                     - |
| 69290    | Slicing Maelstrom      | Player       |        **500** |                     - |
| 72026    | Snap Pull              | Player       |        **500** |                     - |
| 14388    | Stomp                  | Player       |        **500** |                     - |
| 72002    | Valiant Leap           | Player       |        **500** |                     - |
