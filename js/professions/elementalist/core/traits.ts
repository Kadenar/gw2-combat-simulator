import { criticalChance } from "../../../platform/gw2/damage.js";
import { hasTrait as hasGw2Trait } from "../../../platform/gw2/trait-state.js";
import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_OVERLOAD_SKILL_IDS,
  ELEMENTALIST_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import type {
  SchedulerRecord,
  SimulationEvent,
  Skill,
} from "../../../platform/engine/types.js";
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistSchedulerContext,
} from "../types.js";
import {
  elementalistCoreState,
  setElementalistAttunementReadyAt,
  type ElementalistAttunement,
  type ElementalistCoreState,
} from "./state.js";
import { PERSISTING_FLAMES_FIELD_SKILLS } from "./constants.js";
import {
  applyElementalistAura,
  combatStarted,
  emitBuff,
  emitCondition,
  emitElementalistProc,
  emitProfiledBuff,
  emitProfiledCondition,
  profiledEffect,
} from "./mechanics.js";
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE,
  elementalistBalanceValue,
  elementalistEffectValue,
} from "./profiles.js";

function hasTrait(context: unknown, trait: string): boolean {
  return hasGw2Trait(context as never, trait);
}

function attunementTraitProcReady(
  context: ElementalistSchedulerContext,
  state: ElementalistCoreState,
  key: string,
  at: number,
): boolean {
  const cooldown = state.attunementTraitProcCooldownSeconds;
  if (cooldown <= 0) return true;
  if (Number(state.procReadyAt[key] || 0) > at + context.epsilon) return false;
  state.procReadyAt[key] = at + cooldown;
  return true;
}

export function triggerElementalistSunspot(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill["id"],
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (
    !combatStarted(context, at) ||
    !hasTrait(context, "Sunspot") ||
    !attunementTraitProcReady(context, state, "sunspot", at)
  ) {
    return;
  }
  const applySunspotAura = () =>
    applyElementalistAura(context, {
      at,
      aura: "Fire Aura",
      duration: elementalistEffectValue(
        context,
        PROFILE.sunspot,
        "buff",
        "duration",
        3,
        "Sunspot Aura",
      ),
      skillName: "Sunspot",
      sourceId,
    });
  applySunspotAura();
  context.emit({
    type: "damage",
    at,
    source: "Sunspot",
    sourceId,
    actorType: "effect",
    skillName: "Sunspot",
    coefficient: elementalistEffectValue(
      context,
      PROFILE.sunspot,
      "strike",
      "coefficient",
      0.6,
      "Sunspot",
    ),
    skillWeapon: "Unequipped",
    noCrit: true,
  });
  if (hasTrait(context, "Burning Rage")) {
    emitProfiledCondition(
      context,
      at,
      PROFILE.burningRage,
      "Sunspot Burning",
      "Burning",
      2,
      4,
      "Sunspot",
      sourceId,
    );
  }
  emitElementalistProc(context, {
    at,
    name: "Sunspot",
    procType: "trait",
    sourceId,
    sourceSkill: context.catalog.skillsById.get(sourceId)?.name,
  });
}

