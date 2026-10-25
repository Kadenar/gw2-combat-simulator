import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import {
  activeChargeCount,
  consumeCharge,
  grantCharges,
  type ChargeGrant
} from '#gw2/platform/combat/resources/charges.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { RENEGADE_ENHANCED_SKILL_BY_ID } from '#gw2/professions/revenant/data/renegade-enhanced-skills.js';
import { bandTogetherReady } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import { RENEGADE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { renegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

// Band Together's selected profile is an acceptance fact: the window is consumed before effects are selected.
export const bandTogether = new WeakMap<RuntimeCast<RevenantSkill>, { enhanced: boolean; profileSkillId: SkillId }>();

function enhancedSkill(runtime: RevenantRuntime, skillId: SkillId): RevenantSkill | undefined {
  const enhancedId = RENEGADE_ENHANCED_SKILL_BY_ID[Number(skillId)];
  return enhancedId == null ? undefined : runtime.helpers.skillsById.get(enhancedId);
}

/** A committed warband summon consumes Band Together at acceptance and selects its enhanced profile. */
export function beginBandTogether(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const enhanced = bandTogetherReady(runtime, cast.skill.id);
  const profile = enhanced ? enhancedSkill(runtime, cast.skill.id) : undefined;
  // Capture the accepted profile before spending; later grants cannot change this cast's effects or rewards.
  bandTogether.set(cast, { enhanced, profileSkillId: profile?.id ?? cast.skill.id });

  // End the active buff before rewards so another accepted summon cannot reuse it.
  if (enhanced)
    runtime.combat.reviseBuffExpiry(
      'band-together',
      () => true,
      (expiry) => Math.min(expiry, runtime.time)
    );

  runtime.fireTrigger(warbandCompleted, { enhanced });

  if (profile)
    runtime.effects.emit({
      kind: 'profile',
      profile: profile,
      at: cast.start,
      fullEnd: cast.effectiveEnd,
      effects: profile.effects ?? [],
      attribution: (effect) => ({
        activationId: cast.id,
        source: 'revenant',
        sourceId: cast.skill.id,
        actorType: effect.actorType || ACTOR.PLAYER,
        skillId: cast.skill.id,
        skillName: cast.skill.name
      }),
      skillWeaponFallback: 'Unequipped',
      cause: null
    });
}

/** A missing proc declaration is invalid content, unlike an explicitly removed Bleeding that leaves charges unspent. */
function razorclawProcProfile(runtime: RevenantRuntime): RevenantSkill {
  const proc = runtime.helpers.skillsById.get(PROFILE.razorclawsRageProc);

  if (!proc) throw new Error("Missing Razorclaw's Rage proc declaration.");

  return proc;
}

/** Razorclaw's Rage arms the player and each assumed ally with an independent replacement grant. */
export function razorclawsRage(
  runtime: RevenantRuntime,
  cast: RuntimeCast<RevenantSkill>,
  profile: RevenantSkill
): void {
  const buff = profile.effects?.find((effect) => effect.type === 'buff' && effect.kind === 'razorclaws-rage');
  const bleed = requireEffect(razorclawProcProfile(runtime), 'condition', CONDITION.BLEEDING);

  // Charges exist only to deliver the empowered bleed, so either removal arms nothing.
  if (!buff || !bleed) return;

  const duration = Math.max(0, effectNumber(profile, buff, 'duration'));
  const charges = Math.max(0, Math.trunc(effectNumber(profile, buff, 'stacks')));
  // Every recipient's grant is blocked at its arming instant, so no strike at that timestamp can spend it.
  const arm = (): ChargeGrant => ({ ...grantCharges(charges, runtime.time + duration), readyAt: runtime.time });
  const state = renegadeState.from(runtime);
  state.razorclawsRage = arm();
  // The controller only offers strikes; each ally's charges, expiry, and cooldown follow the player's policy.
  // Reapplication replaces every grant without resetting the shared strike cadence.
  runtime.alliedStrikes.registerRecipients((allyIndex) => {
    state.alliedRazorclawsRage[allyIndex] = arm();
    const current = () => renegadeState.from(runtime).alliedRazorclawsRage[allyIndex];
    return {
      id: `razorclaw:${allyIndex}`,
      isActive: (at) => activeChargeCount(current(), at) > 0,
      trigger(allied) {
        const spent = spendRazorclawCharge(runtime, current());

        if (!spent) return false;

        runtime.effects.emit({
          kind: 'packet',
          event: razorclawBleed(spent, allied.at, {
            allyIndex: allied.allyIndex,
            activationId: `${cast.id}:${allied.activationId}`
          })
        });
      }
    };
  });
}

/**
 * Spends one recipient's charge under the single Razorclaw policy: exclusive expiry, the proc's cooldown, and at most
 * one bleed per timestamp even without a cooldown. A removed Bleeding leaves the charge unspent.
 */
function spendRazorclawCharge(runtime: RevenantRuntime, grant: ChargeGrant | undefined) {
  if (!grant || !isInternalCooldownReady(runtime.time, grant.readyAt)) return;

  const proc = razorclawProcProfile(runtime);
  const bleed = requireEffect(proc, 'condition', CONDITION.BLEEDING);

  if (!bleed) return;

  const cooldown = Math.max(0, proc.cooldown || 0);

  if (!consumeCharge(grant, runtime.time, cooldown)) return;

  if (cooldown === 0) grant.readyAt = runtime.time;

  return { proc, bleed };
}

/** Player and allied bleeds share the elite's identity; only the ally's name, activation, and tag differ. */
function razorclawBleed(
  { proc, bleed }: NonNullable<ReturnType<typeof spendRazorclawCharge>>,
  at: number,
  ally?: { readonly allyIndex: number; readonly activationId: string }
) {
  return buildResolverCondition({
    at,
    source: 'revenant',
    sourceId: ID.RAZORCLAWS_RAGE,
    actorType: ACTOR.PLAYER,
    skillId: ID.RAZORCLAWS_RAGE,
    skillName: "Razorclaw's Rage",
    name: ally ? `Razorclaw's Rage — Ally ${ally.allyIndex} Bleeding` : "Razorclaw's Rage — Bleeding",
    condition: String(bleed.condition),
    stacks: effectNumber(proc, bleed, 'stacks'),
    duration: effectNumber(proc, bleed, 'duration'),
    ...(ally && { activationId: ally.activationId, metadata: { triggeredByAlly: ally.allyIndex } })
  });
}

/** Ordinary completion grants a temporary enhancement; an empowered summon does not grant it again. */
export function completeBandTogether(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const selected = bandTogether.get(cast);
  bandTogether.delete(cast);

  if (!selected) return;

  if (selected.enhanced) return;

  const window = requireBalanceProfileFromContext(runtime, PROFILE.bandTogether);
  const effect = requireEffect(window, 'buff', 'band-together');

  // The enhancement window is the buff, so a removed buff arms no enhancement.
  if (!effect) return;

  // Reapplication replaces the previous window, even when the new duration is shorter.
  runtime.combat.reviseBuffExpiry(
    'band-together',
    () => true,
    (expiry) => Math.min(expiry, runtime.time)
  );
  runtime.effects.emit({
    kind: 'profile',
    profile: window,
    effects: window.effects ?? [],
    attribution: (effect) => ({
      activationId: cast.id,
      source: 'revenant',
      sourceId: window.id,
      actorType: effect.actorType || ACTOR.PLAYER,
      skillId: window.id,
      skillName: window.name
    }),
    skillWeaponFallback: 'Unequipped',
    cause: null
  });
}

/** A landed player strike other than Razorclaw's own spends the player's grant under the shared recipient policy. */
export function razorclawProc(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (event.skillId === ID.RAZORCLAWS_RAGE) return;

  const spent = spendRazorclawCharge(runtime, renegadeState.from(runtime).razorclawsRage);

  if (spent) runtime.effects.emit({ kind: 'packet', cause: event, event: razorclawBleed(spent, runtime.time) });
}

/** The accepted summon enhancement determines its Energy reward. */
export const warbandCompleted = defineTriggerPoint<{ readonly enhanced: boolean }>('revenant.warband-completed', [
  TRAIT.ALL_FOR_ONE
]);
