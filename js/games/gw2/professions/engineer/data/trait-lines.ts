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
        icon: 'https://render.guildwars2.com/file/61510F0752BC696F210F92CA0E13AD290F13AD33/2261507.png'
      },
      {
        id: 517,
        name: 'Steel-Packed Powder',
        icon: 'https://render.guildwars2.com/file/5CE792230BB9F5047F09042D052604E143BBB460/1012352.png'
      },
      {
        id: 429,
        name: 'Shaped Charge',
        icon: 'https://render.guildwars2.com/file/6DA800E25FE446E734FAD0A6E81EB671F596AA79/1012353.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 514,
          name: 'Grenadier',
          icon: 'https://render.guildwars2.com/file/EABE037E9D98A7383A10140DCB0B2853604692DB/1012342.png'
        },
        {
          id: 525,
          name: 'Short Fuse',
          icon: 'https://render.guildwars2.com/file/EFF174C315B196D5FE0CA2D6179F92E46695F199/1012347.png'
        },
        {
          id: 1882,
          name: 'Glass Cannon',
          icon: 'https://render.guildwars2.com/file/63B2BD4FCDA047EA740E5DEA0EBF593308320713/1012344.png'
        }
      ],
      [
        {
          id: 482,
          name: 'Aim-Assisted Rocket',
          icon: 'https://render.guildwars2.com/file/284CE83D6CC7169E1B0D045054566E0D0A7D052B/1012345.png'
        },
        {
          id: 1892,
          name: 'Explosive Temper',
          icon: 'https://render.guildwars2.com/file/273E26303F072C3EEEF0DA25D5ACC1E59AECACF6/2261504.png'
        },
        {
          id: 1944,
          name: 'Blast Shield',
          icon: 'https://render.guildwars2.com/file/1C2F7B7402980B65D12C60CA52510601ECCCC13C/2261503.png'
        }
      ],
      [
        {
          id: 1541,
          name: 'Grand Entrance',
          icon: 'https://render.guildwars2.com/file/7093569DA52A64BE5C42AE0A0D0A700BAA320C0C/2261505.png'
        },
        {
          id: 505,
          name: 'Shrapnel',
          icon: 'https://render.guildwars2.com/file/74C8E6F334CF6905D1E407473701077C60AFE2B6/1012349.png'
        },
        {
          id: 1947,
          name: 'Big Boomer',
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
        icon: 'https://render.guildwars2.com/file/7351CD5F33E20447E8CC237A1802D801B9AF16DC/1012387.png'
      },
      {
        id: 1872,
        name: 'Mechanized Deployment',
        icon: 'https://render.guildwars2.com/file/E4FE930E060A58065801CD1073F234CB5913B632/1012388.png'
      },
      {
        id: 1936,
        name: 'Excessive Energy',
        icon: 'https://render.guildwars2.com/file/B9CAA4643E9B7BD8CF7D61F67CB7C2C8F3FCEE07/1012389.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 532,
          name: 'Static Discharge',
          icon: 'https://render.guildwars2.com/file/0A376A98B571BCD3DAB7CD0C51343C3921AB0C34/1012378.png'
        },
        {
          id: 1997,
          name: 'Reactive Lenses',
          icon: 'https://render.guildwars2.com/file/9DFA2D5E0C5E0EBBC0CD011E1FC6181F6D9ED5CC/1012379.png'
        },
        {
          id: 531,
          name: 'Power Wrench',
          icon: 'https://render.guildwars2.com/file/061229B53180B6E8E7B83EFEA665DF4B6256C392/1012380.png'
        }
      ],
      [
        {
          id: 512,
          name: 'Streamlined Kits',
          icon: 'https://render.guildwars2.com/file/EC0C31050CE77F71097109B9BFE466016F9CFBEF/1012381.png'
        },
        {
          id: 1946,
          name: 'Lock On',
          icon: 'https://render.guildwars2.com/file/CA19315C752AED07407344A15FA3DCDE47064473/1012382.png'
        },
        {
          id: 1832,
          name: 'Takedown Round',
          icon: 'https://render.guildwars2.com/file/C24DFF8043B5D202E97C059BCBACD5B1F055C950/1012383.png'
        }
      ],
      [
        {
          id: 1856,
          name: 'Kinetic Battery',
          icon: 'https://render.guildwars2.com/file/1BE44A22FD664209636ED7E30ACF241B782E6C01/1012384.png'
        },
        {
          id: 523,
          name: 'Adrenal Implant',
          icon: 'https://render.guildwars2.com/file/DCCFFD80BF91F61BFAD58019AFF733010D07057D/1012385.png'
        },
        {
          id: 1679,
          name: 'Gadgeteer',
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
        icon: 'https://render.guildwars2.com/file/BB282B54755A3F4FE44C233E9FABEEF63E399E65/1012339.png'
      },
      {
        id: 487,
        name: 'Transmute',
        icon: 'https://render.guildwars2.com/file/64CA679CD71A9C790E41091135A80B74A6E0D852/1012340.png'
      },
      {
        id: 413,
        name: 'Compounding Chemicals',
        icon: 'https://render.guildwars2.com/file/D40DB82F69C6750822C6750A9705ECFA4051B64B/1012341.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 396,
          name: 'Invigorating Speed',
          icon: 'https://render.guildwars2.com/file/75974EF47C793B5EFA60E0BFF20BC12F807F02D0/1012330.png'
        },
        {
          id: 509,
          name: 'Protection Injection',
          icon: 'https://render.guildwars2.com/file/B6B62423EB4608C40DA2E54E32129163062BEAF1/1012331.png'
        },
        {
          id: 521,
          name: 'Health Insurance',
          icon: 'https://render.guildwars2.com/file/2816FDC0BB196C164646425734AB9205A2750A95/1012332.png'
        }
      ],
      [
        {
          id: 520,
          name: 'Comeback Cure',
          icon: 'https://render.guildwars2.com/file/4DD098F8B129450B9822DCDA9295B771EA4B930A/1938784.png'
        },
        {
          id: 469,
          name: 'Boiling Point',
          icon: 'https://render.guildwars2.com/file/579677B8DEFE6F30C2B81E7A6E9968E866917CBA/1012334.png'
        },
        {
          id: 470,
          name: 'Blast Zone',
          icon: 'https://render.guildwars2.com/file/C971920D6D5A5A66BECBD361B0B118E20AB1FCC4/1012335.png'
        }
      ],
      [
        {
          id: 473,
          name: 'HGH',
          icon: 'https://render.guildwars2.com/file/C033BD736665A3C2514027E13F750896F594BC42/1012336.png'
        },
        {
          id: 1871,
          name: 'Equal and Opposite Reaction',
          icon: 'https://render.guildwars2.com/file/7A10C8FD41FC925B49BD4EAB5FD93C9AF816C123/1938785.png'
        },
        {
          id: 1854,
          name: 'Chain Reactivity',
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
        icon: 'https://render.guildwars2.com/file/1A6944F7ABE9BA53DF50ED07A20D5B00FFBBB075/1012365.png'
      },
      {
        id: 536,
        name: 'Hematic Focus',
        icon: 'https://render.guildwars2.com/file/4E47135C80F9315B0EFF67B1A25331E4BAB60D7E/1012364.png'
      },
      {
        id: 516,
        name: 'Modified Ammunition',
        icon: 'https://render.guildwars2.com/file/4157A498F471AE4569F148A6A438C1444B1C7AE9/1012363.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1878,
          name: 'Chemical Rounds',
          icon: 'https://render.guildwars2.com/file/954B6424697BCA5574FE781C46A0954E0B9F6AE9/1012354.png'
        },
        {
          id: 1930,
          name: 'Sanguine Array',
          icon: 'https://render.guildwars2.com/file/0D44F9A20414755907FF6C91721AC49CB1AC5E30/1012355.png'
        },
        {
          id: 1914,
          name: 'High Caliber',
          icon: 'https://render.guildwars2.com/file/BA01D09FE6ADFCF4BCC0B7BF061FC8A506BE4C4E/1012356.png'
        }
      ],
      [
        {
          id: 1984,
          name: 'Juggernaut',
          icon: 'https://render.guildwars2.com/file/374A7E3227C94B57047A78A8079F07C090D3CE6E/1012360.png'
        },
        {
          id: 2006,
          name: 'Thermal Vision',
          icon: 'https://render.guildwars2.com/file/F806ACB6130CED2DACC9DD804E4303327073385A/1012358.png'
        },
        {
          id: 1923,
          name: 'No Scope',
          icon: 'https://render.guildwars2.com/file/BDE5F642B025FACD7B44D9599822CBF80DA6F257/1012359.png'
        }
      ],
      [
        {
          id: 510,
          name: 'Heavy Metal',
          icon: 'https://render.guildwars2.com/file/68380515301D93ABD5E7A4C89748F80CD819EB3F/1012357.png'
        },
        {
          id: 526,
          name: 'Sharpshooter',
          icon: 'https://render.guildwars2.com/file/EE70DAF7410E00259CA9426E770551D7BF017F09/1012361.png'
        },
        {
          id: 433,
          name: 'Incendiary Powder',
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
        icon: 'https://render.guildwars2.com/file/62D43252CCF835C6A32113E9BD450A5CAC2E3E1E/1128527.png'
      },
      {
        id: 2014,
        name: 'Speed of Synergy',
        icon: 'https://render.guildwars2.com/file/9EA1A2AEAEEA679A4038D7A136C1C7B61A08C3C1/2175051.png'
      },
      {
        id: 1877,
        name: 'Impact Savant',
        icon: 'https://render.guildwars2.com/file/FD7AF757E6B02C7BC55101B0CFDCDAC87E5DBADD/1128528.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1917,
          name: 'Gyroscopic Acceleration',
          icon: 'https://render.guildwars2.com/file/5B1EDB0BEF3301DDC43849E8EDE83DAC374DF6A5/1128518.png'
        },
        {
          id: 1971,
          name: 'System Shocker',
          icon: 'https://render.guildwars2.com/file/D218686E042F19144D99A11F7205FB4763D053EF/2175050.png'
        },
        {
          id: 1867,
          name: 'Mass Momentum',
          icon: 'https://render.guildwars2.com/file/70281123EA553434A55F56E9F1D43F90E0CE22D2/1128526.png'
        }
      ],
      [
        {
          id: 1954,
          name: 'Rapid Regeneration',
          icon: 'https://render.guildwars2.com/file/45FD994928E2247E2C80E42B3FF3B7F5EB280FC7/2983334.png'
        },
        {
          id: 1999,
          name: 'Expert Examination',
          icon: 'https://render.guildwars2.com/file/B62C0756B53D65A109E64863BC42F958DB6FDA93/1128522.png'
        },
        {
          id: 1860,
          name: 'Object in Motion',
          icon: 'https://render.guildwars2.com/file/FA6A0040D703B2FBF19B4592A63F3D7C2555FE02/2175049.png'
        }
      ],
      [
        {
          id: 1981,
          name: 'Ex Machina',
          icon: 'https://render.guildwars2.com/file/10FEBEDA19B34AFB7E45AE0801B83220F7ECC441/3240356.png'
        },
        {
          id: 2052,
          name: 'Kinetic Accelerators',
          icon: 'https://render.guildwars2.com/file/7BC1F016DDD40D589CC4AF9A35E9A7490A0DE81A/1128520.png'
        },
        {
          id: 1849,
          name: 'Applied Force',
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
        icon: 'https://render.guildwars2.com/file/637B6BDF42FB6C3F5C91992CBF71745DC0FEE6E2/1012375.png'
      },
      {
        id: 508,
        name: 'Reconstruction Enclosure',
        icon: 'https://render.guildwars2.com/file/6A76E8D3262097AFFADB54DD3C9FE4F93DBC1C5E/1012376.png'
      },
      {
        id: 519,
        name: 'Energy Amplifier',
        icon: 'https://render.guildwars2.com/file/9B0BA7E593FB0AEA330E4971DBA5632375391E6C/1012377.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 394,
          name: 'Over Shield',
          icon: 'https://render.guildwars2.com/file/F90CB6E3E23B6ECB761C062D92507799694CF4D2/1012366.png'
        },
        {
          id: 1901,
          name: 'Automated Medical Response',
          icon: 'https://render.guildwars2.com/file/F1660BB6D1DD0CBAEE97C46A6856BA072D2A6464/1012367.png'
        },
        {
          id: 507,
          name: 'Sapping Device',
          icon: 'https://render.guildwars2.com/file/5580D97E0BC8B7AD57783CAD2CE6E64F0F3AD45F/1012368.png'
        }
      ],
      [
        {
          id: 1678,
          name: 'Experimental Turrets',
          icon: 'https://render.guildwars2.com/file/BED3FAAEBD083392DD9F6E48C657AEC19AA43D33/1012369.png'
        },
        {
          id: 1834,
          name: 'Soothing Detonation',
          icon: 'https://render.guildwars2.com/file/5E0C5F9FBA57D5C80109241602BE4A76A917A708/1012370.png'
        },
        {
          id: 445,
          name: 'Mecha Legs',
          icon: 'https://render.guildwars2.com/file/4D2DE7CDF20239FCA2905CBAC91FC461FB0EF6A2/1012371.png'
        }
      ],
      [
        {
          id: 472,
          name: 'Anticorrosion Plating',
          icon: 'https://render.guildwars2.com/file/A169390B67F8133D4BC7DE4767DEF6357DBC08B2/1938786.png'
        },
        {
          id: 1680,
          name: 'Bunker Down',
          icon: 'https://render.guildwars2.com/file/6EABBE9E7D25709058EF66CC593E4BC8F903A83F/1012373.png'
        },
        {
          id: 1916,
          name: 'Medical Dispersion Field',
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
        icon: 'https://render.guildwars2.com/file/5E01A22E14BB552CCEB5B5E99417DD20D0C45B67/1769936.png'
      },
      {
        id: 2135,
        name: 'Heat Therapy',
        icon: 'https://render.guildwars2.com/file/C1B0A2466701BF6CB45176D967D5C29B940F6397/1769937.png'
      },
      {
        id: 2122,
        name: "Laser's Edge",
        icon: 'https://render.guildwars2.com/file/0D5D9B2C77B736E0609004026A06756D5142690B/1769938.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2114,
          name: 'Light Density Amplifier',
          icon: 'https://render.guildwars2.com/file/3994F02CE07262B156C90E9143F2720ADF2DB0FD/1769927.png'
        },
        {
          id: 2157,
          name: 'Prismatic Converter',
          icon: 'https://render.guildwars2.com/file/DC0BB7751AFC3CC425E66E774179F00B9C3C9E29/1769928.png'
        },
        {
          id: 2106,
          name: 'Solar Focusing Lens',
          icon: 'https://render.guildwars2.com/file/19FE5C016ACFF174DE03752D40D202F9B75FB0C2/1769929.png'
        }
      ],
      [
        {
          id: 2103,
          name: 'Crystal Configuration: Storm',
          icon: 'https://render.guildwars2.com/file/E9E927D85AAEB368805AA8F2D2A4BE32B6C6A507/1769930.png'
        },
        {
          id: 2152,
          name: 'Crystal Configuration: Eclipse',
          icon: 'https://render.guildwars2.com/file/7C0E6BD391C3D0CCEEC9BD1B0796A0355C075755/1769931.png'
        },
        {
          id: 2091,
          name: 'Crystal Configuration: Zephyr',
          icon: 'https://render.guildwars2.com/file/73D708B30A589E3AE2E3141B327B4616B9CC663F/1769932.png'
        }
      ],
      [
        {
          id: 2066,
          name: 'Thermal Release Valve',
          icon: 'https://render.guildwars2.com/file/051954D32BCDA37DEAA1730C9CF09CAEF22F9FB3/1769933.png'
        },
        {
          id: 2137,
          name: 'Enhanced Capacity Storage Unit',
          icon: 'https://render.guildwars2.com/file/5DE502FD03496B4DF70A0CDA1616022B602A049B/1769934.png'
        },
        {
          id: 2064,
          name: 'Photonic Blasting Module',
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
        icon: 'https://render.guildwars2.com/file/E56C575C4703F3377FA8BE172656ABEA6B92DE4E/2503629.png'
      },
      {
        id: 2266,
        name: 'Mech Fighter',
        icon: 'https://render.guildwars2.com/file/170C6CC908E405F57A20019A5BB3D113F13359E5/2503630.png'
      },
      {
        id: 2267,
        name: 'Exigency Protocols',
        icon: 'https://render.guildwars2.com/file/D303A429CCF6B672E66DA12DD014FEF8A80335E7/2503631.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2282,
          name: 'Mech Arms: Single-Edge Cutters',
          icon: 'https://render.guildwars2.com/file/F035B89A374E0754AC089BC7C1E90F68A2F0EEEC/2503620.png'
        },
        {
          id: 2296,
          name: 'Mech Arms: High-Impact Drivers',
          icon: 'https://render.guildwars2.com/file/2542CD9B2273C1EE29F306ED9B6FC0E0A92C7F02/2503621.png'
        },
        {
          id: 2279,
          name: 'Mech Arms: Jade Cannons',
          icon: 'https://render.guildwars2.com/file/73600241FA662501C5D617719A7B4792F30B2846/2503622.png'
        }
      ],
      [
        {
          id: 2270,
          name: 'Mech Frame: Conductive Alloys',
          icon: 'https://render.guildwars2.com/file/F45967B8DC5F20476780D493FB79B4991822CF5E/2503623.png'
        },
        {
          id: 2276,
          name: 'Mech Frame: Channeling Conduits',
          icon: 'https://render.guildwars2.com/file/EA4C0233E57A24A4C4417C0CC955B2D8C12D5B34/2503625.png'
        },
        {
          id: 2294,
          name: 'Mech Frame: Variable Mass Distributor',
          icon: 'https://render.guildwars2.com/file/715CE76B90B40EE7E30AE1D1FA3F7432D30C5D94/2503624.png'
        }
      ],
      [
        {
          id: 2292,
          name: 'Mech Core: Jade Dynamo',
          icon: 'https://render.guildwars2.com/file/521FEBAE995F2BFB38F9EF3176DBDCFC075173F4/2503626.png'
        },
        {
          id: 2281,
          name: 'Mech Core: Barrier Engine',
          icon: 'https://render.guildwars2.com/file/EEE0C0D90EB9E244B3F11BA0AF7C77E3D83AF576/2503627.png'
        },
        {
          id: 2298,
          name: 'Mech Core: J-Drive',
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
        icon: 'https://render.guildwars2.com/file/389B4548DDBC08AEA668F3AF1802394E0955B591/3679952.png'
      },
      {
        id: 2389,
        name: 'Hybrid Vigor',
        icon: 'https://render.guildwars2.com/file/69F518AF096998F9B127C7CB1C05EA7348D170C7/3679953.png'
      },
      {
        id: 2356,
        name: 'Willing Host',
        icon: 'https://render.guildwars2.com/file/49DEE2C90E04E876DE2517C201060E330A7D9FDE/3679954.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2366,
          name: 'Stainless Steel',
          icon: 'https://render.guildwars2.com/file/C280022834C550F145319BE3AC0401EB3D9B92CE/3679943.png'
        },
        {
          id: 2395,
          name: 'Innervating Alloy',
          icon: 'https://render.guildwars2.com/file/0AB2B3EE2E255AD7A766F93D7BE0A0AD59CF6637/3679944.png'
        },
        {
          id: 2434,
          name: 'Hardened Chrome',
          icon: 'https://render.guildwars2.com/file/2FB406D8030E90F0AAB8AF487E0276F023140BE9/3679945.png'
        }
      ],
      [
        {
          id: 2383,
          name: 'Carbolic Composition',
          icon: 'https://render.guildwars2.com/file/9D0E774CFF5A9FD6C8739DD5D9EBEB3D270CACF6/3679946.png'
        },
        {
          id: 2420,
          name: 'Mercurial Tendencies',
          icon: 'https://render.guildwars2.com/file/B2CBCEF3DACEECD7BFBBD1CF946AD1CBFF0AD866/3679947.png'
        },
        {
          id: 2349,
          name: 'Silver Lining',
          icon: 'https://render.guildwars2.com/file/EBC7B54429A00A7C1CB021A2EF7B470E7831B064/3679948.png'
        }
      ],
      [
        {
          id: 2406,
          name: 'Symbiotic Synergy',
          icon: 'https://render.guildwars2.com/file/457A0302F976CCF42D065D0E01DD08390666DFCD/3679949.png'
        },
        {
          id: 2387,
          name: 'New Genes',
          icon: 'https://render.guildwars2.com/file/B6E5BA5FF8F4179F2521F61696EEC3D7DEE50F07/3679950.png'
        },
        {
          id: 2334,
          name: 'Double Helix',
          icon: 'https://render.guildwars2.com/file/000E5AC3B7BE616A329F46ECAD06EB07507ADF73/3679951.png'
        }
      ]
    ]
  }
];
