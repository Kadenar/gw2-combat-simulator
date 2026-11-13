/** Maintained core and elite trait lines supply trait presentation and selection layout. */
import type { Gw2SpecializationData } from '#gw2/platform/profession-definition/specialization-data-types.js';

export const TRAIT_LINES: readonly Gw2SpecializationData[] = [
  {
    id: 3,
    name: 'Invocation',
    elite: false,
    icon: 'https://render.guildwars2.com/file/2C4DCE5C0C255F32B51DCF9E4360106823EAF926/1012018.png',
    minorTraits: [
      {
        id: 1778,
        name: "Invoker's Rage",
        icon: 'https://render.guildwars2.com/file/1C983FECB39112676C09A1F018B9DACC25060C2E/1012689.png'
      },
      {
        id: 1758,
        name: 'Ferocious Aggression',
        icon: 'https://render.guildwars2.com/file/566080076076F09618C36E16C0322F139EC44499/1012688.png'
      },
      {
        id: 1769,
        name: 'Contained Temper',
        icon: 'https://render.guildwars2.com/file/6DD65C66DD0E56A3150AC74D621DE90C260FA5B9/1012687.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1732,
          name: 'Cleansing Channel',
          icon: 'https://render.guildwars2.com/file/E108DF48F2E31ABCBACBF99B1464303A1E32B3F9/1012679.png'
        },
        {
          id: 1761,
          name: 'Rising Tide',
          icon: 'https://render.guildwars2.com/file/9003FBF9A0ED253A97A5DD1599D74F9305135363/1058538.png'
        },
        {
          id: 1784,
          name: 'Glaring Resolve',
          icon: 'https://render.guildwars2.com/file/9B49A55EEF5A2B31C2C0DBE0C10E6FFF3F4E2E5D/1012682.png'
        }
      ],
      [
        {
          id: 1774,
          name: 'Spirit Boon',
          icon: 'https://render.guildwars2.com/file/62279406A52F47A00CE7BFFB43D405907A67A60F/1012681.png'
        },
        {
          id: 1760,
          name: 'Rapid Flow',
          icon: 'https://render.guildwars2.com/file/ECF6AFAA0B2966663D21755110900ECCFC071208/1012684.png'
        },
        {
          id: 1781,
          name: 'Incensed Response',
          icon: 'https://render.guildwars2.com/file/06F6A0B293C09DA5225848647EAD0D2CBAE56E09/1012683.png'
        }
      ],
      [
        {
          id: 1749,
          name: 'Song of the Mists',
          icon: 'https://render.guildwars2.com/file/B633049F7DD54DEBF9D83C0356E4BFB3360CD1D5/1012686.png'
        },
        {
          id: 1791,
          name: 'Charged Mists',
          icon: 'https://render.guildwars2.com/file/4F1929DF784D227296A96E03B89154232D0B4856/1012678.png'
        },
        {
          id: 1719,
          name: 'Roiling Mists',
          icon: 'https://render.guildwars2.com/file/EAEF09AF62A04394DB04BD555D2FEAAEA9E608E5/1012685.png'
        }
      ]
    ]
  },
  {
    id: 9,
    name: 'Retribution',
    elite: false,
    icon: 'https://render.guildwars2.com/file/70B5F7E02769762D5FEE056D0136093BF3F580FF/1029933.png',
    minorTraits: [
      {
        id: 1783,
        name: 'Enduring Recovery',
        icon: 'https://render.guildwars2.com/file/76F4DA7A601A64A30737DC4DBC4A0D2527226857/1012700.png'
      },
      {
        id: 1757,
        name: 'Unwavering Avoidance',
        icon: 'https://render.guildwars2.com/file/F5F15B63330A9A3DC7581F23120472AB5C676839/1012701.png'
      },
      {
        id: 1713,
        name: 'Determined Resolution',
        icon: 'https://render.guildwars2.com/file/F3DB5663A9C9C8630247D463050B05A12C69E542/1012699.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1811,
          name: 'Planar Protection',
          icon: 'https://render.guildwars2.com/file/6FCF4CED0607CA91AD1F2F03FCE118637BDDB5D8/1012694.png'
        },
        {
          id: 1728,
          name: 'Close Quarters',
          icon: 'https://render.guildwars2.com/file/4DD75C0C7D64F2A80F24955E0CAE031530554AF7/1012690.png'
        },
        {
          id: 1810,
          name: 'Spiritual Reckoning',
          icon: 'https://render.guildwars2.com/file/3CF2F8DD1BF2DE9E3B673C7A53F208630D6232E1/1012693.png'
        }
      ],
      [
        {
          id: 1766,
          name: 'Set in Stone',
          icon: 'https://render.guildwars2.com/file/CEBB22E824DE1A024A4DC8907C5C3D795E01AEDA/1012692.png'
        },
        {
          id: 1782,
          name: 'Resolute Evasion',
          icon: 'https://render.guildwars2.com/file/CA9478C84998F038B949E4BAD01CEFB70811386E/1012697.png'
        },
        {
          id: 1740,
          name: 'Dwarven Battle Training',
          icon: 'https://render.guildwars2.com/file/35F67F4090491139F8E7CBDF943596A2CB2CB90A/1012695.png'
        }
      ],
      [
        {
          id: 1779,
          name: 'Vicious Reprisal',
          icon: 'https://render.guildwars2.com/file/6BAF2CA6D13BABE948BC61BDA3704CD4B045D2C9/1012691.png'
        },
        {
          id: 1770,
          name: 'Versed in Stone',
          icon: 'https://render.guildwars2.com/file/07070DE858DC9D610B0F257F98A347CF2ED1D436/1012696.png'
        },
        {
          id: 1790,
          name: 'Steadfast Rejuvenation',
          icon: 'https://render.guildwars2.com/file/4CB0D2FC4C01EBA3D280FFA86C907AE92055AD9B/1012698.png'
        }
      ]
    ]
  },
  {
    id: 12,
    name: 'Salvation',
    elite: false,
    icon: 'https://render.guildwars2.com/file/0F0144B0E123163E0454B0C3D532282555BE7CE5/1029934.png',
    minorTraits: [
      {
        id: 1816,
        name: "Healer's Gift",
        icon: 'https://render.guildwars2.com/file/1CF0A1D20DF765AC21B31A5AB6E7305073A851DB/2128017.png'
      },
      {
        id: 1821,
        name: 'Life Attunement',
        icon: 'https://render.guildwars2.com/file/7529573E19C6A492FC4F490026149F36DE434C59/1012713.png'
      },
      {
        id: 1814,
        name: 'Serene Rejuvenation',
        icon: 'https://render.guildwars2.com/file/C20B7DA3510A10D0CB090D4F67F1D3060D46E061/1012711.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1823,
          name: 'Invoking Harmony',
          icon: 'https://render.guildwars2.com/file/4BA0B6F2AD93F72CA3D5C3C40D30B40B14920825/2128015.png'
        },
        {
          id: 1824,
          name: 'Blinding Truths',
          icon: 'https://render.guildwars2.com/file/7023FCC1626267C90CE77201A990A83D300CA5D2/1012703.png'
        },
        {
          id: 1822,
          name: 'Eluding Nullification',
          icon: 'https://render.guildwars2.com/file/FE0DF793F5C322030AB63A5209F0052798A90B05/1012704.png'
        }
      ],
      [
        {
          id: 1819,
          name: 'Words of Censure',
          icon: 'https://render.guildwars2.com/file/3DE4920AF60A437EDD94BBF435FAC19821DA7809/2128016.png'
        },
        {
          id: 1817,
          name: 'Resilient Spirit',
          icon: 'https://render.guildwars2.com/file/181F40F0C0E261E457010DA1D9144D680B0E0415/1012709.png'
        },
        {
          id: 1818,
          name: 'Fortified Blessing',
          icon: 'https://render.guildwars2.com/file/B1585B351A1A77A10FDECC9C07B43BD4083D4DCF/1012702.png'
        }
      ],
      [
        {
          id: 1815,
          name: 'Generous Abundance',
          icon: 'https://render.guildwars2.com/file/0F2DC0620428E1235AE6DFA4F0947C5DBE2FB076/2128013.png'
        },
        {
          id: 1825,
          name: 'Unyielding Devotion',
          icon: 'https://render.guildwars2.com/file/11404242F05CA14C5ED90B3A0B74CDE8E3D8154C/2128014.png'
        },
        {
          id: 1820,
          name: 'Invigorating Dismissal',
          icon: 'https://render.guildwars2.com/file/CED766D430CC0E6CE1BAD33452EF9853B7ED6D59/2128012.png'
        }
      ]
    ]
  },
  {
    id: 14,
    name: 'Corruption',
    elite: false,
    icon: 'https://render.guildwars2.com/file/FF4CBE97A807903DF3495E0ECC380E080291C698/1029931.png',
    minorTraits: [
      {
        id: 1799,
        name: 'Invoking Torment',
        icon: 'https://render.guildwars2.com/file/414A9704F7C62C49DB2604DACDAFABDE7A400499/2261512.png'
      },
      {
        id: 1801,
        name: 'Seething Malice',
        icon: 'https://render.guildwars2.com/file/E9BF4007B51B156ED5D93C580E68E3403E27A6A8/2261513.png'
      },
      {
        id: 1744,
        name: 'Yearning Empowerment',
        icon: 'https://render.guildwars2.com/file/55BD4591B1B25C2151B7C804C56E05EEA24FEA17/1012677.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1793,
          name: 'Acolyte of Torment',
          icon: 'https://render.guildwars2.com/file/67FF4CDD0605750C7E4FEBE9AB51EDF8FEEBFD5E/2261509.png'
        },
        {
          id: 1789,
          name: 'Demonic Defiance',
          icon: 'https://render.guildwars2.com/file/06D0E6CC4CB45F3949B41436B2C3091B1B6C9B7D/1012667.png'
        },
        {
          id: 1741,
          name: 'Replenishing Despair',
          icon: 'https://render.guildwars2.com/file/0B140B2603466018C2016223B00FE74F6BFEBF29/1012672.png'
        }
      ],
      [
        {
          id: 1727,
          name: 'Abyssal Chill',
          icon: 'https://render.guildwars2.com/file/93C7A4D5939D23FCCEEAE773E17F256C1FFBC80A/1012669.png'
        },
        {
          id: 1726,
          name: 'Demonic Resistance',
          icon: 'https://render.guildwars2.com/file/ECAAB201A864A10C54A2A0027C335B647F3F49DA/2029283.png'
        },
        {
          id: 1714,
          name: 'Pact of Pain',
          icon: 'https://render.guildwars2.com/file/7CD12917F5E2E6D36E0CBA1002F8F3919535A6FC/2261511.png'
        }
      ],
      [
        {
          id: 1795,
          name: 'Diabolic Inferno',
          icon: 'https://render.guildwars2.com/file/54A099299512645C3D4B3D2728C0B43BF7D9F5F0/1012668.png'
        },
        {
          id: 1720,
          name: 'Fiendish Tenacity',
          icon: 'https://render.guildwars2.com/file/75E2EF317AFEF4C5303ACF7EB0D13EE896DD2262/2261510.png'
        },
        {
          id: 1721,
          name: 'Permeating Pestilence',
          icon: 'https://render.guildwars2.com/file/37FE24EB96C3FACE620EE69EA65A9EA820F89DA5/1012671.png'
        }
      ]
    ]
  },
  {
    id: 15,
    name: 'Devastation',
    elite: false,
    icon: 'https://render.guildwars2.com/file/C95CAFC4DC0D2AF5DB0C66CB0E0B0FA699E45D6C/1029932.png',
    minorTraits: [
      {
        id: 1808,
        name: 'Expose Defenses',
        icon: 'https://render.guildwars2.com/file/B8463001BF6D75546EBB63E094720AF1EEA12E44/1029964.png'
      },
      {
        id: 1724,
        name: 'Destructive Impulses',
        icon: 'https://render.guildwars2.com/file/8052FD58EAAA340A7B240FB0DAD8EB9BC391A1D0/1029966.png'
      },
      {
        id: 1792,
        name: 'Targeted Destruction',
        icon: 'https://render.guildwars2.com/file/37B8029E4AFECE5A70A3D37DC763F61BCCCC1CA9/1029965.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1776,
          name: 'Aggressive Arrival',
          icon: 'https://render.guildwars2.com/file/CAE712142E0AAF7C9DBA07F60E9A6E42420CDD69/2261514.png'
        },
        {
          id: 1767,
          name: 'Unsuspecting Strikes',
          icon: 'https://render.guildwars2.com/file/5896E49C6509BCADF1484C693ACBE2F82239AF40/1029956.png'
        },
        {
          id: 1755,
          name: 'Battle Scarred',
          icon: 'https://render.guildwars2.com/file/395D7939C8DD48BE35012E319D039F545065F755/2261515.png'
        }
      ],
      [
        {
          id: 1786,
          name: "Assassin's Presence",
          icon: 'https://render.guildwars2.com/file/54C625037513112F94A93C6F1553447504C5AF60/1029955.png'
        },
        {
          id: 1765,
          name: 'Notoriety',
          icon: 'https://render.guildwars2.com/file/1A720EC19CEDF654EDECB4616512F6CDF6A4BF06/1029959.png'
        },
        {
          id: 1802,
          name: 'Thrill of Combat',
          icon: 'https://render.guildwars2.com/file/12FFBBD82F3BB8C057E95AB7E907AD3EACFDF221/2261517.png'
        }
      ],
      [
        {
          id: 1715,
          name: 'Brutality',
          icon: 'https://render.guildwars2.com/file/B6A10BFFE10708A20EC6019F7607BF04A071770D/1029962.png'
        },
        {
          id: 1800,
          name: 'Swift Termination',
          icon: 'https://render.guildwars2.com/file/B0A7D5466C0E20764CB5CA305BD21F35BEE96303/1029961.png'
        },
        {
          id: 1754,
          name: 'Dance of Death',
          icon: 'https://render.guildwars2.com/file/153B05725A41E671C07AE0633D93F70F06273B54/2261516.png'
        }
      ]
    ]
  },
  {
    id: 52,
    name: 'Herald',
    elite: true,
    icon: 'https://render.guildwars2.com/file/78496E9E95C46527F8E0B974530A07A017DC9B79/1058520.png',
    minorTraits: [
      {
        id: 1777,
        name: 'Crystal Harbinger',
        icon: 'https://render.guildwars2.com/file/717C45E150E866A74310E6E5A96FC83BD96C384A/1058543.png'
      },
      {
        id: 1737,
        name: 'Draconic Fortitude',
        icon: 'https://render.guildwars2.com/file/9178A80B7BA73E1EAF47AE12462B5AE5B103E857/1058544.png'
      },
      {
        id: 1788,
        name: 'Reinforced Potency',
        icon: 'https://render.guildwars2.com/file/52070CB9BA3EDCCE2FF8AECBE769559FE2DE7619/1058545.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1813,
          name: "Elder's Respite",
          icon: 'https://render.guildwars2.com/file/ED0E15AFDDD1F944A09A561B290A1BCB36F799E1/1058541.png'
        },
        {
          id: 1806,
          name: 'Core Value',
          icon: 'https://render.guildwars2.com/file/62C2F3EAEF34D71657DB12D5ED6475992D6534F3/1058540.png'
        },
        {
          id: 1716,
          name: 'Rising Momentum',
          icon: 'https://render.guildwars2.com/file/BADE3878F6F5EE4247D501CE5ACDFB7BC24BA1AE/1058535.png'
        }
      ],
      [
        {
          id: 1738,
          name: 'Shared Empowerment',
          icon: 'https://render.guildwars2.com/file/1F09ADF696D0DC9C900DB8040F98A0BD57D303CB/1058539.png'
        },
        {
          id: 1743,
          name: 'Shining Aspects',
          icon: 'https://render.guildwars2.com/file/A626100680584B0F7E3DD5934B08D103C4943417/1058542.png'
        },
        {
          id: 1730,
          name: 'Hardening Persistence',
          icon: 'https://render.guildwars2.com/file/24682D5C432BB44FE807C5380DA4E8FAFC9FC678/1058537.png'
        }
      ],
      [
        {
          id: 1746,
          name: 'Elevated Compassion',
          icon: 'https://render.guildwars2.com/file/07A728FDFD275D406F255B08A26BBDCB37F6EE1F/2029284.png'
        },
        {
          id: 1772,
          name: 'Draconic Echo',
          icon: 'https://render.guildwars2.com/file/F67AF8A1C7923504487AE5FB0F222DD213F99623/1058536.png'
        },
        {
          id: 1803,
          name: 'Forceful Persistence',
          icon: 'https://render.guildwars2.com/file/A079965EF4C4DC29C0C1EA115E403FD0DE0A07F3/1012680.png'
        }
      ]
    ]
  },
  {
    id: 63,
    name: 'Renegade',
    elite: true,
    icon: 'https://render.guildwars2.com/file/0152279F7DD0FCFA21F2D1CC17DE21B2BD58EFF3/1769894.png',
    minorTraits: [
      {
        id: 2181,
        name: 'Ambush Commander',
        icon: 'https://render.guildwars2.com/file/07624B40AE70CAE632BC0BBBB241FC386347A775/1769997.png'
      },
      {
        id: 2154,
        name: 'Endless Enmity',
        icon: 'https://render.guildwars2.com/file/A4D16BE749A19FE8A8B5783EE2BD1DF899156D47/1769999.png'
      },
      {
        id: 2142,
        name: 'Brutal Momentum',
        icon: 'https://render.guildwars2.com/file/02380E4BB2AEA4C92A51599F1A7657C2FE586759/1769998.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2166,
          name: 'Ashen Demeanor',
          icon: 'https://render.guildwars2.com/file/F0F4A37B01F0916F2BB8081203E3F47A25DEDEE3/1769988.png'
        },
        {
          id: 2079,
          name: 'Blood Fury',
          icon: 'https://render.guildwars2.com/file/10FA58BEA8CF9AAB3F7841B154DC26E95A4FC705/1769989.png'
        },
        {
          id: 2120,
          name: 'Wrought-Iron Will',
          icon: 'https://render.guildwars2.com/file/14C869BDBD96052543726D78CCBA241DC20F9308/1769990.png'
        }
      ],
      [
        {
          id: 2133,
          name: 'Bold Reversal',
          icon: 'https://render.guildwars2.com/file/3F281F3706BC3EC26DADF3DC90A70B16D814A29F/1769991.png'
        },
        {
          id: 2092,
          name: 'Heartpiercer',
          icon: 'https://render.guildwars2.com/file/2063E7131B74C390D0A80853A73699E97B517F35/1769992.png'
        },
        {
          id: 2108,
          name: 'All for One',
          icon: 'https://render.guildwars2.com/file/9398D8F8E764A23596E17EDAA35B99961D62F061/1769993.png'
        }
      ],
      [
        {
          id: 2094,
          name: 'Vindication',
          icon: 'https://render.guildwars2.com/file/3453B30240026E36661AACD3FA94FB0DBFC8246C/1769995.png'
        },
        {
          id: 2100,
          name: 'Lasting Legacy',
          icon: 'https://render.guildwars2.com/file/3BA0F9B4766D2C80037DAEE37E5D07AC1EA2C030/1769994.png'
        },
        {
          id: 2182,
          name: 'Righteous Rebel',
          icon: 'https://render.guildwars2.com/file/2374691454FF114724B41E1BF0CD98ECA645380A/1769996.png'
        }
      ]
    ]
  },
  {
    id: 69,
    name: 'Vindicator',
    elite: true,
    icon: 'https://render.guildwars2.com/file/4FE40FD1ECD6C4EC45A32A2A740AC2E2A147E04F/2491508.png',
    minorTraits: [
      {
        id: 2262,
        name: 'Tenacious Ruin',
        icon: 'https://render.guildwars2.com/file/1F450E36D1969A3B0F9E09B070A1E5A73C5B3133/2491540.png'
      },
      {
        id: 2254,
        name: 'Balance in Discord',
        icon: 'https://render.guildwars2.com/file/0E49C9069C055B4FC23E02DC1E1271CB426F430A/2491541.png'
      },
      {
        id: 2229,
        name: 'Rise to the Occasion',
        icon: 'https://render.guildwars2.com/file/1CBAC4D8FC44F0239BAE1BD51BFFC37AB79601B6/2491542.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2259,
          name: "Reaver's Curse",
          icon: 'https://render.guildwars2.com/file/00B56F050D44B6690427AFF77901E3074FF221AD/2491534.png'
        },
        {
          id: 2243,
          name: "Angsiyan's Trust",
          icon: 'https://render.guildwars2.com/file/48A728EA57D0BAC26130C92C357A0B715D65CCFA/2491535.png'
        },
        {
          id: 2255,
          name: 'Song of Arboreum',
          icon: 'https://render.guildwars2.com/file/9F975F23435564FF56F2E3FE0AF0BBE196EDB6E8/2491536.png'
        }
      ],
      [
        {
          id: 2257,
          name: 'Forerunner of Death',
          icon: 'https://render.guildwars2.com/file/2864D963D3FC9156E6F52FA95DD34C2DE30306BE/2491537.png'
        },
        {
          id: 2232,
          name: 'Vassals of the Empire',
          icon: 'https://render.guildwars2.com/file/955F334FAA12550A15127A6200CB7BDE4D41BD0A/2491538.png'
        },
        {
          id: 2238,
          name: 'Saint of zu Heltzer',
          icon: 'https://render.guildwars2.com/file/42D514BF15A3F84ECECBACC7E05F95CAE03EBF6D/2491539.png'
        }
      ],
      [
        {
          id: 'revenant.vindicator.friend-of-the-luxons',
          name: 'Friend of the Luxons',
          icon: 'https://render.guildwars2.com/file/5863F212529A39973D0ABB76010DAA11AADF2E5F/2491531.png'
        },
        {
          id: 'revenant.vindicator.heated-rivalry',
          name: 'Heated Rivalry',
          icon: 'https://render.guildwars2.com/file/DCD8F1EB01943B0F3F40FAD0E5E708EDB3B91B7D/2491532.png'
        },
        {
          id: 'revenant.vindicator.friend-of-the-kurzicks',
          name: 'Friend of the Kurzicks',
          icon: 'https://render.guildwars2.com/file/2FE60DE76D79B54EB1911ED896020C183BD2C878/2491533.png'
        }
      ]
    ]
  },
  {
    id: 79,
    name: 'Conduit',
    elite: true,
    icon: 'https://render.guildwars2.com/file/63DD70A26845681B9B993A51987F60A2F7970C52/3679902.png',
    minorTraits: [
      {
        id: 2364,
        name: 'Enigmatic Connection',
        icon: 'https://render.guildwars2.com/file/EFAF4505C30228C26DBA974C57FEA43BA8EEF6C6/3680012.png'
      },
      {
        id: 2331,
        name: 'Bolstered Bonds',
        icon: 'https://render.guildwars2.com/file/EE281EB94E5A05EBABA8E1430FE163B758095696/3680013.png'
      },
      {
        id: 2440,
        name: 'Numinous Gift',
        icon: 'https://render.guildwars2.com/file/7C40B5ED64D8C97477C721590541E16B0977DBC7/3680014.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2390,
          name: 'Conductive Armaments',
          icon: 'https://render.guildwars2.com/file/03E180493B5346251D1934A0A71A1178CF503936/3680003.png'
        },
        {
          id: 2355,
          name: 'Shared Wisdom',
          icon: 'https://render.guildwars2.com/file/0C23B09FFB9B1803AA74B3F33D6E47B7F60A5CB1/3680008.png'
        },
        {
          id: 2407,
          name: 'Lingering Determination',
          icon: 'https://render.guildwars2.com/file/C20A447DB7AC6F014BEA6A67DBC8CA5A557FA849/3680007.png'
        }
      ],
      [
        {
          id: 2411,
          name: 'Kinetic Insight',
          icon: 'https://render.guildwars2.com/file/FA072331B55C06B36738A30E050B64920C513C5F/3680006.png'
        },
        {
          id: 2358,
          name: 'Expanded Consciousness',
          icon: 'https://render.guildwars2.com/file/6ACBECC9DCB9F87A90C17EF4BD95F14F5F1B27CF/3680005.png'
        },
        {
          id: 2416,
          name: 'Ethereal Purification',
          icon: 'https://render.guildwars2.com/file/A415FEE3B8013102B77E18753CCB7DE0682B4A0B/3680004.png'
        }
      ],
      [
        {
          id: 2429,
          name: 'Mistfire',
          icon: 'https://render.guildwars2.com/file/AD98A272DA5375CCD6109217CB39ED4C50441E3E/3680009.png'
        },
        {
          id: 2379,
          name: 'Enhanced Embodiment',
          icon: 'https://render.guildwars2.com/file/F380CE649F7294375BA550FF2757025B4BC75C73/3680010.png'
        },
        {
          id: 2352,
          name: 'Found Purpose',
          icon: 'https://render.guildwars2.com/file/623DA39A3225D07CC009359841CA951EF410DBC2/3680011.png'
        }
      ]
    ]
  }
];
