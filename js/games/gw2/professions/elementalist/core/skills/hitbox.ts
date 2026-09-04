/**
 * Marks an Elementalist skill's chronological packets so the runtime can exclude
 * only the hits that do not fit on a small target.
 */
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { SkillEffect, SkillFragment } from '#gw2/platform/engine/skills/types.js';

function hitboxMetadata(hitIndex: number, smallHitboxCap: number) {
  return {
    hitboxIndex: hitIndex,
    smallHitboxCap
  };
}

/** Keeps each hitbox cap beside its skill while sharing the packet-indexing rules. */
export function withSmallHitboxCap(skill: SkillFragment, smallHitboxCap: number): SkillFragment {
  const effects = skill.effects || [];
  const chronologicalStrikeIndices = new Map<string, number>();

  // Rank every strike by timestamp while preserving effect and tick order for simultaneous hits.
  effects
    .flatMap((effect, effectIndex) => {
      if (effect.type !== 'strike') return [];
      if (Array.isArray(effect.ticks)) {
        return effect.ticks.map((tick, tickIndex) => ({ effectIndex, tickIndex, atMs: Number(tick.atMs) }));
      }

      return [{ effectIndex, tickIndex: 0, atMs: Number(effect.atMs || 0) }];
    })
    .sort(
      (left, right) =>
        left.atMs - right.atMs || left.effectIndex - right.effectIndex || left.tickIndex - right.tickIndex
    )
    .forEach(({ effectIndex, tickIndex }, index) => {
      chronologicalStrikeIndices.set(`${effectIndex}:${tickIndex}`, index + 1);
    });

  let lastStrikeIndices: number[] = [];

  return {
    ...skill,
    effects: effects.map((effect, effectIndex) => {
      if (effect.type === 'strike') {
        // Record the current strike's ranks so following conditions can inherit their matching hit indices.
        const hitCount = Array.isArray(effect.ticks)
          ? effect.ticks.length
          : Math.max(1, Math.trunc(Number(effect.hits || 1)));

        lastStrikeIndices = Array.from(
          { length: hitCount },
          (_, tickIndex) => chronologicalStrikeIndices.get(`${effectIndex}:${tickIndex}`) || 0
        );

        if (Array.isArray(effect.ticks)) {
          return {
            ...effect,
            ticks: effect.ticks.map((tick, index) => ({
              ...tick,
              metadata: {
                ...(tick.metadata || {}),
                ...hitboxMetadata(lastStrikeIndices[index], smallHitboxCap)
              }
            }))
          };
        }

        if (hitCount !== 1) {
          throw new TypeError(`${skill.name} needs individually timed strikes for hitbox caps.`);
        }

        return {
          ...effect,
          metadata: {
            ...(effect.metadata || {}),
            ...hitboxMetadata(lastStrikeIndices[0], smallHitboxCap)
          }
        };
      }

      if (!lastStrikeIndices.length) {
        return effect;
      }

      // Pair tick-based conditions with the preceding strike timeline one packet at a time.
      if (Array.isArray(effect.ticks) && effect.ticks.length === lastStrikeIndices.length) {
        return {
          ...effect,
          ticks: effect.ticks.map((tick, index) => ({
            ...tick,
            metadata: {
              ...((tick as SchedulerRecord).metadata as SchedulerRecord),
              ...hitboxMetadata(lastStrikeIndices[index], smallHitboxCap)
            }
          }))
        } as SkillEffect;
      }

      // A single companion effect belongs to the preceding strike's final packet.
      return {
        ...effect,
        metadata: {
          ...(effect.metadata || {}),
          ...hitboxMetadata(lastStrikeIndices[lastStrikeIndices.length - 1], smallHitboxCap)
        }
      } as SkillEffect;
    })
  };
}
