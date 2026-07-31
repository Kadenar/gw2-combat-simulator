import { professionCoreState } from "../../../platform/engine/profession.js";
import { emitEngineerState } from "./events.js";
import { turretOwnerId } from "./turrets.js";
import type {
  EngineerCastContext,
  EngineerSkill,
} from "../types.js";

function armFlip(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  const flipSkillId = Number(skill.paletteFlipSkillId ?? skill.flipSkillId);
  if (!Number.isFinite(flipSkillId)) return;
  professionCoreState(context).availableFlips[flipSkillId] = true;
  emitEngineerState(context, context.effectiveEnd, "arm-flip");
}

function consumeFlip(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  professionCoreState(context).availableFlips[skill.id] = false;
  const parentId = Number(
    skill.flipParentId
    ?? context.catalog.skillsByName.get(skill.flipParentName || "")?.id,
  );
  if (Number.isFinite(parentId)) {
    context.tasks.cancelOwner(turretOwnerId(parentId));
  }
  emitEngineerState(context, context.effectiveEnd, "consume-flip");
}

export const engineerFlipSkillHandlers = Object.freeze({
  "engineer.arm-flip": armFlip,
  "engineer.consume-flip": consumeFlip,
});
