import { professionSpecializationState } from "../../../../platform/engine/profession.js";
import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import type { SkillId } from "../../../../platform/engine/types.js";
import { NECROMANCER_SKILL_IDS as ID } from "../../data/ids.js";
import { RITUALIST_MECHANICS as MECHANICS } from "./mechanics.js";
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
} from "../../types.js";

interface WeaponSpellDefinition {
  readonly flatStrikeBase?: number;
  readonly flatStrikePowerCoeff?: number;
  readonly vulnerabilityStacks?: number;
  readonly vulnerabilityDuration?: number;
  readonly coefficient?: number;
  readonly internalCooldown?: number;
}

function recipientKeys(event: NecromancerResolverEvent): string[] {
  if (event.actorType === "player") return ["player"];
  if (event.actorType !== "summon") return [];
  if (event.summonOwnerBase && Number(event.summonCount || 0) > 1) {
    return Array.from(
      { length: Number(event.summonCount) },
      (_, index) => `${event.summonOwnerBase}:${index}`,
    );
  }
  return event.summonOwner ? [event.summonOwner] : [];
}

function spellIcon(
  context: NecromancerResolverContext,
  skillId: SkillId,
): string {
  return context.helpers.skillsById?.get(skillId)?.icon || "";
}

function queueNightmareWeapon(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  definition: WeaponSpellDefinition,
): void {
  enqueueOrdered(context.queue, {
    type: "damage",
    at: event.at,
    name: "Nightmare Weapon",
    skillName: "Nightmare Weapon",
    coefficient: 0,
    flatStrikeBase: definition.flatStrikeBase,
    flatStrikePowerCoeff: definition.flatStrikePowerCoeff,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: "Weapon Spell",
    sourceId: ID.NIGHTMARE_WEAPON,
    actorType: "effect",
    skillId: ID.NIGHTMARE_WEAPON,
    skillWeapon: "Unequipped",
    noCrit: true,
    damageKind: "life-steal",
    triggeredBy: event.skillName,
    triggeredByAlly: event.triggeredByAlly,
  });
  enqueueOrdered(context.queue, {
    type: "buff",
    at: event.at,
    name: "Nightmare Weapon",
    skillName: "Nightmare Weapon",
    kind: "target-vulnerability",
    stacks: definition.vulnerabilityStacks,
    duration: definition.vulnerabilityDuration,
    source: "Weapon Spell",
    sourceId: ID.NIGHTMARE_WEAPON,
    actorType: "effect",
    triggeredBy: event.skillName,
    triggeredByAlly: event.triggeredByAlly,
  });
  context.recordProc?.(
    "skill",
    "Nightmare Weapon",
    event.at,
    event.skillName,
    "",
    spellIcon(context, ID.NIGHTMARE_WEAPON),
  );
}

function queueSplinterWeapon(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  definition: WeaponSpellDefinition,
): void {
  enqueueOrdered(context.queue, {
    type: "damage",
    at: event.at,
    name: "Splinter Weapon",
    skillName: "Splinter Weapon",
    coefficient: Number(definition.coefficient || 0),
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: "Weapon Spell",
    sourceId: ID.SPLINTER_WEAPON,
    actorType: "effect",
    skillId: ID.SPLINTER_WEAPON,
    skillWeapon: "Unequipped",
    triggeredBy: event.skillName,
    triggeredByAlly: event.triggeredByAlly,
  });
  context.recordProc?.(
    "skill",
    "Splinter Weapon",
    event.at,
    event.skillName,
    "",
    spellIcon(context, ID.SPLINTER_WEAPON),
  );
}

export function handleNecromancerWeaponSpellAllyTrigger(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
): void {
  const definition = (
    MECHANICS.weaponSpells as Readonly<Record<string, WeaponSpellDefinition>>
  )[String(event.spell || "")];
  if (!definition) return;
  if (event.spell === "nightmare") {
    queueNightmareWeapon(context, event, definition);
  } else if (event.spell === "splinter") {
    queueSplinterWeapon(context, event, definition);
  }
}

function reactToDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
): void {
  if (event.actorType === "effect" || !(Number(event.coefficient) > 0)) return;
  const keys = recipientKeys(event);
  if (!keys.length) return;
  for (const spell of ["nightmare", "splinter"]) {
    const active = professionSpecializationState(context, "Ritualist").weaponSpells?.[spell];
    if (!active || Number(active.expiresAt || 0) <= event.at) continue;
    const definition = (
      MECHANICS.weaponSpells as Readonly<Record<string, WeaponSpellDefinition>>
    )[spell];
    for (const key of keys) {
      const recipient = active.recipients?.[key];
      if (!recipient || recipient.stacks <= 0 || recipient.nextAt > event.at) {
        continue;
      }
      recipient.stacks -= 1;
      recipient.nextAt = event.at + Number(definition.internalCooldown || 0);
      if (spell === "nightmare") {
        queueNightmareWeapon(context, event, definition);
      } else {
        queueSplinterWeapon(context, event, definition);
      }
    }
  }
}

export const ritualistResolverEventReactions = Object.freeze({
  damage: reactToDamage,
});
