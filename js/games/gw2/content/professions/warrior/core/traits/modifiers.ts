import { professionStaticRulesApplied } from '../../../../../platform/builds/attribute-provenance.js';
import { readProfessionCoreState } from '../../../../../platform/engine/profession/state.js';
import { createModifierHooks, MODIFIER_TARGET } from '../../../../../platform/combat/modifiers/rules.js';
import { GW2_STANDARD_BOONS } from '../../../../../platform/combat/state/boons.js';
import { hasTrait } from '../../../../../platform/combat/state/traits.js';
import {
  eventSkill as gw2EventSkill,
  hasSelectedSkill,
  targetConditionActive,
  targetHealthFraction
} from '../../../../../platform/combat/query/runtime-query.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { warriorCastAvailability } from '../mechanics/availability.js';
import { warriorBalanceProfile, WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '../profiles.js';
import {
  advanceWarriorTraits,
  applyWarriorWeaponSwapTraits,
  beginWarriorSkill,
  completeWarriorSkill,
  handleWarriorArmsCriticalTask,
  initializeWarriorTraits,
  observeWarriorEvent
} from './index.js';
import { advanceWarriorResources } from '../mechanics/adrenaline-and-endurance.js';
import { handleWarriorAdrenalineTask } from '../../resources.js';
import type { SchedulerRecord } from '../../../../../platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../../../platform/combat/modifiers/types.js';
import type { WarriorCastContext, WarriorSchedulerContext, WarriorSkill } from '../../types.js';
import type { WarriorCoreState } from '../../types.js';
import { gw2ConfiguredWeaponSet } from '../../../../../platform/equipment/weapons/loadout.js';

export { snapshotWarriorState } from '../../state/index.js';

function coreState(context: Gw2ModifierContext): Partial<WarriorCoreState> {
  return readProfessionCoreState<WarriorCoreState>(context.runtime?.profession);
}

// Keeps Warrior skill typing local while sharing the GW2-wide skill-id fallback policy.
const eventSkill = (context: Gw2ModifierContext): WarriorSkill | undefined => gw2EventSkill<WarriorSkill>(context);

function targetControlled(context: Gw2ModifierContext): boolean {
  return Boolean(
    context.config?.target?.controlled ||
    context.config?.target?.defiant ||
    Number(coreState(context).targetControlledUntil || 0) > context.time
  );
}

const BREACHING_STRIKE_IDS = new Set<number>([
  ID.BREACHING_STRIKE,
  ID.BREACHING_STRIKE_ID_69297,
  ID.BREACHING_STRIKE_ID_69433
]);

// Warrior modifiers historically read configured and live resolver boons only; timeline state must not change them.
function boonActive(context: Gw2ModifierContext, boon: string): boolean {
  if (context.config?.boons?.[boon]) return true;
  return (context.runtime?.boons?.get(boon) || []).some(
    (application) =>
      application.affectsSelf !== false && application.at <= context.time && application.expiresAt > context.time
  );
}

function activeBuffStacks(context: Gw2ModifierContext, kind: string, maximum: number): number {
  const stacks = (context.runtime?.boons?.get(kind) || [])
    .filter(
      (application) =>
        application.affectsSelf !== false && application.at <= context.time && application.expiresAt > context.time
    )
    .reduce((total, application) => total + application.stacks, 0);
  return Math.min(maximum, stacks);
}

function activeBoonCount(context: Gw2ModifierContext): number {
  return GW2_STANDARD_BOONS.filter((boon) => boonActive(context, boon)).length;
}

function targetBoonCount(context: Gw2ModifierContext): number {
  const target = context.config?.target;
  if (target?.boonless === true) return 0;
  if (Array.isArray(target?.boons)) {
    return new Set(target.boons.map(String)).size;
  }

  if (target?.boonCount != null) {
    return Math.max(0, Math.trunc(Number(target.boonCount) || 0));
  }

  return target?.boonless === false ? 1 : 0;
}

// Test the active weapon set at query time, accounting for both hands and
// projected set swaps used by modifier evaluation.
function wieldingWeapon(context: Gw2ModifierContext, weapon: string): boolean {
  if (eventSkill(context)?.weapon === weapon) return true;
  const weaponSet = Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1;
  const [configuredPrimary, configuredSecondary] = gw2ConfiguredWeaponSet(context.config, weaponSet);
  const primary = String(configuredPrimary || '');
  const secondary = String(configuredSecondary || '');
  return primary === weapon || secondary === weapon;
}

function modifyWarriorAttributes(context: Gw2ModifierContext, attributes: SchedulerRecord): SchedulerRecord {
  const result = { ...attributes } as SchedulerRecord & {
    power: number;
    precision: number;
    ferocity: number;
    conditionDamage: number;
    expertise: number;
    vitality: number;
    healingPower: number;
    concentration: number;
  };
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  const signetMastery = warriorBalanceProfile(context, PROFILE.signetMastery);
  const furious = warriorBalanceProfile(context, PROFILE.furious);
  const signetStacks = activeBuffStacks(context, 'signet-mastery', Number(signetMastery?.maximumStacks ?? 5));
  result.power = Number(result.power || 0);
  result.precision = Number(result.precision || 0);
  result.ferocity = Number(result.ferocity || 0);
  result.conditionDamage = Number(result.conditionDamage || 0);
  result.expertise = Number(result.expertise || 0);
  result.vitality = Number(result.vitality || 0);
  result.healingPower = Number(result.healingPower || 0);
  result.concentration = Number(result.concentration || 0);
  // Attribute conversions read the gear-only pool. config.stats
  // holds pre-boon gear attributes (might is baked into the seed's power, and
  // live trait bonuses accrue on `result`), so this converts gear power only.
  const gearPower = Number(context.config?.stats?.power || 0);
  if (hasTrait(context, TRAIT.PINNACLE_OF_STRENGTH)) {
    const profile = warriorBalanceProfile(context, PROFILE.pinnacleOfStrength);
    result.power +=
      Number(context.query?.mightStacksAt(context.time, context.runtime, context.event) || 0) *
      Number(profile?.attributeBonus ?? 10);
  }

  if (hasTrait(context, TRAIT.FORCEFUL_GREATSWORD) && !staticRulesApplied) {
    const profile = warriorBalanceProfile(context, PROFILE.forcefulGreatsword);
    result.power +=
      Number(profile?.attributeBonus ?? 120) +
      Number(wieldingWeapon(context, 'Greatsword')) * Number(profile?.weaponAttributeBonus ?? 120);
  }

  if (hasTrait(context, TRAIT.ROARING_REVEILLE) && !staticRulesApplied) {
    result.concentration += Number(warriorBalanceProfile(context, PROFILE.roaringReveille)?.attributeBonus ?? 120);
  }

  if (hasTrait(context, TRAIT.SIGNET_MASTERY))
    result.ferocity += signetStacks * Number(signetMastery?.attributeBonus ?? 100);
  if (hasTrait(context, TRAIT.GREAT_FORTITUDE) && !staticRulesApplied) {
    // Static path bakes this from conversionPool in build-attributes; add no
    // dynamic delta so might/signets never leak into the conversion.
    const conversion = Number(warriorBalanceProfile(context, PROFILE.greatFortitude)?.attributeConversion ?? 0.1);
    result.vitality += gearPower * conversion;
    result.ferocity += gearPower * conversion;
  }

  if (hasTrait(context, TRAIT.VIGOROUS_SHOUTS) && !staticRulesApplied) {
    result.healingPower +=
      gearPower * Number(warriorBalanceProfile(context, PROFILE.vigorousShouts)?.attributeConversion ?? 0.13);
  }

  if (
    hasTrait(context, TRAIT.DEEP_STRIKES) &&
    boonActive(context, 'fury') &&
    !(staticRulesApplied && Boolean(context.config?.boons?.fury))
  ) {
    result.conditionDamage += Number(warriorBalanceProfile(context, PROFILE.deepStrikes)?.attributeBonus ?? 180);
  }

  if (hasTrait(context, TRAIT.BLADEMASTER) && wieldingWeapon(context, 'Sword')) {
    result.conditionDamage += Number(warriorBalanceProfile(context, PROFILE.blademaster)?.attributeBonus ?? 120);
  }

  result.conditionDamage +=
    activeBuffStacks(context, 'furious-surge', Number(furious?.maximumStacks ?? 25)) *
    Number(furious?.attributeBonus ?? 15);
  if (hasTrait(context, TRAIT.BURST_PRECISION) && activeBuffStacks(context, 'burst-precision', 1) > 0) {
    result.ferocity += Number(warriorBalanceProfile(context, PROFILE.burstPrecision)?.attributeBonus ?? 250);
  }

  if (activeBuffStacks(context, 'signet-of-fury-active', 1) > 0) {
    const bonus = Number(warriorBalanceProfile(context, PROFILE.signetOfFuryActive)?.attributeBonus ?? 360);
    result.precision += bonus;
    result.ferocity += bonus;
  }

  for (const [name, id, attribute] of [
    ['Signet of Might', ID.SIGNET_OF_MIGHT, 'power'],
    ['Signet of Fury', ID.SIGNET_OF_FURY, 'precision']
  ] as const) {
    if (!hasSelectedSkill(context, name)) continue;
    const onCooldown = Boolean(context.timeline?.skillOnCooldownAt(id, context.time));
    if (staticRulesApplied ? onCooldown : !onCooldown) {
      const passiveBonus = Number(warriorBalanceProfile(context, PROFILE.signetPassives)?.attributeBonus ?? 180);
      const delta = staticRulesApplied ? -passiveBonus : passiveBonus;
      // Signet power/precision toggles are real stat changes, but they are not
      // part of the gear pool, so they no longer feed Great Fortitude /
      // Wounding Precision conversions
      result[attribute] += delta;
    }
  }

  return result;
}

const warriorModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'warrior.kill-shot-threshold',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    order: 100,
    // Kill Shot gets the same execute bonus from either a defiant target or live sub-50% health.
    when: (context) =>
      eventSkill(context)?.name === 'Kill Shot' &&
      (context.config?.target?.defiant === true || targetHealthFraction(context) < 0.5)
  },
  {
    id: 'warrior.throw-axe-health-threshold',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: {
      lowerThreshold: 0.25,
      upperThreshold: 0.5,
      lowerFactor: 2,
      upperFactor: 1.5
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) =>
      targetHealthFraction(context) <= parameters.lowerThreshold
        ? parameters.lowerFactor
        : targetHealthFraction(context) <= parameters.upperThreshold
          ? parameters.upperFactor
          : 1,
    order: 100,
    when: (context) => eventSkill(context)?.id === ID.THROW_AXE
  },
  {
    id: 'warrior.pinnacle-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.05,
    when: (context) => hasTrait(context, TRAIT.PINNACLE_OF_STRENGTH)
  },
  {
    id: 'warrior.berserkers-power',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: {
      maximumStacks: 4,
      damagePerStack: 0.0375
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      (context.timeline?.buffStacksAt('berserkers-power', context.time, 0, parameters.maximumStacks) ??
        activeBuffStacks(context, 'berserkers-power', parameters.maximumStacks)) * parameters.damagePerStack,
    when: (context) => hasTrait(context, TRAIT.BERSERKERS_POWER)
  },
  {
    id: 'warrior.peak-performance',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: {
      baseBonus: 0.05,
      activeBonus: 0.1
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      parameters.baseBonus + (activeBuffStacks(context, 'peak-performance', 1) ? parameters.activeBonus : 0),
    when: (context) => hasTrait(context, TRAIT.PEAK_PERFORMANCE)
  },
  {
    id: 'warrior.empowered',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { damagePerBoon: 0.01 } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => 1 + activeBoonCount(context) * parameters.damagePerBoon,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.EMPOWERED)
  },
  {
    id: 'warrior.leg-specialist',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.05,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.LEG_SPECIALIST) &&
      ['Crippled', 'Chilled', 'Immobilized'].some((condition) => targetConditionActive(context, condition))
  },
  {
    id: 'warrior.warriors-cunning',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.WARRIORS_CUNNING) && targetHealthFraction(context) > 0.8
  },
  {
    id: 'warrior.cull-the-weak',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.CULL_THE_WEAK) && targetConditionActive(context, 'Weakness')
  },
  {
    id: 'warrior.merciless-hammer',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.MERCILESS_HAMMER) &&
      ['Hammer', 'Mace'].includes(
        String(context.event?.skillWeapon || eventSkill(context)?.skillWeapon || eventSkill(context)?.weapon || '')
      ) &&
      targetControlled(context)
  },
  {
    id: 'warrior.stalwart-strength',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.STALWART_STRENGTH) && boonActive(context, 'stability')
  },
  {
    id: 'warrior.furious-burst-fury-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.05,
    when: (context) => hasTrait(context, TRAIT.FURIOUS_BURST) && boonActive(context, 'fury')
  },
  {
    id: 'warrior.deep-strikes',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.05,
    when: (context) => hasTrait(context, TRAIT.DEEP_STRIKES) && targetConditionActive(context, 'Bleeding')
  },
  {
    id: 'warrior.unsuspecting-foe',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.25,
    when: (context) => hasTrait(context, TRAIT.UNSUSPECTING_FOE) && targetControlled(context)
  },
  {
    id: 'warrior.burst-precision',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 1,
    when: (context) =>
      hasTrait(context, TRAIT.BURST_PRECISION) &&
      (Boolean(eventSkill(context)?.burst) || activeBuffStacks(context, 'burst-precision', 1) > 0)
  },
  {
    id: 'warrior.dagger-auto-critical-damage',
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    order: 100,
    when: (context) => {
      const skillId = Number(eventSkill(context)?.id);
      return skillId === ID.PRECISE_CUT || skillId === ID.FOCUSED_SLASH;
    }
  },
  {
    id: 'warrior.wastrels-ruin-defiant',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 2,
    order: 100,
    when: (context) => eventSkill(context)?.id === ID.WASTRELS_RUIN && context.config?.target?.defiant === true
  },
  {
    id: 'warrior.breaching-strike-boonless',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    order: 100,
    when: (context) =>
      BREACHING_STRIKE_IDS.has(Number(eventSkill(context)?.id)) && context.config?.target?.boonless === true
  },
  {
    id: 'warrior.slicing-maelstrom-boonless',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    order: 100,
    when: (context) => eventSkill(context)?.id === ID.SLICING_MAELSTROM && context.config?.target?.boonless === true
  },
  {
    id: 'warrior.warriors-sprint',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => hasTrait(context, TRAIT.WARRIORS_SPRINT) && boonActive(context, 'swiftness')
  },
  {
    id: 'warrior.destruction-of-the-empowered',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { damagePerBoon: 0.03 } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => 1 + targetBoonCount(context) * parameters.damagePerBoon,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.DESTRUCTION_OF_THE_EMPOWERED) && targetBoonCount(context) > 0
  },
  {
    id: 'warrior.burst-mastery',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.BURST_MASTERY) && Boolean(eventSkill(context)?.burst)
  }
]);

