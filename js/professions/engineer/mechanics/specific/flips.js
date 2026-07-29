import { emitEngineerState } from "./shared.js";
import { turretOwnerId } from "./turrets.js";

function armFlip(context, skill) {
  const flipSkillId = Number(skill.paletteFlipSkillId ?? skill.flipSkillId);
  if (!Number.isFinite(flipSkillId)) return;
  context.state.profession.availableFlips[flipSkillId] = true;
  emitEngineerState(context, context.effectiveEnd, "arm-flip");
}

function consumeFlip(context, skill) {
  context.state.profession.availableFlips[skill.id] = false;
  const parentId = Number(
    skill.flipParentId
    ?? context.catalog.skillsByName.get(skill.flipParentName)?.id,
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