export function triggerElementalistFlameExpulsion(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill["id"],
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (
    !combatStarted(context, at) ||
    !hasTrait(context, "Pyromancer's Puissance") ||
    !attunementTraitProcReady(context, state, "flameExpulsion", at)
  ) {
    return;
  }
  const cappedMight = Math.min(
    elementalistBalanceValue(
      context,
      PROFILE.pyromancersPuissance,
      "maximumStacks",
      10,
    ),
    context.buffStacks("might", at),
  );
  const baseCoefficient = elementalistEffectValue(
    context,
    PROFILE.pyromancersPuissance,
    "strike",
    "coefficient",
    1,
    "Flame Expulsion",
  );
  const coefficientPerMight = elementalistBalanceValue(
    context,
    PROFILE.pyromancersPuissance,
    "damageIncreasePerStack",
    0.1,
  );
  const baseBurningDuration = elementalistEffectValue(
    context,
    PROFILE.pyromancersPuissance,
    "condition",
    "duration",
    2,
    "Flame Expulsion",
  );
  const burningDurationPerMight = elementalistBalanceValue(
    context,
    PROFILE.pyromancersPuissance,
    "durationPerTier",
    0.5,
  );
  context.emit({
    type: "damage",
    at,
    source: "Flame Expulsion",
    sourceId,
    actorType: "effect",
    skillName: "Flame Expulsion",
    coefficient: baseCoefficient + coefficientPerMight * cappedMight,
    skillWeapon: "Unequipped",
  });
  emitCondition(
    context,
    at,
    "Burning",
    elementalistEffectValue(
      context,
      PROFILE.pyromancersPuissance,
      "condition",
      "stacks",
      1,
      "Flame Expulsion",
    ),
    Math.min(
      baseBurningDuration + burningDurationPerMight * cappedMight,
      baseBurningDuration +
        burningDurationPerMight *
          elementalistBalanceValue(
            context,
            PROFILE.pyromancersPuissance,
            "maximumStacks",
            10,
          ),
    ),
    "Flame Expulsion",
    sourceId,
  );
  emitElementalistProc(context, {
    at,
    name: "Flame Expulsion",
    procType: "trait",
    sourceId,
    sourceSkill: context.catalog.skillsById.get(sourceId)?.name,
    icon: "https://render.guildwars2.com/file/998095CB1FD2CF0164B8A36BABFDB911DF08DB02/1012313.png",
  });
}

export function triggerElementalistElectricDischarge(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill["id"],
): void {
  if (!combatStarted(context, at) || !hasTrait(context, "Electric Discharge"))
    return;
  context.emit({
    type: "damage",
    at,
    source: "Electric Discharge",
    sourceId,
    actorType: "effect",
    skillName: "Electric Discharge",
    coefficient: elementalistEffectValue(
      context,
      PROFILE.electricDischarge,
      "strike",
      "coefficient",
      0.35,
      "Electric Discharge",
    ),
    skillWeapon: "Unequipped",
  });
  emitProfiledCondition(
    context,
    at,
    PROFILE.electricDischarge,
    "Electric Discharge",
    "Vulnerability",
    1,
    8,
    "Electric Discharge",
    sourceId,
  );
  emitElementalistProc(context, {
    at,
    name: "Electric Discharge",
    procType: "trait",
    sourceId,
    sourceSkill: context.catalog.skillsById.get(sourceId)?.name,
  });
}

export function triggerElementalistEarthenBlast(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill["id"],
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (
    !combatStarted(context, at) ||
    !hasTrait(context, "Earthen Blast") ||
    !attunementTraitProcReady(context, state, "earthenBlast", at)
  ) {
    return;
  }
  context.emit({
    type: "damage",
    at,
    source: "Earthen Blast",
    sourceId,
    actorType: "effect",
    skillName: "Earthen Blast",
    coefficient: elementalistEffectValue(
      context,
      PROFILE.earthenBlast,
      "strike",
      "coefficient",
      0.36,
    ),
    skillWeapon: "Unequipped",
    noCrit: true,
  });
  emitElementalistProc(context, {
    at,
    name: "Earthen Blast",
    procType: "trait",
    sourceId,
    sourceSkill: context.catalog.skillsById.get(sourceId)?.name,
  });
}

export function grantElementalistRockSolid(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill["id"],
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (
    !combatStarted(context, at) ||
    !hasTrait(context, "Rock Solid") ||
    !attunementTraitProcReady(context, state, "rockSolid", at)
  ) {
    return;
  }
  emitProfiledBuff(
    context,
    at,
    PROFILE.rockSolid,
    "Stability",
    "Stability",
    1,
    3,
    "Rock Solid",
    sourceId,
  );
}

