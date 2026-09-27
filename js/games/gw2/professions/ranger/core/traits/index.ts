import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import { rangerEvent } from '#gw2/professions/ranger/core/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { eventSkill, queueBleeding } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import type { RangerRuntime, RangerResolverContext, RangerSkill } from '#gw2/professions/ranger/types.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';

import {
  applyRangerDodgeTraits,
  applyRangerWeaponSwapTraits,
  rangerCoreCriticalReactions
} from '#gw2/professions/ranger/core/traits/skirmishing.js';
import { emitChildOfEarth } from '#gw2/professions/ranger/core/traits/wilderness-survival.js';
import { reactToRangerCoreBuff } from '#gw2/professions/ranger/core/traits/marksmanship.js';
import { applyRangerCommandTraits } from '#gw2/professions/ranger/core/traits/beastmastery.js';

export { applyRangerDodgeTraits, applyRangerWeaponSwapTraits, rangerCoreCriticalReactions, reactToRangerCoreBuff };

function isBeastSkill(skill: RangerSkill): boolean {
  return Boolean(skill.petSkill && !skill.petFamilySkill);
}

// Route completed casts through shared Ranger trait families while consuming
// transient Quick Draw state only on the next qualifying weapon skill.
export function completeRangerTraits(context: RangerRuntime, skill: RangerSkill): void {
  if (skill.type === 'Heal') emitChildOfEarth(context, skill);

  // Trait consumers share the authored category, independent of tooltip wording.
  if (skill.categories?.includes('Command')) {
    applyRangerCommandTraits(context, skill);
  }

  if (!isBeastSkill(skill)) return;
  applyRangerBeastSkillTraits(context, skill, true);
}

/** Applies shared Beast-skill traits after the active owner classifies the triggering skill. */
export function applyRangerBeastSkillTraits(
  context: RangerRuntime,
  skill: RangerSkill,
  triggerPoisonMaster: boolean
): void {
  if (
    hasTrait(context, TRAIT.REJUVENATION) &&
    isInternalCooldownReady(context.time, context.procs.deadline('ranger.core.rejuvenation'))
  ) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.rejuvenation);
    const effect = requireEffect(profile, 'boon', 'regeneration');
    // The cooldown gates only regeneration, so a removed boon leaves the trait ready.
    if (effect) {
      context.procs.readyAt['ranger.core.rejuvenation'] =
        context.time + balanceProfileNumber(profile, 'internalCooldown');
      const kind = String(effect.boon);
      context.emitProcedural(
        rangerEvent(
          {
            at: context.time,
            source: 'Trait',
            sourceId: TRAIT.REJUVENATION,
            actorType: 'effect',
            skillId: TRAIT.REJUVENATION,
            skillName: 'Rejuvenation',
            name: `Rejuvenation - ${kind}`,
            kind,
            boon: kind,
            duration: effectNumber(profile, effect, 'duration'),
            stacks: effectNumber(profile, effect, 'stacks'),
            audience: { recipients: 'party' as const, maximumRecipients: 5 },
            triggeredBy: skill.name
          },
          'buff'
        )
      );
    }
  }

  const notBeforeCombat =
    !context.hasExplicitCombatStart || (context.combatStartTime != null && context.time >= context.combatStartTime);
  if (triggerPoisonMaster && hasTrait(context, TRAIT.POISON_MASTER) && notBeforeCombat) {
    context.emit({
      type: 'ranger.beast-skill-used',
      at: context.time,
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
    const profile = requireBalanceProfileFromContext(context, PROFILE.wolfsong);
    const effect = requireEffect(profile, 'condition', 'Vulnerability');
    if (effect)
      context.emit(
        rangerEvent(
          {
            at: context.time,
            source: 'Trait',
            actorType: 'effect',
            skillId: TRAIT.WOLFSONG,
            skillName: 'Wolfsong',
            name: 'Wolfsong - Vulnerability',
            condition: String(effect.condition),
            duration: effectNumber(profile, effect, 'duration'),
            stacks: effectNumber(profile, effect, 'stacks'),
            triggeredBy: skill.name
          },
          'condition'
        )
      );
  }
}

// Materialize pet-swap party boons and Clarion Bond's lesser warhorn package,
// including its condition and blast finisher, at the swap completion time.
export function applyRangerPetSwapTraits(context: RangerRuntime, skill: RangerSkill): void {
  const at = context.time;
  const inCombat = context.combatStartTime != null && context.time >= context.combatStartTime;
  if (inCombat && hasTrait(context, TRAIT.SPIRITED_ARRIVAL)) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.spiritedArrival);
    emitEffects(context, {
      owner: profile,
      effects: profile.effects?.filter((effect) => effect.type === 'boon'),
      at,
      baseEvent: {
        source: 'Trait',
        sourceId: TRAIT.SPIRITED_ARRIVAL,
        actorType: 'effect',
        skillId: TRAIT.SPIRITED_ARRIVAL,
        skillName: 'Spirited Arrival',
        triggeredBy: skill.name
      },
      transform: (event) => ({
        ...event,
        name: 'Spirited Arrival - ' + event.kind,
        boon: event.kind,
        audience: { recipients: 'party', maximumRecipients: 5 }
      })
    });
  }

  if (
    hasTrait(context, TRAIT.CLARION_BOND) &&
    isInternalCooldownReady(context.time, context.procs.deadline('ranger.core.clarionBond'))
  ) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.clarionBond);
    // The blast finisher is part of the lesser warhorn package, so the cooldown survives removed boons.
    context.procs.readyAt['ranger.core.clarionBond'] = context.time + balanceProfileNumber(profile, 'internalCooldown');
    emitEffects(context, {
      owner: profile,
      effects: profile.effects?.filter((effect) => effect.type === 'boon'),
      at,
      baseEvent: {
        source: 'Trait',
        sourceId: TRAIT.CLARION_BOND,
        actorType: 'effect',
        skillId: TRAIT.CLARION_BOND,
        skillName: 'Clarion Bond',
        triggeredBy: skill.name
      },
      transform: (event) => ({
        ...event,
        name: 'Clarion Bond - ' + event.kind,
        boon: event.kind,
        audience: { recipients: 'party', maximumRecipients: 5 }
      })
    });

    const weakness = requireEffect(profile, 'condition', 'Weakness');
    if (weakness)
      context.emit(
        rangerEvent(
          {
            at,
            source: 'Trait',
            actorType: 'effect',
            skillId: TRAIT.CLARION_BOND,
            skillName: 'Clarion Bond',
            name: 'Lesser Call of the Wild - Weakness',
            condition: String(weakness.condition),
            duration: effectNumber(profile, weakness, 'duration'),
            stacks: effectNumber(profile, weakness, 'stacks'),
            triggeredBy: skill.name
          },
          'condition'
        )
      );
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
export function triggerTrappersExpertise(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  const skill = eventSkill(context, event);
  if (
    skill?.categories?.includes('Trap') &&
    event.activationId &&
    !state.trapCrippleActivations[event.activationId] &&
    hasTrait(context, TRAIT.TRAPPERS_EXPERTISE)
  ) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.trappersExpertise);
    const cripple = requireEffect(profile, 'condition', 'Crippled');
    if (!cripple) return;
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
        condition: String(cripple.condition),
        duration: effectNumber(profile, cripple, 'duration'),
        stacks: effectNumber(profile, cripple, 'stacks'),
        fixedDuration: true,
        triggeredBy: event.skillName
      })
    );
  }
}

