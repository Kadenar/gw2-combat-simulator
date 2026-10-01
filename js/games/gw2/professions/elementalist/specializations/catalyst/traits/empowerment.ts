import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import { readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import type { CatalystEmpowermentPool } from '#gw2/professions/elementalist/build/types.js';
import { emitElementalistBuff } from '#gw2/professions/elementalist/core/events.js';
import { queueElementalistBuff } from '#gw2/professions/elementalist/core/mechanics/reactions.js';
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
export function applyCatalystEmpowerment(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
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

// Vicious Empowerment's payouts all share one source name.
function queueCatalystBuff(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  kind: string,
  stacks: number,
  duration: number
): void {
  queueElementalistBuff(context, event, kind, stacks, duration, 'Vicious Empowerment');
}

/**
 * Trigger Vicious Empowerment from qualifying control or immobilize events while
 * enforcing its shared internal cooldown.
 *
 * Pays Elemental Empowerment stacks plus might, and ignores anything landing
 * before combat start.
 */
export function applyViciousEmpowerment(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  const immobilize = event.condition === 'Immobilized';
  if (
    !hasTrait(context, TRAIT.VICIOUS_EMPOWERMENT) ||
    event.actorType !== 'player' ||
    (event.type !== 'control' && !immobilize) ||
    (context.combatStartTime != null && event.at < context.combatStartTime)
  ) {
    return;
  }

  // The trait claims its interval independently of its optional buff packets.
  if (!context.procs.claim(TRAIT.VICIOUS_EMPOWERMENT, 'elementalist.catalyst.viciousEmpowerment', event.at)) return;
  const viciousEmpowermentProfile = requireBalanceProfileFromContext(context, TRAIT.VICIOUS_EMPOWERMENT);
  const empowerment = requireEffect(viciousEmpowermentProfile, 'buff', 'Empowerment');
  const might = requireEffect(viciousEmpowermentProfile, 'boon', 'Might');
  if (empowerment) {
    queueCatalystBuff(context, event, 'elemental empowerment', Number(empowerment.stacks), empowerment.duration);
  }

  if (might) {
    queueCatalystBuff(context, event, String(might.boon), Number(might.stacks), might.duration);
  }

  context.recordProc('trait', 'Vicious Empowerment', event.at, event.skillName);
}

/** Baseline stacks are granted by actual buff application; one task renews their profile window. */
export function renewBaseEmpowerment(runtime: ElementalistRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.ELEMENTAL_EMPOWERMENT);
  const duration = balanceProfileNumber(profile, 'durationMultiplier');
  // Recurring work must advance the canonical clock, including sub-microsecond profile overrides.
  const renewAt = canonicalTime(runtime.time + duration);
  if (renewAt <= runtime.time) throw new RangeError('Elemental Empowerment renewal must advance the simulation clock.');
  emitElementalistBuff(runtime, {
    at: runtime.time,
    source: 'Elemental Empowerment',
    sourceId: 'Elemental Empowerment',
    actorType: 'player',
    skillName: 'Elemental Empowerment',
    kind: 'elemental empowerment',
    stacks: balanceProfileNumber(profile, 'playerStacks'),
    duration
  });
  runtime.schedule(CATALYST_BASE_EMPOWERMENT_TASK, renewAt, null);
}

function catalystModifierState(context: ElementalistModifierContext): CatalystStateLike {
  return readProfessionSpecializationState<CatalystStateLike>(context.runtime?.profession, 'Catalyst') || {};
}

interface CatalystStateLike {
  readonly elementalEmpowermentExpiries?: readonly number[];
}

// Apply live Elemental Empowerment stacks as an all-attribute multiplier without
// mutating the shared resolved-stat object.
export function applyElementalEmpowermentAttributes(
  context: ElementalistModifierContext,
  attributes: Gw2Stats
): Gw2Stats {
  if (!hasTrait(context, TRAIT.ELEMENTAL_EMPOWERMENT)) return attributes;

  // Attribute reads count live stacks without rebuilding or mutating the runtime pool.
  const timedStacks = activeStackCount(catalystModifierState(context).elementalEmpowermentExpiries || [], context.time);
  const elementalEmpowermentProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_EMPOWERMENT);
  const maximumStacks = balanceProfileNumber(elementalEmpowermentProfile, 'maximumStacks');
  const stacks = Math.min(maximumStacks, timedStacks);
  const multiplier = empowermentAttributeMultiplier(context, elementalEmpowermentProfile, stacks, maximumStacks);
  // The build may pin the attribute pool the bonus is computed from; otherwise the
  // incoming resolved attributes are used.
  const pool = context.config?.catalystEmpowermentPool as Partial<CatalystEmpowermentPool> | undefined;
  const modified = { ...attributes };

  for (const stat of ['power', 'precision', 'ferocity', 'conditionDamage', 'expertise', 'concentration'] as const) {
    const eligible = pool?.[stat] ?? modified[stat] ?? 0;
    const bonus = eligible * multiplier;
    modified[stat] = (modified[stat] || 0) + (['power', 'conditionDamage'].includes(stat) ? Math.round(bonus) : bonus);
  }

  return modified;
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
