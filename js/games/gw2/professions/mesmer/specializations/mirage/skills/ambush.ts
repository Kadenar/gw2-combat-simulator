import { CONDITION } from '#gw2/platform/constants.js';
import type { ConditionEffect, SkillEffect, StatusEffect, StrikeEffect } from '#gw2/platform/effects/types.js';
import type { MesmerAmbushAttack, MesmerAmbushStrike } from '#gw2/professions/mesmer/types.js';

function attackStatusEffect(status: ConditionEffect, source: 'Player' | 'Clone'): SkillEffect {
  return {
    ...status,
    // The ambush skill expands repeated statuses into independently selectable effects.
    applications: undefined,
    source
  };
}

function boonStatusEffect(status: StatusEffect, source: 'Player' | 'Clone'): SkillEffect {
  return {
    ...status,
    source
  };
}

/** Keeps each ambush skill in the same compact-or-explicit packet form as its mechanic definition. */
function ambushStrikeEffect(attack: MesmerAmbushStrike, source: 'Player' | 'Clone'): StrikeEffect {
  return attack.ticks?.length
    ? {
        type: 'strike',
        name: `${source} attack`,
        source,
        ticks: attack.ticks,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    : {
        type: 'strike',
        name: `${source} attack`,
        source,
        coefficient: attack.coefficient,
        hits: attack.hits,
        atMs: attack.atMs
      };
}

/** Builds the canonical skill payload for one Mirage player/clone ambush pair. */
export function ambushSkill(attack: MesmerAmbushAttack): MesmerAmbushAttack {
  const { vulnerability, ...skill } = attack;
  return {
    ...skill,
    player: {
      castTimeMs: attack.player.castTimeMs,
      damageAtMs: attack.player.damageAtMs,
      statusAtMs: attack.player.ticks?.map((tick) => tick.atMs)
    },
    clone: { castTimeMs: attack.clone.castTimeMs, damageAtMs: attack.clone.damageAtMs },
    hasVulnerability: Boolean(vulnerability),
    effects: [
      ...(attack.effects ?? []),
      ambushStrikeEffect(attack.player, 'Player'),
      ...(attack.player.conditions || []).flatMap((status) =>
        Array.from({ length: status.applications ?? 1 }, () => attackStatusEffect(status, 'Player'))
      ),
      ...(attack.player.boons || []).map((status) => boonStatusEffect(status, 'Player')),
      ambushStrikeEffect(attack.clone, 'Clone'),
      ...(attack.clone.conditions || []).flatMap((status) =>
        Array.from({ length: status.applications ?? 1 }, () => attackStatusEffect(status, 'Clone'))
      ),
      ...(attack.clone.boons || []).map((status) => boonStatusEffect(status, 'Clone')),
      ...(vulnerability
        ? [
            {
              type: 'condition' as const,
              name: CONDITION.VULNERABILITY,
              condition: CONDITION.VULNERABILITY,
              duration: vulnerability.duration,
              stacks: vulnerability.stacks
            }
          ]
        : [])
    ]
  };
}
