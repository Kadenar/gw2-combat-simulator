/**
 * Ritualist weapon-spell applications.
 *
 * The resolver consumes the emitted application event and spends the player's
 * or affected summon's stacks on eligible strikes. Resilient Weapon is kept as
 * a real heal-slot application even though healing and incoming-damage
 * reduction are outside the damage simulator.
 */
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { NECROMANCER_HANDLER_MECHANICS as MECHANICS } from "../handler-mechanics.js";
import { hasTrait } from "./shared.js";

const SPELL_BY_SKILL_ID = Object.freeze({
  [ID.NIGHTMARE_WEAPON]: "nightmare",
  [ID.SPLINTER_WEAPON]: "splinter",
  [ID.RESILIENT_WEAPON]: "resilient",
});

function activeSummonRecipients(state) {
  const recipients = [];
  for (const [key, count] of Object.entries(state.activeMinions || {})) {
    for (let index = 0; index < Number(count || 0); index += 1) {
      recipients.push(`minion:${key}:${index}`);
    }
  }
  for (const key of Object.keys(state.activeSpirits || {})) {
    recipients.push(`spirit:${key}`);
  }
  return recipients;
}

function applyWeaponSpell(context, skill) {
  const spell = SPELL_BY_SKILL_ID[skill.id];
  const definition = MECHANICS.weaponSpells[spell];
  if (!definition) return false;
  const fullAlliedBenefit = hasTrait(context, TRAIT.WIELDERS_BOON);
  const allyStacks = fullAlliedBenefit
    ? definition.playerStacks
    : definition.allyStacks;
  const recipients = activeSummonRecipients(context.state.profession)
    .slice(0, definition.maxAllies);
  context.emit({
    type: "necromancer.weapon-spell",
    at: context.effectiveEnd,
    source: "necromancer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: skill.name,
    spell,
    duration: definition.duration,
    playerStacks: definition.playerStacks,
    allyStacks,
    maxAllies: definition.maxAllies,
    recipients,
    alliesReceiveFullBenefit: fullAlliedBenefit,
  });
  return true;
}

export const necromancerWeaponSpellSkillHandlers = Object.freeze({
  "necromancer.weapon-spell": applyWeaponSpell,
});