// Apply the fixed weapon-swap recharge and multiplicative burst or weapon-trait
// reductions after shared recharge policy has produced the base duration.
function modifyRechargeDuration(context: WarriorSchedulerContext & { skill?: WarriorSkill }, duration: number): number {
  const skill = context.skill;
  if (skill?.id === ID.SWAP_WEAPONS) return duration > 0 ? 5 : 0;
  let result = duration;
  if (skill?.burst && hasTrait(context, TRAIT.VERSATILE_POWER)) result *= 0.85;
  if (skill?.weapon === 'Greatsword' && hasTrait(context, TRAIT.FORCEFUL_GREATSWORD)) result *= 0.8;
  if (skill?.weapon === 'Sword' && hasTrait(context, TRAIT.BLADEMASTER)) result *= 0.8;
  if (skill?.weapon === 'Axe' && hasTrait(context, TRAIT.AXE_MASTERY)) result *= 0.8;
  return result;
}

const DUAL_WIELD_OFFHANDS = new Set(['Axe', 'Dagger', 'Mace', 'Sword']);
const DUAL_WIELDING_EXCLUDED_SKILL_IDS = new Set<number>([
  ID.AURA_SLICER,
  ID.KICK,
  ID.BULLS_CHARGE,
  ...BREACHING_STRIKE_IDS
]);
/** GW2 completes cast durations on 40 ms action-tick boundaries. */
const ACTION_TICK_MS = 40;

