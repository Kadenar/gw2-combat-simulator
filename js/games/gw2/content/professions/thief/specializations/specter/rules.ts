import { MODIFIER_TARGET } from '../../../../../platform/combat/modifiers/rules.js';
import { emitStateSnapshot } from '../../../../../platform/engine/events/state-snapshots.js';
import { professionStaticRulesApplied } from '../../../../../platform/builds/attribute-provenance.js';
import { isGw2PlayerModifierEligibleEvent } from '../../../../../platform/combat/state/event-ownership.js';
import { hasTrait } from '../../../../../platform/combat/state/traits.js';
import { THIEF_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { snapshotThiefState } from '../../core/state.js';
import { specterCastAvailability } from './availability.js';
import { advanceSpecterResources, spendSpecterResources } from './shroud.js';
import { specterState } from './state.js';
import { handleDarkSentry, handleLarcenousTorment, observeSpecterEvent } from './traits.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../../../platform/combat/modifiers/types.js';
import type { Gw2ResolvedStats } from '../../../../../platform/combat/query/types.js';
import { thiefBalanceProfile } from '../../core/profiles.js';
import { SPECTER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import type { ThiefSchedulerContext } from '../../types.js';
import { gw2PrimaryWeapon } from '../../../../../platform/equipment/weapons/loadout.js';

export const specterSchedulerHooks = Object.freeze({
  advance: advanceSpecterResources,
  onCastStart: spendSpecterResources,
  onCooldownReset: {
    id: 'thief.specter-shadow-force-reset',
    order: 20,
    // The training-area reset refills Shadow Force without forcing Specter out of Shadow Shroud.
    handler: (context: ThiefSchedulerContext): void => {
      const state = specterState.from(context);
      state.shadowForce = state.maximumShadowForce;
      state.shadowForceUpdatedAt = context.state.time;
      emitStateSnapshot(
        context,
        'thief',
        context.state.time,
        'cooldown-reset',
        snapshotThiefState(context.state.profession)
      );
    }
  },
  onEventScheduled: {
    id: 'thief.specter-events',
    order: 30,
    handler: observeSpecterEvent
  },
  taskHandlers: Object.freeze({
    'thief.larcenous-torment': handleLarcenousTorment,
    'thief.specter-dark-sentry': handleDarkSentry
  })
});

// Second Opinion grants an extra +90 condition damage only while wielding Scepter in the active set.
function wieldingScepter(context: Gw2ModifierContext): boolean {
  const activeSet = Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1;
  return gw2PrimaryWeapon(context.config, activeSet) === 'Scepter';
}

function modifySpecterAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  if (professionStaticRulesApplied(context.config)) return attributes;
  const result = { ...attributes };
  // Conversions read gear-only stats. config.stats excludes might
  // (baked into the seed's condition damage) and live trait bonuses.
  // Using gear stats directly avoids double-counting the flat bonuses added below.
  const gearConditionDamage = Number(context.config?.stats?.conditionDamage || 0);
  const gearVitality = Number(context.config?.stats?.vitality || 0);
  if (hasTrait(context, TRAIT.SECOND_OPINION)) {
    const profile = thiefBalanceProfile(context, PROFILE.secondOpinion);
    result.healingPower =
      Number(result.healingPower || 0) + gearConditionDamage * Number(profile?.attributeConversion || 0.07);
    result.conditionDamage =
      Number(result.conditionDamage || 0) +
      Number(profile?.attributeBonus || 90) +
      (wieldingScepter(context) ? Number(profile?.attributePerStack || 90) : 0);
  }

  if (hasTrait(context, TRAIT.STRENGTH_OF_SHADOWS)) {
    result.expertise =
      Number(result.expertise || 0) +
      gearVitality * Number(thiefBalanceProfile(context, PROFILE.strengthOfShadows)?.attributeConversion || 0.13);
  }

  return result;
}

export const specterModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'thief.strength-of-shadows',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.2,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, TRAIT.STRENGTH_OF_SHADOWS) &&
      context.event?.condition === 'Torment'
  }
]);

export const specterAttributeRules = Object.freeze({
  modifyAttributes: modifySpecterAttributes,
  modifierRules: specterModifierRules
});

export const specterCastRules = Object.freeze({
  availability: {
    id: 'thief.specter-availability',
    order: 20,
    handler: specterCastAvailability
  }
});
