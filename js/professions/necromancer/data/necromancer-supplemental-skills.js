// Stable-ID skills omitted from the /v2/professions/Necromancer payload.
// Metadata is kept separate from simulator timing and mechanical overrides.

const skill = ({
  id,
  name,
  description,
  icon,
  slot,
  recharge = 0,
  nextChainId = null,
  flipSkillId = null,
  specialization = "",
  categories = [],
  type = "Profession",
}) => ({
  id,
  name,
  description,
  icon,
  type,
  weapon: "",
  slot,
  specialization,
  categories,
  flags: ["NoUnderwater"],
  facts: [],
  recharge,
  ammo: 0,
  ammoRecharge: 0,
  nextChainId,
  flipSkillId,
  modeAliasIds: [],
  apiDamage: [],
  apiConditions: [],
});

export const NECROMANCER_SUPPLEMENTAL_SKILLS = Object.freeze([
  skill({
    id: 10600,
    name: "Necrotic Traversal",
    description:
      "Sacrifice your flesh wurm, teleport to it, and poison nearby foes.",
    icon:
      "https://render.guildwars2.com/file/BBAA911903B9E640DD6D02B14A6F6D58F2ADFE0C/103308.png",
    type: "Utility",
    slot: "Utility",
    categories: ["Minion"],
  }),
  skill({
    id: 10604,
    name: "Dark Path",
    description:
      "Shroud. Send out a claw that damages, bleeds, and chills the target.",
    icon:
      "https://render.guildwars2.com/file/10773D150F72F5BEF252D06EB7DC2C040A5202A3/2175061.png",
    slot: "Weapon_2",
    recharge: 8,
    flipSkillId: 56916,
  }),
  skill({
    id: 56916,
    name: "Dark Pursuit",
    description: "Shadowstep to the foe marked by Dark Path.",
    icon:
      "https://render.guildwars2.com/file/1063CD31245E30A20662042B5EB7375C9CCAF5A5/2175062.png",
    slot: "Weapon_2",
  }),
  skill({
    id: 10588,
    name: "Doom",
    description: "Shroud. Damage and fear your target.",
    icon:
      "https://render.guildwars2.com/file/6CAB0D17DF604E5C6330523A350EC4430409A309/103818.png",
    slot: "Weapon_3",
    recharge: 20,
  }),
  skill({
    id: 10594,
    name: "Life Transfer",
    description:
      "Shroud. Channel damage around you and gain life force per strike.",
    icon:
      "https://render.guildwars2.com/file/579400360B6E0C9D699B5D6D0AC9F2184CC707F8/103820.png",
    slot: "Weapon_4",
    recharge: 20,
  }),
  skill({
    id: 19504,
    name: "Tainted Shackles",
    description:
      "Shroud. Bind nearby enemies, pulsing torment before the binding strikes.",
    icon:
      "https://render.guildwars2.com/file/CBEB3C180F343DC0CBA9BD5A3E09642C1D73599C/598947.png",
    slot: "Weapon_5",
    recharge: 25,
  }),

  skill({
    id: 10634,
    name: "Deathly Claws",
    description: "Lich Form. Send grasping claws through your foes.",
    icon:
      "https://render.guildwars2.com/file/0232367CBDA026CD9B00B5E97D312F2CF2E0551F/103836.png",
    slot: "Weapon_1",
    categories: ["Lich"],
  }),
  skill({
    id: 10635,
    name: "Lich's Gaze",
    description:
      "Lich Form. Fire an unblockable projectile that chills and corrupts boons.",
    icon:
      "https://render.guildwars2.com/file/0E5873900C7F43F3DFC394494D0AD90959CECA22/1770531.png",
    slot: "Weapon_2",
    recharge: 8,
    categories: ["Lich"],
  }),
  skill({
    id: 10633,
    name: "Ripple of Horror",
    description:
      "Lich Form. Launch a damaging wave that fears foes it crosses.",
    icon:
      "https://render.guildwars2.com/file/3D4622D7D8C6163E9FE4FBD50E01ED215AD0EE2B/1770530.png",
    slot: "Weapon_3",
    recharge: 15,
    flipSkillId: 45780,
    categories: ["Lich"],
  }),
  skill({
    id: 45780,
    name: "March of Undeath",
    description: "Lich Form. Shadowstep to your Ripple of Horror.",
    icon:
      "https://render.guildwars2.com/file/6728BBF7042B554E3D3996C1721501FF16E4F661/1770529.png",
    slot: "Weapon_3",
    recharge: 12,
    categories: ["Lich"],
  }),
  skill({
    id: 10636,
    name: "Summon Madness",
    description:
      "Lich Form. Repeatedly summon unstable horrors that attack and explode.",
    icon:
      "https://render.guildwars2.com/file/590CC70C1003DC0F3C6498E8BED4FF0765CA1E72/103716.png",
    slot: "Weapon_4",
    recharge: 30,
    categories: ["Lich", "Minion"],
  }),
  skill({
    id: 10632,
    name: "Grim Specter",
    description: "Lich Form. Siphon life from nearby enemies over time.",
    icon:
      "https://render.guildwars2.com/file/A6CAF2146D9DF2EBEFD9285CB0E9E3617A659071/1770528.png",
    slot: "Weapon_5",
    recharge: 30,
    categories: ["Lich"],
  }),

  skill({
    id: 77003,
    name: "Innervate Anguish",
    description:
      "Channel your Spirit of Anguish to damage nearby enemies.",
    icon:
      "https://render.guildwars2.com/file/557413F742FCA13D9A5C08C814F21CA6BCE2626F/3680171.png",
    slot: "Profession_2",
    recharge: 10,
    specialization: "Ritualist",
    categories: ["Innervate", "Spirit"],
  }),
  skill({
    id: 76732,
    name: "Innervate Wanderlust",
    description:
      "Channel your Spirit of Wanderlust to fear nearby enemies.",
    icon:
      "https://render.guildwars2.com/file/CDFE1DF19F0D660091BB935E181745BA0DB6CB47/3680179.png",
    slot: "Profession_3",
    recharge: 15,
    specialization: "Ritualist",
    categories: ["Innervate", "Spirit"],
  }),
  skill({
    id: 76602,
    name: "Innervate Preservation",
    description:
      "Channel your Spirit of Preservation and gain life force.",
    icon:
      "https://render.guildwars2.com/file/0BF19E58712ACF097D0532FB56DBFDB580E3C5BF/3680174.png",
    slot: "Profession_4",
    recharge: 25,
    specialization: "Ritualist",
    categories: ["Innervate", "Spirit"],
  }),
]);
