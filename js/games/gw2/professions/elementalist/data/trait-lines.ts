/** Maintained core and elite trait lines supply trait presentation and selection layout. */
import type { Gw2SpecializationData } from '#gw2/platform/profession-definition/specialization-data-types.js';

export const TRAIT_LINES: readonly Gw2SpecializationData[] = [
  {
    id: 17,
    name: 'Water',
    elite: false,
    icon: 'https://render.guildwars2.com/file/A3D60C0EBE0B33907505C7DED0FD4E4DE565250F/1011987.png',
    minorTraits: [
      {
        id: 350,
        name: 'Soothing Mist',
        icon: 'https://render.guildwars2.com/file/09D12A6041622A94409F276CEEEB2C17AF35A8ED/1012327.png'
      },
      {
        id: 351,
        name: 'Healing Ripple',
        icon: 'https://render.guildwars2.com/file/0FB92AC29456276B2FC6E25EFB91DECD93C6694B/1012328.png'
      },
      {
        id: 1676,
        name: "Aquamancer's Training",
        icon: 'https://render.guildwars2.com/file/C9059194A7A8CFE90D5A7E9831C6E7CACF060A42/2175047.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 348,
          name: 'Soothing Ice',
          icon: 'https://render.guildwars2.com/file/F41E5118C9A2F2C1CBF1E3F37A050669E195AADD/1012318.png'
        },
        {
          id: 363,
          name: 'Piercing Shards',
          icon: 'https://render.guildwars2.com/file/7C3004BABE373BC125F6A3195D0C343BC0E702D1/1012319.png'
        },
        {
          id: 360,
          name: 'Stop, Drop, and Roll',
          icon: 'https://render.guildwars2.com/file/0965A9C6430DFFFC9B170201B964ABD8BA0337A2/1012320.png'
        }
      ],
      [
        {
          id: 364,
          name: 'Soothing Disruption',
          icon: 'https://render.guildwars2.com/file/CB474873D492343395726B0CD2E8E9A453D86F66/1012321.png'
        },
        {
          id: 358,
          name: 'Cleansing Wave',
          icon: 'https://render.guildwars2.com/file/987EFE03A0E7026E5C09CD0E1BA9ED01BDEB7FBF/1012322.png'
        },
        {
          id: 349,
          name: 'Flow like Water',
          icon: 'https://render.guildwars2.com/file/B60C26726A979893D897B3F2B118CF6913AF554F/2175046.png'
        }
      ],
      [
        {
          id: 362,
          name: 'Cleansing Water',
          icon: 'https://render.guildwars2.com/file/BABCC72BD965F8437ACB4E0961765D29C5675355/1012324.png'
        },
        {
          id: 361,
          name: 'Powerful Aura',
          icon: 'https://render.guildwars2.com/file/7BA5ADA1A908D2A424FFD64AD6D0AA3908032DE1/1012325.png'
        },
        {
          id: 2028,
          name: 'Soothing Power',
          icon: 'https://render.guildwars2.com/file/6F7761ECC1979C1207C6166DF8EA7BA9B726B609/1012326.png'
        }
      ]
    ]
  },
  {
    id: 26,
    name: 'Earth',
    elite: false,
    icon: 'https://render.guildwars2.com/file/BA6BC962A7ABA1330B3AC4141299397C0036559F/1011985.png',
    minorTraits: [
      {
        id: 278,
        name: 'Stone Flesh',
        icon: 'https://render.guildwars2.com/file/9FACD0F31DF1DF1957C59DA67ED9F76ACB55BEB8/1012303.png'
      },
      {
        id: 279,
        name: 'Earthen Blast',
        icon: 'https://render.guildwars2.com/file/2531DCAFAEAB452C90C4572E1ADCE8236DCF5636/1012304.png'
      },
      {
        id: 280,
        name: "Geomancer's Training",
        icon: 'https://render.guildwars2.com/file/3659F1C53B0CF50106ADBC4E6351011A24F59CBA/2175043.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 282,
          name: "Earth's Embrace",
          icon: 'https://render.guildwars2.com/file/94B6E0582A0CC93604F12220F703C5D22C59097A/1012294.png'
        },
        {
          id: 1507,
          name: 'Serrated Stones',
          icon: 'https://render.guildwars2.com/file/0A2B6F1BC25AC118B67DC31F9A0BA6427ABB6A6A/1012295.png'
        },
        {
          id: 289,
          name: 'Elemental Shielding',
          icon: 'https://render.guildwars2.com/file/9EA9E5B50D71ACE02E1413073901CD2B152E559C/1012296.png'
        }
      ],
      [
        {
          id: 275,
          name: 'Strength of Stone',
          icon: 'https://render.guildwars2.com/file/567BA00AEB795B5021E5924CC3511DE3AAC26438/1012297.png'
        },
        {
          id: 281,
          name: 'Rock Solid',
          icon: 'https://render.guildwars2.com/file/4D23C1FE504D402ABF3E80F30FE396A9FA55A63E/1012298.png'
        },
        {
          id: 277,
          name: 'Earthen Blessing',
          icon: 'https://render.guildwars2.com/file/9A2144F4A44AFF9AA3B9099405F0EA36F226CD27/2175042.png'
        }
      ],
      [
        {
          id: 1508,
          name: 'Diamond Skin',
          icon: 'https://render.guildwars2.com/file/D1014421F0E06325664204C905200002987E38C5/1012300.png'
        },
        {
          id: 287,
          name: 'Written in Stone',
          icon: 'https://render.guildwars2.com/file/5160CCF906702A4478C533EF5DA6BD02956E9378/1012301.png'
        },
        {
          id: 1674,
          name: 'Stone Heart',
          icon: 'https://render.guildwars2.com/file/22F1BDACFBEBC8FF2BF77B22B3E535D2BA03D140/1012302.png'
        }
      ]
    ]
  },
  {
    id: 31,
    name: 'Fire',
    elite: false,
    icon: 'https://render.guildwars2.com/file/B4BDAB2452DEF1A34615DDC4F30A157DADC743C5/1011986.png',
    minorTraits: [
      {
        id: 320,
        name: 'Empowering Flame',
        icon: 'https://render.guildwars2.com/file/7F0BD23838FA4E0CD2336B04C7E5AB0ED03358EB/1012315.png'
      },
      {
        id: 318,
        name: 'Sunspot',
        icon: 'https://render.guildwars2.com/file/1405047ED70DE30F80B1F6304A787B215BB50878/1012316.png'
      },
      {
        id: 319,
        name: "Pyromancer's Training",
        icon: 'https://render.guildwars2.com/file/7C751D2FA513070209F24809D5232757000B1546/2175044.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 296,
          name: 'Burning Precision',
          icon: 'https://render.guildwars2.com/file/774471FA3841BB90EB6F935A76D8017A0C4B005E/1012306.png'
        },
        {
          id: 328,
          name: 'Conjurer',
          icon: 'https://render.guildwars2.com/file/6BE466F790D5410D2E10512B1F0A523EEEB776B0/1012307.png'
        },
        {
          id: 335,
          name: 'Burning Fire',
          icon: 'https://render.guildwars2.com/file/0850B1BC61637D04045533CCDACFB5796F47B4CF/1012308.png'
        }
      ],
      [
        {
          id: 325,
          name: 'Burning Rage',
          icon: 'https://render.guildwars2.com/file/AB4E6CB3066DFF2D3C179B026C9BC371799E5D67/2175045.png'
        },
        {
          id: 340,
          name: 'Smothering Auras',
          icon: 'https://render.guildwars2.com/file/32EB577B3EC6D2AC0AC4EDB4A799EE5E4F2B1341/1012310.png'
        },
        {
          id: 334,
          name: 'Power Overwhelming',
          icon: 'https://render.guildwars2.com/file/5D0937674DCD7AAAE80B4D243AFBDC753DFF220B/1012311.png'
        }
      ],
      [
        {
          id: 1510,
          name: 'Persisting Flames',
          icon: 'https://render.guildwars2.com/file/38496307B7C27BCB08D6800F2A699B4998DD1935/1012312.png'
        },
        {
          id: 294,
          name: "Pyromancer's Puissance",
          icon: 'https://render.guildwars2.com/file/998095CB1FD2CF0164B8A36BABFDB911DF08DB02/1012313.png'
        },
        {
          id: 1675,
          name: 'Inferno',
          icon: 'https://render.guildwars2.com/file/150B4E2CB4039B33152D496FF04E9B1644E22E0A/1012314.png'
        }
      ]
    ]
  },
  {
    id: 37,
    name: 'Arcane',
    elite: false,
    icon: 'https://render.guildwars2.com/file/C7F4C199EC07D0E6CC9417C6F53F53FDD3F92947/1011984.png',
    minorTraits: [
      {
        id: 268,
        name: 'Arcane Prowess',
        icon: 'https://render.guildwars2.com/file/2FFB0E34C00BE2EE1E65FA0336F304199E156D0E/1012291.png'
      },
      {
        id: 264,
        name: 'Elemental Attunement',
        icon: 'https://render.guildwars2.com/file/EB242E0D58000DD8DCB80B0F7B049F03C62299B6/1012292.png'
      },
      {
        id: 2004,
        name: 'Elemental Enchantment',
        icon: 'https://render.guildwars2.com/file/C8986CF9A927C8A003ED152702270CC62745E56D/1012293.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 253,
          name: 'Arcane Precision',
          icon: 'https://render.guildwars2.com/file/1CB6B7903F10246E9405DD625380161FCD4E6C23/1012282.png'
        },
        {
          id: 266,
          name: 'Renewing Stamina',
          icon: 'https://render.guildwars2.com/file/033DFD3593EED863D280AD98E6B7CC09E25D9ADE/1012283.png'
        },
        {
          id: 1487,
          name: 'Arcane Restoration',
          icon: 'https://render.guildwars2.com/file/5FCA61A1BC957433DA9F37AA70ED0808DAB1110C/1012284.png'
        }
      ],
      [
        {
          id: 265,
          name: 'Arcane Resurrection',
          icon: 'https://render.guildwars2.com/file/E9BCF655FA539C1B0A1FDDCB52947542A1C6704B/1012285.png'
        },
        {
          id: 1673,
          name: 'Elemental Lockdown',
          icon: 'https://render.guildwars2.com/file/72DCC1061DC06F660FC509B60A1FA557C9B82A1D/1012286.png'
        },
        {
          id: 257,
          name: 'Final Shielding',
          icon: 'https://render.guildwars2.com/file/F00E3FB59751F0422F3D3C5859F5FD3B580EA9B3/1012287.png'
        }
      ],
      [
        {
          id: 238,
          name: 'Evasive Arcana',
          icon: 'https://render.guildwars2.com/file/0B46175A2DCC7C396EEAA34B50DB6204390F0FE8/1012288.png'
        },
        {
          id: 263,
          name: 'Arcane Lightning',
          icon: 'https://render.guildwars2.com/file/005807D4EACC2FC562FAF2C6BABC3E38E33FC070/1012289.png'
        },
        {
          id: 1511,
          name: 'Bountiful Power',
          icon: 'https://render.guildwars2.com/file/F0C7F54A6FC70D079E1628FFE871980CAEBFD70D/1012290.png'
        }
      ]
    ]
  },
  {
    id: 41,
    name: 'Air',
    elite: false,
    icon: 'https://render.guildwars2.com/file/D3DB62FF6055021A717F3C6A0C19502F2C4EC1FF/1011983.png',
    minorTraits: [
      {
        id: 221,
        name: "Zephyr's Speed",
        icon: 'https://render.guildwars2.com/file/9B55449FC8EF093FE4925DDE9BF41B5A6298BAAA/1012279.png'
      },
      {
        id: 222,
        name: 'Electric Discharge',
        icon: 'https://render.guildwars2.com/file/F4622EE8300028599369D4084EA7A2774D250DEA/1012280.png'
      },
      {
        id: 223,
        name: "Aeromancer's Training",
        icon: 'https://render.guildwars2.com/file/B07EBE9F0136026A2C710C1405C528DB4AC37936/2175041.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 227,
          name: "Zephyr's Boon",
          icon: 'https://render.guildwars2.com/file/0542900C005EB41CEDFAF003D91A9104D479A848/1012270.png'
        },
        {
          id: 224,
          name: 'One with Air',
          icon: 'https://render.guildwars2.com/file/200BAEAD2FCD181E102556B02AF5F326EC583DD0/1012271.png'
        },
        {
          id: 232,
          name: 'Ferocious Winds',
          icon: 'https://render.guildwars2.com/file/A0EB166CD43079B2F7206ED305FD6C3D049BB704/1012272.png'
        }
      ],
      [
        {
          id: 229,
          name: 'Inscription',
          icon: 'https://render.guildwars2.com/file/0157D1D40CF9B505B907DB95149F767A6FDB09DD/1012273.png'
        },
        {
          id: 214,
          name: 'Raging Storm',
          icon: 'https://render.guildwars2.com/file/74A414B378B54431EF183A37DA37CCFFFC0E04BD/2175040.png'
        },
        {
          id: 1502,
          name: 'Stormsoul',
          icon: 'https://render.guildwars2.com/file/4505D3D02606283B02124C3304697304E663ECAE/1012275.png'
        }
      ],
      [
        {
          id: 226,
          name: 'Bolt to the Heart',
          icon: 'https://render.guildwars2.com/file/3E4E727D6D23DFEF4205F272A15E2136799DE291/1012276.png'
        },
        {
          id: 1503,
          name: 'Fresh Air',
          icon: 'https://render.guildwars2.com/file/FA64C9F2750F986E52E8376F22EDBA3844A8C603/1012277.png'
        },
        {
          id: 1672,
          name: 'Lightning Rod',
          icon: 'https://render.guildwars2.com/file/0D26024404D06BBB0A3BD70340251740C73E0F2C/1012278.png'
        }
      ]
    ]
  },
  {
    id: 48,
    name: 'Tempest',
    elite: true,
    icon: 'https://render.guildwars2.com/file/D1970ABC09D07B4275C7E47DDD0EDC0F4CFC050C/1029930.png',
    minorTraits: [
      {
        id: 2025,
        name: 'Singularity',
        icon: 'https://render.guildwars2.com/file/B5B020BD12E7A490DE9551FA06D920AC4F9A6036/1029952.png'
      },
      {
        id: 1938,
        name: 'Gathered Focus',
        icon: 'https://render.guildwars2.com/file/410EF84D7D37FBE72E1D2AB026249E1050CD70AF/2207774.png'
      },
      {
        id: 1948,
        name: 'Hardy Conduit',
        icon: 'https://render.guildwars2.com/file/F61B0203A07CDF17A3613731EE93F6C09410E825/1029953.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1952,
          name: 'Gale Song',
          icon: 'https://render.guildwars2.com/file/65ED3B2F3816172BC7E23598DA93A0731D6D0245/1029943.png'
        },
        {
          id: 1962,
          name: 'Latent Stamina',
          icon: 'https://render.guildwars2.com/file/BA1F1D070867AC48FE57F876315657DDA25A044E/1029944.png'
        },
        {
          id: 1886,
          name: 'Unstable Conduit',
          icon: 'https://render.guildwars2.com/file/51765B3330426700C8A2E580B23637CA9CD728FB/1029945.png'
        }
      ],
      [
        {
          id: 1891,
          name: 'Tempestuous Aria',
          icon: 'https://render.guildwars2.com/file/0C2A72B848A7FBB596DE6096B4C45814D3266EEB/1029946.png'
        },
        {
          id: 1902,
          name: 'Harmonious Conduit',
          icon: 'https://render.guildwars2.com/file/DC03410B07E666C9F8AECFEDCE9855C65136E597/1029948.png'
        },
        {
          id: 2015,
          name: 'Invigorating Torrents',
          icon: 'https://render.guildwars2.com/file/053DD3F436F333340672EB1F7F951F540ADFDBC4/1029947.png'
        }
      ],
      [
        {
          id: 1839,
          name: 'Transcendent Tempest',
          icon: 'https://render.guildwars2.com/file/0C79A761B446E53CAB6DA4B320D12D656B5E1151/2207773.png'
        },
        {
          id: 2033,
          name: 'Lucid Singularity',
          icon: 'https://render.guildwars2.com/file/2E3AEA68A85501D1209EABD2E1603C0151ED9292/1029951.png'
        },
        {
          id: 1986,
          name: 'Elemental Bastion',
          icon: 'https://render.guildwars2.com/file/570FD4DD0094280F906ACAAD37705E9B0F4ADA63/1029949.png'
        }
      ]
    ]
  },
  {
    id: 56,
    name: 'Weaver',
    elite: true,
    icon: 'https://render.guildwars2.com/file/02FAA82BF2F5BF3E3AD89BCF05FF56B4C86139F4/1769888.png',
    minorTraits: [
      {
        id: 2109,
        name: 'Weaver',
        icon: 'https://render.guildwars2.com/file/B0707EB06310175FC0CAB50C68C113F4D5B3912E/1769924.png'
      },
      {
        id: 2077,
        name: 'Elemental Refreshment',
        icon: 'https://render.guildwars2.com/file/32D4A99DECA90337DC0722ACF84C38B44A93429C/1769925.png'
      },
      {
        id: 2081,
        name: 'Elemental Polyphony',
        icon: 'https://render.guildwars2.com/file/28460700BDF3B9D3000B963977B1555F7E999512/1769926.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2177,
          name: 'Superior Elements',
          icon: 'https://render.guildwars2.com/file/0017B2083219583F0150B537B0B8B54A3A7E3228/1769915.png'
        },
        {
          id: 2165,
          name: 'Elemental Pursuit',
          icon: 'https://render.guildwars2.com/file/194D097708234E783C04C790E2C362290054B9C1/1769916.png'
        },
        {
          id: 2115,
          name: "Weaver's Prowess",
          icon: 'https://render.guildwars2.com/file/FCA86506DDAD2C32CF130C4819DFEE3119026C96/1769917.png'
        }
      ],
      [
        {
          id: 2180,
          name: "Master's Fortitude",
          icon: 'https://render.guildwars2.com/file/28BEBF776AF9FDBEF0BDF8B715265AE724E40878/1769923.png'
        },
        {
          id: 2061,
          name: 'Swift Revenge',
          icon: 'https://render.guildwars2.com/file/7B0B0072429031F44DC41404F9BA0D08A5B2EDE2/1769919.png'
        },
        {
          id: 2170,
          name: 'Bolstered Elements',
          icon: 'https://render.guildwars2.com/file/BE23D1F64BA73B9837C87A2059EA531BBE65D52B/1769920.png'
        }
      ],
      [
        {
          id: 2131,
          name: 'Elements of Rage',
          icon: 'https://render.guildwars2.com/file/4269910A34FB0FB861DAE2A13229D594523B0BA0/1769921.png'
        },
        {
          id: 2090,
          name: 'Woven Stride',
          icon: 'https://render.guildwars2.com/file/66CB08AA2823930D5B47AF3259B60A7DD86FAFE4/1769922.png'
        },
        {
          id: 2138,
          name: 'Flow State',
          icon: 'https://render.guildwars2.com/file/78DA4AC17D4EBDA04BBBD325A024C346F59ED150/1769918.png'
        }
      ]
    ]
  },
  {
    id: 67,
    name: 'Catalyst',
    elite: true,
    icon: 'https://render.guildwars2.com/file/1DF8CD361899081107B504A02B01C9B3B3645970/2491507.png',
    minorTraits: [
      {
        id: 2227,
        name: 'Depth of Elements',
        icon: 'https://render.guildwars2.com/file/F5BFCBC8BEF112AF6C046FCF6ABC44C997EFAA0E/2491528.png'
      },
      {
        id: 2250,
        name: 'Elemental Empowerment',
        icon: 'https://render.guildwars2.com/file/C3B3C99943ECABFAA936573030C599EE2A974420/2491529.png'
      },
      {
        id: 2231,
        name: 'Elemental Epitome',
        icon: 'https://render.guildwars2.com/file/1D6590FD63020A49AC1D975478E6AE5E79495447/2491530.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2230,
          name: 'Hardened Auras',
          icon: 'https://render.guildwars2.com/file/07F6DDB8129A05F6DF05E6669CE00C29FF260F80/2491519.png'
        },
        {
          id: 2252,
          name: 'Vicious Empowerment',
          icon: 'https://render.guildwars2.com/file/F5AD2F77BC2920E35E04D3026ED4B07C94B1734D/2491520.png'
        },
        {
          id: 2224,
          name: 'Energized Elements',
          icon: 'https://render.guildwars2.com/file/FBE5C807BE540522A044043B040427A117AF38CF/2491521.png'
        }
      ],
      [
        {
          id: 2247,
          name: 'Empowering Auras',
          icon: 'https://render.guildwars2.com/file/C52EDB20EC120936089EC83C54A55A610A075652/2491522.png'
        },
        {
          id: 2249,
          name: 'Evasive Empowerment',
          icon: 'https://render.guildwars2.com/file/D5DA661099326A32D307FDC103A21E21BE5A0800/2491523.png'
        },
        {
          id: 2234,
          name: 'Spectacular Sphere',
          icon: 'https://render.guildwars2.com/file/B207785D56DABD962921DA4A0D65EB4C39270D3D/2491524.png'
        }
      ],
      [
        {
          id: 2233,
          name: 'Elemental Synergy',
          icon: 'https://render.guildwars2.com/file/5F43FA3C1DB337CDF9152CCE4A651661F062C3B2/2491525.png'
        },
        {
          id: 2241,
          name: 'Empowered Empowerment',
          icon: 'https://render.guildwars2.com/file/AB403FC4AF1A3DA40AE1ADF20E09550E11706972/2491526.png'
        },
        {
          id: 2251,
          name: 'Sphere Specialist',
          icon: 'https://render.guildwars2.com/file/9806DF11221102AF1FAD30AA5E4A4FEB0F4FF8CE/2491527.png'
        }
      ]
    ]
  },
  {
    id: 80,
    name: 'Evoker',
    elite: true,
    icon: 'https://render.guildwars2.com/file/A80E0721636B027711E408BF0ADFDCD3330920AA/3679896.png',
    minorTraits: [
      {
        id: 2344,
        name: 'Evocation',
        icon: 'https://render.guildwars2.com/file/3FE7D7FE06E2FBF1DFC85AAE1EB101F56F137938/3679940.png'
      },
      {
        id: 2382,
        name: 'Enhanced Potency',
        icon: 'https://render.guildwars2.com/file/F31CA1E555EEEC123D09D7602E7C07F326FC0DFE/3679941.png'
      },
      {
        id: 2351,
        name: "Familiar's Prowess",
        icon: 'https://render.guildwars2.com/file/18964AD8371C1FB3160A7779D0AA0120B9FFABBB/3679942.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2391,
          name: 'Fiery Might',
          icon: 'https://render.guildwars2.com/file/B90AE3D7B9BF46A516567DDD7DC072AEC64DE850/3679934.png'
        },
        {
          id: 2415,
          name: 'Altruistic Aspect',
          icon: 'https://render.guildwars2.com/file/1A01DE9D0567081D12F9B75DF8B5B26D38AE1508/3679933.png'
        },
        {
          id: 2354,
          name: "Spirit's Succor",
          icon: 'https://render.guildwars2.com/file/5963EEA1935F352ADE7EAB464EC5F89FA8A74A7F/3679936.png'
        }
      ],
      [
        {
          id: 2342,
          name: "Familiar's Focus",
          icon: 'https://render.guildwars2.com/file/F9FE2E9559AD4700D0737EACCF3608CED3E50BA6/3679937.png'
        },
        {
          id: 2380,
          name: "Familiar's Blessing",
          icon: 'https://render.guildwars2.com/file/324AF976A04EADC23FAF0D27B1FD01EC057B5B5E/3679938.png'
        },
        {
          id: 2438,
          name: 'Elemental Dynamo',
          icon: 'https://render.guildwars2.com/file/5978B791032A18A2C596986B482B1B1A48E916C9/3679931.png'
        }
      ],
      [
        {
          id: 2335,
          name: 'Galvanic Enchantment',
          icon: 'https://render.guildwars2.com/file/1561D12A4FFC17F3D52AE27337A359274A74D53F/3679932.png'
        },
        {
          id: 2436,
          name: 'Elemental Balance',
          icon: 'https://render.guildwars2.com/file/6B625B190E65062542F7CCF9B1565D2AF403C2C6/3679935.png'
        },
        {
          id: 2437,
          name: 'Specialized Elements',
          icon: 'https://render.guildwars2.com/file/7FC97790020E564E5507630A75069F42903B57AE/3679939.png'
        }
      ]
    ]
  }
];
