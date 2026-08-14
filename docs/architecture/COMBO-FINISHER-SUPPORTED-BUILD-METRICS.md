# Combo finisher supported-build metrics

Captured on 2026-08-14 from all rotation-backed manifest presets. Baseline: `b3f3ec19`; current: combo-finisher implementation worktree. Values are deterministic simulator results from `capture-supported-build-metrics.mjs`.

## Summary

- Supported builds: 94
- Unchanged builds: 74
- Changed builds: 20
- Non-Reaper builds with lower DPS or total damage: 0
- Condition Reaper exceptions: 2

The two condition Reaper losses are caused by overlapping Dark and Ice fields with no authoritative field ownership in the legacy rotation data. The shared resolver deliberately leaves those finishers unresolved instead of applying both field outcomes. Power Reaper remains unchanged.

A negative strike- or condition-component delta can appear on a build whose total damage increased because combo outcomes change target-death timing and the split between damage sources. The acceptance check is based on DPS and total damage; both are nonnegative for every non-Reaper build.

## Sequential migration checkpoints

### Guardian centralized-authoring migration

Guardian was recaptured after its legacy combo observer, legacy field aliases, Blast handler, and the shared Blast compatibility stage were removed. Five of the 6 rotation-backed Guardian builds are unchanged from the pre-migration combo-finisher worktree. Condition Willbender gains one previously missed combo application: DPS increases by 57.018, total and condition damage increase by 7,044.253, and duration, strike damage, and warning count are unchanged. Its manifest DPS was updated from 42,343 to 42,400.

### Ranger centralized-authoring migration

Ranger was recaptured after its legacy combo observer and all legacy field and finisher aliases were removed. All 6 rotation-backed Ranger builds are unchanged from the pre-migration combo-finisher worktree: duration, DPS, total damage, strike damage, condition damage, and warning count have zero delta at the precision shown in the Ranger table below. Canonical projectile random-stream IDs now use activation, effect, and hit identity instead of global event insertion order; the seeded stochastic combo assertion was updated from 1 to 3 successes, while deterministic supported-build damage remains unchanged.

### Elementalist centralized-authoring migration

Elementalist was recaptured after its legacy combo observer and all legacy field and finisher aliases were removed. All 37 rotation-backed Elementalist builds are unchanged from the pre-migration combo-finisher worktree: duration, DPS, total damage, strike damage, condition damage, and warning count have zero delta at the precision shown in the Elementalist table below. Runtime Frigid Flurry projectile packets use their stable activation-local packet index so the centralized resolver preserves each independent 20% finisher attempt.

### Mesmer centralized-authoring migration

Mesmer was recaptured after its legacy combo observer and all legacy field and finisher aliases were removed. All 5 rotation-backed Mesmer builds are unchanged from the pre-migration combo-finisher worktree: duration, DPS, total damage, strike damage, condition damage, and warning count have zero delta at the precision shown in the Mesmer table below.

### Revenant centralized-authoring migration

Revenant was recaptured after its legacy combo observer and all legacy field and finisher aliases were removed. All 7 rotation-backed Revenant builds are unchanged from the pre-migration combo-finisher worktree: duration, DPS, total damage, strike damage, condition damage, and warning count have zero delta at the precision shown in the Revenant table below.

### Thief centralized-authoring migration

Thief was recaptured after its legacy combo observer and all legacy finisher aliases were removed. All 8 rotation-backed Thief builds are unchanged from the pre-migration combo-finisher worktree: duration, DPS, total damage, strike damage, condition damage, and warning count have zero delta at the precision shown in the Thief table below.

### Warrior centralized-authoring migration

Warrior was recaptured after its legacy combo observer and all legacy field and finisher aliases were removed. All 8 rotation-backed Warrior builds are unchanged from the pre-migration combo-finisher worktree: duration, DPS, total damage, strike damage, condition damage, and warning count have zero delta at the precision shown in the Warrior table below.

### Engineer centralized-authoring migration

Engineer was recaptured after its legacy combo observer, resolver binding adapter, and all legacy field and finisher aliases were removed. All 8 rotation-backed Engineer builds are unchanged from the pre-migration combo-finisher worktree: duration, DPS, total damage, strike damage, condition damage, and warning count have zero delta at the precision shown in the Engineer table below. Resolver-authored Orbital Command Strike and Refraction Cutter packets now enter the same shared owned-finisher path as scheduler-authored skills.

### Necromancer centralized-authoring migration

Necromancer was recaptured after its legacy combo observer, summon binding adapter, and all legacy finisher aliases were removed. All 7 rotation-backed Necromancer builds are unchanged from the pre-migration combo-finisher worktree: duration, DPS, total damage, strike damage, condition damage, and warning count have zero delta at the precision shown in the Necromancer table below. This preserves the 1- and 6-warning outcomes for the two condition Reaper builds; their Dark/Ice ambiguity and damage deltas remain exactly as documented in the complete table.

## Warning changes

The current runs contain 12 warnings across 7 builds. Five Elementalist warnings were already present in the baseline. The 7 added warnings are the explicit Reaper ambiguity diagnostics:

