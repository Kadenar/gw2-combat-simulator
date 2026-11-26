/**
 * Owns Mechanist signet skills and their trait-dependent passives, using the selected trait's canonical balance.
 * Mech commands and autonomous attack identities live in their named catalogs.
 */
import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET, type Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { ACTOR, COMBO_FIELD, CONDITION, CONTROL, RECIPIENT, type BoonId } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { balanceNumber, requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { isEngineerMechCommand } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-queries.js';
import type { MechanistSkill } from '#gw2/professions/engineer/specializations/mechanist/types.js';
import type { EngineerRuntime, EngineerRuntimeState, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Supplies Mechanist signet definitions to specialization composition. */
export const MECHANIST_SIGNET_SKILL_MECHANICS: Readonly<Record<string, SkillDefinition<MechanistSkill>>> = {
  [ID.RECTIFIER_SIGNET]: {
    name: 'Rectifier Signet',
    icon: 'https://render.guildwars2.com/file/C1060E52F505962C04A32B0267CA0C75475D1105/2503669.png',
    type: 'Heal',
    slot: 'Heal',

    cooldown: 30,
    castTimeMs: 520,
    effects: []
  },
  [ID.OVERCLOCK_SIGNET]: {
    name: 'Overclock Signet',
    icon: 'https://render.guildwars2.com/file/A82F0980D5ED24F305FA57F3A929C1E90D26327F/2503668.png',
    type: 'Elite',
    slot: 'Elite',

    // Intrinsic tuning follows this selected skill through patches and deferred work.
    rechargeMultiplier: 0.8,
    cooldown: 90,
    // Orders the active mech to channel Jade Buster Cannon; see `mechanist/mechanics/mech.ts`.

    castTimeMs: 0,
    effects: [],
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.overclock-signet' } }]
  },
  [ID.SHIFT_SIGNET]: {
    name: 'Shift Signet',
    icon: 'https://render.guildwars2.com/file/EB1BBD04D00E70E40117034CE91F5DC2A9E3C334/2503689.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 25,
    castTimeMs: 0,
    effects: []
  },
  [ID.SUPERCONDUCTING_SIGNET]: {
    name: 'Superconducting Signet',
    icon: 'https://render.guildwars2.com/file/99C42595B3D1FA7C96C3703B66F241792F08B107/2503691.png',
    type: 'Utility',
    slot: 'Utility',

    // Intrinsic tuning follows this selected skill through patches and deferred work.
    conditionDamageIncrease: 0.1,
    cooldown: 30,
    castTimeMs: 880,
    interruptCommitMs: 560,
    // The selected passive strengthens conditions while recharge and J-Drive permit it.
    modifiers: [
      {
        id: 'engineer.superconducting-signet',
        scope: 'profession',
        target: MODIFIER_TARGET.CONDITION_DAMAGE,
        operation: 'damage-additive',
        // Ordinary signets lose their passive on recharge; J-Drive retains and improves it.
        amount: superconductingSignetDamage,
        when: (context) =>
          selectedSignet(context, ID.SUPERCONDUCTING_SIGNET) &&
          signetPassiveAvailable(context, !context.timeline?.skillOnCooldownAt(ID.SUPERCONDUCTING_SIGNET, context.time))
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: Array.from({ length: 6 }, (_, index) => ({ atMs: 560 + index * 1000, coefficient: 2.4 / 6 })),
        intervalTimingScale: 'fixed',
        comboFields: [{ ownerId: 'engineer', fieldType: COMBO_FIELD.LIGHTNING, duration: 5, startAnchor: 'event' }],
        name: 'Superconducting Signet',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        atMs: 560,
        applications: 6,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        atMs: 560,
        applications: 6,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        atMs: 560,
        applications: 6,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.FORCE_SIGNET]: {
    name: 'Force Signet',
    icon: 'https://render.guildwars2.com/file/C540CA603AE4BDE57698082CE62396075699DD63/2503690.png',
    type: 'Utility',
    slot: 'Utility',

    // Intrinsic tuning follows this selected skill through patches and deferred work.
    damageIncrease: 0.15,
    cooldown: 30,
    castTimeMs: 520,
    // The selected passive affects outgoing strikes while recharge and J-Drive permit it.
    modifiers: [
      {
        id: 'engineer.force-signet',
        scope: 'profession',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'damage-additive',
        amount: forceSignetDamage,
        when: (context) =>
          selectedSignet(context, ID.FORCE_SIGNET) &&
          signetPassiveAvailable(context, !context.timeline?.skillOnCooldownAt(ID.FORCE_SIGNET, context.time))
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Force Signet',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.KNOCKBACK
      }
    ]
  },
  [ID.BARRIER_SIGNET]: {
    name: 'Barrier Signet',
    icon: 'https://render.guildwars2.com/file/EB737C0D4462F5C5572166DEC2801DD56148AFE6/2503688.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 30,
    castTimeMs: 360,
    effects: []
  }
};

/** Checks the normalized active loadout for a named Mechanist signet. */
function selectedSignet(context: Pick<Gw2ModifierContext, 'config'>, id: number): boolean {
  return selectedSkillIdSet(context.config?.selectedSkillIds).has(id);
}

/** Jade Dynamo owns command recharge before J-Drive may improve an equipped Overclock passive. */
export function overclockPassive(context: MechanicQueriesOf<EngineerRuntime>, skill: EngineerSkill): boolean {
  return (
    !(isEngineerMechCommand(skill) && hasTrait(context, TRAIT.MECH_CORE_JADE_DYNAMO)) &&
    overclockSignetApplies(context, skill)
  );
}

/** J-Drive retains equipped signet passives while they recharge. */
function signetPassiveAvailable(context: unknown, ready: boolean): boolean {
  return hasTrait(context, TRAIT.MECH_CORE_J_DRIVE) || ready;
}

/** Ordinary Overclock applies only when neither trait owns the recharge adjustment. */
function ordinaryOverclockEligible(context: MechanicQueriesOf<EngineerRuntime>, skill: EngineerSkill): boolean {
  return (
    !(isEngineerMechCommand(skill) && hasTrait(context, TRAIT.MECH_CORE_JADE_DYNAMO)) &&
    !hasTrait(context, TRAIT.MECH_CORE_J_DRIVE)
  );
}

/** The signet owns its base passive; J-Drive owns the replacement bonus while selected. */
function forceSignetDamage(context: Gw2ModifierContext): number {
  return hasTrait(context, TRAIT.MECH_CORE_J_DRIVE)
    ? balanceNumber(context.catalog, TRAIT.MECH_CORE_J_DRIVE, 'damageIncrease')
    : skillNumber(requireSkill(context.catalog, ID.FORCE_SIGNET), 'damageIncrease');
}

/** The selected trait balance supplies Superconducting's improved passive without a second literal rate. */
function superconductingSignetDamage(context: Gw2ModifierContext): number {
  return hasTrait(context, TRAIT.MECH_CORE_J_DRIVE)
    ? balanceNumber(context.catalog, TRAIT.MECH_CORE_J_DRIVE, 'conditionDamageIncrease')
    : skillNumber(requireSkill(context.catalog, ID.SUPERCONDUCTING_SIGNET), 'conditionDamageIncrease');
}

/** J-Drive keeps Shift's boon copying available while the signet recharges. */
function shiftSignetPassive(context: EngineerRuntime): boolean {
  return (
    selectedSignet(context, ID.SHIFT_SIGNET) &&
    signetPassiveAvailable(context.config, !context.cooldownController.isOnCooldown(ID.SHIFT_SIGNET))
  );
}

const CONSOLE_PULSE_TASK = 'engineer.shift-signet-console';
// The training technician grants ten seconds of each enabled boon every ten seconds.
const CONSOLE_PULSE_SECONDS = 10;
const CONSOLE_BOON_DURATION_SECONDS = 10;

/** The mech receives its own copy with the source's final duration and stack count. */
function copyShiftSignetBoon(
  runtime: EngineerRuntime,
  at: number,
  boon: BoonId,
  stacks: number,
  duration: number,
  triggeredBy?: string
): void {
  runtime.effects.emit({
    kind: 'profile',
    profile: requireSkill(runtime.helpers, ID.SHIFT_SIGNET),
    at,
    attribution: { source: 'engineer', sourceId: ID.SHIFT_SIGNET, actorType: ACTOR.PLAYER, triggeredBy },
    effects: [
      {
        type: 'boon',
        boon,
        stacks,
        duration,
        audience: {
          recipients: RECIPIENT.SUMMONS,
          affectsSelf: false,
          maximumRecipients: 1,
          eligibleCompanionIds: ['engineer.mech']
        }
      }
    ],
    transform: (packet) => ({ ...packet, name: `Shift Signet - ${boon}`, fixedDuration: true })
  });
}

/** Shift checks its passive on each application. Copies already on the mech retain their own expiry. */
export const shiftSignetHooks: RuntimeHooks<EngineerRuntimeState, EngineerSkill> = {
  initialize(runtime) {
    if (
      selectedSignet(runtime, ID.SHIFT_SIGNET) &&
      Object.entries(runtime.config.boons ?? {}).some(([boon, value]) => isStandardBoon(boon) && Number(value) > 0)
    )
      runtime.schedule(CONSOLE_PULSE_TASK, 0, null, undefined, 0, 'buffs');
  },
  backgroundTasks: [CONSOLE_PULSE_TASK],
  tasks: {
    [CONSOLE_PULSE_TASK](runtime) {
      if (shiftSignetPassive(runtime)) {
        for (const [boon, value] of Object.entries(runtime.config.boons ?? {})) {
          if (isStandardBoon(boon) && Number(value) > 0)
            copyShiftSignetBoon(
              runtime,
              runtime.time,
              boon,
              Number(value),
              CONSOLE_BOON_DURATION_SECONDS,
              'Training console'
            );
        }
      }

      runtime.schedule(CONSOLE_PULSE_TASK, runtime.time + CONSOLE_PULSE_SECONDS, null, undefined, 0, 'buffs');
    }
  },
  reactions: {
    'buff.applied'(runtime, event) {
      if (isStandardBoon(event.kind) && event.resolvedAudience?.includesSelf && shiftSignetPassive(runtime))
        copyShiftSignetBoon(runtime, event.at, event.kind, event.stacks || 1, event.duration || 0);
    }
  }
};

/** Overclock's selected passive affects other signets; trait precedence is applied by the recharge owner. */
function overclockSignetApplies(context: MechanicQueriesOf<EngineerRuntime>, skill: EngineerSkill): boolean {
  return (
    skill.id !== ID.OVERCLOCK_SIGNET &&
    Object.hasOwn(MECHANIST_SIGNET_SKILL_MECHANICS, skill.id) &&
    selectedSkillIdSet(context.config.selectedSkillIds).has(ID.OVERCLOCK_SIGNET)
  );
}

/** The skill owns ordinary Overclock availability; traits independently supply their stronger recharge rules. */
export function overclockRechargeWork(
  context: MechanicQueriesOf<EngineerRuntime>,
  skill: EngineerSkill,
  work: number
): number {
  return ordinaryOverclockEligible(context, skill) &&
    overclockSignetApplies(context, skill) &&
    (context.cooldownController.readyAt(ID.OVERCLOCK_SIGNET) || 0) <= context.time
    ? work * skillNumber(requireSkill(context.helpers, ID.OVERCLOCK_SIGNET), 'rechargeMultiplier')
    : work;
}
