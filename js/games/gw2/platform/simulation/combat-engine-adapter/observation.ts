/** Express observation boundaries as ordinary encounter configuration and inert skills. */
import { rejectPreviewInput } from '#gw2/platform/simulation/combat-engine-adapter/input.js';
import type { AdaptedEngineRequest, CombatPreviewInput } from '#gw2/platform/simulation/combat-engine-adapter/input.js';

export const ROTATION_END_SKILL = 'adapter.rotation-end';

export function adaptObservation(
  request: AdaptedEngineRequest,
  policy: CombatPreviewInput['observationPolicy']
): AdaptedEngineRequest {
  if (policy !== undefined && (!policy || typeof policy !== 'object' || Array.isArray(policy)))
    rejectPreviewInput('observationPolicy', 'Expected an observation policy object.');
  if (policy !== undefined) {
    const allowed = [
      'kind',
      ...(policy.kind === 'tail' ? ['durationMs'] : policy.kind === 'absolute' ? ['endTimeMs'] : [])
    ];
    if (!policy.kind) rejectPreviewInput('observationPolicy.kind', 'Expected an observation kind.');
    for (const key of Object.keys(policy))
      if (!allowed.includes(key)) rejectPreviewInput(`observationPolicy.${key}`, 'Unsupported observation option.');
  }

  const kind = policy?.kind ?? 'rotation';
  if (!['rotation', 'tail', 'absolute', 'active-skills'].includes(kind))
    rejectPreviewInput('observationPolicy.kind', 'Unknown observation policy.');
  const duration = policy?.kind === 'tail' ? policy.durationMs : policy?.kind === 'absolute' ? policy.endTimeMs : 0;
  if (!Number.isSafeInteger(duration) || duration < 0)
    rejectPreviewInput('observationPolicy', 'Observation times must be non-negative integral milliseconds.');
  const encounter = request.encounter as {
    actors: {
      name: string;
      build: { skills: Record<string, unknown>[] };
      rotation?: { skill_casts: Record<string, unknown>[] };
    }[];
    termination_conditions: Record<string, unknown>[];
  };
  const player = encounter.actors.find((actor) => actor.name === 'player')!;
  // The marker is gated by the cast lane, so delayed packets do not redefine command completion.
  if (request.commandSkills.length || duration > 0) {
    player.build.skills.push({
      skill_key: ROTATION_END_SKILL,
      cast_duration: [0, 0],
      instant_cast_only_when_not_in_animation: true
    });
    player.rotation!.skill_casts.push({ skill: ROTATION_END_SKILL, cast_time_ms: 0 });
  }

  if (kind === 'tail' && duration > 0) {
    player.build.skills.push({
      skill_key: 'adapter.observation-tail',
      cast_duration: [duration, duration],
      instant_cast_only_when_not_in_animation: true
    });
    player.rotation!.skill_casts.push({ skill: 'adapter.observation-tail', cast_time_ms: 0 });
  }

  encounter.termination_conditions =
    kind === 'absolute'
      ? [{ type: 'TIME', time: duration }]
      : [
          {
            type: kind === 'active-skills' ? 'ACTIVE_SKILLS' : 'ROTATION',
            actor: kind === 'active-skills' ? '' : 'player'
          }
        ];
  return request;
}
