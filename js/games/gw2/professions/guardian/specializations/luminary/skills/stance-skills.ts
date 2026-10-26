import { COMBO_FIELD, COMBO_FINISHER, CONTROL, RECIPIENT, BOON, AURA } from '#gw2/platform/constants.js';
import { requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { requireBalanceNumber } from '#gw2/platform/effects/validation.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import { AURA_GRANT, EFFULGENT, STANCE } from '#gw2/professions/guardian/specializations/luminary/mechanics/effects.js';
import { luminaryImpactAt } from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
/**
 * Owns Luminary stance and stance-chain skill fragments.
 * Persistent stance windows and scheduled effects remain in `hooks.ts`.
 */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';

// Cast-scaled impacts use the measured Quickness timeline as their source data.
const PIERCING_STANCE_IMPACT_MS = 160;

export const LUMINARY_STANCE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.RESOLUTE_STANCE]: {
    castTimeMs: 680,
    effects: []
  },
  [ID.DARING_ADVANCE]: {
    castTimeMs: 1000,

    effects: [
      {
        type: 'strike',
        // The strike and target tether land about 680 ms into the fixed animation;
        // this also anchors its damage buff, Light field, and leap finisher.
        ticks: [{ atMs: 680, coefficient: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        comboFields: [{ ownerId: 'guardian', fieldType: COMBO_FIELD.LIGHT, duration: 5 }],
        comboFinishers: [
          {
            ownerId: 'guardian',
            finisherType: COMBO_FINISHER.LEAP,
            // The leap can combo with an existing field, but not the field this cast creates.
            excludeOwnField: true
          }
        ]
      }
    ],
    // Schedule the intrinsic self effect at its boundary even when the hostile impact misses.
    sideEffects: [{ on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.start-daring' } }]
  },
  [ID.EFFULGENT_STANCE]: {
    // The stance owns its aura and detonation tuning; scheduled work chooses when each payload is emitted.
    duration: 4,
    maximumStacks: 10,
    damageIncreasePerStack: 0.35,
    castTimeMs: 0,
    effects: [
      { type: 'aura', name: AURA.LIGHT, aura: AURA.LIGHT, duration: 4 },
      { type: 'strike', name: 'Strike', coefficient: 0.5, hits: 1 },
      { type: 'control', name: 'Control' }
    ],
    effectVariants: [{ when: () => true, transform: () => [] }],
    // Schedule the intrinsic self effect at its boundary even when the hostile impact misses.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.start-effulgent' } }
    ]
  },
  [ID.PIERCING_STANCE]: {
    castTimeMs: 200,
    // Keep the stance's strike and daze on one impact.
    effects: impactEffects({ atMs: PIERCING_STANCE_IMPACT_MS, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      }
    ]),
    // Schedule the intrinsic self effect at its boundary even when the hostile impact misses.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.start-piercing' } }
    ]
  },
  [ID.VALOROUS_STANCE]: {
    // This non-DPS stance has simulated boons; hide it from loadout slots without blocking recorded casts.
    simulatorExcluded: false,
    slotSelectable: false,
    castTimeMs: 200,
    // Activation grants the stance's defensive boons to nearby allies.
    effects: [
      { type: 'boon', boon: BOON.STABILITY, stacks: 5, duration: 4, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.PROTECTION, duration: 4, audience: { recipients: RECIPIENT.PARTY } }
    ]
  }
});

/** Priority preserves fresh Piercing before its hit and fresh Daring after Sovereign's detonation. */
const luminaryStanceActions: RuntimeProfession<GuardianRuntimeState, GuardianSkill>['sideEffectHandlers'] = {
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
    runtime.schedule(AURA_GRANT, cast.start, { cause: event, skillId: cast.skill.id }, undefined, -10);
    const state = luminaryState.from(runtime);
    const skill = requireSkillFromContext(runtime, cast.skill.id);
    state.effulgentActiveUntil = canonicalTime(
      cast.start + requireBalanceNumber(skill.duration, `skill=${skill.id} field=duration`)
    );
    state.effulgentStacks = 0;
    state.effulgentActivationId = cast.id;
    runtime.schedule(EFFULGENT, state.effulgentActiveUntil, event);
  }
};

/** Registers Luminary stance actions with the Luminary hook assembly. */
export const luminaryStanceLifecycle = {
  sideEffectHandlers: luminaryStanceActions
} satisfies RuntimeHooks<GuardianRuntimeState, GuardianSkill>;
