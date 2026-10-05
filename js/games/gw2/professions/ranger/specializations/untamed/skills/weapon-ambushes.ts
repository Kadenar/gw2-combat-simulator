import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { UNTAMED_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/untamed/profiles.js';
import { naturalFortitudeAmbushEffect } from '#gw2/professions/ranger/specializations/untamed/traits/behavior.js';

/** Preserve the measured Quickness offsets, including projectiles and effects that outlive the cast. */
function impact(atMs: number, effects: readonly SkillEffect[]): SkillEffect[] {
  return impactEffects({ atMs, timingAnchor: 'castStart', timingScale: 'fixed' }, effects);
}

/** A successful melee ambush leaves a separately attributed spore that strikes and poisons later. */
function spore(parentSkillName: string): SkillEffect[] {
  return impact(1960, [
    {
      type: 'strike',
      sourceId: ID.EXPLODING_SPORE,
      name: 'Exploding Spore',
      skillName: 'Exploding Spore',
      parentSkillName,
      coefficient: 0.583
    },
    {
      type: 'condition',
      sourceId: ID.EXPLODING_SPORE,
      name: 'Exploding Spore - Poisoned',
      skillName: 'Exploding Spore',
      parentSkillName,
      condition: 'Poisoned',
      stacks: 2,
      duration: 5
    }
  ]);
}

/** Each accepted ambush spends its window; only its first impact receives Natural Fortitude. */
function ambush(castTimeMs: number, firstHitMs: number, effects: readonly SkillEffect[]): Partial<Skill> {
  return {
    castTimeMs,
    sideEffects: [{ on: 'castStart', do: { type: 'ranger.ambush-consume' } }],
    effects: [...effects, naturalFortitudeAmbushEffect(firstHitMs)]
  };
}

// All timings use the observed timeline rounded to 40 ms; durations below exclude build expertise.
export const UNTAMED_WEAPON_AMBUSH_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SUNDERING_VOLLEY]: ambush(760, 680, [
    ...impact(680, [
      { type: 'strike', coefficient: 0.65, projectile: true },
      { type: 'condition', condition: 'Bleeding', stacks: 2, duration: 8 },
      { type: 'condition', condition: 'Vulnerability', stacks: 5, duration: 8 }
    ]),
    ...impact(880, [
      { type: 'strike', coefficient: 0.65, projectile: true },
      { type: 'condition', condition: 'Bleeding', stacks: 2, duration: 8 },
      { type: 'condition', condition: 'Immobilized', stacks: 1, duration: 1.25 }
    ])
  ]),
  [ID.NEUROTOXIN_BURST]: ambush(
    600,
    560,
    impact(560, [
      { type: 'strike', coefficient: 2 },
      { type: 'condition', condition: 'Bleeding', stacks: 2, duration: 8 },
      { type: 'condition', condition: 'Poisoned', stacks: 2, duration: 8 },
      { type: 'condition', condition: 'Vulnerability', stacks: 5, duration: 8 }
    ])
  ),
  [ID.RAMPANT_GROWTH]: ambush(
    600,
    480,
    impact(480, [
      { type: 'strike', coefficient: 3 },
      { type: 'condition', condition: 'Immobilized', stacks: 1, duration: 2 }
    ])
  ),
  [ID.SOLAR_BRILLIANCE]: ambush(1160, 1160, [
    // Blindness precedes damage; the six pulses continue independently after the animation ends.
    ...impact(640, [{ type: 'condition', condition: 'Blindness', stacks: 1, duration: 3 }]),
    {
      type: 'strike',
      timingAnchor: 'castStart',
      timingScale: 'fixed',
      ticks: [1160, 1680, 2200, 2720, 3240, 3760].map((atMs) => ({ atMs, coefficient: 0.5 }))
    }
  ]),
  [ID.SAVAGE_SLASH]: ambush(680, 600, [
    ...impact(600, [
      { type: 'strike', coefficient: 3.3 },
      { type: 'condition', condition: 'Vulnerability', stacks: 5, duration: 8 }
    ]),
    ...spore('Savage Slash')
  ]),
  [ID.MULTISHOT]: ambush(520, 480, impact(480, [{ type: 'strike', coefficient: 2.5, projectile: true }])),
  [ID.TOXIC_SHOT]: ambush(
    920,
    640,
    impact(640, [
      {
        type: 'strike',
        coefficient: 1.8,
        projectile: true,
        // Test poison at impact before this attack applies its own poison, so a clean target receives no torment.
        reactions: [
          {
            on: 'damage.resolved',
            actor: 'player',
            packets: 'first',
            when: (runtime, { event }) => runtime.combat.targetHasCondition('Poisoned', event.at),
            do: {
              type: 'emitProfile',
              profileId: PROFILE.toxicShotPoisoned,
              attribution: { source: 'ranger', sourceId: ID.TOXIC_SHOT, actorType: 'player' }
            }
          }
        ]
      },
      // The supplied log records four poison stacks; the wiki lists three. Keep the observed count here.
      { type: 'condition', condition: 'Poisoned', stacks: 4, duration: 6 },
      { type: 'condition', condition: 'Weakness', stacks: 1, duration: 3 }
    ])
  ),
  [ID.RAVAGERS_ABANDON]: ambush(680, 600, [
    ...impact(600, [{ type: 'strike', coefficient: 3 }]),
    ...spore("Ravager's Abandon")
  ])
});
