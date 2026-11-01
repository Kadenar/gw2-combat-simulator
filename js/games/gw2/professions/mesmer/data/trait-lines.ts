/** Maintained core and elite trait lines supply trait presentation and selection layout. */
import type { Gw2SpecializationData } from '#gw2/platform/profession-definition/specialization-data-types.js';

export const TRAIT_LINES: readonly Gw2SpecializationData[] = [
  {
    id: 10,
    name: 'Domination',
    elite: false,
    icon: 'https://render.guildwars2.com/file/4B61EA5997709A5DC1E46FF50CEDF2A13C1F0C3D/1012002.png',
    minorTraits: [
      {
        id: 685,
        name: 'Illusion of Vulnerability',
        description:
          'Inflict vulnerability when you interrupt a foe.\nThis trait can only affect enemies with defiance bars once per interval.',
        icon: 'https://render.guildwars2.com/file/1762C27D3D729F0EDBD4EAF7F4DBAB7FAD6CC2F1/1012495.png'
      },
      {
        id: 694,
        name: 'Dazzling',
        description:
          'Disabling a foe also applies vulnerability.\nDisables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.',
        icon: 'https://render.guildwars2.com/file/B4500EF704977F28CB059D40424B5B031DFC10B7/1012496.png'
      },
      {
        id: 1941,
        name: 'Fragility',
        description: 'Deal increased strike damage for each stack of vulnerability on your target.',
        icon: 'https://render.guildwars2.com/file/DBA1050B30E4FBB4CEAFDF01217E7E07D4EF6459/1012497.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 686,
          name: 'Bountiful Blades',
          description:
            'Improves greatsword skills. Mirror Blade bounces additional times, and Phantasmal Berserker summons an additional berserker and deals less damage.',
          icon: 'https://render.guildwars2.com/file/A6A23D55F25BF223A75AB62AA5D0E9C17D3BCB3C/1012492.png'
        },
        {
          id: 682,
          name: 'Empowered Illusions',
          description: 'Illusions deal increased strike damage.',
          icon: 'https://render.guildwars2.com/file/4337F2F9DCC4F7A6022997409400423F7A1BB946/1012487.png'
        },
        {
          id: 687,
          name: 'Rending Shatter',
          description: 'Shatter skills inflict vulnerability on hit.',
          icon: 'https://render.guildwars2.com/file/914DB240AB9CB47ADC437F9760B4D86BF838673A/1012488.png'
        }
      ],
      [
        {
          id: 693,
          name: 'Shattered Concentration',
          description: 'Shatter skills also remove a boon on hit.',
          icon: 'https://render.guildwars2.com/file/1F25AB72D072AE0FE9E3221A7D5D10AD7040406D/1012489.png'
        },
        {
          id: 713,
          name: 'Egotism',
          description: 'Deal increased strike damage to foes with a lower health percentage than you.',
          icon: 'https://render.guildwars2.com/file/B07D6EA99FEC210636A00E47B260F80D060DB546/1012530.png'
        },
        {
          id: 712,
          name: 'Furious Interruption',
          description: 'Gain quickness when you interrupt a foe.',
          icon: 'https://render.guildwars2.com/file/D83AA1E34F35E91D577752E07E1207A5F5713D57/1012491.png'
        }
      ],
      [
        {
          id: 681,
          name: 'Vicious Expression',
          description:
            'You and your illusions deal increased strike damage. Strike damage is further increased against foes without boons. Disabling a foe removes boons from them.\nDisables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.',
          icon: 'https://render.guildwars2.com/file/E9CB4990C405C00D34DB07C5C5291FD5E90EF90C/1012486.png'
        },
        {
          id: 680,
          name: 'Mental Anguish',
          description:
            'Shatter skills deal more damage. This bonus damage is doubled against foes that are not activating skills.',
          icon: 'https://render.guildwars2.com/file/4614953C566CB8F9B7169DA6E8C4060C29E9F65B/1012493.png'
        },
        {
          id: 1688,
          name: 'Power Block',
          description:
            'Interrupts deal damage and inflict weakness while granting you a damage increase.\nThis trait can only damage enemies with defiance bars once per interval.',
          icon: 'https://render.guildwars2.com/file/E029766272E10A957B954B12B20FD916474D5A01/1012494.png'
        }
      ]
    ]
  },
  {
    id: 1,
    name: 'Dueling',
    elite: false,
    icon: 'https://render.guildwars2.com/file/43C5400906A104C60F30DFE0A145D1E767353573/1012003.png',
    minorTraits: [
      {
        id: 706,
        name: 'Critical Infusion',
        description: 'Gain vigor when delivering a critical hit.',
        icon: 'https://render.guildwars2.com/file/ADBABE00177C2A79CA7725F2217D2165CB086239/1012507.png'
      },
      {
        id: 710,
        name: 'Sharper Images',
        description: 'Illusions inflict bleeding on critical hits.',
        icon: 'https://render.guildwars2.com/file/F71BE0901F0462F0374B297BCB08426194E51A56/1012508.png'
      },
      {
        id: 707,
        name: 'Master Fencer',
        description: 'Grant fury to yourself and nearby allies when you critically strike an enemy.',
        icon: 'https://render.guildwars2.com/file/26D50548E5A73BECA0A794A80645E5399C4D0367/1012509.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 701,
          name: 'Phantasmal Fury',
          description: 'Your phantasms have fury.',
          icon: 'https://render.guildwars2.com/file/705378A42A30BE9912BE7D0910057C00CD1CDDF2/1012498.png'
        },
        {
          id: 705,
          name: 'Mental Gymnastics',
          description: 'When you successfully evade an attack, gain vigor.',
          icon: 'https://render.guildwars2.com/file/AF760803BEBE1399784F02A05B4346F418AC66F3/1012499.png'
        },
        {
          id: 700,
          name: "Duelist's Discipline",
          description:
            'Interrupting a foe recharges pistol skills.\nThis trait can only reduce recharge on enemies with defiance bars once per interval.',
          icon: 'https://render.guildwars2.com/file/154231A3A76B322079386C6404702A6FB2179192/1012500.png'
        }
      ],
      [
        {
          id: 1889,
          name: 'Blinding Dissipation',
          description: 'Shatter skill 2 inflicts blindness.',
          icon: 'https://render.guildwars2.com/file/FE37FD6AB5F9F1AF63B89924E0DEF0904757524C/1012501.png'
        },
        {
          id: 1960,
          name: 'Wandering Mind',
          description: 'Remove a nondamaging condition and gain swiftness whenever you evade an attack.',
          icon: 'https://render.guildwars2.com/file/34EDDCE436BD4A20F8F2B7674D24A5A53D56A4B9/1012502.png'
        },
        {
          id: 708,
          name: "Fencer's Finesse",
          description:
            'Gain a stacking ferocity effect when you or one of your illusions strikes with a one-handed sword or an underwater spear. Reduces recharge on sword and underwater spear skills.',
          icon: 'https://render.guildwars2.com/file/4DEE67F2B54D37C8ACEC0F235C94D0C140A77E0F/1012503.png'
        }
      ],
      [
        {
          id: 692,
          name: 'Superiority Complex',
          description:
            'Your critical hits deal more damage. Critical hit damage against disabled foes, or foes below the health threshold, is further increased.\nDisabled foes are affected by stun, daze, knockback, pull, knockdown, sink, float, fear, taunt, or launch.',
          icon: 'https://render.guildwars2.com/file/AAD25BD0F7753D5B447E9654A4AE6A35057B2932/1012504.png'
        },
        {
          id: 1950,
          name: 'Ineptitude',
          description:
            'Interrupting a foe inflicts blind, and blinding a foe inflicts confusion.\nThis trait can only activate on enemies with defiance bars once per interval.',
          icon: 'https://render.guildwars2.com/file/0214C11C1C217134B2565C5201C70E9A653B2C06/1012516.png'
        },
        {
          id: 704,
          name: 'Deceptive Evasion',
          description: 'Create a clone at your current position when you dodge.',
          icon: 'https://render.guildwars2.com/file/FDF3040EFF90CC6313E75292F47E0A652E1303B6/1012506.png'
        }
      ]
    ]
  },
  {
    id: 45,
    name: 'Chaos',
    elite: false,
    icon: 'https://render.guildwars2.com/file/7FD4DF076AFB31793EFA07220B35B427B3D406C3/1012000.png',
    minorTraits: [
      {
        id: 666,
        name: 'Metaphysical Rejuvenation',
        description: 'Grant regeneration to nearby allies when you use a healing skill.',
        icon: 'https://render.guildwars2.com/file/9B6532A6F2ABBFB54649681E02B57F2313F3EF73/1012471.png'
      },
      {
        id: 667,
        name: 'Illusionary Membrane',
        description:
          'Gain chaos aura when you use your Shatter skill 2. Chaos aura grants you increased condition damage for a period of time.',
        icon: 'https://render.guildwars2.com/file/0DF6A27A24B01D069DCD7609ADD305C7C557A82A/1012472.png'
      },
      {
        id: 1865,
        name: 'Chaotic Persistence',
        description: 'Gain concentration and expertise while affected by regeneration.',
        icon: 'https://render.guildwars2.com/file/68A0B5BB7BA2BEDAD81167CFC95A9C6D551FE151/1012473.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 670,
          name: 'Method of Madness',
          description: 'Cast Lesser Chaos Storm when you use a healing skill.',
          icon: 'https://render.guildwars2.com/file/319D02A993BE08CEFA0798C256AE6F972D623749/1012462.png'
        },
        {
          id: 675,
          name: 'Illusionary Defense',
          description: 'Grant protection to nearby allies when you use Shatter skill 2.',
          icon: 'https://render.guildwars2.com/file/0E25FD2E32E05D360DB1785818965A4439C1F445/1012463.png'
        },
        {
          id: 677,
          name: 'Master of Manipulation',
          description: 'Manipulations grant aegis to yourself and nearby allies.',
          icon: 'https://render.guildwars2.com/file/E875372EA24AF0529E29430D0F38A90F4AA5F4F9/1012464.png'
        }
      ],
      [
        {
          id: 673,
          name: 'Auspicious Anguish',
          description:
            'Convert damaging conditions to boons whenever you gain Distortion or become disabled.\nThis trait can only trigger when disabled once per interval.\nDisables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.',
          icon: 'https://render.guildwars2.com/file/67E22C14059400490834D1AF7F2C69A75D31E6AA/1012465.png'
        },
        {
          id: 668,
          name: 'Chaotic Transference',
          description: 'Gaining chaos aura grants boons to nearby allies.',
          icon: 'https://render.guildwars2.com/file/C86C0AD576C6DDBBCC08D0110930E46FBC269908/1012466.png'
        },
        {
          id: 669,
          name: 'Chaotic Interruption',
          description:
            'When you interrupt a foe, recharge one of your equipped-weapon skills at random.\nOnly affects weapon skills that are recharging.',
          icon: 'https://render.guildwars2.com/file/0214AD1DC21171D73D24D25CD1EC71D14296F2F5/1012468.png'
        }
      ],
      [
        {
          id: 671,
          name: 'Shaper of Chaos',
          description:
            'When you grant yourself chaos aura, if you already have chaos aura, detonate your chaos aura to grant yourself boons and inflict conditions on enemies.',
          icon: 'https://render.guildwars2.com/file/4BAB6E9C6C672B740742CA1BCE8013C95F1829B6/1012467.png'
        },
        {
          id: 674,
          name: 'Prismatic Understanding',
          description:
            'Increased stealth duration from mesmer skills. Shatter skill 4 grants stealth. Gain regeneration upon entering stealth, and gain protection and resolution upon exiting stealth.',
          icon: 'https://render.guildwars2.com/file/41F5AC92387E4CCAF30628E0A5FDB37FB5F50B34/1012469.png'
        },
        {
          id: 1687,
          name: 'Bountiful Disillusionment',
          description:
            'Gain stability when you use a Shatter skill. Grant an additional boon to nearby allies based on which Shatter is used.',
          icon: 'https://render.guildwars2.com/file/CC2E110B0C40A8D3AF607F59099856760CA5E9DC/1012470.png'
        }
      ]
    ]
  },
  {
    id: 23,
    name: 'Inspiration',
    elite: false,
    icon: 'https://render.guildwars2.com/file/BCC2C316C4FC2823679E0FD062C5A87E96E460CC/1012004.png',
    minorTraits: [
      {
        id: 757,
        name: "Mender's Purity",
        description: 'Cast Lesser Power Cleanse when you use a healing skill.',
        icon: 'https://render.guildwars2.com/file/05AB640373CFD462B305061165617C0D0FE0A878/1012531.png'
      },
      {
        id: 1852,
        name: 'Inspiring Distortion',
        description: 'Grant aegis to other nearby allies whenever you give yourself distortion or use Shatter skill 4.',
        icon: 'https://render.guildwars2.com/file/7BA394DC345278D4912EEAE94F072A06B9C932F2/1012532.png'
      },
      {
        id: 1915,
        name: 'Illusionary Inspiration',
        description:
          'Increase healing to other allies. Summoning an illusion heals all allies around you.\n\nVirtuoso: Triggers when stocking a blade.',
        icon: 'https://render.guildwars2.com/file/090D289158520416A4402EBE9C92257E1309020D/1012533.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 756,
          name: "Medic's Feedback",
          description: 'Cast Feedback while reviving an ally. Feedback revives allies inside its dome.',
          icon: 'https://render.guildwars2.com/file/4A1C386EE156DAACE137FB07060CC507EEE1E0B4/1012522.png'
        },
        {
          id: 738,
          name: 'Restorative Mantras',
          description: 'Heals allies around you when you use a charge of a mantra.',
          icon: 'https://render.guildwars2.com/file/2636BEBF0E35923BC4407739D0DC7DC223932F0C/1012523.png'
        },
        {
          id: 744,
          name: 'Sympathetic Visage',
          description: 'Phantasms take conditions from you when summoned.',
          icon: 'https://render.guildwars2.com/file/FA0AE3A437419F325D682180687C5C7FF014602D/1012524.png'
        }
      ],
      [
        {
          id: 751,
          name: "Warden's Feedback",
          description: 'Focus weapon skills reflect projectiles. Reduces recharge on focus weapon skills.',
          icon: 'https://render.guildwars2.com/file/D4A345BC1A72A50B7C7449B7759BAB15664064F7/1012525.png'
        },
        {
          id: 740,
          name: 'Ego Restoration',
          description: 'Create a clone when you use a healing skill.',
          icon: 'https://render.guildwars2.com/file/A2B419927562110402010EEF084BF953905D54E5/1012529.png'
        },
        {
          id: 1980,
          name: 'Temporal Enchanter',
          description: ' When you cast a glamour, allies near the glamour gain resistance and superspeed.',
          icon: 'https://render.guildwars2.com/file/1503DDC5B62526D71901E3A7F891A6F4445D80C8/1012527.png'
        }
      ],
      [
        {
          id: 2005,
          name: 'Mental Defense',
          description: 'Shatter skill 4 grants boons and breaks allies out of stuns.',
          icon: 'https://render.guildwars2.com/file/EC7602C0FABB72AFB01379563ED7FB76079BB9CA/1012528.png'
        },
        {
          id: 1866,
          name: 'Restorative Illusions',
          description: 'Heal and cleanse conditions from yourself and nearby allies when you use a Shatter skill.',
          icon: 'https://render.guildwars2.com/file/99A30379D5040427FD0FBC5DEDB6950376AB5B1C/1012526.png'
        },
        {
          id: 752,
          name: 'Blurred Inscriptions',
          description: 'Signets have improved active effects, and activating one grants you distortion.',
          icon: 'https://render.guildwars2.com/file/B6C6AAC9506E3904F7CEEDC82629D2BEE54A7EF3/1012490.png'
        }
      ]
    ]
  },
  {
    id: 24,
    name: 'Illusions',
    elite: false,
    icon: 'https://render.guildwars2.com/file/A6D57C63D9EFB3FE75C9DAF8CBE603D8F45A635F/1012005.png',
    minorTraits: [
      {
        id: 734,
        name: 'Cry of Pain',
        description: 'Shatter skill 2 inflicts more stacks of confusion for an increased duration.',
        icon: 'https://render.guildwars2.com/file/3AA5FD383BE64BEFDCD1F011E2F526297DAA4868/1012519.png'
      },
      {
        id: 723,
        name: 'Compounding Power',
        description: 'Creating an illusion increases your outgoing damage and condition damage for a short duration.',
        icon: 'https://render.guildwars2.com/file/E9BA251055B444E693144A9AF5FD1CF8266BEFA6/1012520.png'
      },
      {
        id: 731,
        name: 'Master of Misdirection',
        description: 'Shatter skills gain recharge reduction.',
        icon: 'https://render.guildwars2.com/file/A03500F90501130C214507C2A9B4B5CAF7C5219C/1012521.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 721,
          name: 'Shatter Storm',
          description: 'Shatter skill 1 becomes an ammo skill.',
          icon: 'https://render.guildwars2.com/file/D5969DA633174AC5F52AB700F937A524E6E95DDE/1012513.png'
        },
        {
          id: 1869,
          name: 'Persistence of Memory',
          description: 'When a phantasm becomes a clone, it transfers its boons to you.',
          icon: 'https://render.guildwars2.com/file/F225A021EB41754E4E0C9FCB46F40F7212DA41CE/1012511.png'
        },
        {
          id: 691,
          name: 'The Pledge',
          description: 'Flame bursts from torch skills inflict additional burning.',
          icon: 'https://render.guildwars2.com/file/20D83E25D6A9D930AA01EB0D3ABAEAD6577B0762/1012512.png'
        }
      ],
      [
        {
          id: 722,
          name: 'Escape Artist',
          description: 'When a phantasm is created, grant it distortion.',
          icon: 'https://render.guildwars2.com/file/2C1BCA6C6F6763E90D0226BC2FD8DFA8403E9E47/1012510.png'
        },
        {
          id: 729,
          name: 'Phantasmal Haste',
          description: 'Phantasms spawn with quickness. Gain quickness when you create a phantasm.',
          icon: 'https://render.guildwars2.com/file/EE4D54D0D53E4B57C00F179BD97ED990230736DE/1012514.png'
        },
        {
          id: 1690,
          name: 'Maim the Disillusioned',
          description: 'Shatter skills inflict torment on hit.',
          icon: 'https://render.guildwars2.com/file/DBC6799E4A18BA9B9ABE280DAE35362DA9DAE00E/1012515.png'
        }
      ],
      [
        {
          id: 733,
          name: 'Phantasmal Force',
          description:
            'Phantasms deal increased strike damage for each stack of might you have. Gain might when your phantasms become clones.',
          icon: 'https://render.guildwars2.com/file/E002FB5DEC3A010F03F2E8A7D5000DF778215F6C/1012505.png'
        },
        {
          id: 2035,
          name: 'Master of Fragmentation',
          description: 'Your Shatter skills are improved.',
          icon: 'https://render.guildwars2.com/file/E625ADB94CF699763B23A7A82E255B55A44C1B16/1012517.png'
        },
        {
          id: 753,
          name: 'Malicious Sorcery',
          description:
            'Confusion you inflict has increased duration. When you dodge an attack, inflict confusion on your attacker.',
          icon: 'https://render.guildwars2.com/file/E1EFE39620B9A00D140A5C493ABB3180E2B2B511/1012518.png'
        }
      ]
    ]
  },
  {
    id: 40,
    name: 'Chronomancer',
    elite: true,
    icon: 'https://render.guildwars2.com/file/D9C960059A69F4DB6604DAD6AF06D0F940E76754/1012001.png',
    minorTraits: [
      {
        id: 2030,
        name: 'Time Splitter',
        description: 'Gain access to chronomancer shatter skills and Wells.',
        icon: 'https://render.guildwars2.com/file/5A9347250FEF7B3431ECE3F6689EDCE20FB96CB6/1012483.png'
      },
      {
        id: 1927,
        name: 'Flow of Time',
        description:
          'Gain alacrity for each clone you shatter. Gain increased critical-strike chance for you and your illusions when you have alacrity.',
        icon: 'https://render.guildwars2.com/file/54A00A0D36587A0245BD6400796CF130CE9970D7/1012484.png'
      },
      {
        id: 1859,
        name: 'Time Marches On',
        description: 'You move 25% faster. Alacrity applied to you is stronger.',
        icon: 'https://render.guildwars2.com/file/D343AA7E530448F37B20936FCD3163C9BF2CE665/1012485.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 1838,
          name: 'Delayed Reactions',
          description:
            'Disabling a foe slows them.\nDisables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.\nThis trait can only affect the same enemy with once per interval.',
          icon: 'https://render.guildwars2.com/file/C26CBECA553C29091F1D2C9B05732847E4C3457D/1012475.png'
        },
        {
          id: 1995,
          name: 'Time Catches Up',
          description:
            'Activating a Shatter gives your illusions superspeed. Shatters deal increased damage to movement-impaired foes.',
          icon: 'https://render.guildwars2.com/file/3836E04A5BF0E8CCB815A8C1627904AB0CE5EE6A/1012474.png'
        },
        {
          id: 1987,
          name: "All's Well That Ends Well",
          description: 'Wells heal allies when they end.',
          icon: 'https://render.guildwars2.com/file/46D30FCC070170B2F656C3D80005909CD8B0F3F4/1012476.png'
        }
      ],
      [
        {
          id: 2009,
          name: 'Danger Time',
          description:
            "When you inflict slow, you and your illusions' outgoing critical-strike damage is increased for a duration.",
          icon: 'https://render.guildwars2.com/file/E0A1FF012E170754030A0CB6DFDBAED3E81FAB5B/1012479.png'
        },
        {
          id: 1913,
          name: 'Illusionary Reversion',
          description: 'Shatter skills generate a clone and grant alacrity if you have enough clones present.',
          icon: 'https://render.guildwars2.com/file/4B684BD7490D52689D9CF02D205CB03811D7BA06/1012477.png'
        },
        {
          id: 1978,
          name: 'Time Bomb',
          description:
            'Enemies struck by Time Sink are affixed with a time bomb. Time bombs increase your strike damage dealt to the target and explode when they expire.\nOnly a certain number of time bombs may be active at once.',
          icon: 'https://render.guildwars2.com/file/C9BC67D77E3D959723393BF0EC9B212B53D8362D/1012478.png'
        }
      ],
      [
        {
          id: 1942,
          name: 'Stretched Time',
          description:
            'Nearby allies gain boons for each clone you shatter. Grant boons to nearby allies when you summon a phantasm.',
          icon: 'https://render.guildwars2.com/file/1B7FF14574B92E6FFA71D03E3F0FEBE5FD4D2EB2/1012480.png'
        },
        {
          id: 2022,
          name: 'Seize the Moment',
          description:
            'You and nearby allies gain quickness for each clone you shatter. Grant quickness to nearby allies when you summon a phantasm.',
          icon: 'https://render.guildwars2.com/file/0FF56A2B51F9C30CDA540CC41F0A1FA30CED74A0/1012482.png'
        },
        {
          id: 1890,
          name: 'Chronophantasma',
          description:
            "The first time a phantasm would become a clone, it instead resummons itself and attacks again. Resummoned phantasms inflict a percentage of the original's damage.\n(Resummoned phantasms are briefly dazed.)",
          icon: 'https://render.guildwars2.com/file/120E2199010315D0C1FACA9BBFB5DF9E5E47027F/1012481.png'
        }
      ]
    ]
  },
  {
    id: 59,
    name: 'Mirage',
    elite: true,
    icon: 'https://render.guildwars2.com/file/6403ECA8E6C1683E2C9D075A39C154ED3A7C04A1/1769891.png',
    minorTraits: [
      {
        id: 2150,
        name: 'Mirage Cloak',
        description:
          'Gain Mirage Cloak instead of dodge rolling. Ambush skills become available for a short time whenever you gain Mirage Cloak. Gain access to Deception skills.',
        icon: 'https://render.guildwars2.com/file/FAF3D0D195F36EBA2F11086A05A5BA75A6BDDDEC/1769960.png'
      },
      {
        id: 2069,
        name: "Nomad's Endurance",
        description: 'Shatter skills give vigor. Strike and condition damage dealt is increased when you have vigor.',
        icon: 'https://render.guildwars2.com/file/EC4E5BEAD50EC6A5A91C312EE521B7C6EC56393B/1769961.png'
      },
      {
        id: 2117,
        name: 'Speed of Sand',
        description: 'Mirage Cloak increases your movement speed.',
        icon: 'https://render.guildwars2.com/file/FFB70F3D954E5A60CE03132778D310CA4824E4BF/1769962.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2141,
          name: 'Self-Deception',
          description: 'Using a Deception skill will create a clone if you have any other clones active.',
          icon: 'https://render.guildwars2.com/file/603C30B0D0F90E21BCCC569AE8B5A35BC9E0BDBC/1769951.png'
        },
        {
          id: 2082,
          name: 'Renewing Oasis',
          description:
            'Gain regeneration when you gain Mirage Cloak. The duration of incoming damaging conditions is reduced while you are regenerating.',
          icon: 'https://render.guildwars2.com/file/7F0307D7130523A57E75DC19C9A3DC0CED0A6FB3/1769952.png'
        },
        {
          id: 2110,
          name: 'Riddle of Sand',
          description:
            'When entering combat, your first Ambush attack applies confusion. This ability refreshes when you use a Shatter skill.',
          icon: 'https://render.guildwars2.com/file/5E140DCE41A40CD852FA570E4250D825627F7708/1769953.png'
        }
      ],
      [
        {
          id: 2178,
          name: 'Desert Distortion',
          description:
            'Illusions shattered by Distortion become Mirage Mirrors. Ambush skills become available for a short time whenever you grant distortion to yourself.',
          icon: 'https://render.guildwars2.com/file/FD373803E32D2311701C1EEEBC06A3D19A060FEC/1769954.png'
        },
        {
          id: 2174,
          name: 'Mirage Mantle',
          description: 'Ambush skills you use grant boons to nearby allies.',
          icon: 'https://render.guildwars2.com/file/275DBDFD630099D49A76287DDD237709150C1D73/1769955.png'
        },
        {
          id: 2098,
          name: 'Phantom Pain',
          description: 'Gain a damage increase when you use a Shatter skill, increasing per clone shattered.',
          icon: 'https://render.guildwars2.com/file/3999015BF80BA211F8AD463C50BEBD0826DC1D12/1769956.png'
        }
      ],
      [
        {
          id: 2070,
          name: 'Infinite Horizon',
          description: 'When you gain Mirage Cloak, your illusions also gain it.',
          icon: 'https://render.guildwars2.com/file/AE970495F2A5F7907CDBB836B5079911FC5A1064/1769957.png'
        },
        {
          id: 2113,
          name: 'Elusive Mind',
          description: 'Lose conditions when you gain Mirage Cloak.',
          icon: 'https://render.guildwars2.com/file/75EDD136DA210F119A74C3D8DCE1AF0D58FB2F9F/1769958.png'
        },
        {
          id: 2169,
          name: 'Dune Cloak',
          description:
            'Shatter skills grant Mirage Cloak if you have enough clones present. Gaining Mirage Cloak recharges Mind Wrack and Cry of Frustration.',
          icon: 'https://render.guildwars2.com/file/5909B2013D16F1BF6F08B7BB341D295F4411DABA/1769959.png'
        }
      ]
    ]
  },
  {
    id: 66,
    name: 'Virtuoso',
    elite: true,
    icon: 'https://render.guildwars2.com/file/7B0F5E48320F35C0C6A2013ACF63F4C17B1105A5/2479303.png',
    minorTraits: [
      {
        id: 2216,
        name: 'Psychic Blades',
        description:
          'Whenever a clone would be summoned, you instead stock a blade. Blades persist indefinitely until used. Your shatters are replaced with Bladesongs that consume your stocked blades, but still count as shatters for the purposes of core traits.\n\nWhile out of combat, you will automatically stock a blade every 10 seconds.',
        icon: 'https://render.guildwars2.com/file/D25E3C479F24BE357015AA03C4B8B2EBCBC01B1E/2479335.png'
      },
      {
        id: 2204,
        name: 'Deadly Blades',
        description:
          'Blades inflict vulnerability on critical hits. After successfully casting a Bladesong, increase all damage dealt for a short time. This does not stack.',
        icon: 'https://render.guildwars2.com/file/C4AFBAAA039152A302C15B805CAD980EA9B5D006/2479337.png'
      },
      {
        id: 2193,
        name: 'Quiet Intensity',
        description: 'Fury gives an increased critical hit chance. Gain ferocity based on your vitality.',
        icon: 'https://render.guildwars2.com/file/34117EC942763960F40B372D5B07583D984C96D3/2479336.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2212,
          name: 'Bladeturn Refrain',
          description: 'Bladesongs grant aegis.',
          icon: 'https://render.guildwars2.com/file/72A0FCF7DE6E277E1160AA50F7C1E30BF2394CA0/2479326.png'
        },
        {
          id: 2208,
          name: 'Mental Focus',
          description: 'Strike damage is increased against foes within the range threshold.',
          icon: 'https://render.guildwars2.com/file/B32B3E90552D3AE773E403D6D7AA00F50F750580/2479328.png'
        },
        {
          id: 2202,
          name: 'Jagged Mind',
          description:
            'Blade attacks inflict bleeding on critical hits. A percentage of your condition damage dealt heals you.',
          icon: 'https://render.guildwars2.com/file/F3757C0FFD6F0912C2FD017E0E28E76137FA5F71/2479327.png'
        }
      ],
      [
        {
          id: 2215,
          name: "Duelist's Reversal",
          description: 'Blocking or dodging an attack grants boons.',
          icon: 'https://render.guildwars2.com/file/5A036270324AE4F246D2086C92B23AF4354978F0/2479329.png'
        },
        {
          id: 2205,
          name: 'Phantasmal Blades',
          description:
            'Phantasms that successfully complete their attack launch a blade at their target and grant you fury when they expire.',
          icon: 'https://render.guildwars2.com/file/D5A30DB7ABDDCDE5B8731A5FFF20E9780C9E42A2/2479330.png'
        },
        {
          id: 2207,
          name: 'Sharpening Sorrow',
          description: 'Gain fury when you activate Bladesong Sorrow. Fury increases your expertise.',
          icon: 'https://render.guildwars2.com/file/0409B10E0D9E42C80EABE235E94F500F45301551/2479331.png'
        }
      ],
      [
        {
          id: 2211,
          name: 'Psychic Riposte',
          description: 'Blocking or evading an attack stocks blades. Dodging stocks a blade.',
          icon: 'https://render.guildwars2.com/file/E89F2604C2E51F79E760F6DDB83E43E77078C13B/2479332.png'
        },
        {
          id: 2206,
          name: 'Infinite Forge',
          description:
            'Automatically stock blades while in combat. When you use a bladesong above the blade threshold, refund blades. Blade attacks deal more damage.',
          icon: 'https://render.guildwars2.com/file/DCEF7A9E2DA5E276D514B649F853CD67E3E7FBE4/2479333.png'
        },
        {
          id: 2223,
          name: 'Bloodsong',
          description:
            'Bleeding you apply deals increased damage. Stock a blade after applying enough stacks of bleeding to foes.',
          icon: 'https://render.guildwars2.com/file/D014E41E176D3B0B3B1168FF1A53DF6DE9D30D34/2479334.png'
        }
      ]
    ]
  },
  {
    id: 73,
    name: 'Troubadour',
    elite: true,
    icon: 'https://render.guildwars2.com/file/0FDD99E8B7A7FB4B06186C0756E02C0515520F75/3679899.png',
    minorTraits: [
      {
        id: 2386,
        name: 'Wandering Minstrel',
        description:
          'Build up notes instead of summoning clones. Shatters are replaced by Instrument skills, which consume notes to continue playing. Gain access to Tales.\n\nWhile out of combat, you will automatically generate a note every 10 seconds.',
        icon: 'https://render.guildwars2.com/file/20B247166125BF0E03E65372F7C5ECE23207A208/3679976.png'
      },
      {
        id: 2424,
        name: 'Symphonic Resonance',
        description: 'Instruments provide bonuses while playing in the background.',
        icon: 'https://render.guildwars2.com/file/AF276ECB07996BF5343A513FF2E52F3BE1CBAD0B/3679978.png'
      },
      {
        id: 2374,
        name: 'Harmonize',
        description: 'Gain a note when you use a phantasm skill.',
        icon: 'https://render.guildwars2.com/file/4BE6ED63233DEB2D5801D5D66BB202E202A6A27F/3679977.png'
      }
    ],
    majorTraits: [
      [
        {
          id: 2427,
          name: 'Mayhem',
          description: 'Flustering Flute now applies torment. Dodging reduces the recharge of Flustering Flute.',
          icon: 'https://render.guildwars2.com/file/A31842FADE40E64D553D230C0922E43D58495209/3679967.png'
        },
        {
          id: 2326,
          name: 'Raconteur',
          description: 'Tales heal and grant protection to nearby allies.',
          icon: 'https://render.guildwars2.com/file/77005B6DA7C4266CECE0BABD357E0F283D3E7F53/3679971.png'
        },
        {
          id: 2432,
          name: 'Syncopate',
          description:
            'Deafening Drum releases an additional quick wave after a delay. Deal damage to enemies you disable.',
          icon: 'https://render.guildwars2.com/file/42C9802D696B9670A0155DDF0FD2480CD9FBC473/3679969.png'
        }
      ],
      [
        {
          id: 2343,
          name: 'Shredding',
          description: "Lively Lute fires an additional wave at your enemy. The lute's damage bonus is increased.",
          icon: 'https://render.guildwars2.com/file/EF2D16FDF29BDCFEEC96503E0145BE1A9846F04C/3679970.png'
        },
        {
          id: 2367,
          name: 'Life of the Party',
          description: 'Lively Lute and Crescendo grant boons to affected allies.',
          icon: 'https://render.guildwars2.com/file/0D59A15F3F7F2671456A36C41A1737A94F050665/3679968.png'
        },
        {
          id: 2422,
          name: 'Love Song',
          description:
            "Harmonious Harp's distortion lasts longer. Strike damage from nearby enemies is reduced while the harp is playing in the background.",
          icon: 'https://render.guildwars2.com/file/1CC50D6BDDE64580522F0D396D194C020AC50DCE/3679972.png'
        }
      ],
      [
        {
          id: 2353,
          name: 'Fortissimo',
          description:
            'After using Crescendo, gain a note every interval for a duration. Gain increased attributes for each instrument you have playing.',
          icon: 'https://render.guildwars2.com/file/57A93CAD1CDC7A45BA3B3BEB1739BDC7765109D6/3679973.png'
        },
        {
          id: 2414,
          name: 'Call and Response',
          description:
            'When you use an instrument above the note threshold, create an afterimage that plays that instrument after a delay.',
          icon: 'https://render.guildwars2.com/file/1C96474AC3D5C74E05B724E8FF9DF9FC0ADCAFC2/3679974.png'
        },
        {
          id: 2441,
          name: 'Altered Chord',
          description:
            "Crescendo prompts your last-played instrument to take the spotlight, augmenting Crescendo's effects. Playing an instrument recharges Crescendo if a note was consumed.",
          icon: 'https://render.guildwars2.com/file/57FB13067F3039331F0C03A63B0D07242F0C72C4/3679975.png'
        }
      ]
    ]
  }
];
