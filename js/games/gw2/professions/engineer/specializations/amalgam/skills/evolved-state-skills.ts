/**
 * Owns Amalgam Evolve, locked-slot, and evolved-state skill definitions.
 * Persistent strain and morph state remain under `mechanics/evolved-form.ts`.
 */
import { ACTOR, BOON, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { requireEffect, requireSkillFromContext, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { AMALGAM_MORPH_KIND_BY_SKILL_ID } from '#gw2/professions/engineer/specializations/amalgam/selection-policy.js';
import { amalgamStrainOwnerId } from '#gw2/professions/engineer/specializations/amalgam/skills/strain-owner.js';
import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import type { AmalgamSkill } from '#gw2/professions/engineer/specializations/amalgam/types.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

const PLASMATIC_STATE_CAST_TIME_MS = 480 + 480;
const PLASMATIC_STATE_RECHARGE_OFFSET_MS = 480;
// Flux State lands at 520 ms, then its field strikes and Bleeding recur together every 520 ms.
const FLUX_STATE_FIELD_TICK_OFFSETS_MS = Array.from({ length: 12 }, (_, index) => 1040 + index * 520);

/** Supplies Evolve and its state-dependent action identities to specialization composition. */
export const AMALGAM_EVOLVED_STATE_SKILL_MECHANICS: Readonly<Record<string, SkillDefinition<AmalgamSkill>>> = {
  [ID.SYMBIOTIC_SHIELDING]: {
    name: 'Symbiotic Shielding',
    icon: 'https://render.guildwars2.com/file/2BB11D20C5590A2BA1039107273224F6BE0536E6/3680133.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 25,
    toolbeltParentId: ID.MITOTIC_STATE,
    mechanicSlot: 1,
    castTimeMs: 0,
    effects: []
  },
  [ID.EVOLVE_BASE]: {
    name: 'Evolve (Base)',
    icon: 'https://render.guildwars2.com/file/0513CCBF102BF696E9027F6363A9705B724CC630/3680129.png',
    type: 'Profession',
    slot: 'Profession_5',
    // The selected skill owns its form lifetime and base attribute scaling for combat, previews, and tooltips.
    duration: 8,
    attributeMultiplier: 1.1,
    countsAsToolbeltSkill: true,
    // Evolve begins recharging on activation, so its cast window contributes to the next use.
    rechargeAnchor: 'castStart',
    cooldown: 40,
    mechanicSlot: 5,
    // Custom: Consumes the selected strain and enters Evolved form; see `amalgam/mechanics/evolved-form.ts`.

    castTimeMs: 640,
    // Commit before the animation ends so its remaining aftercast can be interrupted.
    interruptCommitMs: 560,
    effects: [],
    // Schedule the form transition before the first affected packet, only when the cast reaches it.
    sideEffects: [{ on: 'castStart', do: { type: 'engineer.schedule-evolve' } }]
  },
  [ID.EVOLVE_DOUBLE_HELIX]: {
    name: 'Evolve (Double Helix)',
    icon: 'https://render.guildwars2.com/file/0513CCBF102BF696E9027F6363A9705B724CC630/3680129.png',
    type: 'Profession',
    slot: 'Profession_5',
    // Double Helix owns the stronger attribute bonus; this variant owns its duration and ammunition.
    duration: 8,
    countsAsToolbeltSkill: true,
    // Keep the traited identity on the same activation-anchored recharge contract.
    rechargeAnchor: 'castStart',
    cooldown: 40,
    ammo: 2,
    // The traited action has a short between-cast recharge and a separate per-charge recovery.
    ammoCastLockout: 1,

    mechanicSlot: 5,
    // Custom: Consumes the selected strain and enters Evolved form; see `amalgam/mechanics/evolved-form.ts`.

    castTimeMs: 640,
    // Commit before the animation ends so its remaining aftercast can be interrupted.
    interruptCommitMs: 560,
    effects: [],
    // Schedule the form transition before the first affected packet, only when the cast reaches it.
    sideEffects: [{ on: 'castStart', do: { type: 'engineer.schedule-evolve' } }]
  },
  [ID.MITOTIC_STATE]: {
    name: 'Mitotic State',
    icon: 'https://render.guildwars2.com/file/69ACD1030C55270FE69099A95FEDA716EFE64F5C/3680126.png',
    type: 'Heal',
    slot: 'Heal',

    cooldown: 20,
    castTimeMs: 680,
    effects: []
  },
  [ID.LOCKED]: {
    name: 'Locked',
    icon: 'https://render.guildwars2.com/file/7ECD0608332279F720601EB4BF362FA41BA5990D/3680232.png',
    type: 'Profession',
    slot: 'Profession_3',
    cooldown: 0,
    castTimeMs: 0,
    effects: []
  },
  [ID.LIQUID_STATE]: {
    name: 'Liquid State',
    icon: 'https://render.guildwars2.com/file/220576D1BDB3D8555755AAD1B8946B5C7E450BE8/3680137.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 20,
    castTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        ticks: [240, 520, 760, 1000].map((atMs) => ({ atMs, coefficient: 3.2 / 4 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Liquid State',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 4,
        duration: 12,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 4,
        duration: 1,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.FLUX_STATE]: {
    name: 'Flux State',
    icon: 'https://render.guildwars2.com/file/0A36EB0D061E9B63261260BE663EC6F4C04C1B1C/3680125.png',
    type: 'Elite',
    slot: 'Elite',

    cooldown: 50,
    castTimeMs: 640,
    // Commit before the animation ends so its remaining aftercast can be interrupted.
    interruptCommitMs: 600,
    // Once committed, the initial impact and persistent field keep their cast-start schedule after interruption.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        atMs: 520,
        coefficient: 2,
        hits: 1,
        name: 'Flux State — Packet 1',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'strike',
        ticks: FLUX_STATE_FIELD_TICK_OFFSETS_MS.map((atMs) => ({ atMs, coefficient: 9 / 12 })),
        name: 'Storm Damage',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: FLUX_STATE_FIELD_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 5
        })),
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        atMs: 520,
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.PULL
      }
    ])
  },
  [ID.SOLID_STATE]: {
    name: 'Solid State',
    icon: 'https://render.guildwars2.com/file/FD0857ECCA025A02E2E7BB00DB0E65FFBA551661/3680139.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 25,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Solid State',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.STUN
      },
      {
        type: 'boon',
        boon: BOON.STABILITY,
        duration: 5,
        stacks: 5
      }
    ]
  },
  [ID.LOCKED_ID_77107]: {
    name: 'Locked',
    icon: 'https://render.guildwars2.com/file/7ECD0608332279F720601EB4BF362FA41BA5990D/3680232.png',
    type: 'Profession',
    slot: 'Profession_4',
    cooldown: 0,
    castTimeMs: 0,
    effects: []
  },
  [ID.PLASMATIC_STATE]: {
    name: 'Plasmatic State',
    icon: 'https://render.guildwars2.com/file/2AA6D1CCEE723B7415B60DBDBAB55275EA562D29/3680138.png',
    type: 'Utility',
    slot: 'Utility',

    // The cast skill owns the damage-bonus window that starts with its first strike.
    duration: 6,
    cooldown: 25,
    rechargeAnchor: 'castStart',
    rechargeOffsetMs: PLASMATIC_STATE_RECHARGE_OFFSET_MS,
    // Custom: Activates Plasmatic State and its duration/state event; see `amalgam/mechanics/evolved-form.ts`.

    castTimeMs: PLASMATIC_STATE_CAST_TIME_MS,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [440, 800].map((atMs) => ({ atMs, coefficient: 2.25 })),
        name: 'Plasmatic State',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [440, 800].map((atMs) => ({ atMs, condition: CONDITION.BURNING, stacks: 2, duration: 5 })),
        actorType: ACTOR.PLAYER
      }
    ]),
    // Schedule the form transition before the first affected packet, only when the cast reaches it.
    sideEffects: [{ on: 'castStart', do: { type: 'engineer.schedule-plasmatic' } }]
  },
  [ID.LOCKED_ID_77388]: {
    name: 'Locked',
    icon: 'https://render.guildwars2.com/file/7ECD0608332279F720601EB4BF362FA41BA5990D/3680232.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 0,
    castTimeMs: 0,
    effects: []
  }
};

