import { SKILLS } from "../data/engineer-api-metadata.js";
import {
  ENGINEER_SUPPLEMENTAL_SKILLS,
} from "../data/engineer-supplemental-skills.js";
import {
  ENGINEER_WIKI_RESEARCH_BY_ID,
  engineerMechanicsFromResearch,
} from "./wiki-mechanics.js";

function fallbackMechanics(skill) {
  return {
    implemented: true,
    castTimeMs: 0,
    cooldown: Math.max(
      0,
      Number(skill.ammo > 0 ? skill.ammoRecharge : skill.recharge) || 0,
    ),
    ammo: Math.max(0, Number(skill.ammo || 0)),
    rechargeAnchor: "castEnd",
    timingConfidence: "estimated",
    sourceUrl: "",
    sourceRevisionId: null,
    sourceRevisionDate: "2026-07-28",
    pveMode: true,
    effects: [],
  };
}

const allSkills = [...SKILLS, ...ENGINEER_SUPPLEMENTAL_SKILLS];

export const ENGINEER_SKILL_MECHANICS = Object.freeze(
  Object.fromEntries(allSkills.map(skill => {
    const research = ENGINEER_WIKI_RESEARCH_BY_ID.get(skill.id);
    const mechanics = research
      ? engineerMechanicsFromResearch(research)
      : fallbackMechanics(skill);
    return [
      skill.id,
      Object.freeze({
        ...mechanics,
        ammo: Math.max(
          Number(mechanics.ammo || 0),
          Number(skill.ammo || 0),
        ),
      }),
    ];
  })),
);

export const ENGINEER_IMPLEMENTED_SKILL_IDS = Object.freeze(
  Object.keys(ENGINEER_SKILL_MECHANICS).map(Number),
);

export const ENGINEER_EXTRA_SKILLS = Object.freeze([
  Object.freeze({
    id: -3,
    name: "Swap Weapons",
    description:
      "Engineer cannot swap equipped weapon sets during combat.",
    icon: "https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png",
    type: "Action",
    slot: "Action",
    castTimeMs: 50,
    quicknessCastTimeMs: 50,
    cooldown: 10,
    rechargeAnchor: "castStart",
    implemented: true,
    effects: [],
  }),
]);
