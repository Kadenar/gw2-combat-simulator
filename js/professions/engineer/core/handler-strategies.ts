import {
  augmentSkillHandler,
  replaceSkillHandler,
} from "../../../platform/engine/skill-handlers.js";
import type {
  SkillHandlerPhase,
  SkillHandlerStrategy,
} from "../../../platform/engine/types.js";
import type {
  EngineerCastContext,
  EngineerSkill,
} from "../types.js";

export type EngineerHandler = (
  context: EngineerCastContext,
  skill: EngineerSkill,
) => unknown;

function handlerPhase(
  handler: EngineerHandler,
): SkillHandlerPhase<EngineerCastContext> {
  return (context, skill) => handler(context, skill as EngineerSkill);
}

export function engineerAfterEffects(
  handler: EngineerHandler,
): Readonly<SkillHandlerStrategy<EngineerCastContext>> {
  return augmentSkillHandler<EngineerCastContext>(
    null as unknown as SkillHandlerPhase<EngineerCastContext>,
    { afterEffects: handlerPhase(handler) },
  );
}

export function engineerReplaceAfterEffects(
  handler: EngineerHandler,
): Readonly<SkillHandlerStrategy<EngineerCastContext>> {
  return replaceSkillHandler<EngineerCastContext>(
    null as unknown as SkillHandlerPhase<EngineerCastContext>,
    { afterEffects: handlerPhase(handler) },
  );
}

export function engineerReplace(
  handler: EngineerHandler,
): Readonly<SkillHandlerStrategy<EngineerCastContext>> {
  return replaceSkillHandler<EngineerCastContext>(handlerPhase(handler));
}
