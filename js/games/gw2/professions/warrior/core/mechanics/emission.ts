import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { WarriorRuntimeState } from '#gw2/professions/warrior/types.js';

export function traitEffects(
  runtime: WarriorRuntime,
  event: Gw2ResolverEvent,
  trait: number,
  overrides: Partial<
    Pick<
      Gw2ResolverEvent,
      'stacks' | 'duration' | 'audience' | 'priority' | 'name' | 'skillName' | 'triggeredBy' | 'metadata'
    >
  > = {},
  quantity = 1,
  effects?: readonly SkillEffect[]
): void {
  const profile = requireBalanceProfileFromContext(runtime, trait);
  emitEffects(runtime, {
    owner: profile,
    effects: effects ?? profile.effects?.filter((effect) => ['boon', 'buff', 'condition'].includes(effect.type)),
    baseEvent: {
      source: 'Trait',
      sourceId: trait,
      actorType: 'effect',
      skillId: event.skillId,
      skillName: event.skillName
    },
    cause: event,
    transform: (packet) => ({
      ...packet,
      priority: 5,
      name: profile.name,
      stacks: quantity * Number(packet.stacks),
      ...overrides
    })
  });
}

export function castTraitBuff(
  runtime: WarriorRuntime,
  cast: RuntimeCast,
  trait: number,
  profileId: string | number,
  name: string,
  kind: string,
  type: 'boon' | 'buff',
  at = runtime.time,
  priority = 0
): void {
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  const effect = requireEffect(profile, type, kind);
  if (!effect) return;
  // Shared expansion preserves authored repeats while this owner retains modifier-before-impact ordering.
  for (const { event } of materializeSkillEffectApplications({
    skill: profile,
    effect,
    start: at,
    fullEnd: at,
    baseEvent: {
      source: 'Trait',
      sourceId: trait,
      actorType: 'effect',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id
    }
  })) {
    const packet = { ...event, name, priority };
    // A modifier opening at a future impact is queued now, so it precedes the same-instant hits it modifies.
    if (event.at > runtime.time) runtime.emit(packet);
    else runtime.emitProcedural(packet);
  }
}

type WarriorRuntime = Gw2Runtime<WarriorRuntimeState>;

export function triggerTraitBuffs(
  runtime: Runtime,
  cast: RuntimeCast,
  trait: number,
  stacks?: number,
  priority = 0
): void {
  if (!hasTrait(runtime, trait)) return;
  const profile = requireBalanceProfileFromContext(runtime, trait);
  emitEffects(runtime, {
    owner: profile,
    effects: profile.effects?.filter((effect) => effect.type === 'boon' || effect.type === 'buff'),
    baseEvent: {
      source: 'Trait',
      sourceId: trait,
      actorType: 'effect',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id
    },
    transform: (event) => ({
      ...event,
      name: profile.name,
      stacks: stacks ?? event.stacks,
      priority
    })
  });
}

type Runtime = Gw2Runtime<WarriorRuntimeState>;
