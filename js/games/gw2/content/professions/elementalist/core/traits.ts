import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '../../../../platform/scheduler/skill-events.js';
import { hasTrait } from '../../../../platform/combat/state/traits.js';
import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { advanceScheduledCriticalProc } from '../../../../platform/scheduler/critical-facts.js';
import { isInternalCooldownReady } from '../../../../../../kernel/core/clock.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '../data/ids.js';
import type { SimulationEvent, Skill } from '../../../../platform/engine/types.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistSchedulerContext
} from '../types.js';
import { setElementalistAttunementReadyAt, type ElementalistAttunement, type ElementalistCoreState } from './state.js';
import { PERSISTING_FLAMES_FIELD_SKILLS } from './constants.js';
import {
  applyElementalistAura,
  combatStarted,
  elementalistEventSkill,
  emitElementalistProc,
  emitProfiledBuff,
  emitProfiledCondition,
  profiledEffect
} from './mechanics.js';
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE,
  elementalistBalanceValue,
  elementalistEffectValue
} from './profiles.js';

// Trait-skill packets carry canonical artwork so result tables do not fall back to the triggering attunement icon.
const SUNSPOT_ICON = 'https://render.guildwars2.com/file/1405047ED70DE30F80B1F6304A787B215BB50878/1012316.png';
const FLAME_EXPULSION_ICON = 'https://render.guildwars2.com/file/998095CB1FD2CF0164B8A36BABFDB911DF08DB02/1012313.png';
const EARTHEN_BLAST_ICON = 'https://render.guildwars2.com/file/2531DCAFAEAB452C90C4572E1ADCE8236DCF5636/1012304.png';

// Materialize Sunspot's attunement-entry strike and Burning at the transition
// timestamp using profile-owned values.
export function triggerSunspot(context: ElementalistSchedulerContext, at: number, sourceId: Skill['id']): void {
  if (!combatStarted(context, at) || !hasTrait(context, 'Sunspot')) {
    return;
  }

  const applySunspotAura = () =>
    applyElementalistAura(context, {
      at,
      aura: 'Fire Aura',
      duration: elementalistEffectValue(context, PROFILE.sunspot, 'buff', 'duration', 3, 'Sunspot Aura'),
      skillName: 'Sunspot',
      sourceId
    });
  applySunspotAura();
  emitSkillDamage(context, {
    at,
    source: 'Sunspot',
    sourceId,
    actorType: 'effect',
    skillName: 'Sunspot',
    icon: SUNSPOT_ICON,
    coefficient: elementalistEffectValue(context, PROFILE.sunspot, 'strike', 'coefficient', 0.6, 'Sunspot'),
    skillWeapon: 'Unequipped',
    noCrit: true
  });
  if (hasTrait(context, 'Burning Rage')) {
    emitProfiledCondition(context, at, PROFILE.burningRage, 'Sunspot Burning', 'Burning', 2, 4, 'Sunspot', sourceId);
  }

  emitElementalistProc(context, {
    at,
    name: 'Sunspot',
    procType: 'trait',
    sourceId,
    sourceSkill: context.catalog.skillsById.get(sourceId)?.name,
    icon: SUNSPOT_ICON
  });
}

