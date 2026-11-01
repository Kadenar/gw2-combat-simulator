/** Maintained core and elite trait lines supply trait presentation and selection layout. */
import type { Gw2SpecializationData } from '#gw2/platform/profession-definition/specialization-data-types.js';

export const TRAIT_LINES: readonly Gw2SpecializationData[] = [
  {
    id: 6,
    name: 'Explosives',
    elite: false,
    icon: 'https://render.guildwars2.com/file/7DCC0CC4CE0E550C36F37F65469FF3103E2F2DA5/1011989.png',
    minorTraits: [
      {
        id: 432,
        name: 'Explosive Entrance',
        description:
          'Your first attack when entering combat explodes, dealing damage to nearby foes. This ability refreshes after a dodge roll.',
        icon: 'https://render.guildwars2.com/file/61510F0752BC696F210F92CA0E13AD290F13AD33/2261507.png'
      },
      {
        id: 517,
        name: 'Steel-Packed Powder',
        description: 'Explosions cause vulnerability.',
        icon: 'https://render.guildwars2.com/file/5CE792230BB9F5047F09042D052604E143BBB460/1012352.png'
      },
      {
        id: 429,
        name: 'Shaped Charge',
        description: 'Deal increased strike damage for each stack of vulnerability on your target.',
        icon: 'https://render.guildwars2.com/file/6DA800E25FE446E734FAD0A6E81EB671F596AA79/1012353.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 514,
          name: 'Grenadier',
          description: 'Increase the blast radius of grenades. Using a healing skill casts Lesser Grenade Barrage.',
          icon: 'https://render.guildwars2.com/file/EABE037E9D98A7383A10140DCB0B2853604692DB/1012342.png'
        },
        {
          id: 525,
          name: 'Short Fuse',
          description: 'Gain fury when you hit a foe with an Explosion.',
          icon: 'https://render.guildwars2.com/file/EFF174C315B196D5FE0CA2D6179F92E46695F199/1012347.png'
        },
        {
          id: 1882,
          name: 'Glass Cannon',
          description: 'Strike damage dealt increases when above health threshold.',
          icon: 'https://render.guildwars2.com/file/63B2BD4FCDA047EA740E5DEA0EBF593308320713/1012344.png'
        }
      ],
      [
        {
          id: 482,
          name: 'Aim-Assisted Rocket',
          description:
            'Missile hits launch a rocket at your target. After enough rockets have been fired, an orbital strike is called instead.\nThis trait has an internal cooldown.',
          icon: 'https://render.guildwars2.com/file/284CE83D6CC7169E1B0D045054566E0D0A7D052B/1012345.png'
        },
        {
          id: 1892,
          name: 'Explosive Temper',
          description: 'Explosions grant stacking ferocity when they hit.',
          icon: 'https://render.guildwars2.com/file/273E26303F072C3EEEF0DA25D5ACC1E59AECACF6/2261504.png'
        },
        {
          id: 1944,
          name: 'Blast Shield',
          description: 'Explosive Entrance grants barrier. Gain vitality based on a percentage of your power.',
          icon: 'https://render.guildwars2.com/file/1C2F7B7402980B65D12C60CA52510601ECCCC13C/2261503.png'
        }
      ],
      [
        {
          id: 1541,
          name: 'Grand Entrance',
          description:
            'Explosive Entrance grants you resistance and increased critical-strike chance for a brief duration.',
          icon: 'https://render.guildwars2.com/file/7093569DA52A64BE5C42AE0A0D0A700BAA320C0C/2261505.png'
        },
        {
          id: 505,
          name: 'Shrapnel',
          description: 'Explosions have a chance to cripple and cause bleeding on hit.',
          icon: 'https://render.guildwars2.com/file/74C8E6F334CF6905D1E407473701077C60AFE2B6/1012349.png'
        },
        {
          id: 1947,
          name: 'Big Boomer',
          description:
            'Deal increased strike damage to foes with a lower health percentage than you. Hitting with an Explosion heals you over a few seconds.',
          icon: 'https://render.guildwars2.com/file/0122FE72473C12BA0661EABA18F5B83022066EDB/2261506.png'
        }
      ]
    ]
  },
  {
    id: 21,
    name: 'Tools',
    elite: false,
    icon: 'https://render.guildwars2.com/file/2CBB5AE626A47DF79C9294ECA61D77922A123600/1011993.png',
    minorTraits: [
      {
        id: 1979,
        name: 'Optimized Activation',
        description: 'Using tool belt skills grants vigor.',
        icon: 'https://render.guildwars2.com/file/7351CD5F33E20447E8CC237A1802D801B9AF16DC/1012387.png'
      },
      {
        id: 1872,
        name: 'Mechanized Deployment',
        description:
          'Your tool belt skills gain reduced recharge. Tool belt skills remove conditions.  Engage Photon Forge cannot activate this trait',
        icon: 'https://render.guildwars2.com/file/E4FE930E060A58065801CD1073F234CB5913B632/1012388.png'
      },
      {
        id: 1936,
        name: 'Excessive Energy',
        description: 'Strike damage dealt is increased while you have vigor.',
        icon: 'https://render.guildwars2.com/file/B9CAA4643E9B7BD8CF7D61F67CB7C2C8F3FCEE07/1012389.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 532,
          name: 'Static Discharge',
          description: 'Discharge a bolt of lightning whenever you use a tool belt skill.',
          icon: 'https://render.guildwars2.com/file/0A376A98B571BCD3DAB7CD0C51343C3921AB0C34/1012378.png'
        },
        {
          id: 1997,
          name: 'Reactive Lenses',
          description: 'Activate Lesser Utility Goggles after using a healing skill.',
          icon: 'https://render.guildwars2.com/file/9DFA2D5E0C5E0EBBC0CD011E1FC6181F6D9ED5CC/1012379.png'
        },
        {
          id: 531,
          name: 'Power Wrench',
          description: 'Reduce the recharge of your elite skill when you dodge.',
          icon: 'https://render.guildwars2.com/file/061229B53180B6E8E7B83EFEA665DF4B6256C392/1012380.png'
        }
      ],
      [
        {
          id: 512,
          name: 'Streamlined Kits',
          description: 'Equipping an Engineering Kit creates an attack or spell and grants you swiftness.',
          icon: 'https://render.guildwars2.com/file/EC0C31050CE77F71097109B9BFE466016F9CFBEF/1012381.png'
        },
        {
          id: 1946,
          name: 'Lock On',
          description:
            'Striking a stealthed foe triggers Invisible Analysis.\nDisabling a foe triggers Controlled Analysis.\nDisables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.',
          icon: 'https://render.guildwars2.com/file/CA19315C752AED07407344A15FA3DCDE47064473/1012382.png'
        },
        {
          id: 1832,
          name: 'Takedown Round',
          description: 'Deal increased strike damage while your endurance is not full.',
          icon: 'https://render.guildwars2.com/file/C24DFF8043B5D202E97C059BCBACD5B1F055C950/1012383.png'
        }
      ],
      [
        {
          id: 1856,
          name: 'Kinetic Battery',
          description:
            'Gain kinetic charges when you use a tool belt skill. At maximum, charges gain a burst of speed.',
          icon: 'https://render.guildwars2.com/file/1BE44A22FD664209636ED7E30ACF241B782E6C01/1012384.png'
        },
        {
          id: 523,
          name: 'Adrenal Implant',
          description:
            'Endurance regeneration is increased. Reduce the recharge of your tool belt skills when you dodge.',
          icon: 'https://render.guildwars2.com/file/DCCFFD80BF91F61BFAD58019AFF733010D07057D/1012385.png'
        },
        {
          id: 1679,
          name: 'Gadgeteer',
          description: 'Gadget skills are more powerful.',
          icon: 'https://render.guildwars2.com/file/09AF0498D757B191E229C862F4AA360DA65C4FE1/1012386.png'
        }
      ]
    ]
  },
  {
    id: 29,
    name: 'Alchemy',
    elite: false,
    icon: 'https://render.guildwars2.com/file/2AD4CD9B66F349A6CBC006A14848CF531E97396D/1011988.png',
    minorTraits: [
      {
        id: 468,
        name: 'Hidden Flask',
        description: 'Drink a Lesser Elixir B when struck while below the health threshold.',
        icon: 'https://render.guildwars2.com/file/BB282B54755A3F4FE44C233E9FABEEF63E399E65/1012339.png'
      },
      {
        id: 487,
        name: 'Transmute',
        description: 'Drink a Lesser Elixir C when you use a healing skill.',
        icon: 'https://render.guildwars2.com/file/64CA679CD71A9C790E41091135A80B74A6E0D852/1012340.png'
      },
      {
        id: 413,
        name: 'Compounding Chemicals',
        description:
          'Heal yourself when you grant yourself a boon. Remove a condition from yourself when you use an elixir skill. Gain increased concentration.',
        icon: 'https://render.guildwars2.com/file/D40DB82F69C6750822C6750A9705ECFA4051B64B/1012341.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 396,
          name: 'Invigorating Speed',
          description: 'When you gain swiftness or superspeed, you also gain vigor.',
          icon: 'https://render.guildwars2.com/file/75974EF47C793B5EFA60E0BFF20BC12F807F02D0/1012330.png'
        },
        {
          id: 509,
          name: 'Protection Injection',
          description:
            'Gain protection when you are disabled.\nDisables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.',
          icon: 'https://render.guildwars2.com/file/B6B62423EB4608C40DA2E54E32129163062BEAF1/1012331.png'
        },
        {
          id: 521,
          name: 'Health Insurance',
          description:
            'Increase your incoming healing effectiveness. Gain increased healing to others while using a med kit.',
          icon: 'https://render.guildwars2.com/file/2816FDC0BB196C164646425734AB9205A2750A95/1012332.png'
        }
      ],
      [
        {
          id: 520,
          name: 'Comeback Cure',
          description: 'Grant regeneration when you remove a condition from an ally.',
          icon: 'https://render.guildwars2.com/file/4DD098F8B129450B9822DCDA9295B771EA4B930A/1938784.png'
        },
        {
          id: 469,
          name: 'Boiling Point',
          description: 'Gain fury when you gain might at or above the threshold.',
          icon: 'https://render.guildwars2.com/file/579677B8DEFE6F30C2B81E7A6E9968E866917CBA/1012334.png'
        },
        {
          id: 470,
          name: 'Blast Zone',
          description:
            "Create a blast finisher at your location when you use a healing skill's associated tool belt skill.",
          icon: 'https://render.guildwars2.com/file/C971920D6D5A5A66BECBD361B0B118E20AB1FCC4/1012335.png'
        }
      ],
      [
        {
          id: 473,
          name: 'HGH',
          description: 'Elixirs gain increased durations and grant might.',
          icon: 'https://render.guildwars2.com/file/C033BD736665A3C2514027E13F750896F594BC42/1012336.png'
        },
        {
          id: 1871,
          name: 'Equal and Opposite Reaction',
          description: 'Gain quickness and stability when you disable an enemy.',
          icon: 'https://render.guildwars2.com/file/7A10C8FD41FC925B49BD4EAB5FD93C9AF816C123/1938785.png'
        },
        {
          id: 1854,
          name: 'Chain Reactivity',
          description:
            'Gain barrier when you successfully finish a combo field with a leap or a blast. Every third successful finish grants you might and a larger barrier that is shared with allies.',
          icon: 'https://render.guildwars2.com/file/09CAECBD623B9DD4BB97E24795B99B27EC0240EC/1012338.png'
        }
      ]
    ]
  },
  {
    id: 38,
    name: 'Firearms',
    elite: false,
    icon: 'https://render.guildwars2.com/file/67A2C92B59BC94EDD3D857C2DD18E1A02A631F98/1011990.png',
    minorTraits: [
      {
        id: 515,
        name: 'Serrated Steel',
        description: 'Critical hits have a chance to cause bleeding. Bleeding you inflict gains increased duration.',
        icon: 'https://render.guildwars2.com/file/1A6944F7ABE9BA53DF50ED07A20D5B00FFBBB075/1012365.png'
      },
      {
        id: 536,
        name: 'Hematic Focus',
        description: 'Gain fury when you inflict bleeding on an enemy. Fury gives an increased critical-strike chance.',
        icon: 'https://render.guildwars2.com/file/4E47135C80F9315B0EFF67B1A25331E4BAB60D7E/1012364.png'
      },
      {
        id: 516,
        name: 'Modified Ammunition',
        description: 'Deal increased strike damage for each unique condition on a foe.',
        icon: 'https://render.guildwars2.com/file/4157A498F471AE4569F148A6A438C1444B1C7AE9/1012363.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1878,
          name: 'Chemical Rounds',
          description: 'Gain condition damage. Your pistol skills gain increased condition duration.',
          icon: 'https://render.guildwars2.com/file/954B6424697BCA5574FE781C46A0954E0B9F6AE9/1012354.png'
        },
        {
          id: 1930,
          name: 'Sanguine Array',
          description: 'Gain might when you inflict bleeding on a foe.',
          icon: 'https://render.guildwars2.com/file/0D44F9A20414755907FF6C91721AC49CB1AC5E30/1012355.png'
        },
        {
          id: 1914,
          name: 'High Caliber',
          description: 'You have an increased critical hit chance against foes within the range threshold.',
          icon: 'https://render.guildwars2.com/file/BA01D09FE6ADFCF4BCC0B7BF061FC8A506BE4C4E/1012356.png'
        }
      ],
      [
        {
          id: 1984,
          name: 'Juggernaut',
          description:
            'Gain might while wielding a flamethrower. Might applied to you gains increased duration. Napalm grants you stability and a fire aura.',
          icon: 'https://render.guildwars2.com/file/374A7E3227C94B57047A78A8079F07C090D3CE6E/1012360.png'
        },
        {
          id: 2006,
          name: 'Thermal Vision',
          description: 'Gain expertise. Increase your outgoing condition damage when you inflict burning.',
          icon: 'https://render.guildwars2.com/file/F806ACB6130CED2DACC9DD804E4303327073385A/1012358.png'
        },
        {
          id: 1923,
          name: 'No Scope',
          description:
            'Critical hits on foes within the range threshold have a chance to grant fury. Fury grants you ferocity.',
          icon: 'https://render.guildwars2.com/file/BDE5F642B025FACD7B44D9599822CBF80DA6F257/1012359.png'
        }
      ],
      [
        {
          id: 510,
          name: 'Heavy Metal',
          description:
            'Your critical-strike chance and critical damage are increased against foes that are below the health threshold.',
          icon: 'https://render.guildwars2.com/file/68380515301D93ABD5E7A4C89748F80CD819EB3F/1012357.png'
        },
        {
          id: 526,
          name: 'Sharpshooter',
          description: 'Bleeding you inflict scales off of your power instead of your condition damage.',
          icon: 'https://render.guildwars2.com/file/EE70DAF7410E00259CA9426E770551D7BF017F09/1012361.png'
        },
        {
          id: 433,
          name: 'Incendiary Powder',
          description: 'Burning you inflict lasts longer, and your critical hits inflict burning.',
          icon: 'https://render.guildwars2.com/file/0D467BCA43AF4EFF9EE7CDAAB1A15696CE5B54AF/1012362.png'
        }
      ]
    ]
  },
  {
    id: 43,
    name: 'Scrapper',
    elite: true,
    icon: 'https://render.guildwars2.com/file/FEB1B8C559DDB5A04F9C0579F741080259FEF841/1011991.png',
    minorTraits: [
      {
        id: 1959,
        name: 'Function Gyro',
        description:
          'You gain access to the function gyro, which replaces your tool belt skill 5. Gain access to Gyro skills.',
        icon: 'https://render.guildwars2.com/file/62D43252CCF835C6A32113E9BD450A5CAC2E3E1E/1128527.png'
      },
      {
        id: 2014,
        name: 'Speed of Synergy',
        description:
          "Using a heal skill grants superspeed in a radius around you. Using a healing skill's associated tool-belt skill grants you personal superspeed.",
        icon: 'https://render.guildwars2.com/file/9EA1A2AEAEEA679A4038D7A136C1C7B61A08C3C1/2175051.png'
      },
      {
        id: 1877,
        name: 'Impact Savant',
        description: 'A percentage of the strike damage you deal is converted into barrier.',
        icon: 'https://render.guildwars2.com/file/FD7AF757E6B02C7BC55101B0CFDCDAC87E5DBADD/1128528.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1917,
          name: 'Gyroscopic Acceleration',
          description:
            'Well abilities have an increased area of effect and grant superspeed to nearby allies on their first pulse. Your function gyro also grants superspeed to allies when cast.',
          icon: 'https://render.guildwars2.com/file/5B1EDB0BEF3301DDC43849E8EDE83DAC374DF6A5/1128518.png'
        },
        {
          id: 1971,
          name: 'System Shocker',
          description:
            'Disabling a foe grants barrier to nearby allies. Your function gyro dazes foes when cast. \nDisables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.',
          icon: 'https://render.guildwars2.com/file/D218686E042F19144D99A11F7205FB4763D053EF/2175050.png'
        },
        {
          id: 1867,
          name: 'Mass Momentum',
          description: 'Gain might while you have stability. Your Function Gyro applies stability to allies when cast.',
          icon: 'https://render.guildwars2.com/file/70281123EA553434A55F56E9F1D43F90E0CE22D2/1128526.png'
        }
      ],
      [
        {
          id: 1954,
          name: 'Rapid Regeneration',
          description: 'Regenerate health while affected by swiftness or superspeed.',
          icon: 'https://render.guildwars2.com/file/45FD994928E2247E2C80E42B3FF3B7F5EB280FC7/2983334.png'
        },
        {
          id: 1999,
          name: 'Expert Examination',
          description:
            "Your function gyro grants protection to allies when cast. Using a healing skill's associated toolbelt skill grants protection to nearby allies.",
          icon: 'https://render.guildwars2.com/file/B62C0756B53D65A109E64863BC42F958DB6FDA93/1128522.png'
        },
        {
          id: 1860,
          name: 'Object in Motion',
          description:
            'Deal increased strike damage while you have stability, swiftness, or superspeed. This damage increase compounds for each boon you have.',
          icon: 'https://render.guildwars2.com/file/FA6A0040D703B2FBF19B4592A63F3D7C2555FE02/2175049.png'
        }
      ],
      [
        {
          id: 1981,
          name: 'Ex Machina',
          description:
            'Function gyro has additional charges, no longer has a recharge penalty, and grants barrier to nearby allies.',
          icon: 'https://render.guildwars2.com/file/10FEBEDA19B34AFB7E45AE0801B83220F7ECC441/3240356.png'
        },
        {
          id: 2052,
          name: 'Kinetic Accelerators',
          description:
            'Grant boons to nearby allies when you successfully combo a field with a blast, leap, or whirl finisher. Your function gyro is now a blast finisher.\nWhirl finishers can only trigger this trait once per interval.',
          icon: 'https://render.guildwars2.com/file/7BC1F016DDD40D589CC4AF9A35E9A7490A0DE81A/1128520.png'
        },
        {
          id: 1849,
          name: 'Applied Force',
          description: 'Gain stability when you gain might at or above the threshold. Might grants bonus power.',
          icon: 'https://render.guildwars2.com/file/D1E27896EB409E1BF231CE1EB8090C60546D60C4/1128525.png'
        }
      ]
    ]
  },
  {
    id: 47,
    name: 'Inventions',
    elite: false,
    icon: 'https://render.guildwars2.com/file/91F9AF48FA1DDEB66A449095A4E1A6E901AE203D/1011992.png',
    minorTraits: [
      {
        id: 518,
        name: 'Cleansing Synergy',
        description: 'Using a heal skill triggers a cleansing pulse around you.',
        icon: 'https://render.guildwars2.com/file/637B6BDF42FB6C3F5C91992CBF71745DC0FEE6E2/1012375.png'
      },
      {
        id: 508,
        name: 'Reconstruction Enclosure',
        description: 'Grant protection to nearby allies when you use a heal skill.',
        icon: 'https://render.guildwars2.com/file/6A76E8D3262097AFFADB54DD3C9FE4F93DBC1C5E/1012376.png'
      },
      {
        id: 519,
        name: 'Energy Amplifier',
        description: 'Your power and healing power are increased while you have regeneration.',
        icon: 'https://render.guildwars2.com/file/9B0BA7E593FB0AEA330E4971DBA5632375391E6C/1012377.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 394,
          name: 'Over Shield',
          description:
            'Shield skills grant protection to nearby allies. Protection on you gains increased damage reduction.',
          icon: 'https://render.guildwars2.com/file/F90CB6E3E23B6ECB761C062D92507799694CF4D2/1012366.png'
        },
        {
          id: 1901,
          name: 'Automated Medical Response',
          description: "Grant regeneration to nearby allies when you use a healing skill's associated tool belt skill.",
          icon: 'https://render.guildwars2.com/file/F1660BB6D1DD0CBAEE97C46A6856BA072D2A6464/1012367.png'
        },
        {
          id: 507,
          name: 'Sapping Device',
          description:
            'Weaken enemies when you disable or immobilize them. Disables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.',
          icon: 'https://render.guildwars2.com/file/5580D97E0BC8B7AD57783CAD2CE6E64F0F3AD45F/1012368.png'
        }
      ],
      [
        {
          id: 1678,
          name: 'Experimental Turrets',
          description:
            'Turrets. Turrets create a reflective barrier when built and grant boons to allies around them on a regular interval.',
          icon: 'https://render.guildwars2.com/file/BED3FAAEBD083392DD9F6E48C657AEC19AA43D33/1012369.png'
        },
        {
          id: 1834,
          name: 'Soothing Detonation',
          description: 'Heal nearby allies when using a tool belt skill.',
          icon: 'https://render.guildwars2.com/file/5E0C5F9FBA57D5C80109241602BE4A76A917A708/1012370.png'
        },
        {
          id: 445,
          name: 'Mecha Legs',
          description: 'Gain resistance when you dodge.',
          icon: 'https://render.guildwars2.com/file/4D2DE7CDF20239FCA2905CBAC91FC461FB0EF6A2/1012371.png'
        }
      ],
      [
        {
          id: 472,
          name: 'Anticorrosion Plating',
          description: 'When you grant protection to an ally, cleanse conditions from them.',
          icon: 'https://render.guildwars2.com/file/A169390B67F8133D4BC7DE4767DEF6357DBC08B2/1938786.png'
        },
        {
          id: 1680,
          name: 'Bunker Down',
          description:
            "Create a proximity mine at your target's location and a med kit at your location when you disable an enemy.",
          icon: 'https://render.guildwars2.com/file/6EABBE9E7D25709058EF66CC593E4BC8F903A83F/1012373.png'
        },
        {
          id: 1916,
          name: 'Medical Dispersion Field',
          description:
            'While in combat, a percentage of healing you apply to yourself is stored by your Medical Dispersion Field. Each interval, stored healing is spent to heal nearby allies.',
          icon: 'https://render.guildwars2.com/file/4B4FA8FEC9F830DC75F8D1532AE6490B09326D98/1012374.png'
        }
      ]
    ]
  },
  {
    id: 57,
    name: 'Holosmith',
    elite: true,
    icon: 'https://render.guildwars2.com/file/F41CDEE4603FC0741669A7F2A7E977D36123DF7C/1769889.png',
    minorTraits: [
      {
        id: 2158,
        name: 'Photon Projector',
        description: 'Photon Forge replaces your tool belt skill 5. Gain access to Exceed skills.',
        icon: 'https://render.guildwars2.com/file/5E01A22E14BB552CCEB5B5E99417DD20D0C45B67/1769936.png'
      },
      {
        id: 2135,
        name: 'Heat Therapy',
        description:
          'Gain health per unit of heat lost.\nThis trait does not function while cooling due to an overheat unless Photonic Blasting Module is equipped.',
        icon: 'https://render.guildwars2.com/file/C1B0A2466701BF6CB45176D967D5C29B940F6397/1769937.png'
      },
      {
        id: 2122,
        name: "Laser's Edge",
        description:
          'While Photon Forge is active, your outgoing strike damage is increased based on your current heat.',
        icon: 'https://render.guildwars2.com/file/0D5D9B2C77B736E0609004026A06756D5142690B/1769938.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2114,
          name: 'Light Density Amplifier',
          description: 'Photon Forge reduces incoming damage but has increased passive heat generation.',
          icon: 'https://render.guildwars2.com/file/3994F02CE07262B156C90E9143F2720ADF2DB0FD/1769927.png'
        },
        {
          id: 2157,
          name: 'Prismatic Converter',
          description: 'Deactivate Photon Forge converts conditions into boons based on your heat level.',
          icon: 'https://render.guildwars2.com/file/DC0BB7751AFC3CC425E66E774179F00B9C3C9E29/1769928.png'
        },
        {
          id: 2106,
          name: 'Solar Focusing Lens',
          description:
            'Your first few attacks after entering or exiting Photon Forge inflict burning and deal increased strike damage. This bonus is also granted if you overheat.',
          icon: 'https://render.guildwars2.com/file/19FE5C016ACFF174DE03752D40D202F9B75FB0C2/1769929.png'
        }
      ],
      [
        {
          id: 2103,
          name: 'Crystal Configuration: Storm',
          description: 'Photon Forge skill 1 now fires explosive projectiles, but generates extra heat.',
          icon: 'https://render.guildwars2.com/file/E9E927D85AAEB368805AA8F2D2A4BE32B6C6A507/1769930.png'
        },
        {
          id: 2152,
          name: 'Crystal Configuration: Eclipse',
          description: 'Corona Burst grants a barrier for each target struck.',
          icon: 'https://render.guildwars2.com/file/7C0E6BD391C3D0CCEEC9BD1B0796A0355C075755/1769931.png'
        },
        {
          id: 2091,
          name: 'Crystal Configuration: Zephyr',
          description:
            'Holo Leap removes movement-impairing conditions, grants superspeed instead of swiftness, and inflicts cripple.',
          icon: 'https://render.guildwars2.com/file/73D708B30A589E3AE2E3141B327B4616B9CC663F/1769932.png'
        }
      ],
      [
        {
          id: 2066,
          name: 'Thermal Release Valve',
          description:
            'Dodge rolling vents heat as an attack against nearby foes and grants vigor.\n(Attack will not occur without heat.)',
          icon: 'https://render.guildwars2.com/file/051954D32BCDA37DEAA1730C9CF09CAEF22F9FB3/1769933.png'
        },
        {
          id: 2137,
          name: 'Enhanced Capacity Storage Unit',
          description:
            'Increases maximum heat capacity. While above 100% heat, periodically gain might. Some skills and traits gain additional heat tiers.',
          icon: 'https://render.guildwars2.com/file/5DE502FD03496B4DF70A0CDA1616022B602A049B/1769934.png'
        },
        {
          id: 2064,
          name: 'Photonic Blasting Module',
          description:
            'Overheat now blasts damage to nearby foes and no longer deals its initial damage to you. The tool belt recharge penalty for Overheat is reduced. Heat can only be lost after overheating.\nDamage over time from Overheat is still applied.',
          icon: 'https://render.guildwars2.com/file/580C8052ABEA092722A3026D54B12BA0AA1DCD14/1769935.png'
        }
      ]
    ]
  },
  {
    id: 70,
    name: 'Mechanist',
    elite: true,
    icon: 'https://render.guildwars2.com/file/F86CDF34404C0B5A01CD0CBB9D7D0DC1D8CC48CF/2503608.png',
    minorTraits: [
      {
        id: 2291,
        name: 'Mechanical Genius',
        description:
          'Through your mechanical genius, you have utilized Canthan jade technology to build a customized battle mech that will fight at your side.\nYour mech inherits a percentage of all of your combat attributes except precision, which is added to its own. \nYour tool belt skills are replaced with Mech Commands, customized by your trait choices. Mech Commands take longer to recharge when using them far away from your mech. \nGain access to signet utility skills.',
        icon: 'https://render.guildwars2.com/file/E56C575C4703F3377FA8BE172656ABEA6B92DE4E/2503629.png'
      },
      {
        id: 2266,
        name: 'Mech Fighter',
        description:
          'New combat subroutines enable your mech to use Rocket Punch when you activate Skill 3 on your equipped weapon. Your mech gains a greater percentage of your own toughness and vitality stats.',
        icon: 'https://render.guildwars2.com/file/170C6CC908E405F57A20019A5BB3D113F13359E5/2503630.png'
      },
      {
        id: 2267,
        name: 'Exigency Protocols',
        description:
          'When your mech is struck while under half health, it activates Exigency Protocols, gaining damage reduction and regeneration for a short duration. Regeneration boons you apply are stronger.',
        icon: 'https://render.guildwars2.com/file/D303A429CCF6B672E66DA12DD014FEF8A80335E7/2503631.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2282,
          name: 'Mech Arms: Single-Edge Cutters',
          description:
            "Unlocks the Mech Command skill Rolling Smash. Your mech's attacks apply bleeding. This effect may only affect a given target once per interval.",
          icon: 'https://render.guildwars2.com/file/F035B89A374E0754AC089BC7C1E90F68A2F0EEEC/2503620.png'
        },
        {
          id: 2296,
          name: 'Mech Arms: High-Impact Drivers',
          description:
            "Unlocks the Mech Command skill Explosive Knuckle. Your mech's attacks now generate might for allies within a radius. This effect may only occur once per interval.\n\nThe mech does not count against the target count for this trait.",
          icon: 'https://render.guildwars2.com/file/2542CD9B2273C1EE29F306ED9B6FC0E0A92C7F02/2503621.png'
        },
        {
          id: 2279,
          name: 'Mech Arms: Jade Cannons',
          description:
            'Melee attacks become ranged, have an increased chance to critically hit, and apply vulnerability. Unlocks the Mech Command skill Spark Revolver.\n',
          icon: 'https://render.guildwars2.com/file/73600241FA662501C5D617719A7B4792F30B2846/2503622.png'
        }
      ],
      [
        {
          id: 2270,
          name: 'Mech Frame: Conductive Alloys',
          description:
            'Unlocks the Mech Command skill Discharge Array. Your mech gains a greater percentage of your own condition damage and expertise stats.',
          icon: 'https://render.guildwars2.com/file/F45967B8DC5F20476780D493FB79B4991822CF5E/2503623.png'
        },
        {
          id: 2276,
          name: 'Mech Frame: Channeling Conduits',
          description:
            'Unlocks the Mech Command skill Crisis Zone. When you or your mech apply barrier, also grant a boon to the affected target. Your mech gains a greater percentage of your own concentration and healing power stats.',
          icon: 'https://render.guildwars2.com/file/EA4C0233E57A24A4C4417C0CC955B2D8C12D5B34/2503625.png'
        },
        {
          id: 2294,
          name: 'Mech Frame: Variable Mass Distributor',
          description:
            'Unlocks the Mech Command skill Core Reactor Shot. Your mech gains a greater percentage of your own precision stats.',
          icon: 'https://render.guildwars2.com/file/715CE76B90B40EE7E30AE1D1FA3F7432D30C5D94/2503624.png'
        }
      ],
      [
        {
          id: 2292,
          name: 'Mech Core: Jade Dynamo',
          description:
            'Unlocks the Mech Command skill Jade Mortar. Mech Command skills grant you quickness when used and have a reduced cooldown.',
          icon: 'https://render.guildwars2.com/file/521FEBAE995F2BFB38F9EF3176DBDCFC075173F4/2503626.png'
        },
        {
          id: 2281,
          name: 'Mech Core: Barrier Engine',
          description:
            'Unlocks the Mech Command skill Barrier Burst. While in combat, your mech will automatically grant a small barrier each interval to nearby allies.\n\nThe mech does not count against the target count for this trait.',
          icon: 'https://render.guildwars2.com/file/EEE0C0D90EB9E244B3F11BA0AF7C77E3D83AF576/2503627.png'
        },
        {
          id: 2298,
          name: 'Mech Core: J-Drive',
          description:
            'Gain access to the Mech Command skill Sky Circus. While dismissed or away for repairs, your mech supports you with an occasional aerial bombardment.\nSignet skills gain improved passive effects and continue to grant their passive bonuses while recharging.',
          icon: 'https://render.guildwars2.com/file/0DB4530703CE745B0E15A56609BCCA21CC649837/2503628.png'
        }
      ]
    ]
  },
  {
    id: 75,
    name: 'Amalgam',
    elite: true,
    icon: 'https://render.guildwars2.com/file/67AA599996662C5BA8427FA7BA6FF8B4ED221B0D/3679897.png',
    minorTraits: [
      {
        id: 2377,
        name: 'Experimental Union',
        description:
          'Through asuran ingenuity, you are host to a mercurial mold. You are able to command it using selectable morph skills that replace your toolbelt skills or even fully merge with it to evolve into a superior being.\nMorph skills selected will alter the composition of the mercurial mold, changing the bonuses it grants you when you evolve.\nGain access to stance utility skills.',
        icon: 'https://render.guildwars2.com/file/389B4548DDBC08AEA668F3AF1802394E0955B591/3679952.png'
      },
      {
        id: 2389,
        name: 'Hybrid Vigor',
        description: 'Gain vitality. Gain barrier when you use a morph skill.',
        icon: 'https://render.guildwars2.com/file/69F518AF096998F9B127C7CB1C05EA7348D170C7/3679953.png'
      },
      {
        id: 2356,
        name: 'Willing Host',
        description: 'Using a morph skill increases your damage for a duration.',
        icon: 'https://render.guildwars2.com/file/49DEE2C90E04E876DE2517C201060E330A7D9FDE/3679954.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2366,
          name: 'Stainless Steel',
          description: 'Convert conditions to boons when you use a stance skill or evolve.',
          icon: 'https://render.guildwars2.com/file/C280022834C550F145319BE3AC0401EB3D9B92CE/3679943.png'
        },
        {
          id: 2395,
          name: 'Innervating Alloy',
          description: 'Heal every second while you have barrier. Heal when you evolve.',
          icon: 'https://render.guildwars2.com/file/0AB2B3EE2E255AD7A766F93D7BE0A0AD59CF6637/3679944.png'
        },
        {
          id: 2434,
          name: 'Hardened Chrome',
          description: 'Morph skills and evolving grant protection to yourself.',
          icon: 'https://render.guildwars2.com/file/2FB406D8030E90F0AAB8AF487E0276F023140BE9/3679945.png'
        }
      ],
      [
        {
          id: 2383,
          name: 'Carbolic Composition',
          description: 'Amalgam skills inflict poison on hit. Poison you inflict lasts longer.',
          icon: 'https://render.guildwars2.com/file/9D0E774CFF5A9FD6C8739DD5D9EBEB3D270CACF6/3679946.png'
        },
        {
          id: 2420,
          name: 'Mercurial Tendencies',
          description: 'Disabling an enemy reduces the cooldown of Evolve.',
          icon: 'https://render.guildwars2.com/file/B2CBCEF3DACEECD7BFBBD1CF946AD1CBFF0AD866/3679947.png'
        },
        {
          id: 2349,
          name: 'Silver Lining',
          description: 'Evolve no longer inherits bonuses from strains. Morph skills grant their strain bonuses.',
          icon: 'https://render.guildwars2.com/file/EBC7B54429A00A7C1CB021A2EF7B470E7831B064/3679948.png'
        }
      ],
      [
        {
          id: 2406,
          name: 'Symbiotic Synergy',
          description: 'Evolve recharges morph skills. Morph skills deal increased strike damage.',
          icon: 'https://render.guildwars2.com/file/457A0302F976CCF42D065D0E01DD08390666DFCD/3679949.png'
        },
        {
          id: 2387,
          name: 'New Genes',
          description:
            'Morph skills grant boons to allies. Grant an additional boon based on which morph skill was used.',
          icon: 'https://render.guildwars2.com/file/B6E5BA5FF8F4179F2521F61696EEC3D7DEE50F07/3679950.png'
        },
        {
          id: 2334,
          name: 'Double Helix',
          description: 'Evolve has two charges and grants an increased attribute bonus.',
          icon: 'https://render.guildwars2.com/file/000E5AC3B7BE616A329F46ECAD06EB07507ADF73/3679951.png'
        }
      ]
    ]
  }
];
