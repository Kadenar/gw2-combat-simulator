import { SKILLS } from "../data/thief-api-metadata.js";
import {
  THIEF_SUPPLEMENTAL_SKILLS,
} from "../data/thief-supplemental-skills.js";
import {
  THIEF_WIKI_RESEARCH_BY_ID,
  thiefMechanicsFromResearch,
} from "./wiki-mechanics.js";

function fallback(skill) {
  return {
    implemented: true,
    castTimeMs: 0,
    cooldown: Math.max(
      0,
      Number(skill.ammo > 0 ? skill.ammoRecharge : skill.recharge) || 0,
    ),
    ammo: Math.max(0, Number(skill.ammo || 0)),
    initiativeCost: 0,
    rechargeAnchor: "castEnd",
    timingConfidence: "estimated",
    sourceUrl: "",
    sourceRevisionId: null,
    sourceRevisionDate: "2026-07-28",
    pveMode: true,
    effects: [],
  };
}
const all = [...SKILLS, ...THIEF_SUPPLEMENTAL_SKILLS];
export const THIEF_SKILL_MECHANICS = Object.freeze(
  Object.fromEntries(all.map(skill => {
    const record = THIEF_WIKI_RESEARCH_BY_ID.get(skill.id);
    const mechanics = record ? thiefMechanicsFromResearch(record) : fallback(skill);
    return [skill.id, Object.freeze({
      ...mechanics,
      ammo: Math.max(Number(mechanics.ammo || 0), Number(skill.ammo || 0)),
    })];
  })),
);
export const THIEF_EXTRA_SKILLS = Object.freeze([
  {
    id: -3,
    name: "Swap Weapons",
    description: "Swap equipped weapon sets.",
    icon: "https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png",
    type: "Action",
    slot: "Action",
    castTimeMs: 50,
    quicknessCastTimeMs: 50,
    cooldown: 10,
    rechargeAnchor: "castStart",
    implemented: true,
    effects: [],
  },
  {
    id: -5,
    name: "Dodge",
    description: "Perform the selected thief dodge.",
    icon: "",
    type: "Action",
    slot: "Action",
    castTimeMs: 800,
    cooldown: 0,
    implemented: true,
    effects: [],
  },
]);