- Reaper — Condition (Dagger / Sword + Spear): Combo field binding is unspecified for Soul Spiral at 6.680s; no combo resolved.
- Reaper — Condition (Fields - Pistol / Torch + Greatsword): Combo field binding is unspecified for Gravedigger at 4.040s; no combo resolved.
- Reaper — Condition (Fields - Pistol / Torch + Greatsword): Combo field binding is unspecified for Death Spiral at 5.000s; no combo resolved.
- Reaper — Condition (Fields - Pistol / Torch + Greatsword): Combo field binding is unspecified for Weeping Shots at 5.240s; no combo resolved.
- Reaper — Condition (Fields - Pistol / Torch + Greatsword): Combo field binding is unspecified for Rigor Mortis — Bone Shard at 3.920s; no combo resolved.
- Reaper — Condition (Fields - Pistol / Torch + Greatsword): Combo field binding is unspecified for Bone Shard at 5.320s; no combo resolved.
- Reaper — Condition (Fields - Pistol / Torch + Greatsword): Combo field binding is unspecified for Bone Shard — Crippling Volley at 26.880s; no combo resolved.

## Complete metric table

Each cell is `baseline → current (delta)`. Duration is seconds; all damage values are simulator damage units.

### Elementalist

| Build                                     | Manifest DPS |                   Duration |                                DPS |                                Total damage |                               Strike damage |                            Condition damage | Warnings |
| ----------------------------------------- | -----------: | -------------------------: | ---------------------------------: | ------------------------------------------: | ------------------------------------------: | ------------------------------------------: | -------: |
| Weaver — Power (Sword)                    |       40,782 | 102.922 → 102.922 (+0.000) |   42,581.119 → 42,581.119 (+0.000) |      3,987,381.130 → 3,987,381.130 (+0.000) |      3,708,352.955 → 3,708,352.955 (+0.000) |          279,028.175 → 279,028.175 (+0.000) |        1 |
| Weaver — Power (Spear)                    |       41,118 | 100.608 → 100.608 (+0.000) |   40,898.939 → 40,898.939 (+0.000) |      3,973,863.594 → 3,973,863.594 (+0.000) |      3,827,035.613 → 3,827,035.613 (+0.000) |          146,827.981 → 146,827.981 (+0.000) |        0 |
| Weaver — Condi (P/Wh)                     |       42,706 | 102.828 → 102.828 (+0.000) |   41,800.882 → 41,800.882 (+0.000) |      3,971,418.160 → 3,971,418.160 (+0.000) |          400,270.294 → 400,270.294 (+0.000) |      3,571,147.866 → 3,571,147.866 (+0.000) |        0 |
| Weaver — Condi (P/D)                      |       43,829 |   97.987 → 97.987 (+0.000) |   42,279.041 → 42,279.041 (+0.000) |      3,833,313.795 → 3,833,313.795 (+0.000) |          529,302.097 → 529,302.097 (+0.000) |      3,304,011.698 → 3,304,011.698 (+0.000) |        1 |
| Weaver — Condi (Scepter)                  |       43,155 | 103.812 → 103.812 (+0.000) |   41,886.937 → 41,886.937 (+0.000) |      3,970,630.314 → 3,970,630.314 (+0.000) |          786,996.131 → 786,996.131 (+0.000) |      3,183,634.184 → 3,183,634.184 (+0.000) |        0 |
| Tempest — Celestial Alacrity Tempest      |       21,250 |   47.757 → 47.757 (+0.000) |   21,181.879 → 21,181.879 (+0.000) |          984,470.208 → 984,470.208 (+0.000) |          448,959.780 → 448,959.780 (+0.000) |          535,510.428 → 535,510.428 (+0.000) |        0 |
| Tempest — Power (Sword)                   |       41,502 |   99.325 → 99.325 (+0.000) |   41,914.407 → 41,914.407 (+0.000) |      3,998,844.032 → 3,998,844.032 (+0.000) |      3,812,543.607 → 3,812,543.607 (+0.000) |          186,300.425 → 186,300.425 (+0.000) |        0 |
| Tempest — Power (Scepter)                 |       41,321 | 109.545 → 109.545 (+0.000) |   39,253.277 → 39,253.277 (+0.000) |      3,951,431.105 → 3,951,431.105 (+0.000) |      3,736,822.880 → 3,736,822.880 (+0.000) |          214,608.226 → 214,608.226 (+0.000) |        0 |
| Tempest — Power (Spear)                   |       41,514 |   99.712 → 99.712 (+0.000) |   41,283.988 → 41,283.988 (+0.000) |      3,971,354.484 → 3,971,354.484 (+0.000) |      3,863,103.059 → 3,863,103.059 (+0.000) |          108,251.425 → 108,251.425 (+0.000) |        0 |
| Tempest — Power (Hammer)                  |       40,791 | 110.600 → 110.600 (+0.000) |   39,909.545 → 39,909.545 (+0.000) |      3,971,797.901 → 3,971,797.901 (+0.000) |      3,754,417.139 → 3,754,417.139 (+0.000) |          217,380.762 → 217,380.762 (+0.000) |        0 |
| Tempest — Power Alacrity (Sword)          |       32,500 | 123.472 → 123.472 (+0.000) |   32,678.216 → 32,678.216 (+0.000) |      3,972,396.646 → 3,972,396.646 (+0.000) |      3,746,940.674 → 3,746,940.674 (+0.000) |          225,455.972 → 225,455.972 (+0.000) |        0 |
| Tempest — Power Alacrity (Hammer)         |            — | 132.391 → 132.391 (+0.000) |   28,775.240 → 28,775.240 (+0.000) |      3,637,506.894 → 3,637,506.894 (+0.000) |      3,463,120.614 → 3,463,120.614 (+0.000) |          174,386.280 → 174,386.280 (+0.000) |        0 |
| Tempest — Condi (P/Wh)                    |       41,703 | 104.337 → 104.337 (+0.000) |   42,012.186 → 42,012.186 (+0.000) |      3,963,303.546 → 3,963,303.546 (+0.000) |          694,013.869 → 694,013.869 (+0.000) |      3,269,289.677 → 3,269,289.677 (+0.000) |        0 |
| Tempest — Condi (Scepter)                 |            — |   99.141 → 99.141 (+0.000) |   41,580.176 → 41,580.176 (+0.000) |      3,975,937.969 → 3,975,937.969 (+0.000) |          860,407.556 → 860,407.556 (+0.000) |      3,115,530.413 → 3,115,530.413 (+0.000) |        0 |
| Tempest — Condi Alacrity (P/Wh)           |       32,396 | 123.105 → 123.105 (+0.000) |   32,646.700 → 32,646.700 (+0.000) |      3,928,867.131 → 3,928,867.131 (+0.000) |          806,577.129 → 806,577.129 (+0.000) |      3,122,290.001 → 3,122,290.001 (+0.000) |        0 |
| Tempest — Condi Alacrity (Scepter)        |            — |   93.120 → 93.120 (+0.000) |   35,309.401 → 35,309.401 (+0.000) |      3,242,815.430 → 3,242,815.430 (+0.000) |          603,129.264 → 603,129.264 (+0.000) |      2,639,686.166 → 2,639,686.166 (+0.000) |        0 |
| Tempest — Inferno                         |       40,920 | 106.660 → 106.660 (+0.000) |   40,960.472 → 40,960.472 (+0.000) |      3,973,984.960 → 3,973,984.960 (+0.000) |      2,638,490.906 → 2,638,490.906 (+0.000) |      1,335,494.054 → 1,335,494.054 (+0.000) |        0 |
| Tempest — Inferno Alacrity                |            — | 126.840 → 126.840 (+0.000) |   33,980.136 → 33,980.136 (+0.000) |      3,971,598.239 → 3,971,598.239 (+0.000) |      1,806,093.607 → 1,806,093.607 (+0.000) |      2,165,504.631 → 2,165,504.631 (+0.000) |        0 |
| Catalyst — Power (Sword BttH)             |       40,189 | 101.652 → 101.652 (+0.000) | 40,787.886 → 41,361.679 (+573.793) | 3,971,598.056 → 3,992,725.619 (+21,127.563) | 3,805,260.587 → 3,827,414.722 (+22,154.135) |      166,337.469 → 165,310.897 (-1,026.572) |        0 |
| Catalyst — Power (Sword FA)               |       39,927 | 103.399 → 103.399 (+0.000) | 38,921.910 → 39,219.749 (+297.839) | 3,971,591.722 → 3,987,785.677 (+16,193.955) | 3,806,712.770 → 3,823,792.499 (+17,079.729) |        164,878.951 → 163,993.178 (-885.773) |        0 |
| Catalyst — Power (Scepter BttH)           |       42,006 | 102.162 → 102.162 (+0.000) | 41,367.550 → 41,821.691 (+454.141) | 3,923,381.156 → 3,966,452.833 (+43,071.678) | 3,600,748.505 → 3,643,357.840 (+42,609.335) |        322,632.650 → 323,094.993 (+462.343) |        1 |
| Catalyst — Power (Spear)                  |       41,454 |   95.824 → 95.824 (+0.000) | 41,824.013 → 42,015.591 (+191.579) | 3,960,901.314 → 3,975,683.321 (+14,782.007) | 3,893,914.977 → 3,909,106.986 (+15,192.009) |          66,986.337 → 66,576.335 (-410.002) |        0 |
| Catalyst — Power Quickness (Sword FA)     |       33,825 | 121.495 → 121.495 (+0.000) |  32,873.764 → 32,964.593 (+90.829) |  3,965,069.025 → 3,970,750.075 (+5,681.049) |  3,778,227.009 → 3,784,523.887 (+6,296.878) |        186,842.016 → 186,226.188 (-615.828) |        0 |
| Catalyst — Power Quickness (Scepter BttH) |       35,068 | 124.118 → 124.118 (+0.000) |  34,066.688 → 34,126.322 (+59.634) |  3,938,041.034 → 3,944,934.604 (+6,893.570) |  3,576,808.285 → 3,583,376.855 (+6,568.570) |        361,232.749 → 361,557.749 (+325.000) |        0 |
| Catalyst — Condi (P/D)                    |       38,625 | 118.268 → 118.268 (+0.000) | 37,222.916 → 37,595.516 (+372.600) | 3,902,003.788 → 3,941,062.734 (+39,058.946) |      758,059.545 → 766,180.591 (+8,121.046) | 3,143,944.243 → 3,174,882.143 (+30,937.900) |        0 |
| Catalyst — Condi Quickness (P/Wh)         |            — | 119.034 → 119.034 (+0.000) |   35,566.403 → 35,568.670 (+2.267) |    3,909,245.610 → 3,909,494.818 (+249.208) |         664,002.257 → 664,096.302 (+94.045) |    3,245,243.353 → 3,245,398.516 (+155.163) |        0 |
| Catalyst — Condi Quickness (P/D)          |       33,356 | 132.307 → 132.307 (+0.000) |   32,239.429 → 32,246.252 (+6.823) |    3,886,366.461 → 3,887,188.964 (+822.503) |        763,750.960 → 763,992.498 (+241.538) |    3,122,615.502 → 3,123,196.466 (+580.965) |        0 |
| Catalyst — Inferno                        |            — |   94.884 → 94.884 (+0.000) | 39,963.346 → 40,339.788 (+376.442) | 3,502,547.527 → 3,535,540.376 (+32,992.848) | 2,633,744.477 → 2,663,900.041 (+30,155.564) |      868,803.050 → 871,640.334 (+2,837.284) |        0 |
| Catalyst — Inferno Quickness              |            — | 105.628 → 105.628 (+0.000) | 36,043.958 → 36,365.888 (+321.929) | 3,546,292.957 → 3,577,966.946 (+31,673.989) | 2,655,339.523 → 2,683,962.892 (+28,623.369) |      890,953.434 → 894,004.054 (+3,050.620) |        0 |
| Evoker — Power (Hare)                     |       41,646 | 109.712 → 109.712 (+0.000) |   39,986.659 → 39,986.659 (+0.000) |      3,971,155.114 → 3,971,155.114 (+0.000) |      3,612,198.801 → 3,612,198.801 (+0.000) |          358,956.313 → 358,956.313 (+0.000) |        0 |
| Evoker — Power Quickness (Hare)           |       39,651 | 116.103 → 116.103 (+0.000) |   37,032.422 → 37,032.422 (+0.000) |      3,976,800.731 → 3,976,800.731 (+0.000) |      3,599,214.794 → 3,599,214.794 (+0.000) |          377,585.938 → 377,585.938 (+0.000) |        0 |
| Evoker — Power Alacrity (Toad)            |       34,372 | 126.382 → 126.382 (+0.000) |   33,873.844 → 33,873.844 (+0.000) |      3,939,595.784 → 3,939,595.784 (+0.000) |      3,460,563.464 → 3,460,563.464 (+0.000) |          479,032.320 → 479,032.320 (+0.000) |        0 |
| Evoker — Condi (Pistol/Dagger)            |       42,665 | 100.514 → 100.514 (+0.000) |   43,249.651 → 43,249.651 (+0.000) |      3,970,822.586 → 3,970,822.586 (+0.000) |          654,187.722 → 654,187.722 (+0.000) |      3,316,634.864 → 3,316,634.864 (+0.000) |        0 |
| Evoker — Condi (Pistol/Warhorn)           |       42,525 | 100.465 → 100.465 (+0.000) |   43,071.016 → 43,071.016 (+0.000) |      3,970,099.629 → 3,970,099.629 (+0.000) |          547,437.571 → 547,437.571 (+0.000) |      3,422,662.058 → 3,422,662.058 (+0.000) |        0 |
| Evoker — Condi SE (Air)                   |       44,153 |   92.176 → 92.176 (+0.000) |   44,060.948 → 44,060.948 (+0.000) |      3,970,640.471 → 3,970,640.471 (+0.000) |          915,156.084 → 915,156.084 (+0.000) |      3,055,484.387 → 3,055,484.387 (+0.000) |        0 |
| Evoker — Condi Quickness SE (Air)         |       40,102 | 100.860 → 100.860 (+0.000) |   40,484.834 → 40,484.834 (+0.000) |      3,970,752.509 → 3,970,752.509 (+0.000) |      1,047,168.596 → 1,047,168.596 (+0.000) |      2,923,583.913 → 2,923,583.913 (+0.000) |        0 |
| Evoker — Condi Alacrity Toad (P/Wh)       |       38,045 | 109.544 → 109.544 (+0.000) |   38,296.004 → 38,296.004 (+0.000) |      3,970,529.645 → 3,970,529.645 (+0.000) |          565,338.684 → 565,338.684 (+0.000) |      3,405,190.961 → 3,405,190.961 (+0.000) |        0 |
| Evoker — Inferno SE                       |            — | 114.138 → 114.138 (+0.000) |   38,916.664 → 38,916.664 (+0.000) |      3,970,776.149 → 3,970,776.149 (+0.000) |      1,809,768.915 → 1,809,768.915 (+0.000) |      2,161,007.234 → 2,161,007.234 (+0.000) |        1 |
| Evoker — Inferno Quickness SE             |            — | 114.138 → 114.138 (+0.000) |   37,879.871 → 37,879.871 (+0.000) |      3,971,052.954 → 3,971,052.954 (+0.000) |      1,844,614.840 → 1,844,614.840 (+0.000) |      2,126,438.114 → 2,126,438.114 (+0.000) |        1 |

