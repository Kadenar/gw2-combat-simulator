import { enqueueOrdered } from "../../../platform/engine/event-queue.js";

function activeSkillIds(context) {
  return new Set(
    (context.profession.activeUpkeeps || []).map(upkeep => upkeep.skillId),
  );
}

function skillByName(context, name) {
  return context.helpers.skillsByName?.get(name);
}

function reactToDamage(context, event) {
  if (event.actorType !== "player" || !(Number(event.coefficient) > 0)) return;
  const active = activeSkillIds(context);
  const impossible = skillByName(context, "Impossible Odds");
  if (
    impossible
    && active.has(impossible.id)
    && event.skillId !== impossible.id
    && event.at >= Number(context.profession.traitProcReadyAt.impossibleOdds || 0)
  ) {
    context.profession.traitProcReadyAt.impossibleOdds = event.at + 0.25;
    enqueueOrdered(context.queue, {
      type: "damage",
      at: event.at,
      name: "Impossible Odds",
      skillName: "Impossible Odds",
      coefficient: 0.65,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      source: "revenant",
      sourceId: impossible.id,
      actorType: "effect",
      skillId: impossible.id,
      skillWeapon: "Unequipped",
      triggeredBy: event.skillName,
    });
  }
  const soulcleave = skillByName(context, "Soulcleave's Summit");
  if (
    soulcleave
    && active.has(soulcleave.id)
    && event.skillId !== soulcleave.id
    && event.at >= Number(context.profession.traitProcReadyAt.soulcleave || 0)
  ) {
    context.profession.traitProcReadyAt.soulcleave = event.at + 1;
    enqueueOrdered(context.queue, {
      type: "damage",
      at: event.at,
      name: "Soulcleave's Summit",
      skillName: "Soulcleave's Summit",
      coefficient: 0.1,
      flatStrikeBase: 325,
      noCrit: true,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      source: "revenant",
      sourceId: soulcleave.id,
      actorType: "effect",
      skillId: soulcleave.id,
      skillWeapon: "Unequipped",
      triggeredBy: event.skillName,
    });
  }
}

export const revenantResolverEventReactions = Object.freeze({
  damage: reactToDamage,
});

