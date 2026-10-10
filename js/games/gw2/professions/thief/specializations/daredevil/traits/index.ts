import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { replaceThiefBuff } from '#gw2/professions/thief/core/mechanics/buffs.js';
import { selectedDodgeProfile } from '#gw2/professions/thief/specializations/daredevil/mechanics/dodges.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { applySideEffect } from '#gw2/platform/effects/action-dispatch.js';

import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { buildThiefBuff } from '#gw2/professions/thief/core/events.js';
import { thiefRuntimeState } from '#gw2/professions/thief/core/state-queries.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type {
  DaredevilCast,
  DaredevilStrike,
  PhysicalSkillStart
} from '#gw2/professions/thief/specializations/daredevil/mechanics/boundaries.js';
import {
  daredevilCastCompleted,
  daredevilCastStarted,
  daredevilDodged,
  daredevilStruck,
  physicalSkillStarted
} from '#gw2/professions/thief/specializations/daredevil/mechanics/boundaries.js';
import { DAREDEVIL_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/daredevil/profiles.js';
import { daredevilState } from '#gw2/professions/thief/specializations/daredevil/state.js';

/** Owns Brawler's Tenacity tuning and behavior at the existing execution boundaries. */
export const brawlersTenacity = defineTrait({
  id: TRAIT.BRAWLERS_TENACITY,
  name: "Brawler's Tenacity",
  triggers: [onTriggerPoint(physicalSkillStarted, { run: grantBrawlersTenacity })],
  balance: {
    resourceGain: 15
  }
});

/** Owns Bounding Dodger tuning and behavior at the existing execution boundaries. */
export const boundingDodger = defineTrait({
  id: TRAIT.BOUNDING_DODGER,
  name: 'Bounding Dodger',
  // The configured dodge choice owns eligibility; new damage-window rewards still obey isolation.
  triggers: [
    onTriggerPoint(daredevilDodged, {
      requiresSelection: false,
      when: (runtime) => daredevilState.from(runtime).selectedDodge === 'Bounding Dodger',
      run: (runtime) => openDodgeWindow(runtime)
    })
  ],
  modifierRules: [
    {
      order: 102,
      id: 'thief.bounding-dodger',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BOUNDING_DODGER), 'damageIncrease'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && buffActive(context, 'bounding-dodger')
    }
  ],
  balance: {
    damageIncrease: 0.15,
    durationMultiplier: 6,
    effects: [{ type: 'strike', name: 'Bounding Dodger', coefficient: 3.5, hits: 1 }]
  }
});

/** Owns Lotus Training tuning and behavior at the existing execution boundaries. */
export const lotusTraining = defineTrait({
  id: TRAIT.LOTUS_TRAINING,
  name: 'Lotus Training',
  // The configured dodge choice owns eligibility; new damage-window rewards still obey isolation.
  triggers: [
    onTriggerPoint(daredevilDodged, {
      requiresSelection: false,
      when: (runtime) => daredevilState.from(runtime).selectedDodge === 'Lotus Training',
      run: (runtime) => openDodgeWindow(runtime)
    })
  ],
  modifierRules: [
    {
      order: 103,
      id: 'thief.lotus-training',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.LOTUS_TRAINING),
          'conditionDamageIncrease'
        ),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && buffActive(context, 'lotus-training')
    }
  ],
  balance: {
    conditionDamageIncrease: 0.15,
    durationMultiplier: 6,
    effects: [
      {
        type: 'strike',
        name: 'Lotus Training',
        ticks: [
          { atMs: 200, coefficient: 0.1875 },
          { atMs: 360, coefficient: 0.1875 },
          { atMs: 520, coefficient: 0.1875 }
        ]
      },
      // Lotus conditions follow their individual projectiles from dodge start.
      { type: 'condition', name: 'Bleeding', atMs: 200, condition: 'Bleeding', stacks: 2, duration: 4 },
      { type: 'condition', name: 'Torment', atMs: 360, condition: 'Torment', stacks: 2, duration: 4 },
      { type: 'condition', name: 'Crippled', atMs: 520, condition: 'Crippled', stacks: 1, duration: 3 }
    ]
  }
});