// Snapshot capped might at Fire-attunement exit and scale both the strike and
// burning duration from that same value for deterministic trait attribution.
export function triggerFlameExpulsion(context: ElementalistSchedulerContext, at: number, sourceId: Skill['id']): void {
  if (!combatStarted(context, at) || !hasTrait(context, "Pyromancer's Puissance")) {
    return;
  }

  const cappedMight = Math.min(
    elementalistBalanceValue(context, PROFILE.pyromancersPuissance, 'maximumStacks', 10),
    context.buffStacks('might', at)
  );
  const baseCoefficient = elementalistEffectValue(
    context,
    PROFILE.pyromancersPuissance,
    'strike',
    'coefficient',
    1,
    'Flame Expulsion'
  );
  const coefficientPerMight = elementalistBalanceValue(
    context,
    PROFILE.pyromancersPuissance,
    'damageIncreasePerStack',
    0.1
  );
  const baseBurningDuration = elementalistEffectValue(
    context,
    PROFILE.pyromancersPuissance,
    'condition',
    'duration',
    2,
    'Flame Expulsion'
  );
  const burningDurationPerMight = elementalistBalanceValue(
    context,
    PROFILE.pyromancersPuissance,
    'durationPerTier',
    0.5
  );
  emitSkillDamage(context, {
    at,
    source: 'Flame Expulsion',
    sourceId,
    actorType: 'effect',
    skillName: 'Flame Expulsion',
    icon: FLAME_EXPULSION_ICON,
    coefficient: baseCoefficient + coefficientPerMight * cappedMight,
    skillWeapon: 'Unequipped'
  });
  emitSkillCondition(context, elementalistEventSkill(context, 'Flame Expulsion', sourceId), {
    at,
    source: 'Flame Expulsion',
    sourceId,
    actorType: 'player',
    condition: 'Burning',
    stacks: elementalistEffectValue(context, PROFILE.pyromancersPuissance, 'condition', 'stacks', 1, 'Flame Expulsion'),
    duration: Math.min(
      baseBurningDuration + burningDurationPerMight * cappedMight,
      baseBurningDuration +
        burningDurationPerMight * elementalistBalanceValue(context, PROFILE.pyromancersPuissance, 'maximumStacks', 10)
    ),
    skillName: 'Flame Expulsion'
  });
  emitElementalistProc(context, {
    at,
    name: 'Flame Expulsion',
    procType: 'trait',
    sourceId,
    sourceSkill: context.catalog.skillsById.get(sourceId)?.name,
    icon: FLAME_EXPULSION_ICON
  });
}

// Emit Electric Discharge from an Air-attunement transition with stable trait
// ownership and the triggering mechanic's skill ID.
export function triggerElectricDischarge(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill['id']
): void {
  if (!combatStarted(context, at) || !hasTrait(context, 'Electric Discharge')) return;
  emitSkillDamage(context, {
    at,
    source: 'Electric Discharge',
    sourceId,
    actorType: 'effect',
    skillName: 'Electric Discharge',
    coefficient: elementalistEffectValue(
      context,
      PROFILE.electricDischarge,
      'strike',
      'coefficient',
      0.35,
      'Electric Discharge'
    ),
    skillWeapon: 'Unequipped'
  });
  emitProfiledCondition(
    context,
    at,
    PROFILE.electricDischarge,
    'Electric Discharge',
    'Vulnerability',
    1,
    8,
    'Electric Discharge',
    sourceId
  );
  emitElementalistProc(context, {
    at,
    name: 'Electric Discharge',
    procType: 'trait',
    sourceId,
    sourceSkill: context.catalog.skillsById.get(sourceId)?.name
  });
}

export function triggerEarthenBlast(context: ElementalistSchedulerContext, at: number, sourceId: Skill['id']): void {
  if (!combatStarted(context, at) || !hasTrait(context, 'Earthen Blast')) {
    return;
  }

  emitSkillDamage(context, {
    at,
    source: 'Earthen Blast',
    sourceId,
    actorType: 'effect',
    skillName: 'Earthen Blast',
    icon: EARTHEN_BLAST_ICON,
    coefficient: elementalistEffectValue(context, PROFILE.earthenBlast, 'strike', 'coefficient', 0.36),
    skillWeapon: 'Unequipped',
    noCrit: true
  });
  emitElementalistProc(context, {
    at,
    name: 'Earthen Blast',
    procType: 'trait',
    sourceId,
    sourceSkill: context.catalog.skillsById.get(sourceId)?.name,
    icon: EARTHEN_BLAST_ICON
  });
}

export function grantElementalistRockSolid(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill['id']
): void {
  if (!combatStarted(context, at) || !hasTrait(context, 'Rock Solid')) {
    return;
  }

  emitProfiledBuff(context, at, PROFILE.rockSolid, 'Stability', 'Stability', 1, 3, 'Rock Solid', sourceId);
}

