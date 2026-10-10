import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { storeThiefStolenSkillChoices } from '#gw2/professions/thief/core/mechanics/steal.js';
import { deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { STOLEN_SKILLS, stolenSkillGrant } from '#gw2/professions/thief/specializations/deadeye/traits/behavior.js';
import {
  maliceGained,
  maliceSpent,
  markCompleted,
  deadeyeCastCompleted,
  type DeadeyeCast,
  type DeadeyeMalice
} from '#gw2/professions/thief/specializations/deadeye/mechanics/boundaries.js';
import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { markedTarget } from '#gw2/professions/thief/specializations/deadeye/skills/index.js';
import { activeBoonCount } from '#gw2/professions/thief/specializations/deadeye/traits/behavior.js';

/** Owns Be Quick or Be Killed tuning and behavior at the existing execution boundaries. */
export const beQuickOrBeKilled = defineTrait({
  triggers: [onTriggerPoint(markCompleted, { run: grantBeQuickOrBeKilled })],
  id: TRAIT.BE_QUICK_OR_BE_KILLED,
  name: 'Be Quick or Be Killed',
  balance: {
    attributeBonus: 200,
    effects: [{ type: 'boon', name: 'Quickness', boon: 'Quickness', stacks: 1, duration: 4 }]
  }
});

/** Owns Fire for Effect tuning and behavior at the existing execution boundaries. */
export const fireForEffect = defineTrait({
  triggers: [onTriggerPoint(deadeyeCastCompleted, { run: grantFireForEffect })],
  id: TRAIT.FIRE_FOR_EFFECT,
  name: 'Fire for Effect',
  balance: {
    effects: [
      { type: 'boon', name: 'Might', boon: 'Might', stacks: 8, duration: 12 },
      { type: 'boon', name: 'Fury', boon: 'Fury', stacks: 1, duration: 12 }
    ]
  }
});

/** Owns this trait's modifier eligibility. */
export const ironSight = defineTrait({
  id: TRAIT.IRON_SIGHT,
  name: 'Iron Sight',
  modifierRules: [
    {
      order: 203,
      id: 'thief.iron-sight',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && markedTarget(context)
    }
  ]
});

/** Owns Maleficent Seven tuning and behavior at the existing execution boundaries. */
export const maleficentSeven = defineTrait({
  triggers: [onTriggerPoint(maliceGained, { run: applyMaleficentSeven })],
  id: TRAIT.MALEFICENT_SEVEN,
  name: 'Maleficent Seven',
  balance: {
    maximumStacks: 7,
    resourceGain: 7,
    effects: [
      { type: 'boon', name: 'Might', boon: 'Might', stacks: 10, duration: 10 },
      { type: 'boon', name: 'Fury', boon: 'Fury', stacks: 1, duration: 10 },
      { type: 'boon', name: 'Protection', boon: 'Protection', stacks: 1, duration: 5 },
      { type: 'boon', name: 'Regeneration', boon: 'Regeneration', stacks: 1, duration: 10 },
      { type: 'boon', name: 'Swiftness', boon: 'Swiftness', stacks: 1, duration: 10 },
      { type: 'boon', name: 'Vigor', boon: 'Vigor', stacks: 1, duration: 10 }
    ]
  }
});

/** Owns Malicious Intent tuning and behavior at the existing execution boundaries. */
export const maliciousIntent = defineTrait({
  triggers: [onTriggerPoint(maliceSpent, { run: restoreMaliciousIntent })],
  id: TRAIT.MALICIOUS_INTENT,
  name: 'Malicious Intent',
  balance: {
    resourceGain: 2
  }
});

/** Owns this trait's modifier eligibility. */
export const oneInTheChamber = defineTrait({
  triggers: [
    onTriggerPoint(deadeyeCastCompleted, {
      when: (_runtime, { cast }: DeadeyeCast) => Boolean(cast.skill.categories?.includes('Cantrip')),
      run: grantOneInTheChamber
    })
  ],
  id: TRAIT.ONE_IN_THE_CHAMBER,
  name: 'One in the Chamber',
  modifierRules: [
    {
      order: 205,
      id: 'thief.one-in-the-chamber',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.25,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        Boolean(
          skillForEvent(context.profession?.catalog, context.event, context.skillId)?.categories?.includes(
            'stolen skill'
          )
        )
    }
  ]
});

/** Owns Premeditation tuning and behavior at the existing execution boundaries. */
export const premeditation = defineTrait({
  id: TRAIT.PREMEDITATION,
  name: 'Premeditation',
  modifierRules: [
    {
      order: 204,
      id: 'thief.premeditation',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      // Count unique boons only up to the selected balance cap.
      parameters: { damagePerBoon: 0.01, maximumBoons: GW2_STANDARD_BOONS.length },
      factor: (context, _target, parameters) =>
        1 + Math.min(parameters.maximumBoons, activeBoonCount(context)) * parameters.damagePerBoon,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ],
  balance: {
    attributeBonus: 180
  },
  buildAttributes(_common, { balanceContext }) {
    const premeditationProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.PREMEDITATION);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Concentration',
          amount: balanceProfileNumber(premeditationProfile, 'attributeBonus'),
          feedsConversions: false
        }
      ]
    };
  }
});

