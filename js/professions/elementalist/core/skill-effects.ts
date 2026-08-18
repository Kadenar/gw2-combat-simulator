import type { SkillEffect } from '../../../platform/engine/types.js';

type TimedStrikePacket = readonly [atMs: number, coefficient: number];

interface PacketCondition {
  readonly condition: string;
  readonly stacks: number;
  readonly duration: number;
}

interface PacketEffectOptions {
  readonly condition?: PacketCondition;
  readonly conditionStartIndex?: number;
  readonly strikeTick?: Readonly<Record<string, unknown>>;
}

/**
 * Expands compact timed packet data into the legacy per-packet effect shape.
 * Keeping each strike and condition as its own effect preserves event indices,
 * stable same-time ordering, and hitbox annotations during data migration.
 */
export function elementalistPacketEffects(
  packets: readonly TimedStrikePacket[],
  { condition, conditionStartIndex = 0, strikeTick = {} }: PacketEffectOptions = {}
): readonly SkillEffect[] {
  return packets.flatMap(([atMs, coefficient], index) => [
    {
      type: 'strike',
      ticks: [{ atMs, coefficient, ...strikeTick }],
      timingAnchor: 'castStart',
      timingScale: 'cast'
    },
    ...(condition && index >= conditionStartIndex
      ? [
          {
            type: 'condition' as const,
            ticks: [{ atMs, ...condition }],
            timingAnchor: 'castStart' as const,
            timingScale: 'cast' as const,
            metadata: {}
          }
        ]
      : [])
  ]);
}
