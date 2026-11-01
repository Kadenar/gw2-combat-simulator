/** Maintained core and elite trait lines supply trait presentation and selection layout. */
import type { Gw2SpecializationData } from '#gw2/platform/profession-definition/specialization-data-types.js';

export const TRAIT_LINES: readonly Gw2SpecializationData[] = [
  {
    id: 53,
    name: 'Spite',
    elite: false,
    icon: 'https://render.guildwars2.com/file/2D34377B04051FFDCDB553C7DCDABCD5DFBB68D7/1012011.png',
    minorTraits: [
      {
        id: 913,
        name: "Reaper's Might",
        description: 'Shroud skill 1 grants might.',
        icon: 'https://render.guildwars2.com/file/080173CE4527AF48B3F90770C8FB676343EBDB02/1012603.png'
      },
      {
        id: 915,
        name: 'Awaken the Pain',
        description: 'Might grants you more power. Gain might when entering shroud.',
        icon: 'https://render.guildwars2.com/file/FD34100F781539CF49B657412CDBD9B170D6C964/1012605.png'
      },
      {
        id: 917,
        name: 'Siphoned Power',
        description: 'Gain might when you strike a foe below the health threshold.',
        icon: 'https://render.guildwars2.com/file/F9CC326D70BFDFAED0054C27F721362AFB32177E/1012604.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 914,
          name: 'Spiteful Talisman',
          description:
            'Your strike damage is increased. Strike damage is further increased against foes without boons.',
          icon: 'https://render.guildwars2.com/file/4FDFAB1B3BFF06F6044A491B04967C5D03526B0B/1012594.png'
        },
        {
          id: 916,
          name: 'Malicious Swarm',
          description: 'Cast Lesser Signet of the Locust when you use a healing skill.',
          icon: 'https://render.guildwars2.com/file/EFCE14DF279DDD28C54077500B03DEC1B692120A/1012595.png'
        },
        {
          id: 1863,
          name: 'Bitter Chill',
          description: 'Chilling a foe inflicts vulnerability.',
          icon: 'https://render.guildwars2.com/file/2431E825115DA7FF690C091C2316AAB9F493B93A/1012596.png'
        }
      ],
      [
        {
          id: 899,
          name: 'Chill of Death',
          description:
            'Cast Lesser Spinal Shivers on a foe when attacking them while their health is below the threshold.',
          icon: 'https://render.guildwars2.com/file/FED2475CCB0936A368AB44DA729EE0AFACBBBE06/1012597.png'
        },
        {
          id: 829,
          name: 'Spiteful Fortitude',
          description:
            'Gain vitality based on a percentage of your power. Gain life force when you strike a foe below the health threshold.',
          icon: 'https://render.guildwars2.com/file/6272F31C9A6D02196C0891040C4A9C0108901BDA/1012598.png'
        },
        {
          id: 909,
          name: 'Signets of Suffering',
          description:
            'Signets steal health and remove boons from affected foes. Siphon healing is reduced for each target struck beyond the first.',
          icon: 'https://render.guildwars2.com/file/EEB462072294673B6ADC280A2374216047529798/1012600.png'
        }
      ],
      [
        {
          id: 919,
          name: 'Dread',
          description: 'Inflicting fear on a foe gives you boons and increases your strike damage for a short time.',
          icon: 'https://render.guildwars2.com/file/7BC853D02CC59AD43A677E3D515674AA1D3FE164/1012599.png'
        },
        {
          id: 853,
          name: 'Close to Death',
          description: 'Deal increased strike damage to enemies below the health threshold.',
          icon: 'https://render.guildwars2.com/file/ADD8DB0EA734C99FE123FF0A513E0D124FD4AC2E/1012601.png'
        },
        {
          id: 903,
          name: 'Spiteful Spirit',
          description: 'Strike around you when entering shroud.',
          icon: 'https://render.guildwars2.com/file/9775E905A6CBDF95CB106A0F95B79E74132CAF9C/1012602.png'
        }
      ]
    ]
  },
  {
    id: 39,
    name: 'Curses',
    elite: false,
    icon: 'https://render.guildwars2.com/file/C8E1A81601C3D5AC10285505E9F730621C3357CD/1012007.png',
    minorTraits: [
      {
        id: 802,
        name: 'Barbed Precision',
        description: 'Critical hits have a chance to cause bleeding. Increases bleed duration.',
        icon: 'https://render.guildwars2.com/file/BAB49A0BBD9F96D4B27F9E5DEB08ADDF1230C90C/1012555.png'
      },
      {
        id: 803,
        name: 'Furious Demise',
        description: 'Gain fury when entering shroud. Gain additional precision.',
        icon: 'https://render.guildwars2.com/file/3907DA1AFB5B94D0A221F6623FC3ACE819334861/1012556.png'
      },
      {
        id: 810,
        name: 'Target the Weak',
        description:
          'Increases critical-hit chance for each condition on the foe. Gain condition damage based on your precision.',
        icon: 'https://render.guildwars2.com/file/1BA35717D3954A08444578250CB32717E0F92B69/1012557.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1883,
          name: 'Insidious Disruption',
          description:
            'Disabling a foe inflicts torment on them.\nDisables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.',
          icon: 'https://render.guildwars2.com/file/130A2FAB4CFC7AECE5557EC0A1A20B039C0C0B9B/2229316.png'
        },
        {
          id: 2013,
          name: 'Plague Sending',
          description:
            'Your first attack after entering shroud transfers conditions.\nOnly activates if you have conditions.',
          icon: 'https://render.guildwars2.com/file/F004E33D079E4B5762EEF51F94CA493B64FFC4A2/1012547.png'
        },
        {
          id: 815,
          name: 'Chilling Darkness',
          description: 'Blinding a target will also apply chill.',
          icon: 'https://render.guildwars2.com/file/6B150BF59E2064171BBDF1B9085054080F31C46A/1012548.png'
        }
      ],
      [
        {
          id: 816,
          name: 'Master of Corruption',
          description: 'Corruptions gain reduced recharge time and inflict additional conditions on you.',
          icon: 'https://render.guildwars2.com/file/B63DE52ADE559806E0D5BC201F2CDF5F66585F19/1012549.png'
        },
        {
          id: 1693,
          name: 'Path of Corruption',
          description: 'Shroud skill 2 now additionally converts boons into conditions.',
          icon: 'https://render.guildwars2.com/file/C52E37C330010C05434662F0F70B5D011669D73B/1012550.png'
        },
        {
          id: 812,
          name: 'Parasitic Contagion',
          description:
            'A percentage of your condition damage heals you.\nHealing will not occur while life force replaces health.',
          icon: 'https://render.guildwars2.com/file/64A06911F701972655B6130727A308023C98E301/1012553.png'
        }
      ],
      [
        {
          id: 813,
          name: 'Weakening Shroud',
          description: 'Debilitate nearby enemies when entering shroud. Critical hits inflict weakness.',
          icon: 'https://render.guildwars2.com/file/A0F1F39CA0A102D63CBBC95CAB7FEB0B99AE9ED6/1012552.png'
        },
        {
          id: 1696,
          name: 'Terror',
          description: 'Fear you inflict deals damage each second.',
          icon: 'https://render.guildwars2.com/file/DA2EEB0209496A643A574B52C30D27B4D0555804/1012551.png'
        },
        {
          id: 801,
          name: 'Lingering Curse',
          description:
            'Your condition damage is increased. Conditions inflicted by scepter skills have longer durations, and Feast of Corruption becomes Devouring Darkness.',
          icon: 'https://render.guildwars2.com/file/1927954AD4FF7FB85032017CD8B9B67BF87CC0EB/1012554.png'
        }
      ]
    ]
  },
  {
    id: 2,
    name: 'Death Magic',
    elite: false,
    icon: 'https://render.guildwars2.com/file/16663C1CDF532AB0DCC0CB08951DD2F49351D5D4/1012008.png',
    minorTraits: [
      {
        id: 856,
        name: 'Armored Shroud',
        description: 'Gain carapace when entering shroud.',
        icon: 'https://render.guildwars2.com/file/DC38F4623BFE773E681E37A0EAE11A364D52AACE/1012567.png'
      },
      {
        id: 839,
        name: 'Soul Comprehension',
        description:
          'Your passive life-force generation from nearby deaths is increased. Kills grant carapace. When you enter shroud, gain life-force per stack of carapace.',
        icon: 'https://render.guildwars2.com/file/E5D7FFCF5270F6FACCF6A13324E6A26AE77C7D3C/1012568.png'
      },
      {
        id: 1929,
        name: 'Beyond the Veil',
        description: 'Take reduced condition damage while at or above the threshold of carapace stacks.',
        icon: 'https://render.guildwars2.com/file/6E57E54B98BD24A7049CFA48337F325C062D2360/1012569.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 820,
          name: 'Flesh of the Master',
          description:
            'Minions have increased health. Gain carapace for each minion you control.\nYour minions are destroyed when this trait is reassigned.',
          icon: 'https://render.guildwars2.com/file/20C969485BD63B36ED0B467EA725D7A7550E5AF6/1012558.png'
        },
        {
          id: 857,
          name: 'Putrid Defense',
          description: 'Poison damage is increased. Applying poison grants carapace.',
          icon: 'https://render.guildwars2.com/file/7FF962AB0917E9C651D00503D0D496067508910A/1012560.png'
        },
        {
          id: 1922,
          name: 'Shrouded Removal',
          description:
            'Lose a condition when you enter shroud and every few seconds while you remain in shroud. Gain carapace when removing conditions from yourself.',
          icon: 'https://render.guildwars2.com/file/C9C61D671A41B6DEC4D845070215F4FC9832F3D4/1012559.png'
        }
      ],
      [
        {
          id: 858,
          name: 'Necromantic Corruption',
          description:
            'Minions deal more damage and take conditions from you. When a minion attacks, it transfers conditions to its target.\nThere is a 10 second cooldown per minion.',
          icon: 'https://render.guildwars2.com/file/AE61EAFBE6F1CC7902189CE79FA3FAB103F53F59/1012561.png'
        },
        {
          id: 860,
          name: 'Dark Defense',
          description:
            'Protection reduces incoming condition damage. Gain carapace and protection when you use a healing skill.',
          icon: 'https://render.guildwars2.com/file/07E34F107B380DFDEFAF1894C66973BCFC3B3D9D/1012562.png'
        },
        {
          id: 855,
          name: 'Deadly Strength',
          description: 'Carapace stacks grant power and condition damage.',
          icon: 'https://render.guildwars2.com/file/560C65022F0DCC173CADEBE4DCD72F7CAA32467B/1012563.png'
        }
      ],
      [
        {
          id: 842,
          name: 'Death Nova',
          description:
            'When you or one of your minions is downed, create a Poison Nova. Summon a jagged horror when you kill a foe.',
          icon: 'https://render.guildwars2.com/file/269AA6E19BAEA0359390FBFF0074BB1353F3C92E/1012564.png'
        },
        {
          id: 1940,
          name: "Corrupter's Fervor",
          description:
            'Inflicting a condition on a foe grants carapace. Gain incoming damage reduction while at or above the carapace threshold.',
          icon: 'https://render.guildwars2.com/file/64FF0B91380345FD2A12A1EE730448A966725E91/1012565.png'
        },
        {
          id: 1694,
          name: 'Unholy Sanctuary',
          description:
            'Regenerate health while in shroud. If your life force is above the threshold, your shroud will activate if you would take a lethal blow.',
          icon: 'https://render.guildwars2.com/file/12CF34B0AED1A41319E42D51EEB699B4A21F65D8/1012566.png'
        }
      ]
    ]
  },
  {
    id: 19,
    name: 'Blood Magic',
    elite: false,
    icon: 'https://render.guildwars2.com/file/D1D9C63AD9CC05FC1B19970556B0C1E0ADD77905/1012006.png',
    minorTraits: [
      {
        id: 792,
        name: 'Mark of Evasion',
        description: 'Leave a Mark of Blood when you dodge.',
        icon: 'https://render.guildwars2.com/file/34F665FF0ADC0CAED190126A0E40DEF99BFCABCB/1012543.png'
      },
      {
        id: 783,
        name: 'Vampiric',
        description: 'Siphon health whenever you hit a foe. Minions siphon health and transfer it to you.',
        icon: 'https://render.guildwars2.com/file/0DF523B154B8FD9F2E2B95F72A534E7C80352D2A/1012544.png'
      },
      {
        id: 1931,
        name: 'Last Rites',
        description:
          'As long as you are not downed, allies near you do not bleed out if they are downed. Gain healing power based on your current health.',
        icon: 'https://render.guildwars2.com/file/FCCF489066E7F22BFECB5F165060E2A5C96B5AC9/1012545.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 780,
          name: 'Ritual of Life',
          description: 'Cast Lesser Well of Blood when reviving an ally. Wells of Blood revive allies every pulse.',
          icon: 'https://render.guildwars2.com/file/9348E1E1E5F166C69149984029A15FE2F2D9F40D/1012534.png'
        },
        {
          id: 788,
          name: 'Overflowing Thirst',
          description: 'Dagger skills grant nearby allies Taste for Blood.',
          icon: 'https://render.guildwars2.com/file/09266890E7D1517B2D634E026A67696ABDBCDBC3/1012535.png'
        },
        {
          id: 1876,
          name: 'Blood Renewal',
          description: 'Consume conditions to gain health when you use a healing skill.',
          icon: 'https://render.guildwars2.com/file/E44619EFE79BCAE2030E0A3A1CDBAE411A062403/1012536.png'
        }
      ],
      [
        {
          id: 789,
          name: 'Life from Death',
          description: 'Heal allies in an area when you exit shroud. Increase healing to other allies.',
          icon: 'https://render.guildwars2.com/file/B8310A13D0A908D9BBFC2607010AF79E399394AE/1012537.png'
        },
        {
          id: 799,
          name: "Banshee's Wail",
          description: 'Warhorn skills gain increased effect duration.',
          icon: 'https://render.guildwars2.com/file/BF29CCF73E0706164344A239B165671BF0357294/1012538.png'
        },
        {
          id: 1844,
          name: 'Vampiric Presence',
          description: 'You and your nearby allies siphon health with attacks. This effect increases while in Shroud.',
          icon: 'https://render.guildwars2.com/file/22B370D754AC1D69A8FE66DCCB36BE940455E5EA/1012539.png'
        }
      ],
      [
        {
          id: 782,
          name: 'Blood Bank',
          description:
            'Gaining health grants a proportionate amount of barrier. Conversion amount increases while at full health.',
          icon: 'https://render.guildwars2.com/file/06E563AE1E34AC1D24CCECF301AC70B4B07A330C/2310020.png'
        },
        {
          id: 1692,
          name: 'Unholy Martyr',
          description:
            'Entering shroud transfers conditions from allies to you. Exiting shroud consumes conditions currently on you and converts them to life force.',
          icon: 'https://render.guildwars2.com/file/0F286EE6A91BB2E628DD2703EE5E3E35070AFD0E/1012541.png'
        },
        {
          id: 778,
          name: 'Transfusion',
          description:
            'Marks can be triggered by allies to heal them and provide them with additional benefits. Create Lesser Chilblains at your location when you use your fourth shroud skill.',
          icon: 'https://render.guildwars2.com/file/7732E03BF4E6CD02BAFF0DDC04780A6F177549CE/1012542.png'
        }
      ]
    ]
  },
  {
    id: 50,
    name: 'Soul Reaping',
    elite: false,
    icon: 'https://render.guildwars2.com/file/A5A95CB5FADD99F59E07400907F0782B659574A9/1012010.png',
    minorTraits: [
      {
        id: 887,
        name: 'Gluttony',
        description: 'Increases the amount of life force gained from all sources.',
        icon: 'https://render.guildwars2.com/file/2C254E1B7AEA1101FA25FCE610EB074E32B8CD02/1012591.png'
      },
      {
        id: 891,
        name: 'Sinister Shroud',
        description: 'Shroud skills gain reduced recharge.',
        icon: 'https://render.guildwars2.com/file/75273DA6696969760BB6D765E56D0CDCD0ABBA43/1012592.png'
      },
      {
        id: 874,
        name: 'Soul Battery',
        description: 'Maximum life force is increased.',
        icon: 'https://render.guildwars2.com/file/022357BDC7179BBBF7679BD0A5B80EF59E02B050/1012593.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 875,
          name: 'Unyielding Blast',
          description: 'Shroud skill 1 inflicts vulnerability.',
          icon: 'https://render.guildwars2.com/file/C161543798EAA41863E26E3250FD534E4C1E357C/1012582.png'
        },
        {
          id: 898,
          name: 'Soul Marks',
          description: 'Marks become unblockable and generate life force when triggered.',
          icon: 'https://render.guildwars2.com/file/33961B371EDB0C0DC8FCC9963E0C9F103D6891DB/1012583.png'
        },
        {
          id: 888,
          name: 'Speed of Shadows',
          description: 'Entering shroud grants swiftness and removes movement-impairing conditions.',
          icon: 'https://render.guildwars2.com/file/6DDE13189AD8C45020D1CC1F0803E329F26839CB/1012584.png'
        }
      ],
      [
        {
          id: 894,
          name: 'Soul Barbs',
          description: 'Entering or exiting shroud increases all damage you deal for a duration.',
          icon: 'https://render.guildwars2.com/file/59A0DA7819F43F1B5E689B14CE0D0ABCC0EF3173/1012585.png'
        },
        {
          id: 861,
          name: 'Vital Persistence',
          description: 'Gain Vitality. Your incoming healing is increased.',
          icon: 'https://render.guildwars2.com/file/9BC34679FF900F4A387672CACB7BDAF59FB64956/1012586.png'
        },
        {
          id: 892,
          name: 'Fear of Death',
          description: 'Your fear effects have increased durations. Inflicting fear generates life force.',
          icon: 'https://render.guildwars2.com/file/0FF8E9ACE2E2105C0CF69696D12AADC000EF75A5/1012587.png'
        }
      ],
      [
        {
          id: 889,
          name: 'Eternal Life',
          description:
            'Gain life force every interval up to the threshold when not in shroud. Gain protection when you enter shroud.',
          icon: 'https://render.guildwars2.com/file/AEE06B525C42EFB8E47A3D23FED87DF2473793CF/2261508.png'
        },
        {
          id: 893,
          name: 'Death Perception',
          description: 'Gain increased critical-strike chance. Gain increased critical-strike damage while in shroud.',
          icon: 'https://render.guildwars2.com/file/D2360AB8930CAA809136287E6DA03DA37360E1A7/1012589.png'
        },
        {
          id: 905,
          name: 'Dhuumfire',
          description: 'Shroud skill 1 inflicts burning on your target.',
          icon: 'https://render.guildwars2.com/file/A309650463ECED29B2ADB89E0DC402662377BB99/1012590.png'
        }
      ]
    ]
  },
  {
    id: 34,
    name: 'Reaper',
    elite: true,
    icon: 'https://render.guildwars2.com/file/530A582BD864B73AF5CC6C44F9C61954322D9A15/1012009.png',
    minorTraits: [
      {
        id: 1905,
        name: 'Shroud Knight',
        description:
          "Death Shroud is replaced with Reaper's Shroud, which has more melee-oriented skills and consumes life force at a faster rate. Gain access to shouts.",
        icon: 'https://render.guildwars2.com/file/ECDE960B19500BC40843C89041CD0C1A3A06B05A/1012579.png'
      },
      {
        id: 1879,
        name: 'Shivers of Dread',
        description: 'Whenever you inflict fear, you also chill. Chill lasts longer.',
        icon: 'https://render.guildwars2.com/file/3BAA64BE683E69F89860E875170B45300060F1CA/1012580.png'
      },
      {
        id: 2018,
        name: 'Cold Shoulder',
        description: 'Chilled foes take increased strike damage from your attacks and deal less strike damage to you.',
        icon: 'https://render.guildwars2.com/file/9959EB3A12044FF0C708413A0CCA479D0515F17D/1012581.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1974,
          name: 'Augury of Death',
          description: 'Shouts now siphon health. This effect is increased on foes in melee range.',
          icon: 'https://render.guildwars2.com/file/CBBA2FA5F20755523E5424D0704B5B6C5F2B7C67/1012570.png'
        },
        {
          id: 2020,
          name: 'Chilling Nova',
          description: 'Critical hits against chilled foes cause an explosion that chills adjacent foes.',
          icon: 'https://render.guildwars2.com/file/BC1757B4EF53B20D64E83AC495B6B2E4505B04F3/1012571.png'
        },
        {
          id: 2026,
          name: 'Relentless Pursuit',
          description:
            "Reduces duration of movement-impairing conditions. Additional reduction while in reaper's shroud.",
          icon: 'https://render.guildwars2.com/file/03263B08082BDC390C0C38019CFF1F73B8CE077E/1012572.png'
        }
      ],
      [
        {
          id: 1969,
          name: 'Soul Eater',
          description:
            'Striking foes within the range threshold deals increased strike damage and heals you for a portion of the damage dealt.',
          icon: 'https://render.guildwars2.com/file/6237B918FA7042581BF3D8AFB234B93644C8756C/1012573.png'
        },
        {
          id: 2008,
          name: 'Chilling Victory',
          description:
            'Striking a chilled foe grants might and life force.\nSingle attacks can activate this trait more than once before recharging.',
          icon: 'https://render.guildwars2.com/file/68624FE2917028DBBC0370BBDDC8DB2C0EDD7CB8/1012574.png'
        },
        {
          id: 2031,
          name: 'Decimate Defenses',
          description: 'Striking a foe with vulnerability increases your critical hit chance.',
          icon: 'https://render.guildwars2.com/file/7DED6E45A3F8CEAF782FF0443D5CF90CAC73C5EF/1012575.png'
        }
      ],
      [
        {
          id: 1932,
          name: "Blighter's Boon",
          description: 'Gain life force and health when you apply a boon to yourself or remove a boon from an enemy.',
          icon: 'https://render.guildwars2.com/file/14D43D5970C25B59DA6E750DB6DA057EF40B25F6/1012576.png'
        },
        {
          id: 1919,
          name: 'Deathly Chill',
          description: 'Chill deals damage over time.',
          icon: 'https://render.guildwars2.com/file/D13FB8FB29539EFD5E1FE81FF991E2222E38CA0F/1012577.png'
        },
        {
          id: 2021,
          name: "Reaper's Onslaught",
          description:
            "Gain ferocity and quickness while in Reaper's Shroud. Hitting with Life Reap reduces the recharge time of shroud skills.\nRecharge reduction can only occur once per use of Life Reap.",
          icon: 'https://render.guildwars2.com/file/4676081D0C9BDFE3F25E0BD0C7EFAE0139D89A0B/1012578.png'
        }
      ]
    ]
  },
  {
    id: 60,
    name: 'Scourge',
    elite: true,
    icon: 'https://render.guildwars2.com/file/1407ADE7787A6BF6E457F5FA6DFA1062A5FA93FD/1769892.png',
    minorTraits: [
      {
        id: 2147,
        name: 'Mantle of Sand',
        description:
          'Gain the power to craft sand shadows and command them using your life force. Gain access to Punishment and Shade skills.\nShade skills inherit the effects of traits that affect shroud skills.',
        icon: 'https://render.guildwars2.com/file/CC70C2E5CBD991510C2DF661111AD0351DAF186E/1769972.png'
      },
      {
        id: 2121,
        name: 'Sand Sage',
        description: 'Gain concentration and expertise when you have an active shade.',
        icon: 'https://render.guildwars2.com/file/EC99779F63204EBAC00C37147BC43B0643F64091/1769973.png'
      },
      {
        id: 2096,
        name: 'Blood as Sand',
        description: 'Reduce all incoming damage taken when you have a shade active.',
        icon: 'https://render.guildwars2.com/file/BE75E965AB68DC0E5BFE5F3EA3A69C23CC01D5CC/1769974.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2167,
          name: 'Abrasive Grit',
          description:
            'Granting an ally a barrier removes conditions afflicting them and grants might.\nThis effect only occurs with barrier from scourge skills and traits.',
          icon: 'https://render.guildwars2.com/file/CA5C4DFB464203434617C1605879A8A77D11CDB4/1769964.png'
        },
        {
          id: 2074,
          name: 'Fell Beacon',
          description: 'Burning you inflict does more damage. Gain expertise based on your condition damage.',
          icon: 'https://render.guildwars2.com/file/39509D44AE46ACEB2046EFE9D70378ECE072B1AC/1769963.png'
        },
        {
          id: 2102,
          name: 'Nourishing Ashes',
          description: 'Gain life force when you inflict burning, and remove or corrupt a boon.',
          icon: 'https://render.guildwars2.com/file/0B6B794BD907A580606F7D3FC91FB49732DF3858/1769965.png'
        }
      ],
      [
        {
          id: 2059,
          name: 'Feed from Corruption',
          description: 'When you remove or corrupt a boon from an enemy, gain barrier.',
          icon: 'https://render.guildwars2.com/file/DD52420FDE56D4F5480D529F4A966041730054E3/1769971.png'
        },
        {
          id: 2067,
          name: 'Sadistic Searing',
          description: 'Nefarious Favor now burns nearby enemy targets.',
          icon: 'https://render.guildwars2.com/file/36B6A2055933F4B47B08260DA104FFD1E46F0E1D/1769966.png'
        },
        {
          id: 2123,
          name: 'Herald of Sorrow',
          description: 'Desert Shroud becomes Sandstorm Shroud.',
          icon: 'https://render.guildwars2.com/file/A4779F3D1924A75A58C0C100E82A0923A46C5CBD/1769968.png'
        }
      ],
      [
        {
          id: 2112,
          name: 'Sand Savant',
          description:
            'Summon only one shade at a time. This greater shade has a modified recharge. Influence a larger area with shade skills. \nA greater shade counts as three shades for related traits.',
          icon: 'https://render.guildwars2.com/file/582722DC2FB1D0004F3E0657E76F3AE6EECCEC52/1769967.png'
        },
        {
          id: 2164,
          name: 'Demonic Lore',
          description:
            'Torment you inflict deals increased damage and causes your foes to burn.\nThis trait can only inflict burning on a particular target once every three seconds. ',
          icon: 'https://render.guildwars2.com/file/C4FD5C32D32EB309F520021BC5140B94DE0A7A3B/1769969.png'
        },
        {
          id: 2080,
          name: 'Desert Empowerment',
          description:
            'Manifest Sand Shade grants a barrier to allies near it. When you apply barrier, grant boons to the affected target.\nThis effect only occurs with barrier from scourge skills and traits.',
          icon: 'https://render.guildwars2.com/file/2459E053ADCC6A6064DD505CC03FEA767D12DBB6/1769970.png'
        }
      ]
    ]
  },
  {
    id: 64,
    name: 'Harbinger',
    elite: true,
    icon: 'https://render.guildwars2.com/file/75B05DF5ED51D0153838EC134CEFCFC80D97DA0E/2479304.png',
    minorTraits: [
      {
        id: 2183,
        name: 'Dark Disciple',
        description:
          'Death Shroud is replaced with Harbinger Shroud, granting powerful offensive skills but leaving you vulnerable to attack.\nAs you remain in Harbinger Shroud, you accumulate stacking Blight.\nBlight decreases your maximum health.',
        icon: 'https://render.guildwars2.com/file/0167422FE0046CCFE6B5CFE05DFC67582A1CA529/2479347.png'
      },
      {
        id: 2186,
        name: 'Alchemic Vigor',
        description: 'Gain increased vitality. Heal each second for each stack of blight you have.',
        icon: 'https://render.guildwars2.com/file/E4DC4795777A0FCDE04FA876526E01BD6A495D25/2479348.png'
      },
      {
        id: 2217,
        name: 'Corrupted Talent',
        description: 'Gain life force when you enter Harbinger Shroud.',
        icon: 'https://render.guildwars2.com/file/38AD2F083072FEB51D780BD0939203BDFD4D0C60/2479349.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2188,
          name: 'Wicked Corruption',
          description:
            'Deal increased strike damage for each stack of blight you have. Critical strikes deal increased damage to targets with torment.',
          icon: 'https://render.guildwars2.com/file/05EEA50A3EB30B33EF1AC84EF0ED0E3A13487871/2479338.png'
        },
        {
          id: 2219,
          name: 'Bolstering Brew',
          description: 'Elixir skills grant protection.',
          icon: 'https://render.guildwars2.com/file/5768D3E9974405C19E04A50D757873FF79F4D02A/2479339.png'
        },
        {
          id: 2185,
          name: 'Septic Corruption',
          description:
            'Deal increased condition damage for each stack of blight you have. Shroud skill 2 also inflicts poison.',
          icon: 'https://render.guildwars2.com/file/4E2E73E9AF1E4A62B5C3AA0818DE383FBFBCFA24/2479340.png'
        }
      ],
      [
        {
          id: 2192,
          name: 'Implacable Foe',
          description:
            'Gain stability and damage reduction when entering Harbinger Shroud. Gain ferocity based on your vitality.',
          icon: 'https://render.guildwars2.com/file/E3ABCC0E40170F08B0BDE72378D200BC06D1AF13/2479341.png'
        },
        {
          id: 2220,
          name: 'Twisted Medicine',
          description:
            'Elixir skills also grant their boons to allies within the elixir impact radius. Gain concentration based on your vitality.',
          icon: 'https://render.guildwars2.com/file/D8652B66081F580A082807C9DF4E743A75D038FF/2479342.png'
        },
        {
          id: 2209,
          name: 'Dark Gunslinger',
          description: 'Pistol skills gain reduced recharge. Gain expertise based on your vitality.',
          icon: 'https://render.guildwars2.com/file/FEA2C4067D1E1B4167FEBE0A186F75701E651B5A/2479343.png'
        }
      ],
      [
        {
          id: 2218,
          name: 'Cascading Corruption',
          description:
            'Gain Cascading Corruption stacks when you consume Blight. When you reach the stack threshold, explode necrotic energy and increase your damage for a duration. Stacks can only be gained in combat and are lost upon leaving combat.',
          icon: 'https://render.guildwars2.com/file/CDF71E71761E7997794E193A97FFC315E36CF1E7/2479344.png'
        },
        {
          id: 2194,
          name: 'Deathly Haste',
          description: 'Grant boons to nearby allies when you enter Harbinger Shroud and when you use Dark Barrage.',
          icon: 'https://render.guildwars2.com/file/7CC30E093EDFC0A3A4F32198B53E729842779AF6/2479345.png'
        },
        {
          id: 2203,
          name: 'Doom Approaches',
          description:
            'Blight reduces more of your health and accumulates faster while in shroud. Your shroud skills are improved.',
          icon: 'https://render.guildwars2.com/file/DDF771C8E5AA242AAEE72BAF26180C6DB4000771/2479346.png'
        }
      ]
    ]
  },
  {
    id: 76,
    name: 'Ritualist',
    elite: true,
    icon: 'https://render.guildwars2.com/file/9064C22D08E4A7686FFB0256DDF42B97055EB144/3679900.png',
    minorTraits: [
      {
        id: 2338,
        name: 'Spawning Power',
        description:
          "Death shroud is replaced with ritualist's shroud. Spirits created by shroud skills will persist until you exit shroud. After performing their initial attack, spirits will periodically attack enemies. Gain access to weapon spells.",
        icon: 'https://render.guildwars2.com/file/34DA7A4732080C2046EABF0665C1EDEFBEAC0A77/3679988.png'
      },
      {
        id: 2371,
        name: 'Boon of Creation',
        description:
          'Gain concentration. Gain life force when you summon a creature.\nSpirits and minions are creatures.',
        icon: 'https://render.guildwars2.com/file/0505292B441441E01D92357A6DB6DBFBBD98BDF6/3679989.png'
      },
      {
        id: 2398,
        name: 'Charged Souls',
        description:
          'Gain access to spirit innervation skills, allowing you to channel energy to your spirits for an additional effect. \nGain life force when you use an innervate skill.',
        icon: 'https://render.guildwars2.com/file/9B099042C2D9ED59E269946CCF2CC104D7C55FC5/3679990.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2327,
          name: 'Wandering Spirits',
          description: 'Spirits teleport to you before they perform their autoattack.',
          icon: 'https://render.guildwars2.com/file/A7BCADD16A9D722876E0C7691C97CFF22209061E/3679979.png'
        },
        {
          id: 2378,
          name: "Spirit's Gift",
          description: 'Heal nearby allies when you summon a creature.\nSpirits and minions are creatures.',
          icon: 'https://render.guildwars2.com/file/55FE1567ACC241C60CE266CFE5742DC2CA2A539D/3679980.png'
        },
        {
          id: 2339,
          name: 'Explosive Growth',
          description:
            'When you summon a creature, deal damage to enemies around that creature.\nSpirits and minions are creatures.',
          icon: 'https://render.guildwars2.com/file/EBEED007E2F92B18B921210ACE261F279329E31F/3679981.png'
        }
      ],
      [
        {
          id: 2384,
          name: "Spirits' Remedy",
          description:
            'Remove conditions from nearby allies when you summon a creature.\nSpirits and minions are creatures.',
          icon: 'https://render.guildwars2.com/file/07310A77945BA85DA3E92640A8B3661DDDDA36FD/3679982.png'
        },
        {
          id: 2405,
          name: 'Empowering Spirits',
          description: 'Grant boons to nearby allies when you summon a spirit.',
          icon: 'https://render.guildwars2.com/file/CB9EA5F92C50D94644E005D76A677E61C917E9DE/3679983.png'
        },
        {
          id: 2421,
          name: "Spirit's Strength",
          description:
            'Your summoned creatures deal more damage and their healing is increased. Spirits and minions are creatures.',
          icon: 'https://render.guildwars2.com/file/2A16D0E19CD2A37945C53B53C04EC7D5D93576AD/3679984.png'
        }
      ],
      [
        {
          id: 2376,
          name: "Wielder's Boon",
          description:
            'Weapon spells remove conditions from affected allies. Affected allies receive the full benefit of weapon spells.',
          icon: 'https://render.guildwars2.com/file/04A0D095F007E2DABC99A5460AF2EA3A4610EA1C/3679985.png'
        },
        {
          id: 2333,
          name: 'Lingering Spirits',
          description:
            "Gain a bonus for each active spirit. Spirits persist when exiting ritualist's shroud but continue to drain life force. Life force that is gained during this time will not be consumed by spirits.",
          icon: 'https://render.guildwars2.com/file/A14721D00D6A034E9EB60BB00F7B1414C118CA06/3679986.png'
        },
        {
          id: 2392,
          name: 'Soul Twisting',
          description: "The first spirit skill you use when entering ritualist's shroud recharges instantly.",
          icon: 'https://render.guildwars2.com/file/FF601244FDFBE87DB102F0CEDAC04D1958BAF60C/3679987.png'
        }
      ]
    ]
  }
];
