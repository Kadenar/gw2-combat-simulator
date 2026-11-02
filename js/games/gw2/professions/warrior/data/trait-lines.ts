/** Maintained core and elite trait lines supply trait presentation and selection layout. */
import type { Gw2SpecializationData } from '#gw2/platform/profession-definition/specialization-data-types.js';

export const TRAIT_LINES: readonly Gw2SpecializationData[] = [
  {
    id: 4,
    name: 'Strength',
    elite: false,
    icon: 'https://render.guildwars2.com/file/0D48C40A1C042B0BC6DAA4B91AB272E5E90C934C/1012032.png',
    minorTraits: [
      {
        id: 1446,
        name: 'Reckless Dodge',
        icon: 'https://render.guildwars2.com/file/4D0864C3335DC7A7046713714ED0FD0D57F4021E/1012819.png'
      },
      {
        id: 1448,
        name: 'Building Momentum',
        icon: 'https://render.guildwars2.com/file/7255D994BB1A14AE2B6CB55BA121B0597ABC6415/1012820.png'
      },
      {
        id: 1453,
        name: 'Pinnacle of Strength',
        icon: 'https://render.guildwars2.com/file/73003EC83C79150BAB1578A1F067F37C0F472D60/1012821.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1447,
          name: 'Brave Stride',
          icon: 'https://render.guildwars2.com/file/01FAE5A3B0A851F579FE6BCD2C27E8CD610BB49B/1012810.png'
        },
        {
          id: 1451,
          name: 'Restorative Strength',
          icon: 'https://render.guildwars2.com/file/13610709076E473C03D42303AD2E913A1ED65344/1012811.png'
        },
        {
          id: 1444,
          name: 'Peak Performance',
          icon: 'https://render.guildwars2.com/file/08F60C11F460F3236DE65A445337290B7AAED96F/1012812.png'
        }
      ],
      [
        {
          id: 2000,
          name: 'Body Blow',
          icon: 'https://render.guildwars2.com/file/537FCF3A01560702E5C5554E03DEBEA40580A309/1012813.png'
        },
        {
          id: 1338,
          name: 'Forceful Greatsword',
          icon: 'https://render.guildwars2.com/file/CDAE0E5A05570A05917304122E52C71BF5474FC5/1012814.png'
        },
        {
          id: 1449,
          name: 'Great Fortitude',
          icon: 'https://render.guildwars2.com/file/424B39CE4BFF056F3B2ED25F186A7FC5E69538E5/1012815.png'
        }
      ],
      [
        {
          id: 1437,
          name: "Berserker's Power",
          icon: 'https://render.guildwars2.com/file/A795EE78B8DAA836F3C0650CFC037BB71D3517BA/1012816.png'
        },
        {
          id: 1454,
          name: 'Might Makes Right',
          icon: 'https://render.guildwars2.com/file/6BBC5D5AB0B0E72DA33631E1A57B525CC0460D61/1012817.png'
        },
        {
          id: 1440,
          name: 'Aggressive Onslaught',
          icon: 'https://render.guildwars2.com/file/0CE13DF2315967C19B000E4FF407351B32BF0E3E/1012792.png'
        }
      ]
    ]
  },
  {
    id: 11,
    name: 'Tactics',
    elite: false,
    icon: 'https://render.guildwars2.com/file/373162E8DED2793801194E622FEDEF2DBBDA6F10/1012033.png',
    minorTraits: [
      {
        id: 1480,
        name: 'Marching Orders',
        icon: 'https://render.guildwars2.com/file/67472371DE0301250206D00047F7DDE82C439774/2207781.png'
      },
      {
        id: 1485,
        name: 'Empowered',
        icon: 'https://render.guildwars2.com/file/B4361E2EC6AE0C58977573C7C6F6F6FD12032FA7/2207778.png'
      },
      {
        id: 1481,
        name: 'Mending Might',
        icon: 'https://render.guildwars2.com/file/765438B1A46A5F987B0C6399DBC7723601AE0027/2207780.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1469,
          name: 'Leg Specialist',
          icon: 'https://render.guildwars2.com/file/E99EFC0C36E2B4121A6F02FC99FDA0A4F97BF5BB/1012822.png'
        },
        {
          id: 1474,
          name: "Soldier's Comfort",
          icon: 'https://render.guildwars2.com/file/2159D86FF705FE12A0F7E8F061535CCC624464B1/2207775.png'
        },
        {
          id: 1471,
          name: 'Roaring Reveille',
          icon: 'https://render.guildwars2.com/file/3FF57AD44D51802994C4222D1016079A6A91BDBC/1012823.png'
        }
      ],
      [
        {
          id: 1486,
          name: "Warrior's Cunning",
          icon: 'https://render.guildwars2.com/file/0848D11E545D0B62601FAD03DE6D4A37E2EC4E9A/2207776.png'
        },
        {
          id: 1479,
          name: 'Shrug It Off',
          icon: 'https://render.guildwars2.com/file/3D09CE385264C492CC3638AD3A7D753FC80A0D34/2207779.png'
        },
        {
          id: 1482,
          name: 'Empower Allies',
          icon: 'https://render.guildwars2.com/file/0CE3310F1A91D2DBF91C21E77BD311FA2DA5123D/1012827.png'
        }
      ],
      [
        {
          id: 1667,
          name: 'Martial Cadence',
          icon: 'https://render.guildwars2.com/file/C84C9406450EC91C95F77A0BA66040533AA5C44F/2207777.png'
        },
        {
          id: 1470,
          name: 'Vigorous Shouts',
          icon: 'https://render.guildwars2.com/file/087A225EC4070E5B271B360D583AE4CC4210BFC0/1012829.png'
        },
        {
          id: 1711,
          name: 'Phalanx Strength',
          icon: 'https://render.guildwars2.com/file/4739991FA69FFEACC34458A8043F5D0749060F22/1012830.png'
        }
      ]
    ]
  },
  {
    id: 18,
    name: 'Berserker',
    elite: true,
    icon: 'https://render.guildwars2.com/file/B706475993F16D0BD7DFDF3BB30AA144051CDC94/1029935.png',
    minorTraits: [
      {
        id: 1831,
        name: 'Primal Rage',
        icon: 'https://render.guildwars2.com/file/FF5A46180F4096BE3749D038E298F44EE9BEC4F6/1029976.png'
      },
      {
        id: 1993,
        name: 'Burst of Aggression',
        icon: 'https://render.guildwars2.com/file/77C5CC23125C9FD252762F515F9BE8B3AB0153E6/1058563.png'
      },
      {
        id: 2046,
        name: 'Fatal Frenzy',
        icon: 'https://render.guildwars2.com/file/A6EDB2AE070A9F43B60067771C21B251F86A49EE/1029977.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2049,
          name: 'Smash Brawler',
          icon: 'https://render.guildwars2.com/file/780ACDAE6E6AE10E53470AF821FD246E380E65EB/1029973.png'
        },
        {
          id: 2039,
          name: 'Last Blaze',
          icon: 'https://render.guildwars2.com/file/E2EF11B8156E452E4A79B56ACA914E751B1C7E4F/1058561.png'
        },
        {
          id: 1977,
          name: 'Savage Instinct',
          icon: 'https://render.guildwars2.com/file/FDC3330B22C258587B2ED4E65204467B5836D49C/1029969.png'
        }
      ],
      [
        {
          id: 2011,
          name: 'Blood Reaction',
          icon: 'https://render.guildwars2.com/file/2FE06152FB14EF659843EC3CB80FCECD72C61F5D/1029970.png'
        },
        {
          id: 2042,
          name: 'Heat the Soul',
          icon: 'https://render.guildwars2.com/file/0F46971324CD9B11C6C17425AC7C083ED7907455/1058560.png'
        },
        {
          id: 2002,
          name: 'Dead or Alive',
          icon: 'https://render.guildwars2.com/file/DAD5B03B013CD75A7EA842DAD244990C9D685BDD/1058559.png'
        }
      ],
      [
        {
          id: 1928,
          name: 'Bloody Roar',
          icon: 'https://render.guildwars2.com/file/382002B6265A4D4F5EC305BD09484B0CEC69ACC9/1029971.png'
        },
        {
          id: 2038,
          name: 'King of Fires',
          icon: 'https://render.guildwars2.com/file/4ED712F8B5383CE8EF69682C0C587801A9F7674A/1058558.png'
        },
        {
          id: 2307,
          name: 'Eternal Champion',
          icon: 'https://render.guildwars2.com/file/F375089AC9F1DB43B9FA783B133DECDF2935690D/1029975.png'
        }
      ]
    ]
  },
  {
    id: 22,
    name: 'Defense',
    elite: false,
    icon: 'https://render.guildwars2.com/file/5F0B793A5479007078067CD71D0E01B30602189B/1012030.png',
    minorTraits: [
      {
        id: 1350,
        name: 'Thick Skin',
        icon: 'https://render.guildwars2.com/file/59197BA1552B93AD7C71A5014A0F130FBA936B01/1012795.png'
      },
      {
        id: 1348,
        name: 'Adrenal Health',
        icon: 'https://render.guildwars2.com/file/32A8CA56381F242642D7193B24284F922D23A2E3/1012796.png'
      },
      {
        id: 1380,
        name: 'Hardened Armor',
        icon: 'https://render.guildwars2.com/file/10055830259435E5B2B1B2EC1E63FCDC9648CC4D/1012797.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1376,
          name: 'Shield Master',
          icon: 'https://render.guildwars2.com/file/6B4F13BB430F77C130FFD8E827E3D7337CCC52B1/1012786.png'
        },
        {
          id: 1488,
          name: 'Dogged March',
          icon: 'https://render.guildwars2.com/file/1208F72B415BE25E1D98194418A591AAC7D476E2/1012787.png'
        },
        {
          id: 1372,
          name: 'Cull the Weak',
          icon: 'https://render.guildwars2.com/file/30A2CFB00C436ACEC5C513360916B5AE030AFCDC/1012788.png'
        }
      ],
      [
        {
          id: 1368,
          name: 'Defy Pain',
          icon: 'https://render.guildwars2.com/file/3225C41AA337BF4B2FCA310D9F5AD70D94ACC074/1012793.png'
        },
        {
          id: 1379,
          name: 'Resilient Roll',
          icon: 'https://render.guildwars2.com/file/2BA7BE3562A3A9DDE14DE6D9A40C650379A71918/1012790.png'
        },
        {
          id: 1367,
          name: 'Merciless Hammer',
          icon: 'https://render.guildwars2.com/file/203E0DEC94900B5305F309A1337D03D70FF9426E/1012804.png'
        }
      ],
      [
        {
          id: 1375,
          name: 'Last Stand',
          icon: 'https://render.guildwars2.com/file/E8BE056A0835F61B5672F4229D6022CA6E213857/1012789.png'
        },
        {
          id: 1649,
          name: 'Cleansing Ire',
          icon: 'https://render.guildwars2.com/file/C8CA1665D0ECE10CF8DC66030C22A20957595B32/1012791.png'
        },
        {
          id: 1708,
          name: 'Stalwart Strength',
          icon: 'https://render.guildwars2.com/file/630279C914D8BF414C2358281F1A37EDF86B203B/1012794.png'
        }
      ]
    ]
  },
  {
    id: 36,
    name: 'Arms',
    elite: false,
    icon: 'https://render.guildwars2.com/file/03754E10970D0C68D76A1955245D7CB39AA21E59/1012029.png',
    minorTraits: [
      {
        id: 1342,
        name: 'Furious Burst',
        icon: 'https://render.guildwars2.com/file/F55BA3110EE6C86A32D2F1630CD150DB56D43C4B/1012783.png'
      },
      {
        id: 1343,
        name: 'Deep Strikes',
        icon: 'https://render.guildwars2.com/file/CB90382E6F963E4F769616310A9916144CEEF950/1012777.png'
      },
      {
        id: 1337,
        name: 'Bloodlust',
        icon: 'https://render.guildwars2.com/file/CF9E0EB2A903025041A74E91222FF62C0BD4FC7F/1012785.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1455,
          name: 'Wounding Precision',
          icon: 'https://render.guildwars2.com/file/73056F60060BCF6BAE08555DAA0E04E2500367CF/1012774.png'
        },
        {
          id: 1344,
          name: 'Signet Mastery',
          icon: 'https://render.guildwars2.com/file/3D117C0158CD7A55BE740D6B072807A3121C90A1/1012775.png'
        },
        {
          id: 1334,
          name: 'Opportunist',
          icon: 'https://render.guildwars2.com/file/B40701BC75C658E24A57F12A6037F65CCB62A5D1/1012778.png'
        }
      ],
      [
        {
          id: 1315,
          name: 'Unsuspecting Foe',
          icon: 'https://render.guildwars2.com/file/04C5EA49603A3BBF09040FD2129848AD163E5523/1012784.png'
        },
        {
          id: 1316,
          name: 'Sundering Burst',
          icon: 'https://render.guildwars2.com/file/933C9720EAD45955076748A3C6C224EA3D69C62D/1012776.png'
        },
        {
          id: 1333,
          name: 'Blademaster',
          icon: 'https://render.guildwars2.com/file/B697F7F5A8BFAC232816E3B8A0DEE9CD062408D3/1012779.png'
        }
      ],
      [
        {
          id: 1336,
          name: 'Burst Precision',
          icon: 'https://render.guildwars2.com/file/B93F326A054F0067AA1A35BB0F5E6B5C01992FB9/1012780.png'
        },
        {
          id: 1346,
          name: 'Furious',
          icon: 'https://render.guildwars2.com/file/10E50EAACB736A66317919D274C2594597AEE893/1012781.png'
        },
        {
          id: 1707,
          name: 'Dual Wielding',
          icon: 'https://render.guildwars2.com/file/43EA44D70D07DA34373536D607AF79AD09FA1713/1012782.png'
        }
      ]
    ]
  },
  {
    id: 51,
    name: 'Discipline',
    elite: false,
    icon: 'https://render.guildwars2.com/file/D10B771D01C85DA404472EE90F35EF15B0B36240/1012031.png',
    minorTraits: [
      {
        id: 1415,
        name: 'Versatile Rage',
        icon: 'https://render.guildwars2.com/file/43326D076ABE56ADA04A0D051016E5E1F9225301/1012807.png'
      },
      {
        id: 1416,
        name: 'Fast Hands',
        icon: 'https://render.guildwars2.com/file/E411053E9A4BCE69750DA02AB1CDC5D6260E9560/1012808.png'
      },
      {
        id: 1417,
        name: 'Versatile Power',
        icon: 'https://render.guildwars2.com/file/9C4B111C63D603BD0F73EA0015DE0ABDEE0D107A/1012809.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1329,
          name: 'Crack Shot',
          icon: 'https://render.guildwars2.com/file/505DE7D46224C105D2E953FDFC6807E30EBCA733/1012798.png'
        },
        {
          id: 1413,
          name: "Warrior's Sprint",
          icon: 'https://render.guildwars2.com/file/0D0DD0E0002F5ED423FF01A85E9890D32CE7960E/1012799.png'
        },
        {
          id: 1381,
          name: 'Stalwart Focus',
          icon: 'https://render.guildwars2.com/file/20A8F34554C69CC12A6013AF002114F008557C0F/1012800.png'
        }
      ],
      [
        {
          id: 1484,
          name: 'Doubled Standards',
          icon: 'https://render.guildwars2.com/file/3DD095F41404F7F043C70854AB944116F45570F7/1012801.png'
        },
        {
          id: 1489,
          name: 'Destruction of the Empowered',
          icon: 'https://render.guildwars2.com/file/663A52BDEEBF0AE40DC8995D0234EE196DFDECB5/1012802.png'
        },
        {
          id: 1709,
          name: "Brawler's Recovery",
          icon: 'https://render.guildwars2.com/file/751DB3B9700B6B14CAE9D2BE77D32795056DB665/1012803.png'
        }
      ],
      [
        {
          id: 1369,
          name: 'Axe Mastery',
          icon: 'https://render.guildwars2.com/file/DC444D0B05F5BDB3D096480617E7DF40C54D0E0A/1012818.png'
        },
        {
          id: 1317,
          name: 'Heightened Focus',
          icon: 'https://render.guildwars2.com/file/FC5A1E5591B670A175ED01297B48C7F2B1DC1FED/1012806.png'
        },
        {
          id: 1657,
          name: 'Burst Mastery',
          icon: 'https://render.guildwars2.com/file/4E393624960EF6AA7D5C9CF27902FAFC180B5DB5/1012805.png'
        }
      ]
    ]
  },
  {
    id: 61,
    name: 'Spellbreaker',
    elite: true,
    icon: 'https://render.guildwars2.com/file/06DFB7E3F267ADD0BB43C7383251343858371D02/1769896.png',
    minorTraits: [
      {
        id: 2175,
        name: "Spellbreaker's Conviction",
        icon: 'https://render.guildwars2.com/file/BD996FC6ABFDC280A0B3356C786D7C5D20DE4139/1770021.png'
      },
      {
        id: 2162,
        name: 'Dispelling Force',
        icon: 'https://render.guildwars2.com/file/FA30C4D650B0F1BD3569A36F9AF6F4975D726164/1770022.png'
      },
      {
        id: 2130,
        name: "Attacker's Insight",
        icon: 'https://render.guildwars2.com/file/211512491566A15FDCE3E1B64A010445F1EB39E5/1770023.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2107,
          name: 'Pure Strike',
          icon: 'https://render.guildwars2.com/file/11D652C0A03EBE2C50D7C804E30BD66862025F69/1770012.png'
        },
        {
          id: 2153,
          name: 'Guard Counter',
          icon: 'https://render.guildwars2.com/file/612A9DC2C632D8D64CA2630768A61AF26F7E7305/1770013.png'
        },
        {
          id: 2140,
          name: 'No Escape',
          icon: 'https://render.guildwars2.com/file/25421B04ACA795BB215FEC33EA9567A1C84D7844/1770014.png'
        }
      ],
      [
        {
          id: 2126,
          name: 'Loss Aversion',
          icon: 'https://render.guildwars2.com/file/CBD0D10F08D5D57ECAF57C0CC122D6419BE0060A/1770015.png'
        },
        {
          id: 2097,
          name: 'Resilient Counter',
          icon: 'https://render.guildwars2.com/file/BAE747D0F6E36FC5511E24BBAE66D071374AC91A/1770016.png'
        },
        {
          id: 2095,
          name: 'Sun and Moon Style',
          icon: 'https://render.guildwars2.com/file/6FF450563C661EB718CF167C9CE20D667F4B519E/1770017.png'
        }
      ],
      [
        {
          id: 2163,
          name: 'Enchantment Collapse',
          icon: 'https://render.guildwars2.com/file/AE076D6974ED7BD015E2EBBDDBCDEC1E21220CE7/1770018.png'
        },
        {
          id: 2168,
          name: 'Resolute Counter',
          icon: 'https://render.guildwars2.com/file/2D0B31CB9C66442AD024195224AD6D343C733231/1770019.png'
        },
        {
          id: 2060,
          name: 'Magebane Tether',
          icon: 'https://render.guildwars2.com/file/040FEAA53CC4AE3273E753D16A585EA3C9452F6E/1770020.png'
        }
      ]
    ]
  },
  {
    id: 68,
    name: 'Bladesworn',
    elite: true,
    icon: 'https://render.guildwars2.com/file/9D0ADEDFDEACCCD2B27103A944B1E7F6C21DCBE2/2491509.png',
    minorTraits: [
      {
        id: 2226,
        name: 'Gun X Sword',
        icon: 'https://render.guildwars2.com/file/BACAB405BB94D2C40568E273D0BEE55D29777FC3/2491552.png'
      },
      {
        id: 2242,
        name: 'Dragonscale Defense',
        icon: 'https://render.guildwars2.com/file/E4EEF71C9743D206D3F0B9E13A37D426EA0E7CBE/2491553.png'
      },
      {
        id: 2236,
        name: 'Guns and Glory',
        icon: 'https://render.guildwars2.com/file/0B2291AEBD4B3755F0CD9A38987797763AD34790/2491554.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2225,
          name: 'Unseen Sword',
          icon: 'https://render.guildwars2.com/file/FB0FA6E411D0CC2623012BAFCF3C28D659B4BE06/2491545.png'
        },
        {
          id: 2260,
          name: 'Sharp as the Wind',
          icon: 'https://render.guildwars2.com/file/E90966C0A20291FB1FC0FFC73BAFE756B938A805/2491544.png'
        },
        {
          id: 2237,
          name: "River's Flow",
          icon: 'https://render.guildwars2.com/file/CBAF7BFF0A76F6F9C1C664F6A45FA0CDABCA77C6/2491543.png'
        }
      ],
      [
        {
          id: 2253,
          name: 'Unshakable Mountain',
          icon: 'https://render.guildwars2.com/file/9E3A19BD9F097F5237990A732699514134470D9A/2491546.png'
        },
        {
          id: 2302,
          name: 'Fierce as Fire',
          icon: 'https://render.guildwars2.com/file/630362D11956CB69199DE9CE0EEA03232DC9DA38/2491547.png'
        },
        {
          id: 2303,
          name: 'Lush Forest',
          icon: 'https://render.guildwars2.com/file/3113E30122B1C50F30FE80F7A603DCC8DCF2BC01/2491548.png'
        }
      ],
      [
        {
          id: 2261,
          name: 'Immortal Dragon',
          icon: 'https://render.guildwars2.com/file/EFD50422C974522BEC9FAF95006FF71DBD711BEC/2491549.png'
        },
        {
          id: 2239,
          name: 'Unyielding Dragon',
          icon: 'https://render.guildwars2.com/file/1EB2252BC0787298D1C656045C627D59AE666745/2491550.png'
        },
        {
          id: 2245,
          name: 'Daring Dragon',
          icon: 'https://render.guildwars2.com/file/A2267CB3E238FF9732565CDE55CCFE02B478E575/2491551.png'
        }
      ]
    ]
  },
  {
    id: 74,
    name: 'Paragon',
    elite: true,
    icon: 'https://render.guildwars2.com/file/B915D599CB40733130F7121B5CDE0BE42ED9E06C/3679904.png',
    minorTraits: [
      {
        id: 2373,
        name: 'Rally the Valiant',
        icon: 'https://render.guildwars2.com/file/045E3160E19E1C2118495014EB7FDB3D0F0C26D1/3680036.png'
      },
      {
        id: 2418,
        name: 'Inspiring Implements',
        icon: 'https://render.guildwars2.com/file/E3204571092E5421DB040C1CA7CF6D4DB020C40A/3680037.png'
      },
      {
        id: 2340,
        name: 'Unyielding Resolve',
        icon: 'https://render.guildwars2.com/file/B59FD327A19AE730A3EEE4B444216D1372A3AE77/3680038.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2345,
          name: 'Call to Action',
          icon: 'https://render.guildwars2.com/file/1B6120AEA5BC4075D6BFACA03708AA3A687A2D0B/3680027.png'
        },
        {
          id: 2433,
          name: 'Calming Tongue',
          icon: 'https://render.guildwars2.com/file/09E0E10AC5A6A5F011EFDC5B0FAF5ACBD43446ED/3680028.png'
        },
        {
          id: 2357,
          name: 'Liberating Liaise',
          icon: 'https://render.guildwars2.com/file/FC6B3A6C31385C46DDCD71A30AB5B3AABCA4ABCE/3680029.png'
        }
      ],
      [
        {
          id: 2385,
          name: 'Strengthening Stanzas',
          icon: 'https://render.guildwars2.com/file/0B71DE9F6F070A90257FCC7F6F13AEB5AD0C0D0A/3680034.png'
        },
        {
          id: 2426,
          name: 'Invigorating Tempo',
          icon: 'https://render.guildwars2.com/file/1473CC04EF16295D167629EB4E0D3EF53F282F05/3680031.png'
        },
        {
          id: 2399,
          name: 'Reverberation',
          icon: 'https://render.guildwars2.com/file/02BCDA5A38D15A02000A075B4503160D5191665C/3680032.png'
        }
      ],
      [
        {
          id: 2369,
          name: 'Feverish Pulse',
          icon: 'https://render.guildwars2.com/file/A372A2E828F4A6EF4F0F2C205DA0E7E8EDC695C1/3680033.png'
        },
        {
          id: 2375,
          name: 'Brisk Pacing',
          icon: 'https://render.guildwars2.com/file/9D35A3CED107B068AD4D20A3782BF6262FE36610/3680030.png'
        },
        {
          id: 2428,
          name: 'Enduring Refrain',
          icon: 'https://render.guildwars2.com/file/2AB5996B0180A45A53E7FC4AB5230D6F5A3C0767/3680035.png'
        }
      ]
    ]
  }
];