/** Apply the trait-selected shortbow condition upgrades after base on-hit effects. */
export function triggerLightOnYourFeet(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const skill = eventSkill(context, event);
  if (skill?.id === ID.CROSSFIRE && hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET) && context.config.target?.defiant) {
    const bleeding = skill.effects?.find((effect) => effect.type === 'condition' && effect.condition === 'Bleeding');
    // Defiant Crossfire gains a second stack with the same extended base duration; with the skill's own
    // Bleeding removed there is no base stack to duplicate.
    if (bleeding) {
      const extension = balanceProfileNumber(
        requireBalanceProfileFromContext(context, PROFILE.lightOnYourFeet),
        'durationPerTier'
      );
      queueBleeding(
        context,
        event,
        effectNumber(skill, bleeding, 'duration') + extension,
        TRAIT.LIGHT_ON_YOUR_FEET,
        'Light on your Feet'
      );
    }
  }

  if (skill?.id === ID.CONCUSSION_SHOT && hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET)) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.lightOnYourFeet);
    const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
    if (vulnerability)
      context.queue.enqueue(
        buildResolverCondition({
          at: event.at,
          source: 'Trait',
          sourceId: TRAIT.LIGHT_ON_YOUR_FEET,
          actorType: 'effect',
          skillId: TRAIT.LIGHT_ON_YOUR_FEET,
          skillName: 'Light on your Feet',
          name: 'Light on your Feet — Vulnerability',
          condition: String(vulnerability.condition),
          // The vulnerability upgrade is unconditional once the trait is selected.
          duration: effectNumber(profile, vulnerability, 'duration'),
          stacks: effectNumber(profile, vulnerability, 'stacks'),
          triggeredBy: event.skillName
        })
      );
  }
}