export function grantElementalAttunementBoon(
  context: ElementalistSchedulerContext,
  at: number,
  attunement: ElementalistAttunement,
  sourceId: Skill["id"],
): void {
  if (!hasTrait(context, "Elemental Attunement")) return;
  const fallback: Readonly<
    Record<ElementalistAttunement, readonly [string, number, number]>
  > = {
    Fire: ["Might", 1, 15],
    Water: ["Regeneration", 1, 5],
    Air: ["Swiftness", 1, 8],
    Earth: ["Protection", 1, 5],
  };
  const [kind, stacks, duration] = fallback[attunement];
  emitProfiledBuff(
    context,
    at,
    PROFILE.elementalAttunement,
    attunement,
    kind,
    stacks,
    duration,
    "Elemental Attunement",
    sourceId,
  );
}

export function triggerElementalistBountifulPower(
  context: ElementalistSchedulerContext,
  at: number,
  stacks: number,
  sourceId: Skill["id"],
): void {
  if (!hasTrait(context, "Bountiful Power")) return;
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  state.bountifulPowerProgress += stacks;
  const threshold = elementalistBalanceValue(
    context,
    PROFILE.bountifulPower,
    "threshold",
    5,
  );
  while (state.bountifulPowerProgress >= threshold) {
    state.bountifulPowerProgress -= threshold;
    emitProfiledBuff(
      context,
      at,
      PROFILE.bountifulPower,
      "Quickness",
      "Quickness",
      1,
      5,
      "Bountiful Power",
      sourceId,
    );
    const active = profiledEffect(
      context,
      PROFILE.bountifulPower,
      "buff",
      "Damage Window",
    );
    emitBuff(
      context,
      at,
      "Bountiful Power Active",
      Number(active?.stacks ?? 1),
      Number(active?.duration ?? 7),
      "Bountiful Power",
      sourceId,
    );
  }
}

export function triggerEvasiveArcana(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  if (!hasTrait(context, "Evasive Arcana")) return;
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = context.effectiveEnd;
  const attunement = state.primaryAttunement;
  const key = `evasiveArcana${attunement}`;
  if (Number(state.procReadyAt[key] || 0) > at + context.epsilon) return;
  state.procReadyAt[key] =
    at +
    elementalistBalanceValue(
      context,
      PROFILE.evasiveArcana,
      "internalCooldown",
      10,
    );
  const source =
    attunement === "Fire"
      ? "Flame Burst (trait)"
      : attunement === "Water"
        ? "Cleansing Wave (trait)"
        : attunement === "Air"
          ? "Blinding Flash (trait)"
          : "Shock Wave (trait)";
  if (attunement === "Fire") {
    context.emit({
      type: "damage",
      at,
      source,
      sourceId: skill.id,
      actorType: "effect",
      skillName: source,
      coefficient: elementalistEffectValue(
        context,
        PROFILE.evasiveArcana,
        "strike",
        "coefficient",
        1,
        "Fire",
      ),
      skillWeapon: "Unequipped",
    });
    emitProfiledCondition(
      context,
      at,
      PROFILE.evasiveArcana,
      "Fire Burning",
      "Burning",
      3,
      6,
      source,
      skill.id,
    );
  } else if (attunement === "Air") {
    context.emit({
      type: "blind",
      at,
      source,
      sourceId: skill.id,
      actorType: "effect",
      skillName: source,
      controlKind: "blind",
    });
  } else if (attunement === "Earth") {
    context.emit({
      type: "damage",
      at,
      source,
      sourceId: skill.id,
      actorType: "effect",
      skillName: source,
      coefficient: elementalistEffectValue(
        context,
        PROFILE.evasiveArcana,
        "strike",
        "coefficient",
        0.5,
        "Earth",
      ),
      skillWeapon: "Unequipped",
      comboFinishers: [
        {
          ownerId: "elementalist",
          finisherType: "Blast",
          ambiguousFieldSelection: "oldest",
        },
      ],
    });
    emitProfiledCondition(
      context,
      at,
      PROFILE.evasiveArcana,
      "Earth Bleeding",
      "Bleeding",
      1,
      20,
      source,
      skill.id,
    );
    emitProfiledCondition(
      context,
      at,
      PROFILE.evasiveArcana,
      "Earth Cripple",
      "Cripple",
      1,
      2,
      source,
      skill.id,
    );
  }
  context.emit({
    type: "elementalist.evasive-arcana",
    at,
    source,
    sourceId: skill.id,
    actorType: "effect",
    skillName: source,
    attunement,
  });
  emitElementalistProc(context as never, {
    at,
    name: source,
    procType: "trait",
    sourceId: skill.id,
    sourceSkill: skill.name,
  });
}