### Engineer

| Build                                   | Manifest DPS |                   Duration |                                DPS |                                Total damage |                               Strike damage |                       Condition damage | Warnings |
| --------------------------------------- | -----------: | -------------------------: | ---------------------------------: | ------------------------------------------: | ------------------------------------------: | -------------------------------------: | -------: |
| Amalgam — Power (Hammer - Symbiotic)    |       42,177 | 102.323 → 102.323 (+0.000) |  42,180.613 → 42,201.313 (+20.700) |  3,967,634.983 → 3,969,582.076 (+1,947.094) |      3,404,289.068 → 3,404,289.068 (+0.000) | 563,345.914 → 565,293.008 (+1,947.094) |        0 |
| Amalgam — Condition Alacrity (2 Kit)    |       35,609 | 110.089 → 110.089 (+0.000) |   35,922.480 → 35,922.480 (+0.000) |      3,908,689.152 → 3,908,689.152 (+0.000) |          964,022.119 → 964,022.119 (+0.000) | 2,944,667.033 → 2,944,667.033 (+0.000) |        0 |
| Amalgam — Condition (3 Kit)             |       43,593 |   93.240 → 93.240 (+0.000) |   43,766.351 → 43,766.351 (+0.000) |      3,951,226.127 → 3,951,226.127 (+0.000) |          884,281.964 → 884,281.964 (+0.000) | 3,066,944.163 → 3,066,944.163 (+0.000) |        0 |
| Holosmith — Condition (Pistol / Pistol) |       42,947 |   93.040 → 93.040 (+0.000) |   42,974.392 → 42,974.392 (+0.000) |      3,929,578.382 → 3,929,578.382 (+0.000) |          817,793.111 → 817,793.111 (+0.000) | 3,111,785.271 → 3,111,785.271 (+0.000) |        0 |
| Holosmith — Power (Sword / Pistol)      |       41,628 |   97.560 → 97.560 (+0.000) |   41,662.920 → 41,662.920 (+0.000) |      3,966,309.991 → 3,966,309.991 (+0.000) |      3,591,504.041 → 3,591,504.041 (+0.000) |     374,805.950 → 374,805.950 (+0.000) |        0 |
| Mechanist — Power (Sword / Pistol)      |       41,140 |   98.022 → 98.022 (+0.000) |   40,896.199 → 40,896.199 (+0.000) |      3,904,032.954 → 3,904,032.954 (+0.000) |      3,663,802.727 → 3,663,802.727 (+0.000) |     240,230.228 → 240,230.228 (+0.000) |        0 |
| Mechanist — Power (Rifle)               |       38,474 | 103.955 → 103.955 (+0.000) |   38,512.502 → 38,512.502 (+0.000) |      3,982,385.321 → 3,982,385.321 (+0.000) |      3,720,545.883 → 3,720,545.883 (+0.000) |     261,839.438 → 261,839.438 (+0.000) |        0 |
| Scrapper — Power (Hammer)               |       42,208 | 102.000 → 102.000 (+0.000) | 41,288.819 → 41,446.451 (+157.633) | 3,867,936.527 → 3,882,703.546 (+14,767.019) | 3,648,731.889 → 3,660,496.409 (+11,764.519) | 219,204.638 → 222,207.138 (+3,002.500) |        0 |

