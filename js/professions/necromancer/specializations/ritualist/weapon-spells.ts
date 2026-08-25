/**
 * Ritualist weapon-spell applications.
 *
 * The resolver consumes the emitted application event and spends the player's
 * or affected summon's stacks on eligible strikes. Resilient Weapon is kept as
 * a real heal-slot application even though healing and incoming-damage
 * reduction are outside the damage simulator.
 */
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import {
  gw2AlliedEffectRecipients,
  gw2AlliedPlayerProcTimeline
} from '../../../../platform/gw2/combat/state/allied-players.js';
import { hasTrait, necromancerActiveMinionCompanionIds } from '../../core/shared.js';
import { necromancerBalanceProfile } from '../../core/profiles.js';
import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import type { NecromancerCastContext, NecromancerSkill } from '../../types.js';

const SPELL_BY_SKILL_ID: Readonly<Record<string | number, string>> = Object.freeze({
  [ID.NIGHTMARE_WEAPON]: 'nightmare',
  [ID.SPLINTER_WEAPON]: 'splinter',
  [ID.RESILIENT_WEAPON]: 'resilient'
});

function applyWeaponSpell(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const spell = SPELL_BY_SKILL_ID[skill.id];
  const definition = skill.effects?.find((effect) => effect.type === 'buff');
  if (!definition) return false;
  const playerStacks = Number(definition.stacks || 0);
  const defaultAllyStacks = Number(definition.allyStacks || 0);
  const maximumAllies = Math.max(Number(definition.maximumRecipients || 1) - 1, 0);
  // Wielder's Boon grants allies the same stack count as the player instead of the reduced ally default
  const fullAlliedBenefit = hasTrait(context, TRAIT.WIELDERS_BOON);
  const allyStacks = fullAlliedBenefit ? playerStacks : defaultAllyStacks;
  const party = gw2AlliedEffectRecipients(context.config, {
    maximumRecipients: maximumAllies + 1,
    // Weapon spells can include ordinary minions after player-first targeting;
    // Ritualist spirits do not receive weapon-spell stacks.
    companionIds: necromancerActiveMinionCompanionIds(context)
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
    recipients: party.companionIds,
    alliedPlayerCount: party.alliedPlayerCount,
    recipientCount: party.recipientCount,
    alliesReceiveFullBenefit: fullAlliedBenefit
  });
  if (spell === 'nightmare' || spell === 'splinter') {
    const proc = necromancerBalanceProfile(
      context,
      spell === 'nightmare' ? PROFILE.nightmareWeaponProc : PROFILE.splinterWeaponProc
    );
    // Resilient Weapon has no damage component, so ally proc timeline is only needed for damaging spells
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

export const necromancerWeaponSpellSkillHandlers = Object.freeze({
  'necromancer.weapon-spell': applyWeaponSpell
});