export function applyGenericPostCast(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = context.effectiveEnd;
  if (
    hasTrait(context, "Pyromancer's Puissance") &&
    state.primaryAttunement === "Fire" &&
    combatStarted(context, at)
  ) {
    emitProfiledBuff(
      context,
      at,
      PROFILE.pyromancersPuissance,
      "Attunement Might",
      "Might",
      1,
      15,
      skill.name,
      skill.id,
    );
  }
  if (skill.type === "Heal") {
    if (hasTrait(context, "Gale Song")) {
      emitProfiledBuff(
        context,
        at,
        TRAIT.GALE_SONG,
        "Protection",
        "Protection",
        1,
        3,
        "Gale Song",
        skill.id,
      );
    }
    if (
      hasTrait(context, "Earth's Embrace") &&
      Number(state.procReadyAt.earthsEmbrace || 0) <= at + context.epsilon
    ) {
      state.procReadyAt.earthsEmbrace =
        at +
        elementalistBalanceValue(
          context,
          PROFILE.earthsEmbrace,
          "internalCooldown",
          15,
        );
      emitProfiledBuff(
        context,
        at,
        PROFILE.earthsEmbrace,
        "Resistance",
        "Resistance",
        1,
        4,
        "Earth's Embrace",
        skill.id,
      );
    }
    if (
      hasTrait(context, "Soothing Ice") &&
      Number(state.procReadyAt.soothingIce || 0) <= at + context.epsilon
    ) {
      state.procReadyAt.soothingIce =
        at +
        elementalistBalanceValue(
          context,
          PROFILE.soothingIce,
          "internalCooldown",
          15,
        );
      applyElementalistAura(context, {
        at,
        aura: "Frost Aura",
        duration: elementalistEffectValue(
          context,
          PROFILE.soothingIce,
          "buff",
          "duration",
          4,
          "Frost Aura",
        ),
        skillName: "Soothing Ice",
        sourceId: skill.id,
      });
      emitProfiledBuff(
        context,
        at,
        PROFILE.soothingIce,
        "Regeneration",
        "Regeneration",
        1,
        4,
        "Soothing Ice",
        skill.id,
      );
    }
  }
  if (hasTrait(context, "Written in Stone") && skill.skillFamily === "Signet") {
    const aura =
      skill.name === "Signet of Restoration"
        ? (["Restoration", "Frost Aura", 4] as const)
        : skill.name === "Signet of Fire"
          ? (["Fire", "Fire Aura", 4] as const)
          : skill.name === "Signet of Earth"
            ? (["Earth", "Magnetic Aura", 3] as const)
            : null;
    if (aura) {
      const effect = profiledEffect(
        context,
        PROFILE.writtenInStone,
        "buff",
        aura[0],
      );
      applyElementalistAura(context, {
        at,
        aura: String(effect?.kind || aura[1]),
        duration: Number(effect?.duration ?? aura[2]),
        skillName: "Written in Stone",
        sourceId: skill.id,
      });
    }
  }
  if (hasTrait(context, "Inscription") && skill.skillFamily === "Glyph") {
    const boon =
      state.primaryAttunement === "Fire"
        ? (["Fire", "Might", 1, 10] as const)
        : state.primaryAttunement === "Water"
          ? (["Water", "Regeneration", 1, 10] as const)
          : state.primaryAttunement === "Air"
            ? (["Air", "Swiftness", 1, 10] as const)
            : (["Earth", "Protection", 1, 3] as const);
    emitProfiledBuff(
      context,
      at,
      PROFILE.inscription,
      boon[0],
      boon[1],
      boon[2],
      boon[3],
      skill.name,
      skill.id,
    );
  }
  if (
    hasTrait(context, "Bolstered Elements") &&
    skill.skillFamily === "Stance"
  ) {
    emitProfiledBuff(
      context,
      at,
      TRAIT.BOLSTERED_ELEMENTS,
      "Protection",
      "Protection",
      1,
      3,
      skill.name,
      skill.id,
    );
  }
  if (
    hasTrait(context, "Swift Revenge") &&
    String(skill.attunement || "").includes("+")
  ) {
    for (const element of new Set(String(skill.attunement).split("+"))) {
      if (element === "Fire") {
        emitProfiledBuff(
          context,
          at,
          TRAIT.SWIFT_REVENGE,
          "Fire",
          "Might",
          3,
          5,
          skill.name,
          skill.id,
        );
      } else if (element === "Air") {
        emitProfiledBuff(
          context,
          at,
          TRAIT.SWIFT_REVENGE,
          "Air",
          "Swiftness",
          1,
          5,
          skill.name,
          skill.id,
        );
      } else if (element === "Earth") {
        state.endurance = Math.min(
          elementalistBalanceValue(
            context,
            PROFILE.resources,
            "maximumStacks",
            100,
          ),
          state.endurance +
            elementalistBalanceValue(
              context,
              TRAIT.SWIFT_REVENGE,
              "resourceGain",
              25,
            ),
        );
      }
    }
  }
  if (hasTrait(context, "Arcane Lightning") && skill.skillFamily === "Arcane") {
    const arcaneWindow = profiledEffect(
      context,
      PROFILE.arcaneLightning,
      "buff",
      "Arcane Lightning",
    );
    emitBuff(
      context,
      at,
      "Arcane Lightning",
      Number(arcaneWindow?.stacks ?? 1),
      Number(arcaneWindow?.duration ?? 15),
      skill.name,
      skill.id,
    );
    if (skill.name === "Arcane Brilliance") {
      emitProfiledBuff(
        context,
        at,
        PROFILE.arcaneLightning,
        "Arcane Brilliance",
        "Protection",
        1,
        3.5,
        skill.name,
        skill.id,
      );
    } else if (skill.name === "Arcane Wave") {
      emitProfiledCondition(
        context,
        at,
        PROFILE.arcaneLightning,
        "Arcane Wave",
        "Immobilized",
        1,
        2,
        skill.name,
        skill.id,
      );
    } else if (skill.name === "Arcane Blast") {
      context.emit({
        type: "blind",
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: "effect",
        skillName: skill.name,
        controlKind: "blind",
      });
    } else if (skill.name === "Arcane Echo") {
      emitProfiledBuff(
        context,
        at,
        PROFILE.arcaneLightning,
        "Arcane Echo",
        "Quickness",
        1,
        4,
        skill.name,
        skill.id,
      );
    }
  }
  if (
    hasTrait(context, "Superior Elements") &&
    String(skill.attunement || "").includes("+") &&
    Number(state.procReadyAt.superiorElements || 0) <= at + context.epsilon
  ) {
    state.procReadyAt.superiorElements =
      at +
      elementalistBalanceValue(
        context,
        TRAIT.SUPERIOR_ELEMENTS,
        "internalCooldown",
        4,
      );
    emitProfiledCondition(
      context,
      at,
      TRAIT.SUPERIOR_ELEMENTS,
      "Weakness",
      "Weakness",
      1,
      5,
      skill.name,
      skill.id,
    );
  }
}

