import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import { produceRuntimeCombos } from '#gw2/platform/combos/runtime.js';
import type { RuntimeCast, SkillTaskData } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';

import type { EngineerSkill, EngineerRuntimeState } from '#gw2/professions/engineer/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';

/** Skill declarations select each spear mutation; handlers retain lifetime ownership and release-time snapshots. */
export const engineerSpearSideEffectHandlers: RuntimeProfession<
  EngineerRuntimeState,
  EngineerSkill
>['sideEffectHandlers'] = {
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
      runtime.scheduleForCast('engineer.rod-pulse', at + 0.16 + index * 0.5, cast, { index }, owner);
    runtime.schedule('engineer.rod-expire', readyAt + 8, undefined, owner);
  },
  'engineer.conduit-surge'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Conduit Surge requires a cast trigger.');
    const { cast } = context;
    buildEngineerPackets(
      'engineer.conduit-surge',
      { at: runtime.time, activationId: cast.id, offTarget: cast.command.offTarget },
      cast.skill
    ).forEach((packet) => runtime.effects.emit({ kind: 'packet', event: packet }));
  },
  'engineer.electric-artillery'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Electric Artillery requires a cast trigger.');
    const { cast } = context;
    const state = runtime.profession.core;
    const at = runtime.time;
    buildEngineerPackets(
      'engineer.electric-artillery',
      {
        at: at + 0.6,
        activationId: cast.id,
        offTarget: cast.command.offTarget,
        charges: activeStackCount(state.lightningRodChargeExpiries, at),
        persistsAfterInterrupt: true
      },
      cast.skill
    ).forEach((packet) => runtime.effects.emit({ kind: 'packet', event: packet }));
    runtime.cancelOwner({ id: 'engineer.lightning-rod', generation: state.lightningRodGeneration });
    state.lightningRodChargeExpiries = [];
    consumeSkillFlip(state.availableFlips, ID.ELECTRIC_ARTILLERY);
  },
  'engineer.roiling-skies'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Roiling Skies requires a cast trigger.');
    const { cast } = context;
    const focused = runtime.profession.core.focusedUntil > runtime.time;
    buildEngineerPackets(
      'control',
      {
        at: runtime.time,
        activationId: cast.id,
        offTarget: cast.command.offTarget,
        controlKind: focused ? 'launch' : 'stun'
      },
      cast.skill
    ).forEach((packet) => runtime.effects.emit({ kind: 'packet', event: packet }));
  }
};

/** Definitions own cast-phase flips; the deployed generation owns automatic pulses and face expiry. */
export const engineerTurretSideEffectHandlers: RuntimeProfession<
  EngineerRuntimeState,
  EngineerSkill
>['sideEffectHandlers'] = {
  'engineer.retire-turret'(runtime) {
    const state = runtime.profession.core;
    runtime.cancelOwner({ id: 'engineer.turret', generation: state.healingTurretGeneration++ });
  },
  'engineer.deploy-turret'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Turret deployment requires a cast trigger.');
    const state = runtime.profession.core;
    const owner = { id: 'engineer.turret', generation: state.healingTurretGeneration };
    state.healingTurretActivationId = context.cast.id;
    runtime.cooldownController.setReadyAt(ID.DETONATE_HEALING_TURRET, runtime.time + 0.5);
    runtime.schedule('engineer.turret-pulse', runtime.time + 0.24, context.cast.id, owner);
    runtime.schedule('engineer.turret-flip', runtime.time + 10.24, undefined, owner);
  },
  'engineer.detonate-turret'(runtime) {
    runtime.profession.core.healingTurretActivationId = '';
    runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(ID.HEALING_TURRET)!, runtime.time);
  },
  'engineer.overcharge-turret'(runtime) {
    runtime.schedule('engineer.turret-flip', runtime.time + 10, undefined, {
      id: 'engineer.turret',
      generation: runtime.profession.core.healingTurretGeneration
    });
  }
};

export const engineerWeaponTasks: RuntimeProfession<EngineerRuntimeState, EngineerSkill>['tasks'] = {
  'engineer.rod-pulse'(runtime, data) {
    const { cast, index } = data as { cast: RuntimeCast<EngineerSkill>; index: number };
    buildEngineerPackets(
      'engineer.lightning-rod-pulse',
      {
        at: runtime.time,
        activationId: cast.id,
        offTarget: cast.command.offTarget,
        hitIndex: index + 1,
        totalHits: 8
      },
      cast.skill
    ).forEach((packet) => runtime.effects.emit({ kind: 'packet', event: packet }));
  },
  'engineer.rod-expire'(runtime) {
    runtime.profession.core.lightningRodChargeExpiries = [];
    consumeSkillFlip(runtime.profession.core.availableFlips, ID.ELECTRIC_ARTILLERY);
  },
  'engineer.devastation'(runtime, data) {
    // Focused is sampled at the authored task deadline, after any intervening target-state changes.
    if (runtime.profession.core.focusedUntil <= runtime.time) return;
    const { cast } = data as SkillTaskData<EngineerSkill>;
    const followup = runtime.helpers.skillsById.get(ID.FOCUSED_DEVASTATION)!;
    runtime.effects.emit({
      kind: 'profile',
      profile: followup,
      effects: followup.effects?.filter((effect) => effect.type === 'strike' || effect.type === 'condition'),
      attribution: {
        source: 'engineer',
        sourceId: followup.id,
        actorType: 'player',
        skillId: followup.id,
        skillName: followup.name,
        activationId: `${cast.id}:focused-devastation`
      },
      transform: (event) => ({
        ...event,
        offTarget: cast.command.offTarget,
        skillWeapon: 'Spear',
        weaponStrengthProfileId: 'nonweapon.unequipped',
        persistsAfterInterrupt: true
      })
    });
  },
  'engineer.turret-pulse'(runtime, data) {
    const skill = runtime.helpers.skillsById.get(ID.CLEANSING_BURST)!;
    const activationId = `${data}:cleansing-burst`;
    for (const effect of skill.effects ?? [])
      if (effect.type === 'boon' || effect.type === 'buff') {
        buildEngineerPackets(
          'buff',
          {
            at: runtime.time,
            activationId,
            kind: String(effect.boon ?? effect.kind),
            stacks: Number(effect.stacks),
            duration: effect.duration
          },
          skill
        ).forEach((packet) => runtime.effects.emit({ kind: 'packet', event: packet }));
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
