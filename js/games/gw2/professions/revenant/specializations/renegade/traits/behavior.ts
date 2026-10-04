import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { resourceAtLeast } from '#gw2/platform/combat/resources/pool.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile, Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import {
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState
} from '#gw2/professions/revenant/core/state-queries.js';
import { REVENANT_MAXIMUM_ENDURANCE } from '#gw2/professions/revenant/core/state.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { activeKallasFervorStacks } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import {
  RENEGADE_PROFILE_IDS as PROFILE,
  RENEGADE_PROFILE_IDS
} from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { renegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Applies the trait at the mechanic's existing execution boundary. */
export function grantAllForOneEnergy(runtime: RevenantRuntime, enhanced: boolean): void {
  if (enhanced && hasTrait(runtime, TRAIT.ALL_FOR_ONE))
    runtime.resourceController.grant(
      'energy',
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.allForOne), 'resourceGain')
    );
}

/** Adds one Kalla's Fervor stack; at the cap it replaces the soonest-expiring stack so hits sustain Fervor. */
export function grantKallasFervor(
  runtime: RevenantRuntime,
  { sourceId, sourceName, cause = null }: { sourceId: SkillId; sourceName: string; cause?: Gw2ResolverEvent | null }
): void {
  const state = renegadeState.from(runtime);
  const profile = fervorProfile(runtime);
  const effect = requireEffect(profile, 'buff', 'kallas-fervor');
  // Fervor stacks are the buff, so a removed buff grants nothing.
  if (!effect) return;
  const maximum = Math.max(1, balanceProfileNumber(profile, 'maximumStacks'));
  state.kallasFervorMaximumStacks = maximum;
  state.kallasFervor = state.kallasFervor.filter((application) => application.expiresAt > runtime.time);
  if (activeKallasFervorStacks(state, runtime.time, maximum) >= maximum)
    state.kallasFervor.sort((left, right) => left.expiresAt - right.expiresAt).shift();
  const duration = Math.max(0, effectNumber(profile, effect, 'duration'));
  state.kallasFervor.push({ at: runtime.time, expiresAt: runtime.time + duration });
  runtime.effects.emit({
    kind: 'packet',
    event: {
      ...{
        type: 'buff',
        at: runtime.time,
        source: 'revenant',
        sourceId,
        actorType: effect.actorType || 'player',
        skillId: sourceId,
        skillName: sourceName,
        name: `${sourceName} — Kalla's Fervor`,
        kind: String(effect.kind),
        duration,
        stacks: effectNumber(profile, effect, 'stacks')
      },
      fixedDuration: true
    },
    cause
  });
}

/** Actual critical and positional facts drive Ambush Commander and Endless Enmity. */
export function criticalTraits(runtime: RevenantRuntime, event: Gw2ResolverEvent, hit?: Gw2HitResolutionContext): void {
  const ambush = hasTrait(runtime, TRAIT.AMBUSH_COMMANDER);
  if (!ambush) return;
  const critical = Boolean(hit?.critEligible && hit.critical.didCrit);
  // A defiant golem never rotates, so flanking/behind positional triggers always apply.
  if (Boolean(runtime.config.target?.defiant) || critical)
    grantKallasFervor(runtime, { sourceId: TRAIT.AMBUSH_COMMANDER, sourceName: 'Ambush Commander', cause: event });
}