### Guardian

| Build                                                     | Manifest DPS |                   Duration |                               DPS |                               Total damage |                          Strike damage |                           Condition damage | Warnings |
| --------------------------------------------------------- | -----------: | -------------------------: | --------------------------------: | -----------------------------------------: | -------------------------------------: | -----------------------------------------: | -------: |
| Willbender — Power (Spear / Greatsword)                   |       42,975 |   91.680 → 91.680 (+0.000) |  43,000.082 → 43,000.082 (+0.000) |     3,914,297.450 → 3,914,297.450 (+0.000) | 3,682,665.794 → 3,682,665.794 (+0.000) |         231,631.656 → 231,631.656 (+0.000) |        0 |
| Willbender — Condition (Pistol / Torch + Pistol / Pistol) |       42,400 |   95.000 → 95.000 (+0.000) | 42,342.579 → 42,399.597 (+57.018) | 3,971,733.947 → 3,978,778.200 (+7,044.253) |     614,884.729 → 614,884.729 (+0.000) | 3,356,849.218 → 3,363,893.471 (+7,044.253) |        0 |
| Firebrand — Condition (Axe / Torch + Pistol / Pistol)     |       37,524 |   97.520 → 97.520 (+0.000) |  41,670.729 → 41,670.729 (+0.000) |     3,970,387.022 → 3,970,387.022 (+0.000) |     591,712.342 → 591,712.342 (+0.000) |     3,378,674.680 → 3,378,674.680 (+0.000) |        0 |
| Dragonhunter — Power (Spear / Greatsword)                 |       41,466 |   95.087 → 95.087 (+0.000) |  41,794.167 → 41,794.167 (+0.000) |     3,932,287.808 → 3,932,287.808 (+0.000) | 3,813,548.058 → 3,813,548.058 (+0.000) |         118,739.750 → 118,739.750 (+0.000) |        0 |
| Luminary — Power (Greatsword / Spear)                     |       42,015 |   94.080 → 94.080 (+0.000) |  41,541.705 → 41,541.705 (+0.000) |     3,862,547.767 → 3,862,547.767 (+0.000) | 3,792,939.017 → 3,792,939.017 (+0.000) |           69,608.750 → 69,608.750 (+0.000) |        0 |
| Luminary — Power Alacrity (Greatsword / Spear)            |       38,081 | 106.455 → 106.455 (+0.000) |  37,585.549 → 37,585.549 (+0.000) |     3,959,825.528 → 3,959,825.528 (+0.000) | 3,879,158.378 → 3,879,158.378 (+0.000) |           80,667.150 → 80,667.150 (+0.000) |        0 |

