import { professionCoreState } from "../../../../platform/engine/profession.js";
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
import {
  gw2AlliedEffectRecipients,
  gw2AlliedPlayerProcTimeline,
} from "../../../../platform/gw2/allied-players.js";
import { RITUALIST_MECHANICS as MECHANICS } from "./mechanics.js";
import { hasTrait } from "../../core/shared.js";
import type {
  NecromancerCastContext,
  NecromancerCoreState,
  NecromancerSkill,
} from "../../types.js";

interface WeaponSpellDefinition {
  readonly duration: number;
  readonly playerStacks: number;
  readonly allyStacks: number;
  readonly maxAllies: number;
  readonly internalCooldown?: number;
}

const SPELL_BY_SKILL_ID: Readonly<Record<string | number, string>> =
  Object.freeze({
    [ID.NIGHTMARE_WEAPON]: "nightmare",
    [ID.SPLINTER_WEAPON]: "splinter",
    [ID.RESILIENT_WEAPON]: "resilient",
  });

function activeMinionRecipients(state: NecromancerCoreState): string[] {
  const recipients: string[] = [];
  for (const [key, count] of Object.entries(state.activeMinions || {})) {
    for (let index = 0; index < Number(count || 0); index += 1) {
      recipients.push(`minion:${key}:${index}`);
    }
  }
  return recipients;
}

function applyWeaponSpell(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): boolean {
  const spell = SPELL_BY_SKILL_ID[skill.id];
  const definition = (
    MECHANICS.weaponSpells as Readonly<Record<string, WeaponSpellDefinition>>
  )[spell];
  if (!definition) return false;
  // Wielder's Boon grants allies the same stack count as the player instead of the reduced ally default
  const fullAlliedBenefit = hasTrait(context, TRAIT.WIELDERS_BOON);
  const allyStacks = fullAlliedBenefit
    ? definition.playerStacks
    : definition.allyStacks;
  const party = gw2AlliedEffectRecipients(context.config, {
    maximumRecipients: definition.maxAllies + 1,
    companionIds: activeMinionRecipients(professionCoreState(context)),
  });
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
    recipients: party.companionIds,
    alliedPlayerCount: party.alliedPlayerCount,
    recipientCount: party.recipientCount,
    alliesReceiveFullBenefit: fullAlliedBenefit,
  });
  if (spell === "nightmare" || spell === "splinter") {
    // Resilient Weapon has no damage component, so ally proc timeline is only needed for damaging spells
    const alliedProcs = gw2AlliedPlayerProcTimeline(context.config, {
      start: context.effectiveEnd,
      duration: definition.duration,
      maximumAllies: party.alliedPlayerCount,
      maximumPerAlly: allyStacks,
      internalCooldown: definition.internalCooldown,
    });
    for (let index = 0; index < alliedProcs.length; index += 1) {
      const proc = alliedProcs[index];
      context.emit({
        type: "necromancer.weapon-spell-ally-trigger",
        at: proc.at,
        source: "necromancer",
        sourceId: skill.id,
        actorType: "effect",
        skillId: skill.id,
        skillName: skill.name,
        name: `${skill.name} — Ally ${proc.allyIndex} Trigger`,
        spell,
        triggeredByAlly: proc.allyIndex,
        procIndex: proc.procIndex,
      });
    }
  }
  return true;
}

export const necromancerWeaponSpellSkillHandlers = Object.freeze({
  "necromancer.weapon-spell": applyWeaponSpell,
});