export function grantElementalAttunementBoon(
  context: ElementalistSchedulerContext,
  at: number,
  attunement: ElementalistAttunement,
  sourceId: Skill['id']
): void {
  if (!hasTrait(context, 'Elemental Attunement')) return;
  const fallback: Readonly<Record<ElementalistAttunement, readonly [string, number, number]>> = {
    Fire: ['Might', 1, 15],
    Water: ['Regeneration', 1, 5],
    Air: ['Swiftness', 1, 8],
    Earth: ['Protection', 1, 5]
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
    'Elemental Attunement',
    sourceId
  );
}

export function triggerBountifulPower(
  context: ElementalistSchedulerContext,
  at: number,
  stacks: number,
  sourceId: Skill['id']
): void {
  if (!hasTrait(context, 'Bountiful Power')) return;
  const state = professionCoreState(context);
  state.bountifulPowerProgress += stacks;
  const threshold = elementalistBalanceValue(context, PROFILE.bountifulPower, 'threshold', 5);
  while (state.bountifulPowerProgress >= threshold) {
    state.bountifulPowerProgress -= threshold;
    emitProfiledBuff(context, at, PROFILE.bountifulPower, 'Quickness', 'Quickness', 1, 5, 'Bountiful Power', sourceId);
    const active = profiledEffect(context, PROFILE.bountifulPower, 'buff', 'Damage Window');
    emitSkillBuff(context, elementalistEventSkill(context, 'Bountiful Power', sourceId), {
      at,
      source: 'Bountiful Power',
      sourceId,
      actorType: 'player',
      kind: 'bountiful power active',
      stacks: Number(active?.stacks ?? 1),
      duration: Number(active?.duration ?? 7),
      skillName: 'Bountiful Power'
    });
  }
}

// Materialize the dodge proc selected by the current attunement while tracking
// a separate internal cooldown for each elemental version.
export function triggerEvasiveArcana(context: ElementalistLifecycleContext, skill: Skill): void {
  if (!hasTrait(context, 'Evasive Arcana')) return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const attunement = state.primaryAttunement;
  const key = `evasiveArcana${attunement}`;
  if (!isInternalCooldownReady(at, Number(state.procReadyAt[key] || 0))) return;
  state.procReadyAt[key] = at + elementalistBalanceValue(context, PROFILE.evasiveArcana, 'internalCooldown', 10);
  const source =
    attunement === 'Fire'
      ? 'Flame Burst (trait)'
      : attunement === 'Water'
        ? 'Cleansing Wave (trait)'
        : attunement === 'Air'
          ? 'Blinding Flash (trait)'
          : 'Shock Wave (trait)';
  if (attunement === 'Fire') {
    emitSkillDamage(context, {
      at,
      source,
      sourceId: skill.id,
      actorType: 'effect',
      skillName: source,
      coefficient: elementalistEffectValue(context, PROFILE.evasiveArcana, 'strike', 'coefficient', 1, 'Fire'),
      skillWeapon: 'Unequipped'
    });
    emitProfiledCondition(context, at, PROFILE.evasiveArcana, 'Fire Burning', 'Burning', 3, 6, source, skill.id);
  } else if (attunement === 'Air') {
    context.emit({
      type: 'blind',
      at,
      source,
      sourceId: skill.id,
      actorType: 'effect',
      skillName: source,
      controlKind: 'blind'
    });
  } else if (attunement === 'Earth') {
    emitSkillDamage(context, {
      at,
      source,
      sourceId: skill.id,
      actorType: 'effect',
      skillName: source,
      coefficient: elementalistEffectValue(context, PROFILE.evasiveArcana, 'strike', 'coefficient', 0.5, 'Earth'),
      skillWeapon: 'Unequipped',
      comboFinishers: [
        {
          ownerId: 'elementalist',
          finisherType: 'Blast',
          ambiguousFieldSelection: 'oldest'
        }
      ]
    });
    emitProfiledCondition(context, at, PROFILE.evasiveArcana, 'Earth Bleeding', 'Bleeding', 1, 20, source, skill.id);
    emitProfiledCondition(context, at, PROFILE.evasiveArcana, 'Earth Cripple', 'Cripple', 1, 2, source, skill.id);
  }

  context.emit({
    type: 'elementalist.evasive-arcana',
    at,
    source,
    sourceId: skill.id,
    actorType: 'effect',
    skillName: source,
    attunement
  });
  emitElementalistProc(context as never, {
    at,
    name: source,
    procType: 'trait',
    sourceId: skill.id,
    sourceSkill: skill.name
  });
}

