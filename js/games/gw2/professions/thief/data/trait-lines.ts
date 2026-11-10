/** Maintained core and elite trait lines supply trait presentation and selection layout. */
import type { Gw2SpecializationData } from '#gw2/platform/profession-definition/specialization-data-types.js';

export const TRAIT_LINES: readonly Gw2SpecializationData[] = [
  {
    id: 7,
    name: 'Daredevil',
    elite: true,
    icon: 'https://render.guildwars2.com/file/F1985D4E1CE043D7145E030C0AC4CFDABED73A59/1012025.png',
    minorTraits: [
      {
        id: 1994,
        name: 'Physical Supremacy',
        icon: 'https://render.guildwars2.com/file/0CDF226340671D9E0BAA3BBD6904CAD9DB6780C2/1058555.png'
      },
      {
        id: 1887,
        name: 'Weakening Strikes',
        icon: 'https://render.guildwars2.com/file/140F77BB56B93C32BFDAC30CB332FCBAAF0921A5/1058547.png'
      },
      {
        id: 1837,
        name: 'Endurance Thief',
        icon: 'https://render.guildwars2.com/file/FC48D05C3260AB41A0D4A6D7807495C7B60CBE76/1058557.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1933,
          name: "Marauder's Resilience",
          icon: 'https://render.guildwars2.com/file/6EADF7BD91FA0F02C3CF954A131E4DE7A7174A4D/2128018.png'
        },
        {
          id: 2023,
          name: "Escapist's Fortitude",
          icon: 'https://render.guildwars2.com/file/997ABE456858707D663FAD58BFA809BAB83455C1/1058556.png'
        },
        {
          id: 1949,
          name: "Brawler's Tenacity",
          icon: 'https://render.guildwars2.com/file/EBE8476C463D73783639F51D7B7ED451F24107E1/1058548.png'
        }
      ],
      [
        {
          id: 1884,
          name: 'Staff Master',
          icon: 'https://render.guildwars2.com/file/5A6DC148221020B0E616EC77507CCAE9E026BDBD/1058549.png'
        },
        {
          id: 1893,
          name: 'Havoc Specialist',
          icon: 'https://render.guildwars2.com/file/B15E2425525CF5A3E4EAD67C4BE6B13A1B931875/1058546.png'
        },
        {
          id: 1975,
          name: 'Impacting Disruption',
          icon: 'https://render.guildwars2.com/file/BED87F28D907FE0CE59346786D0345749A2E6DDC/1058551.png'
        }
      ],
      [
        {
          id: 1833,
          name: 'Lotus Training',
          icon: 'https://render.guildwars2.com/file/E5724D46CEE62333E00CE26905C5FDD5439F6667/1058552.png'
        },
        {
          id: 1964,
          name: 'Unhindered Combatant',
          icon: 'https://render.guildwars2.com/file/0D7324A22F580F3DA3F244C466770FB69292C307/1058553.png'
        },
        {
          id: 2047,
          name: 'Bounding Dodger',
          icon: 'https://render.guildwars2.com/file/F3E22D0FDFDB436780BD4ACBA5D135EE40507FFD/1058554.png'
        }
      ]
    ]
  },
  {
    id: 20,
    name: 'Shadow Arts',
    elite: false,
    icon: 'https://render.guildwars2.com/file/B62E5512754BEB1D0116B1DB3B6FA0ECA4DD630C/1012027.png',
    minorTraits: [
      {
        id: 1294,
        name: 'Merciful Ambush',
        icon: 'https://render.guildwars2.com/file/475E47AC729BC71FB80E503311CBA503B7A033D8/2175054.png'
      },
      {
        id: 1136,
        name: 'Meld with Shadows',
        icon: 'https://render.guildwars2.com/file/75543C6D39236CF562B56A95A6B3A8066CB53360/1012760.png'
      },
      {
        id: 1705,
        name: 'Shadow Siphoning',
        icon: 'https://render.guildwars2.com/file/C5D70A53661C1250D24A12977D5A10C9057F632C/2175056.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1160,
          name: 'Shielding Restoration',
          icon: 'https://render.guildwars2.com/file/3B7C573FBF124EC43F4102D530DE5E333F31014F/1012750.png'
        },
        {
          id: 1293,
          name: "Shadow's Embrace",
          icon: 'https://render.guildwars2.com/file/96B9AE530DE47F930813E12EB224606B1BEAF303/1012752.png'
        },
        {
          id: 1284,
          name: 'Hidden Thief',
          icon: 'https://render.guildwars2.com/file/7DFEDA0FEFF2CBCF0F7A6F71B333A758B2B0F90F/1012754.png'
        }
      ],
      [
        {
          id: 1297,
          name: 'Shadow Savior',
          icon: 'https://render.guildwars2.com/file/D3070EE4956FF44628AD3ED06FD60C7D94F20296/2175055.png'
        },
        {
          id: 1130,
          name: 'Leeching Venoms',
          icon: 'https://render.guildwars2.com/file/09B09DBDA3B81470A27514925DAD37DE0D6121FB/1012755.png'
        },
        {
          id: 1300,
          name: 'Cloaked in Shadow',
          icon: 'https://render.guildwars2.com/file/9D72C40FF99627FDF9FD0C46F4C3B33527BA4814/1012753.png'
        }
      ],
      [
        {
          id: 1134,
          name: 'Cover of Shadow',
          icon: 'https://render.guildwars2.com/file/5DD2D1EEAD47B80C375190F9183D0C010FF714EA/1012756.png'
        },
        {
          id: 1135,
          name: "Shadow's Rejuvenation",
          icon: 'https://render.guildwars2.com/file/E4742848370F4876CFEFFB63BD7D3FF9495EA43A/1012757.png'
        },
        {
          id: 1162,
          name: 'Rending Shade',
          icon: 'https://render.guildwars2.com/file/672F123A490A0505DCC29DEEDD4C609FD9C32F40/1012758.png'
        }
      ]
    ]
  },
  {
    id: 28,
    name: 'Deadly Arts',
    elite: false,
    icon: 'https://render.guildwars2.com/file/38F6FA9A5D04CEC605AF6E5D994119281A38A9FA/1012026.png',
    minorTraits: [
      {
        id: 1279,
        name: "Serpent's Touch",
        icon: 'https://render.guildwars2.com/file/0FEE00DFE899386F321C0F719EC70FED03AB03E7/1012747.png'
      },
      {
        id: 1280,
        name: 'Lotus Poison',
        icon: 'https://render.guildwars2.com/file/F1441E7BBAA8502E50B6105C246B0ED9AF110154/1012748.png'
      },
      {
        id: 1257,
        name: 'Exposed Weakness',
        icon: 'https://render.guildwars2.com/file/B6765208D0266538000932E40ED202D95701276B/1012749.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1245,
          name: 'Dagger Training',
          icon: 'https://render.guildwars2.com/file/16A01B18FBA9F8AE4878CD00DC422827A5344F75/1012738.png'
        },
        {
          id: 1276,
          name: 'Mug',
          icon: 'https://render.guildwars2.com/file/CF71C3B0EF58A1A4D7E5EC11B6EB10FB990F3C16/1012739.png'
        },
        {
          id: 1164,
          name: 'Deadly Ambition',
          icon: 'https://render.guildwars2.com/file/27C24EB60E92A72709149FBB42F6FBC8185D3B45/2175052.png'
        }
      ],
      [
        {
          id: 1169,
          name: 'Even the Odds',
          icon: 'https://render.guildwars2.com/file/3413B9D6B5E63209751F98319C09F81413D8CF0C/2175053.png'
        },
        {
          id: 1292,
          name: 'Panic Strike',
          icon: 'https://render.guildwars2.com/file/B3C6616D917A63B55B140E1835B709CE95631593/1012742.png'
        },
        {
          id: 1704,
          name: 'Revealed Training',
          icon: 'https://render.guildwars2.com/file/774712F5EDE9F5D4105E7D75241CB15505269304/1012743.png'
        }
      ],
      [
        {
          id: 1291,
          name: 'Potent Poison',
          icon: 'https://render.guildwars2.com/file/2678F1C70CB07E090FC7F4ACCCDCA9750AA0040F/1012744.png'
        },
        {
          id: 1167,
          name: 'Improvisation',
          icon: 'https://render.guildwars2.com/file/B5A5D6B7FEA7CE96C56675D0FE1C40AD15E5B013/1012745.png'
        },
        {
          id: 1269,
          name: 'Executioner',
          icon: 'https://render.guildwars2.com/file/C44E0FC7EC5B1870214E24AD4144C55E110AD9C2/1012746.png'
        }
      ]
    ]
  },
  {
    id: 35,
    name: 'Critical Strikes',
    elite: false,
    icon: 'https://render.guildwars2.com/file/1CDB2736E6CAF79A1B549B06CDED717B3418F7B1/1012024.png',
    minorTraits: [
      {
        id: 1281,
        name: 'Keen Observer',
        icon: 'https://render.guildwars2.com/file/B809D24257F305F97259FE7C141D7CAF04431F0D/1012735.png'
      },
      {
        id: 1210,
        name: 'Unrelenting Strikes',
        icon: 'https://render.guildwars2.com/file/B0D09233CBA4CD0835194B6422C30901ADC65EA6/1012736.png'
      },
      {
        id: 1282,
        name: 'Ferocious Strikes',
        icon: 'https://render.guildwars2.com/file/519532119E92CFFF9375E2E3CFC4326B46659F63/1012737.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1209,
          name: "Assassin's Fury",
          icon: 'https://render.guildwars2.com/file/0BD04FC849006C57DA6C42C00F03C00D5DD70C72/1012726.png'
        },
        {
          id: 1267,
          name: 'Signets of Power',
          icon: 'https://render.guildwars2.com/file/5F00410B6CFCF73BEB725DECCFE77A040AF1C5FA/1012727.png'
        },
        {
          id: 1268,
          name: 'Twin Fangs',
          icon: 'https://render.guildwars2.com/file/02B7C80EE8BECD4CA7935FD980D9D555BF776001/1012728.png'
        }
      ],
      [
        {
          id: 1170,
          name: 'Sundering Shade',
          icon: 'https://render.guildwars2.com/file/1AD6FE275DC1B2AAA51A010D7907BF91B5DFBC55/1012729.png'
        },
        {
          id: 1272,
          name: 'Practiced Tolerance',
          icon: 'https://render.guildwars2.com/file/1B7D0D46BBD9CEB13AE1DD294BDE30E417A432E4/1012730.png'
        },
        {
          id: 1299,
          name: 'Deadly Aim',
          icon: 'https://render.guildwars2.com/file/C401C322D2F5174B37E646C2380692F467FD5012/1012731.png'
        }
      ],
      [
        {
          id: 1904,
          name: 'No Quarter',
          icon: 'https://render.guildwars2.com/file/B25D2C7A39F5E8EEEA384ABD41C017DA1CED72A8/1012732.png'
        },
        {
          id: 1215,
          name: 'Hidden Killer',
          icon: 'https://render.guildwars2.com/file/03E22FDC6642C0F4BFD197DA5470A97910EB1877/1012733.png'
        },
        {
          id: 1702,
          name: 'Invigorating Precision',
          icon: 'https://render.guildwars2.com/file/B858D55DB13298D4AD42ECD808B2D94FE80BF9AD/1012734.png'
        }
      ]
    ]
  },
  {
    id: 44,
    name: 'Trickery',
    elite: false,
    icon: 'https://render.guildwars2.com/file/06BF06CDA7150617C5E075265C1E2F15E84B3D64/1012028.png',
    minorTraits: [
      {
        id: 1137,
        name: 'Kleptomaniac',
        icon: 'https://render.guildwars2.com/file/B0D5E5DF57F45ED6C39BCCC5D467A4CCABEA130C/1012771.png'
      },
      {
        id: 1232,
        name: 'Preparedness',
        icon: 'https://render.guildwars2.com/file/6B47FB123522D290119FE8936D990D1C9CED2F60/1012772.png'
      },
      {
        id: 1157,
        name: 'Lead Attacks',
        icon: 'https://render.guildwars2.com/file/0E204D3ECBE43544E2366F250C3AEDDFC3A051FA/1012773.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1159,
          name: 'Uncatchable',
          icon: 'https://render.guildwars2.com/file/EC22A2BBEB08C71E270EA29FE6E5C80BC192BBEB/1012762.png'
        },
        {
          id: 1252,
          name: 'Burst of Agility',
          icon: 'https://render.guildwars2.com/file/4B0201023C2E4B06BFE3EED499B2382D1F98FCB4/1012763.png'
        },
        {
          id: 1163,
          name: 'Thrill of the Crime',
          icon: 'https://render.guildwars2.com/file/74C7DDBF73251A15033273763B352B50C8E659A4/1012764.png'
        }
      ],
      [
        {
          id: 1277,
          name: 'Bountiful Theft',
          icon: 'https://render.guildwars2.com/file/C1D1E47EA4F66866ECE25FAF5359F54DBC2140B3/1012765.png'
        },
        {
          id: 1286,
          name: 'Trickster',
          icon: 'https://render.guildwars2.com/file/F2DAE84AE2A6D6C7F336F1C6076962F50FA6AA0A/1012766.png'
        },
        {
          id: 1190,
          name: 'Pressure Striking',
          icon: 'https://render.guildwars2.com/file/22BAF280A66B3FD257B9FA2E911264AE1DC234EF/1012767.png'
        }
      ],
      [
        {
          id: 1187,
          name: 'Quick Pockets',
          icon: 'https://render.guildwars2.com/file/EE970B0E607C51D8490C6D2CF4403E0BF9E8DD4C/1012721.png'
        },
        {
          id: 1158,
          name: 'Sleight of Hand',
          icon: 'https://render.guildwars2.com/file/46240F185E216A1B2375E832F3B1B413FAF303C7/1012769.png'
        },
        {
          id: 1706,
          name: 'Deadly Ambush',
          icon: 'https://render.guildwars2.com/file/55FB4EE6F25EEFB23CB0F8317FC16968EF3A5791/1012770.png'
        }
      ]
    ]
  },
  {
    id: 54,
    name: 'Acrobatics',
    elite: false,
    icon: 'https://render.guildwars2.com/file/E109FF4E65CD3FA4AAC20E9D219C4D5207E1E461/1012023.png',
    minorTraits: [
      {
        id: 1240,
        name: 'Deft Initiation',
        icon: 'https://render.guildwars2.com/file/46E42E0D330FA8C60B6477BF6E206FDA98E114D6/1012723.png'
      },
      {
        id: 1234,
        name: 'Feline Grace',
        icon: 'https://render.guildwars2.com/file/7C2022C101DCE37874391DEAB44A4A66E2929472/1012724.png'
      },
      {
        id: 1242,
        name: 'Fluid Strikes',
        icon: 'https://render.guildwars2.com/file/64A151F4F69F7F6E36986108224DA606660EDD64/1012725.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1112,
          name: 'Opportune Opening',
          icon: 'https://render.guildwars2.com/file/E80BD3449E33470B1ECA0FF242CC6B031B459514/1012714.png'
        },
        {
          id: 1289,
          name: 'Endurance Training',
          icon: 'https://render.guildwars2.com/file/F6031E3A99700AD327760C9D276F1A21A2EAF8BD/1012715.png'
        },
        {
          id: 1237,
          name: 'Pain Response',
          icon: 'https://render.guildwars2.com/file/E6D3C67F5EF7DCBCF09C40D1529393CEDD9ABFCC/1012716.png'
        }
      ],
      [
        {
          id: 1238,
          name: "Assassin's Reward",
          icon: 'https://render.guildwars2.com/file/319EE2C0AC583CDBD7741BB23051FA026022F20A/1012720.png'
        },
        {
          id: 1192,
          name: "Swindler's Equilibrium",
          icon: 'https://render.guildwars2.com/file/E00D420461F4C04AB601FB0EB3BEFE3903E8CE1A/1012718.png'
        },
        {
          id: 1290,
          name: 'Hard to Catch',
          icon: 'https://render.guildwars2.com/file/091B2B7A2BD14657D06D2127B097D9321D175903/1012719.png'
        }
      ],
      [
        {
          id: 'thief.acrobatics.sharp-initiation',
          name: 'Sharp Initiation',
          icon: 'https://render.guildwars2.com/file/319EE2C0AC583CDBD7741BB23051FA026022F20A/1012720.png'
        },
        {
          id: 1295,
          name: 'Upper Hand',
          icon: 'https://render.guildwars2.com/file/B6017A7603085677A0A5DD7F670C769E597A3309/1012768.png'
        },
        {
          id: 1703,
          name: "Don't Stop",
          icon: 'https://render.guildwars2.com/file/B152120F945398A4380B09371C0F6F253A44AA4C/1012722.png'
        }
      ]
    ]
  },
  {
    id: 58,
    name: 'Deadeye',
    elite: true,
    icon: 'https://render.guildwars2.com/file/F93EF1717238E9ACC1CA330D4416D324AE08585D/1769895.png',
    minorTraits: [
      {
        id: 2171,
        name: "Deadeye's Gaze",
        icon: 'https://render.guildwars2.com/file/0AD214FC6FC10814E5397A1FC573D303B4A06EEC/1770009.png'
      },
      {
        id: 2172,
        name: 'Renewing Gaze',
        icon: 'https://render.guildwars2.com/file/94445580FABDA4724ED3DA3DF9B126C29004614D/1770010.png'
      },
      {
        id: 2084,
        name: 'Iron Sight',
        icon: 'https://render.guildwars2.com/file/3402AD187DDB42150AB5DE35143DBA0F80048015/1983627.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2145,
          name: 'Malicious Intent',
          icon: 'https://render.guildwars2.com/file/A36DB29059090F04E4565724E3673CFD189E6177/1770000.png'
        },
        {
          id: 2173,
          name: 'Collateral Damage',
          icon: 'https://render.guildwars2.com/file/1E6104F9F36395A3A175649DE6232BD0DDC61180/1983625.png'
        },
        {
          id: 2136,
          name: 'One in the Chamber',
          icon: 'https://render.guildwars2.com/file/72377B6191DEF64EA87DEEA70BFB7699937D6207/1770002.png'
        }
      ],
      [
        {
          id: 2118,
          name: 'Silent Scope',
          icon: 'https://render.guildwars2.com/file/589A60502EB2EE62CABC78F43321045FE037ABD1/1770003.png'
        },
        {
          id: 2078,
          name: 'Payback',
          icon: 'https://render.guildwars2.com/file/961C4A2F1458FB0AEAF80AF938390096DC4BFF6E/1770004.png'
        },
        {
          id: 2160,
          name: 'Premeditation',
          icon: 'https://render.guildwars2.com/file/C72B4CD0151A0C4C5074D105649D9306C3284896/1983626.png'
        }
      ],
      [
        {
          id: 2111,
          name: 'Maleficent Seven',
          icon: 'https://render.guildwars2.com/file/2602433ECE52C0CBAD52626061C1E5C97E195E9A/1770006.png'
        },
        {
          id: 2093,
          name: 'Be Quick or Be Killed',
          icon: 'https://render.guildwars2.com/file/073DDC6D4D1319EB2B039373FD5C7173009DBFA7/1770007.png'
        },
        {
          id: 2146,
          name: 'Fire for Effect',
          icon: 'https://render.guildwars2.com/file/C50DB05A985BE0B8ADB2164DC8D671AC61049C4B/1770008.png'
        }
      ]
    ]
  },
  {
    id: 71,
    name: 'Specter',
    elite: true,
    icon: 'https://render.guildwars2.com/file/E915E494C64037C93AB53FB6F2D414B468DBCA48/2503610.png',
    minorTraits: [
      {
        id: 2184,
        name: 'Specter',
        icon: 'https://render.guildwars2.com/file/A610A7B4D00D5BAE0FDBDE0BF64EAF063C96B308/2503653.png'
      },
      {
        id: 2272,
        name: 'Dark Sentry',
        icon: 'https://render.guildwars2.com/file/0F0B6509C8D5023D949153929E02FD2195AF63FE/2503654.png'
      },
      {
        id: 2280,
        name: "Panaku's Ambition",
        icon: 'https://render.guildwars2.com/file/630D6100268010ED04B2ABE529BD4AE9110BF65F/2503655.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2284,
          name: 'Second Opinion',
          icon: 'https://render.guildwars2.com/file/91D1F2C2D65D18F2F5CB02B43F6CF253F4E12043/2503644.png'
        },
        {
          id: 2299,
          name: 'Shallow Grave',
          icon: 'https://render.guildwars2.com/file/D31FC1BD407E28B2F4F967FCA76CB3347AE8C9A7/2503645.png'
        },
        {
          id: 2275,
          name: 'Consume Shadows',
          icon: 'https://render.guildwars2.com/file/0DE6EECA322FE219A7DF6FFA9EE04B975FA2E06B/2503646.png'
        }
      ],
      [
        {
          id: 2290,
          name: 'Larcenous Torment',
          icon: 'https://render.guildwars2.com/file/2E41AD9FAC08F79333EAC791C4B9967EE60E98AA/2503647.png'
        },
        {
          id: 2288,
          name: 'Amplified Siphoning',
          icon: 'https://render.guildwars2.com/file/D87B7B5603FCC14BC2F8B239C0522006F45ACBC1/2503648.png'
        },
        {
          id: 2285,
          name: 'Traversing Dusk',
          icon: 'https://render.guildwars2.com/file/DCA50F003BB8C0C5AC302A990BEEFF4D380E5071/2503649.png'
        }
      ],
      [
        {
          id: 2264,
          name: 'Strength of Shadows',
          icon: 'https://render.guildwars2.com/file/BAF9A03EB934BFBA801461A5CCE0FD0B7E461506/2503650.png'
        },
        {
          id: 2300,
          name: 'Hungering Darkness',
          icon: 'https://render.guildwars2.com/file/2D14F85E2F069B20BD06F3DBC91B5453B0BB49F0/2503651.png'
        },
        {
          id: 2289,
          name: 'Shadestep',
          icon: 'https://render.guildwars2.com/file/5C3F020C08045735BAA12A92A3FF9674EEAE4672/2503652.png'
        }
      ]
    ]
  },
  {
    id: 77,
    name: 'Antiquary',
    elite: true,
    icon: 'https://render.guildwars2.com/file/569D3C9A9E7121939844809F0D05E81480C8F6F8/3679903.png',
    minorTraits: [
      {
        id: 2403,
        name: 'Trinket Collector',
        icon: 'https://render.guildwars2.com/file/359CC672C30816395DE613909DAC17791A2B5609/3680024.png'
      },
      {
        id: 2337,
        name: "Magpie's Defense",
        icon: 'https://render.guildwars2.com/file/3A4DAC71019B64EA1893E06638234E1BE4DB6251/3680025.png'
      },
      {
        id: 2362,
        name: 'Enterprising Aristocrat',
        icon: 'https://render.guildwars2.com/file/CEED9A51F13AD702C52A015C26B5AD3880260169/3680026.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2423,
          name: 'Card Swap',
          icon: 'https://render.guildwars2.com/file/5662430D23996FB7B0042B22A205557C50B8C2A9/3680015.png'
        },
        {
          id: 2365,
          name: 'Repeat Ransacker',
          icon: 'https://render.guildwars2.com/file/6AEAF7E01D590A0DB654B1B3B591919819DFB296/3680016.png'
        },
        {
          id: 2346,
          name: 'Prolific Plunderer',
          icon: 'https://render.guildwars2.com/file/5DE6C298930CBD77DE940F471F4B789A6CD5B1C3/3680017.png'
        }
      ],
      [
        {
          id: 2400,
          name: "Scoundrel's Luck",
          icon: 'https://render.guildwars2.com/file/4AAA71A143C45B000A10AF5D0F75060CF72144A7/3680018.png'
        },
        {
          id: 2431,
          name: 'Meticulous Custodian',
          icon: 'https://render.guildwars2.com/file/F918D37414AFFAE66AB79141430302CA3380FF80/3680019.png'
        },
        {
          id: 2350,
          name: 'Exhilarating Ephemera',
          icon: 'https://render.guildwars2.com/file/08475BFD2DA578D96933C0D42FB33770AF68A454/3680020.png'
        }
      ],
      [
        {
          id: 2409,
          name: 'Prodigious Pincher',
          icon: 'https://render.guildwars2.com/file/E6727CC4670FCA6FE2CC79302ABCBF99D14D05DA/3680021.png'
        },
        {
          id: 2393,
          name: 'Possessive Hoarder',
          icon: 'https://render.guildwars2.com/file/14EE00EF0E792D7DE9C8A03CB0404C72ECF128B7/3680022.png'
        },
        {
          id: 2348,
          name: 'Combat High',
          icon: 'https://render.guildwars2.com/file/EDF09834A4A650256C98A3680C2DF4A4C5339BAC/3680023.png'
        }
      ]
    ]
  }
];
