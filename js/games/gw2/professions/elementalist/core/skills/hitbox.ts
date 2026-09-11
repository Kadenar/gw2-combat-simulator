/**
 * Marks an Elementalist skill's chronological packets so the runtime can exclude
 * only the hits that do not fit on a small target.
 */
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

  const lastStrikeIndices = new Map<number, number[]>();
  const companionOccurrences = new Map<string, number>();

  // Match offensive companions within their strike layer by timestamp and per-kind occurrence.
  // Unmatched effects remain independent; self boons and buffs never inherit a target hitbox cap.
  function pairPacket<T extends Pick<SkillEffect, 'atMs' | 'metadata'>>(packet: T, kind: string): T {
    const atMs = Number(packet.atMs || 0);
    const key = `${kind}:${atMs}`;
    const occurrence = companionOccurrences.get(key) || 0;
    companionOccurrences.set(key, occurrence + 1);
    const hitIndex = lastStrikeIndices.get(atMs)?.[occurrence];
    return hitIndex == null
      ? packet
      : { ...packet, metadata: { ...packet.metadata, ...hitboxMetadata(hitIndex, smallHitboxCap) } };
  }

  return {
    ...skill,
    effects: effects.map((effect, effectIndex) => {
      if (effect.type === 'strike') {
        // A new strike layer starts a fresh set of companion packet matches.
        lastStrikeIndices.clear();
        companionOccurrences.clear();
        const hitCount = Array.isArray(effect.ticks)
          ? effect.ticks.length
          : Math.max(1, Math.trunc(Number(effect.hits || 1)));

        (Array.isArray(effect.ticks) ? effect.ticks : [effect]).forEach((tick, tickIndex) => {
          const atMs = Number(tick.atMs || 0);
          const indices = lastStrikeIndices.get(atMs) || [];
          indices.push(chronologicalStrikeIndices.get(`${effectIndex}:${tickIndex}`)!);
          lastStrikeIndices.set(atMs, indices);
        });

        if (Array.isArray(effect.ticks)) {
          return {
            ...effect,
            ticks: effect.ticks.map((tick, index) => ({
              ...tick,
              metadata: {
                ...(tick.metadata || {}),
                ...hitboxMetadata(chronologicalStrikeIndices.get(`${effectIndex}:${index}`)!, smallHitboxCap)
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
            ...hitboxMetadata(chronologicalStrikeIndices.get(`${effectIndex}:0`)!, smallHitboxCap)
          }
        };
      }

      if (effect.type !== 'condition' && effect.type !== 'blind' && effect.type !== 'control') {
        return effect;
      }

      if (effect.type === 'condition' && Array.isArray(effect.ticks)) {
        return {
          ...effect,
          ticks: effect.ticks.map((tick) => pairPacket(tick, tick.condition))
        };
      }

      return pairPacket(effect, effect.type === 'condition' ? String(effect.condition) : effect.type);
    })
  };
}
