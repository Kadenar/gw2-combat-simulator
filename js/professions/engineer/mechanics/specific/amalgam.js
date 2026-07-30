import { ENGINEER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasEngineerTrait } from "../../state.js";
import { emitEngineerState } from "./shared.js";

const NEW_GENES_BOONS = Object.freeze({
  "Defensive Protocol: Cleanse": {
    kind: "aegis",
    duration: 4,
    stacks: 1,
  },
  "Defensive Protocol: Protect": {
    kind: "protection",
    duration: 4,
    stacks: 1,
  },
  "Defensive Protocol: Thorns": {
    kind: "stability",
    duration: 4,
    stacks: 2,
  },
  "Offensive Protocol: Demolish": {
    kind: "swiftness",
    duration: 6,
    stacks: 1,
  },
  "Offensive Protocol: Obliterate": {
    kind: "might",
    duration: 12,
    stacks: 5,
  },
  "Offensive Protocol: Pierce": {
    kind: "vigor",
    duration: 4,
    stacks: 1,
  },
  "Offensive Protocol: Shred": {
    kind: "fury",
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

function emitControl(context, at, {
  name,
  controlKind,
  duration,
  sourceId,
}) {
  context.emit({
    type: "control",
    at,
    source: "engineer",
    sourceId,
    actorType: "player",
    skillName: name,
    name,
    controlKind,
    duration,
  });
}

function selectedMorphNames(context) {
  return new Set(
    context.state.profession.selectedMorphSkillIds
      .map(id => context.catalog.skillsById.get(Number(id))?.name)
      .filter(Boolean),
  );
}

function applyAmalgamStrain(context, morphName, at) {
  const state = context.state.profession;
  if (morphName === "Defensive Protocol: Protect") {
    emitBuff(context, at, {
      kind: "resistance",
      duration: 8,
      sourceId: "engineer.resiliant-strain",
      name: "Resiliant Strain",
    });
  } else if (morphName === "Defensive Protocol: Cleanse") {
    emitBuff(context, at, {
      kind: "alacrity",
      duration: 8,
      sourceId: "engineer.replicating-strain",
      name: "Replicating Strain",
    });
  } else if (morphName === "Defensive Protocol: Thorns") {
    state.rapaciousUntil = Math.max(
      Number(state.rapaciousUntil || 0),
      at + 8,
    );
  } else if (morphName === "Offensive Protocol: Pierce") {
    emitControl(context, at, {
      name: "Volatile Strain",
      controlKind: "stun",
      duration: 2,
      sourceId: "engineer.volatile-strain",
    });
  } else if (morphName === "Offensive Protocol: Obliterate") {
    state.titanicUntil = Math.max(
      Number(state.titanicUntil || 0),
      at + 8,
    );
    emitBuff(context, at, {
      kind: "might",
      duration: 8,
      stacks: 10,
      sourceId: "engineer.titanic-strain",
      name: "Titanic Strain",
    });
  } else if (morphName === "Offensive Protocol: Shred") {
    state.predatorUntil = Math.max(
      Number(state.predatorUntil || 0),
      at + 8,
    );
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
  } else if (morphName === "Offensive Protocol: Demolish") {
    state.berserkerUntil = Math.max(
      Number(state.berserkerUntil || 0),
      at + 8,
    );
    emitBuff(context, at, {
      kind: "stability",
      duration: 8,
      stacks: 5,
      sourceId: "engineer.berserker-strain",
      name: "Berserker Strain",
    });
  }
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
  if (hasEngineerTrait(context.config, TRAIT.SILVER_LINING)) {
    applyAmalgamStrain(context, skill.name, at);
  }
  if (hasEngineerTrait(context.config, TRAIT.NEW_GENES)) {
    emitBuff(context, at, {
      kind: "alacrity",
      duration: 5,
      sourceId: TRAIT.NEW_GENES,
      name: "New Genes",
    });
    emitBuff(context, at, {
      kind: "might",
      duration: 12,
      stacks: 4,
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
  const castDuration = Math.max(0, context.fullEnd - context.start);
  // EVTC applies Evolved and all three strain buffs roughly 520 ms into the
  // measured 640 ms Quickness animation.
  const at = context.start + castDuration * (520 / 640);
  const state = context.state.profession;
  const selected = selectedMorphNames(context);
  state.evolvedUntil = at + 8;

  if (!hasEngineerTrait(context.config, TRAIT.SILVER_LINING)) {
    for (const morphName of selected) {
      applyAmalgamStrain(context, morphName, at);
    }
  }
  if (hasEngineerTrait(context.config, TRAIT.SYMBIOTIC_SYNERGY)) {
    let cooldownReduction = 0;
    for (const skillId of state.selectedMorphSkillIds) {
      const id = Number(skillId);
      const readyAt = Number(context.state.cooldowns.get(id) || 0);
      if (readyAt > at + context.epsilon) {
        cooldownReduction += readyAt - at;
      }
      context.state.cooldowns.delete(id);
    }
    if (cooldownReduction > 0) {
      context.emit({
        type: "proc",
        at,
        source: "Trait",
        sourceId: TRAIT.SYMBIOTIC_SYNERGY,
        actorType: "effect",
        name: "Symbiotic Synergy",
        procType: "trait",
        sourceSkill: "Evolve",
        cooldownReduction,
      });
    }
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

export function observeAmalgamScheduledEvent(context, event) {
  if (
    context.config.specialization !== "Amalgam"
    || !hasEngineerTrait(context.config, TRAIT.MERCURIAL_TENDENCIES)
    || event.type !== "control"
    || event.actorType === "summon"
  ) return;
  context.tasks.schedule({
    type: "engineer.mercurial-tendencies",
    at: event.at,
    ownerId: "engineer.mercurial-tendencies",
    payload: {
      sourceSkill: event.skillName || event.name || "",
    },
  });
}

export function handleMercurialTendencies(context, task) {
  const at = task.at;
  const state = context.state.profession;
  const readyAt = Number(
    state.traitProcReadyAt.mercurialTendencies || 0,
  );
  if (readyAt > at + context.epsilon) return;

  let reducedBy = 0;
  const trackedIds = new Set([
    ...context.state.cooldowns.keys(),
    ...context.state.ammo.keys(),
  ]);
  for (const skillId of trackedIds) {
    const skill = context.catalog.skillsById.get(skillId);
    if (skill?.name !== "Evolve") continue;
    if (context.state.ammo.has(skillId)) {
      reducedBy += context.cooldownController.reduceAmmoRecharge(
        skill,
        2.5,
        at,
      ).reducedBy;
      continue;
    }
    const cooldown = Number(context.state.cooldowns.get(skillId) || 0);
    if (cooldown <= at + context.epsilon) continue;
    const reduction = Math.min(2.5, cooldown - at);
    context.state.cooldowns.set(skillId, cooldown - reduction);
    reducedBy += reduction;
  }
  if (!(reducedBy > 0)) return;

  state.traitProcReadyAt.mercurialTendencies = at + 0.25;
  context.emit({
    type: "proc",
    at,
    source: "Trait",
    sourceId: TRAIT.MERCURIAL_TENDENCIES,
    actorType: "effect",
    name: "Mercurial Tendencies",
    procType: "trait",
    sourceSkill: task.payload?.sourceSkill || "",
    cooldownReduction: reducedBy,
  });
}
