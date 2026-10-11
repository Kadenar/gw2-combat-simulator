import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import {
  mesmerPhantasmPreparing,
  type MesmerPhantasmAdmission
} from '#gw2/professions/mesmer/core/mechanics/illusions/phantasms.js';
import { mesmerShatterCompleted } from '#gw2/professions/mesmer/core/mechanics/profession-actions.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { createMesmerIllusionRewards, mesmerActivePrimaryWeapon } from '#gw2/professions/mesmer/family-resources.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

import { gw2EventActorType, isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';

import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerEventExtra } from '#gw2/professions/mesmer/data/types.js';
import { completeChronomancerTimeBomb } from '#gw2/professions/mesmer/specializations/chronomancer/traits/time-bomb.js';

/** Danger Time retains its active profile, selection, and original execution boundary. */
export const dangerTime = defineTrait<MesmerSkill>({
  id: TRAIT.DANGER_TIME,
  name: 'Danger Time',
  balance: {
    criticalDamage: 0.05,
    durationMultiplier: 10
  },
  modifierRules: [
    {
      id: 'mesmer.danger-time',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        1 + balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DANGER_TIME), 'criticalDamage'),
      when: (context) =>
        ['player', 'summon'].includes(gw2EventActorType(context.event)) && buffActive(context, 'danger-time')
    }
  ],
  triggers: [{ on: 'control.resolved', run: observeChronomancerEvent }]
});

/** Delayed Reactions retains its active profile, selection, and original execution boundary. */
export const delayedReactions = defineTrait<MesmerSkill>({ id: TRAIT.DELAYED_REACTIONS, name: 'Delayed Reactions' });

/** Flow of Time retains its active profile, selection, and original execution boundary. */
export const flowOfTime = defineTrait<MesmerSkill>({
  id: TRAIT.FLOW_OF_TIME,
  name: 'Flow of Time',
  balance: {
    criticalChance: 0.15
  },
  attributes: ({ balanceContext, loadout, event }) => ({
    traitCriticalChance:
      loadout.assumptions.alacrity !== false && (!event || ['player', 'summon'].includes(gw2EventActorType(event)))
        ? 100 *
          balanceProfileNumber(requireBalanceProfileFromContext(balanceContext, TRAIT.FLOW_OF_TIME), 'criticalChance')
        : 0
  })
});

/** Chronophantasma retains its active profile, selection, and original execution boundary. */
export const chronophantasma = defineTrait<MesmerSkill>({
  id: TRAIT.CHRONOPHANTASMA,
  name: 'Chronophantasma',
  // Admit repeat work once for this batch; the illusion owner retains its conversion and delivery lifetime.
  triggers: [
    onTriggerPoint(mesmerPhantasmPreparing, {
      run(runtime, admission: MesmerPhantasmAdmission) {
        admission.repeat = {
          label: 'Chronophantasma',
          traitId: TRAIT.CHRONOPHANTASMA,
          traitName: 'Chronophantasma',
          damageMultiplier: balanceProfileNumber(
            requireBalanceProfileFromContext(runtime, TRAIT.CHRONOPHANTASMA),
            'damageMultiplier'
          )
        };
      }
    })
  ],
  balance: {
    damageMultiplier: 1.05
  }
});

/** Time Catches Up retains its active profile, selection, and original execution boundary. */
export const timeCatchesUp = defineTrait<MesmerSkill>({
  id: TRAIT.TIME_CATCHES_UP,
  name: 'Time Catches Up',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.1 },
  modifierRules: [
    {
      id: 'mesmer.time-catches-up',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.TIME_CATCHES_UP), 'damageMultiplier'),
      order: 100,
      // Time Catches Up affects only first-strike shatter packets against a movement-impaired target.
      when: (context) =>
        Boolean(context.event?.metadata?.shatterTraitEligible) &&
        ['Chilled', 'Crippled', 'Immobilized', 'Slow'].some((condition) => targetConditionActive(context, condition))
    }
  ]
});

/** Illusionary Reversion retains its active profile, selection, and original execution boundary. */
export const illusionaryReversion = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerShatterCompleted, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof mesmerShatterCompleted>) =>
        resolveIllusionaryReversion(runtime, input.resolution)
    })
  ],
  id: TRAIT.ILLUSIONARY_REVERSION,
  name: 'Illusionary Reversion',
  balance: {
    threshold: 3,
    resourceGain: 1
  }
});

/** Stretched Time retains its active profile, selection, and original execution boundary. */
export const stretchedTime = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerShatterCompleted, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof mesmerShatterCompleted>) =>
        triggerShatterBoon(runtime, input.resolution, TRAIT.STRETCHED_TIME, 'alacrity')
    })
  ],
  id: TRAIT.STRETCHED_TIME,
  name: 'Stretched Time',
  balance: {
    durationPerTier: 1,
    effects: [
      {
        name: 'alacrity',
        type: 'boon',
        boon: 'alacrity',
        duration: 3,
        stacks: 1,
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      }
    ]
  }
});

/** Seize the Moment retains its active profile, selection, and original execution boundary. */
export const seizeTheMoment = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerShatterCompleted, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof mesmerShatterCompleted>) =>
        triggerShatterBoon(runtime, input.resolution, TRAIT.SEIZE_THE_MOMENT, 'quickness')
    })
  ],
  id: TRAIT.SEIZE_THE_MOMENT,
  name: 'Seize the Moment',
  balance: {
    durationPerTier: 1,
    effects: [
      {
        name: 'quickness',
        type: 'boon',
        boon: 'quickness',
        duration: 3,
        stacks: 1,
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      }
    ]
  }
});

