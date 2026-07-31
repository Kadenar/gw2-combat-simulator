import { professionCoreState } from "../../../platform/engine/profession.js";
/**
 * Handles shared profession actions decorated by active modules.
 * Manages resource consumption, trait procs (Maim/Phantom Pain/Illusionary Membrane/etc.).
 * Returns: consumeResources, currentResource, handleCrescendo, handleInstrument, handleShatter, triggerShatterTraits.
 * @param {Object} config - Scheduler config (state, traits, resourceDefinition, etc.)
 * @returns {Object} Profession action controller
 */
import {
  MESMER_SKILL_IDS as ID,
  MESMER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import type { SchedulerState } from "../../../platform/engine/types.js";
import type {
  MesmerActivePrimaryWeapon,
  MesmerAddCondition,
  MesmerAddDamage,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerDestroyClone,
  MesmerInstrument,
  MesmerProfessionActionController,
  MesmerRuntimeState,
  MesmerQueueResources,
  MesmerResourceDefinition,
  MesmerResourceSpendDetails,
  MesmerShatter,
  MesmerShatterTraitOptions,
  MesmerSkill,
  MesmerTraitDamage,
} from "../types.js";

interface ProfessionActionControllerOptions {
  readonly state: SchedulerState<MesmerRuntimeState>;
  readonly traits: ReadonlySet<number>;
  readonly resourceDefinition: MesmerResourceDefinition;
  readonly destroyClone: MesmerDestroyClone;
  readonly epsilon: number;
  readonly shatters: Readonly<Record<number, MesmerShatter>>;
  readonly instruments: Readonly<Record<number, MesmerInstrument>>;
  readonly warnings: string[];
  readonly addEvent: MesmerAddEvent;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly addCondition: MesmerAddCondition;
  readonly addDamage: MesmerAddDamage;
  readonly activePrimaryWeapon: MesmerActivePrimaryWeapon;
  readonly queueResources: MesmerQueueResources;
  readonly byId: (id: number) => MesmerSkill | undefined;
  readonly traitDamage: Readonly<Record<string, MesmerTraitDamage>>;
}

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
  byId,
  traitDamage,
}: ProfessionActionControllerOptions): MesmerProfessionActionController {
  const numericResourceState = () => {
    const active = state.profession.specialization;
    if (active.kind !== "Virtuoso" && active.kind !== "Troubadour") {
      throw new TypeError(
        `${active.kind} does not own a numeric Mesmer resource.`,
      );
    }
    return active.state;
  };
  const chronomancerState = () => {
    const active = state.profession.specialization;
    if (active.kind !== "Chronomancer") {
      throw new TypeError(`Expected Chronomancer, received ${active.kind}.`);
    }
    return active.state;
  };
  const troubadourState = () => {
    const active = state.profession.specialization;
    if (active.kind !== "Troubadour") {
      throw new TypeError(`Expected Troubadour, received ${active.kind}.`);
    }
    return active.state;
  };
  const currentResource = () =>
    resourceDefinition.singular === "clone"
      ? professionCoreState(state).clones.length
      : numericResourceState().numericResource;

  const addResourceSpendEvent = (
    at: number,
    spent: number,
    { sourceSkill = "", rotationIndex = null }: MesmerResourceSpendDetails = {},
  ): number => {
    addEvent({
      type: "resource",
      at,
      amount: -spent,
      value: currentResource(),
      resource: resourceDefinition.plural,
      reason: "profession mechanic",
      ...(sourceSkill ? { sourceSkill } : {}),
      ...(Number.isInteger(rotationIndex) ? { rotationIndex } : {}),
    });
    return spent;
  };

  const consumeResources = (
    at: number,
    { sourceSkill = "", rotationIndex = null }: MesmerResourceSpendDetails = {},
  ): number => {
    const spent = currentResource();
    if (resourceDefinition.singular === "clone") {
      for (const clone of professionCoreState(state).clones) {
        destroyClone(clone, at);
      }
      professionCoreState(state).clones = [];
    } else {
      numericResourceState().numericResource = 0;
    }
    return addResourceSpendEvent(at, spent, { sourceSkill, rotationIndex });
  };

  const reserveResources = (): number => {
    const spent = currentResource();
    if (resourceDefinition.singular === "clone") {
      throw new Error("Clone resources cannot be reserved.");
    }
    numericResourceState().numericResource = 0;
    return spent;
  };

  const commitReservedResources = (
    at: number,
    reserved: number,
    { sourceSkill = "", rotationIndex = null }: MesmerResourceSpendDetails = {},
  ): number => {
    const reservedCount = Math.min(
      resourceDefinition.maximum,
      Math.max(0, Number(reserved || 0)),
    );
    const additionalSpent = Math.min(
      numericResourceState().numericResource,
      resourceDefinition.maximum - reservedCount,
    );
    numericResourceState().numericResource -= additionalSpent;
    return addResourceSpendEvent(at, reservedCount + additionalSpent, {
      sourceSkill,
      rotationIndex,
    });
  };

  const restoreReservedResources = (spent: number): void => {
    if (resourceDefinition.singular === "clone") return;
    numericResourceState().numericResource = Math.min(
      resourceDefinition.maximum,
      numericResourceState().numericResource + Math.max(
        0,
        Number(spent || 0),
      ),
    );
  };

  const triggerShatterTraits = (
    skill: MesmerSkill,
    at: number,
    spent: number,
    bladeSong = false,
    { skipMaim = false }: MesmerShatterTraitOptions = {},
  ): void => {
    const shatter = shatters[skill.id];
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
      resourceDefinition.singular === "clone" &&
      spent === 3 &&
      traits.has(TRAIT.ILLUSIONARY_REVERSION)
    ) {
      queueResources(
        at + epsilon,
        1,
        activePrimaryWeapon(),
        "Illusionary Reversion",
        {
          traitId: TRAIT.ILLUSIONARY_REVERSION,
          traitName: "Illusionary Reversion",
        },
      );
    }
  };

  const handleShatter = (
    skill: MesmerSkill,
    at: number,
    resourcesSpent: number | null = null,
  ): boolean => {
    const shatter = shatters[skill.id];
    if (!shatter) {
      throw new Error(`Missing Mesmer shatter data for ${skill.name}.`);
    }
    const isBladeSong = shatter.kind.startsWith("blade");
    let maimTriggered = false;
    const addMaimOnHit = (hitAt: number) => {
      if (!traits.has(TRAIT.MAIM_THE_DISILLUSIONED)) return;
      addCondition(
        skill.name,
        hitAt,
        { name: "Torment", duration: 6, stacks: 1 },
        "Player",
        `${skill.name} — Maim the Disillusioned`,
      );
      maimTriggered = true;
    };
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
          weaponStrengthProfileId: "nonweapon.profession-mechanic",
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
          weaponStrengthProfileId: "nonweapon.profession-mechanic",
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
          weaponStrengthProfileId: "nonweapon.profession-mechanic",
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
          weaponStrengthProfileId: "nonweapon.profession-mechanic",
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
    } else if (shatter.kind === "blade-power") {
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
            weaponStrengthProfileId: "nonweapon.profession-mechanic",
          },
          { shatter: true, blade: true },
        );
        addMaimOnHit(packetAt);
      }
    } else if (shatter.kind === "blade-confusion") {
      const packetDelays = shatter.packetDelays || [];
      const hasCryOfPain = traits.has(TRAIT.CRY_OF_PAIN);
      for (let index = 0; index < spent; index += 1) {
        const packetAt = at + Number(packetDelays[index] || 0);
        addDamage(
          skill,
          packetAt,
          {
            coefficient: shatter.coefficients[spent] / spent,
            hits: 1,
            source: "Player",
            weaponStrengthProfileId: "nonweapon.profession-mechanic",
          },
          { shatter: true, blade: true },
        );
        addCondition(skill.name, packetAt, {
          name: "Confusion",
          duration: hasCryOfPain ? 4 : 3,
          stacks: hasCryOfPain ? 2 : 1,
        });
        addMaimOnHit(packetAt);
      }
    } else if (shatter.kind === "blade-control") {
      addDamage(
        skill,
        at,
        {
          coefficient: shatter.coefficients[spent],
          hits: 1,
          source: "Player",
          weaponStrengthProfileId: "nonweapon.profession-mechanic",
        },
        { shatter: true, blade: true },
      );
      addMaimOnHit(at);
    } else if (shatter.kind === "blade-requiem") {
      const packetDelays = shatter.packetDelays || [];
      for (let index = 0; index < spent; index += 1) {
        const packetAt = at + Number(packetDelays[index] ?? index + 1);
        addDamage(
          skill,
          packetAt,
          {
            coefficient: shatter.coefficients[spent] / spent,
            hits: 1,
            source: "Player",
            weaponStrengthProfileId: "nonweapon.profession-mechanic",
          },
          { shatter: true, blade: true },
        );
        addMaimOnHit(packetAt);
      }
    }

    if (maimTriggered) {
      addTraitProc("Maim the Disillusioned", at, skill.name);
    }
    triggerShatterTraits(skill, at, spent, isBladeSong, {
      skipMaim: maimTriggered,
    });
    if (
      skill.id === ID.TIME_SINK &&
      traits.has(TRAIT.TIME_BOMB) &&
      at >= chronomancerState().timeBombUntil - epsilon
    ) {
      const timeBomb = traitDamage["Time Bomb"];
      const duration = Number(timeBomb.duration || 0);
      chronomancerState().timeBombUntil = at + duration;
      addEvent({
        type: "buff",
        at,
        kind: "time-bomb",
        stacks: 1,
        duration: duration + epsilon,
        sourceSkill: skill.name,
      });
      addDamage(
        {
          id: "Time Bomb",
          name: "Time Bomb",
          weapon: "Utility",
          blade: false,
        },
        chronomancerState().timeBombUntil,
        {
          coefficient: timeBomb.coefficient,
          hits: timeBomb.hits,
          source: "Player",
          weapon: "utility",
        },
      );
      addTraitProc("Time Bomb", at, skill.name, "explodes after 5s");
    }
    if (isBladeSong && traits.has(TRAIT.INFINITE_FORGE) && spent >= 5) {
      queueResources(
        at + epsilon * 2,
        2,
        activePrimaryWeapon(),
        "Infinite Forge refund",
        {
          traitId: TRAIT.INFINITE_FORGE,
          traitName: "Infinite Forge",
        },
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

  const handleInstrument = (skill: MesmerSkill, at: number): void => {
    const data = instruments[skill.id];
    if (!data) {
      throw new Error(`Missing Mesmer instrument data for ${skill.name}.`);
    }
    const spent = consumeResources(at);
    if (data.coefficient) {
      const coefficient =
        data.coefficient +
        (data.instrument === "Lute" && traits.has(TRAIT.SHREDDING) ? 1 : 0);
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
    troubadourState().instruments[data.instrument] = expiresAt;
    troubadourState().lastInstrument = data.instrument;
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
      const crescendo = byId(ID.CRESCENDO);
      const ready = crescendo ? state.cooldowns.get(crescendo.id) : undefined;
      if (crescendo && ready) {
        state.cooldowns.set(crescendo.id, Math.max(at, ready - 2));
      }
    }
  };

  const handleCrescendo = (skill: MesmerSkill, at: number): void => {
    const activeInstruments = Object.entries(
      troubadourState().instruments,
    ).filter(([, expiresAt]) => expiresAt > at);
    addDamage(skill, at, {
      coefficient:
        Number(skill.baseCoefficient || 0) *
        (1 +
          activeInstruments.length *
            Number(skill.instrumentDamageIncrease || 0)),
      hits: 1,
      source: "Player",
    });

    if (traits.has(TRAIT.ALTERED_CHORD)) {
      if (troubadourState().lastInstrument === "Lute") {
        addEvent({
          type: "buff",
          at: at + epsilon,
          kind: "altered-chord",
          stacks: 1,
          duration: 10,
        });
        addTraitProc("Altered Chord", at + epsilon, skill.name, "Lute");
      } else if (troubadourState().lastInstrument === "Flute") {
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
        queueResources(at + index, 1, activePrimaryWeapon(), "Fortissimo", {
          traitId: TRAIT.FORTISSIMO,
          traitName: "Fortissimo",
        });
      }
    }
  };

  return {
    commitReservedResources,
    consumeResources,
    currentResource,
    handleCrescendo,
    handleInstrument,
    handleShatter,
    reserveResources,
    restoreReservedResources,
    triggerShatterTraits,
  };
}
