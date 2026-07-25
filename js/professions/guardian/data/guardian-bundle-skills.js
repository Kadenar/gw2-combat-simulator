// Guardian bundle skills are not discoverable through /v2/professions/Guardian.
// Keep this supplement beside the generated API snapshot so tome and forge
// mechanics remain reproducible when the generated catalog is refreshed.

const tomeIcon = Object.freeze({
  justice:
    "https://render.guildwars2.com/file/0A1A7614641DADEB09DF25E12BF4A8CA54A8EFF3/2779163.png",
  resolve:
    "https://render.guildwars2.com/file/CA747F315578704ED2ED9CB76E48083828CE730C/2779164.png",
  courage:
    "https://render.guildwars2.com/file/BB01170AD5B630DFBB6BEF79664B35D71DDDF299/2779162.png",
});

function bundleSkill({
  id,
  name,
  description,
  icon,
  slot,
  specialization,
  recharge = 0,
  flipSkillId = null,
  apiDamage = [],
  apiConditions = [],
  ...metadata
}) {
  return Object.freeze({
    id,
    name,
    description,
    icon,
    type: "Bundle",
    weapon: "",
    slot,
    specialization,
    categories: [],
    recharge,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId,
    apiDamage,
    apiConditions,
    ...metadata,
  });
}

function tomeSkill({
  tome,
  pageCost = 1,
  ...skill
}) {
  return bundleSkill({
    ...skill,
    icon: tomeIcon[tome],
    specialization: "Firebrand",
    tome,
    pageCost,
  });
}

const damage = (coefficient, hits = 1, text = "Damage") => ({
  coefficient,
  coefficientPerHit: coefficient / hits,
  hits,
  text,
});

const condition = (conditionName, stacks, duration) => ({
  condition: conditionName,
  stacks,
  duration,
  text: "Apply Buff/Condition",
});

