/** Maintained core and elite trait lines supply trait presentation and selection layout. */
import type { Gw2SpecializationData } from '#gw2/platform/profession-definition/specialization-data-types.js';

export const TRAIT_LINES: readonly Gw2SpecializationData[] = [
  {
    id: 5,
    name: 'Druid',
    elite: true,
    icon: 'https://render.guildwars2.com/file/BE10CB10D8446208729934F3F1BD3A54BEED9AD6/1012013.png',
    minorTraits: [
      {
        id: 1874,
        name: 'Celestial Being',
        icon: 'https://render.guildwars2.com/file/51AAAF39FF1D79505AD6BD532A44AAF1C9A75E9B/1128539.png'
      },
      {
        id: 1862,
        name: 'Live Vicariously',
        icon: 'https://render.guildwars2.com/file/F2A3C305087AFA5141FABEF5FB09AD05CCE8A46A/1128540.png'
      },
      {
        id: 1992,
        name: 'Natural Mender',
        icon: 'https://render.guildwars2.com/file/ECB17C0FAE20B0F77EE9043BE449546A6FB41ABE/1128541.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1868,
          name: 'Druidic Clarity',
          icon: 'https://render.guildwars2.com/file/5851BCCB60F70B42FEC1FF4E05F8C90722C2DB90/1128530.png'
        },
        {
          id: 2016,
          name: 'Verdant Etching',
          icon: 'https://render.guildwars2.com/file/0BCB5CC47934D9A526600EC87E1966CEDED13514/1128534.png'
        },
        {
          id: 1935,
          name: 'Blood Moon',
          icon: 'https://render.guildwars2.com/file/65C6E74A0A26786A243867FB79C63DAF0650CEDB/1128532.png'
        }
      ],
      [
        {
          id: 2053,
          name: 'Celestial Shadow',
          icon: 'https://render.guildwars2.com/file/93010741F5F7F22A0F20EB4EBA14F9D3B1321059/1128533.png'
        },
        {
          id: 2001,
          name: 'Grace of the Land',
          icon: 'https://render.guildwars2.com/file/D1E507697A2FFD0AC9F6D5CA74C403D69A4E0E4E/1128536.png'
        },
        {
          id: 2056,
          name: 'Natural Balance',
          icon: 'https://render.guildwars2.com/file/5F953BAC2C7EB3340B4EAA9A7D9633320BAB29A6/1128535.png'
        }
      ],
      [
        {
          id: 2057,
          name: 'Cultivated Synergy',
          icon: 'https://render.guildwars2.com/file/9DAD4D2E74CDD1C5196848BCBE63BC12CE534B68/1128531.png'
        },
        {
          id: 2058,
          name: 'Lingering Light',
          icon: 'https://render.guildwars2.com/file/01BBD8CADBC6E9BBED46A2D9026976316CA8EAD9/1128537.png'
        },
        {
          id: 2055,
          name: 'Eclipse',
          icon: 'https://render.guildwars2.com/file/4ED26C00F5552D91B246DEE5F23E0C03ABA81820/1128538.png'
        }
      ]
    ]
  },
  {
    id: 8,
    name: 'Marksmanship',
    elite: false,
    icon: 'https://render.guildwars2.com/file/80FEB75663DAE60BAC59495671261C206C0BAFC3/1012014.png',
    minorTraits: [
      {
        id: 1010,
        name: 'Opening Strike',
        icon: 'https://render.guildwars2.com/file/A537B362D8AC54BC7907E050B596BA93E4CBE5F2/1012627.png'
      },
      {
        id: 1009,
        name: 'Alpha Focus',
        icon: 'https://render.guildwars2.com/file/D8167EA3C3CC7508DD2126F7A8C7BAC9C7069829/1012628.png'
      },
      {
        id: 1011,
        name: 'Precise Strike',
        icon: 'https://render.guildwars2.com/file/C16AC293515DD1CCD131A6F79206EB5E5FDD7747/1012629.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1021,
          name: 'Stoneform',
          icon: 'https://render.guildwars2.com/file/205F4491B806F7ECF6BE0B9F18C266FDAAE4635A/1769987.png'
        },
        {
          id: 1014,
          name: "Hunter's Gaze",
          icon: 'https://render.guildwars2.com/file/FE4DDEFE6EF8A7BD7FD638D86C6CD3B409E399F0/1012619.png'
        },
        {
          id: 986,
          name: 'Clarion Bond',
          icon: 'https://render.guildwars2.com/file/38A957BBB30F1F4E346E35C75B911F23AB0E6A37/1012620.png'
        }
      ],
      [
        {
          id: 1001,
          name: 'Wolfsong',
          icon: 'https://render.guildwars2.com/file/55D102432B71E1E26280DF6118AE5663650FEAA3/3613094.png'
        },
        {
          id: 1000,
          name: 'Farsighted',
          icon: 'https://render.guildwars2.com/file/6F338058C9CEAC7F35740F1F384E01F4C7D45428/1012622.png'
        },
        {
          id: 1070,
          name: 'Moment of Clarity',
          icon: 'https://render.guildwars2.com/file/9B120D5A176870D4EC9F1BE44E295EAAA6EF0ABC/1012623.png'
        }
      ],
      [
        {
          id: 996,
          name: "Predator's Onslaught",
          icon: 'https://render.guildwars2.com/file/0771B76DEC42B44A579725E0C0C2A07F2058B65A/1012624.png'
        },
        {
          id: 1015,
          name: 'Remorseless',
          icon: 'https://render.guildwars2.com/file/1744A5411A5DED5AF343B4F4B7490A7677FE18EA/1012625.png'
        },
        {
          id: 1698,
          name: 'Lead the Wind',
          icon: 'https://render.guildwars2.com/file/B864CDE9E00147E5A0F9ABFE0793272F92AD09C4/1012626.png'
        }
      ]
    ]
  },
  {
    id: 25,
    name: 'Nature Magic',
    elite: false,
    icon: 'https://render.guildwars2.com/file/DC7A387D9AB3EACCDA35AEA872E4EA1007139612/1012015.png',
    minorTraits: [
      {
        id: 1055,
        name: 'Rejuvenation',
        icon: 'https://render.guildwars2.com/file/04744A052966FD205B5909E7BE037F22115C0250/1012639.png'
      },
      {
        id: 1056,
        name: 'Fortifying Bond',
        icon: 'https://render.guildwars2.com/file/2541965232254704A07C295AF9D81EEC05B620AE/1012640.png'
      },
      {
        id: 1059,
        name: 'Lingering Magic',
        icon: 'https://render.guildwars2.com/file/FD403AD8DE225A21440C77F7DC9433080B910AB8/1012641.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1062,
          name: 'Bountiful Hunter',
          icon: 'https://render.guildwars2.com/file/03559445FF973DE04DAB39FB64DE0D96063409E2/1012630.png'
        },
        {
          id: 978,
          name: 'Wellspring',
          icon: 'https://render.guildwars2.com/file/E9A2CD7164FA3BFBB549B9B9DA2238007EA1720B/1012631.png'
        },
        {
          id: 1060,
          name: "Allies' Aid",
          icon: 'https://render.guildwars2.com/file/6F2F55CAEDEC8046D5EBE8A84FCB6A734F0835B9/1012632.png'
        }
      ],
      [
        {
          id: 1054,
          name: 'Evasive Purity',
          icon: 'https://render.guildwars2.com/file/C374B3F2C1BCFCB0B164FF0567FB6CC1B31B9651/1012633.png'
        },
        {
          id: 965,
          name: 'Spirited Arrival',
          icon: 'https://render.guildwars2.com/file/5599287FC8FCB4ECB31B73625605072B7234269A/1012634.png'
        },
        {
          id: 964,
          name: 'Windborne Notes',
          icon: 'https://render.guildwars2.com/file/E4A570C5B180415A581007A004037FEBFC99CE4B/1012635.png'
        }
      ],
      [
        {
          id: 1038,
          name: "Nature's Vengeance",
          icon: 'https://render.guildwars2.com/file/FE6272D67567A04F0D2013927551306DE4940FE4/1012636.png'
        },
        {
          id: 1988,
          name: 'Protective Ward',
          icon: 'https://render.guildwars2.com/file/9B7002D2715C18EF2E0E3AD6409B93F223EFDD02/1012637.png'
        },
        {
          id: 1697,
          name: 'Invigorating Bond',
          icon: 'https://render.guildwars2.com/file/625D22F52902A007CA6A037D0149251A2943C56E/1012638.png'
        }
      ]
    ]
  },
  {
    id: 30,
    name: 'Skirmishing',
    elite: false,
    icon: 'https://render.guildwars2.com/file/A026F49FF905C0F8AFAC6EDFDE281AABE1912459/1012016.png',
    minorTraits: [
      {
        id: 1080,
        name: 'Tail Wind',
        icon: 'https://render.guildwars2.com/file/F4CAD97EC4550743646C042C566EEDC6E100A2F8/1012651.png'
      },
      {
        id: 1083,
        name: 'Furious Grip',
        icon: 'https://render.guildwars2.com/file/F3EC5297B63F684BAA255FE261A85C152E534367/1012652.png'
      },
      {
        id: 1068,
        name: "Hunter's Tactics",
        icon: 'https://render.guildwars2.com/file/44D4631FB427F09BE5B300BE0F537E6F2126BA0B/1012653.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1069,
          name: 'Sharpened Edges',
          icon: 'https://render.guildwars2.com/file/C83DA0F5287448140599AC20E02756149234D05B/1012642.png'
        },
        {
          id: 1067,
          name: 'Primal Reflexes',
          icon: 'https://render.guildwars2.com/file/D644F0905F7DA21C5FBA0110AD9BF4D290A70405/1012643.png'
        },
        {
          id: 1075,
          name: "Trapper's Expertise",
          icon: 'https://render.guildwars2.com/file/B4A65A33111547EC4A3E3DD40E6ACBC1E3215ADD/1012644.png'
        }
      ],
      [
        {
          id: 1016,
          name: 'Fang and Claw',
          icon: 'https://render.guildwars2.com/file/F56EB274FA516609317A6540ABC20B6116C8051D/3613096.png'
        },
        {
          id: 1700,
          name: "Strider's Strength",
          icon: 'https://render.guildwars2.com/file/E0FC234BC4FF7C9AEB39DF2C9B9E57CA01D81C25/1012646.png'
        },
        {
          id: 1846,
          name: 'Hidden Barbs',
          icon: 'https://render.guildwars2.com/file/42C214653B5A57D0020F3293322EF30E121E7541/1012647.png'
        }
      ],
      [
        {
          id: 1064,
          name: 'Quick Draw',
          icon: 'https://render.guildwars2.com/file/CBCB2EC86BC85CC02DA7AAB25CBFB226B8956D1E/1012648.png'
        },
        {
          id: 1912,
          name: 'Light on your Feet',
          icon: 'https://render.guildwars2.com/file/4D37A694088038DA9266F6107C9604AD9CBC2752/1012649.png'
        },
        {
          id: 1888,
          name: 'Vicious Quarry',
          icon: 'https://render.guildwars2.com/file/CC4B0609160EC9B92A96CAF81023AD0C5E18B65A/1012650.png'
        }
      ]
    ]
  },
  {
    id: 32,
    name: 'Beastmastery',
    elite: false,
    icon: 'https://render.guildwars2.com/file/02D851E1D7186112786D0F67910B58FACB5CCCF6/1012012.png',
    minorTraits: [
      {
        id: 1900,
        name: 'Pack Alpha',
        icon: 'https://render.guildwars2.com/file/2D7C48769DB9EC5A024E3427E797577F4ACF0576/1012615.png'
      },
      {
        id: 974,
        name: 'Loud Whistle',
        icon: 'https://render.guildwars2.com/file/9434BE3CBBD1A8CB3C1AA1004C7AB0267AF83F4F/1012616.png'
      },
      {
        id: 1065,
        name: "Pet's Prowess",
        icon: 'https://render.guildwars2.com/file/7D3EA005DDE41D017CACFFACA12DA9F160685228/1012617.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1861,
          name: 'Go for the Eyes',
          icon: 'https://render.guildwars2.com/file/437F14AB08659C986724464E7550699A735D49A9/1012607.png'
        },
        {
          id: 1072,
          name: 'Natural Healing',
          icon: 'https://render.guildwars2.com/file/E10A27535DAC0BBFFCB205BFBBC9D30F68BE0C07/1012611.png'
        },
        {
          id: 1606,
          name: 'Resounding Timbre',
          icon: 'https://render.guildwars2.com/file/BE4759B39AD22947535D1F1E3B090D180F200BA0/1012608.png'
        }
      ],
      [
        {
          id: 975,
          name: 'Wilting Strike',
          icon: 'https://render.guildwars2.com/file/32230CE64A4007F6301E9C93B393CF5328101C15/1012609.png'
        },
        {
          id: 1047,
          name: 'Bestial Rage',
          icon: 'https://render.guildwars2.com/file/D10A0BFF47D14345DD6C41DD0FF6F256659DF7C2/1012610.png'
        },
        {
          id: 970,
          name: 'Honed Axes',
          icon: 'https://render.guildwars2.com/file/08106C6618C43B927DD90C97BB643843E2DCBA14/1012614.png'
        }
      ],
      [
        {
          id: 1945,
          name: 'Beastly Warden',
          icon: 'https://render.guildwars2.com/file/EF61D1061135B1EC57FDFD94795ED125D43962E1/1012612.png'
        },
        {
          id: 968,
          name: "Zephyr's Speed",
          icon: 'https://render.guildwars2.com/file/DFCFB305E50B1A1824B4D81108BAD072C5BA010C/1012613.png'
        },
        {
          id: 1066,
          name: 'Go for the Throat',
          icon: 'https://render.guildwars2.com/file/B90D71093775FE4C2263B5C42F175FEA6C7925FE/1012606.png'
        }
      ]
    ]
  },
  {
    id: 33,
    name: 'Wilderness Survival',
    elite: false,
    icon: 'https://render.guildwars2.com/file/BEDA4B0CCD2E6F5F5C64509D67D3454E47D019F3/1012017.png',
    minorTraits: [
      {
        id: 1096,
        name: 'Natural Vigor',
        icon: 'https://render.guildwars2.com/file/AA7BB9DF7468CCAB959A0EC229E5BD442F5365B5/1012663.png'
      },
      {
        id: 1090,
        name: "Companion's Defense",
        icon: 'https://render.guildwars2.com/file/B2A6A9A6E5C8920B7B7C0BC4FB4D8036D2D80EE6/1012664.png'
      },
      {
        id: 1089,
        name: 'Rugged Growth',
        icon: 'https://render.guildwars2.com/file/C13D29745FB34B9B2C803ABAB92E011EEC1E4204/1012665.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1098,
          name: 'Child of Earth',
          icon: 'https://render.guildwars2.com/file/23742E1977C947E4692564FD7E443359A16AEBBC/2229317.png'
        },
        {
          id: 1086,
          name: 'Oakheart Salve',
          icon: 'https://render.guildwars2.com/file/4ED02272F05D430FECBB55DBAEBE2B3F776F3E1C/1012657.png'
        },
        {
          id: 1099,
          name: 'Arachnophobia',
          icon: 'https://render.guildwars2.com/file/18482C07E5742659E6BF25FEB5B207DE790B7942/3613097.png'
        }
      ],
      [
        {
          id: 1101,
          name: 'Ambidexterity',
          icon: 'https://render.guildwars2.com/file/7E58CD0B0F4E4FB14B960A0829B843CF0CFEC231/1012654.png'
        },
        {
          id: 2032,
          name: 'Survival Instincts',
          icon: 'https://render.guildwars2.com/file/A5F5CE0A29969CC7074F0DF1EE6F74FEE4FBD676/1012658.png'
        },
        {
          id: 1100,
          name: 'Empathic Bond',
          icon: 'https://render.guildwars2.com/file/17C9282906D60361FA7B2639CE240A975FD12A1C/1012660.png'
        }
      ],
      [
        {
          id: 1094,
          name: 'Carnivore',
          icon: 'https://render.guildwars2.com/file/C59B052F29BB21A6471F5080CB5A416F3A6CE7A8/1012659.png'
        },
        {
          id: 1699,
          name: 'Wilderness Knowledge',
          icon: 'https://render.guildwars2.com/file/F4E005DE1578983CDFD25E6F3D1CF517C64AD0B7/1012661.png'
        },
        {
          id: 1701,
          name: 'Poison Master',
          icon: 'https://render.guildwars2.com/file/31F8DA3B6BEE52B1AC76FEE0C10E4A075F5524DA/1012662.png'
        }
      ]
    ]
  },
  {
    id: 55,
    name: 'Soulbeast',
    elite: true,
    icon: 'https://render.guildwars2.com/file/0AA4A2C62C4F2D0E0D59DBEE9C63EB4AF472F0C5/1769893.png',
    minorTraits: [
      {
        id: 2151,
        name: 'Elevated Bond',
        icon: 'https://render.guildwars2.com/file/59CBE2049C451991A62F07135B92BDB94501B1F6/1769984.png'
      },
      {
        id: 2156,
        name: 'Furious Strength',
        icon: 'https://render.guildwars2.com/file/C95A3880A940B9073707A565A216032B92F5FCDD/1769985.png'
      },
      {
        id: 2127,
        name: 'Twice as Vicious',
        icon: 'https://render.guildwars2.com/file/42AE5234142F3045D5B665EC60D6E3FF7C564D62/1769986.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2134,
          name: 'Fresh Reinforcement',
          icon: 'https://render.guildwars2.com/file/3F0D2D1606230D309D3305F4CB9401272AF46D3E/1769978.png'
        },
        {
          id: 2071,
          name: 'Live Fast',
          icon: 'https://render.guildwars2.com/file/6B91D72D480A280C4B31AD14381F480604481569/1769980.png'
        },
        {
          id: 2072,
          name: 'Unstoppable Union',
          icon: 'https://render.guildwars2.com/file/51C4B10380F0B292C2ACB894B53CE14DDE091E19/1769979.png'
        }
      ],
      [
        {
          id: 2119,
          name: 'Second Skin',
          icon: 'https://render.guildwars2.com/file/0C2E46F9BBF87F4EC89349385923A409BB1CFBF6/1769975.png'
        },
        {
          id: 2085,
          name: 'Essence of Speed',
          icon: 'https://render.guildwars2.com/file/011A28E51A388006C2800DAED408FC3401DF6231/1769982.png'
        },
        {
          id: 2161,
          name: "Predator's Cunning",
          icon: 'https://render.guildwars2.com/file/25054EAF081EAB14A6B5C53197312F2AE6C32A17/1769977.png'
        }
      ],
      [
        {
          id: 2155,
          name: 'Eternal Bond',
          icon: 'https://render.guildwars2.com/file/BB58C7379E130F3CA90542D5A6E8194B5B32A87F/1769981.png'
        },
        {
          id: 2128,
          name: 'Leader of the Pack',
          icon: 'https://render.guildwars2.com/file/F17AAF29C42854EFDBB7BE6502E2EDB4D02A9E44/1769976.png'
        },
        {
          id: 2143,
          name: 'Apex Predator',
          icon: 'https://render.guildwars2.com/file/BBAE380FEB7F41CA1EDA96370F38FDBEE1FA0342/1769983.png'
        }
      ]
    ]
  },
  {
    id: 72,
    name: 'Untamed',
    elite: true,
    icon: 'https://render.guildwars2.com/file/D219A813B5312BA9D1D10A74C10E9E5F3F54936B/2503609.png',
    minorTraits: [
      {
        id: 2268,
        name: 'Unleashed Power',
        icon: 'https://render.guildwars2.com/file/985312115044390876A0D309CD7E05E124E2D90E/2503641.png'
      },
      {
        id: 2286,
        name: 'Natural Fortitude',
        icon: 'https://render.guildwars2.com/file/0EC6000B27090A500127630C639949E8081F9BE4/2503642.png'
      },
      {
        id: 2269,
        name: 'Vow of the Untamed',
        icon: 'https://render.guildwars2.com/file/6C71F5D550E3CBACBB067376F52DE40A0148776F/2503643.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2297,
          name: 'Debilitating Blows',
          icon: 'https://render.guildwars2.com/file/67AE6DDC0A0266CC206E03FA27A0FFDC0DBD4BB0/2503632.png'
        },
        {
          id: 2277,
          name: "Nature's Shield",
          icon: 'https://render.guildwars2.com/file/190A65447E01046A9B90C52C14AB2EF1AD8077AF/2503636.png'
        },
        {
          id: 2301,
          name: 'Blinding Outburst',
          icon: 'https://render.guildwars2.com/file/AD425360631C67A415F53C06FAD4027FA505474C/2503634.png'
        }
      ],
      [
        {
          id: 2263,
          name: 'Enhancing Impact',
          icon: 'https://render.guildwars2.com/file/E772E5E89C0DE45293FE6437A574702BA3672775/2503635.png'
        },
        {
          id: 2287,
          name: 'Cleansing Unleash',
          icon: 'https://render.guildwars2.com/file/C85AA35DE3FCF36EE0A909B1EE0B90F9B5284EAD/2503633.png'
        },
        {
          id: 2278,
          name: 'Corrupting Vines',
          icon: 'https://render.guildwars2.com/file/5999A42A73A5C9F829F82A0D36410BF792261426/2503637.png'
        }
      ],
      [
        {
          id: 2271,
          name: 'Let Loose',
          icon: 'https://render.guildwars2.com/file/B32F06D106DA429C04FAD32202EE2B400CCF53C0/2503638.png'
        },
        {
          id: 2283,
          name: 'Biorhythm',
          icon: 'https://render.guildwars2.com/file/44B8970EAEBCFC14E11A910C5B5D0FC512FEEBE5/2503639.png'
        },
        {
          id: 2274,
          name: 'Ferocious Symbiosis',
          icon: 'https://render.guildwars2.com/file/B367DF25F5F07C51CE5BD280C35A0E7BB19B98A3/2503640.png'
        }
      ]
    ]
  },
  {
    id: 78,
    name: 'Galeshot',
    elite: true,
    icon: 'https://render.guildwars2.com/file/1E0DE9DF219380B3DD15AD35466461C935930515/3679901.png',
    minorTraits: [
      {
        id: 2359,
        name: 'Teachings of the Tengu',
        icon: 'https://render.guildwars2.com/file/DBBA6892E6A871D5C56B5967282EFCAECB1AB0FC/3680000.png'
      },
      {
        id: 2363,
        name: 'Bird of Prey',
        icon: 'https://render.guildwars2.com/file/D95923386652CE75C66D93F8E20EC06A066C51B8/3680001.png'
      },
      {
        id: 2341,
        name: 'Jetstream',
        icon: 'https://render.guildwars2.com/file/FBA5A4DCB905A8BFBC960E6C62D21151D87DECC9/3680002.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2402,
          name: 'Joy of Movement',
          icon: 'https://render.guildwars2.com/file/ECC60120623FF8F60DBA76069F140C1F2B389DD1/3679991.png'
        },
        {
          id: 2370,
          name: 'Feel the Rush',
          icon: 'https://render.guildwars2.com/file/ADF07346C562CEAB0295AE5A12ADA63CBC01DE34/3679992.png'
        },
        {
          id: 2360,
          name: 'Wuthering Wind',
          icon: 'https://render.guildwars2.com/file/BE5F0405E79D13C89F0D9EF13B1B11479D0C3805/3679993.png'
        }
      ],
      [
        {
          id: 2408,
          name: 'Flock Together',
          icon: 'https://render.guildwars2.com/file/705F72DB08D671B04EA5E3329976C3E4999AFB3E/3679994.png'
        },
        {
          id: 2413,
          name: 'Perilous Skies',
          icon: 'https://render.guildwars2.com/file/E9167E11087E64EB021B0F257C393305A5CD757F/3679995.png'
        },
        {
          id: 2396,
          name: 'Thrill of the Catch',
          icon: 'https://render.guildwars2.com/file/9C94EE77BCC40E0175A471DE17454CD97059A770/3679996.png'
        }
      ],
      [
        {
          id: 2425,
          name: 'Cloudburst',
          icon: 'https://render.guildwars2.com/file/CD50C06E229B696D4EFE21DCC9ABA4F9335738E2/3679997.png'
        },
        {
          id: 2336,
          name: 'Gale Force',
          icon: 'https://render.guildwars2.com/file/206A95E4F6F236D824F80CF2495B4E6553ABFF34/3679998.png'
        },
        {
          id: 2372,
          name: 'Shrike',
          icon: 'https://render.guildwars2.com/file/562E1E5BAFAF14367F48521966E1BCF7DD92E2D4/3679999.png'
        }
      ]
    ]
  }
];
