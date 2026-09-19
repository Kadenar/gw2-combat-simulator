/**
 * Static skill-catalog tick tables for the channeled overloads.
 *
 * Each overload is expanded into per-pulse strike/condition/boon packets anchored to cast start and
 * scaled with the cast, so a slower unquickened channel stretches the same pulses proportionally.
 */
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';

// Payload builders keep each pulse's timing on its shared impact; finishers stay on the strike.
function strike(coefficient: number, tick: Readonly<Record<string, unknown>> = {}): SkillEffect {
  return {
    type: 'strike',
    coefficient,
    ...tick
  };
}

function condition(name: string, stacks: number, duration: number): SkillEffect {
  return {
    type: 'condition',
    condition: name,
    stacks,
    duration,
    metadata: {}
  };
}

function boon(name: string, stacks: number, duration: number): SkillEffect {
  return {
    type: 'boon',
    boon: name,
    stacks,
    duration,
    audience: { recipients: 'party' as const, maximumRecipients: 5 },
    metadata: {}
  };
}

// Overload packets are stored on their Quickness timelines and expand for unquickened casts.
const OVERLOAD_FIRE_TICKS = Object.freeze([280, 760, 1240, 1720, 3200, 4200, 5200, 6200, 7200, 8200]);

const OVERLOAD_AIR_TICKS = Object.freeze([
  720, 1120, 1520, 1920, 2320, 2720, 3120, 3640, 4160, 4680, 5200, 5720, 6240, 6760
]);

const OVERLOAD_EARTH_TICKS = Object.freeze([80, 800, 1520, 2240, 2760, 3760, 4760, 5760, 6760]);

// Overload Fire: every pulse strikes, burns, and grants party might; the first four pulses are
// whirl finishers (the first three double-applying) inside its own fire field.
function overloadFireEffects(): readonly SkillEffect[] {
  return OVERLOAD_FIRE_TICKS.flatMap((atMs, index) => {
    const whirl =
      index < 4
        ? {
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Whirl',
                // Keep the singleton timeline's combo identity after lifting its payload onto the impact.
                attemptGroup: `effect:${index * 3 + 1}:tick:1`,
                ...(index < 3 ? { applications: 2 } : {}),
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        : {};
    return impactEffects({ atMs, timingAnchor: 'castStart', timingScale: 'cast' }, [
      strike(0.9, whirl),
      condition('Burning', 1, 3),
      boon('Might', 2, 16)
    ]);
  });
}

// Overload Air: a uniform pulse train of strike, vulnerability, and party fury.
function overloadAirEffects(): readonly SkillEffect[] {
  return OVERLOAD_AIR_TICKS.flatMap((atMs) =>
    impactEffects({ atMs, timingAnchor: 'castStart', timingScale: 'cast' }, [
      strike(0.85),
      condition('Vulnerability', 1, 10),
      boon('Fury', 1, 1)
    ])
  );
}

// Overload Earth: bleed/cripple pulses with party protection; the opening pulse grants stability
// and the fifth is the blast finisher that also immobilizes.
function overloadEarthEffects(): readonly SkillEffect[] {
  return OVERLOAD_EARTH_TICKS.flatMap((atMs, index) =>
    impactEffects({ atMs, timingAnchor: 'castStart', timingScale: 'cast' }, [
      strike(
        0.75,
        index === 4
          ? {
              comboFinishers: [
                {
                  ownerId: 'elementalist',
                  finisherType: 'Blast',
                  // Four effects per earlier pulse, plus the opening Stability, precede this strike.
                  attemptGroup: `effect:${index * 4 + 2}:tick:1`,
                  ambiguousFieldSelection: 'oldest'
                }
              ],
              metadata: {}
            }
          : {}
      ),
      condition('Bleeding', 1, 9),
      condition('Cripple', 1, 3),
      ...(index === 0 ? [boon('Stability', 3, 4)] : []),
      ...(index === 4 ? [condition('Immobilize', 1, 4)] : []),
      boon('Protection', 1, 1)
    ])
  );
}

/** Per-overload effect lists consumed by the Tempest skill catalog; Overload Water has none. */
export const TEMPEST_OVERLOAD_EFFECTS: Readonly<Record<number, readonly SkillEffect[]>> = Object.freeze({
  [ID.OVERLOAD_FIRE]: overloadFireEffects(),
  [ID.OVERLOAD_WATER]: [],
  [ID.OVERLOAD_AIR]: overloadAirEffects(),
  [ID.OVERLOAD_EARTH]: overloadEarthEffects()
});
