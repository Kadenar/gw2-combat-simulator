import {
  createCanonicalCatalog,
} from "../../platform/engine/catalog.js";

export const GUARDIAN_SKILL_IDS = Object.freeze({
  STRIKE: 910001,
  JUSTICE: 910002,
  SWAP_WEAPONS: 910003,
});

export const guardianCatalog = createCanonicalCatalog({
  generated: [
    {
      id: GUARDIAN_SKILL_IDS.STRIKE,
      name: "True Strike",
      type: "Weapon",
      weapon: "Sword",
      slot: "Weapon_1",
      castTimeMs: 500,
      effects: [{ type: "strike", coefficient: 0.8, hits: 1 }],
    },
    {
      id: GUARDIAN_SKILL_IDS.JUSTICE,
      name: "Virtue of Justice",
      type: "Profession",
      slot: "Profession_1",
      castTimeMs: 0,
      cooldown: 20,
      handlerId: "guardian.justice",
      effects: [{
        type: "custom",
        eventType: "guardian.justice-activated",
        event: {},
      }],
    },
    {
      id: GUARDIAN_SKILL_IDS.SWAP_WEAPONS,
      name: "Swap Weapons",
      type: "Action",
      slot: "Action",
      castTimeMs: 0,
      cooldown: 10,
      handlerId: "guardian.weapon-swap",
      effects: [],
    },
  ],
  handlerIds: ["guardian.justice", "guardian.weapon-swap"],
  weapons: ["Sword", "Mace", "Hammer", "Longbow"],
});
