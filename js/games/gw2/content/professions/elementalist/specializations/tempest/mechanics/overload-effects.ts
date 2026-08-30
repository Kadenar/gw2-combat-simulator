import { ELEMENTALIST_SKILL_IDS as ID } from '../../../data/ids.js';
import type { SkillEffect } from '../../../../../../platform/engine/types.js';

function strike(atMs: number, coefficient: number, tick: Readonly<Record<string, unknown>> = {}): SkillEffect {
  return {
    type: 'strike',
    ticks: [{ atMs, coefficient, ...tick }],
    timingAnchor: 'castStart',
    timingScale: 'cast'
  };
}

function condition(atMs: number, name: string, stacks: number, duration: number): SkillEffect {
  return {
    type: 'condition',
    ticks: [{ atMs, condition: name, stacks, duration }],
    timingAnchor: 'castStart',
    timingScale: 'cast',
    metadata: {}
  };
}

function boon(atMs: number, name: string, stacks: number, duration: number): SkillEffect {
  return {
    type: 'boon',
    boon: name,
    stacks,
    duration,
    atMs,
    timingAnchor: 'castStart',
    timingScale: 'cast',
    recipients: 'party',
    maximumRecipients: 5,
    metadata: {}
  };
}

// Overload packets are stored on their Quickness timelines and expand for unquickened casts.
const OVERLOAD_FIRE_TICKS = Object.freeze([280, 760, 1250, 1730, 3200, 4200, 5200, 6200, 7200, 8200]);

const OVERLOAD_AIR_TICKS = Object.freeze([
  720, 1120, 1520, 1920, 2320, 2720, 3120, 3640, 4160, 4680, 5210, 5720, 6240, 6760
]);

const OVERLOAD_EARTH_TICKS = Object.freeze([80, 800, 1520, 2240, 2760, 3760, 4760, 5760, 6760]);

function overloadFireEffects(): readonly SkillEffect[] {
  return OVERLOAD_FIRE_TICKS.flatMap((atMs, index) => {
    const whirl =
      index < 4
        ? {
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Whirl',
                ...(index < 3 ? { applications: 2 } : {}),
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        : {};
    return [strike(atMs, 0.9, whirl), condition(atMs, 'Burning', 1, 3), boon(atMs, 'Might', 2, 16)];
  });
}

function overloadAirEffects(): readonly SkillEffect[] {
  return OVERLOAD_AIR_TICKS.flatMap((atMs) => [
    strike(atMs, 0.85),
    condition(atMs, 'Vulnerability', 1, 10),
    boon(atMs, 'Fury', 1, 1)
  ]);
}

function overloadEarthEffects(): readonly SkillEffect[] {
  return OVERLOAD_EARTH_TICKS.flatMap((atMs, index) => [
    strike(
      atMs,
      0.75,
      index === 4
        ? {
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        : {}
    ),
    condition(atMs, 'Bleeding', 1, 9),
    condition(atMs, 'Cripple', 1, 3),
    ...(index === 0 ? [boon(atMs, 'Stability', 3, 4)] : []),
    ...(index === 4 ? [condition(atMs, 'Immobilize', 1, 4)] : []),
    boon(atMs, 'Protection', 1, 1)
  ]);
}

export const TEMPEST_OVERLOAD_EFFECTS: Readonly<Record<number, readonly SkillEffect[]>> = Object.freeze({
  [ID.OVERLOAD_FIRE]: overloadFireEffects(),
  [ID.OVERLOAD_WATER]: [],
  [ID.OVERLOAD_AIR]: overloadAirEffects(),
  [ID.OVERLOAD_EARTH]: overloadEarthEffects()
});
