import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileEffectFromContext as profileEffect,
  balanceProfileFromContext,
  balanceProfileEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { eventSkill, queueBleeding } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import type {
  RangerCastContext,
  RangerResolverContext,
  RangerResolverEvent,
  RangerSkill
} from '#gw2/professions/ranger/types.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';

import {
  applyRangerDodgeTraits,
  applyRangerWeaponSwapTraits,
  rangerCoreCriticalReactions,
  rangerCoreProfiledCriticalReaction
} from '#gw2/professions/ranger/core/traits/skirmishing.js';
import { emitChildOfEarth, reactToRangerCoreControl } from '#gw2/professions/ranger/core/traits/wilderness-survival.js';
import { reactToRangerCoreBuff } from '#gw2/professions/ranger/core/traits/marksmanship.js';
import { applyRangerCommandTraits } from '#gw2/professions/ranger/core/traits/beastmastery.js';

export {
  applyRangerDodgeTraits,
  applyRangerWeaponSwapTraits,
  rangerCoreCriticalReactions,
  rangerCoreProfiledCriticalReaction,
  reactToRangerCoreBuff,
  reactToRangerCoreControl
};

function isBeastSkill(skill: RangerSkill): boolean {
  return Boolean(skill.petSkill && !skill.petFamilySkill);
}

// Route completed casts through shared Ranger trait families while consuming
// transient Quick Draw state only on the next qualifying weapon skill.
export function completeRangerTraits(context: RangerCastContext, skill: RangerSkill): void {
  const state = professionCoreState(context);
  // Evade skills activate the trait during their evade window, allowing their
  // own packets to receive Light on Your Feet; dodge rolls still apply it on completion.
  if (skill.evades) applyRangerDodgeTraits(context, context.start);
  if (
    skill.type === 'Weapon' &&
    skill.slot !== 'Weapon_1' &&
    skill.id !== ID.SWAP_WEAPONS &&
    context.start < state.quickDrawUntil
  ) {
    state.quickDrawUntil = 0;
  }

  if (skill.type === 'Heal') {
    if (hasTrait(context, TRAIT.WELLSPRING)) {
      const effect = profileEffect(context, PROFILE.wellspring, 'boon');
      const kind = String(effect?.boon || 'regeneration');
      emitSkillBuff(context, skill, {
        at: context.effectiveEnd,
        source: 'Trait',
        sourceId: TRAIT.WELLSPRING,
        actorType: 'effect',
        skillId: TRAIT.WELLSPRING,
        skillName: 'Wellspring',
        name: `Wellspring - ${kind}`,
        kind,
        boon: kind,
        duration: Number(effect?.duration ?? 6),
        stacks: Number(effect?.stacks ?? 1),
        audience: { recipients: 'party' as const, maximumRecipients: 5 },
        triggeredBy: skill.name
      });
    }

    emitChildOfEarth(context, skill);
  }

  if (skill.weapon === 'Warhorn' && hasTrait(context, TRAIT.WINDBORNE_NOTES)) {
    const effect = profileEffect(context, PROFILE.windborneNotes, 'boon');
    const kind = String(effect?.boon || 'regeneration');
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.WINDBORNE_NOTES,
      actorType: 'effect',
      skillId: TRAIT.WINDBORNE_NOTES,
      skillName: 'Windborne Notes',
      name: `Windborne Notes - ${kind}`,
      kind,
      boon: kind,
      duration: Number(effect?.duration ?? 6),
      stacks: Number(effect?.stacks ?? 1),
      audience: { recipients: 'party' as const, maximumRecipients: 5 },
      triggeredBy: skill.name
    });
  }

  // Point-Blank Shot materializes Lead the Wind's self boons only when the trait is selected.
  if (skill.id === ID.POINT_BLANK_SHOT && hasTrait(context, TRAIT.LEAD_THE_WIND)) {
    const profile = balanceProfileFromContext(context, PROFILE.leadTheWind);
    for (let index = 0; index < 2; index += 1) {
      const effect = balanceProfileEffect(profile, 'boon', index);
      const kind = String(effect?.boon || ['swiftness', 'quickness'][index]);
      emitSkillBuff(context, skill, {
        at: context.effectiveEnd,
        source: 'Trait',
        sourceId: TRAIT.LEAD_THE_WIND,
        actorType: 'effect',
        skillId: TRAIT.LEAD_THE_WIND,
        skillName: 'Lead the Wind',
        name: `Lead the Wind - ${kind}`,
        kind,
        boon: kind,
        duration: Number(effect?.duration ?? [10, 5][index]),
        stacks: Number(effect?.stacks ?? 1),
        triggeredBy: skill.name
      });
    }
  }

  if (String(skill.description || '').startsWith('Command.')) {
    applyRangerCommandTraits(context, skill);
  }

  if (!isBeastSkill(skill)) return;
  applyRangerBeastSkillTraits(context, skill, true);
}

