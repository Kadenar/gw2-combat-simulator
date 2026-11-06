/**
 * Owns Luminary stance and stance-chain skill definitions.
 * Persistent stance windows and scheduled effects remain in `hooks.ts`.
 */
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import { AURA, BOON, COMBO_FIELD, COMBO_FINISHER, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { requireBalanceNumber } from '#gw2/platform/effects/validation.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { requireSkill } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { AURA_GRANT, EFFULGENT, STANCE } from '#gw2/professions/guardian/specializations/luminary/mechanics/effects.js';
import { luminaryImpactAt } from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

// Cast-scaled impacts use the measured Quickness timeline as their source data.
const PIERCING_STANCE_IMPACT_MS = 160;

export const LUMINARY_STANCE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<GuardianSkill>>> = {
  [ID.RESOLUTE_STANCE]: {
    name: 'Resolute Stance',
    icon: 'https://render.guildwars2.com/file/C0267DCD064328C6C4CF33CF08714FB1DC1171BC/3680141.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Stance',
    cooldown: 30,
    castTimeMs: 680,
    effects: []
  },
  [ID.DARING_ADVANCE]: {
    name: 'Daring Advance',
    icon: 'https://render.guildwars2.com/file/2E24D2089501C663801BF7CC567E1CC0F5714AD7/3680140.png',
    type: 'Elite',
    slot: 'Elite',
    skillFamily: 'Stance',
    cooldown: 60,
    castTimeMs: 1000,
    // A fresh application boosts subsequent attacks; its own impact requires an older active application.
    modifiers: [
      {
        id: 'guardian.daring-advance',
        scope: 'profession',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: 1.15,
        order: 100,
        when: (context) => {
          const kind = 'guardian-daring-advance';

          if (!buffActive(context, kind)) return false;

          if (context.event?.skillId !== ID.DARING_ADVANCE && context.event?.triggeredBy !== 'Daring Advance')
            return true;

          return (context.events || []).some(
            (event) =>
              event.type === 'buff' &&
              event.kind === kind &&
              event.at < context.time &&
              gw2EffectExpiresAt(event.at, event.duration || 0) > context.time
          );
        }
      }
    ],
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
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelledBeforeCommit, do: { type: 'guardian.start-daring' } }
    ]
  },
  [ID.EFFULGENT_STANCE]: {
    name: 'Effulgent Stance',
    icon: 'https://render.guildwars2.com/file/59A7E145B5D6DC4CB9642F80007644791D302FA2/3680156.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Stance',
    cooldown: 20,
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
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelledBeforeCommit,
        do: { type: 'guardian.start-effulgent' }
      }
    ]
  },
  [ID.PIERCING_STANCE]: {
    name: 'Piercing Stance',
    icon: 'https://render.guildwars2.com/file/E5805F3477ED5618E348043475FFA442C7C791E3/3680154.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Stance',
    cooldown: 20,
    ammoCastLockout: 1,
    ammo: 2,

    castTimeMs: 200,
    // The buff boosts all eligible strikes, including this stance's activating impact and its triggered damage.
    modifiers: [
      {
        id: 'guardian.piercing-stance',
        scope: 'profession',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'damage-additive',
        amount: 0.1,
        when: (context) => buffActive(context, 'guardian-piercing-stance')
      }
    ],
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
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelledBeforeCommit,
        do: { type: 'guardian.start-piercing' }
      }
    ]
  },
  [ID.VALOROUS_STANCE]: {
    name: 'Valorous Stance',
    icon: 'https://render.guildwars2.com/file/7D246678672DAF3F941930A50EBCDB54A91C7D0F/3680155.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Stance',
    cooldown: 25,
    patchAuthoringExcluded: true,
    // This non-DPS stance has simulated boons; hide it from loadout slots without blocking recorded casts.

    slotSelectable: false,
    castTimeMs: 200,
    // Activation grants the stance's defensive boons to nearby allies.
    effects: [
      { type: 'boon', boon: BOON.STABILITY, stacks: 5, duration: 4, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.PROTECTION, duration: 4, audience: { recipients: RECIPIENT.PARTY } }
    ]
  }
};

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
    const state = luminaryState.from(runtime.profession);
    const skill = requireSkill(runtime.helpers, cast.skill.id);
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