### Mesmer

| Build                                     | Manifest DPS |                   Duration |                              DPS |                           Total damage |                          Strike damage |                       Condition damage | Warnings |
| ----------------------------------------- | -----------: | -------------------------: | -------------------------------: | -------------------------------------: | -------------------------------------: | -------------------------------------: | -------: |
| Chronomancer — Power                      |       43,720 |   91.042 → 91.042 (+0.000) | 43,712.951 → 43,712.951 (+0.000) | 3,894,124.511 → 3,894,124.511 (+0.000) | 3,698,696.209 → 3,698,696.209 (+0.000) |     195,428.303 → 195,428.303 (+0.000) |        0 |
| Chronomancer — Condition                  |       46,048 |   88.066 → 88.066 (+0.000) | 46,041.646 → 46,041.646 (+0.000) | 3,970,017.652 → 3,970,017.652 (+0.000) |     589,145.205 → 589,145.205 (+0.000) | 3,380,872.447 → 3,380,872.447 (+0.000) |        0 |
| Mirage — Condition - Dune Cloak           |       41,128 |   97.667 → 97.667 (+0.000) | 40,980.037 → 40,980.037 (+0.000) | 3,959,778.000 → 3,959,778.000 (+0.000) |     557,634.426 → 557,634.426 (+0.000) | 3,402,143.573 → 3,402,143.573 (+0.000) |        0 |
| Virtuoso — Condition                      |       39,903 | 100.736 → 100.736 (+0.000) | 39,902.501 → 39,902.501 (+0.000) | 3,970,219.089 → 3,970,219.089 (+0.000) | 1,103,199.187 → 1,103,199.187 (+0.000) | 2,867,019.902 → 2,867,019.902 (+0.000) |        0 |
| Troubadour — Power (Dagger-Sword / Spear) |       42,690 |   95.801 → 95.801 (+0.000) | 42,767.235 → 42,767.235 (+0.000) | 4,013,918.857 → 4,013,918.857 (+0.000) | 3,914,127.169 → 3,914,127.169 (+0.000) |       99,791.688 → 99,791.688 (+0.000) |        0 |