// Centralize cast-completion traits that depend on skill family, attunement, or
// shared ICD state so specialization hooks do not duplicate core ordering.
export function applyGenericPostCast(context: ElementalistLifecycleContext, skill: Skill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  if (hasTrait(context, "Pyromancer's Puissance") && state.primaryAttunement === 'Fire' && combatStarted(context, at)) {
    emitProfiledBuff(
      context,
      at,
      PROFILE.pyromancersPuissance,
      'Attunement Might',
      'Might',
      1,
      15,
      skill.name,
      skill.id
    );
  }

  if (skill.type === 'Heal') {
    if (
      hasTrait(context, "Earth's Embrace") &&
      isInternalCooldownReady(at, Number(state.procReadyAt.earthsEmbrace || 0))
    ) {
      state.procReadyAt.earthsEmbrace =
        at + elementalistBalanceValue(context, PROFILE.earthsEmbrace, 'internalCooldown', 15);
      emitProfiledBuff(
        context,
        at,
        PROFILE.earthsEmbrace,
        'Resistance',
        'Resistance',
        1,
        4,
        "Earth's Embrace",
        skill.id
      );
    }

    if (hasTrait(context, 'Soothing Ice') && isInternalCooldownReady(at, Number(state.procReadyAt.soothingIce || 0))) {
      state.procReadyAt.soothingIce =
        at + elementalistBalanceValue(context, PROFILE.soothingIce, 'internalCooldown', 15);
      applyElementalistAura(context, {
        at,
        aura: 'Frost Aura',
        duration: elementalistEffectValue(context, PROFILE.soothingIce, 'buff', 'duration', 4, 'Frost Aura'),
        skillName: 'Soothing Ice',
        sourceId: skill.id
      });
      emitProfiledBuff(
        context,
        at,
        PROFILE.soothingIce,
        'Regeneration',
        'Regeneration',
        1,
        4,
        'Soothing Ice',
        skill.id
      );
    }
  }

  if (hasTrait(context, 'Written in Stone') && skill.skillFamily === 'Signet') {
    const aura =
      skill.name === 'Signet of Restoration'
        ? (['Restoration', 'Frost Aura', 4] as const)
        : skill.name === 'Signet of Fire'
          ? (['Fire', 'Fire Aura', 4] as const)
          : skill.name === 'Signet of Earth'
            ? (['Earth', 'Magnetic Aura', 3] as const)
            : null;
    if (aura) {
      const effect = profiledEffect(context, PROFILE.writtenInStone, 'buff', aura[0]);
      applyElementalistAura(context, {
        at,
        aura: String(effect?.kind || aura[1]),
        duration: Number(effect?.duration ?? aura[2]),
        skillName: 'Written in Stone',
        sourceId: skill.id
      });
    }
  }

  if (hasTrait(context, 'Inscription') && skill.skillFamily === 'Glyph') {
    const boon =
      state.primaryAttunement === 'Fire'
        ? (['Fire', 'Might', 1, 10] as const)
        : state.primaryAttunement === 'Water'
          ? (['Water', 'Regeneration', 1, 10] as const)
          : state.primaryAttunement === 'Air'
            ? (['Air', 'Swiftness', 1, 10] as const)
            : (['Earth', 'Protection', 1, 3] as const);
    emitProfiledBuff(context, at, PROFILE.inscription, boon[0], boon[1], boon[2], boon[3], skill.name, skill.id);
  }

  if (hasTrait(context, 'Arcane Lightning') && skill.skillFamily === 'Arcane') {
    const arcaneWindow = profiledEffect(context, PROFILE.arcaneLightning, 'buff', 'Arcane Lightning');
    emitSkillBuff(context, skill, {
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      kind: 'arcane lightning',
      stacks: Number(arcaneWindow?.stacks ?? 1),
      duration: Number(arcaneWindow?.duration ?? 15),
      skillName: skill.name
    });
    if (skill.name === 'Arcane Brilliance') {
      emitProfiledBuff(
        context,
        at,
        PROFILE.arcaneLightning,
        'Arcane Brilliance',
        'Protection',
        1,
        3.5,
        skill.name,
        skill.id
      );
    } else if (skill.name === 'Arcane Wave') {
      emitProfiledCondition(
        context,
        at,
        PROFILE.arcaneLightning,
        'Arcane Wave',
        'Immobilized',
        1,
        2,
        skill.name,
        skill.id
      );
    } else if (skill.name === 'Arcane Blast') {
      context.emit({
        type: 'blind',
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'effect',
        skillName: skill.name,
        controlKind: 'blind'
      });
    } else if (skill.name === 'Arcane Echo') {
      emitProfiledBuff(context, at, PROFILE.arcaneLightning, 'Arcane Echo', 'Quickness', 1, 4, skill.name, skill.id);
    }
  }
}

