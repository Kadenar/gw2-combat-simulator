import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Alternates two and three whole Poison applications per completed storm, keeping each cast's pulses independent. */
export function scheduleChaosStormPoison(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const { skill, start: castStart, fullEnd: castEnd, id: activationId } = cast;
  const effect = skill.mesmerMechanic?.chaosStormPoison;
  if (!effect?.ticks?.length) return;
  const parity = professionCoreState(context).chaosStormCasts++ % 2;
  for (const application of materializeSkillEffectApplications({
    skill,
    effect: { ...effect, ticks: effect.ticks.filter((_tick, index) => index % 2 !== parity) },
    start: castStart,
    fullEnd: castEnd,
    baseEvent: {
      activationId,
      source: 'Player',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name
    }
  })) {
    context.effects.emit({ kind: 'packet', event: { ...application.event, offTarget: cast.command.offTarget } });
  }
}