/** Owns Unhindered Combatant tuning and behavior at the existing execution boundaries. */
export const unhinderedCombatant = defineTrait({
  id: TRAIT.UNHINDERED_COMBATANT,
  name: 'Unhindered Combatant',
  balance: {
    effects: [{ type: 'boon', name: 'Swiftness', boon: 'Swiftness', stacks: 1, duration: 8 }]
  }
});

/** Owns Endurance Thief tuning and behavior at the existing execution boundaries. */
export const enduranceThief = defineTrait({
  id: TRAIT.ENDURANCE_THIEF,
  name: 'Endurance Thief',
  triggers: [
    onTriggerPoint(daredevilCastCompleted, {
      when: (_runtime, { cast }: DaredevilCast) => cast.skill.id === ID.STEAL,
      run: grantEnduranceThief
    })
  ],
  balance: {
    resourceGain: 50
  }
});

/** Owns this trait's modifier eligibility. */
export const havocSpecialist = defineTrait({
  id: TRAIT.HAVOC_SPECIALIST,
  name: 'Havoc Specialist',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.15 },
  modifierRules: [
    {
      order: 101,
      id: 'thief.havoc-specialist',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.HAVOC_SPECIALIST), 'damageMultiplier'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        // Trait activates whenever endurance is not at maximum — any spent dodge qualifies
        (thiefRuntimeState(context).endurance?.value ?? 0) <
          balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'maximumStacks')
    }
  ]
});

/** Owns Marauder's Resilience tuning and behavior at the existing execution boundaries. */
export const maraudersResilience = defineTrait({
  id: TRAIT.MARAUDERS_RESILIENCE,
  name: "Marauder's Resilience",
  balance: { attributeConversion: 0.07 },
  buildAttributes(_common, { balanceContext }) {
    const maraudersResilienceProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.MARAUDERS_RESILIENCE);
    return {
      attributeEffects: [
        {
          kind: 'conversion',
          from: 'Power',
          to: 'Vitality',
          multiplier: balanceProfileNumber(maraudersResilienceProfile, 'attributeConversion'),
          rounding: 'round',
          input: 'eligible'
        }
      ]
    };
  }
});

/** Owns Staff Master tuning and behavior at the existing execution boundaries. */
export const staffMaster = defineTrait({
  id: TRAIT.STAFF_MASTER,
  name: 'Staff Master',
  triggers: [
    // Staff Master refunds endurance per initiative spent on staff skills.
    onTriggerPoint(daredevilCastStarted, { run: refundStaffMaster })
  ],
  balance: {
    attributeBonus: 120,
    weaponAttributeBonus: 240,
    resourceGain: 2
  },
  buildAttributes(_common, { build, weaponSet, balanceContext }) {
    const weapons = (weaponSet === 2 ? build.alternateWeapons : build.weapons) || [];
    const staffMasterProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.STAFF_MASTER);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: balanceProfileNumber(
            staffMasterProfile,
            weapons.includes('Staff') ? 'weaponAttributeBonus' : 'attributeBonus'
          ),
          feedsConversions: true
        }
      ]
    };
  }
});

/** Owns Weakening Strikes tuning and behavior at the existing execution boundaries. */
export const weakeningStrikes = defineTrait({
  id: TRAIT.WEAKENING_STRIKES,
  name: 'Weakening Strikes',
  triggers: [
    onTriggerPoint(daredevilDodged, { run: armWeakeningStrikes }),
    onTriggerPoint(daredevilStruck, { run: weakeningStrike })
  ],
  modifierRules: [
    {
      order: 100,
      id: 'thief.weakening-strikes',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.WEAKENING_STRIKES), 'damageMultiplier'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetConditionActive(context, 'Weakness')
    }
  ],
  balance: {
    damageMultiplier: 1.1,
    durationMultiplier: 4,
    effects: [{ type: 'condition', name: 'Weakness', condition: 'Weakness', stacks: 1, duration: 3 }]
  }
});

/** Native trait owners, in stable authoring order. */
export const daredevilTraits = Object.freeze([
  boundingDodger,
  lotusTraining,
  unhinderedCombatant,
  enduranceThief,
  staffMaster,
  brawlersTenacity,
  maraudersResilience,
  weakeningStrikes,
  havocSpecialist
]);