export const GUARDIAN_BUNDLE_SKILLS = Object.freeze([
  tomeSkill({
    id: 41258,
    name: "Chapter 1: Searing Spell",
    description:
      "Tome. Incite a swelling of heat, damaging and burning foes in front of you.",
    slot: "Weapon_1",
    tome: "justice",
    apiDamage: [damage(0.95)],
    apiConditions: [condition("Burning", 1, 2.5)],
  }),
  tomeSkill({
    id: 40635,
    name: "Chapter 2: Igniting Burst",
    description:
      "Tome. Ignite nearby foes and weaken them.",
    slot: "Weapon_2",
    tome: "justice",
    recharge: 8,
    apiDamage: [damage(0.55)],
    apiConditions: [condition("Burning", 1, 10)],
  }),
  tomeSkill({
    id: 42449,
    name: "Chapter 3: Heated Rebuke",
    description:
      "Tome. Pull nearby enemies toward you with a heated rebuke.",
    slot: "Weapon_3",
    tome: "justice",
    recharge: 10,
    apiDamage: [damage(0.45)],
  }),
  tomeSkill({
    id: 40015,
    name: "Chapter 4: Scorched Aftermath",
    description:
      "Tome. Create a pulsing fire field that burns and bleeds enemies.",
    slot: "Weapon_4",
    tome: "justice",
    recharge: 15,
    apiDamage: [damage(3.2, 5)],
  }),
  tomeSkill({
    id: 42898,
    name: "Epilogue: Ashes of the Just",
    description:
      "Tome. Your next attacks inflict burning on their targets.",
    slot: "Weapon_5",
    tome: "justice",
    recharge: 20,
  }),

  tomeSkill({
    id: 45022,
    name: "Chapter 1: Desert Bloom",
    description:
      "Tome. Heal allies in a cone in front of you.",
    slot: "Weapon_1",
    tome: "resolve",
  }),
  tomeSkill({
    id: 40679,
    name: "Chapter 2: Radiant Recovery",
    description:
      "Tome. Remove conditions from nearby allies and heal for each removal.",
    slot: "Weapon_2",
    tome: "resolve",
    recharge: 4,
  }),
  tomeSkill({
    id: 45128,
    name: "Chapter 3: Azure Sun",
    description:
      "Tome. Heal allies and grant vigor, regeneration, and swiftness.",
    slot: "Weapon_3",
    tome: "resolve",
    recharge: 8,
  }),
  tomeSkill({
    id: 42008,
    name: "Chapter 4: Shining River",
    description:
      "Tome. Create a healing field that grants regeneration.",
    slot: "Weapon_4",
    tome: "resolve",
    recharge: 10,
  }),
  tomeSkill({
    id: 42925,
    name: "Epilogue: Eternal Oasis",
    description:
      "Tome. Convert conditions to boons and increase incoming healing.",
    slot: "Weapon_5",
    tome: "resolve",
    recharge: 20,
    pageCost: 2,
  }),

  tomeSkill({
    id: 42986,
    name: "Chapter 1: Unflinching Charge",
    description:
      "Tome. Grant swiftness and protection to nearby allies.",
    slot: "Weapon_1",
    tome: "courage",
  }),
  tomeSkill({
    id: 41968,
    name: "Chapter 2: Daring Challenge",
    description:
      "Tome. Taunt nearby enemies and grant resolution to allies.",
    slot: "Weapon_2",
    tome: "courage",
    recharge: 4,
    apiDamage: [damage(1.4)],
  }),
  tomeSkill({
    id: 41836,
    name: "Chapter 3: Valiant Bulwark",
    description:
      "Tome. Create a reflective barrier at the target area.",
    slot: "Weapon_3",
    tome: "courage",
    recharge: 8,
  }),
  tomeSkill({
    id: 40988,
    name: "Chapter 4: Stalwart Stand",
    description:
      "Tome. Create a light field that grants resistance and breaks stun.",
    slot: "Weapon_4",
    tome: "courage",
    recharge: 10,
  }),
  tomeSkill({
    id: 44455,
    name: "Epilogue: Unbroken Lines",
    description:
      "Tome. Grant protection, stability, aegis, and toughness to allies.",
    slot: "Weapon_5",
    tome: "courage",
    recharge: 12,
    pageCost: 2,
  }),

  bundleSkill({
    id: 76982,
    name: "Glaring Burst",
    description:
      "Create a burst whose effect changes with the equipped radiant weapon.",
    icon:
      "https://render.guildwars2.com/file/7E68406FAAC4FFF878CDD307B257C9D6AECE2935/3680152.png",
    slot: "Weapon_1",
    specialization: "Luminary",
    radiantForgeSkill: true,
    apiDamage: [damage(1)],
  }),
  bundleSkill({
    id: 77339,
    name: "Dazzling Hammer",
    description:
      "Smash the ground with a radiant hammer, dazing nearby foes.",
    icon:
      "https://render.guildwars2.com/file/4ECA0C916F5D54C3C12AC135AB5A1E2D4BC792E5/3680142.png",
    slot: "Weapon_2",
    specialization: "Luminary",
    recharge: 7,
    flipSkillId: 76910,
    radiantForgeSkill: true,
    radiantWeapon: "hammer",
    apiDamage: [damage(1.2)],
  }),
  bundleSkill({
    id: 76910,
    name: "Shining Spin",
    description:
      "Strike nearby foes, dealing increased damage to disabled enemies.",
    icon:
      "https://render.guildwars2.com/file/2E5878CE9AFA2634D7F6DBAB10389D20C1BFF75E/3680143.png",
    slot: "Weapon_2",
    specialization: "Luminary",
    radiantForgeSkill: true,
    radiantWeapon: "hammer",
    apiDamage: [damage(1.25)],
  }),
  bundleSkill({
    id: 76708,
    name: "Luminous Staff",
    description:
      "Slam a radiant staff into the ground and create a symbol.",
    icon:
      "https://render.guildwars2.com/file/06BD9362B2F9FAE403181D0F9BE96A12664C22CA/3680148.png",
    slot: "Weapon_3",
    specialization: "Luminary",
    recharge: 15,
    flipSkillId: 77136,
    radiantForgeSkill: true,
    radiantWeapon: "staff",
    apiDamage: [damage(1.2, 4, "Symbol Damage")],
  }),
  bundleSkill({
    id: 77136,
    name: "Restorative Glow",
    description:
      "Heal and remove conditions from nearby allies.",
    icon:
      "https://render.guildwars2.com/file/9B72587791FE50B415B94BE92AA9050F43F6A848/3680149.png",
    slot: "Weapon_3",
    specialization: "Luminary",
    radiantForgeSkill: true,
    radiantWeapon: "staff",
  }),
  bundleSkill({
    id: 76924,
    name: "Gleaming Blade",
    description:
      "Leap to the target and slash, inflicting cripple and vulnerability.",
    icon:
      "https://render.guildwars2.com/file/79B0DCC5E4A0A8BBE04AC0024D01A0F36D0B0C79/3680151.png",
    slot: "Weapon_4",
    specialization: "Luminary",
    recharge: 15,
    flipSkillId: 77366,
    radiantForgeSkill: true,
    radiantWeapon: "blade",
    apiDamage: [damage(1.5)],
  }),
  bundleSkill({
    id: 77366,
    name: "Lucent Thrust",
    description:
      "Stab your foe and launch a blinding ray that bounces between foes.",
    icon:
      "https://render.guildwars2.com/file/1967D3BD670E976B0B554AAE3C0E070E0BF672D8/3680150.png",
    slot: "Weapon_4",
    specialization: "Luminary",
    radiantForgeSkill: true,
    radiantWeapon: "blade",
    apiDamage: [damage(1), damage(0.8, 1, "Projectile Damage")],
  }),
  bundleSkill({
    id: 77197,
    name: "Radiant Bulwark",
    description:
      "Block attacks and grant aegis to nearby allies.",
    icon:
      "https://render.guildwars2.com/file/06735858B4DE086359A7DB1D4B2B650F97D7DD03/3680144.png",
    slot: "Weapon_5",
    specialization: "Luminary",
    recharge: 25,
    flipSkillId: 76978,
    radiantForgeSkill: true,
    radiantWeapon: "bulwark",
  }),
  bundleSkill({
    id: 76978,
    name: "Brilliant Slam",
    description:
      "Slam foes with your shield, dazing them.",
    icon:
      "https://render.guildwars2.com/file/BAD4D149039913DCF7FA724D4BFE9C9EB17E68D5/3680145.png",
    slot: "Weapon_5",
    specialization: "Luminary",
    radiantForgeSkill: true,
    radiantWeapon: "bulwark",
    apiDamage: [damage(1.2)],
  }),

  bundleSkill({
    id: 30083,
    name: "Wings of Resolve",
    description:
      "Virtue. Dart forward and heal allies near your destination.",
    icon:
      "https://render.guildwars2.com/file/A054A5300BF26FBAA601611BDA07B6001830FF92/1012864.png",
    type: "Profession",
    slot: "Profession_2",
    specialization: "Dragonhunter",
    recharge: 25,
    categories: ["Virtue"],
  }),
  bundleSkill({
    id: 30029,
    name: "Shield of Courage",
    description:
      "Virtue. Grant aegis and block attacks in front of you.",
    icon:
      "https://render.guildwars2.com/file/09DE3F47930AFF2B2B3F4C20A401DCA9DC7344CC/1012865.png",
    type: "Profession",
    slot: "Profession_3",
    specialization: "Dragonhunter",
    recharge: 45,
    categories: ["Virtue"],
  }),
]);