export function extendPersistingFlamesPackets(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  if (
    !hasTrait(context, "Persisting Flames") ||
    !PERSISTING_FLAMES_FIELD_SKILLS.has(skill.name)
  ) {
    return;
  }
  const fieldPackets = context.events
    .filter(
      (event) =>
        event.activationId === context.reservationId &&
        event.type === "damage" &&
        event.damageKind === "field-tick",
    )
    .sort((left, right) => left.at - right.at);
  if (fieldPackets.length < 2) return;
  const template = fieldPackets.at(-1);
  const previous = fieldPackets.at(-2);
  if (!template || !previous) return;
  const interval = template.at - previous.at;
  if (!(interval > context.epsilon)) return;
  const attachedConditions = context.events.filter(
    (event) =>
      event.activationId === context.reservationId &&
      event.type === "condition" &&
      Math.abs(event.at - template.at) <= context.epsilon,
  );
  const extraPackets = Math.max(
    0,
    Math.trunc(
      elementalistBalanceValue(context, PROFILE.persistingFlames, "summons", 2),
    ),
  );
  for (let index = 1; index <= extraPackets; index += 1) {
    const at = template.at + interval * index;
    context.emit({
      ...template,
      at,
      largeHitboxOnly: false,
    });
    for (const condition of attachedConditions) {
      context.emit({
        ...condition,
        at,
        largeHitboxOnly: false,
      });
    }
  }
}

