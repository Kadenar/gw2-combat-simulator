import { professionCoreState } from '../../../platform/engine/profession.js';
/**
 * Handles shared profession actions decorated by active modules.
 * Manages resource consumption, trait procs (Maim/Phantom Pain/Illusionary Membrane/etc.).
 * Returns: consumeResources, currentResource, handleShatter, triggerShatterTraits.
 * @param {Object} config - Scheduler config (state, traits, resourceDefinition, etc.)
 * @returns {Object} Profession action controller
 */
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import type { SchedulerState, SkillEffect } from '../../../platform/engine/types.js';
import type {
  MesmerActivePrimaryWeapon,
  MesmerAddCondition,
  MesmerAddDamage,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerDestroyClone,
  MesmerProfessionActionController,
  MesmerRuntimeState,
  MesmerQueueResources,
  MesmerResourceDefinition,
  MesmerRuntime,
  MesmerResourceSpendDetails,
  MesmerShatter,
  MesmerShatterResolution,
  MesmerShatterTraitOptions,
  MesmerSkill
} from '../types.js';

interface ProfessionActionControllerOptions {
  readonly state: SchedulerState<MesmerRuntimeState>;
  readonly traits: ReadonlySet<number>;
  readonly resourceDefinition: MesmerResourceDefinition;
  readonly destroyClone: MesmerDestroyClone;
  readonly epsilon: number;
  readonly shatters: Readonly<Record<number, MesmerShatter>>;
  readonly warnings: string[];
  readonly addEvent: MesmerAddEvent;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly addCondition: MesmerAddCondition;
  readonly addDamage: MesmerAddDamage;
  readonly activePrimaryWeapon: MesmerActivePrimaryWeapon;
  readonly queueResources: MesmerQueueResources;
  readonly balanceProfile: MesmerRuntime['balanceProfile'];
  readonly boonDuration: (sourceId: number, sourceName: string, effect: SkillEffect, baseDuration: number) => number;
}