/** Time Bomb retains its active profile, selection, and original execution boundary. */
export const timeBomb = defineTrait<MesmerSkill>({
  id: TRAIT.TIME_BOMB,
  name: 'Time Bomb',
  balance: {
    damageMultiplier: 1.1,
    durationMultiplier: 5,
    effects: [{ name: 'Strike', type: 'strike', coefficient: 3, hits: 1 }]
  },
  modifierRules: [
    {
      id: 'mesmer.time-bomb',
      requiresSelection: false,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.TIME_BOMB), 'damageMultiplier'),
      // Preserve Time Catches Up before the applied Time Bomb multiplier.
      order: 101,
      when: (context) => isGw2PlayerActorEvent(context.event) && buffActive(context, 'time-bomb')
    }
  ],
  triggers: [{ on: 'castCommit', run: completeChronomancerTimeBomb }]
});

/** Collect Chronomancer owners without moving shared Continuum or illusion state. */
export const chronomancerTraits = [
  flowOfTime,
  dangerTime,
  timeBomb,
  illusionaryReversion,
  stretchedTime,
  seizeTheMoment,
  chronophantasma,
  timeCatchesUp,
  delayedReactions
];

// Materialize one Chronomancer shatter boon with clone-scaled duration and
// profile-owned recipient metadata.
function triggerShatterBoon(
  context: MesmerRuntime,
  resolution: MesmerShatterResolution,
  traitId: number,
  effectName: 'alacrity' | 'quickness'
): void {
  const profile = requireBalanceProfileFromContext(context, traitId);
  if (!requireEffect(profile, 'boon', effectName)) return;
  const traitSource = {
    source: 'Trait',
    sourceId: traitId,
    actorType: 'player' as const,
    skillId: traitId,
    skillName: profile.name
  };
  const proc = context.effects.emit({
    receipt: true,
    ...resolution.delivery,
    kind: 'announcement',
    log: true,
    attribution: { ...traitSource, actorType: 'effect' },
    announcement: {
      type: 'trait',
      name: profile.name,
      at: resolution.at,
      sourceSkill: resolution.skill.name,
      detail: ''
    }
  });
  // The shared emitter scales the captured clone reward while preserving the existing boon identity and audience.
  emitTraitProfile(context, traitId, traitId, proc, {
    ...resolution.delivery,
    at: resolution.at,
    effect: { type: 'boon', name: effectName },
    attribution: traitSource,
    transform: (event) => ({
      type: 'buff',
      at: resolution.at,
      name: profile.name,
      ...traitSource,
      sourceSkill: resolution.skill.name,
      kind: event.kind,
      stacks: event.stacks,
      audience: event.audience,
      duration: Number(event.duration) + (resolution.spent + 1) * balanceProfileNumber(profile, 'durationPerTier')
    })
  });
}

/** Refunds one clone only when a Chronomancer shatter commits the configured full-clone threshold. */
function resolveIllusionaryReversion(context: MesmerRuntime, resolution: MesmerShatterResolution): void {
  if (
    resolution.spent !==
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ILLUSIONARY_REVERSION), 'threshold')
  ) {
    return;
  }

  const illusionaryReversionProfile = requireBalanceProfileFromContext(context, TRAIT.ILLUSIONARY_REVERSION);
  createMesmerIllusionRewards(context).queueResources(
    resolution.at,
    balanceProfileNumber(illusionaryReversionProfile, 'resourceGain'),
    mesmerActivePrimaryWeapon(context),
    'Illusionary Reversion',
    {
      traitId: TRAIT.ILLUSIONARY_REVERSION,
      traitName: 'Illusionary Reversion'
    }
  );
}

/** Arms Danger Time from Chronomancer control packets and Delayed Reactions. */
function observeChronomancerEvent(context: MesmerRuntime, event: SimulationEvent): void {
  if (event.type !== 'control') return;

  const skillId = Number(event.skillId);
  if (skillId !== ID.TIME_SINK && !hasTrait(context, TRAIT.DELAYED_REACTIONS)) {
    return;
  }

  const skillName = event.skillName || event.name || 'Control effect';
  const dangerTimeProfile = requireBalanceProfileFromContext(context, TRAIT.DANGER_TIME);
  {
    const grants: readonly MesmerEventExtra[] = [
      {
        kind: 'danger-time',
        stacks: 1,
        duration: balanceProfileNumber(dangerTimeProfile, 'durationMultiplier'),
        sourceSkill: skillName
      }
    ];
    const traitProfile = requireBalanceProfileFromContext(context, TRAIT.DANGER_TIME);
    const traitSource = {
      source: 'Trait',
      sourceId: TRAIT.DANGER_TIME,
      actorType: 'player' as const,
      skillId: TRAIT.DANGER_TIME,
      skillName: traitProfile.name
    };
    {
      const proc = context.effects.emit({
        receipt: true,
        kind: 'announcement',
        log: true,
        attribution: { ...traitSource, actorType: 'effect' },
        announcement: { type: 'trait', name: traitProfile.name, at: event.at, sourceSkill: skillName, detail: '' }
      });
      for (const grant of grants)
        context.effects.emit({
          kind: 'packet',
          cause: proc,
          event: {
            ...grant,
            ...traitSource,
            type: 'buff',
            at: event.at,
            name: traitProfile.name,
            sourceSkill: skillName
          }
        });
    }
  }
}
