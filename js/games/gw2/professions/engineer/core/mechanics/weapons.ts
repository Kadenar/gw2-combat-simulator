import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import { produceRuntimeCombos } from '#gw2/platform/combos/runtime.js';
import type { RuntimeCast, RuntimeProfession, SkillTaskData } from '#gw2/platform/simulation/runtime-state.js';

import type { EngineerRuntime, EngineerRuntimeState } from '#gw2/professions/engineer/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { emitEngineerEvent } from '#gw2/professions/engineer/core/events.js';

// Deploying, detonating, or bursting the Healing Turret all restart the one deployed turret lifetime.
const HEALING_TURRET_SKILL_IDS = new Set<number>([ID.HEALING_TURRET, ID.DETONATE_HEALING_TURRET, ID.CLEANSING_BURST]);

/** Skill declarations select each spear mutation; handlers retain lifetime ownership and release-time snapshots. */
export const engineerSpearSideEffectHandlers: RuntimeProfession<EngineerRuntimeState>['sideEffectHandlers'] = {
  'engineer.lightning-rod'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Lightning Rod requires a cast trigger.');
    const { cast } = context;
    const state = runtime.profession.core;
    const at = runtime.time;
    runtime.cancelOwner({ id: 'engineer.lightning-rod', generation: state.lightningRodGeneration });
    const owner = { id: 'engineer.lightning-rod', generation: ++state.lightningRodGeneration };
    state.lightningRodChargeExpiries = [];
    const readyAt = cast.start + 4.2;
    armSkillFlip(state.availableFlips, ID.ELECTRIC_ARTILLERY, readyAt, readyAt + 8);
    for (let index = 0; index < 8; index++)
      runtime.schedule('engineer.rod-pulse', at + 0.16 + index * 0.5, { cast, index }, owner);
    runtime.schedule('engineer.rod-expire', readyAt + 8, undefined, owner);
  },
  'engineer.conduit-surge'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Conduit Surge requires a cast trigger.');
    const { cast } = context;
    emitEngineerEvent(
      runtime,
      'engineer.conduit-surge',
      { at: runtime.time, activationId: cast.id, offTarget: cast.command.offTarget },
      cast.skill
    );
  },
  'engineer.electric-artillery'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Electric Artillery requires a cast trigger.');
    const { cast } = context;
    const state = runtime.profession.core;
    const at = runtime.time;
    emitEngineerEvent(
      runtime,
      'engineer.electric-artillery',
      {
        at: at + 0.6,
        activationId: cast.id,
        offTarget: cast.command.offTarget,
        charges: activeStackCount(state.lightningRodChargeExpiries, at),
        persistsAfterInterrupt: true
      },
      cast.skill
    );
    runtime.cancelOwner({ id: 'engineer.lightning-rod', generation: state.lightningRodGeneration });
    state.lightningRodChargeExpiries = [];
    consumeSkillFlip(state.availableFlips, ID.ELECTRIC_ARTILLERY);
  },
  'engineer.roiling-skies'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Roiling Skies requires a cast trigger.');
    const { cast } = context;
    const focused = runtime.profession.core.focusedUntil > runtime.time;
    emitEngineerEvent(
      runtime,
      'control',
      {
        at: runtime.time,
        activationId: cast.id,
        offTarget: cast.command.offTarget,
        controlKind: focused ? 'launch' : 'stun'
      },
      cast.skill
    );
  }
};

