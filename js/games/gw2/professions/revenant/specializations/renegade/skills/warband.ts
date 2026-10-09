import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { RENEGADE_ENHANCED_SKILL_BY_ID } from '#gw2/professions/revenant/data/renegade-enhanced-skills.js';
import { bandTogetherReady } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import { RENEGADE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { renegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import { grantAllForOneEnergy } from '#gw2/professions/revenant/specializations/renegade/traits/behavior.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

// Band Together's selected profile is an acceptance fact: the window is consumed before effects are selected.
export const bandTogether = new WeakMap<RuntimeCast<RevenantSkill>, { enhanced: boolean; profileSkillId: SkillId }>();

function enhancedSkill(runtime: RevenantRuntime, skillId: SkillId): RevenantSkill | undefined {
  const enhancedId = RENEGADE_ENHANCED_SKILL_BY_ID[Number(skillId)];
  return enhancedId == null ? undefined : runtime.helpers.skillsById.get(enhancedId);
}

/** A committed warband summon consumes Band Together at acceptance and selects its enhanced profile. */
export function beginBandTogether(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const state = renegadeState.from(runtime);
  const enhanced = bandTogetherReady(runtime, cast.skill.id);
  const profile = enhanced ? enhancedSkill(runtime, cast.skill.id) : undefined;
  // Capture the accepted profile before spending; later grants cannot change this cast's effects or rewards.
  bandTogether.set(cast, { enhanced, profileSkillId: profile?.id ?? cast.skill.id });
  if (enhanced) consumeCharge(state.bandTogether, runtime.time);
  grantAllForOneEnergy(runtime, enhanced);
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
        actorType: effect.actorType || 'player',
        skillId: cast.skill.id,
        skillName: cast.skill.name
      }),
      skillWeaponFallback: 'Unequipped',
      cause: null
    });
}

/** Razorclaw's Rage arms live player and allied charges with their own expiry and ICD. */
export function razorclawsRage(
  runtime: RevenantRuntime,
  cast: RuntimeCast<RevenantSkill>,
  profile: RevenantSkill
): void {
  const buff = profile.effects?.find((effect) => effect.type === 'buff' && effect.kind === 'razorclaws-rage');
  const proc = runtime.helpers.skillsById.get(PROFILE.razorclawsRageProc);
  if (!proc) throw new Error("Missing Razorclaw's Rage proc declaration.");
  const bleed = requireEffect(proc, 'condition', 'Bleeding');
  // Charges exist only to deliver the empowered bleed, so either removal arms nothing.
  if (!buff || !bleed) return;
  const duration = Math.max(0, effectNumber(profile, buff, 'duration'));
  const charges = Math.max(0, Math.trunc(effectNumber(profile, buff, 'stacks')));
  renegadeState.from(runtime).razorclawsRage = {
    ...grantCharges(charges, runtime.time + duration),
    readyAt: runtime.time
  };
  // Reapplication replaces recipient charges without resetting the ally's strike cadence.
  runtime.alliedStrikes.registerRecipients((allyIndex) => ({
    id: `razorclaw:${allyIndex}`,
    expiresAt: runtime.time + duration,
    inclusiveExpiry: true,
    charges,
    internalCooldown: Math.max(0, proc.cooldown || 0),
    trigger(allied) {
      runtime.effects.emit({
        kind: 'packet',
        event: buildResolverCondition({
          at: allied.at,
          source: 'revenant',
          sourceId: cast.skill.id,
          actorType: bleed.actorType || 'player',
          skillId: cast.skill.id,
          skillName: cast.skill.name,
          activationId: `${cast.id}:${allied.activationId}`,
          name: `${cast.skill.name} — Ally ${allied.allyIndex} Bleeding`,
          condition: String(bleed.condition),
          stacks: effectNumber(proc, bleed, 'stacks'),
          duration: effectNumber(proc, bleed, 'duration'),
          metadata: { triggeredByAlly: allied.allyIndex }
        })
      });
    }
  }));
}

/** Completion arms Razorclaw's charges and, for an ordinary summon, the next Band Together enhancement. */
export function completeBandTogether(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const selected = bandTogether.get(cast);
  bandTogether.delete(cast);
  if (!selected) return;
  if (selected.enhanced) return;
  const window = requireBalanceProfileFromContext(runtime, PROFILE.bandTogether);
  const effect = requireEffect(window, 'buff', 'band-together');
  // The enhancement window is the buff, so a removed buff arms no enhancement.
  if (!effect) return;
  const state = renegadeState.from(runtime);
  state.bandTogether = grantCharges(1, runtime.time + Math.max(0, effectNumber(window, effect, 'duration')));
  runtime.effects.emit({
    kind: 'profile',
    profile: window,
    effects: window.effects ?? [],
    attribution: (effect) => ({
      activationId: cast.id,
      source: 'revenant',
      sourceId: window.id,
      actorType: effect.actorType || 'player',
      skillId: window.id,
      skillName: window.name
    }),
    skillWeaponFallback: 'Unequipped',
    cause: null
  });
}

/** A ready, unexpired Razorclaw charge becomes an empowered Bleeding on a landed player strike. */
export function razorclawProc(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (event.skillId === ID.RAZORCLAWS_RAGE) return;
  const razorclaw = renegadeState.from(runtime).razorclawsRage;
  // Keep activation and same-timestamp gating even when the profile has zero ICD.
  if (!isInternalCooldownReady(runtime.time, razorclaw.readyAt)) return;
  const profile = runtime.helpers.skillsById.get(PROFILE.razorclawsRageProc);
  if (!profile) throw new Error("Missing Razorclaw's Rage proc declaration.");
  const effect = requireEffect(profile, 'condition', 'Bleeding');
  // Charges exist only to deliver the bleed, so a removed packet leaves them unspent.
  if (!effect) return;
  const cooldown = Math.max(0, profile.cooldown || 0);
  if (!consumeCharge(razorclaw, runtime.time, cooldown)) return;
  if (cooldown === 0) razorclaw.readyAt = runtime.time;
  runtime.effects.emit({
    kind: 'packet',
    cause: event,
    event: buildResolverCondition({
      at: runtime.time,
      source: 'revenant',
      sourceId: ID.RAZORCLAWS_RAGE,
      actorType: 'player',
      skillId: ID.RAZORCLAWS_RAGE,
      skillName: "Razorclaw's Rage",
      name: "Razorclaw's Rage — Bleeding",
      condition: String(effect.condition),
      stacks: effectNumber(profile, effect, 'stacks'),
      duration: effectNumber(profile, effect, 'duration')
    })
  });
}