/**
 * Applies the strain mapped to a Morph name, emitting status effects immediately
 * while retaining timestamp-backed strains for later modifier and resolver checks.
 */
export function applyAmalgamStrain(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  const state = amalgamState.from(context.profession);
  const morphKind = AMALGAM_MORPH_KIND_BY_SKILL_ID.get(skill.id);
  // Resolve shared strain tuning before granting it, independently of the triggering slot.
  skill = requireSkillFromContext(context, amalgamStrainOwnerId(skill.id));
  const action = requireSkillAction(skill, 'strain');

  if (morphKind === 'thorns') {
    // A removed shared payload cannot arm an empty proc window.
    if (requireEffect(skill, 'strike', 'Rapacious Strain', action)) {
      state.rapaciousUntil = Math.max(state.rapaciousUntil || 0, at + skillNumber(skill, 'rapaciousDuration'));
    }

    return;
  }

  // The selected packet owns its effect and duration; state windows follow their associated boon.
  for (const effect of action.effects) {
    if (!effect.sourceId || !effect.name) throw new Error('Missing Amalgam strain identity');

    if (effect.type === 'control') {
      buildEngineerPackets('control', {
        at,
        source: 'engineer',
        sourceId: effect.sourceId,
        actorType: ACTOR.PLAYER,
        skillName: effect.name,
        name: effect.name,
        controlKind: effect.controlKind
      }).forEach((packet) => context.effects.emit({ kind: 'packet', event: packet }));
      continue;
    }

    if (effect.type !== 'boon' && effect.type !== 'buff') continue;

    if (effect.type === 'boon') {
      if (morphKind === 'obliterate') {
        state.titanicUntil = Math.max(state.titanicUntil || 0, at + effect.duration);
      } else if (morphKind === 'shred') state.predatorUntil = Math.max(state.predatorUntil || 0, at + effect.duration);
      else if (morphKind === 'demolish')
        state.berserkerUntil = Math.max(state.berserkerUntil || 0, at + effect.duration);
    }

    // Resolve each strain's catalog identity before direct canonical status emission.
    const sourceSkill = context.helpers.skillsById.get(effect.sourceId) || { id: effect.sourceId, name: effect.name };
    buildEngineerPackets(
      'buff',
      {
        at,
        source: 'engineer',
        sourceId: effect.sourceId,
        actorType: ACTOR.PLAYER,
        skillName: effect.name,
        name: effect.name,
        kind: String(effect.boon || effect.kind).toLowerCase(),
        duration: effect.duration,
        stacks: effect.stacks
      },
      sourceSkill
    ).forEach((packet) => context.effects.emit({ kind: 'packet', event: packet }));
  }
}
