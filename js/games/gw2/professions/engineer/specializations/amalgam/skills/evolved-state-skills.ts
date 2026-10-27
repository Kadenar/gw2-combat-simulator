import { amalgamStrainOwnerId } from '#gw2/professions/engineer/specializations/amalgam/skills/strain-owner.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { ACTOR, CONTROL, BOON, CONDITION } from '#gw2/platform/constants.js';
import { skillNumber, requireEffect, requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import { AMALGAM_MORPH_KIND_BY_SKILL_ID } from '#gw2/professions/engineer/specializations/amalgam/selection-policy.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';
/**
 * Owns Amalgam Evolve, locked-slot, and evolved-state skill fragments.
 * Persistent strain and morph state remain under `mechanics/evolved-form.ts`.
 */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

const PLASMATIC_STATE_CAST_TIME_MS = 480 + 480;
const PLASMATIC_STATE_RECHARGE_OFFSET_MS = 480;

/** Supplies Evolve and its state-dependent action identities to specialization composition. */
export const AMALGAM_EVOLVED_STATE_SKILL_MECHANICS: Readonly<Record<string, Partial<Skill>>> = Object.freeze({
  [ID.SYMBIOTIC_SHIELDING]: {
    cooldown: 25,
    toolbeltParentId: ID.MITOTIC_STATE,
    mechanicSlot: 1,
    castTimeMs: 0,
    effects: []
  },
  [ID.EVOLVE_BASE]: {
    name: 'Evolve (Base)',
    // The selected skill owns its form lifetime and base attribute scaling for combat, previews, and tooltips.
    duration: 8,
    attributeMultiplier: 1.1,
    description: 'Enter Evolved form. Double Helix replaces this action with the two-charge variant.',
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
    // Double Helix owns the stronger attribute bonus; this variant owns its duration and ammunition.
    duration: 8,
    description: 'Enter Evolved form with an increased attribute bonus. Requires Double Helix.',
    countsAsToolbeltSkill: true,
    // Keep the traited identity on the same activation-anchored recharge contract.
    rechargeAnchor: 'castStart',
    cooldown: 40,
    ammo: 2,
    // The traited action has a short between-cast recharge and a separate per-charge recovery.
    ammoCastLockout: 1,
    ammoRecharge: 40,
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
    cooldown: 20,
    castTimeMs: 680,
    effects: []
  },
  [ID.LOCKED]: {
    cooldown: 0,
    castTimeMs: 0,
    effects: []
  },
  [ID.LIQUID_STATE]: {
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
    cooldown: 50,
    castTimeMs: 640,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Flux State — Packet 1',
        actorType: ACTOR.PLAYER
      },
      ...impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          // EVTC field packets land on a measured ~520 ms cadence; preserving
          // it also prevents exact-boundary distortion for 0.5-second ICDs.
          ticks: Array.from({ length: 12 }, (_, index) => ({ atMs: 520 + index * 520, coefficient: 9 / 12 })),
          name: 'Storm Damage',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          ticks: [520, 1040, 1560, 2080, 2600, 3120, 3640, 4160, 4680, 5200, 5720, 6240].map((atMs) => ({
            atMs,
            condition: CONDITION.BLEEDING,
            stacks: 1,
            duration: 5
          })),
          actorType: ACTOR.PLAYER
        }
      ]),
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.PULL
      }
    ]
  },
  [ID.SOLID_STATE]: {
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
    cooldown: 0,
    castTimeMs: 0,
    effects: []
  },
  [ID.PLASMATIC_STATE]: {
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
    cooldown: 0,
    castTimeMs: 0,
    effects: []
  }
});

/**
 * Applies the strain mapped to a Morph name, emitting status effects immediately
 * while retaining timestamp-backed strains for later modifier and resolver checks.
 */
export function applyAmalgamStrain(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  const state = amalgamState.from(context);
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
