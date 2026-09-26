import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import type { BalanceProfile, Skill, SkillEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { RevenantRuntimeState } from '#gw2/professions/revenant/types.js';

export type RevenantRuntime = Gw2Runtime<RevenantRuntimeState>;

/** Permanent configured boons and executed applications both count; pending packets never do. */
export function revenantBoonActive(runtime: RevenantRuntime, kind: string): boolean {
  if (Number(runtime.config.boons?.[kind] ?? 0) > 0 || runtime.config.boons?.[kind] === true) return true;
  return buffApplicationStacks(runtime.boons.get(kind) ?? [], kind, runtime.time, 1, { ordered: true }) > 0;
}

/**
 * Materializes an authored profile or proc skill at one instant with the triggering source's attribution.
 * Invocation traits, Renegade profiles, and Numinous-style packages share this single live path.
 */
export function emitRevenantProfile(
  runtime: RevenantRuntime,
  profile: BalanceProfile | Skill,
  {
    at = runtime.time,
    fullEnd = at,
    sourceId,
    eventSkill = profile,
    activationId,
    cause = null,
    predicate = () => true,
    effects = profile.effects ?? []
  }: {
    readonly at?: number;
    readonly fullEnd?: number;
    readonly sourceId: SkillId;
    readonly eventSkill?: { readonly id: SkillId; readonly name: string };
    readonly activationId?: string;
    readonly cause?: Gw2ResolverEvent | null;
    readonly predicate?: (effect: SkillEffect) => boolean;
    readonly effects?: readonly SkillEffect[];
  }
): void {
  emitEffects(runtime, {
    owner: profile,
    effects: effects.filter(predicate),
    at,
    fullEnd,
    // Each packet keeps its authored actor; the profile's owner and the triggering activation supply the rest.
    baseEvent: (effect) => ({
      ...(activationId ? { activationId } : {}),
      source: 'revenant',
      sourceId,
      actorType: effect.actorType || 'player',
      skillId: eventSkill.id,
      skillName: eventSkill.name
    }),
    skillWeaponFallback: 'Unequipped',
    cause
  });
}