### Necromancer

| Build                                                     | Manifest DPS |                   Duration |                                  DPS |                                 Total damage |                          Strike damage |                             Condition damage | Warnings |
| --------------------------------------------------------- | -----------: | -------------------------: | -----------------------------------: | -------------------------------------------: | -------------------------------------: | -------------------------------------------: | -------: |
| Scourge — Condition (Pistol / Torch + Scepter / Torch)    |       39,662 | 100.760 → 100.760 (+0.000) |     39,661.748 → 39,661.748 (+0.000) |       3,920,167.217 → 3,920,167.217 (+0.000) |     404,829.202 → 404,829.202 (+0.000) |       3,515,338.015 → 3,515,338.015 (+0.000) |        0 |
| Reaper — Power (Greatsword / Spear)                       |       43,427 |   94.869 → 94.869 (+0.000) |     43,426.786 → 43,426.786 (+0.000) |       4,046,898.770 → 4,046,898.770 (+0.000) | 4,022,133.582 → 4,022,133.582 (+0.000) |             24,765.188 → 24,765.188 (+0.000) |        0 |
| Reaper — Condition (Dagger / Sword + Spear)               |       44,171 |   91.720 → 91.720 (+0.000) |   44,163.149 → 43,639.806 (-523.343) |  3,971,150.367 → 3,924,091.321 (-47,059.046) | 1,609,507.105 → 1,609,507.105 (+0.000) |  2,361,643.261 → 2,314,584.216 (-47,059.046) |        1 |
| Reaper — Condition (Fields - Pistol / Torch + Greatsword) |       52,041 |   78.160 → 84.560 (+6.400) | 52,045.236 → 44,208.332 (-7,836.904) | 3,986,665.074 → 3,669,291.591 (-317,373.483) | 928,930.635 → 922,352.958 (-6,577.677) | 3,057,734.439 → 2,746,938.633 (-310,795.805) |        6 |
| Ritualist — Power (Greatsword / Spear)                    |       43,284 |   95.040 → 95.040 (+0.000) |     43,283.807 → 43,283.807 (+0.000) |       3,974,319.180 → 3,974,319.180 (+0.000) | 3,962,944.180 → 3,962,944.180 (+0.000) |             11,375.000 → 11,375.000 (+0.000) |        0 |
| Harbinger — Power (Greatsword / Spear)                    |       43,688 | 101.040 → 101.040 (+0.000) |     43,303.194 → 43,303.194 (+0.000) |       3,912,876.628 → 3,912,876.628 (+0.000) | 3,619,182.425 → 3,619,182.425 (+0.000) |           293,694.203 → 293,694.203 (+0.000) |        0 |
| Harbinger — Condition (Pistol / Torch + Scepter / Dagger) |       45,308 |   96.660 → 96.660 (+0.000) |     45,307.895 → 45,307.895 (+0.000) |       3,915,508.265 → 3,915,508.265 (+0.000) |     602,410.715 → 602,410.715 (+0.000) |       3,313,097.550 → 3,313,097.550 (+0.000) |        0 |

### Ranger

