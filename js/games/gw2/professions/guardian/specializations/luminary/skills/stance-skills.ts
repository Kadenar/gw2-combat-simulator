import { canonicalTime } from '#kernel/core/clock.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import {
  AURA_GRANT,
  EFFULGENT,
  STANCE,
  luminaryImpactAt
} from '#gw2/professions/guardian/specializations/luminary/mechanics/effects.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
/**
 * Owns Luminary stance and stance-chain skill fragments.
 * Persistent stance windows and scheduled effects remain in `hooks.ts`.
 */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Cast-scaled impacts use the measured Quickness timeline as their source data.
const PIERCING_STANCE_IMPACT_MS = 160;

export const LUMINARY_STANCE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.RESOLUTE_STANCE]: {
    castTimeMs: 680,
    effects: []
  },
  [ID.DARING_ADVANCE]: {
    // Schedule the intrinsic self effect at its boundary even when the hostile impact misses.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.start-daring' } }
    ],
    castTimeMs: 1000,

    effects: [
      {
        type: 'strike',
        // The strike and target tether land about 680 ms into the fixed animation;
        // this also anchors its damage buff, Light field, and leap finisher.
        ticks: [{ atMs: 680, coefficient: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        comboFields: [{ ownerId: 'guardian', fieldType: 'Light', duration: 5 }],
        comboFinishers: [
          {
            ownerId: 'guardian',
            finisherType: 'Leap',
            // The leap can combo with an existing field, but not the field this cast creates.
            excludeOwnField: true,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      }
    ]
  },
  [ID.EFFULGENT_STANCE]: {
    // Schedule the intrinsic self effect at its boundary even when the hostile impact misses.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.start-effulgent' } }
    ],
    castTimeMs: 0,
    effects: []
  },
  [ID.PIERCING_STANCE]: {
    // Schedule the intrinsic self effect at its boundary even when the hostile impact misses.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.start-piercing' } }
    ],
    castTimeMs: 200,
    // Keep the stance's strike and daze on one impact.
    effects: impactEffects({ atMs: PIERCING_STANCE_IMPACT_MS, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ])
  },
  [ID.VALOROUS_STANCE]: {
    // This non-DPS stance has simulated boons; hide it from loadout slots without blocking recorded casts.
    simulatorExcluded: false,
    slotSelectable: false,
    castTimeMs: 200,
    // Activation grants the stance's defensive boons to nearby allies.
    effects: [
      { type: 'boon', boon: 'stability', stacks: 5, duration: 4, audience: { recipients: 'party' } },
      { type: 'boon', boon: 'protection', duration: 4, audience: { recipients: 'party' } }
    ]
  }
});

/** Priority preserves fresh Piercing before its hit and fresh Daring after Sovereign's detonation. */
export const luminaryStanceActions: RuntimeProfession<GuardianRuntimeState, GuardianSkill>['sideEffectHandlers'] = {
  'guardian.start-piercing'(runtime, context) {
    if (context.kind === 'cast')
      runtime.scheduleForCast(STANCE, luminaryImpactAt(context.cast), context.cast, { piercing: true }, undefined, -30);
  },
  'guardian.start-daring'(runtime, context) {
    if (context.kind === 'cast')
      runtime.scheduleForCast(STANCE, luminaryImpactAt(context.cast), context.cast, { piercing: false }, undefined, 0);
  },
  'guardian.start-effulgent'(runtime, context) {
    if (context.kind !== 'cast') return;
    const cast = context.cast;
    const event = { ...guardianCastCause(runtime, cast), offTarget: cast.command.offTarget === true };
    runtime.schedule(AURA_GRANT, cast.start, event, undefined, -10);
    const state = luminaryState.from(runtime);
    state.effulgentActiveUntil = canonicalTime(cast.start + 4);
    state.effulgentStacks = 0;
    state.effulgentActivationId = cast.id;
    runtime.schedule(EFFULGENT, state.effulgentActiveUntil, event);
  }
};