/** Ashen Demeanor grants its Fervor and self boons once per healing-skill cooldown. */
export function ashenDemeanor(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  if (cast.skill.slot !== 'Heal' || !hasTrait(runtime, TRAIT.ASHEN_DEMEANOR)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.ashenDemeanor);
  if (!runtime.procs.claimCooldown('ashenDemeanor', runtime.time, balanceProfileNumber(profile, 'cooldown'))) return;
  for (let stack = 0; stack < Math.max(0, balanceProfileNumber(profile, 'fervorStacks')); stack += 1)
    grantKallasFervor(runtime, { sourceId: TRAIT.ASHEN_DEMEANOR, sourceName: profile.name });
  for (const effect of profile.effects?.filter((candidate) => candidate.type === 'boon') ?? [])
    runtime.effects.emit({
      kind: 'packet',
      event: {
        type: 'buff',
        at: runtime.time,
        source: 'revenant',
        sourceId: TRAIT.ASHEN_DEMEANOR,
        actorType: 'player',
        skillId: TRAIT.ASHEN_DEMEANOR,
        skillName: profile.name,
        activationId: cast.id,
        name: `${profile.name} — ${String(effect.boon)}`,
        kind: String(effect.boon),
        duration: effectNumber(profile, effect, 'duration'),
        stacks: effectNumber(profile, effect, 'stacks'),
        audience: effect.audience ?? { recipients: 'self' }
      }
    });
}

/** Received Fury advances Blood Fury's Fervor on its own cooldown. */
export function furyTraits(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if ((event.kind || '').toLowerCase() !== 'fury') return;
  if (hasTrait(runtime, TRAIT.BLOOD_FURY)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.bloodFury);
    // The Fury trigger claims its interval even if Fervor is already capped.
    if (
      !runtime.procs.claimCooldown(
        'revenant.renegade.bloodFury',
        runtime.time,
        Math.max(0, balanceProfileNumber(profile, 'cooldown'))
      )
    )
      return;
    grantKallasFervor(runtime, { sourceId: TRAIT.BLOOD_FURY, sourceName: 'Blood Fury', cause: event });
  }
}

/** Adds protection only for the selected enhancement, retaining the order's pulse cadence. */
export const boldReversalOrderEffects: NonNullable<NonNullable<Skill['effectVariants']>[number]['transform']> = (
  runtime,
  _cast,
  effects
) =>
  hasTrait(runtime, TRAIT.BOLD_REVERSAL)
    ? [...effects, ...(requireBalanceProfileFromContext(runtime, PROFILE.boldReversalRighteousRebel).effects ?? [])]
    : effects;

export function modifyRenegadeCriticalChance(context: Gw2ModifierContext, chance: number): number {
  if (!hasTrait(context, TRAIT.BRUTAL_MOMENTUM)) return chance;
  const state = revenantRuntimeCoreState(context);
  const maximum = REVENANT_MAXIMUM_ENDURANCE;
  const full = resourceAtLeast(state.endurance || 0, maximum);
  const brutalMomentumProfile = requireBalanceProfileFromContext(context, RENEGADE_PROFILE_IDS.brutalMomentum);
  // At full endurance: +33% crit; below full: +10% crit
  return chance + balanceProfileNumber(brutalMomentumProfile, full ? 'fullEnduranceCriticalChance' : 'criticalChance');
}

export function kallasFervorStacks(context: Gw2ModifierContext): number {
  return activeKallasFervorStacks(revenantRuntimeSpecializationState(context, 'Renegade'), context.time);
}

export function fervorProfile(runtime: RevenantRuntime): BalanceProfile {
  return requireBalanceProfileFromContext(
    runtime,
    hasTrait(runtime, TRAIT.LASTING_LEGACY) ? PROFILE.kallasFervorLastingLegacy : PROFILE.kallasFervor
  );
}

/** Chooses the Heroic Command payload after live Fervor has been counted. */
export function heroicCommandProfile(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>) {
  const source = hasTrait(runtime, TRAIT.LASTING_LEGACY)
    ? requireBalanceProfileFromContext(runtime, PROFILE.heroicCommandLastingLegacy)
    : cast.skill;
  return source;
}

/** Supplies Orders from Above's trait-selected pulse variant at skill materialization. */
export const righteousRebelOrderVariants: NonNullable<Skill['effectVariants']> = [
  {
    when: (runtime) => hasTrait(runtime, TRAIT.RIGHTEOUS_REBEL),
    profileId: PROFILE.ordersFromAboveRighteousRebel,
    transform: boldReversalOrderEffects
  }
];