/** Brawler's Tenacity grants endurance when an eligible physical skill is accepted. */
function grantBrawlersTenacity(runtime: ThiefRuntime, { context }: PhysicalSkillStart): void {
  applySideEffect(runtime, context, {
    type: 'resourceGrant',
    resource: 'endurance',
    amount: { profile: TRAIT.BRAWLERS_TENACITY, field: 'resourceGain' }
  });
}

/** Applies Endurance Thief at its established mechanical boundary. */
function grantEnduranceThief(runtime: ThiefRuntime): void {
  const enduranceGain = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, TRAIT.ENDURANCE_THIEF),
    'resourceGain'
  );
  if (enduranceGain > 0) runtime.endurance.grant(enduranceGain);
}

/** Applies Staff Master at its established mechanical boundary. */
function refundStaffMaster(runtime: ThiefRuntime, { cast }: DaredevilCast): void {
  const skill = cast.skill;
  const cost = skill.initiativeCost || 0;
  if (cost > 0 && skill.weapon === 'Staff') {
    const enduranceGain =
      cost * balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.STAFF_MASTER), 'resourceGain');
    if (enduranceGain > 0) runtime.endurance.grant(enduranceGain);
  }
}

/** Arm the next landed strike after the dodge window opens. */
function armWeakeningStrikes(runtime: ThiefRuntime, { cast }: DaredevilCast): void {
  const state = daredevilState.from(runtime);
  const skill = cast.skill;

  const weakening = requireBalanceProfileFromContext(runtime, TRAIT.WEAKENING_STRIKES);
  // A removed Weakness cannot arm a pending grant.
  if (!requireEffect(weakening, 'condition', 'Weakness')) return;
  const duration = balanceProfileNumber(weakening, 'durationMultiplier');
  state.weakeningStrikeReady = true;
  state.weakeningStrikeExpiresAt = runtime.time + duration;
  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefBuff(skill, {
      at: runtime.time,
      source: 'Trait',
      sourceId: TRAIT.WEAKENING_STRIKES,
      activationId: cast.id,
      kind: 'weakening-strikes',
      duration
    })
  });
}

/** The armed grant is consumed by the next landed player strike, never by a cast or condition tick. */
function weakeningStrike(runtime: ThiefRuntime, { cause: event }: DaredevilStrike): void {
  const state = daredevilState.from(runtime);
  if (
    !state.weakeningStrikeReady ||
    state.weakeningStrikeExpiresAt <= event.at ||
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    event.skillId === SHARED_SKILL_IDS.DODGE
  )
    return;
  state.weakeningStrikeReady = false;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.WEAKENING_STRIKES);
  const weakness = requireEffect(profile, 'condition', 'Weakness');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!weakness) return;
  emitTraitProfile(runtime, TRAIT.WEAKENING_STRIKES, TRAIT.WEAKENING_STRIKES, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'condition', name: 'Weakness' },
    settlement: 'reaction',
    attribution: {
      source: 'Trait',
      actorType: 'player',
      skillId: TRAIT.WEAKENING_STRIKES,
      skillName: 'Weakening Strikes',
      activationId: event.activationId,
      triggeredBy: event.skillName,
      sourceId: TRAIT.WEAKENING_STRIKES,
      name: 'Weakening Strikes — Weakness'
    }
  });
}

/**
 * A committed dodge opens its damage window after the dodge's own same-instant packets, so its landing strike (Bound)
 * resolves before the window it grants.
 */
function openDodgeWindow(runtime: ThiefRuntime): void {
  const state = daredevilState.from(runtime);
  const profile = selectedDodgeProfile(runtime);
  if (!profile) return;
  if (state.selectedDodge === 'Bounding Dodger')
    replaceThiefBuff(
      runtime,
      'bounding-dodger',
      balanceProfileNumber(profile, 'durationMultiplier'),
      TRAIT.BOUNDING_DODGER,
      'Bounding Dodger',
      'Trait'
    );
  if (state.selectedDodge === 'Lotus Training')
    replaceThiefBuff(
      runtime,
      'lotus-training',
      balanceProfileNumber(profile, 'durationMultiplier'),
      TRAIT.LOTUS_TRAINING,
      'Lotus Training',
      'Trait'
    );
}
