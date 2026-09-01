// Generated Guild Wars 2 API metadata for engineer.
// Snapshot: 2026-07-28. Run npm run update:profession-data -- --profession Engineer to refresh.
// Simulator mechanics are maintained under engineer/core/ and engineer/specializations/.

import type { Gw2ApiSpecialization, Gw2ApiTrait } from '#gw2/integrations/patches/authoring/api-metadata-types.js';
import type { EngineerSkill } from '#gw2/content/professions/engineer/types.js';

export type EngineerApiTrait = Gw2ApiTrait;
export type EngineerApiSpecialization = Gw2ApiSpecialization;

export const DATA_SNAPSHOT: string = '2026-07-28';
export const SPECIALIZATIONS: readonly EngineerApiSpecialization[] = [
  {
    id: 6,
    name: 'Explosives',
    elite: false,
    icon: 'https://render.guildwars2.com/file/7DCC0CC4CE0E550C36F37F65469FF3103E2F2DA5/1011989.png',
    background: 'https://render.guildwars2.com/file/159455B54672DF9C9BEEC2EB13E05DB07E757E02/1012041.png',
    minorTraits: [
      {
        id: 432,
        name: 'Explosive Entrance',
        description:
          'Your first attack when entering combat explodes, dealing damage to nearby foes. This ability refreshes after a dodge roll.',
        icon: 'https://render.guildwars2.com/file/61510F0752BC696F210F92CA0E13AD290F13AD33/2261507.png',
        specialization: 'Explosives',
        tier: 1,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 517,
        name: 'Steel-Packed Powder',
        description: '<c=@abilitytype>Explosions</c> cause vulnerability.',
        icon: 'https://render.guildwars2.com/file/5CE792230BB9F5047F09042D052604E143BBB460/1012352.png',
        specialization: 'Explosives',
        tier: 2,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 429,
        name: 'Shaped Charge',
        description: 'Deal increased strike damage for each stack of vulnerability on your target.',
        icon: 'https://render.guildwars2.com/file/6DA800E25FE446E734FAD0A6E81EB671F596AA79/1012353.png',
        specialization: 'Explosives',
        tier: 3,
        position: 0,
        slot: 'Minor'
      }
    ],
    majorTraits: [
      [
        {
          id: 514,
          name: 'Grenadier',
          description: 'Increase the blast radius of grenades. Using a healing skill casts Lesser Grenade Barrage.',
          icon: 'https://render.guildwars2.com/file/EABE037E9D98A7383A10140DCB0B2853604692DB/1012342.png',
          specialization: 'Explosives',
          tier: 1,
          position: 1,
          slot: 'Major'
        },
        {
          id: 525,
          name: 'Short Fuse',
          description: 'Gain fury when you hit a foe with an <c=@abilitytype>Explosion</c>.',
          icon: 'https://render.guildwars2.com/file/EFF174C315B196D5FE0CA2D6179F92E46695F199/1012347.png',
          specialization: 'Explosives',
          tier: 1,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1882,
          name: 'Glass Cannon',
          description: 'Strike damage dealt increases when above health threshold.',
          icon: 'https://render.guildwars2.com/file/63B2BD4FCDA047EA740E5DEA0EBF593308320713/1012344.png',
          specialization: 'Explosives',
          tier: 1,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 482,
          name: 'Aim-Assisted Rocket',
          description:
            'Missile hits launch a rocket at your target. After enough rockets have been fired, an orbital strike is called instead.<br><c=@reminder>This trait has an internal cooldown.</c>',
          icon: 'https://render.guildwars2.com/file/284CE83D6CC7169E1B0D045054566E0D0A7D052B/1012345.png',
          specialization: 'Explosives',
          tier: 2,
          position: 1,
          slot: 'Major'
        },
        {
          id: 1892,
          name: 'Explosive Temper',
          description: '<c=@abilitytype>Explosions</c> grant stacking ferocity when they hit.',
          icon: 'https://render.guildwars2.com/file/273E26303F072C3EEEF0DA25D5ACC1E59AECACF6/2261504.png',
          specialization: 'Explosives',
          tier: 2,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1944,
          name: 'Blast Shield',
          description: 'Explosive Entrance grants barrier. Gain vitality based on a percentage of your power.',
          icon: 'https://render.guildwars2.com/file/1C2F7B7402980B65D12C60CA52510601ECCCC13C/2261503.png',
          specialization: 'Explosives',
          tier: 2,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 1541,
          name: 'Grand Entrance',
          description:
            'Explosive Entrance grants you resistance and increased critical-strike chance for a brief duration.',
          icon: 'https://render.guildwars2.com/file/7093569DA52A64BE5C42AE0A0D0A700BAA320C0C/2261505.png',
          specialization: 'Explosives',
          tier: 3,
          position: 1,
          slot: 'Major'
        },
        {
          id: 505,
          name: 'Shrapnel',
          description: '<c=@abilitytype>Explosions</c> have a chance to cripple and cause bleeding on hit.',
          icon: 'https://render.guildwars2.com/file/74C8E6F334CF6905D1E407473701077C60AFE2B6/1012349.png',
          specialization: 'Explosives',
          tier: 3,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1947,
          name: 'Big Boomer',
          description:
            'Deal increased strike damage to foes with a lower health percentage than you. Hitting with an <c=@abilitytype>Explosion</c> heals you over a few seconds.',
          icon: 'https://render.guildwars2.com/file/0122FE72473C12BA0661EABA18F5B83022066EDB/2261506.png',
          specialization: 'Explosives',
          tier: 3,
          position: 3,
          slot: 'Major'
        }
      ]
    ]
  },
  {
    id: 21,
    name: 'Tools',
    elite: false,
    icon: 'https://render.guildwars2.com/file/2CBB5AE626A47DF79C9294ECA61D77922A123600/1011993.png',
    background: 'https://render.guildwars2.com/file/4E906A6B625209A213085FD65DB9A4457726759D/1012044.png',
    minorTraits: [
      {
        id: 1979,
        name: 'Optimized Activation',
        description: 'Using tool belt skills grants vigor.',
        icon: 'https://render.guildwars2.com/file/7351CD5F33E20447E8CC237A1802D801B9AF16DC/1012387.png',
        specialization: 'Tools',
        tier: 1,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 1872,
        name: 'Mechanized Deployment',
        description:
          'Your tool belt skills gain reduced recharge. Tool belt skills remove conditions. <c=@reminder> Engage Photon Forge cannot activate this trait</c>',
        icon: 'https://render.guildwars2.com/file/E4FE930E060A58065801CD1073F234CB5913B632/1012388.png',
        specialization: 'Tools',
        tier: 2,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 1936,
        name: 'Excessive Energy',
        description: 'Strike damage dealt is increased while you have vigor.',
        icon: 'https://render.guildwars2.com/file/B9CAA4643E9B7BD8CF7D61F67CB7C2C8F3FCEE07/1012389.png',
        specialization: 'Tools',
        tier: 3,
        position: 0,
        slot: 'Minor'
      }
    ],
    majorTraits: [
      [
        {
          id: 532,
          name: 'Static Discharge',
          description: 'Discharge a bolt of lightning whenever you use a tool belt skill.',
          icon: 'https://render.guildwars2.com/file/0A376A98B571BCD3DAB7CD0C51343C3921AB0C34/1012378.png',
          specialization: 'Tools',
          tier: 1,
          position: 1,
          slot: 'Major'
        },
        {
          id: 1997,
          name: 'Reactive Lenses',
          description: 'Activate Lesser Utility Goggles after using a healing skill.',
          icon: 'https://render.guildwars2.com/file/9DFA2D5E0C5E0EBBC0CD011E1FC6181F6D9ED5CC/1012379.png',
          specialization: 'Tools',
          tier: 1,
          position: 2,
          slot: 'Major'
        },
        {
          id: 531,
          name: 'Power Wrench',
          description: 'Reduce the recharge of your elite skill when you dodge.',
          icon: 'https://render.guildwars2.com/file/061229B53180B6E8E7B83EFEA665DF4B6256C392/1012380.png',
          specialization: 'Tools',
          tier: 1,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 512,
          name: 'Streamlined Kits',
          description:
            'Equipping an <c=@abilitytype>Engineering Kit</c> creates an attack or spell and grants you swiftness.',
          icon: 'https://render.guildwars2.com/file/EC0C31050CE77F71097109B9BFE466016F9CFBEF/1012381.png',
          specialization: 'Tools',
          tier: 2,
          position: 1,
          slot: 'Major'
        },
        {
          id: 1946,
          name: 'Lock On',
          description:
            'Striking a stealthed foe triggers Invisible Analysis.<br>Disabling a foe triggers Controlled Analysis.<br><c=@reminder>Disables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.</c>',
          icon: 'https://render.guildwars2.com/file/CA19315C752AED07407344A15FA3DCDE47064473/1012382.png',
          specialization: 'Tools',
          tier: 2,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1832,
          name: 'Takedown Round',
          description: 'Deal increased strike damage while your endurance is not full.',
          icon: 'https://render.guildwars2.com/file/C24DFF8043B5D202E97C059BCBACD5B1F055C950/1012383.png',
          specialization: 'Tools',
          tier: 2,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 1856,
          name: 'Kinetic Battery',
          description:
            'Gain kinetic charges when you use a tool belt skill. At maximum, charges gain a burst of speed.',
          icon: 'https://render.guildwars2.com/file/1BE44A22FD664209636ED7E30ACF241B782E6C01/1012384.png',
          specialization: 'Tools',
          tier: 3,
          position: 1,
          slot: 'Major'
        },
        {
          id: 523,
          name: 'Adrenal Implant',
          description:
            'Endurance regeneration is increased. Reduce the recharge of your tool belt skills when you dodge.',
          icon: 'https://render.guildwars2.com/file/DCCFFD80BF91F61BFAD58019AFF733010D07057D/1012385.png',
          specialization: 'Tools',
          tier: 3,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1679,
          name: 'Gadgeteer',
          description: '<c=@abilitytype>Gadget</c> skills are more powerful.',
          icon: 'https://render.guildwars2.com/file/09AF0498D757B191E229C862F4AA360DA65C4FE1/1012386.png',
          specialization: 'Tools',
          tier: 3,
          position: 3,
          slot: 'Major'
        }
      ]
    ]
  },
  {
    id: 29,
    name: 'Alchemy',
    elite: false,
    icon: 'https://render.guildwars2.com/file/2AD4CD9B66F349A6CBC006A14848CF531E97396D/1011988.png',
    background: 'https://render.guildwars2.com/file/A89F18BA0F9A53E662BAE3F39C705559A97B407F/1012040.png',
    minorTraits: [
      {
        id: 468,
        name: 'Hidden Flask',
        description: 'Drink a Lesser Elixir B when struck while below the health threshold.',
        icon: 'https://render.guildwars2.com/file/BB282B54755A3F4FE44C233E9FABEEF63E399E65/1012339.png',
        specialization: 'Alchemy',
        tier: 1,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 487,
        name: 'Transmute',
        description: 'Drink a Lesser Elixir C when you use a healing skill.',
        icon: 'https://render.guildwars2.com/file/64CA679CD71A9C790E41091135A80B74A6E0D852/1012340.png',
        specialization: 'Alchemy',
        tier: 2,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 413,
        name: 'Compounding Chemicals',
        description:
          'Heal yourself when you grant yourself a boon. Remove a condition from yourself when you use an <c=@abilitytype>elixir</c> skill. Gain increased concentration.',
        icon: 'https://render.guildwars2.com/file/D40DB82F69C6750822C6750A9705ECFA4051B64B/1012341.png',
        specialization: 'Alchemy',
        tier: 3,
        position: 0,
        slot: 'Minor'
      }
    ],
    majorTraits: [
      [
        {
          id: 396,
          name: 'Invigorating Speed',
          description: 'When you gain swiftness or superspeed, you also gain vigor.',
          icon: 'https://render.guildwars2.com/file/75974EF47C793B5EFA60E0BFF20BC12F807F02D0/1012330.png',
          specialization: 'Alchemy',
          tier: 1,
          position: 1,
          slot: 'Major'
        },
        {
          id: 509,
          name: 'Protection Injection',
          description:
            'Gain protection when you are disabled.<br><c=@reminder>Disables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.',
          icon: 'https://render.guildwars2.com/file/B6B62423EB4608C40DA2E54E32129163062BEAF1/1012331.png',
          specialization: 'Alchemy',
          tier: 1,
          position: 2,
          slot: 'Major'
        },
        {
          id: 521,
          name: 'Health Insurance',
          description:
            'Increase your incoming healing effectiveness. Gain increased healing to others while using a med kit.',
          icon: 'https://render.guildwars2.com/file/2816FDC0BB196C164646425734AB9205A2750A95/1012332.png',
          specialization: 'Alchemy',
          tier: 1,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 520,
          name: 'Comeback Cure',
          description: 'Grant regeneration when you remove a condition from an ally.',
          icon: 'https://render.guildwars2.com/file/4DD098F8B129450B9822DCDA9295B771EA4B930A/1938784.png',
          specialization: 'Alchemy',
          tier: 2,
          position: 1,
          slot: 'Major'
        },
        {
          id: 469,
          name: 'Boiling Point',
          description: 'Gain fury when you gain might at or above the threshold.',
          icon: 'https://render.guildwars2.com/file/579677B8DEFE6F30C2B81E7A6E9968E866917CBA/1012334.png',
          specialization: 'Alchemy',
          tier: 2,
          position: 2,
          slot: 'Major'
        },
        {
          id: 470,
          name: 'Blast Zone',
          description:
            "Create a blast finisher at your location when you use a healing skill's associated tool belt skill.",
          icon: 'https://render.guildwars2.com/file/C971920D6D5A5A66BECBD361B0B118E20AB1FCC4/1012335.png',
          specialization: 'Alchemy',
          tier: 2,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 473,
          name: 'HGH',
          description: '<c=@abilitytype>Elixirs</c> gain increased durations and grant might.',
          icon: 'https://render.guildwars2.com/file/C033BD736665A3C2514027E13F750896F594BC42/1012336.png',
          specialization: 'Alchemy',
          tier: 3,
          position: 1,
          slot: 'Major'
        },
        {
          id: 1871,
          name: 'Equal and Opposite Reaction',
          description: 'Gain quickness and stability when you disable an enemy.',
          icon: 'https://render.guildwars2.com/file/7A10C8FD41FC925B49BD4EAB5FD93C9AF816C123/1938785.png',
          specialization: 'Alchemy',
          tier: 3,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1854,
          name: 'Chain Reactivity',
          description:
            'Gain barrier when you successfully finish a combo field with a leap or a blast. Every third successful finish grants you might and a larger barrier that is shared with allies.',
          icon: 'https://render.guildwars2.com/file/09CAECBD623B9DD4BB97E24795B99B27EC0240EC/1012338.png',
          specialization: 'Alchemy',
          tier: 3,
          position: 3,
          slot: 'Major'
        }
      ]
    ]
  },
  {
    id: 38,
    name: 'Firearms',
    elite: false,
    icon: 'https://render.guildwars2.com/file/67A2C92B59BC94EDD3D857C2DD18E1A02A631F98/1011990.png',
    background: 'https://render.guildwars2.com/file/2A37FAA50318E4BAE2B193D7A1DF30AAFCE7B139/1012042.png',
    minorTraits: [
      {
        id: 515,
        name: 'Serrated Steel',
        description: 'Critical hits have a chance to cause bleeding. Bleeding you inflict gains increased duration.',
        icon: 'https://render.guildwars2.com/file/1A6944F7ABE9BA53DF50ED07A20D5B00FFBBB075/1012365.png',
        specialization: 'Firearms',
        tier: 1,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 536,
        name: 'Hematic Focus',
        description: 'Gain fury when you inflict bleeding on an enemy. Fury gives an increased critical-strike chance.',
        icon: 'https://render.guildwars2.com/file/4E47135C80F9315B0EFF67B1A25331E4BAB60D7E/1012364.png',
        specialization: 'Firearms',
        tier: 2,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 516,
        name: 'Modified Ammunition',
        description: 'Deal increased strike damage for each unique condition on a foe.',
        icon: 'https://render.guildwars2.com/file/4157A498F471AE4569F148A6A438C1444B1C7AE9/1012363.png',
        specialization: 'Firearms',
        tier: 3,
        position: 0,
        slot: 'Minor'
      }
    ],
    majorTraits: [
      [
        {
          id: 1878,
          name: 'Chemical Rounds',
          description: 'Gain condition damage. Your pistol skills gain increased condition duration.',
          icon: 'https://render.guildwars2.com/file/954B6424697BCA5574FE781C46A0954E0B9F6AE9/1012354.png',
          specialization: 'Firearms',
          tier: 1,
          position: 1,
          slot: 'Major'
        },
        {
          id: 1930,
          name: 'Sanguine Array',
          description: 'Gain might when you inflict bleeding on a foe.',
          icon: 'https://render.guildwars2.com/file/0D44F9A20414755907FF6C91721AC49CB1AC5E30/1012355.png',
          specialization: 'Firearms',
          tier: 1,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1914,
          name: 'High Caliber',
          description: 'You have an increased critical hit chance against foes within the range threshold.',
          icon: 'https://render.guildwars2.com/file/BA01D09FE6ADFCF4BCC0B7BF061FC8A506BE4C4E/1012356.png',
          specialization: 'Firearms',
          tier: 1,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 1984,
          name: 'Juggernaut',
          description:
            'Gain might while wielding a flamethrower. Might applied to you gains increased duration. Napalm grants you stability and a fire aura.',
          icon: 'https://render.guildwars2.com/file/374A7E3227C94B57047A78A8079F07C090D3CE6E/1012360.png',
          specialization: 'Firearms',
          tier: 2,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2006,
          name: 'Thermal Vision',
          description: 'Gain expertise. Increase your outgoing condition damage when you inflict burning.',
          icon: 'https://render.guildwars2.com/file/F806ACB6130CED2DACC9DD804E4303327073385A/1012358.png',
          specialization: 'Firearms',
          tier: 2,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1923,
          name: 'No Scope',
          description:
            'Critical hits on foes within the range threshold have a chance to grant fury. Fury grants you ferocity.',
          icon: 'https://render.guildwars2.com/file/BDE5F642B025FACD7B44D9599822CBF80DA6F257/1012359.png',
          specialization: 'Firearms',
          tier: 2,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 510,
          name: 'Heavy Metal',
          description:
            'Your critical-strike chance and critical damage are increased against foes that are below the health threshold.',
          icon: 'https://render.guildwars2.com/file/68380515301D93ABD5E7A4C89748F80CD819EB3F/1012357.png',
          specialization: 'Firearms',
          tier: 3,
          position: 1,
          slot: 'Major'
        },
        {
          id: 526,
          name: 'Sharpshooter',
          description: 'Bleeding you inflict scales off of your power instead of your condition damage.',
          icon: 'https://render.guildwars2.com/file/EE70DAF7410E00259CA9426E770551D7BF017F09/1012361.png',
          specialization: 'Firearms',
          tier: 3,
          position: 2,
          slot: 'Major'
        },
        {
          id: 433,
          name: 'Incendiary Powder',
          description: 'Burning you inflict lasts longer, and your critical hits inflict burning.',
          icon: 'https://render.guildwars2.com/file/0D467BCA43AF4EFF9EE7CDAAB1A15696CE5B54AF/1012362.png',
          specialization: 'Firearms',
          tier: 3,
          position: 3,
          slot: 'Major'
        }
      ]
    ]
  },
  {
    id: 43,
    name: 'Scrapper',
    elite: true,
    icon: 'https://render.guildwars2.com/file/FEB1B8C559DDB5A04F9C0579F741080259FEF841/1011991.png',
    background: 'https://render.guildwars2.com/file/011D6BF69FF9A9F6E3DCBA1197BAA9281067FF01/1128516.png',
    minorTraits: [
      {
        id: 1959,
        name: 'Function Gyro',
        description:
          'You gain access to the function gyro, which replaces your tool belt skill 5. Gain access to <c=@abilitytype>Gyro</c> skills.',
        icon: 'https://render.guildwars2.com/file/62D43252CCF835C6A32113E9BD450A5CAC2E3E1E/1128527.png',
        specialization: 'Scrapper',
        tier: 1,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 2014,
        name: 'Speed of Synergy',
        description:
          "Using a heal skill grants superspeed in a radius around you. Using a healing skill's associated tool-belt skill grants you personal superspeed.",
        icon: 'https://render.guildwars2.com/file/9EA1A2AEAEEA679A4038D7A136C1C7B61A08C3C1/2175051.png',
        specialization: 'Scrapper',
        tier: 2,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 1877,
        name: 'Impact Savant',
        description: 'A percentage of the strike damage you deal is converted into barrier.',
        icon: 'https://render.guildwars2.com/file/FD7AF757E6B02C7BC55101B0CFDCDAC87E5DBADD/1128528.png',
        specialization: 'Scrapper',
        tier: 3,
        position: 0,
        slot: 'Minor'
      }
    ],
    majorTraits: [
      [
        {
          id: 1917,
          name: 'Gyroscopic Acceleration',
          description:
            '<c=@abilitytype>Well</c> abilities have an increased area of effect and grant superspeed to nearby allies on their first pulse. Your function gyro also grants superspeed to allies when cast.',
          icon: 'https://render.guildwars2.com/file/5B1EDB0BEF3301DDC43849E8EDE83DAC374DF6A5/1128518.png',
          specialization: 'Scrapper',
          tier: 1,
          position: 1,
          slot: 'Major'
        },
        {
          id: 1971,
          name: 'System Shocker',
          description:
            'Disabling a foe grants barrier to nearby allies. Your function gyro dazes foes when cast. <br><c=@reminder>Disables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.</c>',
          icon: 'https://render.guildwars2.com/file/D218686E042F19144D99A11F7205FB4763D053EF/2175050.png',
          specialization: 'Scrapper',
          tier: 1,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1867,
          name: 'Mass Momentum',
          description: 'Gain might while you have stability. Your Function Gyro applies stability to allies when cast.',
          icon: 'https://render.guildwars2.com/file/70281123EA553434A55F56E9F1D43F90E0CE22D2/1128526.png',
          specialization: 'Scrapper',
          tier: 1,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 1954,
          name: 'Rapid Regeneration',
          description: 'Regenerate health while affected by swiftness or superspeed.',
          icon: 'https://render.guildwars2.com/file/45FD994928E2247E2C80E42B3FF3B7F5EB280FC7/2983334.png',
          specialization: 'Scrapper',
          tier: 2,
          position: 1,
          slot: 'Major'
        },
        {
          id: 1999,
          name: 'Expert Examination',
          description:
            "Your function gyro grants protection to allies when cast. Using a healing skill's associated toolbelt skill grants protection to nearby allies.",
          icon: 'https://render.guildwars2.com/file/B62C0756B53D65A109E64863BC42F958DB6FDA93/1128522.png',
          specialization: 'Scrapper',
          tier: 2,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1860,
          name: 'Object in Motion',
          description:
            'Deal increased strike damage while you have stability, swiftness, or superspeed. This damage increase compounds for each boon you have.',
          icon: 'https://render.guildwars2.com/file/FA6A0040D703B2FBF19B4592A63F3D7C2555FE02/2175049.png',
          specialization: 'Scrapper',
          tier: 2,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 1981,
          name: 'Ex Machina',
          description:
            'Function gyro has additional charges, no longer has a recharge penalty, and grants barrier to nearby allies.',
          icon: 'https://render.guildwars2.com/file/10FEBEDA19B34AFB7E45AE0801B83220F7ECC441/3240356.png',
          specialization: 'Scrapper',
          tier: 3,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2052,
          name: 'Kinetic Accelerators',
          description:
            'Grant boons to nearby allies when you successfully combo a field with a blast, leap, or whirl finisher. Your function gyro is now a blast finisher.<br><c=@reminder>Whirl finishers can only trigger this trait once per interval.</c>',
          icon: 'https://render.guildwars2.com/file/7BC1F016DDD40D589CC4AF9A35E9A7490A0DE81A/1128520.png',
          specialization: 'Scrapper',
          tier: 3,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1849,
          name: 'Applied Force',
          description: 'Gain stability when you gain might at or above the threshold. Might grants bonus power.',
          icon: 'https://render.guildwars2.com/file/D1E27896EB409E1BF231CE1EB8090C60546D60C4/1128525.png',
          specialization: 'Scrapper',
          tier: 3,
          position: 3,
          slot: 'Major'
        }
      ]
    ]
  },
  {
    id: 47,
    name: 'Inventions',
    elite: false,
    icon: 'https://render.guildwars2.com/file/91F9AF48FA1DDEB66A449095A4E1A6E901AE203D/1011992.png',
    background: 'https://render.guildwars2.com/file/807C3D97D8B6A25E47B49C905B081419A779201D/1012043.png',
    minorTraits: [
      {
        id: 518,
        name: 'Cleansing Synergy',
        description: 'Using a heal skill triggers a cleansing pulse around you.',
        icon: 'https://render.guildwars2.com/file/637B6BDF42FB6C3F5C91992CBF71745DC0FEE6E2/1012375.png',
        specialization: 'Inventions',
        tier: 1,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 508,
        name: 'Reconstruction Enclosure',
        description: 'Grant protection to nearby allies when you use a heal skill.',
        icon: 'https://render.guildwars2.com/file/6A76E8D3262097AFFADB54DD3C9FE4F93DBC1C5E/1012376.png',
        specialization: 'Inventions',
        tier: 2,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 519,
        name: 'Energy Amplifier',
        description: 'Your power and healing power are increased while you have regeneration.',
        icon: 'https://render.guildwars2.com/file/9B0BA7E593FB0AEA330E4971DBA5632375391E6C/1012377.png',
        specialization: 'Inventions',
        tier: 3,
        position: 0,
        slot: 'Minor'
      }
    ],
    majorTraits: [
      [
        {
          id: 394,
          name: 'Over Shield',
          description:
            'Shield skills grant protection to nearby allies. Protection on you gains increased damage reduction.',
          icon: 'https://render.guildwars2.com/file/F90CB6E3E23B6ECB761C062D92507799694CF4D2/1012366.png',
          specialization: 'Inventions',
          tier: 1,
          position: 1,
          slot: 'Major'
        },
        {
          id: 1901,
          name: 'Automated Medical Response',
          description: "Grant regeneration to nearby allies when you use a healing skill's associated tool belt skill.",
          icon: 'https://render.guildwars2.com/file/F1660BB6D1DD0CBAEE97C46A6856BA072D2A6464/1012367.png',
          specialization: 'Inventions',
          tier: 1,
          position: 2,
          slot: 'Major'
        },
        {
          id: 507,
          name: 'Sapping Device',
          description:
            'Weaken enemies when you disable or immobilize them. <c=@reminder>Disables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.</c>',
          icon: 'https://render.guildwars2.com/file/5580D97E0BC8B7AD57783CAD2CE6E64F0F3AD45F/1012368.png',
          specialization: 'Inventions',
          tier: 1,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 1678,
          name: 'Experimental Turrets',
          description:
            '<c=@abilitytype>Turrets.</c> Turrets create a reflective barrier when built and grant boons to allies around them on a regular interval.',
          icon: 'https://render.guildwars2.com/file/BED3FAAEBD083392DD9F6E48C657AEC19AA43D33/1012369.png',
          specialization: 'Inventions',
          tier: 2,
          position: 1,
          slot: 'Major'
        },
        {
          id: 1834,
          name: 'Soothing Detonation',
          description: 'Heal nearby allies when using a tool belt skill.',
          icon: 'https://render.guildwars2.com/file/5E0C5F9FBA57D5C80109241602BE4A76A917A708/1012370.png',
          specialization: 'Inventions',
          tier: 2,
          position: 2,
          slot: 'Major'
        },
        {
          id: 445,
          name: 'Mecha Legs',
          description: 'Gain resistance when you dodge.',
          icon: 'https://render.guildwars2.com/file/4D2DE7CDF20239FCA2905CBAC91FC461FB0EF6A2/1012371.png',
          specialization: 'Inventions',
          tier: 2,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 472,
          name: 'Anticorrosion Plating',
          description: 'When you grant protection to an ally, cleanse conditions from them.',
          icon: 'https://render.guildwars2.com/file/A169390B67F8133D4BC7DE4767DEF6357DBC08B2/1938786.png',
          specialization: 'Inventions',
          tier: 3,
          position: 1,
          slot: 'Major'
        },
        {
          id: 1680,
          name: 'Bunker Down',
          description:
            "Create a proximity mine at your target's location and a med kit at your location when you disable an enemy.",
          icon: 'https://render.guildwars2.com/file/6EABBE9E7D25709058EF66CC593E4BC8F903A83F/1012373.png',
          specialization: 'Inventions',
          tier: 3,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1916,
          name: 'Medical Dispersion Field',
          description:
            'While in combat, a percentage of healing you apply to yourself is stored by your Medical Dispersion Field. Each interval, stored healing is spent to heal nearby allies.',
          icon: 'https://render.guildwars2.com/file/4B4FA8FEC9F830DC75F8D1532AE6490B09326D98/1012374.png',
          specialization: 'Inventions',
          tier: 3,
          position: 3,
          slot: 'Major'
        }
      ]
    ]
  },
  {
    id: 57,
    name: 'Holosmith',
    elite: true,
    icon: 'https://render.guildwars2.com/file/F41CDEE4603FC0741669A7F2A7E977D36123DF7C/1769889.png',
    background: 'https://render.guildwars2.com/file/FF0814C6EFA56F9ADA0B3EA7986BADF120F7D11D/1769898.png',
    minorTraits: [
      {
        id: 2158,
        name: 'Photon Projector',
        description: 'Photon Forge replaces your tool belt skill 5. Gain access to <c=@abilitytype>Exceed</c> skills.',
        icon: 'https://render.guildwars2.com/file/5E01A22E14BB552CCEB5B5E99417DD20D0C45B67/1769936.png',
        specialization: 'Holosmith',
        tier: 1,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 2135,
        name: 'Heat Therapy',
        description:
          'Gain health per unit of heat lost.<br><c=@reminder>This trait does not function while cooling due to an overheat unless Photonic Blasting Module is equipped.</c>',
        icon: 'https://render.guildwars2.com/file/C1B0A2466701BF6CB45176D967D5C29B940F6397/1769937.png',
        specialization: 'Holosmith',
        tier: 2,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 2122,
        name: "Laser's Edge",
        description:
          'While Photon Forge is active, your outgoing strike damage is increased based on your current heat.',
        icon: 'https://render.guildwars2.com/file/0D5D9B2C77B736E0609004026A06756D5142690B/1769938.png',
        specialization: 'Holosmith',
        tier: 3,
        position: 0,
        slot: 'Minor'
      }
    ],
    majorTraits: [
      [
        {
          id: 2114,
          name: 'Light Density Amplifier',
          description: 'Photon Forge reduces incoming damage but has increased passive heat generation.',
          icon: 'https://render.guildwars2.com/file/3994F02CE07262B156C90E9143F2720ADF2DB0FD/1769927.png',
          specialization: 'Holosmith',
          tier: 1,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2157,
          name: 'Prismatic Converter',
          description: 'Deactivate Photon Forge converts conditions into boons based on your heat level.',
          icon: 'https://render.guildwars2.com/file/DC0BB7751AFC3CC425E66E774179F00B9C3C9E29/1769928.png',
          specialization: 'Holosmith',
          tier: 1,
          position: 2,
          slot: 'Major'
        },
        {
          id: 2106,
          name: 'Solar Focusing Lens',
          description:
            'Your first few attacks after entering or exiting Photon Forge inflict burning and deal increased strike damage. This bonus is also granted if you overheat.',
          icon: 'https://render.guildwars2.com/file/19FE5C016ACFF174DE03752D40D202F9B75FB0C2/1769929.png',
          specialization: 'Holosmith',
          tier: 1,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 2103,
          name: 'Crystal Configuration: Storm',
          description: 'Photon Forge skill 1 now fires explosive projectiles, but generates extra heat.',
          icon: 'https://render.guildwars2.com/file/E9E927D85AAEB368805AA8F2D2A4BE32B6C6A507/1769930.png',
          specialization: 'Holosmith',
          tier: 2,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2152,
          name: 'Crystal Configuration: Eclipse',
          description: 'Corona Burst grants a barrier for each target struck.',
          icon: 'https://render.guildwars2.com/file/7C0E6BD391C3D0CCEEC9BD1B0796A0355C075755/1769931.png',
          specialization: 'Holosmith',
          tier: 2,
          position: 2,
          slot: 'Major'
        },
        {
          id: 2091,
          name: 'Crystal Configuration: Zephyr',
          description:
            'Holo Leap removes movement-impairing conditions, grants superspeed instead of swiftness, and inflicts cripple.',
          icon: 'https://render.guildwars2.com/file/73D708B30A589E3AE2E3141B327B4616B9CC663F/1769932.png',
          specialization: 'Holosmith',
          tier: 2,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 2066,
          name: 'Thermal Release Valve',
          description:
            'Dodge rolling vents heat as an attack against nearby foes and grants vigor.<br><c=@reminder>(Attack will not occur without heat.)</c>',
          icon: 'https://render.guildwars2.com/file/051954D32BCDA37DEAA1730C9CF09CAEF22F9FB3/1769933.png',
          specialization: 'Holosmith',
          tier: 3,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2137,
          name: 'Enhanced Capacity Storage Unit',
          description:
            'Increases maximum heat capacity. While above 100% heat, periodically gain might. Some skills and traits gain additional heat tiers.',
          icon: 'https://render.guildwars2.com/file/5DE502FD03496B4DF70A0CDA1616022B602A049B/1769934.png',
          specialization: 'Holosmith',
          tier: 3,
          position: 2,
          slot: 'Major'
        },
        {
          id: 2064,
          name: 'Photonic Blasting Module',
          description:
            'Overheat now blasts damage to nearby foes and no longer deals its initial damage to you. The tool belt recharge penalty for Overheat is reduced. Heat can only be lost after overheating.<br><c=@reminder>Damage over time from Overheat is still applied.</c>',
          icon: 'https://render.guildwars2.com/file/580C8052ABEA092722A3026D54B12BA0AA1DCD14/1769935.png',
          specialization: 'Holosmith',
          tier: 3,
          position: 3,
          slot: 'Major'
        }
      ]
    ]
  },
  {
    id: 70,
    name: 'Mechanist',
    elite: true,
    icon: 'https://render.guildwars2.com/file/F86CDF34404C0B5A01CD0CBB9D7D0DC1D8CC48CF/2503608.png',
    background: 'https://render.guildwars2.com/file/19C21A9C04620227042E483758962301EFC030D4/2503611.png',
    minorTraits: [
      {
        id: 2291,
        name: 'Mechanical Genius',
        description:
          'Through your mechanical genius, you have utilized Canthan jade technology to build a customized battle mech that will fight at your side.<br>Your mech inherits a percentage of all of your combat attributes except precision, which is added to its own. <br>Your tool belt skills are replaced with Mech Commands, customized by your trait choices. Mech Commands take longer to recharge when using them far away from your mech. <br>Gain access to signet utility skills.',
        icon: 'https://render.guildwars2.com/file/E56C575C4703F3377FA8BE172656ABEA6B92DE4E/2503629.png',
        specialization: 'Mechanist',
        tier: 1,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 2266,
        name: 'Mech Fighter',
        description:
          'New combat subroutines enable your mech to use Rocket Punch when you activate Skill 3 on your equipped weapon. Your mech gains a greater percentage of your own toughness and vitality stats.',
        icon: 'https://render.guildwars2.com/file/170C6CC908E405F57A20019A5BB3D113F13359E5/2503630.png',
        specialization: 'Mechanist',
        tier: 2,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 2267,
        name: 'Exigency Protocols',
        description:
          'When your mech is struck while under half health, it activates Exigency Protocols, gaining damage reduction and regeneration for a short duration. Regeneration boons you apply are stronger.',
        icon: 'https://render.guildwars2.com/file/D303A429CCF6B672E66DA12DD014FEF8A80335E7/2503631.png',
        specialization: 'Mechanist',
        tier: 3,
        position: 0,
        slot: 'Minor'
      }
    ],
    majorTraits: [
      [
        {
          id: 2282,
          name: 'Mech Arms: Single-Edge Cutters',
          description:
            "Unlocks the Mech Command skill Rolling Smash. Your mech's attacks apply bleeding. This effect may only affect a given target once per interval.",
          icon: 'https://render.guildwars2.com/file/F035B89A374E0754AC089BC7C1E90F68A2F0EEEC/2503620.png',
          specialization: 'Mechanist',
          tier: 1,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2296,
          name: 'Mech Arms: High-Impact Drivers',
          description:
            "Unlocks the Mech Command skill Explosive Knuckle. Your mech's attacks now generate might for allies within a radius. This effect may only occur once per interval.<br><br><c=@reminder>The mech does not count against the target count for this trait.</c>",
          icon: 'https://render.guildwars2.com/file/2542CD9B2273C1EE29F306ED9B6FC0E0A92C7F02/2503621.png',
          specialization: 'Mechanist',
          tier: 1,
          position: 2,
          slot: 'Major'
        },
        {
          id: 2279,
          name: 'Mech Arms: Jade Cannons',
          description:
            'Melee attacks become ranged, have an increased chance to critically hit, and apply vulnerability. Unlocks the Mech Command skill Spark Revolver.<br>',
          icon: 'https://render.guildwars2.com/file/73600241FA662501C5D617719A7B4792F30B2846/2503622.png',
          specialization: 'Mechanist',
          tier: 1,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 2270,
          name: 'Mech Frame: Conductive Alloys',
          description:
            'Unlocks the Mech Command skill Discharge Array. Your mech gains a greater percentage of your own condition damage and expertise stats.',
          icon: 'https://render.guildwars2.com/file/F45967B8DC5F20476780D493FB79B4991822CF5E/2503623.png',
          specialization: 'Mechanist',
          tier: 2,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2276,
          name: 'Mech Frame: Channeling Conduits',
          description:
            'Unlocks the Mech Command skill Crisis Zone. When you or your mech apply barrier, also grant a boon to the affected target. Your mech gains a greater percentage of your own concentration and healing power stats.',
          icon: 'https://render.guildwars2.com/file/EA4C0233E57A24A4C4417C0CC955B2D8C12D5B34/2503625.png',
          specialization: 'Mechanist',
          tier: 2,
          position: 2,
          slot: 'Major'
        },
        {
          id: 2294,
          name: 'Mech Frame: Variable Mass Distributor',
          description:
            'Unlocks the Mech Command skill Core Reactor Shot. Your mech gains a greater percentage of your own precision stats.',
          icon: 'https://render.guildwars2.com/file/715CE76B90B40EE7E30AE1D1FA3F7432D30C5D94/2503624.png',
          specialization: 'Mechanist',
          tier: 2,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 2292,
          name: 'Mech Core: Jade Dynamo',
          description:
            'Unlocks the Mech Command skill Jade Mortar. Mech Command skills grant you quickness when used and have a reduced cooldown.',
          icon: 'https://render.guildwars2.com/file/521FEBAE995F2BFB38F9EF3176DBDCFC075173F4/2503626.png',
          specialization: 'Mechanist',
          tier: 3,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2281,
          name: 'Mech Core: Barrier Engine',
          description:
            'Unlocks the Mech Command skill Barrier Burst. While in combat, your mech will automatically grant a small barrier each interval to nearby allies.<br><br><c=@reminder>The mech does not count against the target count for this trait.</c>',
          icon: 'https://render.guildwars2.com/file/EEE0C0D90EB9E244B3F11BA0AF7C77E3D83AF576/2503627.png',
          specialization: 'Mechanist',
          tier: 3,
          position: 2,
          slot: 'Major'
        },
        {
          id: 2298,
          name: 'Mech Core: J-Drive',
          description:
            'Gain access to the Mech Command skill Sky Circus. While dismissed or away for repairs, your mech supports you with an occasional aerial bombardment.<br>Signet skills gain improved passive effects and continue to grant their passive bonuses while recharging.',
          icon: 'https://render.guildwars2.com/file/0DB4530703CE745B0E15A56609BCCA21CC649837/2503628.png',
          specialization: 'Mechanist',
          tier: 3,
          position: 3,
          slot: 'Major'
        }
      ]
    ]
  },
  {
    id: 75,
    name: 'Amalgam',
    elite: true,
    icon: 'https://render.guildwars2.com/file/67AA599996662C5BA8427FA7BA6FF8B4ED221B0D/3679897.png',
    background: 'https://render.guildwars2.com/file/094F0711ADF50A3F013F2963C5B03215626C96A8/3679906.png',
    minorTraits: [
      {
        id: 2377,
        name: 'Experimental Union',
        description:
          'Through asuran ingenuity, you are host to a mercurial mold. You are able to command it using selectable <c=@abilitytype>morph</c> skills that replace your toolbelt skills or even fully merge with it to evolve into a superior being.<br><c=@abilitytype>Morph</c> skills selected will alter the composition of the mercurial mold, changing the bonuses it grants you when you evolve.<br>Gain access to <c=@abilitytype>stance</c> utility skills.',
        icon: 'https://render.guildwars2.com/file/389B4548DDBC08AEA668F3AF1802394E0955B591/3679952.png',
        specialization: 'Amalgam',
        tier: 1,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 2389,
        name: 'Hybrid Vigor',
        description: 'Gain vitality. Gain barrier when you use a <c=@abilitytype>morph</c> skill.',
        icon: 'https://render.guildwars2.com/file/69F518AF096998F9B127C7CB1C05EA7348D170C7/3679953.png',
        specialization: 'Amalgam',
        tier: 2,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 2356,
        name: 'Willing Host',
        description: 'Using a <c=@abilitytype>morph</c> skill increases your damage for a duration.',
        icon: 'https://render.guildwars2.com/file/49DEE2C90E04E876DE2517C201060E330A7D9FDE/3679954.png',
        specialization: 'Amalgam',
        tier: 3,
        position: 0,
        slot: 'Minor'
      }
    ],
    majorTraits: [
      [
        {
          id: 2366,
          name: 'Stainless Steel',
          description: 'Convert conditions to boons when you use a <c=@abilitytype>stance</c> skill or evolve.',
          icon: 'https://render.guildwars2.com/file/C280022834C550F145319BE3AC0401EB3D9B92CE/3679943.png',
          specialization: 'Amalgam',
          tier: 1,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2395,
          name: 'Innervating Alloy',
          description: 'Heal every second while you have barrier. Heal when you evolve.',
          icon: 'https://render.guildwars2.com/file/0AB2B3EE2E255AD7A766F93D7BE0A0AD59CF6637/3679944.png',
          specialization: 'Amalgam',
          tier: 1,
          position: 2,
          slot: 'Major'
        },
        {
          id: 2434,
          name: 'Hardened Chrome',
          description: '<c=@abilitytype>Morph</c> skills and evolving grant protection to yourself.',
          icon: 'https://render.guildwars2.com/file/2FB406D8030E90F0AAB8AF487E0276F023140BE9/3679945.png',
          specialization: 'Amalgam',
          tier: 1,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 2383,
          name: 'Carbolic Composition',
          description: 'Amalgam skills inflict poison on hit. Poison you inflict lasts longer.',
          icon: 'https://render.guildwars2.com/file/9D0E774CFF5A9FD6C8739DD5D9EBEB3D270CACF6/3679946.png',
          specialization: 'Amalgam',
          tier: 2,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2420,
          name: 'Mercurial Tendencies',
          description: 'Disabling an enemy reduces the cooldown of Evolve.',
          icon: 'https://render.guildwars2.com/file/B2CBCEF3DACEECD7BFBBD1CF946AD1CBFF0AD866/3679947.png',
          specialization: 'Amalgam',
          tier: 2,
          position: 2,
          slot: 'Major'
        },
        {
          id: 2349,
          name: 'Silver Lining',
          description:
            'Evolve no longer inherits bonuses from strains. <c=@abilitytype>Morph</c> skills grant their strain bonuses.',
          icon: 'https://render.guildwars2.com/file/EBC7B54429A00A7C1CB021A2EF7B470E7831B064/3679948.png',
          specialization: 'Amalgam',
          tier: 2,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 2406,
          name: 'Symbiotic Synergy',
          description:
            'Evolve recharges <c=@abilitytype>morph</c> skills. <c=@abilitytype>Morph</c> skills deal increased strike damage.',
          icon: 'https://render.guildwars2.com/file/457A0302F976CCF42D065D0E01DD08390666DFCD/3679949.png',
          specialization: 'Amalgam',
          tier: 3,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2387,
          name: 'New Genes',
          description:
            '<c=@abilitytype>Morph</c> skills grant boons to allies. Grant an additional boon based on which <c=@abilitytype>morph</c> skill was used.',
          icon: 'https://render.guildwars2.com/file/B6E5BA5FF8F4179F2521F61696EEC3D7DEE50F07/3679950.png',
          specialization: 'Amalgam',
          tier: 3,
          position: 2,
          slot: 'Major'
        },
        {
          id: 2334,
          name: 'Double Helix',
          description: 'Evolve has two charges and grants an increased attribute bonus.',
          icon: 'https://render.guildwars2.com/file/000E5AC3B7BE616A329F46ECAD06EB07507ADF73/3679951.png',
          specialization: 'Amalgam',
          tier: 3,
          position: 3,
          slot: 'Major'
        }
      ]
    ]
  }
];
export const SKILLS: readonly EngineerSkill[] = [
  {
    id: 5802,
    name: 'Med Kit',
    description: 'Engineering Kit. Equip a kit that replaces your weapon with healing skills.',
    icon: 'https://render.guildwars2.com/file/206FCC2A05035FDB306AB5136E5F3AC0FC6467F3/103395.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 6109
  },
  {
    id: 5805,
    name: 'Grenade Kit',
    description: 'Engineering Kit. Equip a kit that replaces your weapon with grenade skills.',
    icon: 'https://render.guildwars2.com/file/C2A603094B5709BE213D391AFD4D33293C19EA38/103396.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 6110
  },
  {
    id: 5812,
    name: 'Bomb Kit',
    description: 'Engineering Kit. Equip a kit that replaces your weapon with bomb skills.',
    icon: 'https://render.guildwars2.com/file/B06C59BBB1EC416859E04E7C9859BE020C4B3E17/103399.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 6111
  },
  {
    id: 5827,
    name: 'Fragmentation Shot',
    description: 'Fire a shot that bleeds the impacted target and then shatters, dealing damage to nearby enemies.',
    icon: 'https://render.guildwars2.com/file/40BE467F4D09226EA70526E4B61C0EDA270B6317/103170.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 5828,
    name: 'Poison Dart Volley',
    description: 'Fire a volley of darts that poison foes.',
    icon: 'https://render.guildwars2.com/file/E630EC9663DDE5C165BC0304C636900C7D2006F9/103171.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_2',
    specialization: '',
    categories: [],
    recharge: 8,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 5829,
    name: 'Static Shot',
    description: 'Discharge a lightning shot that bounces between multiple foes, blinding and confusing them.',
    icon: 'https://render.guildwars2.com/file/CBC5740B8092A6474595F8BFB2394D145D3AB0E8/103406.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_3',
    specialization: '',
    categories: [],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 5830,
    name: 'Glue Shot',
    description:
      'Coat the target area with a glue puddle that immobilizes foes on impact, then cripples foes that remain within.',
    icon: 'https://render.guildwars2.com/file/AA05DE91B26C2926046495CE0293966A3C1EA492/103187.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_5',
    specialization: '',
    categories: [],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 5831,
    name: 'Blowtorch',
    description: 'Unleash flames from your pistol to burn foes. Deals more damage the closer you are.',
    icon: 'https://render.guildwars2.com/file/061D48DCAC954D91D8F8BD7F6B193201A695F92F/103407.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_4',
    specialization: '',
    categories: [],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 5857,
    name: 'Healing Turret',
    description:
      'Turret. Deploy a turret that heals you briefly, then regenerates you and your allies. Turrets automatically overcharge when they are first dropped, and they can be overcharged manually as long as they stay active.',
    icon: 'https://render.guildwars2.com/file/7D5297C096055DE43153D90F965763F8F2D5FF25/103413.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: '',
    categories: ['Turret'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 5961
  },
  {
    id: 5868,
    name: 'Supply Crate',
    description:
      'Turret. Request a supply drop of turrets. Turrets automatically overcharge when they are first dropped, and they can be overcharged manually as long as they stay active.',
    icon: 'https://render.guildwars2.com/file/1B0C0900BD7F04324E1695BCF97D5AF8AD0609B7/103419.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: '',
    categories: ['Turret'],
    recharge: 75,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 5927,
    name: 'Flamethrower',
    description: 'Engineering Kit. Arm yourself with a flamethrower that replaces your weapon skills.',
    icon: 'https://render.guildwars2.com/file/573A10BFC3310A694740092B91E40C953EE80A03/103435.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 5933,
    name: 'Elixir Gun',
    description: 'Engineering Kit. Arm yourself with an elixir gun that replaces your weapon skills.',
    icon: 'https://render.guildwars2.com/file/5D6E07C3D17AD7C701B199684C641F0E024961C8/103437.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 6115
  },
  {
    id: 5961,
    name: 'Detonate Healing Turret',
    description: 'Detonate your healing turret.',
    icon: 'https://render.guildwars2.com/file/09EB220BF078A6F961E0B0D4F9969669F276DF50/103447.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: '',
    categories: [],
    recharge: 10,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 6003,
    name: 'Rifle Burst',
    description: 'Deliver a quick burst of fire that pierces targets, followed by an explosive grenade.',
    icon: 'https://render.guildwars2.com/file/30F4477E57FFF65C3302F5380D5FCB654CA2E95F/102815.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 68079,
    flipSkillId: 68079
  },
  {
    id: 6004,
    name: 'Net Shot',
    description: 'Immobilize foes with a net shot.',
    icon: 'https://render.guildwars2.com/file/A47830A4152F5F5DEC5D22975DE0449A57F2D570/102982.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_3',
    specialization: '',
    categories: [],
    recharge: 9,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 6005,
    name: 'Jump Shot',
    description: 'Blast the ground, damaging nearby foes and leaping to your target.',
    icon: 'https://render.guildwars2.com/file/6B29C1E841653F64FCB769236177CFC836C8B933/102798.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_5',
    specialization: '',
    categories: [],
    recharge: 18,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 6053,
    name: 'Magnetic Shield',
    description: 'Create a magnetic field that reflects projectiles and can be released to knock back foes.',
    icon: 'https://render.guildwars2.com/file/7F176FBD29DE3904651573F5161129AA5C4FD3D0/103473.png',
    type: 'Weapon',
    weapon: 'Shield',
    slot: 'Weapon_4',
    specialization: '',
    categories: [],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 6126
  },
  {
    id: 6054,
    name: 'Static Shield',
    description:
      'Electrify your shield, preparing to throw it at foes. Stun nearby enemies that attack you while blocking.',
    icon: 'https://render.guildwars2.com/file/133D50B114C9FDAE9D9DF0FBA5E82ABD0A610EE7/103474.png',
    type: 'Weapon',
    weapon: 'Shield',
    slot: 'Weapon_5',
    specialization: '',
    categories: [],
    recharge: 24,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 6057
  },
  {
    id: 6057,
    name: 'Throw Shield',
    description: 'Throw your charged shield. Dazes foes it hits on the way out and back.',
    icon: 'https://render.guildwars2.com/file/7C3AA694D44340C00B76B414AC3168071AF292A0/103424.png',
    type: 'Weapon',
    weapon: 'Shield',
    slot: 'Weapon_5',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 6109,
    name: 'Stow Med Kit',
    description: 'Stow your med kit.',
    icon: 'https://render.guildwars2.com/file/7342BF326738A4C5132F42CE0915D3A2184E52FB/60975.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 6110,
    name: 'Stow Grenade Kit',
    description: 'Stow your grenade kit.',
    icon: 'https://render.guildwars2.com/file/7342BF326738A4C5132F42CE0915D3A2184E52FB/60975.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 6111,
    name: 'Stow Bomb Kit',
    description: 'Stow your bomb kit.',
    icon: 'https://render.guildwars2.com/file/7342BF326738A4C5132F42CE0915D3A2184E52FB/60975.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 6115,
    name: 'Stow Elixir Gun',
    description: 'Stow your elixir gun.',
    icon: 'https://render.guildwars2.com/file/7342BF326738A4C5132F42CE0915D3A2184E52FB/60975.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 6126,
    name: 'Magnetic Inversion',
    description: 'Release the magnetic field to knock back nearby foes.',
    icon: 'https://render.guildwars2.com/file/BBD1A5F3730F423A037F42B10FFFACD2EF65C271/103483.png',
    type: 'Weapon',
    weapon: 'Shield',
    slot: 'Weapon_4',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 6153,
    name: 'Blunderbuss',
    description:
      'Fire several shards of shrapnel that inflict more damage the closer you are to foes. You and nearby allies gain might.',
    icon: 'https://render.guildwars2.com/file/FC0C5A43332CBCEEFB32EF5331F89650FC0AF310/103111.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_2',
    specialization: '',
    categories: [],
    recharge: 6,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 6154,
    name: 'Overcharged Shot',
    description:
      'Fire a blast so strong that it launches your foe as the recoil frees you from any movement-impairing conditions.',
    icon: 'https://render.guildwars2.com/file/5B1B070F59C3FDB22794910FBD1C4C7DBF3BD47E/102790.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_4',
    specialization: '',
    categories: [],
    recharge: 14,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 6161,
    name: 'Throw Mine',
    description:
      'Gadget. Throw out a remote-controlled land mine that damages, knocks back, and removes a boon from nearby foes.',
    icon: 'https://render.guildwars2.com/file/0F0F28210568DB66F8539D684314FC55D8C1022C/103177.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Gadget'],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 6162
  },
  {
    id: 6162,
    name: 'Detonate',
    description: 'Detonate your mine to damage foes and remove a boon from them.',
    icon: 'https://render.guildwars2.com/file/D97BF56EBB6D074BFEFC11E103D6D1F2360C6A17/102902.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 21659,
    name: 'A.E.D.',
    description:
      'Gadget. Activate your A.E.D., enabling the system to heal you after a brief period of time. If you take lethal damage while A.E.D. is active, it ends and heals you for a large amount and removes conditions.',
    icon: 'https://render.guildwars2.com/file/37E6184468482B012ACE173098B0784456CA31C5/699525.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: '',
    categories: ['Gadget'],
    recharge: 24,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 29785,
    name: 'Negative Bash',
    description: 'Chain. Slam your hammer into your foe to leave them vulnerable.',
    icon: 'https://render.guildwars2.com/file/99F8097EDF3414100FDC21697C0A30BB31B6A605/1128585.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',
    specialization: 'Scrapper',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 30489,
    flipSkillId: 30489
  },
  {
    id: 29840,
    name: 'Shock Shield',
    description: 'Block attacks while striking foes in front of you, gaining barrier with each enemy you hit.',
    icon: 'https://render.guildwars2.com/file/28DD470E607DA1BB687BD0956C6DEE665CBAFCCE/1058591.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_4',
    specialization: 'Scrapper',
    categories: [],
    recharge: 18,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 29921,
    name: 'Shredder Gyro',
    description: 'Well. Deploy a shredder gyro to attack foes in the area and repeatedly use whirl finishers.',
    icon: 'https://render.guildwars2.com/file/E60C094A2349552EA6F6250D9B14E69BE91E4468/1128595.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Scrapper',
    categories: ['Well'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 30088,
    name: 'Electro-whirl',
    description: 'Spin around, reflecting missiles and hitting enemies.',
    icon: 'https://render.guildwars2.com/file/B36C6EBE3577BAA5773857EDE33895C5C6663EEC/1058590.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_2',
    specialization: 'Scrapper',
    categories: [],
    recharge: 6,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 30357,
    name: 'Medic Gyro',
    description: 'Well. Deploy a medic gyro to heal allies in the area.',
    icon: 'https://render.guildwars2.com/file/EE3F42039E92ACA301CC5090D3DDA974F5D8FFCF/1128587.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: 'Scrapper',
    categories: ['Well'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 30489,
    name: 'Equalizing Blow',
    description: 'Chain. Bring down your hammer on your foe.',
    icon: 'https://render.guildwars2.com/file/7D9690A6720204571801256DC30BF6B4BFEDE524/1058589.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',
    specialization: 'Scrapper',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 30501,
    name: 'Positive Strike',
    description: 'Chain. Smack your hammer into your foe while empowering yourself.',
    icon: 'https://render.guildwars2.com/file/03AFAF0818322FBFBA7D0A03A313B7C1F9B224C2/1128586.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',
    specialization: 'Scrapper',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 29785,
    flipSkillId: 29785
  },
  {
    id: 30665,
    name: 'Rocket Charge',
    description: 'Dash forward with a rocket-charged hammer to damage enemies.',
    icon: 'https://render.guildwars2.com/file/AE3AF2E525F00F645EEAA97143E322E519DA1569/1058592.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_3',
    specialization: 'Scrapper',
    categories: [],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 30713,
    name: 'Thunderclap',
    description: 'Ionize an area, bringing down the power of lightning to stun foes and damage them over its duration.',
    icon: 'https://render.guildwars2.com/file/21C770525B9B9BEDB7BBFF24055E1138C333FC00/1058593.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_5',
    specialization: 'Scrapper',
    categories: [],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 30800,
    name: 'Elite Mortar Kit',
    description: 'Engineering Kit. Equip the mortar kit.',
    icon: 'https://render.guildwars2.com/file/0EC010DE95064B13B756C11F94CB040DFACD627B/103443.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 30815,
    name: 'Sneak Gyro',
    description: 'Well. Deploy a sneak gyro to provide stealth to allies in the area.',
    icon: 'https://render.guildwars2.com/file/45FB5559AC6432169509B427D3091C4F192AEC3B/1128596.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: 'Scrapper',
    categories: ['Well'],
    recharge: 45,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 31248,
    name: 'Blast Gyro',
    description: 'Well. Unleash a blast gyro to begin a countdown to a tremendous blast.',
    icon: 'https://render.guildwars2.com/file/24296D225154B94E6DC670A134F4177AB980E777/1128592.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Scrapper',
    categories: ['Well'],
    recharge: 15,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 40160,
    name: 'Radiant Arc',
    description:
      'Leap to your target and create an arc of light that strikes nearby foes. Gain quickness based on your heat level.',
    icon: 'https://render.guildwars2.com/file/A57A38790F3B7AE905B60AB2E172DC0C437125EA/1770409.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_3',
    specialization: 'Holosmith',
    categories: [],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 40507,
    name: 'Coolant Blast',
    description:
      'Exceed. Heal yourself and chill nearby foes. If you are above the heat threshold when this skill is activated, gain Frost Aura and continue healing for a duration.',
    icon: 'https://render.guildwars2.com/file/FC409CF9B0063964C23A62311EF52B71A6F064D9/1770388.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: 'Holosmith',
    categories: [],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 40533,
    name: 'Launch Wall',
    description:
      'Exceed. Launch your photon wall forward, causing the wall to explode when it strikes a foe, inflicting conditions on nearby enemies. When fired above the heat threshold, launch additional walls.',
    icon: 'https://render.guildwars2.com/file/0B07BD5AD1FA7107A97DB35A22A17E73FB989824/1770413.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Holosmith',
    categories: [],
    recharge: 0.5,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 41123,
    name: 'Deactivate Photon Forge',
    description: 'Cancel Photon Forge and begin cooling after a delay. Cooling effectiveness increases over time.',
    icon: 'https://render.guildwars2.com/file/2B65387C32A4AE09D67AF9D438BA4B4C09A24EE4/1770389.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_5',
    specialization: '',
    categories: [],
    recharge: 6,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 42009,
    name: 'Prime Light Beam',
    description:
      'Exceed. Charge up and fire an explosive beam of light in front of you. When activated above the heat threshold, this attack leaves behind a burning holographic field.',
    icon: 'https://render.guildwars2.com/file/80052B4C12919318036326D6D2A579C76867DF1B/1770387.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: 'Holosmith',
    categories: [],
    recharge: 60,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 42842,
    name: 'Laser Disk',
    description:
      'Exceed. Create rotating laser blades to damage nearby foes. This skill has increased duration when activated while above the heat threshold.',
    icon: 'https://render.guildwars2.com/file/A01806176C59A9D0E80A5A7F5BAC2B7C96E51DC6/1770411.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Holosmith',
    categories: [],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 42938,
    name: 'Engage Photon Forge',
    description:
      'Activate your Photon Forge, gaining access to new skills. Generate heat while Photon Forge is active. Take damage if you overheat. Disables use of kits for a short duration.',
    icon: 'https://render.guildwars2.com/file/1C35CD2D504EC3C5D25C43DFF808956751713E72/1770391.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_5',
    specialization: '',
    categories: [],
    recharge: 1,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 41123
  },
  {
    id: 43476,
    name: 'Sun Edge',
    description: 'Strike your foe and inflict vulnerability. This attack deals more damage based on your heat level.',
    icon: 'https://render.guildwars2.com/file/136E9A23E326BE1D67FAD6793A6253024204A6E5/1770405.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    specialization: 'Holosmith',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 45581,
    flipSkillId: 45581
  },
  {
    id: 43739,
    name: 'Photon Wall',
    description:
      'Exceed. A defensive barrier appears in front of you that blocks you and your allies from incoming attacks. Reactivate Exceed to fire the barrier at foes as an attack. This skill grants projectile reflection if you are above the heat threshold.',
    icon: 'https://render.guildwars2.com/file/17FCB62A75625CDE2DC279FB9209D65974C8F435/1770412.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Holosmith',
    categories: [],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 40533
  },
  {
    id: 44110,
    name: 'Refraction Cutter',
    description:
      'Strike at foes in front of you and launch a blade of light at your target. Launch extra blades based on your heat level. Each blade inflicts conditions.',
    icon: 'https://render.guildwars2.com/file/C571A742D055DCA81F6FD70D38C0409DDC9ABEE5/1770408.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_2',
    specialization: 'Holosmith',
    categories: [],
    recharge: 6,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 45581,
    name: 'Sun Ripper',
    description:
      'Strike your foe again and inflict vulnerability. This attack deals more damage based on your heat level.',
    icon: 'https://render.guildwars2.com/file/004244480A0828CE033FB575C8FA3A566A016C58/1770406.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    specialization: 'Holosmith',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 45979,
    flipSkillId: null
  },
  {
    id: 45979,
    name: 'Gleam Saber',
    description:
      'Unleash a burst of stored energy with your sword and recharge your other sword skills. This attack deals more damage based on your heat level.',
    icon: 'https://render.guildwars2.com/file/DA9AC63DCF633A5D2806C37EB5C0E105C01DD7AC/1770407.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    specialization: 'Holosmith',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 56920,
    name: 'Function Gyro',
    description:
      'Create a lightning field at the specified point. Then summon gyros to finish foes and revive allies within the field. The recharge of this skill is increased for each gyro created beyond the first.\nInterrupted gyros are destroyed.',
    icon: 'https://render.guildwars2.com/file/42BCB9C83B05D048C0E0BA1804F13D6FAC180DCD/2175057.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_5',
    specialization: '',
    categories: [],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 63049,
    name: 'Rectifier Signet',
    description:
      'Signet Passive: Heal yourself and your mech every second.\nSignet Active: Heal yourself and your mech.',
    icon: 'https://render.guildwars2.com/file/C1060E52F505962C04A32B0267CA0C75475D1105/2503669.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: 'Mechanist',
    categories: ['Signet'],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 63050,
    name: 'Crash Down',
    description:
      'Summon your jade mech at the target area. Foes in the area are damaged. The recharge time of this skill is based on how damaged your mech is.\n\nRight-click to rename your mech.',
    icon: 'https://render.guildwars2.com/file/9156D3FECB94F8B27909B3EA904DAAE3C21043F9/2503677.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_4',
    specialization: '',
    categories: [],
    recharge: 50,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 63077,
    name: 'Mace Smash',
    description: 'Smash your target with a heavy blow from your mace, inflicting confusion.',
    icon: 'https://render.guildwars2.com/file/6FB7E71DFAA30995F3A9587A4BD17656EDA2A34B/2503671.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    specialization: 'Mechanist',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 63174,
    flipSkillId: 63174
  },
  {
    id: 63089,
    name: 'Recall Mech',
    description:
      'Recall your mech for repairs. The cooldown of Crash Down is determined by the amount of damage your mech has taken.\n\nRight-click to rename your mech.',
    icon: 'https://render.guildwars2.com/file/4D6BDB0DF61DF2E5045801F7995D68ECC8C5B602/2503676.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_4',
    specialization: '',
    categories: [],
    recharge: 10,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 63095,
    name: 'Overclock Signet',
    description:
      'Signet Passive: Reduces recharge of other signets.\nSignet Active: Order your mech to fire its ultimate weapon, the jade buster cannon. If your mech is not present, instead your mech is summoned, even if Crash Down is on cooldown.',
    icon: 'https://render.guildwars2.com/file/A82F0980D5ED24F305FA57F3A929C1E90D26327F/2503668.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: 'Mechanist',
    categories: ['Signet'],
    recharge: 90,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 63374
  },
  {
    id: 63111,
    name: 'Shift Signet',
    description:
      'Signet Passive: Increases movement speed. Boons you gain are copied to your mech.\nSignet Active: You and your mech shadowstep to the target location. Remove conditions on you and your mech.',
    icon: 'https://render.guildwars2.com/file/EB1BBD04D00E70E40117034CE91F5DC2A9E3C334/2503689.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Mechanist',
    categories: ['Signet'],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 63113,
    name: 'Superconducting Signet',
    description:
      'Signet Passive: Increases condition damage dealt.\nSignet Active: Creates a damaging field around you that applies conditions to nearby foes. If your mech is active, the field instead radiates from and follows the mech.',
    icon: 'https://render.guildwars2.com/file/99C42595B3D1FA7C96C3703B66F241792F08B107/2503691.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Mechanist',
    categories: ['Signet'],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 63169,
    name: 'Energizing Slam',
    description:
      'Leap forward and smash the ground, inflicting conditions on foes while granting barrier and boons to allies.',
    icon: 'https://render.guildwars2.com/file/3A0E770BC6328033C6B44F2567287AAA0649FD31/2503673.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_2',
    specialization: 'Mechanist',
    categories: [],
    recharge: 6,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 63174,
    name: 'Mace Blast',
    description: 'Smash your target with a final heavy strike, inflicting additional confusion.',
    icon: 'https://render.guildwars2.com/file/FE1439232977E061A7E67A72C058B162ED426057/2503672.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    specialization: 'Mechanist',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 63186,
    name: 'Mace Strike',
    description: 'Strike your target.',
    icon: 'https://render.guildwars2.com/file/4B0AA4C45F984870770F3B194F14459AB780CB9C/2503670.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    specialization: 'Mechanist',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 63077,
    flipSkillId: 63077
  },
  {
    id: 63210,
    name: 'Mech Support: Depth Charges',
    description: 'Request a barrage from your mech on the target foe.',
    icon: 'https://render.guildwars2.com/file/CF6EABA0DDC3DAAB15B8AB4A91AC6203A3E4E4DD/2503687.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_4',
    specialization: '',
    categories: [],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 63234,
    name: 'Rocket Fist Prototype',
    description: 'Launch a fist that explodes on the first target hit, damaging and stunning nearby enemies.',
    icon: 'https://render.guildwars2.com/file/7302D5096DE5D3BE485605945B5E4BCBD652974A/2503674.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_3',
    specialization: 'Mechanist',
    categories: [],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 63253,
    name: 'Force Signet',
    description:
      'Signet Passive: Increases strike damage dealt.\nSignet Active: Knock foes away from yourself and away from your mech.',
    icon: 'https://render.guildwars2.com/file/C540CA603AE4BDE57698082CE62396075699DD63/2503690.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Mechanist',
    categories: ['Signet'],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 63262,
    name: 'Barrier Signet',
    description:
      'Signet Passive: Incoming strike and condition damage is reduced.\nSignet Active: Create a projectile-blocking dome around yourself. You and allies inside the dome gain barrier every second. If your mech is active, the dome is centered on it and is larger. \n\nThe mech does not count against the target count for this skill.',
    icon: 'https://render.guildwars2.com/file/EB737C0D4462F5C5572166DEC2801DD56148AFE6/2503688.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Mechanist',
    categories: ['Signet'],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 63374,
    name: 'Jade Buster Cannon',
    description:
      'Fire the main cannon, obliterating targets in a line. The mech may swivel to track targets while firing the jade buster cannon, but it is unable to move.',
    icon: 'https://render.guildwars2.com/file/6493C9915A90E449EFE30323233F960B68C1BDF9/1770418.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: 'Mechanist',
    categories: [],
    recharge: 1,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 68079,
    name: 'Rifle Burst Grenade',
    description: 'Fire an explosive grenade from your rifle.',
    icon: 'https://render.guildwars2.com/file/5B2AB667667749BC1BC7AEFD27362E3E0E0F2FE6/103294.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 69565,
    name: 'Radiant Arc',
    description: 'Leap to your target and create an arc of light that strikes nearby foes. Gain quickness.',
    icon: 'https://render.guildwars2.com/file/A57A38790F3B7AE905B60AB2E172DC0C437125EA/1770409.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_3',
    specialization: 'Holosmith',
    categories: [],
    recharge: 14,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 69906,
    name: 'Sun Ripper',
    description: 'Strike your foe again and inflict vulnerability.',
    icon: 'https://render.guildwars2.com/file/004244480A0828CE033FB575C8FA3A566A016C58/1770406.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    specialization: 'Holosmith',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 70771,
    flipSkillId: null
  },
  {
    id: 70514,
    name: 'Sun Edge',
    description: 'Strike your foe and inflict vulnerability.',
    icon: 'https://render.guildwars2.com/file/136E9A23E326BE1D67FAD6793A6253024204A6E5/1770405.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    specialization: 'Holosmith',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 69906,
    flipSkillId: 69906
  },
  {
    id: 70771,
    name: 'Gleam Saber',
    description: 'Unleash a burst of stored energy with your sword and recharge your other sword skills.',
    icon: 'https://render.guildwars2.com/file/DA9AC63DCF633A5D2806C37EB5C0E105C01DD7AC/1770407.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    specialization: 'Holosmith',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 71121,
    name: 'Refraction Cutter',
    description:
      'Strike at foes in front of you and launch two blades of light at your target. Each blade inflicts conditions.',
    icon: 'https://render.guildwars2.com/file/C571A742D055DCA81F6FD70D38C0409DDC9ABEE5/1770408.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_2',
    specialization: 'Holosmith',
    categories: [],
    recharge: 6,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 71870,
    name: 'Essence of Liquid Wrath',
    description:
      'Fire a volley of arrows equipped with a payload that spreads magical flames across the ground on impact, granting boons to allies on the initial detonation and leaving a fire field.\n\nChain Reaction. The next short-bow skill in the radius will grant an additional boon to allies.',
    icon: 'https://render.guildwars2.com/file/BE259B21EBBEBD0EFACE6D6A67D72E680A0EEC0C/3256347.png',
    type: 'Weapon',
    weapon: 'Shortbow',
    slot: 'Weapon_4',
    specialization: '',
    categories: [],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 71873,
    name: 'Arc Detonator',
    description:
      'Fire an arrow equipped with an electric module that discharges when striking your target, shocking them and two nearby enemies with an electric blast.',
    icon: 'https://render.guildwars2.com/file/6BDE493CFF0A2D03DC335B5D0BB910334FF3EF69/3256344.png',
    type: 'Weapon',
    weapon: 'Shortbow',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 71882,
    name: 'Essence of Living Shadows',
    description:
      'Fire an arrow equipped with a device that spreads shadow magic across the ground on impact, healing and removing conditions from allies with the initial detonation, and healing allies with each pulse afterward.\n\nChain Reaction. The next short-bow skill in the radius will remove additional conditions from allies.',
    icon: 'https://render.guildwars2.com/file/0C703A07EA6CEBDFB1C215D7031D6A0847C90B9B/3256346.png',
    type: 'Weapon',
    weapon: 'Shortbow',
    slot: 'Weapon_3',
    specialization: '',
    categories: [],
    recharge: 15,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 71888,
    name: 'Essence of Borrowed Time',
    description:
      'Fire a row of arrows equipped with a device that envelops an area with chronal magic on impact, stunning enemies and applying superspeed to allies.\n\nChain Reaction. The next short-bow skill in the radius will daze enemies hit.',
    icon: 'https://render.guildwars2.com/file/66F1785E4BC81BA137BC1478C6063D0B35D547AE/3256348.png',
    type: 'Weapon',
    weapon: 'Shortbow',
    slot: 'Weapon_5',
    specialization: '',
    categories: [],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 72052,
    name: 'Essence of Animated Sand',
    description:
      'Fire an arrow equipped with a payload that explodes enchanted sand on impact, granting barrier and might to allies.\n\nChain Reaction. The next short-bow skill in the radius will grant additional might to allies.',
    icon: 'https://render.guildwars2.com/file/CC492703C0E32598AA216BBFBB0F13D1F914A11B/3256345.png',
    type: 'Weapon',
    weapon: 'Shortbow',
    slot: 'Weapon_2',
    specialization: '',
    categories: [],
    recharge: 8,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 72103,
    name: 'Function Gyro',
    description:
      'Create a lightning field at your location, then summon gyros to finish foes and revive allies within the field.\nInterrupted gyros are destroyed.',
    icon: 'https://render.guildwars2.com/file/42BCB9C83B05D048C0E0BA1804F13D6FAC180DCD/2175057.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_5',
    specialization: '',
    categories: [],
    recharge: 1,
    ammo: 0,
    ammoRecharge: 25,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 72114,
    name: 'Function Gyro',
    description:
      'Create a lightning field at the specified point, then summon gyros to finish foes and revive allies within the field.\nInterrupted gyros are destroyed.',
    icon: 'https://render.guildwars2.com/file/42BCB9C83B05D048C0E0BA1804F13D6FAC180DCD/2175057.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_5',
    specialization: '',
    categories: [],
    recharge: 1,
    ammo: 0,
    ammoRecharge: 25,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 72944,
    name: 'Puncturing Jab',
    description: 'Stab your foe, inflicting bleeding. Inflict vulnerability if your target is focused.',
    icon: 'https://render.guildwars2.com/file/CFCB6F01A1F9404E39D966BFC54BD79038A04231/3379111.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 73109,
    flipSkillId: 73109
  },
  {
    id: 72974,
    name: 'Devastator',
    description:
      'Traverse the area and unleash lighting around you, directly targeting focused foes a number of times.',
    icon: 'https://render.guildwars2.com/file/0D9EF8DA5BAE16F60602985D223AA01D1394A0CF/3379118.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_5',
    specialization: '',
    categories: [],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 73064
  },
  {
    id: 72977,
    name: 'Roiling Skies',
    description: 'Charge the earth with electricity, launching focused foes and stunning others.',
    icon: 'https://render.guildwars2.com/file/06B2CD104A29423DE524D1B10A5E5614E75760EC/3379117.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_4',
    specialization: '',
    categories: [],
    recharge: 15,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 73001,
    name: 'Amplifying Slice',
    description:
      'Strike your foe, refreshing your focus and bleeding your target. Inflict vulnerability if your target is focused.',
    icon: 'https://render.guildwars2.com/file/A81BFF49E602EA430906A617A49C285C4FF1159B/3379113.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 73002,
    name: 'Lightning Rod',
    description:
      'Prime your lightning rod to deal damage to nearby enemies. Focused enemies receive extra punishment. Gain charges for your Electric Artillery skill.',
    icon: 'https://render.guildwars2.com/file/F3B4056D042BC2573D054F49ACF40FFA16014CB8/3379115.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_3',
    specialization: '',
    categories: [],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 73143
  },
  {
    id: 73064,
    name: 'Focused Devastation',
    description: 'Repeatedly strike your foe, inflicting conditions.',
    icon: 'https://render.guildwars2.com/file/0D9EF8DA5BAE16F60602985D223AA01D1394A0CF/3379118.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_5',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 73109,
    name: 'Rending Strike',
    description: 'Swing your spear, inflicting bleeding. Inflict vulnerability if your target is focused.',
    icon: 'https://render.guildwars2.com/file/0BBE356A09F8642EEC3A37C83A51FBD9C918B82D/3379112.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 73001,
    flipSkillId: 73001
  },
  {
    id: 73122,
    name: 'Conduit Surge',
    description:
      'Leap toward your target, unleashing intense energy on the area if you strike them. Your primary target becomes the focus of your other skills. If a focused target dies, this skill is refreshed.',
    icon: 'https://render.guildwars2.com/file/09D83A621D282D7E78C6E3502D9E91AC4AC6A2E9/3379114.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_2',
    specialization: '',
    categories: [],
    recharge: 5,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 73143,
    name: 'Electric Artillery',
    description:
      "Hurl your charged rod at a foe, immobilizing them. Foes take increased burning duration and vulnerability stacks based on your lightning rod's charge.",
    icon: 'https://render.guildwars2.com/file/0CB823345DA0D01FB64C39485242D408C75C2E05/3379116.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_3',
    specialization: '',
    categories: [],
    recharge: 1,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 76642,
    name: 'Evolve',
    description: 'Evolve.',
    icon: 'https://render.guildwars2.com/file/0513CCBF102BF696E9027F6363A9705B724CC630/3680129.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_5',
    specialization: '',
    categories: [],
    recharge: 40,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 76651,
    name: 'Evolve',
    description: 'Evolve.',
    icon: 'https://render.guildwars2.com/file/0513CCBF102BF696E9027F6363A9705B724CC630/3680129.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_5',
    specialization: '',
    categories: [],
    recharge: 1,
    ammo: 2,
    ammoRecharge: 40,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 76738,
    name: 'Mitotic State',
    description:
      'Stance. Your slime stimulates your cells to regenerate, healing you rapidly over time. The healing is increased while you have barrier.',
    icon: 'https://render.guildwars2.com/file/69ACD1030C55270FE69099A95FEDA716EFE64F5C/3680126.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: 'Amalgam',
    categories: ['Stance'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 76790,
    name: 'Locked',
    description: 'Select a skill using the arrow above.',
    icon: 'https://render.guildwars2.com/file/7ECD0608332279F720601EB4BF362FA41BA5990D/3680232.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_3',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 76908,
    name: 'Liquid State',
    description: 'Stance. Quickly melt down into a puddle, evading all incoming attacks.',
    icon: 'https://render.guildwars2.com/file/220576D1BDB3D8555755AAD1B8946B5C7E450BE8/3680137.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Amalgam',
    categories: ['Stance'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 76993,
    name: 'Flux State',
    description:
      'Stance. Your slime rapidly spins around you, creating a magnetic field. Pull in nearby enemies as a metallic storm swirls around you.',
    icon: 'https://render.guildwars2.com/file/0A36EB0D061E9B63261260BE663EC6F4C04C1B1C/3680125.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: 'Amalgam',
    categories: ['Stance'],
    recharge: 50,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 77069,
    name: 'Solid State',
    description:
      'Stance. Leap into the air as you command your body to compact, stunning enemies upon landing. Gain stability and increase your outgoing stun durations for a duration.',
    icon: 'https://render.guildwars2.com/file/FD0857ECCA025A02E2E7BB00DB0E65FFBA551661/3680139.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Amalgam',
    categories: ['Stance'],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 77107,
    name: 'Locked',
    description: 'Select a skill using the arrow above.',
    icon: 'https://render.guildwars2.com/file/7ECD0608332279F720601EB4BF362FA41BA5990D/3680232.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_4',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 77209,
    name: 'Plasmatic State',
    description:
      'Stance. Superheat your body and lash out, damaging and burning enemies struck. Your outgoing strike and condition damage is increased for a duration.',
    icon: 'https://render.guildwars2.com/file/2AA6D1CCEE723B7415B60DBDBAB55275EA562D29/3680138.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Amalgam',
    categories: ['Stance'],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 77388,
    name: 'Locked',
    description: 'Select a skill using the arrow above.',
    icon: 'https://render.guildwars2.com/file/7ECD0608332279F720601EB4BF362FA41BA5990D/3680232.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_2',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  }
];
