import { emitStateSnapshot } from '../../../../platform/engine/events/state-snapshots.js';
import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { snapshotEngineerState } from '../state/index.js';
import { turretOwnerId } from './turrets.js';
import type { EngineerCastContext, EngineerSkill } from '../types.js';

function armFlip(context: EngineerCastContext, skill: EngineerSkill): void {
  // paletteFlipSkillId explicitly declares a palette flip; flipSkillId is the raw API
  // field which conflates palette flips with chain skills. Fall back to flipSkillId
  // only for skills not yet annotated with an explicit paletteFlipSkillId.
  const flipSkillId = Number(skill.paletteFlipSkillId ?? skill.flipSkillId);
  if (!Number.isFinite(flipSkillId)) return;
  professionCoreState(context).availableFlips[flipSkillId] = true;
  // effectiveEnd: flip becomes available after the cast completes, not when it starts
  emitStateSnapshot(
    context,
    'engineer',
    context.effectiveEnd,
    'arm-flip',
    snapshotEngineerState(context.state.profession)
  );
}

function consumeFlip(context: EngineerCastContext, skill: EngineerSkill): void {
  professionCoreState(context).availableFlips[skill.id] = false;
  const parentId = Number(skill.flipParentId ?? context.catalog.skillsByName.get(skill.flipParentName || '')?.id);
  // cancel pending turret auto-attack tasks — the turret no longer exists after detonation
  if (Number.isFinite(parentId)) {
    context.tasks.cancelOwner(turretOwnerId(parentId));
  }

  emitStateSnapshot(
    context,
    'engineer',
    context.effectiveEnd,
    'consume-flip',
    snapshotEngineerState(context.state.profession)
  );
}

export const engineerFlipSkillHandlers = Object.freeze({
  'engineer.arm-flip': armFlip,
  'engineer.consume-flip': consumeFlip
});