/** Applies shared Beast-skill traits after the active owner classifies the triggering skill. */
export function applyRangerBeastSkillTraits(
  context: RangerCastContext,
  skill: RangerSkill,
  triggerPoisonMaster: boolean
): void {
  const state = professionCoreState(context);
  if (hasTrait(context, TRAIT.REJUVENATION) && isInternalCooldownReady(context.start, state.rejuvenationReadyAt)) {
    const profile = balanceProfileFromContext(context, PROFILE.rejuvenation);
    const effect = balanceProfileEffect(profile, 'boon');
    state.rejuvenationReadyAt = context.start + Number(profile?.internalCooldown ?? 20);
    const kind = String(effect?.boon || 'regeneration');
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.REJUVENATION,
      actorType: 'effect',
      skillId: TRAIT.REJUVENATION,
      skillName: 'Rejuvenation',
      name: `Rejuvenation - ${kind}`,
      kind,
      boon: kind,
      duration: Number(effect?.duration ?? 10),
      stacks: Number(effect?.stacks ?? 1),
      audience: { recipients: 'party' as const, maximumRecipients: 5 },
      triggeredBy: skill.name
    });
  }

  const notBeforeCombat =
    !context.hasExplicitCombatStart || (context.combatStartTime != null && context.start >= context.combatStartTime);
  if (triggerPoisonMaster && hasTrait(context, TRAIT.POISON_MASTER) && notBeforeCombat) {
    context.emit({
      type: 'ranger.beast-skill-used',
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.POISON_MASTER,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name
    });
  }

  if (
    hasTrait(context, TRAIT.WOLFSONG) &&
    rangerPetByName(professionCoreState(context).activePet).family === 'canine'
  ) {
    const effect = profileEffect(context, PROFILE.wolfsong, 'condition');
    emitSkillCondition(context, {
      at: context.effectiveEnd,
      source: 'Trait',
      actorType: 'effect',
      skillId: TRAIT.WOLFSONG,
      skillName: 'Wolfsong',
      name: 'Wolfsong - Vulnerability',
      condition: String(effect?.condition || 'Vulnerability'),
      duration: Number(effect?.duration ?? 6),
      stacks: Number(effect?.stacks ?? 6),
      triggeredBy: skill.name
    });
  }
}

// Materialize pet-swap party boons and Clarion Bond's lesser warhorn package,
// including its condition and blast finisher, at the swap completion time.
export function applyRangerPetSwapTraits(context: RangerCastContext, skill: RangerSkill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const partyBoons: Array<{
    sourceId: number;
    sourceName: string;
    kind: string;
    duration: number;
    stacks: number;
  }> = [];
  const inCombat = context.combatStartTime != null && context.start >= context.combatStartTime;
  if (inCombat && hasTrait(context, TRAIT.SPIRITED_ARRIVAL)) {
    const profile = balanceProfileFromContext(context, PROFILE.spiritedArrival);
    const might = balanceProfileEffect(profile, 'boon', 0);
    const fury = balanceProfileEffect(profile, 'boon', 1);
    partyBoons.push(
      {
        sourceId: TRAIT.SPIRITED_ARRIVAL,
        sourceName: 'Spirited Arrival',
        kind: String(might?.boon || 'might'),
        duration: Number(might?.duration ?? 12),
        stacks: Number(might?.stacks ?? 6)
      },
      {
        sourceId: TRAIT.SPIRITED_ARRIVAL,
        sourceName: 'Spirited Arrival',
        kind: String(fury?.boon || 'fury'),
        duration: Number(fury?.duration ?? 8),
        stacks: Number(fury?.stacks ?? 1)
      }
    );
    for (const boon of partyBoons) {
      emitSkillBuff(context, skill, {
        at,
        source: 'Trait',
        sourceId: boon.sourceId,
        actorType: 'effect',
        skillId: boon.sourceId,
        skillName: boon.sourceName,
        name: `${boon.sourceName} - ${boon.kind}`,
        kind: boon.kind,
        boon: boon.kind,
        duration: boon.duration,
        stacks: boon.stacks,
        audience: { recipients: 'party' as const, maximumRecipients: 5 },
        triggeredBy: skill.name
      });
    }

    partyBoons.length = 0;
  }

  if (hasTrait(context, TRAIT.CLARION_BOND) && isInternalCooldownReady(context.start, state.clarionBondReadyAt)) {
    const profile = balanceProfileFromContext(context, PROFILE.clarionBond);
    state.clarionBondReadyAt = context.start + Number(profile?.internalCooldown ?? 15);
    for (let index = 0; index < 3; index += 1) {
      const effect = balanceProfileEffect(profile, 'boon', index);
      const kind = String(effect?.boon || ['fury', 'might', 'swiftness'][index]);
      partyBoons.push({
        sourceId: TRAIT.CLARION_BOND,
        sourceName: 'Clarion Bond',
        kind,
        duration: Number(effect?.duration ?? 5),
        stacks: Number(effect?.stacks ?? [1, 6, 1][index])
      });
    }

    // Emit Clarion Bond's boons before its condition and combo marker to preserve event ordering.
    for (const boon of partyBoons) {
      emitSkillBuff(context, skill, {
        at,
        source: 'Trait',
        sourceId: boon.sourceId,
        actorType: 'effect',
        skillId: boon.sourceId,
        skillName: boon.sourceName,
        name: `${boon.sourceName} - ${boon.kind}`,
        kind: boon.kind,
        boon: boon.kind,
        duration: boon.duration,
        stacks: boon.stacks,
        audience: { recipients: 'party' as const, maximumRecipients: 5 },
        triggeredBy: skill.name
      });
    }

    const weakness = balanceProfileEffect(profile, 'condition');
    emitSkillCondition(context, {
      at,
      source: 'Trait',
      actorType: 'effect',
      skillId: TRAIT.CLARION_BOND,
      skillName: 'Clarion Bond',
      name: 'Lesser Call of the Wild - Weakness',
      condition: 'Weakness',
      duration: Number(weakness?.duration ?? 5),
      stacks: Number(weakness?.stacks ?? 1),
      triggeredBy: skill.name
    });
    context.emit({
      type: 'proc',
      at,
      source: 'Trait',
      sourceId: TRAIT.CLARION_BOND,
      actorType: 'effect',
      skillId: TRAIT.CLARION_BOND,
      skillName: 'Clarion Bond',
      name: 'Lesser Call of the Wild - Blast Finisher',
      triggeredBy: skill.name,
      comboFinishers: [
        {
          ownerId: 'ranger',
          finisherType: 'Blast',
          ambiguousFieldSelection: 'oldest'
        }
      ]
    });
  }
}

