import { professionCoreState } from "../../../platform/engine/profession.js";
import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import {
  WARRIOR_SKILL_IDS as ID,
  WARRIOR_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import type { WarriorResolverContext, WarriorResolverEvent } from "../types.js";

export function reactToWarriorDamage(
  context: WarriorResolverContext,
  event: WarriorResolverEvent,
): void {
  const targetHealth = Number(context.config.target?.health || 0);
  const damageDone =
    Number(context.totals.strike || 0) + Number(context.totals.condition || 0);
  const state = professionCoreState(context);
  if (
    event.actorType !== "player" ||
    !(Number(event.coefficient || 0) > 0) ||
    !(targetHealth > 0) ||
    damageDone < targetHealth * 0.5 ||
    !hasTrait(context, TRAIT.SIGNET_MASTERY) ||
    event.at < Number(state.traitProcReadyAt.lesserSignetMight || 0)
  ) {
    return;
  }

  state.traitProcReadyAt.lesserSignetMight = event.at + 20;
  for (const buff of [
    { kind: "might", stacks: 10, duration: 6 },
    { kind: "signet-mastery", stacks: 1, duration: 60 },
  ]) {
    enqueueOrdered(context.queue, {
      type: "buff",
      at: event.at + 1e-9,
      priority: -5,
      source: "Trait",
      sourceId: TRAIT.SIGNET_MASTERY,
      actorType: "effect",
      skillId: TRAIT.SIGNET_MASTERY,
      skillName: "Lesser Signet of Might",
      name: "Lesser Signet of Might",
      ...buff,
    });
  }
  context.recordProc(
    "trait",
    "Lesser Signet of Might",
    event.at,
    event.skillName,
    "10 might; Signet Mastery stack",
    String(context.helpers.skillsById?.get(ID.SIGNET_OF_MIGHT)?.icon || ""),
  );
}
