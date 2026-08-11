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
  const partyBoonRecipients = () => ({
    recipients: "party" as const,
    maximumRecipients: 5,
    companionIds: professionCoreState(state).clones.map(
      (clone) => `mesmer.clone:${clone.id}`,
    ),
  });

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
      numericResourceState().numericResource + Math.max(0, Number(spent || 0)),
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
    castStart = at,
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
    const bladePacketTicks = (fallback: (index: number) => number) =>
      Array.from({ length: spent }, (_, index) => ({
        atMs: Number(shatter.ticks?.[index]?.atMs ?? fallback(index)),
        coefficient: shatter.coefficients[spent] / spent,
      }));
    const addBladeDamage = (
      ticks: readonly { readonly atMs: number; readonly coefficient: number }[],
    ) =>
      addDamage(
        skill,
        at,
        {
          ticks,
          timingAnchor: "castStart",
          timingScale: "fixed",
          source: "Player",
          weaponStrengthProfileId: "nonweapon.profession-mechanic",
        },
        { shatter: true, blade: true },
      );

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
      if (traits.has(TRAIT.BLINDING_DISSIPATION)) {
        addEvent({
          type: "blind",
          at,
          skillName: skill.name,
          count: sources,
        });
        addTraitProc("Blinding Dissipation", at, skill.name);
      }
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
      const ticks = bladePacketTicks(() => 0);
      addBladeDamage(ticks);
      for (const tick of ticks) addMaimOnHit(at + tick.atMs / 1000);
    } else if (shatter.kind === "blade-confusion") {
      const hasCryOfPain = traits.has(TRAIT.CRY_OF_PAIN);
      const duration = hasCryOfPain ? 4 : 3;
      const stacks = hasCryOfPain ? 2 : 1;
      const ticks = bladePacketTicks(() => 0);
      addBladeDamage(ticks);
      addCondition(skill.name, at, {
        name: "Confusion",
        duration,
        ticks: ticks.map((tick) => ({
          atMs: tick.atMs,
          condition: "Confusion",
          duration,
          stacks,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
      });
      for (const tick of ticks) addMaimOnHit(at + tick.atMs / 1000);
    } else if (shatter.kind === "blade-control") {
      const damageAt =
        shatter.damageAtMs == null
          ? at
          : castStart + Number(shatter.damageAtMs) / 1000;
      addDamage(
        skill,
        damageAt,
        {
          coefficient: shatter.coefficients[spent],
          hits: 1,
          source: "Player",
          weaponStrengthProfileId: "nonweapon.profession-mechanic",
        },
        { shatter: true, blade: true },
      );
      addMaimOnHit(damageAt);
    } else if (shatter.kind === "blade-requiem") {
      const ticks = bladePacketTicks((index) => (index + 1) * 1000);
      addBladeDamage(ticks);
      for (const tick of ticks) addMaimOnHit(at + tick.atMs / 1000);
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

  const instrumentAttack = (
    skill: MesmerSkill,
    data: MesmerInstrument,
    damageAt: number,
    source = "Player",
    actorType: "player" | "summon" = "player",
  ): void => {
    if (data.coefficient) {
      const coefficient =
        data.coefficient +
        (data.instrument === "Lute" && traits.has(TRAIT.SHREDDING) ? 1 : 0);
      addDamage(
        skill,
        damageAt,
        {
          coefficient,
          hits: data.hits + (coefficient > data.coefficient ? 1 : 0),
          intervalMs: data.intervalMs,
          source,
          actorType,
          weaponStrengthProfileId: "nonweapon.profession-mechanic",
        },
        { source, sourceId: skill.id, skillId: skill.id, actorType },
      );
    }
    for (const condition of data.conditions || []) {
      addCondition(skill.name, damageAt, condition, source, "", {
        source,
        sourceId: skill.id,
        skillId: skill.id,
        actorType,
      });
    }
    if (data.instrument === "Flute" && traits.has(TRAIT.MAYHEM)) {
      addCondition(
        skill.name,
        damageAt,
        { name: "Torment", duration: 5, stacks: 4 },
        source,
        "Mayhem — Torment",
        { source, sourceId: TRAIT.MAYHEM, skillId: skill.id, actorType },
      );
    }
    if (data.instrument === "Flute" || data.instrument === "Drum") {
      addEvent({
        type: "control",
        at: damageAt,
        skillId: skill.id,
        skillName: skill.name,
        source,
        sourceId: skill.id,
        actorType,
      });
    }
    if (data.instrument === "Drum" && traits.has(TRAIT.SYNCOPATE)) {
      const delayedAt = damageAt + 3;
      const delayedWave = traitDamage.SyncopateDelayedWave;
      addDamage(
        {
          id: "Syncopate delayed wave",
          name: "Syncopate",
          weapon: "Utility",
          blade: false,
        },
        delayedAt,
        {
          coefficient: delayedWave.coefficient,
          hits: delayedWave.hits,
          source,
          actorType,
          weaponStrengthProfileId: "nonweapon.unequipped",
        },
        {
          source,
          sourceId: TRAIT.SYNCOPATE,
          skillId: skill.id,
          actorType,
          name: "Syncopate — delayed wave",
        },
      );
      addEvent({
        type: "control",
        at: delayedAt,
        skillId: skill.id,
        skillName: "Syncopate — delayed wave",
        controlKind: "daze",
        source,
        sourceId: TRAIT.SYNCOPATE,
        actorType,
      });
      addTraitProc("Syncopate", delayedAt, skill.name, "delayed drum wave");
    }
    if (traits.has(TRAIT.LIFE_OF_THE_PARTY) && data.instrument === "Lute") {
      addEvent({
        type: "buff",
        at: damageAt,
        kind: "quickness",
        stacks: 1,
        duration: 6,
        skillName: skill.name,
        sourceSkill: skill.name,
        ...partyBoonRecipients(),
      });
      addEvent({
        type: "buff",
        at: damageAt,
        kind: "might",
        stacks: 5,
        duration: 8,
        skillName: skill.name,
        sourceSkill: skill.name,
        ...partyBoonRecipients(),
      });
    }
  };

  const handleInstrument = (
    skill: MesmerSkill,
    at: number,
    castStart = at,
    spendDetails: MesmerResourceSpendDetails = {},
  ): void => {
    const data = instruments[skill.id];
    if (!data) {
      throw new Error(`Missing Mesmer instrument data for ${skill.name}.`);
    }
    const spent = consumeResources(at, spendDetails);
    const damageAt = castStart + Number(data.damageAtMs || 0) / 1000;
    instrumentAttack(skill, data, damageAt);
    const expiresAt = at + 5 + spent * 5;
    troubadourState().instruments[data.instrument] = expiresAt;
    troubadourState().lastInstrument = data.instrument;
    addEvent({
      type: "mesmer.instrument",
      at: at + epsilon,
      instrument: data.instrument,
      expiresAt,
    });

    if (data.instrument === "Harp") {
      addEvent({
        type: "buff",
        at: castStart,
        kind: "distortion",
        stacks: 1,
        duration: 2,
        sourceSkill: skill.name,
      });
    }

    if (traits.has(TRAIT.CALL_AND_RESPONSE) && spent === 3) {
      const afterimageAt = at + 1.5;
      instrumentAttack(skill, data, afterimageAt, "Afterimage", "summon");
      addTraitProc("Call and Response", afterimageAt, skill.name);
    }
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

  const handleCrescendo = (
    skill: MesmerSkill,
    at: number,
    castStart = at,
  ): void => {
    const damageAt = castStart + Number(skill.damageAtMs || 0) / 1000;
    const activeInstruments = Object.entries(
      troubadourState().instruments,
    ).filter(([, expiresAt]) => expiresAt > damageAt);
    addDamage(skill, damageAt, {
      coefficient:
        Number(skill.baseCoefficient || 0) *
        (1 +
          activeInstruments.length *
            Number(skill.instrumentDamageIncrease || 0)),
      hits: 1,
      source: "Player",
      weaponStrengthProfileId: "nonweapon.profession-mechanic",
    });

    if (traits.has(TRAIT.LIFE_OF_THE_PARTY)) {
      for (const [kind, stacks, duration] of [
        ["quickness", 1, 8],
        ["might", 8, 15],
        ["fury", 1, 8],
      ] as const) {
        addEvent({
          type: "buff",
          at: damageAt,
          kind,
          stacks,
          duration,
          skillName: skill.name,
          sourceSkill: skill.name,
          ...partyBoonRecipients(),
        });
      }
    }

    if (traits.has(TRAIT.ALTERED_CHORD)) {
      if (troubadourState().lastInstrument === "Lute") {
        addEvent({
          type: "buff",
          at: damageAt + epsilon,
          kind: "altered-chord",
          stacks: 1,
          duration: 10,
        });
        addTraitProc("Altered Chord", damageAt + epsilon, skill.name, "Lute");
      } else if (troubadourState().lastInstrument === "Flute") {
        addCondition(
          skill.name,
          damageAt,
          { name: "Confusion", duration: 8, stacks: 5 },
          "Player",
          "Altered Chord — Confusion",
        );
        addTraitProc("Altered Chord", damageAt, skill.name, "Flute");
      } else if (troubadourState().lastInstrument === "Drum") {
        addEvent({
          type: "control",
          at: damageAt,
          skillId: skill.id,
          skillName: skill.name,
          source: "Player",
          sourceId: TRAIT.ALTERED_CHORD,
          actorType: "player",
        });
        addTraitProc("Altered Chord", damageAt, skill.name, "Drum");
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

  const handleTale = (skill: MesmerSkill, at: number, castStart = at): void => {
    const taleBoons = new Map<
      number,
      readonly {
        readonly kind: string;
        readonly duration: number;
        readonly stacks: number;
      }[]
    >([
      [
        ID.TALE_OF_THE_HONORABLE_ROGUE,
        [{ kind: "aegis", duration: 4, stacks: 1 }],
      ],
      [
        ID.TALE_OF_THE_SOULKEEPER,
        [
          { kind: "might", duration: 15, stacks: 10 },
          { kind: "fury", duration: 10, stacks: 1 },
          { kind: "quickness", duration: 4, stacks: 1 },
        ],
      ],
      [
        ID.TALE_OF_THE_VALIANT_MARSHAL,
        [
          { kind: "stability", duration: 4, stacks: 5 },
          { kind: "resistance", duration: 3, stacks: 1 },
        ],
      ],
    ]);
    for (const boon of taleBoons.get(skill.id) || []) {
      addEvent({
        type: "buff",
        at,
        kind: boon.kind,
        stacks: boon.stacks,
        duration: boon.duration,
        skillName: skill.name,
        sourceSkill: skill.name,
        ...partyBoonRecipients(),
      });
    }
    const requiredInstrument = new Map<number, string>([
      [ID.TALE_OF_THE_SOULKEEPER, "Lute"],
      [ID.TALE_OF_THE_HONORABLE_ROGUE, "Drum"],
      [ID.TALE_OF_THE_VALIANT_MARSHAL, "Harp"],
      [ID.TALE_OF_THE_TORTURED_MASTERMIND, "Flute"],
    ]).get(skill.id);
    if (
      requiredInstrument &&
      Number(troubadourState().instruments[requiredInstrument] || 0) > castStart
    ) {
      const count = skill.id === ID.TALE_OF_THE_SOULKEEPER ? 2 : 1;
      queueResources(at + epsilon, count, activePrimaryWeapon(), skill.name);
    }
    if (skill.id === ID.TALE_OF_THE_HONORABLE_ROGUE) {
      addEvent({
        type: "marker",
        at,
        name: skill.name,
        detail: "50 endurance restored",
      });
    }
    if (traits.has(TRAIT.RACONTEUR)) {
      addEvent({
        type: "buff",
        at,
        kind: "protection",
        stacks: 1,
        duration: 3,
        skillName: skill.name,
        sourceSkill: skill.name,
        ...partyBoonRecipients(),
      });
      addTraitProc("Raconteur", at, skill.name);
    }
  };

  return {
    commitReservedResources,
    consumeResources,
    currentResource,
    handleCrescendo,
    handleInstrument,
    handleTale,
    handleShatter,
    reserveResources,
    restoreReservedResources,
    triggerShatterTraits,
  };
}