/** Automatic overcharge and palette expiry belong to the deployed turret, while cooldown starts on detonation. */
export function completeEngineerTurret(runtime: EngineerRuntime, cast: RuntimeCast): void {
  const state = runtime.profession.core;
  const at = runtime.time;
  if (!HEALING_TURRET_SKILL_IDS.has(Number(cast.skill.id))) return;
  runtime.cancelOwner({ id: 'engineer.turret', generation: state.healingTurretGeneration });
  const owner = { id: 'engineer.turret', generation: ++state.healingTurretGeneration };
  if (cast.skill.id === ID.DETONATE_HEALING_TURRET) {
    state.healingTurretActivationId = '';
    consumeSkillFlip(state.availableFlips, ID.CLEANSING_BURST);
    runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(ID.HEALING_TURRET)!, at);
    return;
  }

  armSkillFlip(state.availableFlips, ID.DETONATE_HEALING_TURRET, at);
  if (cast.skill.id === ID.HEALING_TURRET) {
    state.healingTurretActivationId = cast.id;
    consumeSkillFlip(state.availableFlips, ID.CLEANSING_BURST);
    runtime.cooldownController.setReadyAt(ID.DETONATE_HEALING_TURRET, at + 0.5);
    runtime.schedule('engineer.turret-pulse', at + 0.24, cast.id, owner);
  }

  runtime.schedule(
    'engineer.turret-flip',
    at + (cast.skill.id === ID.HEALING_TURRET ? 0.24 : 0) + 10,
    undefined,
    owner
  );
}

export const engineerWeaponTasks: RuntimeProfession<EngineerRuntimeState>['tasks'] = {
  'engineer.rod-pulse'(runtime, data) {
    const { cast, index } = data as { cast: RuntimeCast; index: number };
    emitEngineerEvent(
      runtime,
      'engineer.lightning-rod-pulse',
      {
        at: runtime.time,
        activationId: cast.id,
        offTarget: cast.command.offTarget,
        hitIndex: index + 1,
        totalHits: 8
      },
      cast.skill
    );
  },
  'engineer.rod-expire'(runtime) {
    runtime.profession.core.lightningRodChargeExpiries = [];
    consumeSkillFlip(runtime.profession.core.availableFlips, ID.ELECTRIC_ARTILLERY);
  },
  'engineer.devastation'(runtime, data) {
    // Focused is sampled at the authored task deadline, after any intervening target-state changes.
    if (runtime.profession.core.focusedUntil <= runtime.time) return;
    const { cast } = data as SkillTaskData;
    const followup = runtime.helpers.skillsById.get(ID.FOCUSED_DEVASTATION)!;
    for (const effect of followup.effects ?? [])
      for (const { at, event } of materializeSkillEffectApplications({
        skill: followup,
        effect,
        start: runtime.time,
        fullEnd: runtime.time,
        baseEvent: {
          source: 'engineer',
          sourceId: followup.id,
          actorType: 'player',
          activationId: `${cast.id}:focused-devastation`
        }
      })) {
        if (event.type === 'damage' || event.type === 'condition')
          emitEngineerEvent(
            runtime,
            event.type,
            {
              ...event,
              at,
              offTarget: cast.command.offTarget,
              skillWeapon: 'Spear',
              weaponStrengthProfileId: 'nonweapon.unequipped',
              persistsAfterInterrupt: true
            },
            followup
          );
      }
  },
  'engineer.turret-pulse'(runtime, data) {
    const skill = runtime.helpers.skillsById.get(ID.CLEANSING_BURST)!;
    const activationId = `${data}:cleansing-burst`;
    for (const effect of skill.effects ?? [])
      if (effect.type === 'boon' || effect.type === 'buff') {
        emitEngineerEvent(
          runtime,
          'buff',
          {
            at: runtime.time,
            activationId,
            kind: String(effect.boon ?? effect.kind),
            stacks: Number(effect.stacks),
            duration: effect.duration
          },
          skill
        );
      }

    produceRuntimeCombos(runtime, runtime.helpers, {
      type: 'action',
      at: runtime.time,
      endsAt: runtime.time,
      source: 'engineer',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      activationId,
      comboFields: skill.comboFields
    });
  },
  'engineer.turret-flip'(runtime) {
    consumeSkillFlip(runtime.profession.core.availableFlips, ID.DETONATE_HEALING_TURRET);
    armSkillFlip(runtime.profession.core.availableFlips, ID.CLEANSING_BURST, runtime.time);
  }
};
