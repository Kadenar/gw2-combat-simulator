import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  effectNumber,
  requireEffect,
  requireSkillFromContext,
  skillNumber
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillDefinition } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type {
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianRuntime,
  GuardianRuntimeState,
  GuardianSkill
} from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Canonical Core guardian skill definitions grouped by their GW2 owner. */

export const GUARDIAN_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.THROUGH_THE_HEART]: {
    name: 'Through the Heart',
    icon: 'https://render.guildwars2.com/file/CDCD4A9B6BC15D930A2E3B956D74A86671E4F835/3256351.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 600,
    interruptCommitMs: 360,
    // Keep the projectile strike and Bleeding on one committed impact.
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.6,
          projectile: true
        },
        {
          type: 'condition',
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 8,
          projectile: true
        }
      ]
    )
  },
  [ID.PEACEKEEPER]: {
    name: 'Peacekeeper',
    icon: 'https://render.guildwars2.com/file/E0F376A8512ECB5938A6C7B10477F6C397FF0D00/3256352.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_2',
    cooldown: 6,
    rechargeAnchor: 'castStart',
    // EVTC impact offsets keep Burning aligned with each strike.
    castTimeMs: 1040,
    interruptCommitMs: 960,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [280, 480, 640, 800, 960].map((atMs) => ({
          atMs,
          coefficient: 0.25
        }))
      },
      // Each strike applies the same Burning packet at its impact time.
      ...[280, 480, 640, 800, 960].map((atMs) => ({
        type: 'condition' as const,
        ticks: [{ atMs, condition: CONDITION.BURNING, stacks: 1, duration: 1.5 }]
      }))
    ])
  },
  [ID.SYMBOL_OF_IGNITION]: {
    name: 'Symbol of Ignition',
    icon: 'https://render.guildwars2.com/file/93750C95B5645112B9ED807DE3AF29A340037ED0/3256353.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_3',

    cooldown: 12,
    internalCooldown: 0.24,
    // Author symbol identity independently of the skill's display text.
    tags: ['symbol'],
    castTimeMs: 360,
    interruptCommitMs: 320,
    comboFields: [
      {
        ownerId: 'guardian',
        fieldType: COMBO_FIELD.LIGHT,
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        coefficient: 0.4,
        // Ignition pulses on its own 680 ms cadence, independently of its four-second field.
        atMs: 280,
        applications: 5,
        intervalMs: 680
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        stacks: 1,
        duration: 5,
        audience: { recipients: RECIPIENT.PARTY },
        atMs: 280,
        applications: 5,
        intervalMs: 680
      }
    ]),
    // Placement opens the shared ignition observer only after commitment.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'guardian.place-ignition',
          id: 'ignition',
          effects: [
            {
              type: 'condition',
              name: 'Burning',
              condition: CONDITION.BURNING,
              stacks: 1,
              duration: 1,
              actorType: ACTOR.PLAYER
            },
            {
              type: 'buff',
              name: 'guardian-symbol-of-ignition-field',
              kind: 'guardian-symbol-of-ignition-field',
              stacks: 1,
              duration: 4,
              actorType: ACTOR.EFFECT
            }
          ]
        }
      }
    ]
  },
  [ID.HAIL_OF_JUSTICE]: {
    name: 'Hail of Justice',
    icon: 'https://render.guildwars2.com/file/1A29DD0527137526CB1D355403DC009A57D767A6/3256354.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_4',
    cooldown: 10,
    ammo: 2,

    ammoCastLockout: 1,
    castTimeMs: 1120,
    // Cancelling the channel keeps landed hits and their conditions, while dropping later packets.
    interruptMode: 'per-packet',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [280, 440, 640, 800, 960].map((atMs) => ({
          atMs,
          coefficient: 0.3,
          projectile: true
        }))
      },
      {
        type: 'condition',
        ticks: [280, 440, 640, 800, 960].map((atMs) => ({
          atMs,
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 8,
          projectile: true
        }))
      },
      {
        type: 'condition',
        ticks: [280, 440, 640, 800, 960].map((atMs) => ({
          atMs,
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 1,
          projectile: true
        }))
      }
    ])
  },
  [ID.JURISDICTION]: {
    name: 'Jurisdiction',
    icon: 'https://render.guildwars2.com/file/18E2D752067BEAC1E47A2928DFF2A1CE13B8DE3B/3256355.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_5',
    cooldown: 20,
    castTimeMs: 800,
    interruptCommitMs: 640,
    // Keep the projectile's strike, Burning, and stun on one committed impact.
    effects: impactEffects(
      { atMs: 640, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 3,
          projectile: true
        },
        {
          type: 'condition',
          condition: CONDITION.BURNING,
          stacks: 5,
          duration: 6
        },
        {
          type: 'control',
          controlKind: CONTROL.STUN
        }
      ]
    )
  }
};