// Dual Wielding increases attack speed by 25%, so cast duration is divided by
// 1.25. The tick snap must happen once, on the final duration: the game applies
// every attack-speed modifier (Quickness included) and only then rounds to the
// nearest action tick. Rounding the Quickness duration first — as the shared
// scheduler does — then dividing here would double-round and run long.
function roundToActionTick(durationSeconds: number): number {
  return (Math.round((durationSeconds * 1000) / ACTION_TICK_MS) * ACTION_TICK_MS) / 1000;
}

function modifyCastDuration(context: WarriorCastContext, duration: number): number {
  const skill = context.skill;
  const weaponSet = context.state.activeWeaponSet === 2 ? 2 : 1;
  const offhand = String(gw2ConfiguredWeaponSet(context.config, weaponSet)[1] || '');
  const measured = Number(skill.dualWieldCastTimeMs || 0);
  const dualWielding =
    hasTrait(context, TRAIT.DUAL_WIELDING) &&
    DUAL_WIELD_OFFHANDS.has(offhand) &&
    !DUAL_WIELDING_EXCLUDED_SKILL_IDS.has(Number(skill.id)) &&
    (skill.type === 'Weapon' ||
      skill.type === 'Utility' ||
      Boolean(skill.weapon) ||
      Boolean(skill.burst) ||
      measured > 0);
  if (!dualWielding) return duration;
  // A measured Dual Wielding cast (captured under Quickness) is used verbatim;
  // the 1.25 divide is only a fallback for skills without a measured value.
  if (measured > 0 && context.hasBuff('quickness', context.start)) {
    return measured / 1000;
  }

  return roundToActionTick(duration / 1.25);
}