// Extend a fire field by cloning its final authored packet and attached
// conditions at the measured cadence instead of stretching earlier packets.
export function extendPersistingFlamesPackets(context: ElementalistLifecycleContext, skill: Skill): void {
  if (!hasTrait(context, 'Persisting Flames') || !PERSISTING_FLAMES_FIELD_SKILLS.has(skill.name)) {
    return;
  }

  const fieldPackets = context.events
    .filter(
      (event) =>
        event.activationId === context.reservationId && event.type === 'damage' && event.damageKind === 'field-tick'
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
      event.type === 'condition' &&
      Math.abs(event.at - template.at) <= context.epsilon
  );
  const extraPackets = Math.max(
    0,
    Math.trunc(elementalistBalanceValue(context, PROFILE.persistingFlames, 'summons', 2))
  );
  for (let index = 1; index <= extraPackets; index += 1) {
    const at = template.at + interval * index;
    context.emit({
      ...template,
      at,
      largeHitboxOnly: false
    });
    for (const condition of attachedConditions) {
      context.emit({
        ...condition,
        at,
        largeHitboxOnly: false
      });
    }
  }
}

// Extend only the active fire field selected for Persisting Flames and mirror the
// new expiry on its scheduled field event.
export function extendPersistingFlamesField(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  if (
    event.type !== 'action' ||
    !hasTrait(context, 'Persisting Flames') ||
    !PERSISTING_FLAMES_FIELD_SKILLS.has(String(event.skillName || event.name))
  ) {
    return;
  }

  const field = context.events.find(
    (candidate) =>
      candidate.type === 'combo_field' &&
      candidate.activationId === event.activationId &&
      candidate.fieldType === 'Fire'
  );
  if (!field) return;
  context.replaceEvent(field, {
    expiresAt:
      Number(field.expiresAt) + elementalistBalanceValue(context, PROFILE.persistingFlames, 'durationPerTier', 2)
  });
}

// Collect eligible critical packets for Fresh Air after critical outcomes are
// known, deferring cooldown reset to ordered candidate processing.
function observeFreshAir(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  if (
    event.type !== 'damage' ||
    event.actorType !== 'player' ||
    event.canCrit === false ||
    event.noCrit ||
    !(Number(event.coefficient) > 0) ||
    !hasTrait(context, 'Fresh Air')
  ) {
    return;
  }

  const state = professionCoreState(context);
  const criticalPolicy = context.schedulerPolicy as unknown as {
    critical?: (
      schedulerContext: ElementalistSchedulerContext,
      simulationEvent: SimulationEvent
    ) => { chance?: number };
  };
  state.freshAirCandidates.push({
    at: event.at,
    // Lookahead needs the expected chance before the candidate is processed;
    // actual proc materialization still uses the canonical event and adapter.
    criticalChance: Number(criticalPolicy.critical?.(context, event)?.chance || 0),
    eventOrder: Number(event.__order),
    sourceId: event.skillId ?? event.sourceId,
    sourceSkill: String(event.skillName || event.source || '')
  });
}

