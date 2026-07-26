/**
 * Handles profession shatters, instruments, and Crescendo.
 * Manages resource consumption, trait procs (Maim/Phantom Pain/Illusionary Membrane/etc.).
 * Returns: consumeResources, currentResource, handleCrescendo, handleInstrument, handleShatter, triggerShatterTraits.
 * @param {Object} config - Scheduler config (state, traits, resourceDefinition, etc.)
 * @returns {Object} Profession action controller
 */
import { MESMER_TRAIT_IDS as TRAIT } from "../data/ids.js";

export function createProfessionActionController({
  state,
  traits,
  resourceDefinition,
  destroyClone,
  epsilon,
  shatters,
  instruments,
  warnings,
  addEvent,
  addTraitProc,
  addCondition,
  addDamage,
  activePrimaryWeapon,
  queueResources,
  byName,
  traitDamage,
}) {
  const currentResource = () =>
    resourceDefinition.singular === "clone"
      ? state.profession.clones.length
      : state.profession.numericResource;

  const consumeResources = (
    at,
    { sourceSkill = "", rotationIndex = null } = {},
  ) => {
    const spent = currentResource();
    if (resourceDefinition.singular === "clone") {
      for (const clone of state.profession.clones) {
        destroyClone(clone, at);
      }
      state.profession.clones = [];
    } else {
      state.profession.numericResource = 0;
    }
    addEvent({
      type: "resource",
      at,
      amount: -spent,
      value: 0,
      resource: resourceDefinition.plural,
      reason: "profession mechanic",
      ...(sourceSkill ? { sourceSkill } : {}),
      ...(Number.isInteger(rotationIndex) ? { rotationIndex } : {}),
    });
    return spent;
  };

  const triggerShatterTraits = (
    skill,
    at,
    spent,
    bladeSong = false,
    { skipMaim = false } = {},
  ) => {
    const shatter = shatters[skill.name];
    const sources = bladeSong ? 1 : spent + 1;
    if (!skipMaim && traits.has(TRAIT.MAIM_THE_DISILLUSIONED)) {
      addCondition(
        skill.name,
        at,
        { name: "Torment", duration: 6, stacks: sources },
        "Player",
        `${skill.name} — Maim the Disillusioned`,
      );
      addTraitProc("Maim the Disillusioned", at, skill.name);
    }
    if (traits.has(TRAIT.PHANTOM_PAIN)) {
      addEvent({
        type: "buff",
        at: at + epsilon,
        kind: "phantom-pain",
        stacks: Math.min(4, spent + 1),
        duration: 10,
      });
      addTraitProc("Phantom Pain", at + epsilon, skill.name);
    }
    if (shatter?.slot === 2 && traits.has(TRAIT.ILLUSIONARY_MEMBRANE)) {
      addEvent({
        type: "buff",
        at: at + epsilon,
        kind: "illusionary-membrane",
        stacks: 1,
        duration: 15,
      });
      addTraitProc("Illusionary Membrane", at + epsilon, skill.name);
    }
    if (bladeSong && traits.has(TRAIT.DEADLY_BLADES)) {
      addEvent({
        type: "buff",
        at: at + epsilon,
        kind: "deadly-blades",
        stacks: 1,
        duration: 7,
      });
      addTraitProc("Deadly Blades", at + epsilon, skill.name);
    }
    if (
      resourceDefinition.singular === "clone"
      && spent === 3
      && traits.has(TRAIT.ILLUSIONARY_REVERSION)
    ) {
      queueResources(
        at + epsilon,
        1,
        activePrimaryWeapon(),
        "Illusionary Reversion",
      );
    }
  };

  const handleShatter = (skill, at, resourcesSpent = null) => {
    const shatter = shatters[skill.name];
    const isBladeSong = shatter.kind.startsWith("blade");
    if (isBladeSong && resourcesSpent == null && currentResource() < 1) {
      warnings.push(`${skill.name} skipped at ${at.toFixed(2)}s: no blades.`);
      return false;
    }
    const spent = resourcesSpent ?? consumeResources(at);
    const sources = spent + 1;

    if (shatter.kind === "core-power") {
      addDamage(
        skill,
        at,
        {
          coefficient: shatter.coefficients[spent],
          hits: sources,
          source: "Player",
          weaponStrength: 1000,
        },
        { shatter: true },
      );
    } else if (shatter.kind === "core-confusion") {
      addDamage(
        skill,
        at,
        {
          coefficient: shatter.coefficients[spent],
          hits: sources,
          source: "Player",
          weaponStrength: 1000,
        },
        { shatter: true },
      );
      const cryBonus = traits.has(TRAIT.CRY_OF_PAIN) ? 2 : 1;
      addCondition(skill.name, at, {
        name: "Confusion",
        duration: traits.has(TRAIT.CRY_OF_PAIN) ? 4 : 3,
        stacks: sources * cryBonus,
      });
    } else if (shatter.kind === "chrono-power") {
      addDamage(
        skill,
        at,
        {
          coefficient: shatter.coefficients[spent],
          hits: sources * 2,
          source: "Player",
          weaponStrength: 1000,
        },
        { shatter: true },
      );
    } else if (shatter.kind === "chrono-confusion") {
      addDamage(
        skill,
        at,
        {
          coefficient: shatter.coefficients[spent],
          hits: sources,
          source: "Player",
          weaponStrength: 1000,
        },
        { shatter: true },
      );
      const cryBonus = traits.has(TRAIT.CRY_OF_PAIN) ? 2 : 1;
      addCondition(skill.name, at, {
        name: "Confusion",
        duration: traits.has(TRAIT.CRY_OF_PAIN) ? 4 : 3,
        stacks: sources * cryBonus,
      });
      if (traits.has(TRAIT.BLINDING_DISSIPATION)) {
        addEvent({
          type: "blind",
          at,
          skillName: skill.name,
          count: sources,
        });
        addTraitProc("Blinding Dissipation", at, skill.name);
      }
      const id = skill.id;
      const ready = state.cooldowns.get(id) || at;
      state.cooldowns.set(id, Math.max(at, ready - 3 * spent));
    } else if (shatter.kind === "blade-power") {
      const packetDelays = shatter.packetDelays || [];
      for (let index = 0; index < spent; index += 1) {
        addDamage(
          skill,
          at + Number(packetDelays[index] || 0),
          {
            coefficient: shatter.coefficients[spent] / spent,
            hits: 1,
            source: "Player",
            weaponStrength: 1000,
          },
          { shatter: true, blade: true },
        );
      }
    } else if (shatter.kind === "blade-confusion") {
      const packetDelays = shatter.packetDelays || [];
      for (let index = 0; index < spent; index += 1) {
        const packetAt = at + Number(packetDelays[index] || 0);
        addDamage(
          skill,
          packetAt,
          {
            coefficient: shatter.coefficients[spent] / spent,
            hits: 1,
            source: "Player",
            weaponStrength: 1000,
          },
          { shatter: true, blade: true },
        );
        addCondition(skill.name, packetAt, {
          name: "Confusion",
          duration: 3,
          stacks: 1,
        });
      }
    } else if (shatter.kind === "blade-control") {
      addDamage(
        skill,
        at,
        {
          coefficient: shatter.coefficients[spent],
          hits: 1,
          source: "Player",
          weaponStrength: 1000,
        },
        { shatter: true, blade: true },
      );
    } else if (shatter.kind === "blade-requiem") {
      for (let index = 0; index < spent; index += 1) {
        addDamage(
          skill,
          at + index,
          {
            coefficient: shatter.coefficients[spent] / spent,
            hits: 1,
            source: "Player",
            weaponStrength: 1000,
          },
          { shatter: true, blade: true },
        );
        if (traits.has(TRAIT.MAIM_THE_DISILLUSIONED)) {
          addCondition(
            skill.name,
            at + index,
            { name: "Torment", duration: 6, stacks: 1 },
            "Player",
            `${skill.name} — Maim the Disillusioned`,
          );
        }
      }
      if (traits.has(TRAIT.MAIM_THE_DISILLUSIONED)) {
        addTraitProc("Maim the Disillusioned", at, skill.name);
      }
    }

    triggerShatterTraits(
      skill,
      at,
      spent,
      isBladeSong,
      { skipMaim: shatter.kind === "blade-requiem" },
    );
    if (
      skill.name === "Time Sink"
      && traits.has(TRAIT.TIME_BOMB)
      && at >= state.profession.timeBombUntil - epsilon
    ) {
      const timeBomb = traitDamage["Time Bomb"];
      state.profession.timeBombUntil = at + timeBomb.duration;
      addEvent({
        type: "buff",
        at,
        kind: "time-bomb",
        stacks: 1,
        duration: timeBomb.duration + epsilon,
        sourceSkill: skill.name,
      });
      addDamage(
        {
          name: "Time Bomb",
          weapon: "Utility",
          blade: false,
        },
        state.profession.timeBombUntil,
        {
          coefficient: timeBomb.coefficient,
          hits: timeBomb.hits,
          source: "Player",
          weapon: "utility",
        },
      );
      addTraitProc("Time Bomb", at, skill.name, "explodes after 5s");
    }
    if (
      isBladeSong
      && traits.has(TRAIT.INFINITE_FORGE)
      && spent >= 5
    ) {
      queueResources(
        at + epsilon * 2,
        2,
        activePrimaryWeapon(),
        "Infinite Forge refund",
      );
    }
    addEvent({
      type: "marker",
      at,
      name: skill.name,
      detail: `${spent} ${resourceDefinition.plural} spent`,
    });
    return true;
  };

  const handleInstrument = (skill, at) => {
    const data = instruments[skill.name];
    const spent = consumeResources(at);
    if (data.coefficient) {
      const coefficient =
        data.coefficient
        + (skill.name === "Lively Lute" && traits.has(TRAIT.SHREDDING) ? 1 : 0);
      addDamage(skill, at, {
        coefficient,
        hits: data.hits + (coefficient > data.coefficient ? 1 : 0),
        source: "Player",
      });
    }
    for (const condition of data.conditions || []) {
      addCondition(skill.name, at, condition);
    }
    const expiresAt = at + 5 + spent * 5;
    state.profession.instruments.set(data.instrument, expiresAt);
    state.profession.lastInstrument = data.instrument;
    addEvent({
      type: "mesmer.instrument",
      at: at + epsilon,
      instrument: data.instrument,
      expiresAt,
    });
    addEvent({
      type: "marker",
      at,
      name: skill.name,
      detail: `${data.instrument} playing for ${(5 + spent * 5).toFixed(0)}s`,
    });

    if (traits.has(TRAIT.ALTERED_CHORD) && spent > 0) {
      const crescendo = byName("Crescendo");
      const ready = state.cooldowns.get(crescendo?.id);
      if (ready) state.cooldowns.set(crescendo.id, Math.max(at, ready - 2));
    }
  };

  const handleCrescendo = (skill, at) => {
    const activeInstruments = [...state.profession.instruments.entries()].filter(
      ([, expiresAt]) => expiresAt > at,
    );
    addDamage(skill, at, {
      coefficient:
        skill.baseCoefficient
        * (1 + activeInstruments.length * skill.instrumentDamageIncrease),
      hits: 1,
      source: "Player",
    });

    if (traits.has(TRAIT.ALTERED_CHORD)) {
      if (state.profession.lastInstrument === "Lute") {
        addEvent({
          type: "buff",
          at: at + epsilon,
          kind: "altered-chord",
          stacks: 1,
          duration: 10,
        });
        addTraitProc("Altered Chord", at + epsilon, skill.name, "Lute");
      } else if (state.profession.lastInstrument === "Flute") {
        addCondition(
          skill.name,
          at,
          { name: "Confusion", duration: 8, stacks: 5 },
          "Player",
          "Altered Chord — Confusion",
        );
        addTraitProc("Altered Chord", at, skill.name, "Flute");
      }
    }
    if (traits.has(TRAIT.FORTISSIMO)) {
      for (let index = 1; index <= 5; index += 1) {
        queueResources(
          at + index,
          1,
          activePrimaryWeapon(),
          "Fortissimo",
        );
      }
    }
  };

  return {
    consumeResources,
    currentResource,
    handleCrescendo,
    handleInstrument,
    handleShatter,
    triggerShatterTraits,
  };
}
