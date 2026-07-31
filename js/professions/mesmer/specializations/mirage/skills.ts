/**
 * Raw Mirage skill mechanics. Generated once from the characterized
 * pre-migration table; this file is now the runtime source owner.
 */
import { MESMER_SKILL_IDS as ID } from "../../data/ids.js";
import type {
  Skill,
  SkillFragment,
  SkillId,
} from "../../../../platform/engine/types.js";
import type { MesmerSkill } from "../../types.js";

export const MESMER_MIRAGE_SKILL_MECHANICS: Readonly<
  Record<SkillId, SkillFragment>
> = Object.freeze({
  [ID.FALSE_OASIS]: {
    "implemented": true,
    "type": "Heal",
    "weapon": "",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 1440,
    "cooldown": 25,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/False_Oasis",
    "effects": []
  },
  [ID.CRYSTAL_SANDS]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 600,
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Crystal_Sands",
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.4,
        "hits": 6,
        "name": "Damage",
        "actorType": "player",
        "weapon": "utility"
      },
      {
        "type": "condition",
        "condition": "confusion",
        "duration": 4,
        "stacks": 1
      }
    ]
  },
  [ID.MIRAGE_ADVANCE]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 500,
    "cooldown": 25,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mirage_Advance",
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "utility"
      }
    ]
  },
  [ID.SAND_THROUGH_GLASS]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Sand_through_Glass",
    "effects": []
  },
  [ID.ILLUSIONARY_AMBUSH]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Illusionary_Ambush",
    "effects": []
  },
  [ID.JAUNT]: {
    "implemented": true,
    "type": "Elite",
    "weapon": "",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 0.5,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Jaunt",
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "utility"
      },
      {
        "type": "condition",
        "condition": "confusion",
        "duration": 6,
        "stacks": 3
      }
    ]
  }
});

export const MESMER_MIRAGE_SUPPLEMENTAL_SKILL_MECHANICS: Readonly<
  Record<SkillId, SkillFragment>
> = Object.freeze({
  [ID.CHAOS_VORTEX]: {
    "castTimeMs": 1000,
    "quicknessCastTimeMs": 666.666666667,
    "cooldown": 1,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "ambush": true,
    "implemented": true,
    "effects": []
  },
  [ID.ETHER_BARRAGE]: {
    "castTimeMs": 1500,
    "cooldown": 1,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "ambush": true,
    "implemented": true,
    "effects": []
  },
  [ID.SPLIT_SURGE]: {
    "castTimeMs": 1500,
    "quicknessCastTimeMs": 940,
    "cooldown": 0.5,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "ambush": true,
    "implemented": true,
    "effects": []
  },
  [ID.IMAGINARY_AXES]: {
    "castTimeMs": 780,
    "cooldown": 1,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "ambush": true,
    "implemented": true,
    "effects": []
  },
  [ID.MIRAGE_THRUST]: {
    "castTimeMs": 750,
    "quicknessCastTimeMs": 500,
    "cooldown": 1,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "ambush": true,
    "implemented": true,
    "effects": []
  },
  [ID.PHANTOM_RAZOR]: {
    "castTimeMs": 900,
    "quicknessCastTimeMs": 600,
    "cooldown": 1,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "ambush": true,
    "implemented": true,
    "effects": []
  },
  [ID.EFFERVESCENCE]: {
    "castTimeMs": 250,
    "quicknessCastTimeMs": 166.666666667,
    "cooldown": 1,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "ambush": true,
    "implemented": true,
    "effects": []
  },
  [ID.FRACTURED_GLASS]: {
    "castTimeMs": 1000,
    "quicknessCastTimeMs": 880,
    "cooldown": 1,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "ambush": true,
    "implemented": true,
    "effects": []
  }
});

export const MESMER_MIRAGE_EXTRA_SKILLS: readonly Skill[] = Object.freeze(
  [
  {
    "id": ID.DODGE_MIRAGE_CLOAK,
    "name": "Dodge / Mirage Cloak",
    "description": "Spend 50 endurance. Mirage gains Mirage Cloak and an ambush window; Infinite Horizon commands active clones to ambush.",
    "icon": "https://wiki.guildwars2.com/images/b/b2/Dodge.png",
    "type": "Action",
    "slot": "Action",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 10,
    "ammo": 2,
    "implemented": true,
    "effects": []
  }
] satisfies readonly MesmerSkill[],
);
