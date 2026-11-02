/** Maintained core and elite trait lines supply trait presentation and selection layout. */
import type { Gw2SpecializationData } from '#gw2/platform/profession-definition/specialization-data-types.js';

export const TRAIT_LINES: readonly Gw2SpecializationData[] = [
  {
    id: 42,
    name: 'Zeal',
    elite: false,
    icon: 'https://render.guildwars2.com/file/479676FC6349C7A12D429B685F0D4205ABFF2F94/1011999.png',
    minorTraits: [
      {
        id: 648,
        name: "Zealot's Resolution",
        icon: 'https://render.guildwars2.com/file/617705CDC4E6D5CA0EB9F492B94B4D060F354980/1012459.png'
      },
      {
        id: 646,
        name: 'Symbolic Exposure',
        icon: 'https://render.guildwars2.com/file/613CC440C79367EA7A6804EFA34ECC5F08EF6BE9/1012460.png'
      },
      {
        id: 649,
        name: 'Symbolic Avenger',
        icon: 'https://render.guildwars2.com/file/4D3415E7E81E71E474CE6256A5C6024FAFAC0A61/1012461.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 563,
          name: 'Wrathful Spirit',
          icon: 'https://render.guildwars2.com/file/C9EB5B02B1AB1615D60FE82C457408C2D9CC49CC/1012450.png'
        },
        {
          id: 634,
          name: 'Fiery Wrath',
          icon: 'https://render.guildwars2.com/file/77AF59F6F43203DC1BBC3EBC66153D484AEF084C/1012451.png'
        },
        {
          id: 1925,
          name: 'Zealous Scepter',
          icon: 'https://render.guildwars2.com/file/AFB520780B6C135961D60A389450800F1A78660E/1012452.png'
        }
      ],
      [
        {
          id: 628,
          name: 'Renewing Splendor',
          icon: 'https://render.guildwars2.com/file/C1A6EBA29894C831AAEE0D1C47080D12F9BA3AA3/1012458.png'
        },
        {
          id: 653,
          name: 'Zealous Blade',
          icon: 'https://render.guildwars2.com/file/39E4E73D0B5C33404B59B30508BC2FB95640ABD5/1012454.png'
        },
        {
          id: 1556,
          name: 'Kindled Zeal',
          icon: 'https://render.guildwars2.com/file/18F3380F1F593DF16FBBF7E9F6AABAE96F444E0D/1012455.png'
        }
      ],
      [
        {
          id: 635,
          name: 'Eternal Armory',
          icon: 'https://render.guildwars2.com/file/7AC201ED19C00351CF647F0F657BBF03043DF705/1012456.png'
        },
        {
          id: 637,
          name: 'Shattered Aegis',
          icon: 'https://render.guildwars2.com/file/5D0BC6DF96B62BF5FBA1B41BEC064BD9D4E421F2/1012457.png'
        },
        {
          id: 2017,
          name: 'Furious Focus',
          icon: 'https://render.guildwars2.com/file/7450B5C97FA442E5B85442A4F6EF610DC403E85A/1012453.png'
        }
      ]
    ]
  },
  {
    id: 16,
    name: 'Radiance',
    elite: false,
    icon: 'https://render.guildwars2.com/file/16A05D047DFC0828D0E496F46FD8B20F97B42EB3/1011996.png',
    minorTraits: [
      {
        id: 572,
        name: 'Justice is Blind',
        icon: 'https://render.guildwars2.com/file/090954DB1B76C01908A6AC9E38A9E4A9F10D131D/1012423.png'
      },
      {
        id: 571,
        name: 'Renewed Justice',
        icon: 'https://render.guildwars2.com/file/0FE11090EDC73ED447F5C5D50F6B9C44679B520F/1012424.png'
      },
      {
        id: 568,
        name: 'Radiant Power',
        icon: 'https://render.guildwars2.com/file/97F407C799FAAA7777E313031EB57CCEED3B47F2/1012425.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 577,
          name: 'Inner Fire',
          icon: 'https://render.guildwars2.com/file/56CEF1A4BEDBC4AC5946C5030D33ADE11CC6B965/1012415.png'
        },
        {
          id: 566,
          name: 'Right-Hand Strength',
          icon: 'https://render.guildwars2.com/file/0A3C2448AD693726F62934E660E07B5E04A406AC/1012416.png'
        },
        {
          id: 574,
          name: "Healer's Resolution",
          icon: 'https://render.guildwars2.com/file/27F73C39699117B22DA74EF60E40C9B67D737C0D/1012414.png'
        }
      ],
      [
        {
          id: 578,
          name: 'Wrath of Justice',
          icon: 'https://render.guildwars2.com/file/CD1F3745DD010649D5F53553B695021580221DC0/1012417.png'
        },
        {
          id: 567,
          name: 'Radiant Fire',
          icon: 'https://render.guildwars2.com/file/0E931C4BC7DD210747C130F2376E68DFA2126359/1012419.png'
        },
        {
          id: 565,
          name: 'Retribution',
          icon: 'https://render.guildwars2.com/file/324CD720BC3A5F1B6B154BD909165F0DB03CBC0D/1012418.png'
        }
      ],
      [
        {
          id: 1686,
          name: 'Amplified Wrath',
          icon: 'https://render.guildwars2.com/file/4677301004B3DF18A27D3141441AF3919AA10E7C/1012420.png'
        },
        {
          id: 579,
          name: 'Perfect Inscriptions',
          icon: 'https://render.guildwars2.com/file/29AAF6F60D2EAD20D6FA0FB097504D7AF8F6312F/1012421.png'
        },
        {
          id: 1683,
          name: 'Righteous Instincts',
          icon: 'https://render.guildwars2.com/file/AB3391394750222276EFF9FE3AD3DDE29DCE04AF/1012422.png'
        }
      ]
    ]
  },
  {
    id: 13,
    name: 'Valor',
    elite: false,
    icon: 'https://render.guildwars2.com/file/F8A95D6D3904A1F6430CF2D33A02FDF2A6132037/1011997.png',
    minorTraits: [
      {
        id: 582,
        name: 'Valorous Defense',
        icon: 'https://render.guildwars2.com/file/BE72671325E165BAFD4DCFD11C60D70C7371C439/1012435.png'
      },
      {
        id: 594,
        name: 'Steadfast Courage',
        icon: 'https://render.guildwars2.com/file/07D0C4AF0FF1365D1670EFBDA6F8A69DAF16A409/1012436.png'
      },
      {
        id: 583,
        name: 'Might of the Protector',
        icon: 'https://render.guildwars2.com/file/A3CBB96B5D0DFB084E3F4E0C3260FE01923CA7EA/1012437.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 588,
          name: 'Strength of the Fallen',
          icon: 'https://render.guildwars2.com/file/4304ABF568F659CABE54751F020A21FE90B7A057/1012426.png'
        },
        {
          id: 581,
          name: "Smiter's Boon",
          icon: 'https://render.guildwars2.com/file/21B93A5D0C246A42957222350B45C00A14DF0DB7/1012427.png'
        },
        {
          id: 633,
          name: 'Focus Mastery',
          icon: 'https://render.guildwars2.com/file/E6D027337F7B5D6E32BE3DB3224025CC667635D5/1012428.png'
        }
      ],
      [
        {
          id: 580,
          name: 'Stalwart Defender',
          icon: 'https://render.guildwars2.com/file/F2079E05EA7F0507DDD60B2603450BC1C902585E/1012429.png'
        },
        {
          id: 584,
          name: 'Redemption',
          icon: 'https://render.guildwars2.com/file/B5C9AAF67FA6305CB414C196EB1503493B5E0D59/1012430.png'
        },
        {
          id: 1684,
          name: 'Communal Defenses',
          icon: 'https://render.guildwars2.com/file/783B0AA64AEDEA0E7AE167692BE42CEDDA519F9F/1012431.png'
        }
      ],
      [
        {
          id: 585,
          name: 'Altruistic Healing',
          icon: 'https://render.guildwars2.com/file/3BF9357422DAF204E2CFBA3D49CD679B2CFD2EF8/1012432.png'
        },
        {
          id: 586,
          name: "Monk's Focus",
          icon: 'https://render.guildwars2.com/file/01FC7AF9B1CDFF61160FE3BDF63D52C50225EA9E/1012433.png'
        },
        {
          id: 589,
          name: 'Tenacious Defense',
          icon: 'https://render.guildwars2.com/file/15504BAE0F1557F00E0403D64DD87D101C3FE006/1012434.png'
        }
      ]
    ]
  },
  {
    id: 49,
    name: 'Honor',
    elite: false,
    icon: 'https://render.guildwars2.com/file/A4C0E39152B005EE226DA56D010DEEABB1ADBF2B/1011995.png',
    minorTraits: [
      {
        id: 564,
        name: 'Vigorous Precision',
        icon: 'https://render.guildwars2.com/file/05BF7C7F4D37239656B4047519F698CB32BDD67A/1012411.png'
      },
      {
        id: 551,
        name: 'Selfless Daring',
        icon: 'https://render.guildwars2.com/file/32BAB20860259FF3E8214E784E6BE7521213089C/1012412.png'
      },
      {
        id: 1685,
        name: 'Purity of Body',
        icon: 'https://render.guildwars2.com/file/4393150B92392F32D10C3D551A363FE2C9400E27/1012413.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1899,
          name: 'Invigorated Bulwark',
          icon: 'https://render.guildwars2.com/file/504B1F9EF89652FD5A00D52DE52A52B7023043E9/1012402.png'
        },
        {
          id: 559,
          name: 'Protective Reviver',
          icon: 'https://render.guildwars2.com/file/5F23B231E1039C4DC401BA2D6AE473C0E1E06D7E/1012403.png'
        },
        {
          id: 654,
          name: "Protector's Restoration",
          icon: 'https://render.guildwars2.com/file/DB1111AB10B1D3FAA67EF4957A0167BB1E61C90C/1012404.png'
        }
      ],
      [
        {
          id: 557,
          name: 'Honorable Staff',
          icon: 'https://render.guildwars2.com/file/4B04DDA13B459179E500052B03B39579093BAD18/1012405.png'
        },
        {
          id: 549,
          name: 'Pure of Heart',
          icon: 'https://render.guildwars2.com/file/B8FD6EB1B2C6CF7CEFE4715994B6FBCC201FF24D/1012406.png'
        },
        {
          id: 562,
          name: 'Empowering Might',
          icon: 'https://render.guildwars2.com/file/F8467ACFF89AFDE01C5E9F706A7341A3D2C9597C/1012407.png'
        }
      ],
      [
        {
          id: 553,
          name: 'Pure of Voice',
          icon: 'https://render.guildwars2.com/file/6ED99443C2E00AEBCF52F974221B0B31A0CCB457/1012408.png'
        },
        {
          id: 558,
          name: 'Writ of Persistence',
          icon: 'https://render.guildwars2.com/file/663CB2609609A546744620D72EBD7ECEC9020FA6/1012409.png'
        },
        {
          id: 1682,
          name: 'Force of Will',
          icon: 'https://render.guildwars2.com/file/AA9EDC9B5B343F27372ADDBA320702D3A19CD7D5/1012410.png'
        }
      ]
    ]
  },
  {
    id: 46,
    name: 'Virtues',
    elite: false,
    icon: 'https://render.guildwars2.com/file/E165042F92999B3BEFA91E280CB807F62EF30218/1011998.png',
    minorTraits: [
      {
        id: 621,
        name: 'Inspired Virtue',
        icon: 'https://render.guildwars2.com/file/6FF2B9A0099D3C75FBE97D36CBCC0470F63DFE06/1012447.png'
      },
      {
        id: 604,
        name: 'Virtue of Resolution',
        icon: 'https://render.guildwars2.com/file/2869F4977D1EDF02E612C62D39DD69CA372E6928/1012448.png'
      },
      {
        id: 620,
        name: 'Power of the Virtuous',
        icon: 'https://render.guildwars2.com/file/4BA068C09760BD341196A463B7B1D1E1AC3E6098/1012449.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 624,
          name: 'Unscathed Contender',
          icon: 'https://render.guildwars2.com/file/0FF7C102A0F70E6398712C12A62B427A2B6DC05F/1012438.png'
        },
        {
          id: 625,
          name: 'Resolute Subconscious',
          icon: 'https://render.guildwars2.com/file/BB3C57FD1467961118ACB5FDE84F39D965C9670B/1012439.png'
        },
        {
          id: 617,
          name: 'Master of Consecrations',
          icon: 'https://render.guildwars2.com/file/FA5B6B9E701C3F2BEAD6E053A4E8681B4878AFC4/1012440.png'
        }
      ],
      [
        {
          id: 603,
          name: 'Inspiring Virtue',
          icon: 'https://render.guildwars2.com/file/3EC057E1739EF1F22815605956B46142D2669A6D/1466322.png'
        },
        {
          id: 610,
          name: 'Absolute Resolve',
          icon: 'https://render.guildwars2.com/file/FD1ED24CEFFABCD52D22CC1F955094E80C0C3C9B/1012442.png'
        },
        {
          id: 587,
          name: 'Glacial Heart',
          icon: 'https://render.guildwars2.com/file/B6B838104E585313E2FA34481FEDBD9F1B6F07B4/1012443.png'
        }
      ],
      [
        {
          id: 622,
          name: 'Permeating Wrath',
          icon: 'https://render.guildwars2.com/file/6A76F53CD306D8E65E3774D7F09FF54326D348B5/1012444.png'
        },
        {
          id: 554,
          name: 'Battle Presence',
          icon: 'https://render.guildwars2.com/file/33B6DF1FB0AB7C497E3C5467EA22C8ABFFC83D17/1012445.png'
        },
        {
          id: 612,
          name: 'Indomitable Courage',
          icon: 'https://render.guildwars2.com/file/2602F16A45D30AECA8D3F11AB1A1FEDADBFD1120/1012446.png'
        }
      ]
    ]
  },
  {
    id: 27,
    name: 'Dragonhunter',
    elite: true,
    icon: 'https://render.guildwars2.com/file/736DB02E6DA2ACFAD3B9B0F4655113AD214FFA40/1011994.png',
    minorTraits: [
      {
        id: 1848,
        name: 'Virtuous Action',
        icon: 'https://render.guildwars2.com/file/E7C99D17DDC62D7E07E0D12B2DB27F1903D0D7C5/1012399.png'
      },
      {
        id: 1896,
        name: "Defender's Dogma",
        icon: 'https://render.guildwars2.com/file/4955C7B6C72EA4E49DB67A1106022E7F063AF1E3/1012401.png'
      },
      {
        id: 1926,
        name: 'Pure of Sight',
        icon: 'https://render.guildwars2.com/file/0F1A24AA6542E9ECAF1DE84D96A84ED0A5ED9759/1012400.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1898,
          name: "Hunter's Premonition",
          icon: 'https://render.guildwars2.com/file/43E37B57D967722DE15C6033DDF10BE663D10201/1012390.png'
        },
        {
          id: 1983,
          name: 'Dulled Senses',
          icon: 'https://render.guildwars2.com/file/7BFEAC083B4402807D310CCFF1147B2325CF364A/1012395.png'
        },
        {
          id: 1911,
          name: 'Soaring Devastation',
          icon: 'https://render.guildwars2.com/file/5BB39BC2BF306D32C16BD1D657A6191604C03ECB/1012392.png'
        }
      ],
      [
        {
          id: 2037,
          name: "Hunter's Determination",
          icon: 'https://render.guildwars2.com/file/2F6996644F9FF470FE49B4FB1C04B4E0C4A07FF2/1012393.png'
        },
        {
          id: 1835,
          name: "Zealot's Aggression",
          icon: 'https://render.guildwars2.com/file/31A6960A7357773373CA55D61FC1A62C532EE621/1012391.png'
        },
        {
          id: 1943,
          name: 'Bulwark',
          icon: 'https://render.guildwars2.com/file/2EA7776741C1A4213757DC139FED6B340C50E7AB/1012394.png'
        }
      ],
      [
        {
          id: 1908,
          name: "Hunter's Fortification",
          icon: 'https://render.guildwars2.com/file/2F147CBEA990E470AF0F0D20F652040E67962AB9/1012396.png'
        },
        {
          id: 1963,
          name: 'Heavy Light',
          icon: 'https://render.guildwars2.com/file/725424411D6131431FF9427BA77DCF3F2C5F7C2F/1012397.png'
        },
        {
          id: 1955,
          name: 'Big Game Hunter',
          icon: 'https://render.guildwars2.com/file/1F0205AD3EB24521C9E8FF69340AC8091B0E556F/1012398.png'
        }
      ]
    ]
  },
  {
    id: 62,
    name: 'Firebrand',
    elite: true,
    icon: 'https://render.guildwars2.com/file/6D18B2D3EE0BFA0E4BC851A7D3C39D4330250916/1769890.png',
    minorTraits: [
      {
        id: 2089,
        name: 'Purity of Word',
        icon: 'https://render.guildwars2.com/file/CC360DF028353A0C1AD09D97FA2CDF1D6D0AABA8/1769948.png'
      },
      {
        id: 2062,
        name: 'Swift Scholar',
        icon: 'https://render.guildwars2.com/file/C2347F4CA45520676368C8C5D64A3F094A0D73F8/1769949.png'
      },
      {
        id: 2148,
        name: 'Imbued Haste',
        icon: 'https://render.guildwars2.com/file/CD01F2B8C328AC37B760D0913F6D4DDDAC0477D2/1769950.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2075,
          name: 'Unrelenting Criticism',
          icon: 'https://render.guildwars2.com/file/367971C6121BCC00A453525834FD673D0CABF398/1769939.png'
        },
        {
          id: 2101,
          name: "Liberator's Vow",
          icon: 'https://render.guildwars2.com/file/2EF42105F7B45367AB72AD737250E014597708A5/1769940.png'
        },
        {
          id: 2086,
          name: 'Archivist of Whispers',
          icon: 'https://render.guildwars2.com/file/0F76350307E3B8A894F529C8110CA8FB977E63F8/1769941.png'
        }
      ],
      [
        {
          id: 2063,
          name: 'Weighty Terms',
          icon: 'https://render.guildwars2.com/file/3D80FCC2D64D10B566185CFA94CE681FE73BD237/1769942.png'
        },
        {
          id: 2076,
          name: 'Stalwart Speed',
          icon: 'https://render.guildwars2.com/file/50F01C5E76B37D0AE93C0E07EA0F675B270950D0/1769943.png'
        },
        {
          id: 2116,
          name: 'Legendary Lore',
          icon: 'https://render.guildwars2.com/file/0B9351C97E03000DA106650C1116BA3F5715AFDD/1769944.png'
        }
      ],
      [
        {
          id: 2105,
          name: 'Stoic Demeanor',
          icon: 'https://render.guildwars2.com/file/FC3E5E76E418B620C2B5D3BF9851913553E46E21/1769945.png'
        },
        {
          id: 2179,
          name: 'Quickfire',
          icon: 'https://render.guildwars2.com/file/BC32643101E9CEC1D3B4B9709E4969637C283B7A/1769946.png'
        },
        {
          id: 2159,
          name: 'Loremaster',
          icon: 'https://render.guildwars2.com/file/1496F706100F1E16C5E3F76466C51D1DEF29C4FA/1769947.png'
        }
      ]
    ]
  },
  {
    id: 65,
    name: 'Willbender',
    elite: true,
    icon: 'https://render.guildwars2.com/file/117F4659C3AD0AF6625D51013F03D541BEF2E8A6/2479302.png',
    minorTraits: [
      {
        id: 2200,
        name: 'Willbender Training',
        icon: 'https://render.guildwars2.com/file/ABC2E5DBE5589C3D3CD25E4FCF33A50A5AF25101/2479323.png'
      },
      {
        id: 2222,
        name: 'Righteous Sprint',
        icon: 'https://render.guildwars2.com/file/A046F1DB16615C0B5A4A46D2909CF34469ADE0F9/2479324.png'
      },
      {
        id: 2189,
        name: 'Lethal Tempo',
        icon: 'https://render.guildwars2.com/file/08351965141B6F3013600B3B9CC7F880DEFF05D4/2479325.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2191,
          name: 'Searing Pact',
          icon: 'https://render.guildwars2.com/file/A99C37B4DD3A04B496DE2A601B724ED6B193B8A2/2479314.png'
        },
        {
          id: 2190,
          name: 'Power for Power',
          icon: 'https://render.guildwars2.com/file/1DE84562D18036F352903060D2C27C022139EA78/2479315.png'
        },
        {
          id: 2187,
          name: 'Conceited Curate',
          icon: 'https://render.guildwars2.com/file/5BA0D4513309584BF1D5B0507A5B58BDFA6C33A9/2479316.png'
        }
      ],
      [
        {
          id: 2197,
          name: 'Restorative Virtues',
          icon: 'https://render.guildwars2.com/file/FC4753574837A826E47E39CB5CD875D9470F6D9F/2479317.png'
        },
        {
          id: 2210,
          name: 'Holy Reckoning',
          icon: 'https://render.guildwars2.com/file/1A1A95F133208028F0492A66C1D3F2F03A6ABED5/2479318.png'
        },
        {
          id: 2199,
          name: 'Vanguard Tactics',
          icon: 'https://render.guildwars2.com/file/3E34FFB8089ADC10491A243C0D4F7974E590A103/2479319.png'
        }
      ],
      [
        {
          id: 2195,
          name: 'Phoenix Protocol',
          icon: 'https://render.guildwars2.com/file/1A795E5D7CDEC7D9F49D342F4157154F90D44CBF/2479320.png'
        },
        {
          id: 2201,
          name: "Tyrant's Momentum",
          icon: 'https://render.guildwars2.com/file/B436E75A9DD8EA917C3677AE4964A40DFB1BCE67/2479321.png'
        },
        {
          id: 2198,
          name: 'Deathless Courage',
          icon: 'https://render.guildwars2.com/file/6640F790796D719F4F7EB5077900AAFCB6A02DB9/2479322.png'
        }
      ]
    ]
  },
  {
    id: 81,
    name: 'Luminary',
    elite: true,
    icon: 'https://render.guildwars2.com/file/034C203DBD60CFF19D3D5CE9E71B27CA0103F50D/3679898.png',
    minorTraits: [
      {
        id: 2381,
        name: 'Luminary',
        icon: 'https://render.guildwars2.com/file/1C173BD7036E52E6E0463317F5B63490B101B4D5/3679964.png'
      },
      {
        id: 2394,
        name: "Light's Gift",
        icon: 'https://render.guildwars2.com/file/6C920751304B14ADFFB6A70CACEA1B80D2ABFC59/3679965.png'
      },
      {
        id: 2435,
        name: 'Radiant Armaments',
        icon: 'https://render.guildwars2.com/file/9D40CA9DC73D7C03EA58BE0EB51CDC46DA9E9403/3679966.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2410,
          name: 'Shimmering Stances',
          icon: 'https://render.guildwars2.com/file/0BBF59B654A528C492CA26463B2728DD590EE016/3679955.png'
        },
        {
          id: 2417,
          name: 'Resolute Blessing',
          icon: 'https://render.guildwars2.com/file/3580BB0C4F3E9BBC96080454BE9491CC934A6C55/3679956.png'
        },
        {
          id: 2329,
          name: 'Persistent Blessing',
          icon: 'https://render.guildwars2.com/file/CA0853B1409CF197E0082626E5EDE57BE758CF40/3679957.png'
        }
      ],
      [
        {
          id: 2330,
          name: 'Resplendent Weaponry',
          icon: 'https://render.guildwars2.com/file/5176E7FBE301F9DF01C54A79BCFD02F6C3029BED/3679958.png'
        },
        {
          id: 2401,
          name: 'Purging Light',
          icon: 'https://render.guildwars2.com/file/0F9AC6B095FF6924D01F07FF26BF0F5C0DADD824/3679959.png'
        },
        {
          id: 2419,
          name: 'Empowered Armaments',
          icon: 'https://render.guildwars2.com/file/37424E9DD0A3ADC61DD56BB180C96201DB61099C/3679960.png'
        }
      ],
      [
        {
          id: 2368,
          name: 'Illuminating Inspiration',
          icon: 'https://render.guildwars2.com/file/DDFE760CBC42D4B2EC0645099C161AC850E41EA7/3679961.png'
        },
        {
          id: 2328,
          name: 'Sovereign of Light',
          icon: 'https://render.guildwars2.com/file/111A0EA54101D7C22F57070690139662D0BC5316/3679962.png'
        },
        {
          id: 2388,
          name: 'Master-at-Arms',
          icon: 'https://render.guildwars2.com/file/B4094AF403DC0753F496E97F014A0FB02FB1D209/3679963.png'
        }
      ]
    ]
  }
];
