import { requireBalanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import { AMALGAM_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/amalgam/profiles.js';
import type { AmalgamMorphKind } from '#gw2/professions/engineer/specializations/amalgam/skills/protocol-skills.js';
import type { EngineerRuntime } from '#gw2/professions/engineer/types.js';
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
    castTimeMs: 0,
    cooldown: 25,
    effects: [],
    toolbeltParentId: ID.MITOTIC_STATE,
    mechanicSlot: 1
  },
  [ID.EVOLVE_BASE]: {
    // Schedule the form transition before the first affected packet, only when the cast reaches it.
    sideEffects: [{ on: 'castStart', do: { type: 'engineer.schedule-evolve' } }],
    name: 'Evolve (Base)',
    description: 'Enter Evolved form. Double Helix replaces this action with the two-charge variant.',
    countsAsToolbeltSkill: true,
    // Custom: Consumes the selected strain and enters Evolved form; see `amalgam/mechanics/evolved-form.ts`.

    castTimeMs: 640,
    // Evolve begins recharging on activation, so its cast window contributes to the next use.
    rechargeAnchor: 'castStart',
    // Commit before the animation ends so its remaining aftercast can be interrupted.
    interruptCommitMs: 560,
    cooldown: 40,
    effects: [],
    mechanicSlot: 5
  },
  [ID.EVOLVE_DOUBLE_HELIX]: {
    // Schedule the form transition before the first affected packet, only when the cast reaches it.
    sideEffects: [{ on: 'castStart', do: { type: 'engineer.schedule-evolve' } }],
    name: 'Evolve (Double Helix)',
    description: 'Enter Evolved form with an increased attribute bonus. Requires Double Helix.',
    countsAsToolbeltSkill: true,
    // Custom: Consumes the selected strain and enters Evolved form; see `amalgam/mechanics/evolved-form.ts`.

    castTimeMs: 640,
    // Keep the traited identity on the same activation-anchored recharge contract.
    rechargeAnchor: 'castStart',
    // Commit before the animation ends so its remaining aftercast can be interrupted.
    interruptCommitMs: 560,
    cooldown: 40,
    ammo: 2,
    // The traited action has a short between-cast recharge and a separate per-charge recovery.
    ammoCastLockout: 1,
    ammoRecharge: 40,
    effects: [],
    mechanicSlot: 5
  },
  [ID.MITOTIC_STATE]: {
    castTimeMs: 680,
    cooldown: 20,
    effects: []
  },
  [ID.LOCKED]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.LIQUID_STATE]: {
    castTimeMs: 1000,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        ticks: [240, 520, 760, 1000].map((atMs) => ({ atMs, coefficient: 3.2 / 4 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Liquid State',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 4,
        duration: 12,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 4,
        duration: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.FLUX_STATE]: {
    castTimeMs: 640,
    cooldown: 50,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Flux State — Packet 1',
        actorType: 'player'
      },
      ...impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          // EVTC field packets land on a measured ~520 ms cadence; preserving
          // it also prevents exact-boundary distortion for 0.5-second ICDs.
          ticks: Array.from({ length: 12 }, (_, index) => ({ atMs: 520 + index * 520, coefficient: 9 / 12 })),
          name: 'Storm Damage',
          actorType: 'player'
        },
        {
          type: 'condition',
          ticks: [520, 1040, 1560, 2080, 2600, 3120, 3640, 4160, 4680, 5200, 5720, 6240].map((atMs) => ({
            atMs,
            condition: 'Bleeding',
            stacks: 1,
            duration: 5
          })),
          actorType: 'player'
        }
      ]),
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'pull'
      }
    ]
  },
  [ID.SOLID_STATE]: {
    castTimeMs: 520,
    cooldown: 25,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Solid State',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'stun'
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 5,
        stacks: 5
      }
    ]
  },
  [ID.LOCKED_ID_77107]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.PLASMATIC_STATE]: {
    // Schedule the form transition before the first affected packet, only when the cast reaches it.
    sideEffects: [{ on: 'castStart', do: { type: 'engineer.schedule-plasmatic' } }],
    // Custom: Activates Plasmatic State and its duration/state event; see `amalgam/mechanics/evolved-form.ts`.

    castTimeMs: PLASMATIC_STATE_CAST_TIME_MS,
    cooldown: 25,
    rechargeAnchor: 'castStart',
    rechargeOffsetMs: PLASMATIC_STATE_RECHARGE_OFFSET_MS,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [440, 800].map((atMs) => ({ atMs, coefficient: 2.25 })),
        name: 'Plasmatic State',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [440, 800].map((atMs) => ({ atMs, condition: 'Burning', stacks: 2, duration: 5 })),
        actorType: 'player'
      }
    ])
  },
  [ID.LOCKED_ID_77388]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  }
});

/**
 * Applies the strain mapped to a Morph name, emitting status effects immediately
 * while retaining timestamp-backed strains for later modifier and resolver checks.
 */
export function applyAmalgamStrain(context: EngineerRuntime, morphKind: AmalgamMorphKind, at: number): void {
  const state = amalgamState.from(context);
  const profile = requireBalanceProfileFromContext(context, PROFILE.strains);
  if (morphKind === 'thorns') {
    const rapaciousStrainProfile = requireBalanceProfileFromContext(context, PROFILE.rapaciousStrain);
    const duration = balanceProfileNumber(rapaciousStrainProfile, 'durationMultiplier');
    state.rapaciousUntil = Math.max(state.rapaciousUntil || 0, at + duration);
  }

  // The selected packet owns its effect and duration; state windows follow their associated boon.
  for (const effect of profile.effects || []) {
    if (effect.metadata?.trigger !== morphKind) continue;
    if (!effect.sourceId || !effect.name) throw new Error('Missing Amalgam strain identity');
    if (effect.type === 'control') {
      buildEngineerPackets('control', {
        at,
        source: 'engineer',
        sourceId: effect.sourceId,
        actorType: 'player',
        skillName: effect.name,
        name: effect.name,
        controlKind: effect.controlKind
      }).forEach((packet) => context.effects.emit({ kind: 'packet', event: packet }));
      continue;
    }

    if (effect.type !== 'boon' && effect.type !== 'buff') continue;
    if (effect.type === 'boon') {
      if (morphKind === 'obliterate') state.titanicUntil = Math.max(state.titanicUntil || 0, at + effect.duration);
      else if (morphKind === 'shred') state.predatorUntil = Math.max(state.predatorUntil || 0, at + effect.duration);
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
        actorType: 'player',
        skillName: effect.name,
        name: effect.name,
        kind: String(effect.boon || effect.kind),
        duration: effect.duration,
        stacks: effect.stacks
      },
      sourceSkill
    ).forEach((packet) => context.effects.emit({ kind: 'packet', event: packet }));
  }
}
