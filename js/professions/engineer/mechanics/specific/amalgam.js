import { ENGINEER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasEngineerTrait } from "../../state.js";
import { emitEngineerState } from "./shared.js";

const NEW_GENES_BOONS = Object.freeze({
  "Defensive Protocol: Cleanse": {
    kind: "protection",
    duration: 4,
    stacks: 1,
  },
  "Defensive Protocol: Protect": {
    kind: "aegis",
    duration: 4,
    stacks: 1,
  },
  "Defensive Protocol: Thorns": {
    kind: "stability",
    duration: 4,
    stacks: 2,
  },
  "Offensive Protocol: Demolish": {
    kind: "vigor",
    duration: 4,
    stacks: 1,
  },
  "Offensive Protocol: Obliterate": {
    kind: "might",
    duration: 12,
    stacks: 5,
  },
  "Offensive Protocol: Pierce": {
    kind: "fury",
    duration: 6,
    stacks: 1,
  },
  "Offensive Protocol: Shred": {
    kind: "swiftness",
    duration: 6,
    stacks: 1,
  },
});

function emitBuff(context, at, {
  kind,
  duration,
  stacks = 1,
  sourceId,
  name,
}) {
  context.emit({
    type: "buff",
    at,
    source: "engineer",
    sourceId,
    actorType: "player",
    skillName: name,
    name,
    kind,
    duration,
    stacks,
  });
}

function selectedMorphNames(context) {
  return new Set(
    context.state.profession.selectedMorphSkillIds
      .map(id => context.catalog.skillsById.get(Number(id))?.name)
      .filter(Boolean),
  );
}

function assumesDamagingField(context) {
  return Boolean(
    context.config.professionAssumptions?.inDamagingField
    ?? context.config.assumptions?.inDamagingField
    ?? context.config.inDamagingField
    ?? false
  );
}

function scheduleThornsRetaliation(context, skill, at) {
  if (!assumesDamagingField(context)) return;
  for (let index = 0; index < 6; index += 1) {
    context.emit({
      type: "damage",
      at: at + index,
      source: "engineer",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: "Thorns Retaliation",
      coefficient: 0.5,
      hits: 1,
      hitIndex: index + 1,
      totalHits: 6,
      skillWeapon: "Unequipped",
      ...(index === 5 ? { extendsResolutionHorizon: true } : {}),
    });
  }
}

export function activateAmalgamMorph(context, skill) {
  const at = context.effectiveEnd;
  const state = context.state.profession;
  if (skill.name === "Defensive Protocol: Thorns") {
    state.thornsUntil = Math.max(state.thornsUntil, at + 6);
    scheduleThornsRetaliation(context, skill, at);
  }
  if (hasEngineerTrait(context.config, TRAIT.WILLING_HOST)) {
    state.willingHostUntil = Math.max(state.willingHostUntil, at + 10);
  }
  if (hasEngineerTrait(context.config, TRAIT.HARDENED_CHROME)) {
    emitBuff(context, at, {
      kind: "protection",
      duration: 2.5,
      sourceId: TRAIT.HARDENED_CHROME,
      name: "Hardened Chrome",
    });
  }
  if (hasEngineerTrait(context.config, TRAIT.NEW_GENES)) {
    emitBuff(context, at, {
      kind: "alacrity",
      duration: 5,
      sourceId: TRAIT.NEW_GENES,
      name: "New Genes",
    });
    const extra = NEW_GENES_BOONS[skill.name];
    if (extra) {
      emitBuff(context, at, {
        ...extra,
        sourceId: TRAIT.NEW_GENES,
        name: "New Genes",
      });
    }
  }
  emitEngineerState(context, at, "amalgam-morph");
}

export function activatePlasmaticState(context, skill) {
  const castDuration = Math.max(0, context.fullEnd - context.start);
  const at = context.start + castDuration * (640 / 720);
  const aftercastMs = context.hasBuff("quickness", context.start)
    ? skill.quicknessAftercastMs
    : skill.aftercastMs;
  context.state.profession.plasmaticLockoutUntil =
    context.effectiveEnd + Math.max(0, Number(aftercastMs || 0)) / 1000;
  context.state.profession.plasmaticStateUntil = Math.max(
    context.state.profession.plasmaticStateUntil,
    at + 6,
  );
  emitEngineerState(context, at, "plasmatic-state");
}

export function evolveAmalgam(context) {
  const at = context.effectiveEnd;
  const state = context.state.profession;
  const selected = selectedMorphNames(context);
  state.evolvedUntil = at + 8;
  state.rapaciousUntil = selected.has("Defensive Protocol: Thorns")
    ? at + 8
    : 0;
  state.predatorUntil = selected.has("Offensive Protocol: Shred")
    ? at + 8
    : 0;
  state.titanicUntil = selected.has("Offensive Protocol: Obliterate")
    ? at + 8
    : 0;
  state.berserkerUntil = selected.has("Offensive Protocol: Demolish")
    ? at + 8
    : 0;

  if (state.predatorUntil > at) {
    emitBuff(context, at, {
      kind: "quickness",
      duration: 8,
      sourceId: "engineer.predator-strain",
      name: "Predator Strain",
    });
    emitBuff(context, at, {
      kind: "superspeed",
      duration: 8,
      sourceId: "engineer.predator-strain",
      name: "Predator Strain",
    });
  }
  if (state.titanicUntil > at) {
    emitBuff(context, at, {
      kind: "might",
      duration: 8,
      stacks: 10,
      sourceId: "engineer.titanic-strain",
      name: "Titanic Strain",
    });
  }
  if (state.berserkerUntil > at) {
    emitBuff(context, at, {
      kind: "stability",
      duration: 8,
      stacks: 5,
      sourceId: "engineer.berserker-strain",
      name: "Berserker Strain",
    });
  }
  if (hasEngineerTrait(context.config, TRAIT.HARDENED_CHROME)) {
    emitBuff(context, at, {
      kind: "protection",
      duration: 4,
      sourceId: TRAIT.HARDENED_CHROME,
      name: "Hardened Chrome",
    });
  }
  emitEngineerState(context, at, "evolve");
}