export const warriorCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyWarriorAttributes,
  modifierRules: warriorModifierRules,
  compileModifierRules: (rules: readonly Gw2ModifierRule[]) => createModifierHooks({ rules })
});

export const warriorCoreCastRules = Object.freeze({
  availability: {
    id: 'warrior.resource',
    order: 10,
    handler: warriorCastAvailability
  },
  modifyCastDuration,
  modifyRechargeDuration
});

export const warriorCoreSchedulerHooks = Object.freeze({
  initialize: initializeWarriorTraits,
  onCastStart: beginWarriorSkill,
  // Core weapon-swap traits extend the shared transition through one hook.
  onWeaponSwap: applyWarriorWeaponSwapTraits,
  advance: {
    id: 'warrior.core-resources-and-traits',
    order: 10,
    handler: (context: WarriorSchedulerContext, target: number) => {
      advanceWarriorResources(context, target);
      advanceWarriorTraits(context, target);
    }
  },
  onEventScheduled: {
    id: 'warrior.adrenaline',
    order: 10,
    handler: observeWarriorEvent
  },
  onCastComplete: {
    id: 'warrior.core-skill-completion',
    order: 10,
    handler: completeWarriorSkill
  },
  taskHandlers: Object.freeze({
    'warrior.adrenaline-hit': handleWarriorAdrenalineTask,
    'warrior.arms-critical': handleWarriorArmsCriticalTask
  })
});
