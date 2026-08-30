import { emitStateSnapshot } from '../../../../platform/engine/events/state-snapshots.js';
import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { snapshotEngineerState } from '../state/index.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { hasTrait } from '../../../../platform/combat/state/traits.js';
import { spendEndurance } from '../../../../platform/combat/resources/endurance.js';
import { isEngineerToolbeltSkill } from './traits.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS, engineerBalanceValue } from './profiles.js';
import type { EngineerCastContext, EngineerSkill } from '../types.js';

// a skill lives in exactly one of the two maps (ammo OR cooldowns, never both); scan both to catch all
function reduceMatchingCooldowns(
  context: EngineerCastContext,
  predicate: (skill: EngineerSkill) => boolean,
  seconds: number,
  at: number
): number {
  const ids = new Set([...context.state.cooldowns.keys(), ...context.state.ammo.keys()]);
  let reducedBy = 0;
  for (const skillId of ids) {
    const skill = context.catalog.skillsById.get(skillId);
    if (skill && predicate(skill)) {
      reducedBy += context.cooldownController.reduceSkillRecharge(skill, seconds, at);
    }
  }

  return reducedBy;
}

export function performEngineerDodge(context: EngineerCastContext, skill: EngineerSkill): void {
  const state = professionCoreState(context);
  const at = context.start;
  const enduranceCost = engineerBalanceValue(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.resources, 'resourceCost', 50);
  Object.assign(state, spendEndurance(state, enduranceCost, at, state.maximumEndurance));

  context.emit({
    type: 'engineer.dodge',
    at,
    source: 'engineer',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name
  });

  if (hasTrait(context.config, TRAIT.POWER_WRENCH)) {
    const reducedBy = reduceMatchingCooldowns(
      context,
      (candidate) => candidate.type === 'Elite' || candidate.slot === 'Elite',
      3,
      at
    );
    // only emit proc when something actually changed — suppresses no-op entries in the event log
    if (reducedBy > 0) {
      context.emit({
        type: 'proc',
        at,
        source: 'Trait',
        sourceId: TRAIT.POWER_WRENCH,
        actorType: 'effect',
        name: 'Power Wrench',
        procType: 'trait',
        sourceSkill: skill.name,
        cooldownReduction: reducedBy
      });
    }
  }

  if (hasTrait(context.config, TRAIT.ADRENAL_IMPLANT)) {
    const reducedBy = reduceMatchingCooldowns(context, isEngineerToolbeltSkill, 1, at);
    if (reducedBy > 0) {
      context.emit({
        type: 'proc',
        at,
        source: 'Trait',
        sourceId: TRAIT.ADRENAL_IMPLANT,
        actorType: 'effect',
        name: 'Adrenal Implant',
        procType: 'trait',
        sourceSkill: skill.name,
        cooldownReduction: reducedBy
      });
    }
  }

  // "dodge" cause lets downstream state subscribers (e.g. scrapper gyro checks) react post-dodge
  emitStateSnapshot(context, 'engineer', at, 'dodge', snapshotEngineerState(context.state.profession));
}
