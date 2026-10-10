import { attributeContext, resolveAttributeContributions } from '#gw2/platform/builds/attribute-evaluation.js';
import { ATTRIBUTE_NAMES, attributeSeed, attributeSourcePool } from '#gw2/platform/builds/attribute-inputs.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2AttributeContributions } from '#gw2/platform/builds/types.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { strengthOfStone } from '#gw2/professions/elementalist/core/traits/earth/index.js';
import { burningRage } from '#gw2/professions/elementalist/core/traits/fire/index.js';

import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { CatalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import type { ElementalistModifierContext, ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
export const CATALYST_BASE_EMPOWERMENT_TASK = 'elementalist.catalyst-base-empowerment';
/**
 * Adds timed Elemental Empowerment stacks: expired stacks are dropped first, and
 * once the cap is reached each new stack evicts the soonest-expiring one.
 */
export function grantCatalystElementalEmpowerment(
  state: CatalystState,
  at: number,
  duration: number,
  stacks: number,
  maximumStacks: number
): void {
  // Timed stacks use the same tick-aligned expiry as their emitted buff applications.
  const expiresAt = gw2EffectExpiresAt(at, Math.max(0, duration));
  const active = state.elementalEmpowermentExpiries.filter((expiry) => expiry > at).sort((left, right) => left - right);
  for (let stack = 0; stack < Math.max(1, stacks); stack += 1) {
    if (active.length >= maximumStacks) {
      active.shift();
    }

    if (expiresAt > at) active.push(expiresAt);
    active.sort((left, right) => left - right);
  }

  state.elementalEmpowermentExpiries = active;
}

/** Track accepted empowerment grants independently of current selection so applied effects retain their lifetime. */
export function applyCatalystEmpowerment(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  const kind = (event.kind || '').toLowerCase();
  if (kind !== 'elemental empowerment' || !event.resolvedAudience?.includesSelf) {
    return;
  }

  const state = catalystState.from(context);
  const elementalEmpowermentProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_EMPOWERMENT);
  grantCatalystElementalEmpowerment(
    state,
    event.at,
    event.duration || 0,
    event.stacks || 1,
    balanceProfileNumber(elementalEmpowermentProfile, 'maximumStacks')
  );
}

/** Baseline stacks are granted by actual buff application; one task renews their profile window. */
export function renewBaseEmpowerment(runtime: ElementalistRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.ELEMENTAL_EMPOWERMENT);
  const duration = balanceProfileNumber(profile, 'durationMultiplier');
  // Recurring work must advance the canonical clock, including sub-microsecond profile overrides.
  const renewAt = canonicalTime(runtime.time + duration);
  if (renewAt <= runtime.time) throw new RangeError('Elemental Empowerment renewal must advance the simulation clock.');
  runtime.effects.emit(
    elementalistBuffRequest(
      {
        at: runtime.time,
        source: 'Trait',
        sourceId: TRAIT.ELEMENTAL_EMPOWERMENT,
        actorType: 'player',
        skillName: 'Elemental Empowerment',
        kind: 'elemental empowerment',
        stacks: balanceProfileNumber(profile, 'playerStacks'),
        duration
      },
      undefined
    )
  );
  runtime.schedule(CATALYST_BASE_EMPOWERMENT_TASK, renewAt, null);
}

function catalystModifierState(context: ElementalistModifierContext): CatalystStateLike {
  return readProfessionSpecializationState<CatalystStateLike>(context.runtime?.profession, 'Catalyst') || {};
}

interface CatalystStateLike {
  readonly elementalEmpowermentExpiries?: readonly number[];
}
/** Empowerment declares bonuses from its named source, with per-stat rounding and no ordinary chaining. */
export function elementalEmpowermentAttributes(context: ElementalistModifierContext): Gw2AttributeContributions {
  // Attribute reads count live stacks without rebuilding or mutating the runtime pool.
  const timedStacks = activeStackCount(catalystModifierState(context).elementalEmpowermentExpiries || [], context.time);
  const elementalEmpowermentProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_EMPOWERMENT);
  const maximumStacks = balanceProfileNumber(elementalEmpowermentProfile, 'maximumStacks');
  const stacks = Math.min(maximumStacks, timedStacks);
  const multiplier = empowermentAttributeMultiplier(context, elementalEmpowermentProfile, stacks, maximumStacks);
  const pool = catalystAttributePool(context);
  return {
    attributeEffects: (
      ['power', 'precision', 'ferocity', 'conditionDamage', 'expertise', 'concentration'] as const
    ).map((stat) => {
      const bonus = (pool[stat] ?? 0) * multiplier;
      return {
        kind: 'flat',
        to: ATTRIBUTE_NAMES[stat],
        feedsConversions: false,
        amount: ['power', 'conditionDamage'].includes(stat) ? Math.round(bonus) : bonus
      };
    })
  };
}

/** Empowered Empowerment substitutes its scaling at the same live-stack attribute boundary. */
function empowermentAttributeMultiplier(
  context: ElementalistModifierContext,
  profile: BalanceProfile,
  stacks: number,
  maximumStacks: number
): number {
  return hasTrait(context, TRAIT.EMPOWERED_EMPOWERMENT)
    ? stacks === maximumStacks
      ? balanceProfileNumber(profile, 'attributeConversion')
      : stacks * balanceProfileNumber(profile, 'coefficientMultiplier')
    : stacks * balanceProfileNumber(profile, 'attributePerStack');
}

/** Empowerment reads common sources plus declared trait Condition Damage, excluding temporary buffs and passives. */
export function catalystAttributePool(context: ElementalistModifierContext) {
  const pool = attributeSourcePool(context.config ?? {}, 'catalyst', context.runtime?.activeWeaponSet);
  const facts = attributeContext(context, {
    catalog: (context.catalog ?? context.profession?.catalog)!,
    modifierRulesById: new Map()
  });
  const traits = [burningRage, strengthOfStone].filter((trait) => hasTrait(context, trait.id));
  pool.conditionDamage +=
    resolveAttributeContributions(
      attributeSeed(context.config ?? {}, facts.weaponSet).conversionPool,
      traits.map((trait) => trait.attributes!(facts))
    ).attributes['Condition Damage'] ?? 0;
  return pool;
}