| Build                                                  | Manifest DPS |                   Duration |                               DPS |                               Total damage |                              Strike damage |                           Condition damage | Warnings |
| ------------------------------------------------------ | -----------: | -------------------------: | --------------------------------: | -----------------------------------------: | -----------------------------------------: | -----------------------------------------: | -------: |
| Druid — Condition Alacrity (Dagger-Torch / Axe-Dagger) |       29,646 | 104.985 → 104.985 (+0.000) | 29,603.944 → 29,645.776 (+41.831) | 3,078,366.129 → 3,082,715.974 (+4,349.845) |         467,812.352 → 467,812.352 (+0.000) | 2,610,553.777 → 2,614,903.622 (+4,349.845) |        0 |
| Soulbeast — Power (Hammer / Axe-Axe)                   |       43,074 |   92.706 → 92.706 (+0.000) |  43,073.675 → 43,073.675 (+0.000) |     3,939,776.778 → 3,939,776.778 (+0.000) |     3,816,293.128 → 3,816,293.128 (+0.000) |         123,483.650 → 123,483.650 (+0.000) |        0 |
| Soulbeast — Power (Hammer / Sword-Axe)                 |       42,658 |   92.786 → 92.786 (+0.000) |  42,657.337 → 42,657.337 (+0.000) |     3,905,108.607 → 3,905,108.607 (+0.000) |     3,850,524.525 → 3,850,524.525 (+0.000) |           54,584.082 → 54,584.082 (+0.000) |        0 |
| Untamed — Power (Hammer / Sword-Axe)                   |       44,840 |   91.574 → 91.574 (+0.000) |  44,839.559 → 44,839.559 (+0.000) |     4,046,321.833 → 4,046,321.833 (+0.000) |     3,862,823.358 → 3,862,823.358 (+0.000) |         183,498.475 → 183,498.475 (+0.000) |        0 |
| Galeshot — Power (Longbow / Axe-Axe)                   |       42,266 |   95.800 → 95.800 (+0.000) | 42,266.450 → 42,295.465 (+29.015) | 3,970,087.646 → 3,977,465.566 (+7,377.920) | 3,802,860.959 → 3,810,653.566 (+7,792.608) |       167,226.688 → 166,812.000 (-414.688) |        0 |
| Galeshot — Power Quickness (Longbow / Axe-Axe)         |       35,160 | 113.040 → 113.040 (+0.000) |  35,160.013 → 35,161.947 (+1.935) |   3,956,204.639 → 3,956,422.326 (+217.688) |     3,721,873.997 → 3,721,873.997 (+0.000) |       234,330.642 → 234,548.329 (+217.688) |        0 |

### Revenant

| Build                                              | Manifest DPS |                   Duration |                                DPS |                                Total damage |                          Strike damage |                            Condition damage | Warnings |
| -------------------------------------------------- | -----------: | -------------------------: | ---------------------------------: | ------------------------------------------: | -------------------------------------: | ------------------------------------------: | -------: |
| Renegade — Power Alacrity (Sword / Sword)          |       34,305 | 117.380 → 117.380 (+0.000) |   34,304.616 → 34,304.616 (+0.000) |      3,957,380.498 → 3,957,380.498 (+0.000) | 3,863,275.756 → 3,863,275.756 (+0.000) |            94,104.742 → 94,104.742 (+0.000) |        0 |
| Renegade — Condition (Shortbow / Mace-Axe)         |       41,336 |   95.800 → 95.800 (+0.000) | 41,519.985 → 41,703.162 (+183.177) | 3,939,416.165 → 3,956,796.021 (+17,379.856) |     815,595.163 → 815,595.163 (+0.000) | 3,123,821.002 → 3,141,200.858 (+17,379.856) |        0 |
| Renegade — Condition (Mace-Axe / Spear)            |       41,373 |   95.920 → 95.920 (+0.000) |   41,298.543 → 41,298.543 (+0.000) |      3,939,881.029 → 3,939,881.029 (+0.000) |     768,070.750 → 768,070.750 (+0.000) |      3,171,810.280 → 3,171,810.280 (+0.000) |        0 |
| Herald — Condition Quickness (Shortbow / Mace-Axe) |       32,435 | 124.440 → 124.440 (+0.000) | 32,439.971 → 32,624.133 (+184.162) |  3,973,247.626 → 3,978,839.296 (+5,591.670) | 725,954.691 → 720,330.310 (-5,624.380) | 3,247,292.935 → 3,258,508.986 (+11,216.051) |        0 |
| Vindicator — Power (Greatsword / SwSw - Energy)    |       44,989 |   90.559 → 90.559 (+0.000) |   44,988.354 → 44,988.354 (+0.000) |      3,998,384.908 → 3,998,384.908 (+0.000) | 3,955,713.908 → 3,955,713.908 (+0.000) |            42,671.000 → 42,671.000 (+0.000) |        0 |
| Conduit — Power (Greatsword / SwSw)                |       42,798 |   95.019 → 95.019 (+0.000) |   42,798.091 → 42,798.091 (+0.000) |      3,993,104.670 → 3,993,104.670 (+0.000) | 3,927,757.804 → 3,927,757.804 (+0.000) |            65,346.867 → 65,346.867 (+0.000) |        0 |
| Conduit — Condition (Mistfire)                     |       40,004 |   98.777 → 98.777 (+0.000) |   40,003.959 → 40,003.959 (+0.000) |      3,911,347.052 → 3,911,347.052 (+0.000) |     585,767.012 → 585,767.012 (+0.000) |      3,325,580.040 → 3,325,580.040 (+0.000) |        0 |

### Thief

