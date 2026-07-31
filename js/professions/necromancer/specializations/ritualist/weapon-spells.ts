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
import { RITUALIST_MECHANICS as MECHANICS } from "./mechanics.js";
import { hasTrait } from "../../core/shared.js";
import type {
  NecromancerCastContext,
  NecromancerSkill,
  NecromancerState,
} from "../../types.js";

interface WeaponSpellDefinition {
  readonly duration: number;
  readonly playerStacks: number;
  readonly allyStacks: number;
  readonly maxAllies: number;
}

const SPELL_BY_SKILL_ID: Readonly<Record<string | number, string>> =
Object.freeze({
  [ID.NIGHTMARE_WEAPON]: "nightmare",
  [ID.SPLINTER_WEAPON]: "splinter",
  [ID.RESILIENT_WEAPON]: "resilient",
});

function activeSummonRecipients(state: NecromancerState): string[] {
  const recipients: string[] = [];
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

function applyWeaponSpell(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): boolean {
  const spell = SPELL_BY_SKILL_ID[skill.id];
  const definition = (
    MECHANICS.weaponSpells as Readonly<
      Record<string, WeaponSpellDefinition>
    >
  )[spell];
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
