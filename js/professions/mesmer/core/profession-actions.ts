import { professionCoreState } from '../../../platform/engine/profession.js';
/**
 * Handles shared profession actions decorated by active modules.
 * Manages resource consumption, trait procs (Maim/Phantom Pain/Illusionary Membrane/etc.).
 * Returns: consumeResources, currentResource, handleCrescendo, handleInstrument, handleShatter, triggerShatterTraits.
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
  MesmerInstrument,
  MesmerProfessionActionController,
  MesmerRuntimeState,
  MesmerQueueResources,
  MesmerResourceDefinition,
  MesmerRuntime,
  MesmerResourceSpendDetails,
  MesmerShatter,
  MesmerShatterTraitOptions,
  MesmerSkill,
  MesmerTraitDamage
} from '../types.js';

const TROUBADOUR_PROFILE = Object.freeze({
  instruments: 'mesmer.troubadour.instruments',
  crescendo: 'mesmer.troubadour.crescendo',
  honorableRogue: 'mesmer.troubadour.tale-honorable-rogue',
  soulkeeper: 'mesmer.troubadour.tale-soulkeeper',
  valiantMarshal: 'mesmer.troubadour.tale-valiant-marshal'
});

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
  const chronomancerState = () => {
    const active = state.profession.specialization;
    if (active.kind !== 'Chronomancer') {
      throw new TypeError(`Expected Chronomancer, received ${active.kind}.`);
    }
    return active.state;
  };
  const troubadourState = () => {
    const active = state.profession.specialization;
    if (active.kind !== 'Troubadour') {
      throw new TypeError(`Expected Troubadour, received ${active.kind}.`);
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
    // Illusionary Reversion refunds a clone only when exactly the threshold number of clones were spent.
    if (
      resourceDefinition.singular === 'clone' &&
      spent === profileValue(TRAIT.ILLUSIONARY_REVERSION, 'threshold', 3) &&
      traits.has(TRAIT.ILLUSIONARY_REVERSION)
    ) {
      queueResources(
        at + epsilon,
        profileValue(TRAIT.ILLUSIONARY_REVERSION, 'resourceGain', 1),
        activePrimaryWeapon(),
        'Illusionary Reversion',
        {
          traitId: TRAIT.ILLUSIONARY_REVERSION,
          traitName: 'Illusionary Reversion'
        }
      );
    }
  };

  // Returns false (and warns) when a blade song is attempted with no blades.
  // resourcesSpent=null means consume resources now; a pre-computed value skips the consume (used by Chrono well interactions).
  const handleShatter = (
    skill: MesmerSkill,
    at: number,
    resourcesSpent: number | null = null,
    castStart = at
  ): boolean => {
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
      return false;
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
    // Time Bomb: each Time Sink that lands outside the current bomb window arms a new detonation.
    if (skill.id === ID.TIME_SINK && traits.has(TRAIT.TIME_BOMB) && at >= chronomancerState().timeBombUntil - epsilon) {
      const timeBomb = traitDamage['Time Bomb'];
      const duration = Number(timeBomb.duration || 0);
      chronomancerState().timeBombUntil = at + duration;
      addEvent({
        type: 'buff',
        at,
        kind: 'time-bomb',
        stacks: 1,
        duration: duration + epsilon,
        sourceSkill: skill.name
      });
      addDamage(
        {
          id: 'Time Bomb',
          name: 'Time Bomb',
          weapon: 'Utility',
          blade: false
        },
        chronomancerState().timeBombUntil,
        {
          coefficient: timeBomb.coefficient,
          hits: timeBomb.hits,
          source: 'Player',
          weapon: 'utility'
        }
      );
      addTraitProc('Time Bomb', at, skill.name, 'explodes after 5s');
    }
    // Infinite Forge refunds blades when a blade song consumed at least the threshold count.
    if (
      isBladeSong &&
      traits.has(TRAIT.INFINITE_FORGE) &&
      spent >= profileValue(TRAIT.INFINITE_FORGE, 'threshold', 5)
    ) {
      queueResources(
        at + epsilon * 2,
        profileValue(TRAIT.INFINITE_FORGE, 'resourceGain', 2),
        activePrimaryWeapon(),
        'Infinite Forge refund',
        {
          traitId: TRAIT.INFINITE_FORGE,
          traitName: 'Infinite Forge'
        }
      );
    }
    addEvent({
      type: 'marker',
      at,
      name: skill.name,
      detail: `${spent} ${resourceDefinition.plural} spent`
    });
    return true;
  };

  // Shared between handleInstrument (player cast) and Call and Response (afterimage summon).
  // source/"actorType" differ so the damage engine attributes hits correctly.
  const instrumentAttack = (
    skill: MesmerSkill,
    data: MesmerInstrument,
    damageAt: number,
    source = 'Player',
    actorType: 'player' | 'summon' = 'player'
  ): void => {
    if (data.coefficient) {
      // Shredding adds an extra strike coefficient + hits only on Lute instruments.
      const shredding = profileEffect(TRAIT.SHREDDING, 'strike');
      const shreddingCoefficient = Number(shredding?.coefficient || 1);
      const shreddingHits = Number(shredding?.hits || 1);
      const coefficient =
        data.coefficient + (data.instrument === 'Lute' && traits.has(TRAIT.SHREDDING) ? shreddingCoefficient : 0);
      addDamage(
        skill,
        damageAt,
        {
          coefficient,
          hits: data.hits + (coefficient > data.coefficient ? shreddingHits : 0),
          intervalMs: data.intervalMs,
          source,
          actorType,
          weaponStrengthProfileId: 'nonweapon.profession-mechanic'
        },
        { source, sourceId: skill.id, skillId: skill.id, actorType }
      );
    }
    for (const condition of data.conditions || []) {
      addCondition(skill.name, damageAt, condition, source, '', {
        source,
        sourceId: skill.id,
        skillId: skill.id,
        actorType
      });
    }
    // Mayhem applies Torment only on Flute hits.
    if (data.instrument === 'Flute' && traits.has(TRAIT.MAYHEM)) {
      addCondition(
        skill.name,
        damageAt,
        conditionFromProfile(TRAIT.MAYHEM, {
          name: 'Torment',
          duration: 5,
          stacks: 4
        }),
        source,
        'Mayhem — Torment',
        { source, sourceId: TRAIT.MAYHEM, skillId: skill.id, actorType }
      );
    }
    // Flute and Drum both emit a control event (fear and daze respectively).
    if (data.instrument === 'Flute' || data.instrument === 'Drum') {
      addEvent({
        type: 'control',
        at: damageAt,
        skillId: skill.id,
        skillName: skill.name,
        source,
        sourceId: skill.id,
        actorType
      });
    }
    // Syncopate fires a delayed second wave + daze on Drum hits.
    if (data.instrument === 'Drum' && traits.has(TRAIT.SYNCOPATE)) {
      const delayedAt = damageAt + profileValue(TRAIT.SYNCOPATE, 'initialDelay', 3);
      const delayedWave = traitDamage.SyncopateDelayedWave;
      addDamage(
        {
          id: 'Syncopate delayed wave',
          name: 'Syncopate',
          weapon: 'Utility',
          blade: false
        },
        delayedAt,
        {
          coefficient: delayedWave.coefficient,
          hits: delayedWave.hits,
          source: 'Trait',
          actorType,
          weaponStrengthProfileId: 'nonweapon.unequipped'
        },
        {
          source: 'Trait',
          sourceId: TRAIT.SYNCOPATE,
          skillId: skill.id,
          actorType,
          name: 'Syncopate — delayed wave'
        }
      );
      addEvent({
        type: 'control',
        at: delayedAt,
        skillId: skill.id,
        skillName: 'Syncopate — delayed wave',
        controlKind: 'daze',
        source,
        sourceId: TRAIT.SYNCOPATE,
        actorType
      });
      addTraitProc('Syncopate', delayedAt, skill.name, 'delayed drum wave');
    }
    // Life of the Party grants quickness + might to the party on Lute hits.
    if (traits.has(TRAIT.LIFE_OF_THE_PARTY) && data.instrument === 'Lute') {
      const quickness = profileEffect(TRAIT.LIFE_OF_THE_PARTY, 'boon', 0);
      const might = profileEffect(TRAIT.LIFE_OF_THE_PARTY, 'boon', 1);
      addEvent({
        type: 'buff',
        at: damageAt,
        kind: String(quickness?.boon || 'quickness'),
        stacks: Number(quickness?.stacks || 1),
        duration: Number(quickness?.duration || 6),
        skillName: skill.name,
        sourceSkill: skill.name,
        ...partyBoonRecipients()
      });
      addEvent({
        type: 'buff',
        at: damageAt,
        kind: String(might?.boon || 'might'),
        stacks: Number(might?.stacks || 5),
        duration: Number(might?.duration || 8),
        skillName: skill.name,
        sourceSkill: skill.name,
        ...partyBoonRecipients()
      });
    }
  };

  // Spends all current notes, applies instrument attack, then marks the instrument as active until expiresAt.
  // expiresAt = base duration + (notes spent * durationPerNote), which scales the window for Tale skill bonuses.
  const handleInstrument = (
    skill: MesmerSkill,
    at: number,
    castStart = at,
    spendDetails: MesmerResourceSpendDetails = {}
  ): void => {
    const data = instruments[skill.id];
    if (!data) {
      throw new Error(`Missing Mesmer instrument data for ${skill.name}.`);
    }
    const spent = consumeResources(at, spendDetails);
    const damageAt = castStart + Number(data.damageAtMs || 0) / 1000;
    instrumentAttack(skill, data, damageAt);
    const baseDuration = profileValue(TROUBADOUR_PROFILE.instruments, 'durationMultiplier', 5);
    const durationPerNote = profileValue(TROUBADOUR_PROFILE.instruments, 'durationPerTier', 5);
    const expiresAt = at + baseDuration + spent * durationPerNote;
    troubadourState().instruments[data.instrument] = expiresAt;
    troubadourState().lastInstrument = data.instrument;
    addEvent({
      type: 'mesmer.instrument',
      at: at + epsilon,
      instrument: data.instrument,
      expiresAt
    });

    // Harp grants distortion on cast (the only instrument with a self-buff on play).
    if (data.instrument === 'Harp') {
      const distortion = profileEffect(TROUBADOUR_PROFILE.instruments, 'buff');
      addEvent({
        type: 'buff',
        at: castStart,
        kind: 'distortion',
        stacks: Number(distortion?.stacks || 1),
        duration: Number(distortion?.duration || 2),
        sourceSkill: skill.name
      });
    }

    // Call and Response: at-max-note spend, an afterimage summon repeats the attack after a delay.
    if (traits.has(TRAIT.CALL_AND_RESPONSE) && spent === profileValue(TRAIT.CALL_AND_RESPONSE, 'threshold', 3)) {
      const afterimageAt = at + profileValue(TRAIT.CALL_AND_RESPONSE, 'initialDelay', 1.5);
      instrumentAttack(skill, data, afterimageAt, 'Afterimage', 'summon');
      addTraitProc('Call and Response', afterimageAt, skill.name);
    }
    addEvent({
      type: 'marker',
      at,
      name: skill.name,
      detail: `${data.instrument} playing for ${(baseDuration + spent * durationPerNote).toFixed(0)}s`
    });

    // Altered Chord reduces Crescendo's cooldown whenever notes were spent (any non-empty instrument cast).
    if (traits.has(TRAIT.ALTERED_CHORD) && spent > 0) {
      const crescendo = byId(ID.CRESCENDO);
      const ready = crescendo ? state.cooldowns.get(crescendo.id) : undefined;
      if (crescendo && ready) {
        state.cooldowns.set(
          crescendo.id,
          Math.max(at, ready - profileValue(TRAIT.ALTERED_CHORD, 'rechargeReduction', 2))
        );
      }
    }
  };

  // Crescendo damage scales with how many instruments are still active at damage time.
  const handleCrescendo = (skill: MesmerSkill, at: number, castStart = at): void => {
    const damageAt = castStart + Number(skill.damageAtMs || 0) / 1000;
    const activeInstruments = Object.entries(troubadourState().instruments).filter(
      ([, expiresAt]) => expiresAt > damageAt
    );
    const strike = profileEffect(TROUBADOUR_PROFILE.crescendo, 'strike');
    addDamage(skill, damageAt, {
      coefficient:
        Number(strike?.coefficient ?? 2.25) *
        (1 + activeInstruments.length * profileValue(TROUBADOUR_PROFILE.crescendo, 'damageIncreasePerStack', 0.25)),
      hits: Number(strike?.hits ?? 1),
      source: 'Player',
      weaponStrengthProfileId: 'nonweapon.profession-mechanic'
    });

    // Life of the Party on Crescendo grants quickness + might + fury (indices 2–4 of the trait's boon effects).
    if (traits.has(TRAIT.LIFE_OF_THE_PARTY)) {
      const effects = [
        profileEffect(TRAIT.LIFE_OF_THE_PARTY, 'boon', 2),
        profileEffect(TRAIT.LIFE_OF_THE_PARTY, 'boon', 3),
        profileEffect(TRAIT.LIFE_OF_THE_PARTY, 'boon', 4)
      ];
      for (const [index, [kind, stacks, duration]] of [
        ['quickness', 1, 8],
        ['might', 8, 15],
        ['fury', 1, 8]
      ].entries()) {
        const effect = effects[index];
        addEvent({
          type: 'buff',
          at: damageAt,
          kind: String(effect?.boon || kind),
          stacks: Number(effect?.stacks || stacks),
          duration: Number(effect?.duration || duration),
          skillName: skill.name,
          sourceSkill: skill.name,
          ...partyBoonRecipients()
        });
      }
    }

    // Altered Chord bonus depends on which instrument was played last: Lute→buff, Flute→confusion, Drum→control.
    if (traits.has(TRAIT.ALTERED_CHORD)) {
      if (troubadourState().lastInstrument === 'Lute') {
        addEvent({
          type: 'buff',
          at: damageAt + epsilon,
          kind: 'altered-chord',
          stacks: 1,
          duration: profileValue(TRAIT.ALTERED_CHORD, 'durationMultiplier', 10)
        });
        addTraitProc('Altered Chord', damageAt + epsilon, skill.name, 'Lute');
      } else if (troubadourState().lastInstrument === 'Flute') {
        addCondition(
          skill.name,
          damageAt,
          conditionFromProfile(TRAIT.ALTERED_CHORD, {
            name: 'Confusion',
            duration: 8,
            stacks: 5
          }),
          'Player',
          'Altered Chord — Confusion'
        );
        addTraitProc('Altered Chord', damageAt, skill.name, 'Flute');
      } else if (troubadourState().lastInstrument === 'Drum') {
        addEvent({
          type: 'control',
          at: damageAt,
          skillId: skill.id,
          skillName: skill.name,
          source: 'Player',
          sourceId: TRAIT.ALTERED_CHORD,
          actorType: 'player'
        });
        addTraitProc('Altered Chord', damageAt, skill.name, 'Drum');
      }
    }
    // Fortissimo queues one note per interval tick after Crescendo (pulse-based resource gain).
    if (traits.has(TRAIT.FORTISSIMO)) {
      const applications = profileValue(TRAIT.FORTISSIMO, 'maximumStacks', 5);
      const interval = profileValue(TRAIT.FORTISSIMO, 'pulseInterval', 1);
      const resourceGain = profileValue(TRAIT.FORTISSIMO, 'resourceGain', 1);
      for (let index = 1; index <= applications; index += 1) {
        queueResources(at + index * interval, resourceGain, activePrimaryWeapon(), 'Fortissimo', {
          traitId: TRAIT.FORTISSIMO,
          traitName: 'Fortissimo'
        });
      }
    }
  };

  // Each Tale grants boons and, if the matching instrument is still active at cast time, refunds notes.
  const handleTale = (skill: MesmerSkill, at: number, castStart = at): void => {
    const taleProfileId = new Map<number, string>([
      [ID.TALE_OF_THE_HONORABLE_ROGUE, TROUBADOUR_PROFILE.honorableRogue],
      [ID.TALE_OF_THE_SOULKEEPER, TROUBADOUR_PROFILE.soulkeeper],
      [ID.TALE_OF_THE_VALIANT_MARSHAL, TROUBADOUR_PROFILE.valiantMarshal]
    ]).get(skill.id);
    const taleProfile = taleProfileId ? balanceProfile(taleProfileId) : null;
    for (const boon of (taleProfile?.effects || []).filter((effect) => effect.type === 'boon')) {
      addEvent({
        type: 'buff',
        at,
        kind: String(boon.boon || ''),
        stacks: Number(boon.stacks || 1),
        duration: Number(boon.duration || 0),
        skillName: skill.name,
        sourceSkill: skill.name,
        ...partyBoonRecipients()
      });
    }
    const requiredInstrument = new Map<number, string>([
      [ID.TALE_OF_THE_SOULKEEPER, 'Lute'],
      [ID.TALE_OF_THE_HONORABLE_ROGUE, 'Drum'],
      [ID.TALE_OF_THE_VALIANT_MARSHAL, 'Harp'],
      [ID.TALE_OF_THE_TORTURED_MASTERMIND, 'Flute']
    ]).get(skill.id);
    if (requiredInstrument && Number(troubadourState().instruments[requiredInstrument] || 0) > castStart) {
      const count = Number(taleProfile?.resourceGain || 1);
      queueResources(at + epsilon, count, activePrimaryWeapon(), skill.name);
    }
    // Honorable Rogue restores endurance (dodge energy) — logged as a marker since the engine doesn't model dodge.
    if (skill.id === ID.TALE_OF_THE_HONORABLE_ROGUE) {
      addEvent({
        type: 'marker',
        at,
        name: skill.name,
        detail: '50 endurance restored'
      });
    }
    // Raconteur grants protection to the party on every Tale cast.
    if (traits.has(TRAIT.RACONTEUR)) {
      const protection = profileEffect(TRAIT.RACONTEUR, 'boon');
      addEvent({
        type: 'buff',
        at,
        kind: String(protection?.boon || 'protection'),
        stacks: Number(protection?.stacks || 1),
        duration: Number(protection?.duration || 3),
        skillName: skill.name,
        sourceSkill: skill.name,
        ...partyBoonRecipients()
      });
      addTraitProc('Raconteur', at, skill.name);
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
    triggerShatterTraits
  };
}