// Resolve queued Fresh Air candidates in event order and reset Air attunement on
// the first successful sampled or expected critical proc.
export function processFreshAirCandidates(context: ElementalistSchedulerContext, through: number): void {
  const state = professionCoreState(context);
  if (!state.freshAirCandidates.length) return;
  const pending = [];
  const candidates = [...state.freshAirCandidates].sort((left, right) => left.at - right.at);
  for (const candidate of candidates) {
    if (candidate.at > through + context.epsilon) {
      pending.push(candidate);
      continue;
    }

    if (state.primaryAttunement === 'Air') continue;

    const event = context.eventByOrder(candidate.eventOrder);
    if (!event) {
      throw new Error(`Missing Fresh Air critical event ${String(candidate.eventOrder)}.`);
    }

    const tracker = { progress: state.freshAirProgress, readyAt: 0 };
    const application = advanceScheduledCriticalProc(context, event, { id: 'elementalist.core.fresh-air' }, tracker);
    state.freshAirProgress = tracker.progress;
    if (!application) continue;
    if (state.attunementReadyAt.Air > candidate.at + context.epsilon) {
      setElementalistAttunementReadyAt(context, 'Air', candidate.at);
      context.state.cooldowns.delete(ELEMENTALIST_ATTUNEMENT_SKILL_IDS.Air);
    }

    context.emit({
      type: 'elementalist.fresh-air',
      at: candidate.at,
      source: 'Fresh Air',
      sourceId: 'Fresh Air',
      actorType: 'effect',
      skillName: 'Fresh Air',
      sourceSkill: candidate.sourceSkill,
      triggeringSkillId: candidate.sourceId
    });
  }

  state.freshAirCandidates = pending;
}

// Route player control events through Lightning Rod and Stormsoul while keeping
// their damage, conditions, buffs, and proc records tied to the triggering hit.
function observeLightningRod(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  if (event.type !== 'control' || event.actorType !== 'player') return;
  const sourceId = event.skillId ?? event.sourceId;
  if (hasTrait(context, 'Lightning Rod')) {
    emitSkillDamage(context, {
      cause: event,

      at: event.at,
      source: 'Lightning Rod',
      sourceId,
      actorType: 'effect',
      skillName: 'Lightning Rod',
      coefficient: elementalistEffectValue(context, PROFILE.lightningRod, 'strike', 'coefficient', 1.5),
      skillWeapon: 'Unequipped'
    });
    emitProfiledCondition(
      context,
      event.at,
      PROFILE.lightningRod,
      'Lightning Rod',
      'Weakness',
      1,
      4,
      'Lightning Rod',
      sourceId
    );
    emitElementalistProc(context, {
      at: event.at,
      name: 'Lightning Rod',
      procType: 'trait',
      sourceId,
      sourceSkill: String(event.skillName || event.source || '')
    });
  }

  const state = professionCoreState(context);
  if (
    !hasTrait(context, 'Elemental Lockdown') ||
    !isInternalCooldownReady(event.at, Number(state.procReadyAt.elementalLockdown || 0))
  ) {
    return;
  }

  state.procReadyAt.elementalLockdown =
    event.at + elementalistBalanceValue(context, PROFILE.elementalLockdown, 'internalCooldown', 1);
  const fallback: Readonly<Record<ElementalistAttunement, readonly [string, number, number]>> = {
    Fire: ['Might', 5, 5],
    Water: ['Regeneration', 1, 10],
    Air: ['Fury', 1, 5],
    Earth: ['Protection', 1, 4]
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
    'Elemental Lockdown',
    sourceId
  );
}

export function observeElementalistTraitEvent(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  observeFreshAir(context, event);
  observeLightningRod(context, event);
}