export function extendPersistingFlamesField(
  context: ElementalistSchedulerContext,
  event: SimulationEvent,
): void {
  if (
    event.type !== "action" ||
    !hasTrait(context, "Persisting Flames") ||
    !PERSISTING_FLAMES_FIELD_SKILLS.has(String(event.skillName || event.name))
  ) {
    return;
  }
  const field = context.events.find(
    (candidate) =>
      candidate.type === "combo_field" &&
      candidate.activationId === event.activationId &&
      candidate.fieldType === "Fire",
  );
  if (!field) return;
  context.replaceEvent(field, {
    expiresAt:
      Number(field.expiresAt) +
      elementalistBalanceValue(
        context,
        PROFILE.persistingFlames,
        "durationPerTier",
        2,
      ),
  });
}

function observeFreshAir(
  context: ElementalistSchedulerContext,
  event: SimulationEvent,
): void {
  if (
    event.type !== "damage" ||
    event.actorType !== "player" ||
    event.canCrit === false ||
    event.noCrit ||
    !(Number(event.coefficient) > 0) ||
    !hasTrait(context, "Fresh Air")
  ) {
    return;
  }
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  state.freshAirCandidates.push({
    at: event.at,
    criticalChance: eventCriticalChance(context),
    sourceId: event.skillId ?? event.sourceId,
    sourceSkill: String(event.skillName || event.source || ""),
  });
}

export function processFreshAirCandidates(
  context: ElementalistSchedulerContext,
  through: number,
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (!state.freshAirCandidates.length) return;
  const pending = [];
  const candidates = [...state.freshAirCandidates].sort(
    (left, right) => left.at - right.at,
  );
  for (const candidate of candidates) {
    if (candidate.at > through + context.epsilon) {
      pending.push(candidate);
      continue;
    }
    if (state.primaryAttunement === "Air") continue;
    state.freshAirProgress += candidate.criticalChance;
    if (state.freshAirProgress + context.epsilon < 1) continue;
    state.freshAirProgress -= 1;
    if (state.attunementReadyAt.Air > candidate.at + context.epsilon) {
      setElementalistAttunementReadyAt(context, "Air", candidate.at);
      context.state.cooldowns.delete(ELEMENTALIST_ATTUNEMENT_SKILL_IDS.Air);
      context.state.cooldowns.delete(ELEMENTALIST_OVERLOAD_SKILL_IDS.Air);
    }
    context.emit({
      type: "elementalist.fresh-air",
      at: candidate.at,
      source: "Fresh Air",
      sourceId: "Fresh Air",
      actorType: "effect",
      skillName: "Fresh Air",
      sourceSkill: candidate.sourceSkill,
      triggeringSkillId: candidate.sourceId,
    });
  }
  state.freshAirCandidates = pending;
}

