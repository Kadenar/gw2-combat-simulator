import {
  augmentSkillHandler,
  replaceSkillHandler,
} from "../../../platform/engine/skill-handlers.js";
import type {
  SkillHandlerPhase,
  SkillHandlerStrategy,
} from "../../../platform/engine/types.js";
import type {
  RevenantCastContext,
  RevenantSkill,
} from "../types.js";

export type RevenantHandler = (
  context: RevenantCastContext,
  skill: RevenantSkill,
) => unknown;

export function handlerPhase(
  handler: RevenantHandler,
): SkillHandlerPhase<RevenantCastContext> {
  return (context, skill) => handler(context, skill as RevenantSkill);
}

function afterEffectsPhase(
  handler: RevenantHandler,
): NonNullable<
  SkillHandlerStrategy<RevenantCastContext>["afterEffects"]
> {
  return (context, skill) => handler(context, skill as RevenantSkill);
}

export function augmentAfter(
  handler: RevenantHandler,
): Readonly<SkillHandlerStrategy<RevenantCastContext>> {
  return augmentSkillHandler<RevenantCastContext>(
    null as unknown as SkillHandlerPhase<RevenantCastContext>,
    { afterEffects: afterEffectsPhase(handler) },
  );
}

export function replaceAfter(
  handler: RevenantHandler,
): Readonly<SkillHandlerStrategy<RevenantCastContext>> {
  return replaceSkillHandler<RevenantCastContext>(
    null as unknown as SkillHandlerPhase<RevenantCastContext>,
    { afterEffects: afterEffectsPhase(handler) },
  );
}

export function replaceBefore(
  handler: RevenantHandler,
  afterEffects: RevenantHandler | null = null,
): Readonly<SkillHandlerStrategy<RevenantCastContext>> {
  return replaceSkillHandler<RevenantCastContext>(handlerPhase(handler), {
    ...(afterEffects ? { afterEffects: afterEffectsPhase(afterEffects) } : {}),
  });
}
