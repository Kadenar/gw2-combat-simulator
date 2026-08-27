// Generated Guild Wars 2 API metadata for mesmer.
// Snapshot: 2026-07-25. Run scripts/data/update-profession-api-data.mjs --profession Mesmer to refresh.
// Simulator mechanics are maintained under mesmer/mechanics/.

import type {
  Gw2ApiSpecialization,
  Gw2ApiTrait
} from '../../../../integrations/patches/authoring/api-metadata-types.js';
import type { MesmerSkill } from '../types.js';

export type MesmerApiTrait = Gw2ApiTrait;
export type MesmerApiSpecialization = Gw2ApiSpecialization;

export const DATA_SNAPSHOT: string = '2026-07-25';
export const SPECIALIZATIONS: readonly MesmerApiSpecialization[] = [
  {
    id: 10,
    name: 'Domination',
    elite: false,
    icon: 'https://render.guildwars2.com/file/4B61EA5997709A5DC1E46FF50CEDF2A13C1F0C3D/1012002.png',
    background: 'https://render.guildwars2.com/file/2C436DDDC3244409EEBF470A0AE3ED7CED1F99C0/1012055.png',
    minorTraits: [
      {
        id: 685,
        name: 'Illusion of Vulnerability',
        description:
          'Inflict vulnerability when you interrupt a foe.<br><c=@reminder>This trait can only affect enemies with defiance bars once per interval.</c>',
        icon: 'https://render.guildwars2.com/file/1762C27D3D729F0EDBD4EAF7F4DBAB7FAD6CC2F1/1012495.png',
        tier: 1
      },
      {
        id: 694,
        name: 'Dazzling',
        description:
          'Disabling a foe also applies vulnerability.<br><c=@reminder>Disables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.</c>',
        icon: 'https://render.guildwars2.com/file/B4500EF704977F28CB059D40424B5B031DFC10B7/1012496.png',
        tier: 2
      },
      {
        id: 1941,
        name: 'Fragility',
        description: 'Deal increased strike damage for each stack of vulnerability on your target.',
        icon: 'https://render.guildwars2.com/file/DBA1050B30E4FBB4CEAFDF01217E7E07D4EF6459/1012497.png',
        tier: 3
      }
    ],
    majorTraits: [
      [
        {
          id: 686,
          name: 'Bountiful Blades',
          description:
            'Improves greatsword skills. Mirror Blade bounces additional times, and Phantasmal Berserker summons an additional berserker and deals less damage.',
          icon: 'https://render.guildwars2.com/file/A6A23D55F25BF223A75AB62AA5D0E9C17D3BCB3C/1012492.png',
          tier: 1,
          order: 0
        },
        {
          id: 682,
          name: 'Empowered Illusions',
          description: 'Illusions deal increased strike damage.',
          icon: 'https://render.guildwars2.com/file/4337F2F9DCC4F7A6022997409400423F7A1BB946/1012487.png',
          tier: 1,
          order: 1
        },
        {
          id: 687,
          name: 'Rending Shatter',
          description: '<c=@abilitytype>Shatter</c> skills inflict vulnerability on hit.',
          icon: 'https://render.guildwars2.com/file/914DB240AB9CB47ADC437F9760B4D86BF838673A/1012488.png',
          tier: 1,
          order: 2
        }
      ],
      [
        {
          id: 693,
          name: 'Shattered Concentration',
          description: '<c=@abilitytype>Shatter</c> skills also remove a boon on hit.',
          icon: 'https://render.guildwars2.com/file/1F25AB72D072AE0FE9E3221A7D5D10AD7040406D/1012489.png',
          tier: 2,
          order: 0
        },
        {
          id: 713,
          name: 'Egotism',
          description: 'Deal increased strike damage to foes with a lower health percentage than you.',
          icon: 'https://render.guildwars2.com/file/B07D6EA99FEC210636A00E47B260F80D060DB546/1012530.png',
          tier: 2,
          order: 1
        },
        {
          id: 712,
          name: 'Furious Interruption',
          description: 'Gain quickness when you interrupt a foe.',
          icon: 'https://render.guildwars2.com/file/D83AA1E34F35E91D577752E07E1207A5F5713D57/1012491.png',
          tier: 2,
          order: 2
        }
      ],
      [
        {
          id: 681,
          name: 'Vicious Expression',
          description:
            'You and your illusions deal increased strike damage. Strike damage is further increased against foes without boons. Disabling a foe removes boons from them.<br><c=@reminder>Disables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.</c>',
          icon: 'https://render.guildwars2.com/file/E9CB4990C405C00D34DB07C5C5291FD5E90EF90C/1012486.png',
          tier: 3,
          order: 0
        },
        {
          id: 680,
          name: 'Mental Anguish',
          description:
            '<c=@abilitytype>Shatter</c> skills deal more damage. This bonus damage is doubled against foes that are not activating skills.',
          icon: 'https://render.guildwars2.com/file/4614953C566CB8F9B7169DA6E8C4060C29E9F65B/1012493.png',
          tier: 3,
          order: 1
        },
        {
          id: 1688,
          name: 'Power Block',
          description:
            'Interrupts deal damage and inflict weakness while granting you a damage increase.</c><br><c=@reminder>This trait can only damage enemies with defiance bars once per interval.</c>',
          icon: 'https://render.guildwars2.com/file/E029766272E10A957B954B12B20FD916474D5A01/1012494.png',
          tier: 3,
          order: 2
        }
      ]
    ]
  },
  {
    id: 1,
    name: 'Dueling',
    elite: false,
    icon: 'https://render.guildwars2.com/file/43C5400906A104C60F30DFE0A145D1E767353573/1012003.png',
    background: 'https://render.guildwars2.com/file/992D53319C5FCD4AE841C592DC2AE91D5906AECF/1012057.png',
    minorTraits: [
      {
        id: 706,
        name: 'Critical Infusion',
        description: 'Gain vigor when delivering a critical hit.',
        icon: 'https://render.guildwars2.com/file/ADBABE00177C2A79CA7725F2217D2165CB086239/1012507.png',
        tier: 1
      },
      {
        id: 710,
        name: 'Sharper Images',
        description: 'Illusions inflict bleeding on critical hits.',
        icon: 'https://render.guildwars2.com/file/F71BE0901F0462F0374B297BCB08426194E51A56/1012508.png',
        tier: 2
      },
      {
        id: 707,
        name: 'Master Fencer',
        description: 'Grant fury to yourself and nearby allies when you critically strike an enemy.',
        icon: 'https://render.guildwars2.com/file/26D50548E5A73BECA0A794A80645E5399C4D0367/1012509.png',
        tier: 3
      }
    ],
    majorTraits: [
      [
        {
          id: 701,
          name: 'Phantasmal Fury',
          description: 'Your phantasms have fury.',
          icon: 'https://render.guildwars2.com/file/705378A42A30BE9912BE7D0910057C00CD1CDDF2/1012498.png',
          tier: 1,
          order: 0
        },
        {
          id: 705,
          name: 'Mental Gymnastics',
          description: 'When you successfully evade an attack, gain vigor.',
          icon: 'https://render.guildwars2.com/file/AF760803BEBE1399784F02A05B4346F418AC66F3/1012499.png',
          tier: 1,
          order: 1
        },
        {
          id: 700,
          name: "Duelist's Discipline",
          description:
            'Interrupting a foe recharges pistol skills.<br><c=@reminder>This trait can only reduce recharge on enemies with defiance bars once per interval.</c>',
          icon: 'https://render.guildwars2.com/file/154231A3A76B322079386C6404702A6FB2179192/1012500.png',
          tier: 1,
          order: 2
        }
      ],
      [
        {
          id: 1889,
          name: 'Blinding Dissipation',
          description: 'Shatter skill 2 inflicts blindness.',
          icon: 'https://render.guildwars2.com/file/FE37FD6AB5F9F1AF63B89924E0DEF0904757524C/1012501.png',
          tier: 2,
          order: 0
        },
        {
          id: 1960,
          name: 'Wandering Mind',
          description: 'Remove a nondamaging condition and gain swiftness whenever you evade an attack.',
          icon: 'https://render.guildwars2.com/file/34EDDCE436BD4A20F8F2B7674D24A5A53D56A4B9/1012502.png',
          tier: 2,
          order: 1
        },
        {
          id: 708,
          name: "Fencer's Finesse",
          description:
            'Gain a stacking ferocity effect when you or one of your illusions strikes with a one-handed sword or an underwater spear. Reduces recharge on sword and underwater spear skills.',
          icon: 'https://render.guildwars2.com/file/4DEE67F2B54D37C8ACEC0F235C94D0C140A77E0F/1012503.png',
          tier: 2,
          order: 2
        }
      ],
      [
        {
          id: 692,
          name: 'Superiority Complex',
          description:
            'Your critical hits deal more damage. Critical hit damage against disabled foes, or foes below the health threshold, is further increased.<br><c=@reminder>Disabled foes are affected by stun, daze, knockback, pull, knockdown, sink, float, fear, taunt, or launch.',
          icon: 'https://render.guildwars2.com/file/AAD25BD0F7753D5B447E9654A4AE6A35057B2932/1012504.png',
          tier: 3,
          order: 0
        },
        {
          id: 1950,
          name: 'Ineptitude',
          description:
            'Interrupting a foe inflicts blind, and blinding a foe inflicts confusion.<br><c=@reminder>This trait can only activate on enemies with defiance bars once per interval.</c>',
          icon: 'https://render.guildwars2.com/file/0214C11C1C217134B2565C5201C70E9A653B2C06/1012516.png',
          tier: 3,
          order: 1
        },
        {
          id: 704,
          name: 'Deceptive Evasion',
          description: 'Create a clone at your current position when you dodge.',
          icon: 'https://render.guildwars2.com/file/FDF3040EFF90CC6313E75292F47E0A652E1303B6/1012506.png',
          tier: 3,
          order: 2
        }
      ]
    ]
  },
  {
    id: 45,
    name: 'Chaos',
    elite: false,
    icon: 'https://render.guildwars2.com/file/7FD4DF076AFB31793EFA07220B35B427B3D406C3/1012000.png',
    background: 'https://render.guildwars2.com/file/B20B7C6DDC30F72207D9BE4FB87C2FDCDC292E90/1012051.png',
    minorTraits: [
      {
        id: 666,
        name: 'Metaphysical Rejuvenation',
        description: 'Grant regeneration to nearby allies when you use a healing skill.',
        icon: 'https://render.guildwars2.com/file/9B6532A6F2ABBFB54649681E02B57F2313F3EF73/1012471.png',
        tier: 1
      },
      {
        id: 667,
        name: 'Illusionary Membrane',
        description:
          'Gain chaos aura when you use your Shatter skill 2. Chaos aura grants you increased condition damage for a period of time.',
        icon: 'https://render.guildwars2.com/file/0DF6A27A24B01D069DCD7609ADD305C7C557A82A/1012472.png',
        tier: 2
      },
      {
        id: 1865,
        name: 'Chaotic Persistence',
        description: 'Gain concentration and expertise while affected by regeneration.',
        icon: 'https://render.guildwars2.com/file/68A0B5BB7BA2BEDAD81167CFC95A9C6D551FE151/1012473.png',
        tier: 3
      }
    ],
    majorTraits: [
      [
        {
          id: 670,
          name: 'Method of Madness',
          description: 'Cast Lesser Chaos Storm when you use a healing skill.',
          icon: 'https://render.guildwars2.com/file/319D02A993BE08CEFA0798C256AE6F972D623749/1012462.png',
          tier: 1,
          order: 0
        },
        {
          id: 675,
          name: 'Illusionary Defense',
          description: 'Grant protection to nearby allies when you use Shatter skill 2.',
          icon: 'https://render.guildwars2.com/file/0E25FD2E32E05D360DB1785818965A4439C1F445/1012463.png',
          tier: 1,
          order: 1
        },
        {
          id: 677,
          name: 'Master of Manipulation',
          description: '<c=@abilitytype>Manipulations</c> grant aegis to yourself and nearby allies.',
          icon: 'https://render.guildwars2.com/file/E875372EA24AF0529E29430D0F38A90F4AA5F4F9/1012464.png',
          tier: 1,
          order: 2
        }
      ],
      [
        {
          id: 673,
          name: 'Auspicious Anguish',
          description:
            'Convert damaging conditions to boons whenever you gain Distortion or become disabled.<br><c=@reminder>This trait can only trigger when disabled once per interval.<br>Disables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.</c>',
          icon: 'https://render.guildwars2.com/file/67E22C14059400490834D1AF7F2C69A75D31E6AA/1012465.png',
          tier: 2,
          order: 0
        },
        {
          id: 668,
          name: 'Chaotic Transference',
          description: 'Gaining chaos aura grants boons to nearby allies.',
          icon: 'https://render.guildwars2.com/file/C86C0AD576C6DDBBCC08D0110930E46FBC269908/1012466.png',
          tier: 2,
          order: 1
        },
        {
          id: 669,
          name: 'Chaotic Interruption',
          description:
            'When you interrupt a foe, recharge one of your equipped-weapon skills at random.<br><c=@reminder>Only affects weapon skills that are recharging.</c>',
          icon: 'https://render.guildwars2.com/file/0214AD1DC21171D73D24D25CD1EC71D14296F2F5/1012468.png',
          tier: 2,
          order: 2
        }
      ],
      [
        {
          id: 671,
          name: 'Shaper of Chaos',
          description:
            'When you grant yourself chaos aura, if you already have chaos aura, detonate your chaos aura to grant yourself boons and inflict conditions on enemies.',
          icon: 'https://render.guildwars2.com/file/4BAB6E9C6C672B740742CA1BCE8013C95F1829B6/1012467.png',
          tier: 3,
          order: 0
        },
        {
          id: 674,
          name: 'Prismatic Understanding',
          description:
            'Increased stealth duration from mesmer skills. Shatter skill 4 grants stealth. Gain regeneration upon entering stealth, and gain protection and resolution upon exiting stealth.',
          icon: 'https://render.guildwars2.com/file/41F5AC92387E4CCAF30628E0A5FDB37FB5F50B34/1012469.png',
          tier: 3,
          order: 1
        },
        {
          id: 1687,
          name: 'Bountiful Disillusionment',
          description:
            'Gain stability when you use a <c=@abilitytype>Shatter</c> skill. Grant an additional boon to nearby allies based on which <c=@abilitytype>Shatter</c> is used.',
          icon: 'https://render.guildwars2.com/file/CC2E110B0C40A8D3AF607F59099856760CA5E9DC/1012470.png',
          tier: 3,
          order: 2
        }
      ]
    ]
  },
  {
    id: 23,
    name: 'Inspiration',
    elite: false,
    icon: 'https://render.guildwars2.com/file/BCC2C316C4FC2823679E0FD062C5A87E96E460CC/1012004.png',
    background: 'https://render.guildwars2.com/file/DC30B4FF5377E80F21F4E912E8D548B004C95042/1012059.png',
    minorTraits: [
      {
        id: 757,
        name: "Mender's Purity",
        description: 'Cast Lesser Power Cleanse when you use a healing skill.',
        icon: 'https://render.guildwars2.com/file/05AB640373CFD462B305061165617C0D0FE0A878/1012531.png',
        tier: 1
      },
      {
        id: 1852,
        name: 'Inspiring Distortion',
        description: 'Grant aegis to other nearby allies whenever you give yourself distortion or use Shatter skill 4.',
        icon: 'https://render.guildwars2.com/file/7BA394DC345278D4912EEAE94F072A06B9C932F2/1012532.png',
        tier: 2
      },
      {
        id: 1915,
        name: 'Illusionary Inspiration',
        description:
          'Increase healing to other allies. Summoning an illusion heals all allies around you.<br><br><c=@reminder>Virtuoso: Triggers when stocking a blade.</c>',
        icon: 'https://render.guildwars2.com/file/090D289158520416A4402EBE9C92257E1309020D/1012533.png',
        tier: 3
      }
    ],
    majorTraits: [
      [
        {
          id: 756,
          name: "Medic's Feedback",
          description: 'Cast Feedback while reviving an ally. Feedback revives allies inside its dome.',
          icon: 'https://render.guildwars2.com/file/4A1C386EE156DAACE137FB07060CC507EEE1E0B4/1012522.png',
          tier: 1,
          order: 0
        },
        {
          id: 738,
          name: 'Restorative Mantras',
          description: 'Heals allies around you when you use a charge of a <c=@abilitytype>mantra</c>.',
          icon: 'https://render.guildwars2.com/file/2636BEBF0E35923BC4407739D0DC7DC223932F0C/1012523.png',
          tier: 1,
          order: 1
        },
        {
          id: 744,
          name: 'Sympathetic Visage',
          description: '<c=@abilitytype>Phantasms</c> take conditions from you when summoned.',
          icon: 'https://render.guildwars2.com/file/FA0AE3A437419F325D682180687C5C7FF014602D/1012524.png',
          tier: 1,
          order: 2
        }
      ],
      [
        {
          id: 751,
          name: "Warden's Feedback",
          description: 'Focus weapon skills reflect projectiles. Reduces recharge on focus weapon skills.',
          icon: 'https://render.guildwars2.com/file/D4A345BC1A72A50B7C7449B7759BAB15664064F7/1012525.png',
          tier: 2,
          order: 0
        },
        {
          id: 740,
          name: 'Ego Restoration',
          description: 'Create a clone when you use a healing skill.',
          icon: 'https://render.guildwars2.com/file/A2B419927562110402010EEF084BF953905D54E5/1012529.png',
          tier: 2,
          order: 1
        },
        {
          id: 1980,
          name: 'Temporal Enchanter',
          description:
            ' When you cast a <c=abilitytype>glamour</c>, allies near the glamour gain resistance and superspeed.',
          icon: 'https://render.guildwars2.com/file/1503DDC5B62526D71901E3A7F891A6F4445D80C8/1012527.png',
          tier: 2,
          order: 2
        }
      ],
      [
        {
          id: 2005,
          name: 'Mental Defense',
          description: 'Shatter skill 4 grants boons and breaks allies out of stuns.',
          icon: 'https://render.guildwars2.com/file/EC7602C0FABB72AFB01379563ED7FB76079BB9CA/1012528.png',
          tier: 3,
          order: 0
        },
        {
          id: 1866,
          name: 'Restorative Illusions',
          description:
            'Heal and cleanse conditions from yourself and nearby allies when you use a <c=@abilitytype>Shatter</c> skill.',
          icon: 'https://render.guildwars2.com/file/99A30379D5040427FD0FBC5DEDB6950376AB5B1C/1012526.png',
          tier: 3,
          order: 1
        },
        {
          id: 752,
          name: 'Blurred Inscriptions',
          description:
            '<c=@abilitytype>Signets</c> have improved active effects, and activating one grants you distortion.',
          icon: 'https://render.guildwars2.com/file/B6C6AAC9506E3904F7CEEDC82629D2BEE54A7EF3/1012490.png',
          tier: 3,
          order: 2
        }
      ]
    ]
  },
  {
    id: 24,
    name: 'Illusions',
    elite: false,
    icon: 'https://render.guildwars2.com/file/A6D57C63D9EFB3FE75C9DAF8CBE603D8F45A635F/1012005.png',
    background: 'https://render.guildwars2.com/file/B00D98B31B13416811B8484FC146C49B1E055BAC/1012061.png',
    minorTraits: [
      {
        id: 734,
        name: 'Cry of Pain',
        description: 'Shatter skill 2 inflicts more stacks of confusion for an increased duration.',
        icon: 'https://render.guildwars2.com/file/3AA5FD383BE64BEFDCD1F011E2F526297DAA4868/1012519.png',
        tier: 1
      },
      {
        id: 723,
        name: 'Compounding Power',
        description: 'Creating an illusion increases your outgoing damage and condition damage for a short duration.',
        icon: 'https://render.guildwars2.com/file/E9BA251055B444E693144A9AF5FD1CF8266BEFA6/1012520.png',
        tier: 2
      },
      {
        id: 731,
        name: 'Master of Misdirection',
        description: '<c=@abilitytype>Shatter</c> skills gain recharge reduction.',
        icon: 'https://render.guildwars2.com/file/A03500F90501130C214507C2A9B4B5CAF7C5219C/1012521.png',
        tier: 3
      }
    ],
    majorTraits: [
      [
        {
          id: 721,
          name: 'Shatter Storm',
          description: 'Shatter skill 1 becomes an ammo skill.',
          icon: 'https://render.guildwars2.com/file/D5969DA633174AC5F52AB700F937A524E6E95DDE/1012513.png',
          tier: 1,
          order: 0
        },
        {
          id: 1869,
          name: 'Persistence of Memory',
          description: 'When a <c=@abilitytype>phantasm</c> becomes a clone, it transfers its boons to you.',
          icon: 'https://render.guildwars2.com/file/F225A021EB41754E4E0C9FCB46F40F7212DA41CE/1012511.png',
          tier: 1,
          order: 1
        },
        {
          id: 691,
          name: 'The Pledge',
          description: 'Flame bursts from torch skills inflict additional burning.',
          icon: 'https://render.guildwars2.com/file/20D83E25D6A9D930AA01EB0D3ABAEAD6577B0762/1012512.png',
          tier: 1,
          order: 2
        }
      ],
      [
        {
          id: 722,
          name: 'Escape Artist',
          description: 'When a <c=@abilitytype>phantasm</c> is created, grant it distortion.',
          icon: 'https://render.guildwars2.com/file/2C1BCA6C6F6763E90D0226BC2FD8DFA8403E9E47/1012510.png',
          tier: 2,
          order: 0
        },
        {
          id: 729,
          name: 'Phantasmal Haste',
          description: '<c=@abilitytype>Phantasms</c> spawn with quickness. Gain quickness when you create a phantasm.',
          icon: 'https://render.guildwars2.com/file/EE4D54D0D53E4B57C00F179BD97ED990230736DE/1012514.png',
          tier: 2,
          order: 1
        },
        {
          id: 1690,
          name: 'Maim the Disillusioned',
          description: '<c=@abilitytype>Shatter</c> skills inflict torment on hit.',
          icon: 'https://render.guildwars2.com/file/DBC6799E4A18BA9B9ABE280DAE35362DA9DAE00E/1012515.png',
          tier: 2,
          order: 2
        }
      ],
      [
        {
          id: 733,
          name: 'Phantasmal Force',
          description:
            '<c=@abilitytype>Phantasms</c> deal increased strike damage for each stack of might you have. Gain might when your phantasms become clones.',
          icon: 'https://render.guildwars2.com/file/E002FB5DEC3A010F03F2E8A7D5000DF778215F6C/1012505.png',
          tier: 3,
          order: 0
        },
        {
          id: 2035,
          name: 'Master of Fragmentation',
          description: 'Your <c=@abilitytype>Shatter</c> skills are improved.',
          icon: 'https://render.guildwars2.com/file/E625ADB94CF699763B23A7A82E255B55A44C1B16/1012517.png',
          tier: 3,
          order: 1
        },
        {
          id: 753,
          name: 'Malicious Sorcery',
          description:
            'Confusion you inflict has increased duration. When you dodge an attack, inflict confusion on your attacker.',
          icon: 'https://render.guildwars2.com/file/E1EFE39620B9A00D140A5C493ABB3180E2B2B511/1012518.png',
          tier: 3,
          order: 2
        }
      ]
    ]
  },
  {
    id: 40,
    name: 'Chronomancer',
    elite: true,
    icon: 'https://render.guildwars2.com/file/D9C960059A69F4DB6604DAD6AF06D0F940E76754/1012001.png',
    background: 'https://render.guildwars2.com/file/9D9F0DA395FDB21423981FAC2CABC850CF7E0A62/1012053.png',
    minorTraits: [
      {
        id: 2030,
        name: 'Time Splitter',
        description: 'Gain access to chronomancer shatter skills and <c=@abilitytype>Wells</c>.',
        icon: 'https://render.guildwars2.com/file/5A9347250FEF7B3431ECE3F6689EDCE20FB96CB6/1012483.png',
        tier: 1
      },
      {
        id: 1927,
        name: 'Flow of Time',
        description:
          'Gain alacrity for each clone you shatter. Gain increased critical-strike chance for you and your illusions when you have alacrity.',
        icon: 'https://render.guildwars2.com/file/54A00A0D36587A0245BD6400796CF130CE9970D7/1012484.png',
        tier: 2
      },
      {
        id: 1859,
        name: 'Time Marches On',
        description: 'You move 25% faster. Alacrity applied to you is stronger.',
        icon: 'https://render.guildwars2.com/file/D343AA7E530448F37B20936FCD3163C9BF2CE665/1012485.png',
        tier: 3
      }
    ],
    majorTraits: [
      [
        {
          id: 1838,
          name: 'Delayed Reactions',
          description:
            'Disabling a foe slows them.<br><c=@reminder>Disables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.</c><br><c=@reminder>This trait can only affect the same enemy with once per interval.</c>',
          icon: 'https://render.guildwars2.com/file/C26CBECA553C29091F1D2C9B05732847E4C3457D/1012475.png',
          tier: 1,
          order: 0
        },
        {
          id: 1995,
          name: 'Time Catches Up',
          description:
            'Activating a <c=@abilitytype>Shatter</c> gives your illusions superspeed. Shatters deal increased damage to movement-impaired foes.',
          icon: 'https://render.guildwars2.com/file/3836E04A5BF0E8CCB815A8C1627904AB0CE5EE6A/1012474.png',
          tier: 1,
          order: 1
        },
        {
          id: 1987,
          name: "All's Well That Ends Well",
          description: '<c=@abilitytype>Wells</c> heal allies when they end.',
          icon: 'https://render.guildwars2.com/file/46D30FCC070170B2F656C3D80005909CD8B0F3F4/1012476.png',
          tier: 1,
          order: 2
        }
      ],
      [
        {
          id: 2009,
          name: 'Danger Time',
          description:
            "When you inflict slow, you and your illusions' outgoing critical-strike damage is increased for a duration.",
          icon: 'https://render.guildwars2.com/file/E0A1FF012E170754030A0CB6DFDBAED3E81FAB5B/1012479.png',
          tier: 2,
          order: 0
        },
        {
          id: 1913,
          name: 'Illusionary Reversion',
          description:
            '<c=@abilitytype>Shatter</c> skills generate a clone and grant alacrity if you have enough clones present.',
          icon: 'https://render.guildwars2.com/file/4B684BD7490D52689D9CF02D205CB03811D7BA06/1012477.png',
          tier: 2,
          order: 1
        },
        {
          id: 1978,
          name: 'Time Bomb',
          description:
            'Enemies struck by Time Sink are affixed with a time bomb. Time bombs increase your strike damage dealt to the target and explode when they expire.<br><c=@reminder>Only a certain number of time bombs may be active at once.</c>',
          icon: 'https://render.guildwars2.com/file/C9BC67D77E3D959723393BF0EC9B212B53D8362D/1012478.png',
          tier: 2,
          order: 2
        }
      ],
      [
        {
          id: 1942,
          name: 'Stretched Time',
          description:
            'Nearby allies gain boons for each clone you shatter. Grant boons to nearby allies when you summon a <c=@abilitytype>phantasm</c>.',
          icon: 'https://render.guildwars2.com/file/1B7FF14574B92E6FFA71D03E3F0FEBE5FD4D2EB2/1012480.png',
          tier: 3,
          order: 0
        },
        {
          id: 2022,
          name: 'Seize the Moment',
          description:
            'You and nearby allies gain quickness for each clone you <c=@abilitytype>shatter</c>. Grant quickness to nearby allies when you summon a <c=@abilitytype>phantasm</c>.',
          icon: 'https://render.guildwars2.com/file/0FF56A2B51F9C30CDA540CC41F0A1FA30CED74A0/1012482.png',
          tier: 3,
          order: 1
        },
        {
          id: 1890,
          name: 'Chronophantasma',
          description:
            "The first time a <c=@abilitytype>phantasm</c> would become a clone, it instead resummons itself and attacks again. Resummoned phantasms inflict a percentage of the original's damage.<br><c=@reminder>(Resummoned phantasms are briefly dazed.)</c>",
          icon: 'https://render.guildwars2.com/file/120E2199010315D0C1FACA9BBFB5DF9E5E47027F/1012481.png',
          tier: 3,
          order: 2
        }
      ]
    ]
  },
  {
    id: 59,
    name: 'Mirage',
    elite: true,
    icon: 'https://render.guildwars2.com/file/6403ECA8E6C1683E2C9D075A39C154ED3A7C04A1/1769891.png',
    background: 'https://render.guildwars2.com/file/BB67F76B46052E6E291AFE75807AFC7DD33563E4/1769900.png',
    minorTraits: [
      {
        id: 2150,
        name: 'Mirage Cloak',
        description:
          'Gain Mirage Cloak instead of dodge rolling. <c=@abilitytype>Ambush</c> skills become available for a short time whenever you gain Mirage Cloak. Gain access to <c=@abilitytype>Deception</c> skills.',
        icon: 'https://render.guildwars2.com/file/FAF3D0D195F36EBA2F11086A05A5BA75A6BDDDEC/1769960.png',
        tier: 1
      },
      {
        id: 2069,
        name: "Nomad's Endurance",
        description:
          '<c=@abilitytype>Shatter</c> skills give vigor. Strike and condition damage dealt is increased when you have vigor.',
        icon: 'https://render.guildwars2.com/file/EC4E5BEAD50EC6A5A91C312EE521B7C6EC56393B/1769961.png',
        tier: 2
      },
      {
        id: 2117,
        name: 'Speed of Sand',
        description: 'Mirage Cloak increases your movement speed.',
        icon: 'https://render.guildwars2.com/file/FFB70F3D954E5A60CE03132778D310CA4824E4BF/1769962.png',
        tier: 3
      }
    ],
    majorTraits: [
      [
        {
          id: 2141,
          name: 'Self-Deception',
          description:
            'Using a <c=@abilitytype>Deception</c> skill will create a clone if you have any other clones active.',
          icon: 'https://render.guildwars2.com/file/603C30B0D0F90E21BCCC569AE8B5A35BC9E0BDBC/1769951.png',
          tier: 1,
          order: 0
        },
        {
          id: 2082,
          name: 'Renewing Oasis',
          description:
            'Gain regeneration when you gain Mirage Cloak. The duration of incoming damaging conditions is reduced while you are regenerating.',
          icon: 'https://render.guildwars2.com/file/7F0307D7130523A57E75DC19C9A3DC0CED0A6FB3/1769952.png',
          tier: 1,
          order: 1
        },
        {
          id: 2110,
          name: 'Riddle of Sand',
          description:
            'When entering combat, your first <c=@abilitytype>Ambush</c> attack applies confusion. This ability refreshes when you use a <c=@abilitytype>Shatter</c> skill.',
          icon: 'https://render.guildwars2.com/file/5E140DCE41A40CD852FA570E4250D825627F7708/1769953.png',
          tier: 1,
          order: 2
        }
      ],
      [
        {
          id: 2178,
          name: 'Desert Distortion',
          description:
            'Illusions shattered by Distortion become Mirage Mirrors. <c=@abilitytype>Ambush</c> skills become available for a short time whenever you grant distortion to yourself.',
          icon: 'https://render.guildwars2.com/file/FD373803E32D2311701C1EEEBC06A3D19A060FEC/1769954.png',
          tier: 2,
          order: 0
        },
        {
          id: 2174,
          name: 'Mirage Mantle',
          description: '<c=@abilitytype>Ambush</c> skills you use grant boons to nearby allies.',
          icon: 'https://render.guildwars2.com/file/275DBDFD630099D49A76287DDD237709150C1D73/1769955.png',
          tier: 2,
          order: 1
        },
        {
          id: 2098,
          name: 'Phantom Pain',
          description:
            'Gain a damage increase when you use a <c=@abilitytype>Shatter</c> skill, increasing per clone shattered.',
          icon: 'https://render.guildwars2.com/file/3999015BF80BA211F8AD463C50BEBD0826DC1D12/1769956.png',
          tier: 2,
          order: 2
        }
      ],
      [
        {
          id: 2070,
          name: 'Infinite Horizon',
          description: 'When you gain Mirage Cloak, your illusions also gain it.',
          icon: 'https://render.guildwars2.com/file/AE970495F2A5F7907CDBB836B5079911FC5A1064/1769957.png',
          tier: 3,
          order: 0
        },
        {
          id: 2113,
          name: 'Elusive Mind',
          description: 'Lose conditions when you gain Mirage Cloak.',
          icon: 'https://render.guildwars2.com/file/75EDD136DA210F119A74C3D8DCE1AF0D58FB2F9F/1769958.png',
          tier: 3,
          order: 1
        },
        {
          id: 2169,
          name: 'Dune Cloak',
          description:
            '<c=@abilitytype>Shatter</c> skills grant Mirage Cloak if you have enough clones present. Gaining Mirage Cloak recharges Mind Wrack and Cry of Frustration.',
          icon: 'https://render.guildwars2.com/file/5909B2013D16F1BF6F08B7BB341D295F4411DABA/1769959.png',
          tier: 3,
          order: 2
        }
      ]
    ]
  },
  {
    id: 66,
    name: 'Virtuoso',
    elite: true,
    icon: 'https://render.guildwars2.com/file/7B0F5E48320F35C0C6A2013ACF63F4C17B1105A5/2479303.png',
    background: 'https://render.guildwars2.com/file/97632575F6E89EB62A0AC8AF1DE7DFB060312317/2479306.png',
    minorTraits: [
      {
        id: 2216,
        name: 'Psychic Blades',
        description:
          'Whenever a clone would be summoned, you instead stock a <c=@abilitytype>blade</c>. Blades persist indefinitely until used. Your shatters are replaced with <c=@abilitytype>Bladesongs</c> that consume your stocked blades, but still count as shatters for the purposes of core traits.<br><br><c=@reminder>While out of combat, you will automatically stock a blade every 10 seconds.</c>',
        icon: 'https://render.guildwars2.com/file/D25E3C479F24BE357015AA03C4B8B2EBCBC01B1E/2479335.png',
        tier: 1
      },
      {
        id: 2204,
        name: 'Deadly Blades',
        description:
          '<c=@abilitytype>Blades</c> inflict vulnerability on critical hits. After successfully casting a <c=@abilitytype>Bladesong</c>, increase all damage dealt for a short time. This does not stack.',
        icon: 'https://render.guildwars2.com/file/C4AFBAAA039152A302C15B805CAD980EA9B5D006/2479337.png',
        tier: 2
      },
      {
        id: 2193,
        name: 'Quiet Intensity',
        description: 'Fury gives an increased critical hit chance. Gain ferocity based on your vitality.',
        icon: 'https://render.guildwars2.com/file/34117EC942763960F40B372D5B07583D984C96D3/2479336.png',
        tier: 3
      }
    ],
    majorTraits: [
      [
        {
          id: 2212,
          name: 'Bladeturn Refrain',
          description: '<c=@abilitytype>Bladesongs</c> grant aegis.',
          icon: 'https://render.guildwars2.com/file/72A0FCF7DE6E277E1160AA50F7C1E30BF2394CA0/2479326.png',
          tier: 1,
          order: 0
        },
        {
          id: 2208,
          name: 'Mental Focus',
          description: 'Strike damage is increased against foes within the range threshold.',
          icon: 'https://render.guildwars2.com/file/B32B3E90552D3AE773E403D6D7AA00F50F750580/2479328.png',
          tier: 1,
          order: 1
        },
        {
          id: 2202,
          name: 'Jagged Mind',
          description:
            '<c=@abilitytype>Blade</c> attacks inflict bleeding on critical hits. A percentage of your condition damage dealt heals you.',
          icon: 'https://render.guildwars2.com/file/F3757C0FFD6F0912C2FD017E0E28E76137FA5F71/2479327.png',
          tier: 1,
          order: 2
        }
      ],
      [
        {
          id: 2215,
          name: "Duelist's Reversal",
          description: 'Blocking or dodging an attack grants boons.',
          icon: 'https://render.guildwars2.com/file/5A036270324AE4F246D2086C92B23AF4354978F0/2479329.png',
          tier: 2,
          order: 0
        },
        {
          id: 2205,
          name: 'Phantasmal Blades',
          description:
            'Phantasms that successfully complete their attack launch a blade at their target and grant you fury when they expire.',
          icon: 'https://render.guildwars2.com/file/D5A30DB7ABDDCDE5B8731A5FFF20E9780C9E42A2/2479330.png',
          tier: 2,
          order: 1
        },
        {
          id: 2207,
          name: 'Sharpening Sorrow',
          description: 'Gain fury when you activate Bladesong Sorrow. Fury increases your expertise.',
          icon: 'https://render.guildwars2.com/file/0409B10E0D9E42C80EABE235E94F500F45301551/2479331.png',
          tier: 2,
          order: 2
        }
      ],
      [
        {
          id: 2211,
          name: 'Psychic Riposte',
          description: 'Blocking or evading an attack stocks <c=@abilitytype>blades</c>. Dodging stocks a blade.',
          icon: 'https://render.guildwars2.com/file/E89F2604C2E51F79E760F6DDB83E43E77078C13B/2479332.png',
          tier: 3,
          order: 0
        },
        {
          id: 2206,
          name: 'Infinite Forge',
          description:
            'Automatically stock <c=@abilitytype>blades</c> while in combat. When you use a <c=@abilitytype>bladesong</c> above the blade threshold, refund <c=@abilitytype>blades</c>. <c=@abilitytype>Blade</c> attacks deal more damage.',
          icon: 'https://render.guildwars2.com/file/DCEF7A9E2DA5E276D514B649F853CD67E3E7FBE4/2479333.png',
          tier: 3,
          order: 1
        },
        {
          id: 2223,
          name: 'Bloodsong',
          description:
            'Bleeding you apply deals increased damage. Stock a <c=@abilitytype>blade</c> after applying enough stacks of bleeding to foes.',
          icon: 'https://render.guildwars2.com/file/D014E41E176D3B0B3B1168FF1A53DF6DE9D30D34/2479334.png',
          tier: 3,
          order: 2
        }
      ]
    ]
  },
  {
    id: 73,
    name: 'Troubadour',
    elite: true,
    icon: 'https://render.guildwars2.com/file/0FDD99E8B7A7FB4B06186C0756E02C0515520F75/3679899.png',
    background: 'https://render.guildwars2.com/file/A9AF4BB7BC18AB4871B7D69EBEDEB344CD59D3DE/3679908.png',
    minorTraits: [
      {
        id: 2386,
        name: 'Wandering Minstrel',
        description:
          'Build up notes instead of summoning clones. Shatters are replaced by <c=@abilitytype>Instrument</c> skills, which consume notes to continue playing. Gain access to <c=@abilitytype>Tales</c>.<br><br><c=@reminder>While out of combat, you will automatically generate a note every 10 seconds.</c>',
        icon: 'https://render.guildwars2.com/file/20B247166125BF0E03E65372F7C5ECE23207A208/3679976.png',
        tier: 1
      },
      {
        id: 2424,
        name: 'Symphonic Resonance',
        description: 'Instruments provide bonuses while playing in the background.',
        icon: 'https://render.guildwars2.com/file/AF276ECB07996BF5343A513FF2E52F3BE1CBAD0B/3679978.png',
        tier: 2
      },
      {
        id: 2374,
        name: 'Harmonize',
        description: 'Gain a note when you use a <c=@abilitytype>phantasm</c> skill.',
        icon: 'https://render.guildwars2.com/file/4BE6ED63233DEB2D5801D5D66BB202E202A6A27F/3679977.png',
        tier: 3
      }
    ],
    majorTraits: [
      [
        {
          id: 2427,
          name: 'Mayhem',
          description: 'Flustering Flute now applies torment. Dodging reduces the recharge of Flustering Flute.',
          icon: 'https://render.guildwars2.com/file/A31842FADE40E64D553D230C0922E43D58495209/3679967.png',
          tier: 1,
          order: 0
        },
        {
          id: 2326,
          name: 'Raconteur',
          description: '<c=@abilitytype>Tales</c> heal and grant protection to nearby allies.',
          icon: 'https://render.guildwars2.com/file/77005B6DA7C4266CECE0BABD357E0F283D3E7F53/3679971.png',
          tier: 1,
          order: 1
        },
        {
          id: 2432,
          name: 'Syncopate',
          description:
            'Deafening Drum releases an additional quick wave after a delay. Deal damage to enemies you disable.',
          icon: 'https://render.guildwars2.com/file/42C9802D696B9670A0155DDF0FD2480CD9FBC473/3679969.png',
          tier: 1,
          order: 2
        }
      ],
      [
        {
          id: 2343,
          name: 'Shredding',
          description: "Lively Lute fires an additional wave at your enemy. The lute's damage bonus is increased.",
          icon: 'https://render.guildwars2.com/file/EF2D16FDF29BDCFEEC96503E0145BE1A9846F04C/3679970.png',
          tier: 2,
          order: 0
        },
        {
          id: 2367,
          name: 'Life of the Party',
          description: 'Lively Lute and Crescendo grant boons to affected allies.',
          icon: 'https://render.guildwars2.com/file/0D59A15F3F7F2671456A36C41A1737A94F050665/3679968.png',
          tier: 2,
          order: 1
        },
        {
          id: 2422,
          name: 'Love Song',
          description:
            "Harmonious Harp's distortion lasts longer. Strike damage from nearby enemies is reduced while the harp is playing in the background.",
          icon: 'https://render.guildwars2.com/file/1CC50D6BDDE64580522F0D396D194C020AC50DCE/3679972.png',
          tier: 2,
          order: 2
        }
      ],
      [
        {
          id: 2353,
          name: 'Fortissimo',
          description:
            'After using Crescendo, gain a note every interval for a duration. Gain increased attributes for each instrument you have playing.',
          icon: 'https://render.guildwars2.com/file/57A93CAD1CDC7A45BA3B3BEB1739BDC7765109D6/3679973.png',
          tier: 3,
          order: 0
        },
        {
          id: 2414,
          name: 'Call and Response',
          description:
            'When you use an instrument above the note threshold, create an afterimage that plays that instrument after a delay.',
          icon: 'https://render.guildwars2.com/file/1C96474AC3D5C74E05B724E8FF9DF9FC0ADCAFC2/3679974.png',
          tier: 3,
          order: 1
        },
        {
          id: 2441,
          name: 'Altered Chord',
          description:
            "Crescendo prompts your last-played instrument to take the spotlight, augmenting Crescendo's effects. Playing an instrument recharges Crescendo if a note was consumed.",
          icon: 'https://render.guildwars2.com/file/57FB13067F3039331F0C03A63B0D07242F0C72C4/3679975.png',
          tier: 3,
          order: 2
        }
      ]
    ]
  }
];
export const SKILLS: readonly MesmerSkill[] = [
  {
    id: 10168,
    name: 'Confusing Images',
    description: 'Channel a beam of energy that damages and confuses your foe.',
    icon: 'https://render.guildwars2.com/file/6CD969007198CB02410C0999A870300AADACABDC/103622.png',
    type: 'Weapon',
    weapon: 'Scepter',
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
    id: 10169,
    name: 'Chaos Storm',
    description:
      'Create a magical storm at the target location that applies random conditions to foes and boons to allies. The first strike of the storm dazes foes.',
    icon: 'https://render.guildwars2.com/file/B741282BD5EE93C9FC43AE417878953D50BB3974/103156.png',
    type: 'Weapon',
    weapon: 'Staff',
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
    id: 10170,
    name: 'Mind Slash',
    description: 'Chain. Slash your foe to make them vulnerable.',
    icon: 'https://render.guildwars2.com/file/58635B4F6E0264FC59BC80B73706EFB7DE0E9A34/103188.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 10171,
    flipSkillId: 10171
  },
  {
    id: 10171,
    name: 'Mind Gash',
    description: 'Chain. Gash your foe to make them vulnerable.',
    icon: 'https://render.guildwars2.com/file/CFFAD1180816A86DC03156B431A0B22C703FEAE4/103189.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 10172,
    flipSkillId: null
  },
  {
    id: 10172,
    name: 'Mind Spike',
    description: 'Stab your foe and rip a boon off of them. Does additional damage when the target has no boons.',
    icon: 'https://render.guildwars2.com/file/4C1A68BFFDD61A4147BD41039BB82D0D4F4E766B/103190.png',
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
    id: 10173,
    name: 'Illusionary Leap',
    description:
      'Clone. Summon an illusion that leaps at your target, crippling them. After the initial leap, the clone will execute the Mind Slash sword chain.',
    icon: 'https://render.guildwars2.com/file/D7202F9A1D73AAF4D478B892BDEE017AAFA93EFB/103722.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_3',
    specialization: '',
    categories: ['Clone'],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 10337
  },
  {
    id: 10174,
    name: 'Phantasmal Swordsman',
    description:
      'Phantasm. Perform a sword strike and create an illusion that attacks your foe. If the sword strike hits, you gain might.',
    icon: 'https://render.guildwars2.com/file/755CAC115104F0AA0630DCEB472D0678B62A916E/103723.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_5',
    specialization: '',
    categories: ['Phantasm'],
    recharge: 15,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10175,
    name: 'Phantasmal Duelist',
    description:
      'Phantasm. Fire multiple crippling bullets at your target and summon an illusion that unloads its pistols on your target.',
    icon: 'https://render.guildwars2.com/file/B19B18E1D8314AA63BF9A7C7E0C561624BB2D97E/103724.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_4',
    specialization: '',
    categories: ['Phantasm'],
    recharge: 16,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10176,
    name: 'Ether Feast',
    description:
      'Heal yourself and remove conditions. Gain additional health and remove additional conditions for each active clone.',
    icon: 'https://render.guildwars2.com/file/3A946C46446E0761924AB07CFC19FD5F9107FFD3/103725.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: '',
    categories: [],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10177,
    name: 'Mirror',
    description: 'Manipulation. Reflect projectiles, and heal yourself.',
    icon: 'https://render.guildwars2.com/file/CED3F1AE9294F9C5045DA8017F25170CE87C0AE2/103726.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: '',
    categories: ['Manipulation'],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10186,
    name: 'Temporal Curtain',
    description:
      'Create a wall of energy that grants swiftness to allies who cross it and cripples foes who touch it. Allies may cross the wall more than once but receive less swiftness after the first crossing.',
    icon: 'https://render.guildwars2.com/file/C6352A11D34B060628DE02A6509F6719403E7707/103198.png',
    type: 'Weapon',
    weapon: 'Focus',
    slot: 'Weapon_4',
    specialization: '',
    categories: [],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 10363
  },
  {
    id: 10189,
    name: 'Phantasmal Mage',
    description:
      'Phantasm. Strike and burn nearby foes. Create an illusion that releases a massive wave of fire that burns, confuses, and interrupts foes.',
    icon: 'https://render.guildwars2.com/file/F05D9460F100725E43FD95072F497D28E16BF103/103730.png',
    type: 'Weapon',
    weapon: 'Torch',
    slot: 'Weapon_5',
    specialization: '',
    categories: ['Phantasm'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10190,
    name: 'Cry of Frustration',
    description:
      'Shatter. Destroy all your clones, confusing nearby foes. The shatter effect also occurs at your location.',
    icon: 'https://render.guildwars2.com/file/B8E57C1F08727AF8C39066160B93D175B6A3B9BA/103731.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_2',
    specialization: '',
    categories: [],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10191,
    name: 'Mind Wrack',
    description:
      'Shatter. Destroy all your clones, damaging nearby foes. The shatter effect also occurs at your location.',
    icon: 'https://render.guildwars2.com/file/52619C5D4F9A61C8F37A0705AE36602F19E164C2/103732.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_1',
    specialization: '',
    categories: [],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 49068
  },
  {
    id: 10192,
    name: 'Distortion',
    description:
      'Shatter. Gain distortion and destroy all your clones, gaining additional distortion for each one shattered.',
    icon: 'https://render.guildwars2.com/file/D0969802A76808ACD65A56A6D54F2A40E355F7C3/103284.png',
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
    id: 10197,
    name: 'Portal Entre',
    description:
      'Glamour. Create an entry portal at your location that teleports allies to your exit portal.\n(Creating a new entrance portal while you have an active portal will destroy the active portal.)',
    icon: 'https://render.guildwars2.com/file/BB7D7902B947C52DF3FC340AA66697F0CE669E31/103558.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Glamour'],
    recharge: 72,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 10199
  },
  {
    id: 10200,
    name: 'Blink',
    description: 'Manipulation. Teleport to a target location.',
    icon: 'https://render.guildwars2.com/file/71CACFE9E642D9F4FB43D812AA78B9460C7CAD7D/103735.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Manipulation'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10201,
    name: 'Decoy',
    description: 'Clone. Gain stealth and summon an illusion to attack your foe.',
    icon: 'https://render.guildwars2.com/file/0A4D48345ABB02E606AB45FF9FB6D27FDA70E83C/103191.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Clone'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10202,
    name: 'Mirror Images',
    description: 'Clone. Summon two clones to attack your foe.',
    icon: 'https://render.guildwars2.com/file/AC1FF1F0953751DEF53E5C4A079A80F84239D05C/103736.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Clone'],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10203,
    name: 'Null Field',
    description: 'Glamour. Create a field of energy that rips boons from foes and cures conditions on allies.',
    icon: 'https://render.guildwars2.com/file/6B4F2106E3E318654F46B1E4F52CC0234D981B0A/103737.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Glamour'],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10211,
    name: 'Mantra of Pain',
    description:
      'Mantra. Meditate, charging a spell that will damage your target. Grant might to nearby allies when this spell is fully charged.',
    icon: 'https://render.guildwars2.com/file/440570B77C68F009A4EB6C0C0FFD3BE00FC11E96/103742.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Mantra'],
    recharge: 1,
    ammo: 2,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 10212
  },
  {
    id: 10213,
    name: 'Mantra of Recovery',
    description:
      'Mantra. Meditate, charging a spell that will instantly heal you when activated. Heal yourself and nearby allies when this spell fully charges.',
    icon: 'https://render.guildwars2.com/file/73CCCC9F09D026A016C5D760EA952B59C8AAF8F0/103744.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: '',
    categories: ['Mantra'],
    recharge: 10,
    ammo: 2,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 10214
  },
  {
    id: 10216,
    name: 'Phantasmal Warlock',
    description: 'Phantasm. Summon illusions that deal damage and inflict conditions.',
    icon: 'https://render.guildwars2.com/file/095CB8FCE947F9D538CAD84839B475F2EEAC4A0C/103746.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_3',
    specialization: '',
    categories: ['Phantasm'],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10218,
    name: 'Mind Stab',
    description:
      'Stab an illusionary greatsword through the ground to cripple foes at your targeted location. This skill deals increased damage against vulnerable foes.',
    icon: 'https://render.guildwars2.com/file/DA0126D7F32A973F4432E2070C0DB7252F561E90/103584.png',
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
    id: 10219,
    name: 'Spatial Surge',
    description: 'Shoot a beam at your foe. The farther away they are, the more damage you deal.',
    icon: 'https://render.guildwars2.com/file/0F9E5C7DD5545290E3D41B5603FC0327EB9E6725/103615.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 44241
  },
  {
    id: 10220,
    name: 'Illusionary Wave',
    description: 'Knock back foes with a wave of magical energy.',
    icon: 'https://render.guildwars2.com/file/5C16C0DE262ECCA295D80DA692EBC23A795DB9F7/103585.png',
    type: 'Weapon',
    weapon: 'Greatsword',
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
    id: 10221,
    name: 'Phantasmal Berserker',
    description:
      'Phantasm. Throw an illusionary greatsword at your foe, removing boons from struck enemies. Create a phantasm that whirls through foes.',
    icon: 'https://render.guildwars2.com/file/3EE57D40E5F2B376FF921FA7455D00319C7DB8A8/103747.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_4',
    specialization: '',
    categories: ['Phantasm'],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10229,
    name: 'Magic Bullet',
    description:
      'Hit up to four foes with a single shot, inflicting confusion on each foe. In addition, the first target is stunned, the second is dazed, and the third is blinded.',
    icon: 'https://render.guildwars2.com/file/03E0DB1019BF2ADABC737C03501A3E7C99B87702/103559.png',
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
    id: 10232,
    name: 'Signet of Domination',
    description: 'Signet Passive: Improved condition damage.\nSignet Active: Stun your foe.',
    icon: 'https://render.guildwars2.com/file/CE55909D170BF3E2C9F9A22C559CDF43D1726CEC/103612.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Signet'],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10234,
    name: 'Signet of Midnight',
    description: 'Signet Passive: Improves expertise.\nSignet Active: Blind nearby foes and stealth yourself.',
    icon: 'https://render.guildwars2.com/file/6F03529059F71F0CCEC9046F1932619ECB245EC4/57900.png',
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
    id: 10236,
    name: 'Signet of Inspiration',
    description:
      'Signet Passive: Grant swiftness and an additional random boon every ten seconds.\nSignet Active: Extends the duration of all boons on yourself.',
    icon: 'https://render.guildwars2.com/file/636A59096E48DD9B01D11F74EFECAEDCC4DB300D/103750.png',
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
    id: 10245,
    name: 'Mass Invisibility',
    description: 'Manipulation. You and all your allies gain stealth for a short time.',
    icon: 'https://render.guildwars2.com/file/E1EB3BC23A10BA9150EF992B03A813F4A26217A8/103755.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: '',
    categories: ['Manipulation'],
    recharge: 35,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10247,
    name: 'Signet of Illusions',
    description: 'Signet Passive: Creates a clone every few seconds.\nSignet Active: Recharges shatter skills.',
    icon: 'https://render.guildwars2.com/file/24B9A56E45B7AB5AA96FF3E85505DF60EA6EBD11/103756.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Signet'],
    recharge: 60,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10267,
    name: 'Phantasmal Disenchanter',
    description:
      'Phantasm. Summon an illusion that removes boons from targets it hits. This attack deals increased damage against foes without boons.',
    icon: 'https://render.guildwars2.com/file/9B227C21B3AFF40C222C9031EBE00995F9B43423/103764.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Phantasm'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10273,
    name: 'Winds of Chaos',
    description:
      'Bounce an orb of energy between foes and allies. The first hit applies torment, while subsequent hits to enemies apply confusion. Allies that the orb bounces to gain fury and might.',
    icon: 'https://render.guildwars2.com/file/0C9C043BFFC0773E390D19462444ABEB02FD4C01/103100.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 40184
  },
  {
    id: 10276,
    name: 'Illusionary Counter',
    description:
      'Clone. Block the next attack, and counter by inflicting torment and creating clones that cast Ether Bolt.',
    icon: 'https://render.guildwars2.com/file/C1135A9C6D504426132CCB6200DAB6C66A756709/103766.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_2',
    specialization: '',
    categories: ['Clone'],
    recharge: 6,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 10314
  },
  {
    id: 10280,
    name: 'Illusionary Riposte',
    description: 'Clone. Block your foe and create an illusion when attacked.',
    icon: 'https://render.guildwars2.com/file/AED869739FD016F10AEFE4520B155DEE731005A0/103767.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_4',
    specialization: '',
    categories: ['Clone'],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 10358
  },
  {
    id: 10282,
    name: 'Phantasmal Warden',
    description:
      'Phantasm. Create a phantasm that throws axes at nearby targets and creates a defensive bubble, protecting itself and allies from projectiles.',
    icon: 'https://render.guildwars2.com/file/4E08BB09C3E6BE013AE255D763A3EB7C99AE2644/103768.png',
    type: 'Weapon',
    weapon: 'Focus',
    slot: 'Weapon_5',
    specialization: '',
    categories: ['Phantasm'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10285,
    name: 'The Prestige',
    description:
      'Disappear in a cloud of smoke, blinding nearby foes and losing conditions. Reappear three seconds later, burning nearby foes.',
    icon: 'https://render.guildwars2.com/file/44F1C4034CB441FC110A00D551DE33ED5F95A704/103282.png',
    type: 'Weapon',
    weapon: 'Torch',
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
    id: 10287,
    name: 'Diversion',
    description:
      'Shatter. Destroy all your clones, dazing their targets. The shatter effect also occurs at your location.',
    icon: 'https://render.guildwars2.com/file/0BD64508BF40EFFF3299DFA3D1A63BF2F941A4C9/103769.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_3',
    specialization: '',
    categories: [],
    recharge: 38,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10289,
    name: 'Ether Bolt',
    description: 'Chain. Shoot a bolt of energy at your target.',
    icon: 'https://render.guildwars2.com/file/D86BE93CF7CF021ABF757410EC52E038B15F1BB8/103770.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 10290,
    flipSkillId: 10290
  },
  {
    id: 10290,
    name: 'Ether Blast',
    description: 'Chain. Shoot a second bolt of energy at your target.',
    icon: 'https://render.guildwars2.com/file/09C73FBE6CFA6AEFEF9A440AC162F2F5E8227867/103557.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 10291,
    flipSkillId: 10291
  },
  {
    id: 10291,
    name: 'Ether Clone',
    description:
      'Clone. Deliver a damaging attack directly to your target. Summon a clone that casts Ether Bolt. Inflict torment instead if you have the maximum number of illusions.',
    icon: 'https://render.guildwars2.com/file/66D5114144D3A271C72F48A124CCB70E040F3EE6/103771.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_1',
    specialization: '',
    categories: ['Clone'],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10302,
    name: 'Feedback',
    description: 'Glamour. Create a dome around your foes that reflects projectiles.',
    icon: 'https://render.guildwars2.com/file/A5720B5C9ED8CB02A3272944C50DF8426E22C5A0/103773.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Glamour'],
    recharge: 32,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10310,
    name: 'Phase Retreat',
    description: 'Clone. Teleport away from your target, summoning a clone that casts Winds of Chaos.',
    icon: 'https://render.guildwars2.com/file/56B7F719F90C04523796611A75BF960E539EB79A/103775.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_2',
    specialization: '',
    categories: ['Clone'],
    recharge: 8,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10311,
    name: 'Time Warp',
    description:
      'Glamour. Create an area that warps time, granting you and your allies quickness while slowing enemies.',
    icon: 'https://render.guildwars2.com/file/6A4DBEEAEDBDE616BA514F5BEB7666ED7066A3AA/103620.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: '',
    categories: ['Glamour'],
    recharge: 120,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10331,
    name: 'Chaos Armor',
    description:
      'Blind and confuse nearby foes while you gain chaos aura. Chaos aura grants you a random boon and inflicts your foe with a random condition whenever you are struck.',
    icon: 'https://render.guildwars2.com/file/043B48A4DAF74DF16D48BA5F36E298D16CF471B6/103765.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_4',
    specialization: '',
    categories: [],
    recharge: 16,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10333,
    name: 'Mirror Blade',
    description:
      'Throw an illusionary blade that creates a clone at its first target and then bounces to enemies and allies, dealing less damage to foes per bounce and granting might to allies.',
    icon: 'https://render.guildwars2.com/file/2E3FFCF506520375FEA923CAC4B25846035B5A0D/103789.png',
    type: 'Weapon',
    weapon: 'Greatsword',
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
    id: 10334,
    name: 'Blurred Frenzy',
    description: 'Strike your foe with a flurry of strikes, distorting the space around you, making you evade attacks.',
    icon: 'https://render.guildwars2.com/file/070633A302DA4865605316D1AF32DE40033CC0FE/103790.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_2',
    specialization: '',
    categories: [],
    recharge: 10,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 10341,
    name: 'Phantasmal Defender',
    description:
      'Phantasm. Summon an illusion that taunts your target and all nearby targets while blocking. When it finishes blocking, the illusion explodes, dealing increased damage for each attack it blocked.',
    icon: 'https://render.guildwars2.com/file/3439B9C801F6F72F0701A1BA759B249FF428D5C2/103791.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Phantasm'],
    recharge: 40,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 21750,
    name: 'Signet of the Ether',
    description:
      'Signet Passive: Heal yourself whenever you summon an illusion.\nSignet Active: Heal yourself and reduce the recharge of phantasm skills.',
    icon: 'https://render.guildwars2.com/file/EE5271572B2B10FBCE95097ECD54775832E8B9EF/699528.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: '',
    categories: ['Signet'],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 24755,
    name: 'Thousand Cuts',
    description: 'Psionic. Open a portal that devastates targets in a line in front of you with a flurry of blades.',
    icon: 'https://render.guildwars2.com/file/1AF971BFF051CE34DE34437D1A0E0991A92155F4/2479389.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: 'Virtuoso',
    categories: [],
    recharge: 60,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 29519,
    name: 'Signet of Humility',
    description:
      'Signet Passive: Reduces duration of incoming stuns, dazes, fears, and taunts.\nSignet Active: Transform your foe into a moa bird.\n(Defiant foes will have their defiant bar reduced instead.)',
    icon: 'https://render.guildwars2.com/file/A8B2B2403BF7A920040EB6E0E534920DA8D27B32/1012893.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: '',
    categories: ['Signet'],
    recharge: 45,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 29526,
    name: 'Well of Precognition',
    description:
      'Well. Create a well that gives allies the ability to see the future, allowing them to block incoming attacks. When the well ends, allies within the well regain endurance.',
    icon: 'https://render.guildwars2.com/file/C91EEC3C35FE97B349C77B2403400DDCB17F5606/1012904.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Chronomancer',
    categories: ['Well'],
    recharge: 60,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 29578,
    name: 'Mimic',
    description:
      "Manipulation. The next utility skill you use has significantly reduced recharge, and Mimic's recharge is increased by the original recharge of the affected skill.\nMimic's recharge cannot be reset by other mesmer skills.",
    icon: 'https://render.guildwars2.com/file/6C744B3948470EF0E6422DEACDC6BFBD42B609D4/103604.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    categories: ['Manipulation'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 29830,
    name: 'Continuum Split',
    description:
      "Destroy all your clones and create a rift in the space-time continuum. When it expires, you will revert back to your original point with your previous health, endurance, and skill recharges. Duration increases with each illusion shattered.\nThis skill's recharge cannot be reset by other mesmer skills.",
    icon: 'https://render.guildwars2.com/file/9E7CE10D0E447973F2D9175CF16A103BD076D04B/1012882.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_5',
    specialization: 'Chronomancer',
    categories: [],
    recharge: 105,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 30747
  },
  {
    id: 29856,
    name: 'Well of Senility',
    description:
      'Well. Creates a well that steals memories from foes, damaging and chilling them. When it expires, foes still inside the well have boons removed from them.',
    icon: 'https://render.guildwars2.com/file/4FF0FDC3406A5C01B5D2B419A67922AE4E9FF4D6/1012905.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Chronomancer',
    categories: ['Well'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 30305,
    name: 'Well of Eternity',
    description:
      'Well. Create a well that rewinds time, removing conditions from allies. When it expires, the well heals all allies in the area.',
    icon: 'https://render.guildwars2.com/file/514CB00E741027E03B525103A1D494620279FC61/1012884.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: 'Chronomancer',
    categories: ['Well'],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 30359,
    name: 'Gravity Well',
    description:
      'Well. Create a powerful well that warps space in an area, knocking down, floating, and pulling foes caught in its event horizon. When it expires, foes still inside the well take heavy damage.',
    icon: 'https://render.guildwars2.com/file/636CBDAB7A6026B62FF2317CD610D7414FDEC99C/1012881.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: 'Chronomancer',
    categories: ['Well'],
    recharge: 60,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 30525,
    name: 'Well of Calamity',
    description:
      'Well. Create a well that rends time, damaging, weakening, and crippling foes in the area. When the final pulse of Well of Calamity triggers, it deals massive damage to foes in the area.',
    icon: 'https://render.guildwars2.com/file/0EB4E57F0F26799F80727E3DFDD0470E72FB10A3/1012903.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Chronomancer',
    categories: ['Well'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 30643,
    name: 'Tides of Time',
    description:
      'Grant boons to nearby allies as you launch a wave of temporal energy that damages and stops enemies it passes through, then returns to you. Touching the returning wave reduces the recharge of this skill.',
    icon: 'https://render.guildwars2.com/file/6FFACCD661056FE05F7AA6050A3DFCC8045C0A91/1012890.png',
    type: 'Weapon',
    weapon: 'Shield',
    slot: 'Weapon_5',
    specialization: 'Chronomancer',
    categories: [],
    recharge: 35,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 30769,
    name: 'Echo of Memory',
    description:
      'Phantasm. Block incoming attacks for a short duration. If this skill fully channels, summon a phantasm that slows enemies and grants protection to allies. If an attack is blocked, Deja Vu is usable for a short time and the phantasm is summoned immediately.',
    icon: 'https://render.guildwars2.com/file/2B05E7099BC15D3A55C90D33AEB6939204DB92EA/1012889.png',
    type: 'Weapon',
    weapon: 'Shield',
    slot: 'Weapon_4',
    specialization: 'Chronomancer',
    categories: ['Phantasm'],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 29649
  },
  {
    id: 30814,
    name: 'Well of Action',
    description:
      'Well. Create a well of delayed time, damaging and slowing foes. When the well expires, time snaps back, granting boons to allies.',
    icon: 'https://render.guildwars2.com/file/7F48A218D60E55A56DC14C4E660F56F72A472105/1012902.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Chronomancer',
    categories: ['Well'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 35637,
    name: 'Sword of Decimation',
    description:
      'Psionic. Drop a massive blade on a location, immobilizing enemies. This attack deals increased damage against controlled, downed, or defiant foes. Does bonus defiance-bar damage to defiant foes.\nControls include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.',
    icon: 'https://render.guildwars2.com/file/FD3A260F2B09CA7BE3C8B7E2A17A9D436394D9AA/2479388.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Virtuoso',
    categories: [],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 40200,
    name: 'False Oasis',
    description:
      'Deception. Create a mirage at your current location and heal over time. When the mirage expires, it spawns a mirage mirror.',
    icon: 'https://render.guildwars2.com/file/CAF16BD2E1C1D1E263B46E702FD3AF9821C59FED/1770506.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: 'Mirage',
    categories: ['Deception'],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 41065,
    name: 'Crystal Sands',
    description:
      'Deception. Draw in shards of crystal sand that confuse foes they pass through on their way to your targeted location. The shards form a Mirage Mirror upon reaching their destination.',
    icon: 'https://render.guildwars2.com/file/0EDDF8213428A8302871089E560443AEEBA0246D/1770514.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Mirage',
    categories: ['Deception'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 41164,
    name: 'Mirror Strikes',
    description: 'Inflict bleeding and torment on your target.',
    icon: 'https://render.guildwars2.com/file/44E70008A846C1A03343996F1F10031966E41F0D/1770502.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    specialization: 'Mirage',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 42851,
    name: 'Mirage Advance',
    description:
      'Deception. Shadowstep and unleash an attack that blinds and dazes your target and nearby foes. You may reactivate this skill to return to your original position.',
    icon: 'https://render.guildwars2.com/file/729819F719FB5C6AA8F171993968B9276A803EDA/1770516.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Mirage',
    categories: ['Deception'],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 45666
  },
  {
    id: 43064,
    name: 'Sand through Glass',
    description: 'Deception. Evade backward and gain Mirage Cloak.',
    icon: 'https://render.guildwars2.com/file/7F3FA1CD20D930E7EEC75459E7206979DD0AD016/1770518.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Mirage',
    categories: ['Deception'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 43343,
    name: 'Blade Renewal',
    description: 'Psionic. Channel to gain distortion and stock up to the maximum number of blades.',
    icon: 'https://render.guildwars2.com/file/F21B401FC2A8736497704B7FFD4773500CA57C37/2479380.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Virtuoso',
    categories: [],
    recharge: 35,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 43761,
    name: 'Axes of Symmetry',
    description:
      'You and all your axe clones shadowstep to a random location around your target and strike, applying confusion. This attack breaks enemy targeting, and your illusions change focus to the targeted foe.',
    icon: 'https://render.guildwars2.com/file/516ED87B7FC703AC09DE924218CDB53D2FFF39C9/1770504.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_3',
    specialization: 'Mirage',
    categories: [],
    recharge: 8,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 69385
  },
  {
    id: 44791,
    name: 'Lacerating Chop',
    description: 'Inflict bleeding on your target.',
    icon: 'https://render.guildwars2.com/file/72D44CE94461AD01DA5CA6B7CBCB4E625B50993A/1770500.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    specialization: 'Mirage',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 44840,
    flipSkillId: 44840
  },
  {
    id: 44840,
    name: 'Ethereal Chop',
    description: 'Inflict Torment on your target.',
    icon: 'https://render.guildwars2.com/file/257AE20DBC1F5BB232D8F37FED4443065ED10346/1770501.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    specialization: 'Mirage',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 41164,
    flipSkillId: 41164
  },
  {
    id: 45046,
    name: 'Illusionary Ambush',
    description:
      "Deception. You and all your illusions shadowstep to a random point around your target and gain Mirage Cloak. Illusions' actions are interrupted when they change focus to the targeted foe.",
    icon: 'https://render.guildwars2.com/file/C40D96A2CEE7E1DCD012E4FFD70C0C25DA0AD949/1770515.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Mirage',
    categories: ['Deception'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 45243,
    name: 'Lingering Thoughts',
    description:
      'Spin forward and strike multiple times, inflicting conditions and leaving a mirage at your starting position. If an enemy is near the mirage when it expires, a clone is summoned.',
    icon: 'https://render.guildwars2.com/file/A49921EC7A0C62617006BAF11F76B103C26A120C/1770503.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_2',
    specialization: 'Mirage',
    categories: [],
    recharge: 0.25,
    ammo: 2,
    ammoRecharge: 6,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 45425,
    name: 'Rain of Swords',
    description:
      'Psionic. Create a storm of blades that attacks a large area, damaging and applying vulnerability to targets.',
    icon: 'https://render.guildwars2.com/file/B707CE945A596CC37A5D971EC2EB072A57680CA7/2479387.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Virtuoso',
    categories: [],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 45449,
    name: 'Jaunt',
    description: 'Deception. Shadowstep to a target location and confuse nearby foes.',
    icon: 'https://render.guildwars2.com/file/D2B615F6B574667BF4CA9C4703CB52ECFFFE2192/1770505.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: 'Mirage',
    categories: ['Deception'],
    recharge: 0.5,
    ammo: 3,
    ammoRecharge: 20,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 56873,
    name: 'Time Sink',
    description: 'Shatter. Destroy all your clones, dazing and slowing their targets.',
    icon: 'https://render.guildwars2.com/file/3A0CF805A4359A10766D1DD04FF0E7D20A05BD17/2175060.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_3',
    specialization: 'Chronomancer',
    categories: [],
    recharge: 38,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 56928,
    name: 'Rewinder',
    description:
      'Shatter. Destroy all your clones, confusing nearby foes and recharging this skill for each clone shattered.',
    icon: 'https://render.guildwars2.com/file/F59775A05108441C09AC03C30CAD98CC049CCC28/2175058.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_2',
    specialization: 'Chronomancer',
    categories: [],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 56930,
    name: 'Split Second',
    description:
      'Shatter. Destroy all your clones, damaging nearby foes. Strikes again after a delay.\nShatter traits only affect the first strike of this skill.',
    icon: 'https://render.guildwars2.com/file/14090D7A6472AB06125662EB12E6EC51EDE2EEBB/2175059.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_1',
    specialization: 'Chronomancer',
    categories: [],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 56925
  },
  {
    id: 62510,
    name: 'Flying Cutter',
    description:
      'Send a blade of energy at your target. Hitting the same target multiple times invokes a flurry of blades on your target.',
    icon: 'https://render.guildwars2.com/file/B0FE6EA92A310363CD26DA5CD81DCAB23A071D3A/2479385.png',
    type: 'Weapon',
    weapon: 'Dagger',
    slot: 'Weapon_1',
    specialization: 'Virtuoso',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 69389
  },
  {
    id: 62522,
    name: 'Twin Blade Restoration',
    description:
      'Psionic. Heal yourself, lose conditions, and throw two blades at your target. If the first blade hits, you gain aegis. If the second blade hits, you gain vigor.',
    icon: 'https://render.guildwars2.com/file/1EB2DEF5C20E4E415698251AE8AFAA5D02A513AC/2479390.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: 'Virtuoso',
    categories: [],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 62560,
    name: 'Bladecall',
    description:
      'Throw a fan of daggers that return to you. If your target is in range, the returning daggers will lock on to that target. Create a clone if this attack hits at least one target.',
    icon: 'https://render.guildwars2.com/file/45B04E5D30ADD8D1B3086A98D40BE506E313B646/2479379.png',
    type: 'Weapon',
    weapon: 'Dagger',
    slot: 'Weapon_2',
    specialization: 'Troubadour',
    categories: [],
    recharge: 5,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 62568,
    name: 'Blade Leap',
    description: 'Leap to your target and summon a clone if you hit. Can be recast to return to your starting point.',
    icon: 'https://render.guildwars2.com/file/D7202F9A1D73AAF4D478B892BDEE017AAFA93EFB/103722.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_3',
    specialization: 'Troubadour',
    categories: [],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 62675
  },
  {
    id: 62573,
    name: 'Psychic Force',
    description:
      'Psionic. Channel energy into your blades to damage nearby enemies and make your next bladesong unblockable.',
    icon: 'https://render.guildwars2.com/file/06BA1C041FC301A9670A072117300CD55863EF53/2479386.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Virtuoso',
    categories: [],
    recharge: 3,
    ammo: 2,
    ammoRecharge: 20,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 62597,
    name: 'Bladeturn Requiem',
    description:
      'Bladesong.Send your blades spinning around you to hit nearby foes. Spinning blade duration scales with number of blades consumed.',
    icon: 'https://render.guildwars2.com/file/040192EDDE9D2492D2428027E50DFC12B9044D39/2479384.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_5',
    specialization: 'Virtuoso',
    categories: [],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 62602,
    name: 'Bladesong Dissonance',
    description:
      'Bladesong. Combine all your blades into one large blade that dazes targets based on the number of blades consumed.',
    icon: 'https://render.guildwars2.com/file/D96E115ADAB14D610215EC185C3C21B4611DC292/2479381.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_3',
    specialization: 'Virtuoso',
    categories: [],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 62607,
    name: 'Unstable Bladestorm',
    description:
      'Create a telekinetic storm of daggers that damages foes. With each interval, the bladestorm will fire blades at nearby enemies.',
    icon: 'https://render.guildwars2.com/file/449039B4B74B133D226BEED819B7C408AF2B61BB/2479391.png',
    type: 'Weapon',
    weapon: 'Dagger',
    slot: 'Weapon_3',
    specialization: 'Virtuoso',
    categories: [],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 62616,
    name: 'Bladesong Sorrow',
    description: 'Bladesong. Fire all stocked blades, inflicting your target with conditions.',
    icon: 'https://render.guildwars2.com/file/EF9223543A66B8B5A8FD1C4BC4E7A218277C15C4/2479383.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_2',
    specialization: 'Virtuoso',
    categories: [],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 62617,
    name: 'Bladesong Harmony',
    description: 'Bladesong. Fire all stocked blades at your target.',
    icon: 'https://render.guildwars2.com/file/656A0C59523A4D9D935316EA93F1EA6247C32106/2479382.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_1',
    specialization: 'Virtuoso',
    categories: [],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 62586
  },
  {
    id: 68273,
    name: 'Bladesong Distortion',
    description:
      'Bladesong. Gain distortion and consume all stocked blades, gaining additional distortion for each consumed blade.',
    icon: 'https://render.guildwars2.com/file/D0969802A76808ACD65A56A6D54F2A40E355F7C3/103284.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_4',
    specialization: 'Virtuoso',
    categories: [],
    recharge: 50,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 69311,
    name: 'Bladecall',
    description: 'Throw a fan of daggers that return to you. Summon a clone if this attack hits at least one target.',
    icon: 'https://render.guildwars2.com/file/45B04E5D30ADD8D1B3086A98D40BE506E313B646/2479379.png',
    type: 'Weapon',
    weapon: 'Dagger',
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
    id: 69344,
    name: 'Lingering Thoughts',
    description:
      'Spin forward and strike multiple times, inflicting conditions. Summon a clone if you hit at least one target.',
    icon: 'https://render.guildwars2.com/file/A49921EC7A0C62617006BAF11F76B103C26A120C/1770503.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_2',
    specialization: 'Troubadour',
    categories: [],
    recharge: 0.25,
    ammo: 2,
    ammoRecharge: 6,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 69385,
    name: 'Axes of Symmetry',
    description:
      'Shadowstep to a random location around your target and strike, applying confusion. Apply extra stacks of confusion per active clone. This attack breaks enemy targeting, and your illusions change focus to the targeted foe.',
    icon: 'https://render.guildwars2.com/file/516ED87B7FC703AC09DE924218CDB53D2FFF39C9/1770504.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_3',
    specialization: 'Troubadour',
    categories: [],
    recharge: 8,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 71892,
    name: 'Friendly Fire',
    description: 'Shoot an illusionary bullet that heals nearby allies on impact.',
    icon: 'https://render.guildwars2.com/file/BAAD0DF6B8C4AAF520B82BE3CEA7931BC2F52DCF/3256358.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 71800
  },
  {
    id: 71897,
    name: 'Journey',
    description:
      'Clone. Shoot a bullet through a portal. It reappears above the target location and explodes, damaging enemies and healing allies. Create a clone if you hit an enemy or ally.',
    icon: 'https://render.guildwars2.com/file/3E615FE1679F39B3E22C0706F83ABEFF80092B21/3256359.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_2',
    specialization: '',
    categories: ['Clone'],
    recharge: 5,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 72005,
    name: 'Inspiring Imagery',
    description:
      'Throw an inspiring beacon to a target location. The beacon will explode after a short duration, granting boons to nearby allies. The beacon can be detonated early to heal allies and damage enemies.',
    icon: 'https://render.guildwars2.com/file/9BC790BC5D1C4E667599C6090F6EFAADED6AD9A3/3256360.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_3',
    specialization: '',
    categories: [],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 72076
  },
  {
    id: 72007,
    name: 'Phantasmal Sharpshooter',
    description: 'Phantasm. Create a phantasm that shoots a bullet at your target, stunning them.',
    icon: 'https://render.guildwars2.com/file/3499040CA6182B68293313C1000C470828CE1532/3256362.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_4',
    specialization: '',
    categories: ['Phantasm'],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 72008,
    name: 'Singularity Shot',
    description:
      'Shoot a bullet at a target location that explodes upon arrival, granting resistance and barrier to allies. A singularity lingers at the impact point.',
    icon: 'https://render.guildwars2.com/file/3895647E911D09067115A75D5F5C2035B069D2DA/3256363.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_5',
    specialization: '',
    categories: [],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: 71792
  },
  {
    id: 72946,
    name: 'Phantasmal Lancer',
    description:
      'Dash at your foe, removing boons from them. Leave a phantasm at your initial location that will launch a spear at your target, dealing heavy damage and crippling targets. If your phantasm strikes a crippled target, immobilize them instead. If you have Clarity, summon an additional phantasm.',
    icon: 'https://render.guildwars2.com/file/5E6C98FA3B942EE76808530B016FF5621A25764F/3379157.png',
    type: 'Weapon',
    weapon: 'Spear',
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
    id: 72957,
    name: 'Mental Collapse',
    description:
      'Teleport to your target and release a cascade of psychic energy, damaging nearby enemies. Refresh your Mind the Gap skill. The initial impact stuns foes struck if you have Clarity.',
    icon: 'https://render.guildwars2.com/file/6F07061FEB1E435935AE9269C27DA3EDF5095627/3379158.png',
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
    id: 73066,
    name: 'Psystrike',
    description: 'Rend your foe with an upward swing. Gain might per target struck.',
    icon: 'https://render.guildwars2.com/file/0CBE4BCB69A5B2200980B4DC98BC0E6AC25675FC/3379153.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 73095,
    flipSkillId: null
  },
  {
    id: 73093,
    name: 'Mind the Gap',
    description:
      'Swing your spear in a circle, dealing increased damage to foes in the outer edge. Striking with the outer edge will always deal a critical hit. Create a clone and gain Clarity if you hit an enemy. If you are empowered, gain might.',
    icon: 'https://render.guildwars2.com/file/A2482595561FEE203E1E72A670F10FAB2F2FFB97/3379155.png',
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
    id: 73095,
    name: 'Mind Pierce',
    description: "Deliver a finishing thrust, breaking your opponent's mind and inflicting weakness.",
    icon: 'https://render.guildwars2.com/file/3C543ADB3D7EF49DE574040241F1B206B20CB7A0/3379154.png',
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
    id: 73152,
    name: 'Imaginary Inversion',
    description:
      'Cleanse conditions and evade while preparing a strong attack. If you successfully evade, heal yourself. Healing is improved if you have Clarity.',
    icon: 'https://render.guildwars2.com/file/04DD10464EFA2CC6E034CABF03D4D89427CFB4E4/3379156.png',
    type: 'Weapon',
    weapon: 'Spear',
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
    id: 73154,
    name: 'Psycut',
    description: 'Slash your spear in front of yourself. Gain might per target struck.',
    icon: 'https://render.guildwars2.com/file/4BD3520A04710FE5C257CDED2F0C1971E02E0F5F/3379152.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_1',
    specialization: '',
    categories: [],
    recharge: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: 73066,
    flipSkillId: 73066
  },
  {
    id: 76552,
    name: 'Lively Lute',
    description:
      "Instrument. Perform with your lute, sending out damaging sound waves toward an enemy and healing tones toward allies.\nThe lute will then consume all notes to continue playing in the background. The lute's duration is extended for each note consumed.",
    icon: 'https://render.guildwars2.com/file/4CAA3750145A55B7E73D5EB9917590EC45657BE7/3680159.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_1',
    specialization: 'Troubadour',
    categories: [],
    recharge: 12,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 76611,
    name: 'Tale of the Honorable Rogue',
    description:
      'Tale. Quote the escapades of Dougal Keane, causing nearby allies to become extraordinarily nimble with a burst of speed.',
    icon: 'https://render.guildwars2.com/file/37EF1C69AC3D935333FCD8FC637729CEBE2A460E/3680165.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Troubadour',
    categories: [],
    recharge: 4,
    ammo: 2,
    ammoRecharge: 25,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 76695,
    name: 'Tale of the Second Scion',
    description:
      'Tale. Deliver the story of Aurene and the dragon cycle, rejuvenating nearby allies and increasing their incoming healing.',
    icon: 'https://render.guildwars2.com/file/F12BF59E070FB12D2EAAA209596C52C4D76C4E97/3680158.png',
    type: 'Heal',
    weapon: '',
    slot: 'Heal',
    specialization: 'Troubadour',
    categories: [],
    recharge: 15,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 76746,
    name: 'Flustering Flute',
    description:
      "Instrument. Play an enchanting tune with the flute, confusing enemies in front of you. Enemies in the center of the music will be dazed.\nThe flute will then consume all notes to continue playing in the background. The flute's duration is extended for each note consumed.",
    icon: 'https://render.guildwars2.com/file/CFE30B5052A2AA67D9A8AE5FC1FBA0A56C64584C/3680160.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_2',
    specialization: 'Troubadour',
    categories: [],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 76850,
    name: 'Tale of the Soulkeeper',
    description: 'Tale. Rouse allies with the legend of Almorra Soulkeeper, granting offensive boons.',
    icon: 'https://render.guildwars2.com/file/AC9DC59D1CEF42DFD47CED6CE429041C7FADBBE7/3680164.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Troubadour',
    categories: [],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 76931,
    name: 'Crescendo',
    description:
      "Strike up the band and unleash a wave of sonic magic. Instruments playing in the background contribute to the amplitude, increasing the strength of the wave.\nThis skill's recharge cannot be reset by other mesmer skills.",
    icon: 'https://render.guildwars2.com/file/935C32505D1F4DB7D9739C2C4B4137D4346709A4/3680163.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_5',
    specialization: 'Troubadour',
    categories: [],
    recharge: 35,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 76960,
    name: 'Harmonious Harp',
    description:
      "Instrument. Gain distortion and strum the harp, continuously healing nearby allies.\nThe harp will then consume all notes to continue playing in the background. The harp's duration is extended for each note consumed.",
    icon: 'https://render.guildwars2.com/file/C1BCF465DE1DAB00E00B0F1494ABDB2D7F57BECA/3680162.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_4',
    specialization: 'Troubadour',
    categories: [],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 76971,
    name: 'Tale of the August Queen',
    description:
      'Tale. Retell how Queen Jennah protected her city in their time of need, granting allies distortion and chaos aura.',
    icon: 'https://render.guildwars2.com/file/3FE0BC0317E63419FBCCC374A0D0A358E3A225F7/3680157.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: 'Troubadour',
    categories: [],
    recharge: 75,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 77066,
    name: 'Tale of the Tortured Mastermind',
    description:
      'Tale. Recall the cruelty of Scarlet Briar as you revile your target with a battery of insults, damaging their ego.',
    icon: 'https://render.guildwars2.com/file/64FFFDF0DB06E31493673D7313305536B7AAA53D/3680167.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Troubadour',
    categories: [],
    recharge: 20,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 77077,
    name: 'Harmonious Harp',
    description:
      "Instrument. Gain distortion and strum the harp, continuously healing nearby allies.\nThe harp will then consume all notes to continue playing in the background. The harp's duration is extended for each note consumed.",
    icon: 'https://render.guildwars2.com/file/C1BCF465DE1DAB00E00B0F1494ABDB2D7F57BECA/3680162.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_4',
    specialization: 'Troubadour',
    categories: [],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 77079,
    name: 'Deafening Drum',
    description:
      "Instrument. Slam the drum to release a percussive shock wave, disabling enemies. The strength of the disable increases the closer an enemy is.\nThe drum will then consume all notes to continue playing in the background. The drum's duration is extended for each note consumed.",
    icon: 'https://render.guildwars2.com/file/E061ECE20A34DC281C0E3EB8FB90094549E87941/3680161.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_3',
    specialization: 'Troubadour',
    categories: [],
    recharge: 25,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 77178,
    name: 'Tale of the Valiant Marshal',
    description:
      'Tale. Orate the heroism of Trahearne, calling nearby allies to action. Break their stuns and brace them for battle.',
    icon: 'https://render.guildwars2.com/file/C0BF1CA6F342F135C71E97D827ECCC776D0E7429/3680166.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: 'Troubadour',
    categories: [],
    recharge: 30,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null
  },
  {
    id: 77306,
    name: 'Lively Lute',
    description:
      "Instrument. Perform with your lute, sending out damaging sound waves toward an enemy and healing tones toward allies.\nThe lute will then consume all notes to continue playing in the background. The lute's duration is extended for each note consumed.",
    icon: 'https://render.guildwars2.com/file/4CAA3750145A55B7E73D5EB9917590EC45657BE7/3680159.png',
    type: 'Profession',
    weapon: '',
    slot: 'Profession_1',
    specialization: 'Troubadour',
    categories: [],
    recharge: 1,
    ammo: 2,
    ammoRecharge: 12,
    nextChainId: null,
    flipSkillId: null
  }
];