function eventCriticalChance(context: ElementalistSchedulerContext): number {
  const stats = (context.config.stats || {}) as SchedulerRecord;
  return Math.min(
    1,
    criticalChance(Number(stats.precision || 0)) +
      (context.config.boons?.fury ? 0.25 : 0) +
      Number(stats.criticalChanceBonus || 0) / 100 +
      (hasTrait(context, "Zephyr's Speed")
        ? elementalistBalanceValue(
            context,
            PROFILE.zephyrsSpeed,
            "criticalChance",
            0.05,
          )
        : 0),
  );
}

function observeCriticalTraits(
  context: ElementalistSchedulerContext,
  event: SimulationEvent,
): void {
  if (
    event.type !== "damage" ||
    event.actorType !== "player" ||
    event.canCrit === false ||
    event.noCrit ||
    !(Number(event.coefficient) > 0)
  ) {
    return;
  }
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const chance = eventCriticalChance(context);
  if (hasTrait(context, "Raging Storm")) {
    state.criticalProcProgress.ragingStorm =
      Number(state.criticalProcProgress.ragingStorm || 0) + chance;
    if (
      state.criticalProcProgress.ragingStorm + context.epsilon >= 1 &&
      Number(state.procReadyAt.ragingStorm || 0) <= event.at + context.epsilon
    ) {
      state.criticalProcProgress.ragingStorm -= 1;
      state.procReadyAt.ragingStorm =
        event.at +
        elementalistBalanceValue(
          context,
          PROFILE.ragingStorm,
          "internalCooldown",
          8,
        );
      emitProfiledBuff(
        context,
        event.at,
        PROFILE.ragingStorm,
        "Fury",
        "Fury",
        1,
        4,
        "Raging Storm",
        event.skillId ?? event.sourceId,
      );
    }
  }
  if (hasTrait(context, "Arcane Precision")) {
    state.criticalProcProgress.arcanePrecision =
      Number(state.criticalProcProgress.arcanePrecision || 0) +
      chance *
        elementalistBalanceValue(
          context,
          PROFILE.arcanePrecision,
          "procChance",
          0.33,
        );
    if (
      state.criticalProcProgress.arcanePrecision + context.epsilon >= 1 &&
      Number(state.procReadyAt.arcanePrecision || 0) <=
        event.at + context.epsilon
    ) {
      state.criticalProcProgress.arcanePrecision -= 1;
      state.procReadyAt.arcanePrecision =
        event.at +
        elementalistBalanceValue(
          context,
          PROFILE.arcanePrecision,
          "internalCooldown",
          3,
        );
      const attunement = state.primaryAttunement;
      if (attunement === "Fire") {
        emitProfiledCondition(
          context,
          event.at,
          PROFILE.arcanePrecision,
          "Fire",
          "Burning",
          1,
          1.5,
          "Arcane Precision",
          event.skillId ?? event.sourceId,
        );
      } else if (attunement === "Water") {
        emitProfiledCondition(
          context,
          event.at,
          PROFILE.arcanePrecision,
          "Water",
          "Vulnerability",
          1,
          10,
          "Arcane Precision",
          event.skillId ?? event.sourceId,
        );
      } else if (attunement === "Air") {
        emitProfiledCondition(
          context,
          event.at,
          PROFILE.arcanePrecision,
          "Air",
          "Weakness",
          1,
          3,
          "Arcane Precision",
          event.skillId ?? event.sourceId,
        );
      } else {
        emitProfiledCondition(
          context,
          event.at,
          PROFILE.arcanePrecision,
          "Earth",
          "Bleeding",
          1,
          5,
          "Arcane Precision",
          event.skillId ?? event.sourceId,
        );
      }
      emitElementalistProc(context, {
        at: event.at,
        name: "Arcane Precision",
        procType: "trait",
        sourceId: event.skillId ?? event.sourceId,
        sourceSkill: String(event.skillName || event.source || ""),
      });
    }
  }
  if (hasTrait(context, "Renewing Stamina")) {
    state.criticalProcProgress.renewingStamina =
      Number(state.criticalProcProgress.renewingStamina || 0) + chance;
    if (
      state.criticalProcProgress.renewingStamina + context.epsilon >= 1 &&
      Number(state.procReadyAt.renewingStamina || 0) <=
        event.at + context.epsilon
    ) {
      state.criticalProcProgress.renewingStamina -= 1;
      state.procReadyAt.renewingStamina =
        event.at +
        elementalistBalanceValue(
          context,
          PROFILE.renewingStamina,
          "internalCooldown",
          10,
        );
      emitProfiledBuff(
        context,
        event.at,
        PROFILE.renewingStamina,
        "Vigor",
        "Vigor",
        1,
        5,
        "Renewing Stamina",
        event.skillId ?? event.sourceId,
      );
    }
  }
}

