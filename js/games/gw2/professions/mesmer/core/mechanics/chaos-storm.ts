import { ACTOR } from '#gw2/platform/constants.js';
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/core/profiles.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Alternates two and three whole Poison applications per completed storm, keeping each cast's pulses independent. */
export function scheduleChaosStormPoison(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const { skill, start: castStart, fullEnd: castEnd, id: activationId } = cast;
  // Resolve the selected profile so edits and explicit effect removal apply to every new cast.
  const profile = requireBalanceProfileFromContext(context, PROFILE.chaosStormPoison);
  const effect = requireEffect(profile, 'condition', 'Poison');

  if (!effect?.ticks?.length) return;

  const parity = professionCoreState(context).chaosStormCasts++ % 2;
  for (const application of materializeSkillEffectApplications({
    skill,
    effect: {
      ...effect,
      name: undefined,
      ticks: effect.ticks.filter((_tick, index) => index % 2 !== parity)
    },
    start: castStart,
    fullEnd: castEnd,
    baseEvent: {
      activationId,
      source: 'Player',
      sourceId: skill.id,
      actorType: ACTOR.PLAYER,
      skillId: skill.id,
      skillName: skill.name
    }
  })) {
    context.effects.emit({ kind: 'packet', event: { ...application.event, offTarget: cast.command.offTarget } });
  }
}
