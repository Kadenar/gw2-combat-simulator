import {
  flattenProfessionState,
  professionCoreState,
} from "../../../platform/engine/profession.js";
import { professionStaticRulesApplied } from "../../../platform/gw2/attribute-provenance.js";
import { gw2StatsForWeaponSet } from "../../../platform/gw2/runtime-rules.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { rangerPetCompanionId } from "./pets.js";
import type {
  RangerCastContext,
  RangerSchedulerContext,
  RangerSkill,
} from "../types.js";
import { rangerPetByName } from "./state.js";

function boonDuration(
  context: RangerCastContext,
  kind: string,
  baseDuration: number,
): number {
  const name = `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
  const weaponSet = context.state.activeWeaponSet === 2 ? 2 : 1;
  const sigil = context.config.sigilSets?.[weaponSet - 1];
  const stats = gw2StatsForWeaponSet(context.config, weaponSet);
  const lingeringMagic =
    hasTrait(context, TRAIT.LINGERING_MAGIC) &&
    !professionStaticRulesApplied(context.config)
      ? 240
      : 0;
  const bonus =
    (Number(stats.concentration || 0) + lingeringMagic) / 1500 +
    Number(stats.boonDurationBonus || 0) / 100 +
    Number(stats.boonDurationBonuses?.[name] || 0) / 100 +
    Number(sigil?.boonDurationBonus || 0) / 100;
  return baseDuration * Math.max(1, Math.min(2, 1 + bonus));
}

function emitPartyBoon(
  context: RangerCastContext,
  skill: RangerSkill,
  sourceId: number,
  sourceName: string,
  kind: string,
  baseDuration: number,
  stacks = 1,
): void {
  context.emit({
    type: "buff",
    at: context.effectiveEnd,
    source: "Trait",
    sourceId,
    actorType: "effect",
    skillId: sourceId,
    skillName: sourceName,
    name: `${sourceName} - ${kind}`,
    kind,
    boon: kind,
    duration: boonDuration(context, kind, baseDuration),
    stacks,
    recipients: "party",
    affectsSummons: true,
    maximumRecipients: 5,
    triggeredBy: skill.name,
  });
}

function isBeastSkill(skill: RangerSkill): boolean {
  return Boolean(
    (skill.petSkill && !skill.petFamilySkill) ||
    (skill.beastmodeSkill &&
      skill.id !== ID.BEASTMODE &&
      skill.id !== ID.LEAVE_BEASTMODE),
  );
}

export function applyRangerDodgeTraits(context: RangerCastContext): void {
  if (!hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET)) return;
  context.emit({
    type: "buff",
    at: context.effectiveEnd,
    source: "Trait",
    sourceId: TRAIT.LIGHT_ON_YOUR_FEET,
    actorType: "effect",
    skillId: TRAIT.LIGHT_ON_YOUR_FEET,
    skillName: "Light on your Feet",
    kind: "light-on-your-feet",
    duration: 6,
    stacks: 1,
  });
}

function emitChildOfEarth(
  context: RangerCastContext,
  skill: RangerSkill,
): void {
  const state = professionCoreState(context);
  if (
    !hasTrait(context, TRAIT.CHILD_OF_EARTH) ||
    context.start < state.childOfEarthReadyAt
  ) {
    return;
  }
  state.childOfEarthReadyAt = context.start + 20;
  const at = context.effectiveEnd;
  context.emit({
    type: "condition",
    at,
    source: "Trait",
    sourceId: TRAIT.CHILD_OF_EARTH,
    actorType: "effect",
    skillId: TRAIT.CHILD_OF_EARTH,
    skillName: "Child of Earth",
    name: "Lesser Muddy Terrain - Immobilized",
    condition: "Immobilized",
    duration: 1,
    stacks: 1,
    triggeredBy: skill.name,
  });
  for (let offset = 0; offset < 10; offset += 2) {
    for (const [condition, duration] of [
      ["Crippled", 2],
      ["Slow", 1],
    ] as const) {
      context.emit({
        type: "condition",
        at: at + offset,
        source: "Trait",
        sourceId: TRAIT.CHILD_OF_EARTH,
        actorType: "effect",
        skillId: TRAIT.CHILD_OF_EARTH,
        skillName: "Child of Earth",
        name: `Lesser Muddy Terrain - ${condition}`,
        condition,
        duration,
        stacks: 1,
        triggeredBy: skill.name,
      });
    }
  }
}

export function completeRangerTraits(
  context: RangerCastContext,
  skill: RangerSkill,
): void {
  const state = professionCoreState(context);
  if (skill.evades) applyRangerDodgeTraits(context);
  if (
    skill.type === "Weapon" &&
    skill.slot !== "Weapon_1" &&
    skill.id !== ID.SWAP_WEAPONS &&
    context.start < state.quickDrawUntil
  ) {
    state.quickDrawUntil = 0;
  }
  if (skill.type === "Heal") {
    if (hasTrait(context, TRAIT.WELLSPRING)) {
      emitPartyBoon(
        context,
        skill,
        TRAIT.WELLSPRING,
        "Wellspring",
        "regeneration",
        6,
      );
    }
    emitChildOfEarth(context, skill);
  }
  if (skill.weapon === "Warhorn" && hasTrait(context, TRAIT.WINDBORNE_NOTES)) {
    emitPartyBoon(
      context,
      skill,
      TRAIT.WINDBORNE_NOTES,
      "Windborne Notes",
      "regeneration",
      6,
    );
  }
  if (String(skill.description || "").startsWith("Command.")) {
    applyRangerCommandTraits(context, skill);
  }
  if (!isBeastSkill(skill)) return;
  if (
    hasTrait(context, TRAIT.REJUVENATION) &&
    context.start >= state.rejuvenationReadyAt
  ) {
    state.rejuvenationReadyAt = context.start + 20;
    emitPartyBoon(
      context,
      skill,
      TRAIT.REJUVENATION,
      "Rejuvenation",
      "regeneration",
      10,
    );
  }
  const notBeforeCombat =
    !context.hasExplicitCombatStart ||
    (context.combatStartTime != null &&
      context.start >= context.combatStartTime);
  if (hasTrait(context, TRAIT.POISON_MASTER) && notBeforeCombat) {
    context.emit({
      type: "ranger.beast-skill-used",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.POISON_MASTER,
      actorType: "effect",
      skillId: skill.id,
      skillName: skill.name,
    });
  }
  if (
    hasTrait(context, TRAIT.WOLFSONG) &&
    rangerPetByName(professionCoreState(context).activePet).family === "canine"
  ) {
    context.emit({
      type: "buff",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.WOLFSONG,
      actorType: "effect",
      skillId: TRAIT.WOLFSONG,
      skillName: "Wolfsong",
      name: "Wolfsong - Vulnerability",
      kind: "target-vulnerability",
      duration: 6,
      stacks: 6,
      triggeredBy: skill.name,
    });
  }
}

export function applyRangerWeaponSwapTraits(
  context: RangerCastContext | RangerSchedulerContext,
  skill: RangerSkill,
  at = "effectiveEnd" in context ? context.effectiveEnd : context.state.time,
): void {
  const state = professionCoreState(context);
  const inCombat =
    context.combatStartTime != null && at >= context.combatStartTime;
  if (
    inCombat &&
    hasTrait({ config: context.config }, TRAIT.TAIL_WIND) &&
    at >= state.tailWindReadyAt
  ) {
    state.tailWindReadyAt = at + 9;
    context.emit({
      type: "buff",
      at,
      source: "Trait",
      sourceId: TRAIT.TAIL_WIND,
      actorType: "effect",
      skillId: skill.id,
      skillName: "Tail Wind",
      kind: "swiftness",
      duration: 9,
      stacks: 1,
    });
  }
  if (
    inCombat &&
    hasTrait({ config: context.config }, TRAIT.QUICK_DRAW) &&
    at >= state.quickDrawReadyAt
  ) {
    state.quickDrawReadyAt = at + 9;
    state.quickDrawUntil = at + 5;
    context.emit({
      type: "buff",
      at,
      source: "Trait",
      sourceId: TRAIT.QUICK_DRAW,
      actorType: "effect",
      skillId: skill.id,
      skillName: "Quick Draw",
      kind: "quickness",
      duration: 3,
      stacks: 1,
    });
  }
  if (
    inCombat &&
    hasTrait({ config: context.config }, TRAIT.FURIOUS_GRIP) &&
    at >= state.furiousGripReadyAt
  ) {
    state.furiousGripReadyAt = at + 9;
    context.emit({
      type: "buff",
      at,
      source: "Trait",
      sourceId: TRAIT.FURIOUS_GRIP,
      actorType: "effect",
      skillId: skill.id,
      skillName: "Furious Grip",
      kind: "fury",
      duration: 5,
      stacks: 1,
    });
  }
}

export function applyRangerPetSwapTraits(
  context: RangerCastContext,
  skill: RangerSkill,
): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const inCombat =
    context.combatStartTime != null && context.start >= context.combatStartTime;
  if (inCombat && hasTrait(context, TRAIT.SPIRITED_ARRIVAL)) {
    emitPartyBoon(
      context,
      skill,
      TRAIT.SPIRITED_ARRIVAL,
      "Spirited Arrival",
      "might",
      12,
      6,
    );
    emitPartyBoon(
      context,
      skill,
      TRAIT.SPIRITED_ARRIVAL,
      "Spirited Arrival",
      "fury",
      8,
    );
  }
  if (
    hasTrait(context, TRAIT.CLARION_BOND) &&
    context.start >= state.clarionBondReadyAt
  ) {
    state.clarionBondReadyAt = context.start + 15;
    for (const [kind, stacks] of [
      ["fury", 1],
      ["might", 6],
      ["swiftness", 1],
    ] as const) {
      emitPartyBoon(
        context,
        skill,
        TRAIT.CLARION_BOND,
        "Clarion Bond",
        kind,
        5,
        stacks,
      );
    }
    context.emit({
      type: "condition",
      at,
      source: "Trait",
      sourceId: TRAIT.CLARION_BOND,
      actorType: "effect",
      skillId: TRAIT.CLARION_BOND,
      skillName: "Clarion Bond",
      name: "Lesser Call of the Wild - Weakness",
      condition: "Weakness",
      duration: 5,
      stacks: 1,
      triggeredBy: skill.name,
    });
    context.emit({
      type: "proc",
      at,
      source: "Trait",
      sourceId: TRAIT.CLARION_BOND,
      actorType: "effect",
      skillId: TRAIT.CLARION_BOND,
      skillName: "Clarion Bond",
      name: "Lesser Call of the Wild - Blast Finisher",
      triggeredBy: skill.name,
      comboFinishers: [
        {
          ownerId: "ranger",
          finisherType: "Blast",
          ambiguousFieldSelection: "oldest",
        },
      ],
    });
  }
}

export function applyRangerCommandTraits(
  context: RangerCastContext,
  skill: RangerSkill,
): void {
  if (!hasTrait(context, TRAIT.RESOUNDING_TIMBRE)) return;
  const merged = Boolean(
    flattenProfessionState(context.state.profession).beastmodeActive,
  );
  if (merged) {
    context.emit({
      type: "ranger.boon-extension",
      at: context.start,
      source: "ranger",
      sourceId: TRAIT.RESOUNDING_TIMBRE,
      actorType: "effect",
      skillId: skill.id,
      skillName: "Resounding Timbre",
      duration: 2,
    });
    return;
  }
  const boonKinds = new Set([
    "aegis",
    "alacrity",
    "fury",
    "might",
    "protection",
    "quickness",
    "regeneration",
    "resistance",
    "resolution",
    "stability",
    "swiftness",
    "vigor",
  ]);
  const active = new Map<string, { duration: number; stacks: number }>();
  for (const kind of boonKinds) {
    const configured = context.config.boons?.[kind];
    const stacks =
      kind === "might"
        ? Math.min(25, Math.max(0, Number(configured || 0)))
        : configured
          ? 1
          : 0;
    if (stacks > 0) active.set(kind, { duration: 3600, stacks });
  }
  for (const event of context.events) {
    const kind = String(event.kind || "").toLowerCase();
    const remaining =
      Number(event.at) + Number(event.duration || 0) - context.effectiveEnd;
    if (
      event.type !== "buff" ||
      event.affectsSelf === false ||
      !boonKinds.has(kind) ||
      Number(event.at) > context.effectiveEnd + context.epsilon ||
      !(remaining > 0)
    ) {
      continue;
    }
    const previous = active.get(kind);
    active.set(kind, {
      duration: Math.max(remaining, Number(previous?.duration || 0)),
      stacks: Math.min(
        kind === "might" || kind === "stability" ? 25 : 1,
        Number(previous?.stacks || 0) + Math.max(1, Number(event.stacks || 1)),
      ),
    });
  }
  for (const [kind, application] of active) {
    context.emit({
      type: "buff",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.RESOUNDING_TIMBRE,
      actorType: "effect",
      skillId: TRAIT.RESOUNDING_TIMBRE,
      skillName: "Resounding Timbre",
      name: `Resounding Timbre - ${kind}`,
      kind,
      duration: application.duration,
      stacks: application.stacks,
      affectsSelf: false,
      affectsSummons: true,
      maximumRecipients: 1,
      companionIds: [rangerPetCompanionId(context)],
      triggeredBy: skill.name,
    });
  }
}