function observeLightningRod(
  context: ElementalistSchedulerContext,
  event: SimulationEvent,
): void {
  if (event.type !== "control" || event.actorType !== "player") return;
  const sourceId = event.skillId ?? event.sourceId;
  if (hasTrait(context, "Lightning Rod")) {
    context.emitDerived(event, {
      type: "damage",
      at: event.at,
      source: "Lightning Rod",
      sourceId,
      actorType: "effect",
      skillName: "Lightning Rod",
      coefficient: elementalistEffectValue(
        context,
        PROFILE.lightningRod,
        "strike",
        "coefficient",
        1.5,
      ),
      skillWeapon: "Unequipped",
    });
    emitProfiledCondition(
      context,
      event.at,
      PROFILE.lightningRod,
      "Lightning Rod",
      "Weakness",
      1,
      4,
      "Lightning Rod",
      sourceId,
    );
    emitElementalistProc(context, {
      at: event.at,
      name: "Lightning Rod",
      procType: "trait",
      sourceId,
      sourceSkill: String(event.skillName || event.source || ""),
    });
  }
  if (hasTrait(context, "Elemental Pursuit")) {
    emitProfiledBuff(
      context,
      event.at,
      TRAIT.ELEMENTAL_PURSUIT,
      "Swiftness",
      "Swiftness",
      1,
      3,
      "Elemental Pursuit",
      sourceId,
    );
  }
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (
    !hasTrait(context, "Elemental Lockdown") ||
    Number(state.procReadyAt.elementalLockdown || 0) >
      event.at + context.epsilon
  ) {
    return;
  }
  state.procReadyAt.elementalLockdown =
    event.at +
    elementalistBalanceValue(
      context,
      PROFILE.elementalLockdown,
      "internalCooldown",
      1,
    );
  const fallback: Readonly<
    Record<ElementalistAttunement, readonly [string, number, number]>
  > = {
    Fire: ["Might", 5, 5],
    Water: ["Regeneration", 1, 10],
    Air: ["Fury", 1, 5],
    Earth: ["Protection", 1, 4],
  };
  const attunement = state.primaryAttunement;
  const [kind, stacks, duration] = fallback[attunement];
  emitProfiledBuff(
    context,
    event.at,
    PROFILE.elementalLockdown,
    attunement,
    kind,
    stacks,
    duration,
    "Elemental Lockdown",
    sourceId,
  );
}

export function observeElementalistTraitEvent(
  context: ElementalistSchedulerContext,
  event: SimulationEvent,
): void {
  observeFreshAir(context, event);
  observeCriticalTraits(context, event);
  observeLightningRod(context, event);
}