/** Owns Silent Scope tuning and behavior at the existing execution boundaries. */
export const silentScope = defineTrait({
  triggers: [onTriggerPoint(deadeyeCastCompleted, { run: grantSilentScope })],
  id: TRAIT.SILENT_SCOPE,
  name: 'Silent Scope',
  balance: {
    threshold: 3,
    durationMultiplier: 3,
    attributeBonus: 120
  },
  buildAttributes(_common, { balanceContext }) {
    const silentScopeProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.SILENT_SCOPE);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Precision',
          amount: balanceProfileNumber(silentScopeProfile, 'attributeBonus'),
          feedsConversions: true
        }
      ]
    };
  }
});

/** Native trait owners, in stable authoring order. */
export const deadeyeTraits = Object.freeze([
  maleficentSeven,
  maliciousIntent,
  beQuickOrBeKilled,
  fireForEffect,
  silentScope,
  premeditation,
  ironSight,
  oneInTheChamber
]);

/** Trait listeners retain deferred rewards and the malice-cycle claim at their owning definitions. */
function grantBeQuickOrBeKilled(runtime: ThiefRuntime, { cast }: DeadeyeCast): void {
  traitBoons(runtime, cast, 'Be Quick or Be Killed', TRAIT.BE_QUICK_OR_BE_KILLED, false, 'Quickness');
}

function traitBoons(
  runtime: ThiefRuntime,
  cast: RuntimeCast<ThiefSkill> | null,
  source: string,
  profileId: SkillId,
  party: boolean,
  only?: string
): void {
  emitTraitProfile(runtime, profileId, profileId, undefined, {
    effects: (effect) => effect.type === 'boon' && (only == null || effect.name === only),
    attribution: {
      sourceId: `thief.deadeye.${source.toLowerCase().replaceAll(' ', '-')}`,
      actorType: 'player',
      ...(cast ? { skillId: cast.skill.id, skillName: cast.skill.name, activationId: cast.id } : {})
    },
    transform: (event, effect) => ({
      ...event,
      name: `${source} \u2014 ${effect.boon}`,
      boon: String(effect.boon),
      audience: party ? { recipients: 'party', maximumRecipients: 5 } : undefined
    })
  });
}

function grantFireForEffect(runtime: ThiefRuntime, { cast }: DeadeyeCast): void {
  const skill = cast.skill;
  if (STOLEN_SKILLS.has(skill.id)) traitBoons(runtime, cast, 'Fire for Effect', TRAIT.FIRE_FOR_EFFECT, true);
}

function applyMaleficentSeven(runtime: ThiefRuntime, { cast }: DeadeyeMalice): void {
  const state = deadeyeState.from(runtime);
  if (state.malice.value !== state.malice.maximum || state.maleficentSevenTriggered) return;
  state.maleficentSevenTriggered = true;
  const initiativeGain = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, TRAIT.MALEFICENT_SEVEN),
    'resourceGain'
  );
  if (initiativeGain > 0) runtime.resourceController.grant('initiative', initiativeGain);
  traitBoons(runtime, cast, 'Maleficent Seven', TRAIT.MALEFICENT_SEVEN, false);
}

function restoreMaliciousIntent(runtime: ThiefRuntime): void {
  {
    runtime.resourceController.grant(
      'malice',
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.MALICIOUS_INTENT), 'resourceGain')
    );
    runtime.fireTrigger(maliceGained, { cast: null });
  }
}

function grantOneInTheChamber(runtime: ThiefRuntime): void {
  {
    const grant = stolenSkillGrant(runtime);
    storeThiefStolenSkillChoices(runtime, grant.skillIds, grant.forcedSkillId);
  }
}

function grantSilentScope(runtime: ThiefRuntime, { cast }: DeadeyeCast): void {
  const skill = cast.skill;
  const state = deadeyeState.from(runtime);
  if (skill.id === SHARED_SKILL_IDS.DODGE) {
    const silentScope = requireBalanceProfileFromContext(runtime, TRAIT.SILENT_SCOPE);
    if (state.malice.value > balanceProfileNumber(silentScope, 'threshold')) {
      // Reapplying Silent Scope replaces the prior bonus rather than stacking attacks.
      state.bonusStealthAttack = grantCharges(
        1,
        runtime.time + balanceProfileNumber(silentScope, 'durationMultiplier')
      );
    }
  }
}
