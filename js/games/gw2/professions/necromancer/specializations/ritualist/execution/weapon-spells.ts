/**
 * Owns Ritualist weapon-spell application behavior and modeled allied-player proc scheduling.
 * Declarative weapon-spell fragments remain in `skills/index.ts`.
 */
import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { gw2AlliedEffectRecipients, gw2AlliedPlayerProcTimeline } from '#gw2/platform/combat/state/allied-players.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { necromancerActiveMinionCompanionIds } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import type { NecromancerCastContext, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

const SPELL_BY_SKILL_ID: Readonly<Record<string | number, string>> = Object.freeze({
  [ID.NIGHTMARE_WEAPON]: 'nightmare',
  [ID.SPLINTER_WEAPON]: 'splinter',
  [ID.RESILIENT_WEAPON]: 'resilient'
});

// Snapshots per-recipient charges and pre-schedules modeled allied-player procs for one weapon-spell cast.
function applyWeaponSpell(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const spell = SPELL_BY_SKILL_ID[skill.id];
  const definition = skill.effects?.find((effect) => effect.type === 'buff');
  if (!definition) return false;
  const playerStacks = Number(definition.stacks || 0);
  const defaultAllyStacks = Number(definition.allyStacks || 0);
  const maximumAllies = Math.max(Number(definition.audience?.maximumRecipients ?? 1) - 1, 0);
  // Wielder's Boon grants allies the same stack count as the player instead of the reduced ally default.
  const fullAlliedBenefit = hasTrait(context, TRAIT.WIELDERS_BOON);
  const allyStacks = fullAlliedBenefit ? playerStacks : defaultAllyStacks;
  const party = gw2AlliedEffectRecipients(context.config, {
    recipients: 'party',
    maximumRecipients: maximumAllies + 1,
    eligibleCompanionIds: necromancerActiveMinionCompanionIds(context)
  });
  context.emit({
    type: 'necromancer.weapon-spell',
    at: context.effectiveEnd,
    source: 'necromancer',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    name: skill.name,
    spell,
    duration: Number(definition.duration || 0),
    playerStacks,
    allyStacks,
    maxAllies: maximumAllies,
    resolvedAudience: party,
    alliesReceiveFullBenefit: fullAlliedBenefit
  });
  if (spell === 'nightmare' || spell === 'splinter') {
    const proc = balanceProfileFromContext(
      context,
      spell === 'nightmare' ? PROFILE.nightmareWeaponProc : PROFILE.splinterWeaponProc
    );
    // Resilient Weapon has no damage component, so allied proc timelines are only needed for damaging spells.
    const alliedProcs = gw2AlliedPlayerProcTimeline(context.config, {
      start: context.effectiveEnd,
      duration: Number(definition.duration || 0),
      maximumAllies: party.alliedPlayerCount,
      maximumPerAlly: allyStacks,
      internalCooldown: Number(proc?.internalCooldown || 0)
    });
    for (let index = 0; index < alliedProcs.length; index += 1) {
      const proc = alliedProcs[index];
      context.emit({
        type: 'necromancer.weapon-spell-ally-trigger',
        at: proc.at,
        source: 'necromancer',
        sourceId: skill.id,
        actorType: 'effect',
        skillId: skill.id,
        skillName: skill.name,
        name: `${skill.name} - Ally ${proc.allyIndex} Trigger`,
        spell,
        triggeredByAlly: proc.allyIndex,
        procIndex: proc.procIndex
      });
    }
  }

  return true;
}

/** Exposes Ritualist weapon-spell applications through the shared skill-handler contract. */
export const necromancerWeaponSpellSkillHandlers = Object.freeze({
  'necromancer.weapon-spell': applyWeaponSpell
});
