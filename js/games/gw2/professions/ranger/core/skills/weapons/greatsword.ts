/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { ACTOR, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { buildResolverBuff } from '#gw2/platform/effects/packet-builders.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { requireSkillFromContext, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { isPetStrike, isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { rangerMerged } from '#gw2/professions/ranger/core/state.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

// Both Maul variants share their strike, timing, recharge, and vulnerability; their bonus recipients differ.
const maul: Partial<Skill> = {
  // Each Maul variant independently owns the next-attack grant window.
  duration: 10,
  cooldown: 4,
  castTimeMs: 840,
  effects: [
    {
      type: 'strike',
      coefficient: 2.2,
      hits: 1,
      // Queue the recipient's next-attack buff after the current strike's existing charge is consumed.
      reactions: [
        {
          on: 'damage.resolved',
          actor: ACTOR.PLAYER,
          packets: 'each',
          when: (runtime, { event, skill }) =>
            Number(event.coefficient) > 0 &&
            !isPetStrike(event) &&
            skill.id === ID.MAUL_BASE &&
            Boolean(runtime.profession.core.pet),
          do: { type: 'ranger.maul-pet' }
        },
        {
          on: 'damage.resolved',
          actor: ACTOR.PLAYER,
          packets: 'each',
          when: (runtime, { event, skill }) =>
            Number(event.coefficient) > 0 &&
            !isPetStrike(event) &&
            skill.id === ID.MAUL_SOULBEAST &&
            rangerMerged(runtime.profession),
          do: { type: 'ranger.maul-player' }
        }
      ]
    },
    { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 5, duration: 8 }
  ]
};

export const RANGER_CORE_GREATSWORD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SLASH_ID_12474]: {
    castTimeMs: 400,
    effects: [
      {
        type: 'strike',
        coefficient: 0.88,
        hits: 1
      }
    ]
  },
  [ID.SLICE]: {
    castTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1
      }
    ]
  },
  [ID.ENDURING_SWING]: {
    resourceGain: 15,
    castTimeMs: 800,
    effects: [
      {
        type: 'strike',
        coefficient: 1.76,
        hits: 1
      }
    ],
    // Only a fully completed chain finisher grants the selected endurance reward.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'resourceGrant',
          resource: 'endurance',
          amount: { skillField: 'resourceGain' }
        }
      }
    ]
  },
  [ID.MAUL_SOULBEAST]: maul,
  [ID.MAUL_BASE]: maul,
  [ID.SWOOP]: {
    cooldown: 10,
    evades: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 1,
        comboFinishers: [{ ownerId: 'ranger', finisherType: COMBO_FINISHER.LEAP }]
      }
    ]
  },
  [ID.COUNTERATTACK]: {
    castTimeMs: 2000,
    effects: [],
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.COUNTERATTACK_KICK, durationSec: 5 } }]
  },
  [ID.COUNTERATTACK_KICK]: {
    evades: true,
    castTimeMs: 333,
    // The PvE kick lands once and its knockback can trigger control reactions.
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      },
      { type: 'control', controlKind: CONTROL.KNOCKBACK }
    ],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.COUNTERATTACK_KICK } }]
  },
  [ID.HILT_BASH]: {
    cooldown: 20,
    castTimeMs: 640,

    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      },
      // Select one control packet at acceptance without rewriting effects in the Core hook.
      { type: 'control', controlKind: CONTROL.DAZE, when: (runtime) => !runtime.config.target?.defiant },
      { type: 'control', controlKind: CONTROL.STUN, when: (runtime) => Boolean(runtime.config.target?.defiant) }
    ],
    // The completed activation refreshes its paired skill through the shared recharge owner.
    sideEffects: [{ on: 'castCommit', do: { type: 'rechargeReset', skillIds: [ID.MAUL_SOULBEAST, ID.MAUL_BASE] } }]
  }
});

// Only direct attacks spend the charge; trait and stance damage cannot steal it.
function attackRecipient(event?: SimulationEvent | null): 'pet' | typeof ACTOR.PLAYER | undefined {
  if (event?.type !== 'damage' || !(Number(event.coefficient) > 0) || event.actorType === ACTOR.EFFECT) return;

  if (isPetStrike(event)) return 'pet';

  if (isPlayerStrike(event)) return ACTOR.PLAYER;
}

export const rangerAttackOfOpportunityModifier: Gw2ModifierRule = {
  id: 'ranger.attack-of-opportunity',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  parameters: { petFactor: 1.5, playerFactor: 1.25 },
  factor: (context, _target, parameters) =>
    attackRecipient(context.event) === 'pet' ? parameters.petFactor : parameters.playerFactor,
  // Read live applications so consuming the charge also affects other packets at the same timestamp.
  when: (context) => {
    const recipient = attackRecipient(context.event);

    if (!recipient) return false;

    const buffs =
      recipient === 'pet'
        ? context.runtime?.companions?.get(String(context.event?.summonOwner))?.buffs
        : context.runtime?.buffs;
    return (buffs?.get(`attack-of-opportunity-${recipient}`) || []).some(
      (application) =>
        application.at <= context.time &&
        application.expiresAt > context.time &&
        application.stacks > 0 &&
        (recipient === ACTOR.PLAYER ||
          application.resolvedAudience.companionIds.includes(String(context.event?.summonOwner)))
    );
  }
};

/** Each Maul ID grants its own recipient's next-attack bonus after its strike resolves. */
function grantMaulAttackOfOpportunity(
  context: RangerResolverContext,
  event: Gw2ResolverEvent,
  recipient: 'pet' | typeof ACTOR.PLAYER
): void {
  context.effects.emit({
    kind: 'packet',
    event: buildResolverBuff({
      at: event.at,
      source: 'ranger',
      sourceId: event.skillId!,
      actorType: ACTOR.PLAYER,
      skillId: event.skillId,
      skillName: 'Attack of Opportunity',

      kind: `attack-of-opportunity-${recipient}`,
      duration: skillNumber(requireSkillFromContext(context, event.skillId!), 'duration'),
      stacks: 1,
      audience:
        recipient === 'pet'
          ? { recipients: RECIPIENT.SUMMONS, eligibleCompanionIds: [rangerPetCompanionId(context)] }
          : { recipients: RECIPIENT.SELF },
      triggeredBy: event.skillName
    })
  });
}

/** Consume after damage calculation, then let Maul grant a fresh, non-stacking charge. */
export function reactToRangerGreatswordDamage(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const recipient = attackRecipient(event);

  if (!recipient) return;

  const kind = `attack-of-opportunity-${recipient}`;
  context.combat.reviseBuffExpiry(
    kind,
    (application) =>
      application.at <= event.at &&
      (recipient === ACTOR.PLAYER || application.resolvedAudience.companionIds.includes(String(event.summonOwner))),
    (expiresAt) => Math.min(expiresAt, event.at)
  );
}

/** Each Maul variant queues its own recipient's next-attack charge after its strike resolves. */
export const maulLifecycle = {
  sideEffectHandlers: {
    // Queue the merged grant before observers consume the old charge; application still follows consumption.
    'ranger.maul-player'(runtime, context) {
      if (context.kind === 'effect') grantMaulAttackOfOpportunity(runtime, context.trigger.event, ACTOR.PLAYER);
    },
    'ranger.maul-pet'(runtime, context) {
      if (context.kind === 'effect') grantMaulAttackOfOpportunity(runtime, context.trigger.event, 'pet');
    }
  }
} satisfies RuntimeHooks<RangerRuntimeState, RangerSkill>;