export function createProfessionActionController({
  state,
  traits,
  resourceDefinition,
  destroyClone,
  epsilon,
  shatters,
  warnings,
  addEvent,
  addTraitProc,
  addCondition,
  addDamage,
  activePrimaryWeapon,
  queueResources,
  balanceProfile,
  boonDuration
}: ProfessionActionControllerOptions): MesmerProfessionActionController {
  const profileValue = (id: number | string, field: string, fallback: number) => {
    const value = balanceProfile(id)?.[field];
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  };

  const profileEffect = (id: number | string, type: string, index = 0) =>
    balanceProfile(id)?.effects?.filter((effect) => effect.type === type)[index];
  const conditionFromProfile = (id: number | string, fallback: { name: string; duration: number; stacks: number }) => {
    const effect = profileEffect(id, 'condition');
    return {
      name: String(effect?.condition || fallback.name),
      duration: Number(effect?.duration ?? fallback.duration),
      stacks: Number(effect?.stacks ?? fallback.stacks)
    };
  };

  // Typed accessors — throw if the active specialization doesn't own this state shape.
  const numericResourceState = () => {
    const active = state.profession.specialization;
    if (active.kind !== 'Virtuoso' && active.kind !== 'Troubadour') {
      throw new TypeError(`${active.kind} does not own a numeric Mesmer resource.`);
    }

    return active.state;
  };

  // Clone-based specs (core/Chronomancer) count live clones; numeric specs (Virtuoso/Troubadour) use a counter.
  const currentResource = () =>
    resourceDefinition.singular === 'clone'
      ? professionCoreState(state).clones.length
      : numericResourceState().numericResource;
  // Clone companion IDs are passed so the boon engine can apply buffs to each clone actor as well.
  const partyBoonRecipients = (maximumRecipients = 5) => ({
    recipients: 'party' as const,
    maximumRecipients,
    companionIds: professionCoreState(state).clones.map((clone) => `mesmer.clone:${clone.id}`)
  });

  const addResourceSpendEvent = (
    at: number,
    spent: number,
    { sourceSkill = '', rotationIndex = null }: MesmerResourceSpendDetails = {}
  ): number => {
    addEvent({
      type: 'resource',
      at,
      amount: -spent,
      value: currentResource(),
      resource: resourceDefinition.plural,
      reason: 'profession mechanic',
      ...(sourceSkill ? { sourceSkill } : {}),
      ...(Number.isInteger(rotationIndex) ? { rotationIndex } : {})
    });
    return spent;
  };

  // Clone path calls destroyClone per clone so the engine can emit death events; numeric path zeroes the counter.
  const consumeResources = (
    at: number,
    { sourceSkill = '', rotationIndex = null }: MesmerResourceSpendDetails = {}
  ): number => {
    const spent = currentResource();
    if (resourceDefinition.singular === 'clone') {
      for (const clone of professionCoreState(state).clones) {
        destroyClone(clone, at);
      }

      professionCoreState(state).clones = [];
    } else {
      numericResourceState().numericResource = 0;
    }

    return addResourceSpendEvent(at, spent, { sourceSkill, rotationIndex });
  };

  // Reserve/commit/restore supports skills that must read the count before the cast resolves damage
  // (e.g. a Virtuoso skill whose coefficient scales with blades but costs all blades on hit, not on cast).
  const reserveResources = (): number => {
    const spent = currentResource();
    if (resourceDefinition.singular === 'clone') {
      throw new Error('Clone resources cannot be reserved.');
    }

    numericResourceState().numericResource = 0;
    return spent;
  };

  // Any blades gained between reserveResources and hit time are consumed here too, up to the cap.
  const commitReservedResources = (
    at: number,
    reserved: number,
    { sourceSkill = '', rotationIndex = null }: MesmerResourceSpendDetails = {}
  ): number => {
    const reservedCount = Math.min(resourceDefinition.maximum, Math.max(0, Number(reserved || 0)));
    const additionalSpent = Math.min(
      numericResourceState().numericResource,
      resourceDefinition.maximum - reservedCount
    );
    numericResourceState().numericResource -= additionalSpent;
    return addResourceSpendEvent(at, reservedCount + additionalSpent, {
      sourceSkill,
      rotationIndex
    });
  };

  const restoreReservedResources = (spent: number): void => {
    if (resourceDefinition.singular === 'clone') return;
    numericResourceState().numericResource = Math.min(
      resourceDefinition.maximum,
      numericResourceState().numericResource + Math.max(0, Number(spent || 0))
    );
  };

  // Called after every shatter. bladeSong=true caps Maim/Phantom Pain sources to 1 (Virtuoso shatter hits once per blade, not once per source).
  const triggerShatterTraits = (
    skill: MesmerSkill,
    at: number,
    spent: number,
    bladeSong = false,
    { skipMaim = false }: MesmerShatterTraitOptions = {}
  ): void => {
    const shatter = shatters[skill.id];
    // Core/Chrono shatters hit (spent + 1) times (player + each clone); blade shatters hit once per blade tick.
    const sources = bladeSong ? 1 : spent + 1;
    if (!skipMaim && traits.has(TRAIT.MAIM_THE_DISILLUSIONED)) {
      const maim = conditionFromProfile(TRAIT.MAIM_THE_DISILLUSIONED, {
        name: 'Torment',
        duration: 6,
        stacks: 1
      });
      addCondition(
        skill.name,
        at,
        { ...maim, stacks: maim.stacks * sources },
        'Player',
        `${skill.name} — Maim the Disillusioned`
      );
      addTraitProc('Maim the Disillusioned', at, skill.name);
    }

    if (traits.has(TRAIT.PHANTOM_PAIN)) {
      addEvent({
        type: 'buff',
        at: at + epsilon,
        kind: 'phantom-pain',
        stacks: Math.min(profileValue(TRAIT.PHANTOM_PAIN, 'maximumStacks', 4), spent + 1),
        duration: profileValue(TRAIT.PHANTOM_PAIN, 'durationMultiplier', 10)
      });
      addTraitProc('Phantom Pain', at + epsilon, skill.name);
    }

    // Illusionary Membrane only procs on the F2 shatter (slot 2).
    if (shatter?.slot === 2 && traits.has(TRAIT.ILLUSIONARY_MEMBRANE)) {
      const effect = profileEffect(TRAIT.ILLUSIONARY_MEMBRANE, 'buff');
      addEvent({
        type: 'buff',
        at: at + epsilon,
        kind: 'illusionary-membrane',
        stacks: Number(effect?.stacks || 1),
        duration: Number(effect?.duration || 15)
      });
      addTraitProc('Illusionary Membrane', at + epsilon, skill.name);
    }

    // Deadly Blades only procs on Virtuoso blade songs, not core/chrono shatters.
    if (bladeSong && traits.has(TRAIT.DEADLY_BLADES)) {
      addEvent({
        type: 'buff',
        at: at + epsilon,
        kind: 'deadly-blades',
        stacks: 1,
        duration: profileValue(TRAIT.DEADLY_BLADES, 'durationMultiplier', 7)
      });
      addTraitProc('Deadly Blades', at + epsilon, skill.name);
    }

    // Stretched Time (alacrity) and Seize the Moment (quickness) both scale duration by (spent + 1) tiers.
    const triggerShatterBoon = (traitId: number, traitName: string, fallbackBoon: 'alacrity' | 'quickness'): void => {
      if (!traits.has(traitId)) return;
      const effect = profileEffect(traitId, 'boon') || {
        type: 'boon',
        boon: fallbackBoon,
        duration: 3,
        stacks: 1,
        recipients: 'party',
        maximumRecipients: 5
      };
      const kind = String(effect.boon || fallbackBoon);
      const baseDuration = Number(effect.duration ?? 3) + (spent + 1) * profileValue(traitId, 'durationPerTier', 1);
      const duration = boonDuration(traitId, traitName, effect, baseDuration);
      addEvent({
        type: 'buff',
        at,
        kind,
        stacks: Number(effect.stacks ?? 1),
        duration,
        skillName: skill.name,
        sourceSkill: skill.name,
        ...partyBoonRecipients(Number(effect.maximumRecipients ?? 5))
      });
      addTraitProc(traitName, at, skill.name, `${duration}s ${kind}`);
    };

    triggerShatterBoon(TRAIT.STRETCHED_TIME, 'Stretched Time', 'alacrity');
    triggerShatterBoon(TRAIT.SEIZE_THE_MOMENT, 'Seize the Moment', 'quickness');
  };

  // Returns false (and warns) when a blade song is attempted with no blades.
  // resourcesSpent=null means consume resources now; a pre-computed value skips the consume (used by Chrono well interactions).
  const handleShatter = (
    skill: MesmerSkill,
    at: number,
    resourcesSpent: number | null = null,
    castStart = at
  ): MesmerShatterResolution | null => {
    const shatter = shatters[skill.id];
    if (!shatter) {
      throw new Error(`Missing Mesmer shatter data for ${skill.name}.`);
    }

    const isBladeSong = shatter.kind.startsWith('blade');
    // Maim is tracked separately for blade shatters: each blade tick can trigger it independently,
    // so we defer addTraitProc until after all ticks are processed to avoid duplicate proc entries.
    let maimTriggered = false;
    const addMaimOnHit = (hitAt: number) => {
      if (!traits.has(TRAIT.MAIM_THE_DISILLUSIONED)) return;
      const maim = conditionFromProfile(TRAIT.MAIM_THE_DISILLUSIONED, {
        name: 'Torment',
        duration: 6,
        stacks: 1
      });
      addCondition(skill.name, hitAt, maim, 'Player', `${skill.name} — Maim the Disillusioned`);
      maimTriggered = true;
    };

    if (isBladeSong && resourcesSpent == null && currentResource() < 1) {
      warnings.push(`${skill.name} skipped at ${at.toFixed(2)}s: no blades.`);
      return null;
    }

    const spent = resourcesSpent ?? consumeResources(at);
    const sources = spent + 1;
    // Each blade fires a separate damage tick; coefficient is split evenly across all blades.
    const bladePacketTicks = (fallback: (index: number) => number) =>
      Array.from({ length: spent }, (_, index) => ({
        atMs: Number(shatter.ticks?.[index]?.atMs ?? fallback(index)),
        coefficient: shatter.coefficients[spent] / spent
      }));
    const addBladeDamage = (ticks: readonly { readonly atMs: number; readonly coefficient: number }[]) =>
      addDamage(
        skill,
        at,
        {
          ticks,
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          source: 'Player',
          weaponStrengthProfileId: 'nonweapon.profession-mechanic'
        },
        { shatter: true, blade: true }
      );

    if (shatter.kind === 'core-power') {
      addDamage(
        skill,
        at,
        {
          coefficient: shatter.coefficients[spent],
          hits: sources,
          source: 'Player',
          weaponStrengthProfileId: 'nonweapon.profession-mechanic'
        },
        { shatter: true }
      );
    } else if (shatter.kind === 'core-confusion') {
      addDamage(
        skill,
        at,
        {
          coefficient: shatter.coefficients[spent],
          hits: sources,
          source: 'Player',
          weaponStrengthProfileId: 'nonweapon.profession-mechanic'
        },
        { shatter: true }
      );

      const baseConfusion = conditionFromProfile(shatter.balanceProfileId || skill.id, {
        name: 'Confusion',
        duration: 3,
        stacks: 1
      });

      const confusion = traits.has(TRAIT.CRY_OF_PAIN)
        ? conditionFromProfile(TRAIT.CRY_OF_PAIN, baseConfusion)
        : baseConfusion;
      addCondition(skill.name, at, {
        ...confusion,
        stacks: sources * confusion.stacks
      });

      if (traits.has(TRAIT.BLINDING_DISSIPATION)) {
        addEvent({
          type: 'blind',
          at,
          skillName: skill.name,
          count: sources
        });
        addTraitProc('Blinding Dissipation', at, skill.name);
      }
    } else if (shatter.kind === 'defense') {
      // Distortion deals no damage, but its clones still land a 0-coefficient
      // strike that registers a hit for on-hit effects such as Relic of
      // Fireworks.
      addDamage(
        skill,
        at,
        {
          coefficient: shatter.coefficients[spent],
          hits: sources,
          source: 'Player',
          weaponStrengthProfileId: 'nonweapon.profession-mechanic'
        },
        { shatter: true }
      );
    } else if (shatter.kind === 'chrono-power') {
      // Chrono shatters hit twice per source (once from player/clone, once from phantasm echo).
      addDamage(
        skill,
        at,
        {
          coefficient: shatter.coefficients[spent],
          hits: sources * 2,
          source: 'Player',
          weaponStrengthProfileId: 'nonweapon.profession-mechanic'
        },
        { shatter: true }
      );
    } else if (shatter.kind === 'chrono-confusion') {
      addDamage(
        skill,
        at,
        {
          coefficient: shatter.coefficients[spent],
          hits: sources,
          source: 'Player',
          weaponStrengthProfileId: 'nonweapon.profession-mechanic'
        },
        { shatter: true }
      );
      const baseConfusion = conditionFromProfile(shatter.balanceProfileId || skill.id, {
        name: 'Confusion',
        duration: 3,
        stacks: 1
      });
      const confusion = traits.has(TRAIT.CRY_OF_PAIN)
        ? conditionFromProfile(TRAIT.CRY_OF_PAIN, baseConfusion)
        : baseConfusion;
      addCondition(skill.name, at, {
        ...confusion,
        stacks: sources * confusion.stacks
      });
      if (traits.has(TRAIT.BLINDING_DISSIPATION)) {
        addEvent({
          type: 'blind',
          at,
          skillName: skill.name,
          count: sources
        });
        addTraitProc('Blinding Dissipation', at, skill.name);
      }
    } else if (shatter.kind === 'blade-power') {
      const ticks = bladePacketTicks(() => 0);
      addBladeDamage(ticks);
      for (const tick of ticks) addMaimOnHit(at + tick.atMs / 1000);
    } else if (shatter.kind === 'blade-confusion') {
      const baseConfusion = conditionFromProfile(shatter.balanceProfileId || skill.id, {
        name: 'Confusion',
        duration: 3,
        stacks: 1
      });
      const confusion = traits.has(TRAIT.CRY_OF_PAIN)
        ? conditionFromProfile(TRAIT.CRY_OF_PAIN, baseConfusion)
        : baseConfusion;
      const duration = confusion.duration;
      const stacks = confusion.stacks;
      const ticks = bladePacketTicks(() => 0);
      addBladeDamage(ticks);
      addCondition(skill.name, at, {
        name: 'Confusion',
        duration,
        ticks: ticks.map((tick) => ({
          atMs: tick.atMs,
          condition: 'Confusion',
          duration,
          stacks
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      });
      for (const tick of ticks) addMaimOnHit(at + tick.atMs / 1000);
    } else if (shatter.kind === 'blade-control') {
      // blade-control has a single hit with a fixed offset from castStart rather than per-blade ticks.
      const damageAt = shatter.damageAtMs == null ? at : castStart + Number(shatter.damageAtMs) / 1000;
      addDamage(
        skill,
        damageAt,
        {
          coefficient: shatter.coefficients[spent],
          hits: 1,
          source: 'Player',
          weaponStrengthProfileId: 'nonweapon.profession-mechanic'
        },
        { shatter: true, blade: true }
      );
      addMaimOnHit(damageAt);
    } else if (shatter.kind === 'blade-requiem') {
      // Blade Requiem fires each blade 1 second apart (fallback atMs = blade index * 1000ms).
      const ticks = bladePacketTicks((index) => (index + 1) * 1000);
      addBladeDamage(ticks);
      for (const tick of ticks) addMaimOnHit(at + tick.atMs / 1000);
    }

    if (maimTriggered) {
      addTraitProc('Maim the Disillusioned', at, skill.name);
    }

    triggerShatterTraits(skill, at, spent, isBladeSong, {
      skipMaim: maimTriggered
    });
    addEvent({
      type: 'marker',
      at,
      name: skill.name,
      detail: `${spent} ${resourceDefinition.plural} spent`
    });
    return { skill, at, spent, bladeSong: isBladeSong };
  };

  return {
    commitReservedResources,
    consumeResources,
    currentResource,
    handleShatter,
    reserveResources,
    restoreReservedResources,
    triggerShatterTraits
  };
}