/** Selected field duration is shared by placement and the public combo field. */
export function guardianIgnitionFields(runtime: MechanicQueriesOf<GuardianRuntime>): Skill['comboFields'] {
  const skill = requireSkillFromContext(runtime, ID.SYMBOL_OF_IGNITION);

  // Removing the activation declaration disables its field as well as its placement transition.
  if (!skill.sideEffects?.some(({ do: action }) => 'id' in action && action.id === 'ignition')) return [];

  const field = requireEffect(
    skill,
    'buff',
    'guardian-symbol-of-ignition-field',
    requireSkillAction(skill, 'ignition')
  );
  return field
    ? [
        {
          ownerId: 'guardian',
          fieldType: COMBO_FIELD.LIGHT,
          duration: effectNumber(skill, field, 'duration'),
          startAnchor: 'castEnd'
        }
      ]
    : [];
}

const guardianIgnitionActions: RuntimeProfession<GuardianRuntimeState, GuardianSkill>['sideEffectHandlers'] = {
  'guardian.place-ignition'(runtime) {
    const skill = requireSkillFromContext(runtime, ID.SYMBOL_OF_IGNITION);
    const field = requireEffect(
      skill,
      'buff',
      'guardian-symbol-of-ignition-field',
      requireSkillAction(skill, 'ignition')
    );

    if (!field) return;

    runtime.profession.core.symbolIgnitionStartsAt = runtime.time;
    runtime.profession.core.symbolIgnitionUntil = canonicalTime(runtime.time + effectNumber(skill, field, 'duration'));
  }
};

/** Registers pistol ignition actions with the Core hook assembly. */
export const guardianIgnitionLifecycle = {
  sideEffectHandlers: guardianIgnitionActions
} satisfies RuntimeHooks<GuardianRuntimeState, GuardianSkill>;

// Symbol hits and projectile hits have independent ignition cooldowns. Torch pulses
// and fire-whirl bolts also ignite, but ordinary conditions and ignition itself do not.
export function reactToSymbolOfIgnition(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const ignitionSkill = requireSkillFromContext(context, ID.SYMBOL_OF_IGNITION);

  if (!ignitionSkill.sideEffects?.some(({ do: action }) => 'id' in action && action.id === 'ignition')) return;

  const burning = requireEffect(
    ignitionSkill,
    'condition',
    CONDITION.BURNING,
    requireSkillAction(ignitionSkill, 'ignition')
  );

  if (!burning) return;

  const burningBolt =
    event.type === 'condition' &&
    event.condition === CONDITION.BURNING &&
    !!event.comboId &&
    event.fieldType === COMBO_FIELD.FIRE &&
    event.finisherType === COMBO_FINISHER.WHIRL;
  const torchPulse =
    event.type === 'condition' && event.condition === CONDITION.BURNING && event.skillId === ID.ZEALOTS_FLAME;

  if (
    !isGw2PlayerActorEvent(event) ||
    !((event.type === 'damage' && (event.coefficient || 0) > 0) || burningBolt || torchPulse) ||
    event.skillId === ID.SYMBOL_OF_IGNITION
  ) {
    return;
  }

  // Ignition reads the live Core window through the shared state accessor.
  const state = professionCoreState(context.profession);

  if (
    (state.symbolIgnitionUntil || 0) <= (state.symbolIgnitionStartsAt || 0) ||
    event.at < (state.symbolIgnitionStartsAt || 0) ||
    event.at > (state.symbolIgnitionUntil || 0)
  ) {
    return;
  }

  const projectile = event.projectile === true || burningBolt;
  const cooldownKey = projectile ? 'guardian.core.symbolProjectileIgnition' : 'guardian.core.symbolIgnition';

  // Match gw2combat's end-of-tick cooldown removal: the deadline itself is still blocked.
  if (!context.procs.claimCooldown(cooldownKey, event.at, skillNumber(ignitionSkill, 'internalCooldown'))) return;

  context.effects.emit({
    kind: 'packet',
    event: buildResolverCondition({
      at: event.at,
      priority: 5,
      source: 'guardian',
      sourceId: ID.SYMBOL_OF_IGNITION,
      actorType: ACTOR.PLAYER,
      // Ignition remains attributed to the actual impact that claimed its cooldown.
      activationId: event.activationId,
      causalOrder: event.causalOrder ?? event.eventOrder,
      skillId: ID.SYMBOL_OF_IGNITION,
      skillName: 'Symbol of Ignition',
      name: 'Symbol of Ignition — Ignition',
      condition: String(burning.condition),
      stacks: effectNumber(ignitionSkill, burning, 'stacks'),
      duration: effectNumber(ignitionSkill, burning, 'duration'),
      triggeredBy: event.skillName,
      projectile
    })
  });
}