/** Apply Trapper's Expertise once per trap activation when its damage resolves. */
export function triggerTrappersExpertise(context: RangerResolverContext, event: RangerResolverEvent): void {
  const state = professionCoreState(context);
  const skill = eventSkill(context, event);
  if (
    skill?.categories?.includes('Trap') &&
    event.activationId &&
    !state.trapCrippleActivations[event.activationId] &&
    hasTrait(context, TRAIT.TRAPPERS_EXPERTISE)
  ) {
    const cripple = profileEffect(context, PROFILE.trappersExpertise, 'condition');
    state.trapCrippleActivations[event.activationId] = true;
    context.queue.enqueue(
      buildResolverCondition({
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.TRAPPERS_EXPERTISE,
        actorType: 'effect',
        skillId: TRAIT.TRAPPERS_EXPERTISE,
        skillName: "Trapper's Expertise",
        name: "Trapper's Expertise — Crippled",
        condition: 'Crippled',
        duration: Number(cripple?.duration ?? 3),
        stacks: Number(cripple?.stacks ?? 1),
        fixedDuration: true,
        triggeredBy: event.skillName
      })
    );
  }
}

/** Apply the trait-selected shortbow condition upgrades after base on-hit effects. */
export function triggerLightOnYourFeet(context: RangerResolverContext, event: RangerResolverEvent): void {
  const skill = eventSkill(context, event);
  if (skill?.id === ID.CROSSFIRE && hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET) && context.config?.target?.defiant) {
    const bleeding = skill.effects?.find((effect) => effect.type === 'condition' && effect.condition === 'Bleeding');
    // Defiant Crossfire gains a second stack with the same extended base duration.
    queueBleeding(context, event, Number(bleeding?.duration ?? 3) + 2, TRAIT.LIGHT_ON_YOUR_FEET, 'Light on your Feet');
  }

  if (skill?.id === ID.CONCUSSION_SHOT && hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET)) {
    const vulnerability = balanceProfileEffect(
      balanceProfileFromContext(context, PROFILE.lightOnYourFeet),
      'condition'
    );
    context.queue.enqueue(
      buildResolverCondition({
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.LIGHT_ON_YOUR_FEET,
        actorType: 'effect',
        skillId: TRAIT.LIGHT_ON_YOUR_FEET,
        skillName: 'Light on your Feet',
        name: 'Light on your Feet — Vulnerability',
        condition: String(vulnerability?.condition || 'Vulnerability'),
        // The vulnerability upgrade is unconditional once the trait is selected.
        duration: Number(vulnerability?.duration ?? 10),
        stacks: Number(vulnerability?.stacks ?? 10),
        triggeredBy: event.skillName
      })
    );
  }
}
