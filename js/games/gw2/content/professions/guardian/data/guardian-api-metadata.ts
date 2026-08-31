// Generated Guild Wars 2 API metadata for guardian.
// Snapshot: 2026-07-25. Run scripts/data/update-profession-api-data.mjs --profession Guardian to refresh.
// Simulator mechanics are maintained under guardian/mechanics/.

import type { Gw2ApiSpecialization, Gw2ApiTrait } from '#gw2/integrations/patches/authoring/api-metadata-types.js';
import type { GuardianSkill } from '#gw2/content/professions/guardian/types.js';

export type GuardianApiTrait = Gw2ApiTrait;
export type GuardianApiSpecialization = Gw2ApiSpecialization;

export const DATA_SNAPSHOT: string = '2026-07-25';
export const SPECIALIZATIONS: readonly GuardianApiSpecialization[] = [
  {
    id: 42,
    name: 'Zeal',
    elite: false,
    icon: 'https://render.guildwars2.com/file/479676FC6349C7A12D429B685F0D4205ABFF2F94/1011999.png',
    background: 'https://render.guildwars2.com/file/9244C9726D2AD30F9D7E22CF5C7A49601BFAFCC0/1012050.png',
    minorTraits: [
      {
        id: 648,
        name: "Zealot's Resolution",
        description: 'Cast Lesser Symbol of Resolution when you strike an enemy below the health threshold.',
        icon: 'https://render.guildwars2.com/file/617705CDC4E6D5CA0EB9F492B94B4D060F354980/1012459.png',
        specialization: 'Zeal',
        tier: 1,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 646,
        name: 'Symbolic Exposure',
        description:
          '<c=@abilitytype>Symbols</c> inflict vulnerability on foes. Deal increased strike damage to vulnerable foes.',
        icon: 'https://render.guildwars2.com/file/613CC440C79367EA7A6804EFA34ECC5F08EF6BE9/1012460.png',
        specialization: 'Zeal',
        tier: 2,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 649,
        name: 'Symbolic Avenger',
        description: 'Your strike damage is increased whenever your <c=@abilitytype>Symbols</c> hit a foe.',
        icon: 'https://render.guildwars2.com/file/4D3415E7E81E71E474CE6256A5C6024FAFAC0A61/1012461.png',
        specialization: 'Zeal',
        tier: 3,
        position: 0,
        slot: 'Minor'
      }
    ],
    majorTraits: [
      [
        {
          id: 563,
          name: 'Wrathful Spirit',
          description: 'Aegis grants boons when it ends.',
          icon: 'https://render.guildwars2.com/file/C9EB5B02B1AB1615D60FE82C457408C2D9CC49CC/1012450.png',
          specialization: 'Zeal',
          tier: 1,
          position: 1,
          slot: 'Major'
        },
        {
          id: 634,
          name: 'Fiery Wrath',
          description: 'Deal increased strike damage to burning foes.',
          icon: 'https://render.guildwars2.com/file/77AF59F6F43203DC1BBC3EBC66153D484AEF084C/1012451.png',
          specialization: 'Zeal',
          tier: 1,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1925,
          name: 'Zealous Scepter',
          description:
            'Gain might when your Virtue skill 1 passive effect triggers; gain more might while wielding a scepter.',
          icon: 'https://render.guildwars2.com/file/AFB520780B6C135961D60A389450800F1A78660E/1012452.png',
          specialization: 'Zeal',
          tier: 1,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 628,
          name: 'Renewing Splendor',
          description:
            'Heal yourself when you create a light field or finish a combo in a light field.<br><c=@reminder>Whirl finishers can only trigger this trait once per interval.</c>',
          icon: 'https://render.guildwars2.com/file/C1A6EBA29894C831AAEE0D1C47080D12F9BA3AA3/1012458.png',
          specialization: 'Zeal',
          tier: 2,
          position: 1,
          slot: 'Major'
        },
        {
          id: 653,
          name: 'Zealous Blade',
          description:
            'Your power is increased. Gain additional power while wielding a greatsword. Your greatsword skills have reduced recharge.',
          icon: 'https://render.guildwars2.com/file/39E4E73D0B5C33404B59B30508BC2FB95640ABD5/1012454.png',
          specialization: 'Zeal',
          tier: 2,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1556,
          name: 'Kindled Zeal',
          description: 'Gain condition damage based on your power.',
          icon: 'https://render.guildwars2.com/file/18F3380F1F593DF16FBBF7E9F6AABAE96F444E0D/1012455.png',
          specialization: 'Zeal',
          tier: 2,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 635,
          name: 'Eternal Armory',
          description:
            '<c=@abilitytype>Spirit Weapons</c> gain additional casts and burn foes with their first strike.',
          icon: 'https://render.guildwars2.com/file/7AC201ED19C00351CF647F0F657BBF03043DF705/1012456.png',
          specialization: 'Zeal',
          tier: 3,
          position: 1,
          slot: 'Major'
        },
        {
          id: 637,
          name: 'Shattered Aegis',
          description: 'When an aegis you applied blocks an attack, it unleashes a Mystic Rebuke.',
          icon: 'https://render.guildwars2.com/file/5D0BC6DF96B62BF5FBA1B41BEC064BD9D4E421F2/1012457.png',
          specialization: 'Zeal',
          tier: 3,
          position: 2,
          slot: 'Major'
        },
        {
          id: 2017,
          name: 'Furious Focus',
          description:
            'Your strike damage and movement speed are increased while you have fury. Create a Lesser Symbol of Blades when you activate Virtue skill 1.',
          icon: 'https://render.guildwars2.com/file/7450B5C97FA442E5B85442A4F6EF610DC403E85A/1012453.png',
          specialization: 'Zeal',
          tier: 3,
          position: 3,
          slot: 'Major'
        }
      ]
    ]
  },
  {
    id: 16,
    name: 'Radiance',
    elite: false,
    icon: 'https://render.guildwars2.com/file/16A05D047DFC0828D0E496F46FD8B20F97B42EB3/1011996.png',
    background: 'https://render.guildwars2.com/file/9BE9604B0378D103EB2F551730BF802F2B1F3AA0/1012047.png',
    minorTraits: [
      {
        id: 572,
        name: 'Justice is Blind',
        description: 'Gain a light aura and blind nearby foes when you activate Virtue skill 1.',
        icon: 'https://render.guildwars2.com/file/090954DB1B76C01908A6AC9E38A9E4A9F10D131D/1012423.png',
        specialization: 'Radiance',
        tier: 1,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 571,
        name: 'Renewed Justice',
        description: 'Virtue skill 1 is renewed when you kill a foe.',
        icon: 'https://render.guildwars2.com/file/0FE11090EDC73ED447F5C5D50F6B9C44679B520F/1012424.png',
        specialization: 'Radiance',
        tier: 2,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 568,
        name: 'Radiant Power',
        description:
          'Attacks against burning foes have an increased chance to critically hit. Your ferocity is increased.',
        icon: 'https://render.guildwars2.com/file/97F407C799FAAA7777E313031EB57CCEED3B47F2/1012425.png',
        specialization: 'Radiance',
        tier: 3,
        position: 0,
        slot: 'Minor'
      }
    ],
    majorTraits: [
      [
        {
          id: 577,
          name: 'Inner Fire',
          description: 'Gain fury when you strike a foe that has burning stacks over the threshold.',
          icon: 'https://render.guildwars2.com/file/56CEF1A4BEDBC4AC5946C5030D33ADE11CC6B965/1012415.png',
          specialization: 'Radiance',
          tier: 1,
          position: 1,
          slot: 'Major'
        },
        {
          id: 566,
          name: 'Right-Hand Strength',
          description:
            'Your precision is increased. Gain increased power while wielding a one-handed weapon in your main hand.',
          icon: 'https://render.guildwars2.com/file/0A3C2448AD693726F62934E660E07B5E04A406AC/1012416.png',
          specialization: 'Radiance',
          tier: 1,
          position: 2,
          slot: 'Major'
        },
        {
          id: 574,
          name: "Healer's Resolution",
          description: 'Gain resolution when using a heal skill.',
          icon: 'https://render.guildwars2.com/file/27F73C39699117B22DA74EF60E40C9B67D737C0D/1012414.png',
          specialization: 'Radiance',
          tier: 1,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 578,
          name: 'Wrath of Justice',
          description: 'Striking an enemy with the damaging effect from Virtue skill 1 casts Lesser Signet of Wrath.',
          icon: 'https://render.guildwars2.com/file/CD1F3745DD010649D5F53553B695021580221DC0/1012417.png',
          specialization: 'Radiance',
          tier: 2,
          position: 1,
          slot: 'Major'
        },
        {
          id: 567,
          name: 'Radiant Fire',
          description:
            "Zealot's Flame is improved. Burning you inflict has increased duration, and your torch skills gain reduced recharge.",
          icon: 'https://render.guildwars2.com/file/0E931C4BC7DD210747C130F2376E68DFA2126359/1012419.png',
          specialization: 'Radiance',
          tier: 2,
          position: 2,
          slot: 'Major'
        },
        {
          id: 565,
          name: 'Retribution',
          description: 'Strike damage dealt is increased while you have resolution.',
          icon: 'https://render.guildwars2.com/file/324CD720BC3A5F1B6B154BD909165F0DB03CBC0D/1012418.png',
          specialization: 'Radiance',
          tier: 2,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 1686,
          name: 'Amplified Wrath',
          description:
            'Burning you inflict deals increased damage. Burning duration applied by the passive effect of Virtue skill 1 is increased.',
          icon: 'https://render.guildwars2.com/file/4677301004B3DF18A27D3141441AF3919AA10E7C/1012420.png',
          specialization: 'Radiance',
          tier: 3,
          position: 1,
          slot: 'Major'
        },
        {
          id: 579,
          name: 'Perfect Inscriptions',
          description:
            '<c=@abilitytype>Signets</c> gain improved passive effects and continue to grant their passive bonuses while recharging.',
          icon: 'https://render.guildwars2.com/file/29AAF6F60D2EAD20D6FA0FB097504D7AF8F6312F/1012421.png',
          specialization: 'Radiance',
          tier: 3,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1683,
          name: 'Righteous Instincts',
          description: 'Resolution increases your chances to critically strike and grants might each interval.',
          icon: 'https://render.guildwars2.com/file/AB3391394750222276EFF9FE3AD3DDE29DCE04AF/1012422.png',
          specialization: 'Radiance',
          tier: 3,
          position: 3,
          slot: 'Major'
        }
      ]
    ]
  },
  {
    id: 13,
    name: 'Valor',
    elite: false,
    icon: 'https://render.guildwars2.com/file/F8A95D6D3904A1F6430CF2D33A02FDF2A6132037/1011997.png',
    background: 'https://render.guildwars2.com/file/12B4C72ADCE4EF2890606111B400630F3832F83D/1012048.png',
    minorTraits: [
      {
        id: 582,
        name: 'Valorous Defense',
        description: 'Gain aegis when you are struck while below the health threshold.',
        icon: 'https://render.guildwars2.com/file/BE72671325E165BAFD4DCFD11C60D70C7371C439/1012435.png',
        specialization: 'Valor',
        tier: 1,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 594,
        name: 'Steadfast Courage',
        description: 'Gain protection when you block an incoming attack with aegis.',
        icon: 'https://render.guildwars2.com/file/07D0C4AF0FF1365D1670EFBDA6F8A69DAF16A409/1012436.png',
        specialization: 'Valor',
        tier: 2,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 583,
        name: 'Might of the Protector',
        description: 'Gain might when you block attacks.',
        icon: 'https://render.guildwars2.com/file/A3CBB96B5D0DFB084E3F4E0C3260FE01923CA7EA/1012437.png',
        specialization: 'Valor',
        tier: 3,
        position: 0,
        slot: 'Minor'
      }
    ],
    majorTraits: [
      [
        {
          id: 588,
          name: 'Strength of the Fallen',
          description: 'Lose conditions every interval. Health degenerates more slowly while downed.',
          icon: 'https://render.guildwars2.com/file/4304ABF568F659CABE54751F020A21FE90B7A057/1012426.png',
          specialization: 'Valor',
          tier: 1,
          position: 1,
          slot: 'Major'
        },
        {
          id: 581,
          name: "Smiter's Boon",
          description: 'Cast Lesser Smite Condition when you use a healing skill.',
          icon: 'https://render.guildwars2.com/file/21B93A5D0C246A42957222350B45C00A14DF0DB7/1012427.png',
          specialization: 'Valor',
          tier: 1,
          position: 2,
          slot: 'Major'
        },
        {
          id: 633,
          name: 'Focus Mastery',
          description: 'Focus skills grant you protection and gain reduced recharge.',
          icon: 'https://render.guildwars2.com/file/E6D027337F7B5D6E32BE3DB3224025CC667635D5/1012428.png',
          specialization: 'Valor',
          tier: 1,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 580,
          name: 'Stalwart Defender',
          description: 'Gain toughness when wielding a shield, and shield skills gain reduced recharge.',
          icon: 'https://render.guildwars2.com/file/F2079E05EA7F0507DDD60B2603450BC1C902585E/1012429.png',
          specialization: 'Valor',
          tier: 2,
          position: 1,
          slot: 'Major'
        },
        {
          id: 584,
          name: 'Redemption',
          description: 'Cast Lesser Litany of Wrath when you activate Virtue skill 3.',
          icon: 'https://render.guildwars2.com/file/B5C9AAF67FA6305CB414C196EB1503493B5E0D59/1012430.png',
          specialization: 'Valor',
          tier: 2,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1684,
          name: 'Communal Defenses',
          description: 'Blocking an attack grants aegis to nearby allies.',
          icon: 'https://render.guildwars2.com/file/783B0AA64AEDEA0E7AE167692BE42CEDDA519F9F/1012431.png',
          specialization: 'Valor',
          tier: 2,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 585,
          name: 'Altruistic Healing',
          description: 'Heal yourself when you grant a boon to an ally.',
          icon: 'https://render.guildwars2.com/file/3BF9357422DAF204E2CFBA3D49CD679B2CFD2EF8/1012432.png',
          specialization: 'Valor',
          tier: 3,
          position: 1,
          slot: 'Major'
        },
        {
          id: 586,
          name: "Monk's Focus",
          description: '<c=@abilitytype>Meditation</c> skills heal you and grant fury to nearby allies.',
          icon: 'https://render.guildwars2.com/file/01FC7AF9B1CDFF61160FE3BDF63D52C50225EA9E/1012433.png',
          specialization: 'Valor',
          tier: 3,
          position: 2,
          slot: 'Major'
        },
        {
          id: 589,
          name: 'Tenacious Defense',
          description: 'Aegis you grant reduces the recharge time of Virtue skill 3 when it blocks an attack.',
          icon: 'https://render.guildwars2.com/file/15504BAE0F1557F00E0403D64DD87D101C3FE006/1012434.png',
          specialization: 'Valor',
          tier: 3,
          position: 3,
          slot: 'Major'
        }
      ]
    ]
  },
  {
    id: 49,
    name: 'Honor',
    elite: false,
    icon: 'https://render.guildwars2.com/file/A4C0E39152B005EE226DA56D010DEEABB1ADBF2B/1011995.png',
    background: 'https://render.guildwars2.com/file/98C3AB64254E61E59D03D3AF29D75314730E9E72/1012046.png',
    minorTraits: [
      {
        id: 564,
        name: 'Vigorous Precision',
        description: 'Gain vigor at the end of your dodge roll.',
        icon: 'https://render.guildwars2.com/file/05BF7C7F4D37239656B4047519F698CB32BDD67A/1012411.png',
        specialization: 'Honor',
        tier: 1,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 551,
        name: 'Selfless Daring',
        description: 'The end of your dodge roll heals nearby allies.',
        icon: 'https://render.guildwars2.com/file/32BAB20860259FF3E8214E784E6BE7521213089C/1012412.png',
        specialization: 'Honor',
        tier: 2,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 1685,
        name: 'Purity of Body',
        description: 'Your Virtue skill 2 passive also regenerates endurance.',
        icon: 'https://render.guildwars2.com/file/4393150B92392F32D10C3D551A363FE2C9400E27/1012413.png',
        specialization: 'Honor',
        tier: 3,
        position: 0,
        slot: 'Minor'
      }
    ],
    majorTraits: [
      [
        {
          id: 1899,
          name: 'Invigorated Bulwark',
          description:
            'Increase your healing to other allies each time you block an attack. Mace skills gain reduced recharge and their boons gain increased duration.',
          icon: 'https://render.guildwars2.com/file/504B1F9EF89652FD5A00D52DE52A52B7023043E9/1012402.png',
          specialization: 'Honor',
          tier: 1,
          position: 1,
          slot: 'Major'
        },
        {
          id: 559,
          name: 'Protective Reviver',
          description:
            'Cast Lesser Shield of Absorption when you begin reviving an ally. Shield of Absorption revives allies when it detonates.',
          icon: 'https://render.guildwars2.com/file/5F23B231E1039C4DC401BA2D6AE473C0E1E06D7E/1012403.png',
          specialization: 'Honor',
          tier: 1,
          position: 2,
          slot: 'Major'
        },
        {
          id: 654,
          name: "Protector's Restoration",
          description: 'Cast Lesser Symbol of Protection when you use a healing skill.',
          icon: 'https://render.guildwars2.com/file/DB1111AB10B1D3FAA67EF4957A0167BB1E61C90C/1012404.png',
          specialization: 'Honor',
          tier: 1,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 557,
          name: 'Honorable Staff',
          description:
            'Gain concentration. Empower now grants endurance to allies in addition to its effects. Staff skills recharge time is reduced.',
          icon: 'https://render.guildwars2.com/file/4B04DDA13B459179E500052B03B39579093BAD18/1012405.png',
          specialization: 'Honor',
          tier: 2,
          position: 1,
          slot: 'Major'
        },
        {
          id: 549,
          name: 'Pure of Heart',
          description: 'Aegis heals when it blocks an attack.',
          icon: 'https://render.guildwars2.com/file/B8FD6EB1B2C6CF7CEFE4715994B6FBCC201FF24D/1012406.png',
          specialization: 'Honor',
          tier: 2,
          position: 2,
          slot: 'Major'
        },
        {
          id: 562,
          name: 'Empowering Might',
          description: 'Grant might to nearby allies when you critically strike.',
          icon: 'https://render.guildwars2.com/file/F8467ACFF89AFDE01C5E9F706A7341A3D2C9597C/1012407.png',
          specialization: 'Honor',
          tier: 2,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 553,
          name: 'Pure of Voice',
          description: '<c=@abilitytype>Shout</c> skills convert conditions to boons on allies.',
          icon: 'https://render.guildwars2.com/file/6ED99443C2E00AEBCF52F974221B0B31A0CCB457/1012408.png',
          specialization: 'Honor',
          tier: 3,
          position: 1,
          slot: 'Major'
        },
        {
          id: 558,
          name: 'Writ of Persistence',
          description: '<c=@abilitytype>Symbols</c> are improved and heal allies.',
          icon: 'https://render.guildwars2.com/file/663CB2609609A546744620D72EBD7ECEC9020FA6/1012409.png',
          specialization: 'Honor',
          tier: 3,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1682,
          name: 'Force of Will',
          description: 'Gain increased vitality. Healing others is improved based on a percentage of your vitality.',
          icon: 'https://render.guildwars2.com/file/AA9EDC9B5B343F27372ADDBA320702D3A19CD7D5/1012410.png',
          specialization: 'Honor',
          tier: 3,
          position: 3,
          slot: 'Major'
        }
      ]
    ]
  },
  {
    id: 46,
    name: 'Virtues',
    elite: false,
    icon: 'https://render.guildwars2.com/file/E165042F92999B3BEFA91E280CB807F62EF30218/1011998.png',
    background: 'https://render.guildwars2.com/file/08FE79184543F8314648D3104268789B484AB0BF/1012049.png',
    minorTraits: [
      {
        id: 621,
        name: 'Inspired Virtue',
        description:
          '<c=@abilitytype>Virtues</c> apply boons to allies when activated. Deal increased strike damage for each boon on you.',
        icon: 'https://render.guildwars2.com/file/6FF2B9A0099D3C75FBE97D36CBCC0470F63DFE06/1012447.png',
        specialization: 'Virtues',
        tier: 1,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 604,
        name: 'Virtue of Resolution',
        description:
          'Gain resolution when you activate a <c=@abilitytype>Virtue</c>. Resolution you grant has increased duration.',
        icon: 'https://render.guildwars2.com/file/2869F4977D1EDF02E612C62D39DD69CA372E6928/1012448.png',
        specialization: 'Virtues',
        tier: 2,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 620,
        name: 'Power of the Virtuous',
        description: 'Gain condition damage based on your vitality. <c=@abilitytype>Virtues</c> gain reduced recharge.',
        icon: 'https://render.guildwars2.com/file/4BA068C09760BD341196A463B7B1D1E1AC3E6098/1012449.png',
        specialization: 'Virtues',
        tier: 3,
        position: 0,
        slot: 'Minor'
      }
    ],
    majorTraits: [
      [
        {
          id: 624,
          name: 'Unscathed Contender',
          description:
            'Strike damage dealt is increased while you have aegis. Strike damage dealt is increased while you are above the health threshold.',
          icon: 'https://render.guildwars2.com/file/0FF7C102A0F70E6398712C12A62B427A2B6DC05F/1012438.png',
          specialization: 'Virtues',
          tier: 1,
          position: 1,
          slot: 'Major'
        },
        {
          id: 625,
          name: 'Resolute Subconscious',
          description:
            'Gain resolution and aegis when disabled.<br><c=@reminder>Disables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.</c>',
          icon: 'https://render.guildwars2.com/file/BB3C57FD1467961118ACB5FDE84F39D965C9670B/1012439.png',
          specialization: 'Virtues',
          tier: 1,
          position: 2,
          slot: 'Major'
        },
        {
          id: 617,
          name: 'Master of Consecrations',
          description: '<c=@abilitytype>Consecrations</c> gain increased duration.',
          icon: 'https://render.guildwars2.com/file/FA5B6B9E701C3F2BEAD6E053A4E8681B4878AFC4/1012440.png',
          specialization: 'Virtues',
          tier: 1,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 603,
          name: 'Inspiring Virtue',
          description: 'Strike damage dealt is increased after activating a virtue.',
          icon: 'https://render.guildwars2.com/file/3EC057E1739EF1F22815605956B46142D2669A6D/1466322.png',
          specialization: 'Virtues',
          tier: 2,
          position: 1,
          slot: 'Major'
        },
        {
          id: 610,
          name: 'Absolute Resolve',
          description:
            "Activating Virtue skill 2 removes conditions from nearby allies. Virtue skill 2's passive effect is stronger.",
          icon: 'https://render.guildwars2.com/file/FD1ED24CEFFABCD52D22CC1F955094E80C0C3C9B/1012442.png',
          specialization: 'Virtues',
          tier: 2,
          position: 2,
          slot: 'Major'
        },
        {
          id: 587,
          name: 'Glacial Heart',
          description:
            'Mighty Blow becomes Glacial Blow. Heal when you disable, immobilize, or chill a foe.\n<br><c=@reminder>Disables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.</c>',
          icon: 'https://render.guildwars2.com/file/B6B838104E585313E2FA34481FEDBD9F1B6F07B4/1012443.png',
          specialization: 'Virtues',
          tier: 2,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 622,
          name: 'Permeating Wrath',
          description: 'The passive effect of Virtue skill 1 triggers more quickly and now burns in an area.',
          icon: 'https://render.guildwars2.com/file/6A76F53CD306D8E65E3774D7F09FF54326D348B5/1012444.png',
          specialization: 'Virtues',
          tier: 3,
          position: 1,
          slot: 'Major'
        },
        {
          id: 554,
          name: 'Battle Presence',
          description:
            'Nearby allies gain the passive effect of Virtue skill 2.<br><br><c=@reminder>Willbender: Heal allies when your Resolve effect triggers.</c>',
          icon: 'https://render.guildwars2.com/file/33B6DF1FB0AB7C497E3C5467EA22C8ABFFC83D17/1012445.png',
          specialization: 'Virtues',
          tier: 3,
          position: 2,
          slot: 'Major'
        },
        {
          id: 612,
          name: 'Indomitable Courage',
          description:
            'The active effect of Virtue skill 3 breaks stun and grants stability to nearby allies. Its passive effect gains a shorter interval.',
          icon: 'https://render.guildwars2.com/file/2602F16A45D30AECA8D3F11AB1A1FEDADBFD1120/1012446.png',
          specialization: 'Virtues',
          tier: 3,
          position: 3,
          slot: 'Major'
        }
      ]
    ]
  },
  {
    id: 27,
    name: 'Dragonhunter',
    elite: true,
    icon: 'https://render.guildwars2.com/file/736DB02E6DA2ACFAD3B9B0F4655113AD214FFA40/1011994.png',
    background: 'https://render.guildwars2.com/file/6BD5F59A7A0EF4F20C1B1D216AFE2B084CC19FF4/1012045.png',
    minorTraits: [
      {
        id: 1848,
        name: 'Virtuous Action',
        description:
          "The guardian's resolve has further increased, allowing <c=@abilitytype>Virtues</c> to be manifested as physical aspects. Gain access to <c=@abilitytype>Traps</c>.",
        icon: 'https://render.guildwars2.com/file/E7C99D17DDC62D7E07E0D12B2DB27F1903D0D7C5/1012399.png',
        specialization: 'Dragonhunter',
        tier: 1,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 1896,
        name: "Defender's Dogma",
        description:
          'Gain vitality. Blocking an attack causes Justice to reach its maximum charge and reduces the cooldown of Spear of Justice.',
        icon: 'https://render.guildwars2.com/file/4955C7B6C72EA4E49DB67A1106022E7F063AF1E3/1012401.png',
        specialization: 'Dragonhunter',
        tier: 2,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 1926,
        name: 'Pure of Sight',
        description: 'Deal bonus strike damage based on your distance to the enemy.',
        icon: 'https://render.guildwars2.com/file/0F1A24AA6542E9ECAF1DE84D96A84ED0A5ED9759/1012400.png',
        specialization: 'Dragonhunter',
        tier: 3,
        position: 0,
        slot: 'Minor'
      }
    ],
    majorTraits: [
      [
        {
          id: 1898,
          name: "Hunter's Premonition",
          description: '<c=@abilitytype>Trap</c> skills grant aegis when used.',
          icon: 'https://render.guildwars2.com/file/43E37B57D967722DE15C6033DDF10BE663D10201/1012390.png',
          specialization: 'Dragonhunter',
          tier: 1,
          position: 1,
          slot: 'Major'
        },
        {
          id: 1983,
          name: 'Dulled Senses',
          description:
            'Cripple enemies that you disable.<br><c=@reminder>Disables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.</c>',
          icon: 'https://render.guildwars2.com/file/7BFEAC083B4402807D310CCFF1147B2325CF364A/1012395.png',
          specialization: 'Dragonhunter',
          tier: 1,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1911,
          name: 'Soaring Devastation',
          description: 'Wings of Resolve delivers an attack upon landing. Movement speed is increased.',
          icon: 'https://render.guildwars2.com/file/5BB39BC2BF306D32C16BD1D657A6191604C03ECB/1012392.png',
          specialization: 'Dragonhunter',
          tier: 1,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 2037,
          name: "Hunter's Determination",
          description: 'Activating your elite skill breaks stuns and grants you endurance.',
          icon: 'https://render.guildwars2.com/file/2F6996644F9FF470FE49B4FB1C04B4E0C4A07FF2/1012393.png',
          specialization: 'Dragonhunter',
          tier: 2,
          position: 1,
          slot: 'Major'
        },
        {
          id: 1835,
          name: "Zealot's Aggression",
          description: "Deal increased strike damage to crippled foes. Justice's passive effect cripples enemies.",
          icon: 'https://render.guildwars2.com/file/31A6960A7357773373CA55D61FC1A62C532EE621/1012391.png',
          specialization: 'Dragonhunter',
          tier: 2,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1943,
          name: 'Bulwark',
          description: 'Shield of Courage gains increased radius and duration.',
          icon: 'https://render.guildwars2.com/file/2EA7776741C1A4213757DC139FED6B340C50E7AB/1012394.png',
          specialization: 'Dragonhunter',
          tier: 2,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 1908,
          name: "Hunter's Fortification",
          description:
            'Remove conditions and heal when blocking or evading attacks. <c=@reminder>Block and evade triggers have separate cooldowns.</c>',
          icon: 'https://render.guildwars2.com/file/2F147CBEA990E470AF0F0D20F652040E67962AB9/1012396.png',
          specialization: 'Dragonhunter',
          tier: 3,
          position: 1,
          slot: 'Major'
        },
        {
          id: 1963,
          name: 'Heavy Light',
          description:
            'Gain stability when disabling an enemy. Deal increased strike damage to disabled, exposed, or defiant foes.<br><c=@reminder>Disables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.</c>',
          icon: 'https://render.guildwars2.com/file/725424411D6131431FF9427BA77DCF3F2C5F7C2F/1012397.png',
          specialization: 'Dragonhunter',
          tier: 3,
          position: 2,
          slot: 'Major'
        },
        {
          id: 1955,
          name: 'Big Game Hunter',
          description:
            'Striking an enemy tethered by your Spear of Justice inflicts vulnerability and increases strike damage dealt. Tether duration is increased.',
          icon: 'https://render.guildwars2.com/file/1F0205AD3EB24521C9E8FF69340AC8091B0E556F/1012398.png',
          specialization: 'Dragonhunter',
          tier: 3,
          position: 3,
          slot: 'Major'
        }
      ]
    ]
  },
  {
    id: 62,
    name: 'Firebrand',
    elite: true,
    icon: 'https://render.guildwars2.com/file/6D18B2D3EE0BFA0E4BC851A7D3C39D4330250916/1769890.png',
    background: 'https://render.guildwars2.com/file/7E6454FF9A13DBE93873AF72E192A74622990171/1769899.png',
    minorTraits: [
      {
        id: 2089,
        name: 'Purity of Word',
        description:
          'Gain knowledge of Elonian lore, igniting a fierce drive to purge corruption and manifesting your <c=@abilitytype>Virtues</c> as mystic tomes. Gain access to <c=@abilitytype>Mantras</c>.<br><c=@reminder>Using Tome skills consumes pages. You regenerate pages every interval.</c>',
        icon: 'https://render.guildwars2.com/file/CC360DF028353A0C1AD09D97FA2CDF1D6D0AABA8/1769948.png',
        specialization: 'Firebrand',
        tier: 1,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 2062,
        name: 'Swift Scholar',
        description:
          'Equipping a <c=@abilitytype>Virtue</c> grants you quickness. Every third <c=@abilitytype>Tome</c> skill grants you pages.<br><c=@reminder>Stacks reset when exiting a tome.<br>Quickness can only be gained once per interval</c>',
        icon: 'https://render.guildwars2.com/file/C2347F4CA45520676368C8C5D64A3F094A0D73F8/1769949.png',
        specialization: 'Firebrand',
        tier: 2,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 2148,
        name: 'Imbued Haste',
        description: 'Gain increased attributes while affected by quickness.',
        icon: 'https://render.guildwars2.com/file/CD01F2B8C328AC37B760D0913F6D4DDDAC0477D2/1769950.png',
        specialization: 'Firebrand',
        tier: 3,
        position: 0,
        slot: 'Minor'
      }
    ],
    majorTraits: [
      [
        {
          id: 2075,
          name: 'Unrelenting Criticism',
          description: 'Axe skills gain a chance to inflict bleeding.',
          icon: 'https://render.guildwars2.com/file/367971C6121BCC00A453525834FD673D0CABF398/1769939.png',
          specialization: 'Firebrand',
          tier: 1,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2101,
          name: "Liberator's Vow",
          description: 'Grant allies quickness when you use your heal skill.',
          icon: 'https://render.guildwars2.com/file/2EF42105F7B45367AB72AD737250E014597708A5/1769940.png',
          specialization: 'Firebrand',
          tier: 1,
          position: 2,
          slot: 'Major'
        },
        {
          id: 2086,
          name: 'Archivist of Whispers',
          description: 'Your <c=@abilitytype>Virtues</c> gain additional pages.',
          icon: 'https://render.guildwars2.com/file/0F76350307E3B8A894F529C8110CA8FB977E63F8/1769941.png',
          specialization: 'Firebrand',
          tier: 1,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 2063,
          name: 'Weighty Terms',
          description:
            'The final charge of your <c=@abilitytype>Mantra</c> skills will slow nearby foes and grant you pages.',
          icon: 'https://render.guildwars2.com/file/3D80FCC2D64D10B566185CFA94CE681FE73BD237/1769942.png',
          specialization: 'Firebrand',
          tier: 2,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2076,
          name: 'Stalwart Speed',
          description:
            'When you grant aegis or stability, grant quickness.<br><c=@reminder>This can affect multiple targets simultaneously.</c>',
          icon: 'https://render.guildwars2.com/file/50F01C5E76B37D0AE93C0E07EA0F675B270950D0/1769943.png',
          specialization: 'Firebrand',
          tier: 2,
          position: 2,
          slot: 'Major'
        },
        {
          id: 2116,
          name: 'Legendary Lore',
          description: '<c=@abilitytype>Tome</c> skills gain bonuses from scribbling in the margins by ancient bards.',
          icon: 'https://render.guildwars2.com/file/0B9351C97E03000DA106650C1116BA3F5715AFDD/1769944.png',
          specialization: 'Firebrand',
          tier: 2,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 2105,
          name: 'Stoic Demeanor',
          description:
            'Retain <c=@abilitytype>Courage</c> passive while it is on cooldown. Grant boons to nearby allies when you disable, immobilize, or slow an enemy.<br><c=@reminder>Disables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.</c>',
          icon: 'https://render.guildwars2.com/file/FC3E5E76E418B620C2B5D3BF9851913553E46E21/1769945.png',
          specialization: 'Firebrand',
          tier: 3,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2179,
          name: 'Quickfire',
          description:
            'Retain <c=@abilitytype>Justice</c> passive while it is on cooldown. Granting quickness to an ally also grants Ashes of the Just.',
          icon: 'https://render.guildwars2.com/file/BC32643101E9CEC1D3B4B9709E4969637C283B7A/1769946.png',
          specialization: 'Firebrand',
          tier: 3,
          position: 2,
          slot: 'Major'
        },
        {
          id: 2159,
          name: 'Loremaster',
          description:
            'Retain <c=@abilitytype>Resolve</c> passive while it is on cooldown. You generate pages more quickly.',
          icon: 'https://render.guildwars2.com/file/1496F706100F1E16C5E3F76466C51D1DEF29C4FA/1769947.png',
          specialization: 'Firebrand',
          tier: 3,
          position: 3,
          slot: 'Major'
        }
      ]
    ]
  },
  {
    id: 65,
    name: 'Willbender',
    elite: true,
    icon: 'https://render.guildwars2.com/file/117F4659C3AD0AF6625D51013F03D541BEF2E8A6/2479302.png',
    background: 'https://render.guildwars2.com/file/D90821BEE9EC0D7BBE3B462A6D44D4625BAFF198/2479305.png',
    minorTraits: [
      {
        id: 2200,
        name: 'Willbender Training',
        description:
          "The guardian's Virtues are now movement based, giving them a swift advantage in combat. Gain access to the Physical skill type.",
        icon: 'https://render.guildwars2.com/file/ABC2E5DBE5589C3D3CD25E4FCF33A50A5AF25101/2479323.png',
        specialization: 'Willbender',
        tier: 1,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 2222,
        name: 'Righteous Sprint',
        description: 'Gain increased movement speed. Gain swiftness when you activate a virtue.',
        icon: 'https://render.guildwars2.com/file/A046F1DB16615C0B5A4A46D2909CF34469ADE0F9/2479324.png',
        specialization: 'Willbender',
        tier: 2,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 2189,
        name: 'Lethal Tempo',
        description:
          "Each time you activate a virtue or your virtue's passives are triggered, gain a damage bonus. Gaining stacks of this boon refreshes other stacks.",
        icon: 'https://render.guildwars2.com/file/08351965141B6F3013600B3B9CC7F880DEFF05D4/2479325.png',
        specialization: 'Willbender',
        tier: 3,
        position: 0,
        slot: 'Minor'
      }
    ],
    majorTraits: [
      [
        {
          id: 2191,
          name: 'Searing Pact',
          description:
            'Gain condition damage. <c=@abilitytype>Willbender Flames</c> now inflict burning on foes they strike.',
          icon: 'https://render.guildwars2.com/file/A99C37B4DD3A04B496DE2A601B724ED6B193B8A2/2479314.png',
          specialization: 'Willbender',
          tier: 1,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2190,
          name: 'Power for Power',
          description:
            'Gain increased power. <c=@abilitytype>Willbender Flames</c> deal increased damage to foes they strike.',
          icon: 'https://render.guildwars2.com/file/1DE84562D18036F352903060D2C27C022139EA78/2479315.png',
          specialization: 'Willbender',
          tier: 1,
          position: 2,
          slot: 'Major'
        },
        {
          id: 2187,
          name: 'Conceited Curate',
          description:
            'Gain increased vitality. <c=@abilitytype>Willbender Flames</c> now heal you when they strike an enemy.',
          icon: 'https://render.guildwars2.com/file/5BA0D4513309584BF1D5B0507A5B58BDFA6C33A9/2479316.png',
          specialization: 'Willbender',
          tier: 1,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 2197,
          name: 'Restorative Virtues',
          description:
            'Triggered virtue effects reduce the cooldown of active weapon abilities. Gain vigor when activating Flowing Resolve.',
          icon: 'https://render.guildwars2.com/file/FC4753574837A826E47E39CB5CD875D9470F6D9F/2479317.png',
          specialization: 'Willbender',
          tier: 2,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2210,
          name: 'Holy Reckoning',
          description:
            'Triggered virtue effects now grant might to allies in addition to their bonuses. Gain fury when activating Rushing Justice.',
          icon: 'https://render.guildwars2.com/file/1A1A95F133208028F0492A66C1D3F2F03A6ABED5/2479318.png',
          specialization: 'Willbender',
          tier: 2,
          position: 2,
          slot: 'Major'
        },
        {
          id: 2199,
          name: 'Vanguard Tactics',
          description:
            'Activating Crashing Courage grants resistance. Shadowstepping grants resolution and protection.',
          icon: 'https://render.guildwars2.com/file/3E34FFB8089ADC10491A243C0D4F7974E590A103/2479319.png',
          specialization: 'Willbender',
          tier: 2,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 2195,
          name: 'Phoenix Protocol',
          description:
            "Gain boons when resolve's effect triggers, but you no longer heal. Resolve has a modified duration. Gain boons when you use Flowing Resolve.",
          icon: 'https://render.guildwars2.com/file/1A795E5D7CDEC7D9F49D342F4157154F90D44CBF/2479320.png',
          specialization: 'Willbender',
          tier: 3,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2201,
          name: "Tyrant's Momentum",
          description:
            "Lethal Tempo grants increased damage, but has reduced duration. Justice's duration is modified.",
          icon: 'https://render.guildwars2.com/file/B436E75A9DD8EA917C3677AE4964A40DFB1BCE67/2479321.png',
          specialization: 'Willbender',
          tier: 3,
          position: 2,
          slot: 'Major'
        },
        {
          id: 2198,
          name: 'Deathless Courage',
          description: 'While Courage is active, incoming strike damage and condition damage is reduced.',
          icon: 'https://render.guildwars2.com/file/6640F790796D719F4F7EB5077900AAFCB6A02DB9/2479322.png',
          specialization: 'Willbender',
          tier: 3,
          position: 3,
          slot: 'Major'
        }
      ]
    ]
  },
  {
    id: 81,
    name: 'Luminary',
    elite: true,
    icon: 'https://render.guildwars2.com/file/034C203DBD60CFF19D3D5CE9E71B27CA0103F50D/3679898.png',
    background: 'https://render.guildwars2.com/file/AF9E19ADE842E1661324EDC6AAAEF7B2933CF132/3679907.png',
    minorTraits: [
      {
        id: 2381,
        name: 'Luminary',
        description:
          'Harness light and flame to bolster yourself and allies or disrupt your enemies. Gain access to Radiant Forge and <c=@abilitytype>stance</c> skills.',
        icon: 'https://render.guildwars2.com/file/1C173BD7036E52E6E0463317F5B63490B101B4D5/3679964.png',
        specialization: 'Luminary',
        tier: 1,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 2394,
        name: "Light's Gift",
        description: "Gain vitality. Grant Luminary's Blessing to allies when you equip a radiant weapon.",
        icon: 'https://render.guildwars2.com/file/6C920751304B14ADFFB6A70CACEA1B80D2ABFC59/3679965.png',
        specialization: 'Luminary',
        tier: 2,
        position: 0,
        slot: 'Minor'
      },
      {
        id: 2435,
        name: 'Radiant Armaments',
        description:
          'Gain a bonus based on your equipped radiant weapon. This bonus lingers for a period of time after exiting Radiant Forge.',
        icon: 'https://render.guildwars2.com/file/9D40CA9DC73D7C03EA58BE0EB51CDC46DA9E9403/3679966.png',
        specialization: 'Luminary',
        tier: 3,
        position: 0,
        slot: 'Minor'
      }
    ],
    majorTraits: [
      [
        {
          id: 2410,
          name: 'Shimmering Stances',
          description: '<c=@abilitytype>Stances</c> grant protection to affected allies and blind affected enemies.',
          icon: 'https://render.guildwars2.com/file/0BBF59B654A528C492CA26463B2728DD590EE016/3679955.png',
          specialization: 'Luminary',
          tier: 1,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2417,
          name: 'Resolute Blessing',
          description: "Luminary's Blessing now also reduces incoming condition damage.",
          icon: 'https://render.guildwars2.com/file/3580BB0C4F3E9BBC96080454BE9491CC934A6C55/3679956.png',
          specialization: 'Luminary',
          tier: 1,
          position: 2,
          slot: 'Major'
        },
        {
          id: 2329,
          name: 'Persistent Blessing',
          description:
            "Refresh the duration of your Luminary's Blessing and trigger its healing when you exit Radiant Forge.",
          icon: 'https://render.guildwars2.com/file/CA0853B1409CF197E0082626E5EDE57BE758CF40/3679957.png',
          specialization: 'Luminary',
          tier: 1,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 2330,
          name: 'Resplendent Weaponry',
          description: 'Grant boons to nearby allies when you equip a radiant weapon.',
          icon: 'https://render.guildwars2.com/file/5176E7FBE301F9DF01C54A79BCFD02F6C3029BED/3679958.png',
          specialization: 'Luminary',
          tier: 2,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2401,
          name: 'Purging Light',
          description:
            'Remove conditions from nearby allies when you grant yourself light aura. Gain light aura when you use a healing skill.',
          icon: 'https://render.guildwars2.com/file/0F9AC6B095FF6924D01F07FF26BF0F5C0DADD824/3679959.png',
          specialization: 'Luminary',
          tier: 2,
          position: 2,
          slot: 'Major'
        },
        {
          id: 2419,
          name: 'Empowered Armaments',
          description: 'Gain increased strike damage when you equip a radiant weapon.',
          icon: 'https://render.guildwars2.com/file/37424E9DD0A3ADC61DD56BB180C96201DB61099C/3679960.png',
          specialization: 'Luminary',
          tier: 2,
          position: 3,
          slot: 'Major'
        }
      ],
      [
        {
          id: 2368,
          name: 'Illuminating Inspiration',
          description: 'Reduce the recharge of your <c=@abilitytype>virtue</c> skills when you equip a radiant weapon.',
          icon: 'https://render.guildwars2.com/file/DDFE760CBC42D4B2EC0645099C161AC850E41EA7/3679961.png',
          specialization: 'Luminary',
          tier: 3,
          position: 1,
          slot: 'Major'
        },
        {
          id: 2328,
          name: 'Sovereign of Light',
          description:
            'Gain light aura when entering Radiant Forge. Luminary skills detonate light aura, damaging enemies and healing allies.',
          icon: 'https://render.guildwars2.com/file/111A0EA54101D7C22F57070690139662D0BC5316/3679962.png',
          specialization: 'Luminary',
          tier: 3,
          position: 2,
          slot: 'Major'
        },
        {
          id: 2388,
          name: 'Master-at-Arms',
          description:
            'Using a <c=@abilitytype>virtue</c> skill recharges radiant weapon skills. Justice recharges hammer, Resolve recharges staff, and Courage recharges sword and shield.',
          icon: 'https://render.guildwars2.com/file/B4094AF403DC0753F496E97F014A0FB02FB1D209/3679963.png',
          specialization: 'Luminary',
          tier: 3,
          position: 3,
          slot: 'Major'
        }
      ]
    ]
  }
];
export const SKILLS: readonly GuardianSkill[] = [
  {
    id: 9080,
    name: 'Leap of Faith',
    description:
      'Leap at your foe. Inflicts blindness and heals you for each foe hit. Heal for a lesser amount for each target struck beyond the first.',
    icon: 'https://render.guildwars2.com/file/C6C1B00FD5191CB2AA311E2205A3D90D9907BB9E/103587.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_3',
    specialization: '',
    categories: [],
    recharge: 10,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9081,
    name: 'Whirling Wrath',
    description: 'Spin in place and swing your greatsword while hurling powerful projectiles.',
    icon: 'https://render.guildwars2.com/file/374A9BB028E19F0B5D04622A33B36FA67E0EC938/103574.png',
    type: 'Weapon',
    weapon: 'Greatsword',
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
    id: 9082,
    name: 'Shield of Wrath',
    description:
      'Create a shield to block the next three attacks. If the shield is not destroyed, it explodes and damages nearby foes.',
    icon: 'https://render.guildwars2.com/file/C2065BFF78BB134197076A2C7450013EE390E409/103634.png',
    type: 'Weapon',
    weapon: 'Focus',
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
    id: 9083,
    name: '"Receive the Light!"',
    description: 'Shout. Heal yourself and allies in a cone in front of you.',
    icon: 'https://render.guildwars2.com/file/98FF447227E81AB44D9298F0E3BD62D553972B54/103089.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: '',
    categories: ['Shout'],
    recharge: 24,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9084,
    name: '"Advance!"',
    description: 'Shout. Grant aegis and swiftness to up to five nearby allies.',
    icon: 'https://render.guildwars2.com/file/4EB81AB80FA319D32A1A11566EA10639A14AC708/103635.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Shout'],
    recharge: 5,
    ammo: 2,
    ammoRecharge: 24,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9085,
    name: '"Save Yourselves!"',
    description: 'Shout. Draw conditions from nearby allies to yourself. Gain multiple boons for a short duration.',
    icon: 'https://render.guildwars2.com/file/BAB6060F7605D6F00901D22508E1B7A33D0A5DF7/103659.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Shout'],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9086,
    name: "Protector's Strike",
    description:
      'Protect allies from the next incoming attack against them, and lash out when attacked, granting boons to nearby allies and fully charging the passive burning effect.',
    icon: 'https://render.guildwars2.com/file/7C42A81ACFBFFE32A528DFCA8014E7C4476358C8/103202.png',
    type: 'Weapon',
    weapon: 'Mace',
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
    id: 9087,
    name: 'Shield of Judgment',
    description:
      'Create a shielding wave in front of you that damages foes while giving protection and aegis to you and up to five allies.',
    icon: 'https://render.guildwars2.com/file/5B2FE8C77DC2B00E75415AF578E5C550DE9B0CB5/103232.png',
    type: 'Weapon',
    weapon: 'Shield',
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
    id: 9088,
    name: 'Cleansing Flame',
    description:
      'Remove conditions from yourself then breathe magical flames that damage foes and cure conditions on allies. Inflicts burning on the final attack.',
    icon: 'https://render.guildwars2.com/file/FC0E030F7E67C4C62F0A6717B9F1B80012A6F1C7/103127.png',
    type: 'Weapon',
    weapon: 'Torch',
    slot: 'Weapon_5',
    specialization: '',
    categories: [],
    recharge: 15,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9089,
    name: "Zealot's Fire",
    description: "Throw your Zealot's Flame to damage the targeted foe.",
    icon: 'https://render.guildwars2.com/file/537D1557E29B42B95D07A1DB01493C7B63C4E402/103637.png',
    type: 'Weapon',
    weapon: 'Torch',
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
    id: 9090,
    name: 'Symbol of Punishment',
    description: 'Symbol. Create a symbol on the ground that strikes foes and grants might to nearby allies.',
    icon: 'https://render.guildwars2.com/file/C3DB032B0C51CD2DC9EC01CFB1DFA406466D3B0E/103263.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_2',
    specialization: '',
    categories: ['Symbol'],
    recharge: 10,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9091,
    name: 'Shield of Absorption',
    description: 'Create a dome around you that pushes foes back and absorbs projectiles.',
    icon: 'https://render.guildwars2.com/file/BC380F0749013D4B5272B8599A510D0099F945BB/103026.png',
    type: 'Weapon',
    weapon: 'Shield',
    slot: 'Weapon_5',
    specialization: '',
    categories: [],
    recharge: 24,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 9224
  },
  {
    id: 9093,
    name: 'Bane Signet',
    description: 'Signet Passive: Improved Power\nSignet Active: Knock down and damage your foe.',
    icon: 'https://render.guildwars2.com/file/9FF294A9CC489D4FE8CED934A0C4359964B67443/103638.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Signet'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9097,
    name: 'Symbol of Blades',
    description:
      'Symbol. Teleport to your target, and blind nearby foes. Create a symbol at your feet that damages nearby enemies and benefits allies.',
    icon: 'https://render.guildwars2.com/file/E7F5FFA84F0AE4EA0EC5AE54FA365C09925551A0/103641.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_2',
    specialization: '',
    categories: ['Symbol'],
    recharge: 8,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9098,
    name: 'Orb of Wrath',
    description: 'Fire a slow-moving orb at your foe.',
    icon: 'https://render.guildwars2.com/file/0F9DAB04690C9A01C80DEEE8D5792937F4EF6DC4/103642.png',
    type: 'Weapon',
    weapon: 'Scepter',
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
    id: 9099,
    name: 'Chains of Light',
    description: 'Immobilize and make your foe vulnerable with ethereal chains.',
    icon: 'https://render.guildwars2.com/file/43B33FC616A6FAEFEC2AA2A5C50A4F93A4A5317A/103292.png',
    type: 'Weapon',
    weapon: 'Scepter',
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
    id: 9102,
    name: 'Shelter',
    description: 'Block attacks while healing.',
    icon: 'https://render.guildwars2.com/file/D979B406E04C80687055B7C40A3837A4AB36B3D8/103645.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: '',
    categories: [],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9104,
    name: "Zealot's Flame",
    description:
      'Set yourself alight, periodically burning up to three nearby foes. The final pulse applies additional burning.',
    icon: 'https://render.guildwars2.com/file/3CB42772DD937ACF48EF5FE4615EF33F49035450/103231.png',
    type: 'Weapon',
    weapon: 'Torch',
    slot: 'Weapon_4',
    specialization: '',
    categories: [],
    recharge: 15,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 9089
  },
  {
    id: 9105,
    name: 'Sword of Wrath',
    description: 'Chain. Slash your foe once.',
    icon: 'https://render.guildwars2.com/file/29742A41232437EE7C7025E65CA21509040621AF/103646.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 9106,
    flipSkillId: 9106
  },
  {
    id: 9106,
    name: 'Sword Arc',
    description: 'Chain. Slash your foe again.',
    icon: 'https://render.guildwars2.com/file/C3446A6CD8E81B1A4B3E945DED582AD506ABEDC9/103647.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 9227,
    flipSkillId: null
  },
  {
    id: 9107,
    name: "Zealot's Defense",
    description: 'Block ranged attacks while casting magical projectiles.',
    icon: 'https://render.guildwars2.com/file/C0ED0D01EA4116136DCBE4925B1C2B92A209B221/103648.png',
    type: 'Weapon',
    weapon: 'Sword',
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
    id: 9108,
    name: 'Faithful Strike',
    description: 'Hit your foe with a final strike and heal nearby allies.',
    icon: 'https://render.guildwars2.com/file/FF96FC6D501276A90FE8C3371167E9D3B2BCE409/103192.png',
    type: 'Weapon',
    weapon: 'Mace',
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
    id: 9109,
    name: 'True Strike',
    description: 'Chain. Smash your foe.',
    icon: 'https://render.guildwars2.com/file/0F7A60D7249F98413466A1F9F8382002F878B766/103194.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 9110,
    flipSkillId: 9110
  },
  {
    id: 9110,
    name: 'Pure Strike',
    description: 'Chain. Bash your foe.',
    icon: 'https://render.guildwars2.com/file/69DC2CC8B83C3A096207051F3ECAD96CB3FB75A8/103193.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 9108,
    flipSkillId: 9108
  },
  {
    id: 9111,
    name: 'Symbol of Faith',
    description:
      'Symbol. Smash the ground to heal allies and create a mystic symbol that damages foes and regenerates allies.',
    icon: 'https://render.guildwars2.com/file/27E2E665047EE1BBABD57E65660EF6037FFE38D4/103195.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_2',
    specialization: '',
    categories: ['Symbol'],
    recharge: 8,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9112,
    name: 'Ray of Judgment',
    description:
      'Purge the target area in a ray of light. Allies are healed and cleansed of a condition, while enemies are infused with blinding light, taking damage each interval if they are initially struck.',
    icon: 'https://render.guildwars2.com/file/D50E0BDA07479939275BCB53A2670FC6B808BE29/2010287.png',
    type: 'Weapon',
    weapon: 'Focus',
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
    id: 9115,
    name: 'Virtue of Justice',
    description:
      'Virtue: Burn foes every few attacks.\nActivate: You and your allies inflict burning on the next attack.',
    icon: 'https://render.guildwars2.com/file/0E4C27902671FBCB33713E3677604B0880EF0D60/103034.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_1',
    specialization: '',
    categories: ['Virtue'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 29887
  },
  {
    id: 9118,
    name: 'Virtue of Courage',
    description: 'Virtue: Gain aegis periodically.\nActivate: Grant aegis to yourself and nearby allies.',
    icon: 'https://render.guildwars2.com/file/1B55CBCB3E1165FD5D0C7BC3CBEEB65C5BD9D07C/103258.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_3',
    specialization: '',
    categories: ['Virtue'],
    recharge: 45,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 9268
  },
  {
    id: 9120,
    name: 'Virtue of Resolve',
    description: 'Virtue: Regenerates health.\nActivate: Heal yourself and nearby allies.',
    icon: 'https://render.guildwars2.com/file/F12B07B5466A51AB2BFD2C0CB8F3994D3F9E610C/103652.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_2',
    specialization: '',
    categories: ['Virtue'],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 9250
  },
  {
    id: 9122,
    name: 'Bolt of Wrath',
    description: 'Fire a bolt that damages foes.',
    icon: 'https://render.guildwars2.com/file/4F6B5A087DA754B44DAC062EDD57E719E3CC92B4/2029302.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 51660
  },
  {
    id: 9124,
    name: 'Banish',
    description:
      'Launch your foe with a powerful smash. Striking a foe refreshes Mighty Blow and allows your next Mighty Blow to teleport to that foe.',
    icon: 'https://render.guildwars2.com/file/080F4AC49809C32040C80512EAEA769EE7EA4FB7/103109.png',
    type: 'Weapon',
    weapon: 'Hammer',
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
    id: 9125,
    name: 'Hammer of Wisdom',
    description: 'Spirit Weapon. Order the Hammer of Wisdom to knock down your foe.',
    icon: 'https://render.guildwars2.com/file/99430A49F97BA45EF101E611A69193D57BF70A7D/103655.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['SpiritWeapon'],
    recharge: 8,
    ammo: 2,
    ammoRecharge: 20,
    nextChainId: null,
    flipSkillId: 46170
  },
  {
    id: 9128,
    name: 'Sanctuary',
    description:
      'Consecration. Form a protective healing shelter for allies. Block foes and their missiles from entering.',
    icon: 'https://render.guildwars2.com/file/2E31D763EA1D05432949EBB39603CD6DBBE29870/103541.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Consecration'],
    recharge: 40,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9137,
    name: 'Strike',
    description: 'Chain. Strike your foe.',
    icon: 'https://render.guildwars2.com/file/FC80059BFD4258212CAEB303099B0639AF0308CA/103162.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 9138,
    flipSkillId: 9138
  },
  {
    id: 9138,
    name: 'Vengeful Strike',
    description: 'Chain. Strike your foe again.',
    icon: 'https://render.guildwars2.com/file/009A1EFE24BB1DBFE44C04E6F0B7A44D9F27033B/103163.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 9139,
    flipSkillId: 9139
  },
  {
    id: 9139,
    name: 'Wrathful Strike',
    description: 'Attack with a final, powerful strike that applies might for each foe you strike.',
    icon: 'https://render.guildwars2.com/file/50B1BB27B4789637E5ADD30B29976D0D9A4E13E0/103164.png',
    type: 'Weapon',
    weapon: 'Greatsword',
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
    id: 9140,
    name: 'Holy Strike',
    description: 'Mark an area for judgment, rapidly healing allies and then blasting foes in the area.',
    icon: 'https://render.guildwars2.com/file/E693B0D94525BFECFDB6FAC2670A1360443DB2F0/2029305.png',
    type: 'Weapon',
    weapon: 'Staff',
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
    id: 9143,
    name: 'Symbol of Swiftness',
    description:
      'Symbol. Sear a mystic symbol into the target area, damaging foes and granting swiftness to allies. Allies in the area gain a burst of speed when the symbol is created.',
    icon: 'https://render.guildwars2.com/file/E315FF56624F5B2BB8BF51D00FA716FA4936F037/103268.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_3',
    specialization: '',
    categories: ['Symbol'],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9144,
    name: 'Line of Warding',
    description: 'Ward. Create a line in front of you that foes cannot cross.',
    icon: 'https://render.guildwars2.com/file/62F8F469B1AEF1C440AAAB010B7268C2C32F364D/103658.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_5',
    specialization: '',
    categories: ['Ward'],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9146,
    name: 'Symbol of Resolution',
    description:
      'Symbol. Pierce the ground with a mystic symbol that damages foes while granting resolution to allies.',
    icon: 'https://render.guildwars2.com/file/B9FC18E67D7FEE5B64F60AB7700E5706CCB51DA6/103660.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_4',
    specialization: '',
    categories: ['Symbol'],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9147,
    name: 'Binding Blade',
    description:
      'Throw blades at your foes, causing damage over time. Bound foes can be pulled to you. The effect ends when a foe moves out of range.',
    icon: 'https://render.guildwars2.com/file/B975D6E5B32392524C034114E2A2201097BFDA35/103274.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_5',
    specialization: '',
    categories: [],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 9226
  },
  {
    id: 9150,
    name: 'Signet of Judgment',
    description:
      'Signet Passive: Reduces all incoming damage.\nSignet Active: Grant resolution and protection to nearby allies while debilitating nearby enemies.',
    icon: 'https://render.guildwars2.com/file/2A0C7B5FED084FCEE050BE9D6EB5B054A416E607/103662.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Signet'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9151,
    name: 'Signet of Wrath',
    description:
      'Signet Passive: Grants you increased condition damage.\nSignet Active: Immobilize and burn your target.',
    icon: 'https://render.guildwars2.com/file/7F660CD006085D42B5A9F16A281D0E15434A2304/103643.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Signet'],
    recharge: 18,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9152,
    name: '"Hold the Line!"',
    description: 'Shout. Grant protection and regeneration to allies.',
    icon: 'https://render.guildwars2.com/file/CA143E59076FDECC06DF0F209836104F359977E0/103663.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Shout'],
    recharge: 5,
    ammo: 0,
    ammoRecharge: 20,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9153,
    name: '"Stand Your Ground!"',
    description: 'Shout. Grant stability to yourself and allies.',
    icon: 'https://render.guildwars2.com/file/7B3B7DFE6C2422C74891CE17E0A3EF15722805F8/103664.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Shout'],
    recharge: 24,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9154,
    name: 'Renewed Focus',
    description: 'Meditation. Focus, making yourself invulnerable and recharging your virtues.',
    icon: 'https://render.guildwars2.com/file/344C7EEC3F6FE10568720E4F75EF91C37A58C43C/103665.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: '',
    categories: ['Meditation'],
    recharge: 90,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 68666
  },
  {
    id: 9158,
    name: 'Signet of Resolve',
    description:
      'Signet Passive: Remove a condition from yourself every few seconds.\nSignet Active: Heal yourself and remove conditions.',
    icon: 'https://render.guildwars2.com/file/45904C2C787647E168F1A4B607471A32A8CB9609/103666.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: '',
    categories: ['Signet'],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9159,
    name: 'Hammer Swing',
    description: 'Chain. Strike your foe.',
    icon: 'https://render.guildwars2.com/file/CDDCE227F218D8F1AFD49F46C57991E49666D964/103159.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 9160,
    flipSkillId: 9160
  },
  {
    id: 9160,
    name: 'Hammer Bash',
    description: 'Chain. Bash your foe.',
    icon: 'https://render.guildwars2.com/file/18AE09A5E9424FAA35EFA33BB903A1062ACEF354/103160.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 9161,
    flipSkillId: 9161
  },
  {
    id: 9161,
    name: 'Symbol of Protection',
    description: 'Symbol. Smash a mystic symbol onto the ground that gives protection to you and your allies.',
    icon: 'https://render.guildwars2.com/file/E56B3804B2F82E3256A82318E537D024DC57E271/103161.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',
    specialization: '',
    categories: ['Symbol'],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9163,
    name: 'Signet of Mercy',
    description: 'Signet Passive: Improves concentration.\nSignet Active: Revive a nearby downed ally.',
    icon: 'https://render.guildwars2.com/file/9FCB1995DC9106F6A1C9741142D4FF7DB407414F/103667.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Signet'],
    recharge: 50,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9168,
    name: 'Sword of Justice',
    description: 'Spirit Weapon. Will the Sword of Justice to appear beside your enemy and attack nearby foes.',
    icon: 'https://render.guildwars2.com/file/98B40D09401B44949604E073F5F793C660B7ED22/103669.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['SpiritWeapon'],
    recharge: 1,
    ammo: 3,
    ammoRecharge: 15,
    nextChainId: null,
    flipSkillId: 44846
  },
  {
    id: 9175,
    name: 'Bow of Truth',
    description: 'Spirit Weapon. Command the Bow of Truth to barrage a location with healing arrows.',
    icon: 'https://render.guildwars2.com/file/D6B3F74013A80F14BADF5D2D0D1D9E40D64F9C04/103671.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['SpiritWeapon'],
    recharge: 1,
    ammo: 2,
    ammoRecharge: 20,
    nextChainId: null,
    flipSkillId: 43565
  },
  {
    id: 9182,
    name: 'Shield of the Avenger',
    description:
      'Spirit Weapon. Command the Shield of the Avenger to form a protective dome, and then shatter, flying out to weaken nearby foes.',
    icon: 'https://render.guildwars2.com/file/CFBE4110635CD25B68EE194E7DBE25166DAAA197/103673.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['SpiritWeapon'],
    recharge: 1,
    ammo: 3,
    ammoRecharge: 25,
    nextChainId: null,
    flipSkillId: 41571
  },
  {
    id: 9187,
    name: 'Purging Flames',
    description:
      'Consecration. Create a ring of fire. With each pulse, burn foes while removing conditions from allies inside the area of effect.',
    icon: 'https://render.guildwars2.com/file/646CD9EA044A959A0A0D6143B29707EADB31B2B9/103675.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Consecration'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9194,
    name: 'Mighty Blow',
    description:
      'Damage nearby foes with a mighty ground slam. If your target has been struck by Banish, teleport to them.',
    icon: 'https://render.guildwars2.com/file/7CF5FFD35624B6D243B97CE4344018C3F1E6ACB7/103682.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_2',
    specialization: '',
    categories: [],
    recharge: 4,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 53482
  },
  {
    id: 9195,
    name: 'Ring of Warding',
    description:
      'Ward. Create a ring around you that foes cannot cross. Trapped foes cannot exit the ring while it is active.',
    icon: 'https://render.guildwars2.com/file/13A76EA2D6E91C94503F030E3A47F60A6B4153D2/103092.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_5',
    specialization: '',
    categories: ['Ward'],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9224,
    name: 'Shield of Absorption',
    description: 'Detonate the dome to heal nearby allies.',
    icon: 'https://render.guildwars2.com/file/299DDE0F181A754CDF396D6A5FA735080361EF46/103704.png',
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
    id: 9226,
    name: 'Pull',
    description: 'Pull your foes to you.',
    icon: 'https://render.guildwars2.com/file/52060B4FF8B76A546473009232610BB21718C2A4/103586.png',
    type: 'Weapon',
    weapon: 'Greatsword',
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
    id: 9227,
    name: 'Sword Wave',
    description: 'Send out waves of attacks that strike multiple targets.',
    icon: 'https://render.guildwars2.com/file/EE60D5DCE54CEF6108417BD7AF5758806D2A4066/103705.png',
    type: 'Weapon',
    weapon: 'Sword',
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
    id: 9245,
    name: 'Smite Condition',
    description: 'Meditation. Cure conditions and damage nearby foes. Deal more damage if a condition is cured.',
    icon: 'https://render.guildwars2.com/file/DB5FBEBBD092642AE39C99F7CD3521EB41C0D717/103644.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Meditation'],
    recharge: 16,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9246,
    name: 'Merciful Intervention',
    description:
      'Meditation. Shadowstep to an ally in the targeted area and heal around them. If no ally is present in the targeted area, this ability will not shadowstep.',
    icon: 'https://render.guildwars2.com/file/4B93D8CA0663ABD94BAF9FCE80D6280A56C01099/103706.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Meditation'],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9247,
    name: "Judge's Intervention",
    description: 'Meditation. Teleport to your target and burn nearby foes.',
    icon: 'https://render.guildwars2.com/file/0130A69F3F5F55A493AE9BFCA965603330C605AA/103668.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Meditation'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9248,
    name: 'Contemplation of Purity',
    description: 'Meditation. Convert the conditions you are suffering from into boons.',
    icon: 'https://render.guildwars2.com/file/E260D443FB6104F1A0736CB30B4F080209559933/103684.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Meditation'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9250,
    name: 'Virtue of Resolve',
    description: 'Virtue: Regenerates health.\nActivate: Heal yourself and nearby allies.',
    icon: 'https://render.guildwars2.com/file/F12B07B5466A51AB2BFD2C0CB8F3994D3F9E610C/103652.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_2',
    specialization: '',
    categories: ['Virtue'],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9251,
    name: 'Wall of Reflection',
    description: 'Consecration. Summon a barrier of mystic power that reflects projectiles.',
    icon: 'https://render.guildwars2.com/file/09D77552CC232597FB2960EC3F43DA7BF5633FA1/103482.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Consecration'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9253,
    name: 'Hallowed Ground',
    description: 'Consecration. Consecrate the target area, granting stability to allies inside.',
    icon: 'https://render.guildwars2.com/file/06C916D4A05B790110976BD61E7DDE6932B5B2C6/103676.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Consecration'],
    recharge: 36,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 9260,
    name: "Zealot's Embrace",
    description:
      'Send a wave toward your foe that immobilizes foes in a line. Gain barrier for each target struck. Barrier is reduced for each target struck beyond the first.',
    icon: 'https://render.guildwars2.com/file/53752EA071EBA20C3C2D79EB3949ED73C6BBCA40/103683.png',
    type: 'Weapon',
    weapon: 'Hammer',
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
    id: 9265,
    name: 'Empower',
    description:
      'Channel healing and might to nearby allies. Completing this channel grants more health to your allies.',
    icon: 'https://render.guildwars2.com/file/0EFCC1FD452CC19694D6BA3F390C1822C3FE73CD/103636.png',
    type: 'Weapon',
    weapon: 'Staff',
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
    id: 9268,
    name: 'Virtue of Courage',
    description: 'Virtue: Gain aegis periodically.\nActivate: Grant aegis to yourself and nearby allies.',
    icon: 'https://render.guildwars2.com/file/1B55CBCB3E1165FD5D0C7BC3CBEEB65C5BD9D07C/103258.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_3',
    specialization: '',
    categories: ['Virtue'],
    recharge: 45,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 15834,
    name: 'Shield of Judgment',
    description:
      'Create a shielding wave in front of you that damages foes while giving protection and aegis to you and up to five allies.',
    icon: 'https://render.guildwars2.com/file/5B2FE8C77DC2B00E75415AF578E5C550DE9B0CB5/103232.png',
    type: 'Weapon',
    weapon: 'Shield',
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
    id: 21664,
    name: 'Litany of Wrath',
    description:
      'Meditation. Heal yourself. For a brief time, heal yourself based on a percentage of damage dealt to enemies.',
    icon: 'https://render.guildwars2.com/file/77077EDEB2AF1F3D4062E6428000F44F77616ADE/699527.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: '',
    categories: ['Meditation'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 29630,
    name: 'Deflecting Shot',
    description: 'Fire a missile that knocks back enemies and blocks missiles.',
    icon: 'https://render.guildwars2.com/file/71415F58F7FF445672ADA1DA7BC12576E7FA557B/1012871.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_3',
    specialization: 'Dragonhunter',
    categories: [],
    recharge: 10,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 29786,
    name: 'Test of Faith',
    description:
      'Trap. Lay a trap that creates a ring of weapons that punishes enemies that attempt to cross their threshold. Passthrough damage is increased against disabled targets.',
    icon: 'https://render.guildwars2.com/file/A93131C1705E230802B951911C6A0A0D619C9A63/1012876.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Dragonhunter',
    categories: ['Trap'],
    recharge: 24,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 29789,
    name: 'Symbol of Energy',
    description:
      'Symbol. Fire a slow, arcing arrow that explodes on impact to burn targets and sear a symbol of energy into the ground.',
    icon: 'https://render.guildwars2.com/file/7DFEE492C091D39ABA7F26020F06FFE0C7A30453/1012872.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_4',
    specialization: 'Dragonhunter',
    categories: ['Symbol'],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 29887,
    name: 'Spear of Justice',
    description:
      'Virtue. Burn foes every few attacks.\nActivate: Hurl a spear of light that passes through foes. Enemies struck become tethered and receive conditions periodically.',
    icon: 'https://render.guildwars2.com/file/05BF0016EC3AF1EE01F6C405C3BB01EE6CAAE095/1012863.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_1',
    specialization: '',
    categories: ['Virtue'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 33134
  },
  {
    id: 29965,
    name: '"Feel My Wrath!"',
    description:
      'Shout. Grant fury and quickness to nearby allies. The duration of the quickness you grant yourself is doubled.',
    icon: 'https://render.guildwars2.com/file/B743B8DDF91DBC0239460877775FBE7BD36F6873/103702.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: '',
    categories: ['Shout'],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 68670
  },
  {
    id: 30025,
    name: 'Purification',
    description:
      'Trap. Heal yourself and imbue your light into a trap. Enemies that trigger this trap are damaged and blinded as the light returns to you for a second heal.',
    icon: 'https://render.guildwars2.com/file/07382144AF0B367539A7EF6AD61D7DCCA26759AC/1012868.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: 'Dragonhunter',
    categories: ['Trap'],
    recharge: 24,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 30229,
    name: 'True Shot',
    description: 'Charge up energy, creating a powerful attack that pierces through enemies.',
    icon: 'https://render.guildwars2.com/file/0B0A3D5C61D9DD0619FE032E3E752FB5AE0CE7BE/1012870.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_2',
    specialization: 'Dragonhunter',
    categories: [],
    recharge: 4,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 30273,
    name: "Dragon's Maw",
    description: 'Trap. Lay a trap that pulls enemies and creates a barrier that holds them in.',
    icon: 'https://render.guildwars2.com/file/71FF4F27E1404DAD3EB1A63A4214A9797F740810/1024103.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: 'Dragonhunter',
    categories: ['Trap'],
    recharge: 40,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 68686
  },
  {
    id: 30364,
    name: 'Procession of Blades',
    description: 'Trap. Set a trap that whirls around and damages enemies when activated.',
    icon: 'https://render.guildwars2.com/file/D891D0C60ED609CB5C65ECFED69D3FFF077FD3E4/1012878.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Dragonhunter',
    categories: ['Trap'],
    recharge: 16,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 30461,
    name: 'Signet of Courage',
    description:
      'Signet Passive: Periodically heal allies in an area around you while in combat.\nSignet Active: Channel healing and boons in a large area around you, concluding with a large heal if this skill is not interrupted.',
    icon: 'https://render.guildwars2.com/file/59C43DD96D4096AF5DF576182506A20765CAEF07/1012875.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: '',
    categories: ['Signet'],
    recharge: 60,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 68676
  },
  {
    id: 30471,
    name: 'Puncture Shot',
    description:
      'Fire an arrow that pierces enemies. If the arrow hits a second target, all enemies struck are crippled.',
    icon: 'https://render.guildwars2.com/file/080363673FCB09916AF7D035C31327C105EE219E/1012869.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_1',
    specialization: 'Dragonhunter',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 30553,
    name: 'Fragments of Faith',
    description:
      "Trap. Lay a trap that deals damage and unleashes multiple fragments into the area when triggered. Each fragment grants aegis to allies, as long as they don't already have aegis.",
    icon: 'https://render.guildwars2.com/file/32106907940C3F0AB9E771C014BF59D4DE285241/1012877.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Dragonhunter',
    categories: ['Trap'],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 30628,
    name: "Hunter's Ward",
    description: 'Form your arrows into a barrier, and deal damage at the location.',
    icon: 'https://render.guildwars2.com/file/BA2C3116B20CF142F70D18394E377A043D3E0E96/1012873.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_5',
    specialization: 'Dragonhunter',
    categories: [],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 30871,
    name: "Light's Judgment",
    description:
      'Trap. Lay down a trap that creates an area of pure light that reveals enemies and pierces their armor. The first strike dazes foes.',
    icon: 'https://render.guildwars2.com/file/6ECB36B9047E9920DDD354100A68B9E705CAC478/1012874.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Dragonhunter',
    categories: ['Trap'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 33134,
    name: "Hunter's Verdict",
    description:
      "Pull all enemies tethered by the Spear of Justice to you, breaking the link. This ability's recharge is separate from that of Spear of Justice.",
    icon: 'https://render.guildwars2.com/file/02C8A032F60414D0FAB7D0AFD965B5BA0947D6F8/103703.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_1',
    specialization: '',
    categories: [],
    recharge: 40,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 40114,
    name: 'Portent of Freedom',
    description: 'Hints of freedom echo around, stabilizing and breaking stuns on you and your allies.',
    icon: 'https://render.guildwars2.com/file/EB6B0D1263094C0309B933F6F9614992E8B5FA3E/1770461.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: 'Firebrand',
    categories: [],
    recharge: 1,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 40624,
    name: 'Symbol of Vengeance',
    description:
      'Symbol. Cleave your axe into the ground, reducing enemy movement and carving a razor-sharp symbol of vengeance.',
    icon: 'https://render.guildwars2.com/file/D7DDD899551C060AB9B2C2B0BDC71A6194E379EF/1770458.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_2',
    specialization: 'Firebrand',
    categories: ['Symbol'],
    recharge: 8,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 40915,
    name: 'Mantra of Potence',
    description:
      'Mantra. Recite a hymn from the annals of Turai to quicken yourself and your allies.\nThe final charge of this skill is more powerful.',
    icon: 'https://render.guildwars2.com/file/B4CB1901D4577CCCBBD315D833FE02C7B748BBC3/1770490.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Firebrand',
    categories: ['Mantra'],
    recharge: 20,
    ammo: 3,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 42983
  },
  {
    id: 41380,
    name: 'Stow Tome',
    description: 'Stow your tome.',
    icon: 'https://render.guildwars2.com/file/7342BF326738A4C5132F42CE0915D3A2184E52FB/60975.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 41475,
    name: 'Restoring Reprieve',
    description: 'Gain health. Grant boons to yourself and allies in front of and around you.',
    icon: 'https://render.guildwars2.com/file/F55B77232407D35E7C03CB6C7B1B199C776B7BB1/1770464.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: 'Firebrand',
    categories: [],
    recharge: 1,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 41571,
    name: 'Shield of the Avenger',
    description:
      'Spirit Weapon. Command the Shield of the Avenger to form a protective dome, and then shatter, flying out to weaken nearby foes.',
    icon: 'https://render.guildwars2.com/file/CFBE4110635CD25B68EE194E7DBE25166DAAA197/103673.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['SpiritWeapon'],
    recharge: 1,
    ammo: 3,
    ammoRecharge: 25,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 41714,
    name: 'Mantra of Solace',
    description:
      'Mantra. Prepare to heal yourself and grant boons to allies. \nThe final charge of this skill is more powerful.',
    icon: 'https://render.guildwars2.com/file/9E64514AF3280620040C0DBC61A7AABB0F765E54/1770463.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: 'Firebrand',
    categories: ['Mantra'],
    recharge: 24,
    ammo: 3,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 41475
  },
  {
    id: 41780,
    name: 'Tome of Resolve',
    description:
      'Virtue: Regenerate health.\nActivate: Draw forth an enchanted tome that recounts the trials undergone by the people of Vabbi.',
    icon: 'https://render.guildwars2.com/file/E206770FD62BB63B71F56209F34BF99392BADF9E/1770478.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_2',
    specialization: '',
    categories: ['Virtue'],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 68648
  },
  {
    id: 41988,
    name: 'Overwhelming Celerity',
    description: 'Final Charge. Inspire allies before and beside you, greatly enhancing their speed and strength.',
    icon: 'https://render.guildwars2.com/file/BC1E1F76E4C9607A29AF77B61DFE35919DF56735/1770492.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Firebrand',
    categories: [],
    recharge: 1,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 42259,
    name: 'Tome of Courage',
    description:
      'Virtue: Gain aegis periodically. \nActivate: Conjure a mystic tome containing stories about the heroes of Istan.',
    icon: 'https://render.guildwars2.com/file/49B3D2E829962602205B09619770E1650BF07108/1770466.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_3',
    specialization: '',
    categories: ['Virtue'],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 68650
  },
  {
    id: 42360,
    name: 'Echo of Truth',
    description: 'Recount a truth to enemies in front of and around you, inflicting them with conditions.',
    icon: 'https://render.guildwars2.com/file/44E806054B684DE2914C3EC9010598406F039509/1770494.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Firebrand',
    categories: [],
    recharge: 1,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 42371,
    name: 'Tome of Courage',
    description:
      'Virtue: Gain aegis periodically. \nActivate: Conjure a mystic tome containing stories about the heroes of Istan.',
    icon: 'https://render.guildwars2.com/file/49B3D2E829962602205B09619770E1650BF07108/1770466.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_3',
    specialization: '',
    categories: ['Virtue'],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 42864,
    name: 'Opening Passage',
    description: 'Recite a cleansing word, purifying allies of conditions and helping them recover.',
    icon: 'https://render.guildwars2.com/file/9BA6143D4B0E4E01E3B24A14360B425BCF6145FF/1770488.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Firebrand',
    categories: [],
    recharge: 1,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 44248
  },
  {
    id: 42983,
    name: 'Potent Haste',
    description: 'Inspire allies before and beside you, enhancing their speed and strength.',
    icon: 'https://render.guildwars2.com/file/A2CEC1C89502B948B10894A56DDEC30A59211C16/1770491.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Firebrand',
    categories: [],
    recharge: 1,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 41988
  },
  {
    id: 43357,
    name: 'Mantra of Liberation',
    description:
      'Mantra. Echo remnants of an ancient pamphlet from Vabbi that urged Elonians to freedom. Grant stability and resolution to allies while breaking stun.\nThe final charge of this skill is more powerful.',
    icon: 'https://render.guildwars2.com/file/2BF01DA54BCDCEC209E503774C047E1DC5DAE126/1770460.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: 'Firebrand',
    categories: ['Mantra'],
    recharge: 40,
    ammo: 3,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 40114
  },
  {
    id: 43565,
    name: 'Bow of Truth',
    description: 'Spirit Weapon. Command the Bow of Truth to barrage a location with healing arrows.',
    icon: 'https://render.guildwars2.com/file/D6B3F74013A80F14BADF5D2D0D1D9E40D64F9C04/103671.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['SpiritWeapon'],
    recharge: 1,
    ammo: 2,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 43826,
    name: 'Searing Slash',
    description: 'Unleash your searing axe in an overhand slash, following it up with a magical edge.',
    icon: 'https://render.guildwars2.com/file/6D161191B16102166A94D41FF6F0DBF206F3A77C/1770457.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    specialization: 'Firebrand',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 44080,
    name: 'Mantra of Truth',
    description:
      'Mantra. Prepare the tenets of truth to debilitate your foes.\nThe final charge of this skill is more powerful.',
    icon: 'https://render.guildwars2.com/file/F42415D914927F6FC05D803EAE3371F83B5604CF/1770493.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Firebrand',
    categories: ['Mantra'],
    recharge: 20,
    ammo: 3,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 42360
  },
  {
    id: 44248,
    name: 'Clarified Conclusion',
    description:
      'Final Charge. Recite the concluding passage, converting corruption into enhancements for your allies and aiding them in recovery.',
    icon: 'https://render.guildwars2.com/file/9739A12D15EAE4D714E00D26E0F9D20822BDC97C/1770489.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Firebrand',
    categories: [],
    recharge: 1,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 44364,
    name: 'Tome of Justice',
    description:
      'Virtue: Burn foes every few attacks.\nActivate: Pull forth a magical tome on the dangers of the blazing heat in Kourna.',
    icon: 'https://render.guildwars2.com/file/2710AF269B38A4A365089BC7B3C9389B354DE59D/1770472.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_1',
    specialization: '',
    categories: ['Virtue'],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 68647
  },
  {
    id: 44602,
    name: 'Bleeding Edge',
    description: 'Slice through your foe again, physically and magically, as your weapon is heating up.',
    icon: 'https://render.guildwars2.com/file/490E143D431FCBDC9BD7E60ED875F5710DBEE43F/1770456.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    specialization: 'Firebrand',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 43826,
    flipSkillId: 43826
  },
  {
    id: 44846,
    name: 'Sword of Justice',
    description: 'Spirit Weapon. Will the Sword of Justice to appear beside your enemy and attack nearby foes.',
    icon: 'https://render.guildwars2.com/file/98B40D09401B44949604E073F5F793C660B7ED22/103669.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['SpiritWeapon'],
    recharge: 1,
    ammo: 3,
    ammoRecharge: 15,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 45047,
    name: 'Core Cleave',
    description: 'Cleave at your enemy with a physical and a magical axe.',
    icon: 'https://render.guildwars2.com/file/B6900CCBA53BD1189D0E09C10C43AB08AE64016B/1770455.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    specialization: 'Firebrand',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 44602,
    flipSkillId: 44602
  },
  {
    id: 45082,
    name: 'Flame Rush',
    description: 'Unleash a wave of purging fire in front of and around you.',
    icon: 'https://render.guildwars2.com/file/A64B7DECA2400A0879A6A7B2E82F482221374826/1770485.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Firebrand',
    categories: [],
    recharge: 1,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 45402,
    name: 'Blazing Edge',
    description: 'Conjure a magical axe to rake your enemies toward you.',
    icon: 'https://render.guildwars2.com/file/B254F2279C5C1E9E6E3AAE11B97D460E0F3E45E0/1770459.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_3',
    specialization: 'Firebrand',
    categories: [],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 45460,
    name: 'Mantra of Lore',
    description:
      'Mantra. Chant the ritual of cleansing, removing conditions and speeding recovery.\nThe final charge of this skill is more powerful.',
    icon: 'https://render.guildwars2.com/file/B304FBFE03030A1E2A07D8150CFB2A9EA24BE37E/1770487.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Firebrand',
    categories: ['Mantra'],
    recharge: 20,
    ammo: 3,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 42864
  },
  {
    id: 46148,
    name: 'Mantra of Flame',
    description: 'Mantra. Prepare a chant to sear your enemies. \nThe final charge of this skill is more powerful.',
    icon: 'https://render.guildwars2.com/file/795917A9C66755C96C7AFEA510CA2271E260F3B2/1770484.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Firebrand',
    categories: ['Mantra'],
    recharge: 20,
    ammo: 3,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 45082
  },
  {
    id: 46170,
    name: 'Hammer of Wisdom',
    description: 'Spirit Weapon. Order the Hammer of Wisdom to knock down your foe.',
    icon: 'https://render.guildwars2.com/file/99430A49F97BA45EF101E611A69193D57BF70A7D/103655.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['SpiritWeapon'],
    recharge: 8,
    ammo: 2,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 51645,
    name: 'Seeking Judgment',
    description: 'Fire a seeking projectile that explodes upon contact and damages enemies.',
    icon: 'https://render.guildwars2.com/file/F7F7100DB608A7CBFA3EFB6918D992287E30DB14/2029304.png',
    type: 'Weapon',
    weapon: 'Staff',
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
    id: 51660,
    name: 'Searing Light',
    description: 'Fire a projectile that explodes upon impact and damages enemies.',
    icon: 'https://render.guildwars2.com/file/786A40D25853070BFE4936656A03679DC21239AC/2029303.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 51645
  },
  {
    id: 53482,
    name: 'Glacial Blow',
    description: 'Crush nearby foes with a chilling slam. If your target has been struck by Banish, teleport to them.',
    icon: 'https://render.guildwars2.com/file/0B54C31BD12FD40F51C068D84A79BB6FCE6D2505/2075996.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_2',
    specialization: '',
    categories: [],
    recharge: 4,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 62521,
    name: 'Roiling Light',
    description:
      'Physical. Break stun and dodge backward, blinding foes and gaining resistance. Then, gain access to Quick Retribution.',
    icon: 'https://render.guildwars2.com/file/0D02DC3C2F31E51158C710BBB1382CE9094C3D30/2479375.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Willbender',
    categories: ['Physical'],
    recharge: 15,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 62676
  },
  {
    id: 62525,
    name: "Executioner's Calling",
    description:
      'Strike your foe with rending force. Follow up this attack with a dual strike that deals increased damage against foes you struck with the first.',
    icon: 'https://render.guildwars2.com/file/ECB53EFD2308DAB756D8CC6EA852B9C4E4BFE16A/2479371.png',
    type: 'Weapon',
    weapon: 'Sword',
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
    id: 62528,
    name: 'Willbender Flames',
    description:
      'Leave a trail of flame in your wake that damage enemies.\n\nActivating this skill destroys other active Willbender Flames effects.',
    icon: 'https://render.guildwars2.com/file/9EBC7246D94A4742CFA576CE553C019D93EA92F5/2479370.png',
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
  },
  {
    id: 62532,
    name: 'Crashing Courage',
    description:
      'Virtue. Shadowstep a short distance while gaining boons and emanating Willbender Flames from your location. Gain courage.',
    icon: 'https://render.guildwars2.com/file/3AD50BA43AA00EA97C6152D5EC6092FE0F0979D0/2479369.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_3',
    specialization: '',
    categories: ['Virtue'],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 62549,
    name: 'Heel Crack',
    description: 'Physical. Perform a quick heel strike that stuns your target.',
    icon: 'https://render.guildwars2.com/file/A0AB7CACD03DF97ABC629019B2E31078D2C10AE5/2479378.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Willbender',
    categories: ['Physical'],
    recharge: 2,
    ammo: 0,
    ammoRecharge: 15,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 62561,
    name: "Heaven's Palm",
    description:
      "Physical. Evade attacks, then shadowstep and slam the ground, knocking down your targeted foe, finishing them if there are no other enemy players nearby. Foes that aren't targeted are knocked back instead.",
    icon: 'https://render.guildwars2.com/file/547D1CB9323E9DA5495E1250F4A6396CA915119A/2479365.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: 'Willbender',
    categories: ['Physical'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 62565,
    name: 'Whirling Light',
    description:
      'Physical. Lunge forward and perform a whirlwind kick, weakening and burning any foes left in your wake.',
    icon: 'https://render.guildwars2.com/file/5B15BDE6546101D1D3B453AC2B2DE4C12B1F7EA0/2479377.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Willbender',
    categories: ['Physical'],
    recharge: 15,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 62603,
    name: 'Flowing Resolve',
    description:
      'Virtue. Remove conditions and gain Flowing Resolve. Rush forward and evade attacks while leaving Willbender Flames in your wake.',
    icon: 'https://render.guildwars2.com/file/E7DB54CE0FA25D3476405E083DBA25033C18FDA3/2479368.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_2',
    specialization: '',
    categories: ['Virtue'],
    recharge: 0,
    ammo: 2,
    ammoRecharge: 20,
    nextChainId: null,
    flipSkillId: 62528
  },
  {
    id: 62608,
    name: 'Flash Combo',
    description:
      'Physical. Shadowstep to your target and strike at them multiple times. If the skill completes without being interrupted, gain access to Repose.',
    icon: 'https://render.guildwars2.com/file/4B51750AC83E9E433F10A70FCFD2EDB5536566C2/2479373.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Willbender',
    categories: ['Physical'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 62669
  },
  {
    id: 62618,
    name: 'Willbender Flames',
    description:
      'Manifest flames that damage enemies on an interval.\n\nActivating this ability destroys other active Willbender Flames effects.',
    icon: 'https://render.guildwars2.com/file/9EBC7246D94A4742CFA576CE553C019D93EA92F5/2479370.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 62622,
    name: 'Reversal of Fortune',
    description:
      'Physical. Guard yourself with light, negating the next incoming strike and healing you instead, even if the strike would have been lethal. If an effect causes damage that would be lethal, that damage will be negated and you will be healed instead. If no attacks or lethal damage are negated, you will be healed for the lowest set amount.',
    icon: 'https://render.guildwars2.com/file/769AAD7FC9A2EDDD5658514C7717940BA5DEB5D1/2479366.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: 'Willbender',
    categories: ['Physical'],
    recharge: 2,
    ammo: 0,
    ammoRecharge: 15,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 62648,
    name: 'Crashing Courage',
    description:
      'Virtue. Shadowstep a short distance while gaining boons and emanating Willbender Flames from your location. Gain courage.',
    icon: 'https://render.guildwars2.com/file/3AD50BA43AA00EA97C6152D5EC6092FE0F0979D0/2479369.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_3',
    specialization: '',
    categories: ['Virtue'],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 62532
  },
  {
    id: 62650,
    name: 'Advancing Strike',
    description:
      'Quickly dash toward your foe and then shadowstep to deliver a debilitating attack that immobilizes your enemies.',
    icon: 'https://render.guildwars2.com/file/C6C4F63B3BE6D7CB0163F25E5A51029023F7B492/2479372.png',
    type: 'Weapon',
    weapon: 'Sword',
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
    id: 62668,
    name: 'Rushing Justice',
    description:
      'Virtue. Rush toward your target and gain Justice, delivering a strike and emanating Willbender Flames.',
    icon: 'https://render.guildwars2.com/file/2F3E006427F17D3EF747BF0F0B0E0A941964572F/2479367.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_1',
    specialization: '',
    categories: ['Virtue'],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 62618
  },
  {
    id: 62669,
    name: 'Repose',
    description: "Shadowstep to Flash Combo's starting point, healing and removing conditions.",
    icon: 'https://render.guildwars2.com/file/3D9C99D66E6CD2B0529DED46AC38AA51F4E2A61E/2479374.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Willbender',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 62676,
    name: 'Quick Retribution',
    description: 'Physical. Lunge forward and unleash a disorienting strike at your foe, dazing them.',
    icon: 'https://render.guildwars2.com/file/30A7260E22B123AD772B93C6DD11C2313D3F2D02/2479376.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Willbender',
    categories: ['Physical'],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 68647,
    name: 'Tome of Justice',
    description:
      'Virtue: Burn foes every few attacks.\nActivate: Pull forth a magical tome on the dangers of the blazing heat in Kourna.',
    icon: 'https://render.guildwars2.com/file/0A1A7614641DADEB09DF25E12BF4A8CA54A8EFF3/2779163.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_1',
    specialization: '',
    categories: ['Virtue'],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 68648,
    name: 'Tome of Resolve',
    description:
      'Virtue: Regenerate health.\nActivate: Draw forth an enchanted tome that recounts the trials undergone by the people of Vabbi.',
    icon: 'https://render.guildwars2.com/file/CA747F315578704ED2ED9CB76E48083828CE730C/2779164.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_2',
    specialization: '',
    categories: ['Virtue'],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 68650,
    name: 'Tome of Courage',
    description:
      'Virtue: Gain aegis periodically. \nActivate: Conjure a mystic tome containing stories about the heroes of Istan.',
    icon: 'https://render.guildwars2.com/file/BB01170AD5B630DFBB6BEF79664B35D71DDDF299/2779162.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_3',
    specialization: '',
    categories: ['Virtue'],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 68666,
    name: 'Renewed Focus',
    description: 'Meditation. Focus, making yourself invulnerable and recharging your virtues.',
    icon: 'https://render.guildwars2.com/file/344C7EEC3F6FE10568720E4F75EF91C37A58C43C/103665.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: '',
    categories: ['Meditation'],
    recharge: 90,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 68670,
    name: '"Feel My Wrath!"',
    description:
      'Shout. Grant fury and quickness to nearby allies. The duration of the quickness you grant yourself is doubled.',
    icon: 'https://render.guildwars2.com/file/B743B8DDF91DBC0239460877775FBE7BD36F6873/103702.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: '',
    categories: ['Shout'],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 68676,
    name: 'Signet of Courage',
    description:
      'Signet Passive: Periodically heal allies in an area around you while in combat.\nSignet Active: Channel healing and boons in a large area around you, concluding with a large heal if this skill is not interrupted.',
    icon: 'https://render.guildwars2.com/file/59C43DD96D4096AF5DF576182506A20765CAEF07/1012875.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: '',
    categories: ['Signet'],
    recharge: 60,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 68686,
    name: "Dragon's Maw",
    description: 'Trap. Lay a trap that pulls enemies and creates a barrier that holds them in.',
    icon: 'https://render.guildwars2.com/file/71FF4F27E1404DAD3EB1A63A4214A9797F740810/1024103.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: 'Dragonhunter',
    categories: ['Trap'],
    recharge: 40,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 71817,
    name: 'Jurisdiction',
    description:
      'Charge up a ball of blue flame and launch it at your enemies. Enemies it hits are burned and stunned.',
    icon: 'https://render.guildwars2.com/file/18E2D752067BEAC1E47A2928DFF2A1CE13B8DE3B/3256355.png',
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
    id: 71918,
    name: 'Hail of Justice',
    description: 'Shoot a volley of rapid-fire piercing shots that inflict bleeding and cripple.',
    icon: 'https://render.guildwars2.com/file/1A29DD0527137526CB1D355403DC009A57D767A6/3256354.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_4',
    specialization: '',
    categories: [],
    recharge: 1,
    ammo: 2,
    ammoRecharge: 10,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 71968,
    name: 'Peacekeeper',
    description: 'Fire a beam of searing light that damages and burns all enemies in its path.',
    icon: 'https://render.guildwars2.com/file/E0F376A8512ECB5938A6C7B10477F6C397FF0D00/3256352.png',
    type: 'Weapon',
    weapon: 'Pistol',
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
    id: 71987,
    name: 'Symbol of Ignition',
    description:
      'Symbol. Create a symbol that ignites when you strike an enemy inside it or shoot a projectile into it, damaging and burning enemies inside it. If the symbol is ignited by a projectile, it enchants that projectile to burn its target.',
    icon: 'https://render.guildwars2.com/file/93750C95B5645112B9ED807DE3AF29A340037ED0/3256353.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_3',
    specialization: '',
    categories: ['Symbol'],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 72031,
    name: 'Through the Heart',
    description: 'Fire a piercing shot that inflicts bleeding.',
    icon: 'https://render.guildwars2.com/file/CDCD4A9B6BC15D930A2E3B956D74A86671E4F835/3256351.png',
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
    id: 72940,
    name: 'Helio Rush',
    description:
      'Charge forward with your spear, striking enemies and healing allies you pass through. Upon striking an enemy, your next spear attack is illuminated.\n \nIlluminated. Allies you pass through are healed for more and gain boons. Enemies you strike take bonus damage and are inflicted with conditions.\n\n  Allies at full health are not affected by this skill. ',
    icon: 'https://render.guildwars2.com/file/E1207948233A0CAC25B25F4B1240773719CC6838/3379125.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_2',
    specialization: '',
    categories: [],
    recharge: 2,
    ammo: 2,
    ammoRecharge: 8,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 72978,
    name: 'Gleaming Disc',
    description:
      'Spin around, striking enemies around you. After a short delay, a shock wave of light bursts forth from your position, damaging enemies and granting might to allies. Your next spear attack is illuminated when striking an enemy with the initial spin. \n\nIlluminated. The shock wave additionally deals more damage and inflicts conditions on enemies and grants boons to allies.',
    icon: 'https://render.guildwars2.com/file/0A7A6902DC73F1C8A50907DAAE080A3CA40BC44F/3379127.png',
    type: 'Weapon',
    weapon: 'Spear',
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
    id: 73055,
    name: 'Daybreaking Slash',
    description: 'Swing your spear, sending out a wave of light in front of you that damages enemies and heals allies.',
    icon: 'https://render.guildwars2.com/file/9CE5430CF8490EAC2512AAC1C8362DD24A65D428/3379124.png',
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
    id: 73094,
    name: 'Solar Storm',
    description:
      'Throw a spear above the targeted point. The spear explodes, raining shards that damage enemies and remove conditions from allies. Your next spear attack is illuminated if you are within range of your own shards. \n\nIlluminated. More shards are produced. Removing conditions from allies also heals them. \nDamage is reduced per target each time they are struck by this skill.',
    icon: 'https://render.guildwars2.com/file/D026ABCF610D6E9615A2F7BDB8716EAFB99AAAFB/3379128.png',
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
    id: 73132,
    name: 'Symbol of Luminance',
    description:
      'Places the Symbol of Luminance on the ground, knocking back enemies on initial cast. While active, the symbol grants boons to allies and inflicts conditions on enemies. While standing within the symbol, your spear attacks are automatically illuminated and do not consume the illuminated effect when used. Resistance granted by this skill can only be granted once per interval.\n\nIlluminated. While the symbol is active, all other spear skills are illuminated, even if you move out of range of the symbol.',
    icon: 'https://render.guildwars2.com/file/0E1E2D69CBC3C0E36217506C6CCB710138035373/3379129.png',
    type: 'Weapon',
    weapon: 'Spear',
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
    id: 76616,
    name: 'Exit Radiant Forge',
    description: 'Leave Radiant Forge.',
    icon: 'https://render.guildwars2.com/file/72EAE7EF5A1F5CBBD815618094F40A3D01A2FB11/3680146.png',
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
    id: 76621,
    name: 'Resolute Stance',
    description:
      'Stance. Enter a stance that heals when you remove conditions from yourself, then heal nearby allies and remove conditions from them.',
    icon: 'https://render.guildwars2.com/file/C0267DCD064328C6C4CF33CF08714FB1DC1171BC/3680141.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: 'Luminary',
    categories: ['Stance'],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 76687,
    name: 'Daring Advance',
    description:
      'Stance. Leap to an area, tethering nearby enemies and empowering allies. Tethered enemies are revealed and take additional damage from your attacks and are stunned if they move beyond the range threshold.',
    icon: 'https://render.guildwars2.com/file/2E24D2089501C663801BF7CC567E1CC0F5714AD7/3680140.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: 'Luminary',
    categories: ['Stance'],
    recharge: 60,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 76813,
    name: 'Effulgent Stance',
    description:
      'Stance. Grant barrier and light aura to nearby allies, then enter a stance that charges up a burst of light when striking or struck by enemies. The burst of light dazes enemies if fully charged.',
    icon: 'https://render.guildwars2.com/file/59A7E145B5D6DC4CB9642F80007644791D302FA2/3680156.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Luminary',
    categories: ['Stance'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 77073,
    name: 'Enter Radiant Forge',
    description:
      'Enter Radiant Forge. The recharge time of this skill is reduced for each unused radiant weapon in shroud.',
    icon: 'https://render.guildwars2.com/file/C64AE4AF57E83451F763B80C125410773909730A/3680147.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_4',
    specialization: '',
    categories: [],
    recharge: 10,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 76616
  },
  {
    id: 77078,
    name: 'Piercing Stance',
    description: 'Stance. Enter a stance that causes you to deal more damage, then strike nearby enemies to daze them.',
    icon: 'https://render.guildwars2.com/file/E5805F3477ED5618E348043475FFA442C7C791E3/3680154.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Luminary',
    categories: ['Stance'],
    recharge: 1,
    ammo: 2,
    ammoRecharge: 20,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 77300,
    name: 'Valorous Stance',
    description:
      'Stance. Enter a stance that causes you to heal allies when you grant them boons, then grant boons to nearby allies.',
    icon: 'https://render.guildwars2.com/file/7D246678672DAF3F941930A50EBCDB54A91C7D0F/3680155.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Luminary',
    categories: ['Stance'],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 77321,
    name: 'Stalwart Stance',
    description: 'Stance. Break stun for nearby allies and enter a defensive stance, taking reduced damage.',
    icon: 'https://render.guildwars2.com/file/4770DFB6241311A7969E587B0B02BD672875F934/3680153.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Luminary',
    categories: ['Stance'],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 78358,
    name: 'Radiant Courage',
    description:
      "Virtue: Gain aegis periodically.\nActivate: Grant aegis, resistance, and Luminary's Blessing to yourself and nearby allies. \nThe next time you use Gleaming Blade, it deals increased damage and immobilizes enemies. The next time you use Radiant Bulwark, it grants barrier to nearby allies.",
    icon: 'https://render.guildwars2.com/file/61FA2B39C018F8930B38D1FC0FE5CE9C49BA681A/3713156.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_3',
    specialization: '',
    categories: ['Virtue'],
    recharge: 45,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 78770
  },
  {
    id: 78514,
    name: 'Radiant Resolve',
    description:
      'Virtue: Regenerates health.\nActivate: Heal yourself and nearby allies while granting light aura. The next time you use Luminous Staff, it heals allies and grants them regeneration.',
    icon: 'https://render.guildwars2.com/file/FA9E0C3E1024084F9E0F5505DAD826E242580C58/3713158.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_2',
    specialization: '',
    categories: ['Virtue'],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 78604,
    name: 'Radiant Resolve',
    description:
      'Virtue: Regenerates health.\nActivate: Heal yourself and nearby allies while granting light aura. The next time you use Luminous Staff, it heals allies and grants them regeneration.',
    icon: 'https://render.guildwars2.com/file/FA9E0C3E1024084F9E0F5505DAD826E242580C58/3713158.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_2',
    specialization: '',
    categories: ['Virtue'],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 78514
  },
  {
    id: 78770,
    name: 'Radiant Courage',
    description:
      "Virtue: Gain aegis periodically.\nActivate: Grant aegis, resistance, and Luminary's Blessing to yourself and nearby allies. \nThe next time you use Gleaming Blade, it deals increased damage and immobilizes enemies. The next time you use Radiant Bulwark, it grants barrier to nearby allies.",
    icon: 'https://render.guildwars2.com/file/61FA2B39C018F8930B38D1FC0FE5CE9C49BA681A/3713156.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_3',
    specialization: '',
    categories: ['Virtue'],
    recharge: 45,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 78837,
    name: 'Radiant Justice',
    description:
      'Virtue: Burn foes every few attacks.\nActivate: Gain quickness. The next time you use Dazzling Hammer, it creates a delayed secondary impact.',
    icon: 'https://render.guildwars2.com/file/4AA777300AE7D0681907353CA69FBAFD7E649253/3713157.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_1',
    specialization: '',
    categories: ['Virtue'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 29887
  }
];