| Build                                      | Manifest DPS |                   Duration |                              DPS |                           Total damage |                          Strike damage |                       Condition damage | Warnings |
| ------------------------------------------ | -----------: | -------------------------: | -------------------------------: | -------------------------------------: | -------------------------------------: | -------------------------------------: | -------: |
| Deadeye — Power Quickness (Sword / Pistol) |       35,365 | 113.840 → 113.840 (+0.000) | 34,828.695 → 34,828.695 (+0.000) | 3,955,146.580 → 3,955,146.580 (+0.000) | 3,919,824.230 → 3,919,824.230 (+0.000) |       35,322.350 → 35,322.350 (+0.000) |        0 |
| Deadeye — Power Quickness (Rifle)          |       36,891 | 108.320 → 108.320 (+0.000) | 36,704.467 → 36,704.467 (+0.000) | 3,952,337.034 → 3,952,337.034 (+0.000) | 3,921,049.634 → 3,921,049.634 (+0.000) |       31,287.400 → 31,287.400 (+0.000) |        0 |
| Antiquary — Power (Sword / Pistol)         |       43,248 |   91.201 → 91.201 (+0.000) | 44,716.269 → 44,716.269 (+0.000) | 3,972,593.359 → 3,972,593.359 (+0.000) | 3,830,867.895 → 3,830,867.895 (+0.000) |     141,725.464 → 141,725.464 (+0.000) |        0 |
| Antiquary — Condition (Spear)              |       40,790 | 129.310 → 129.310 (+0.000) | 41,404.945 → 41,404.945 (+0.000) | 3,951,687.905 → 3,951,687.905 (+0.000) |     928,468.031 → 928,468.031 (+0.000) | 3,023,219.874 → 3,023,219.874 (+0.000) |        0 |
| Antiquary — Condition (Dagger / Dagger)    |       42,082 | 126.400 → 126.400 (+0.000) | 42,668.045 → 42,668.045 (+0.000) | 3,971,541.638 → 3,971,541.638 (+0.000) |     684,723.855 → 684,723.855 (+0.000) | 3,286,817.784 → 3,286,817.784 (+0.000) |        0 |
| Specter — Condition (Scepter / Dagger)     |       36,275 | 111.942 → 111.942 (+0.000) | 36,616.317 → 36,616.317 (+0.000) | 3,933,397.956 → 3,933,397.956 (+0.000) |     516,716.383 → 516,716.383 (+0.000) | 3,416,681.573 → 3,416,681.573 (+0.000) |        0 |
| Daredevil — Power (Dagger / Dagger)        |       43,036 |   94.240 → 94.240 (+0.000) | 42,857.216 → 42,857.216 (+0.000) | 3,961,721.019 → 3,961,721.019 (+0.000) | 3,872,886.794 → 3,872,886.794 (+0.000) |       88,834.225 → 88,834.225 (+0.000) |        0 |
| Daredevil — Condition (Dagger / Dagger)    |       38,045 | 135.607 → 135.607 (+0.000) | 38,044.689 → 38,044.689 (+0.000) | 3,967,566.498 → 3,967,566.498 (+0.000) |     384,029.033 → 384,029.033 (+0.000) | 3,583,537.466 → 3,583,537.466 (+0.000) |        0 |

### Warrior

| Build                                             | Manifest DPS |                 Duration |                              DPS |                           Total damage |                          Strike damage |                       Condition damage | Warnings |
| ------------------------------------------------- | -----------: | -----------------------: | -------------------------------: | -------------------------------------: | -------------------------------------: | -------------------------------------: | -------: |
| Bladesworn — Power (Sword / Pistol)               |       41,913 | 98.715 → 98.715 (+0.000) | 41,912.526 → 41,912.526 (+0.000) | 3,972,930.243 → 3,972,930.243 (+0.000) | 3,835,674.020 → 3,835,674.020 (+0.000) |     137,256.222 → 137,256.222 (+0.000) |        0 |
| Berserker — Power (Spear + Greatsword)            |       41,063 | 95.880 → 95.880 (+0.000) | 42,212.812 → 42,212.812 (+0.000) | 3,977,929.706 → 3,977,929.706 (+0.000) | 3,965,254.706 → 3,965,254.706 (+0.000) |       12,675.000 → 12,675.000 (+0.000) |        0 |
| Berserker — Power (Hammer + Axe/Mace)             |       43,869 | 94.480 → 94.480 (+0.000) | 42,765.227 → 42,765.227 (+0.000) | 3,970,323.655 → 3,970,323.655 (+0.000) | 3,959,273.655 → 3,959,273.655 (+0.000) |       11,050.000 → 11,050.000 (+0.000) |        0 |
| Berserker — Condition (Longbow + Sword/Torch)     |       43,275 | 91.440 → 91.440 (+0.000) | 44,607.390 → 44,607.390 (+0.000) | 3,993,253.596 → 3,993,253.596 (+0.000) |     852,628.749 → 852,628.749 (+0.000) | 3,140,624.848 → 3,140,624.848 (+0.000) |        0 |
| Spellbreaker — Power (Dagger/Mace + Sword/Axe)    |       43,058 | 95.643 → 95.643 (+0.000) | 42,982.416 → 42,982.416 (+0.000) | 3,939,338.383 → 3,939,338.383 (+0.000) | 3,802,666.582 → 3,802,666.582 (+0.000) |     136,671.801 → 136,671.801 (+0.000) |        0 |
| Spellbreaker — Power (Dagger/Mace + Sword/Dagger) |       43,387 | 95.560 → 95.560 (+0.000) | 43,284.355 → 43,284.355 (+0.000) | 3,963,418.555 → 3,963,418.555 (+0.000) | 3,807,598.392 → 3,807,598.392 (+0.000) |     155,820.164 → 155,820.164 (+0.000) |        0 |
| Spellbreaker — Power (Hammer + Dagger/Mace)       |       43,077 | 95.680 → 95.680 (+0.000) | 43,026.329 → 43,026.329 (+0.000) | 4,006,611.740 → 4,006,611.740 (+0.000) | 3,994,911.740 → 3,994,911.740 (+0.000) |       11,700.000 → 11,700.000 (+0.000) |        0 |
| Paragon — Power (Sword/Axe + Dagger/Mace)         |       42,115 | 96.447 → 96.447 (+0.000) | 42,252.439 → 42,252.439 (+0.000) | 3,975,430.591 → 3,975,430.591 (+0.000) | 3,808,547.200 → 3,808,547.200 (+0.000) |     166,883.392 → 166,883.392 (+0.000) |        0 |
