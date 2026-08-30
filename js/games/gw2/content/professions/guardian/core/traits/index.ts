import { emitSkillBuff, emitSkillCondition } from '../../../../../platform/scheduler/skill-events.js';
import { professionCoreState } from '../../../../../platform/engine/profession/state.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '../../data/ids.js';
import { SPECIALIZATIONS } from '../../data/guardian-api-metadata.js';
import { enqueueOrdered } from '../../../../../../../kernel/events/queue.js';
import { isInternalCooldownReady } from '../../../../../../../kernel/core/clock.js';
import { isGw2PlayerActorEvent } from '../../../../../platform/combat/state/event-ownership.js';
import { combinedTargetDamage } from '../../../../../platform/combat/state/target-health.js';
import { hasTrait } from '../../../../../platform/combat/state/traits.js';
import { gw2ResolverBoonDuration } from '../../../../../platform/resolver/boon-duration.js';
import { gw2SchedulerBoonDuration } from '../../../../../platform/scheduler/policy.js';
import { buildGuardianStrike } from '../mechanics/event-handlers.js';
import {
  GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE,
  guardianBalanceProfile,
  guardianBalanceProfileEffect
} from '../profiles.js';
import type { SchedulerRecord, SkillId } from '../../../../../platform/engine/types.js';
import type {
  GuardianCastContext,
  GuardianCoreState,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill
} from '../../types.js';

const TRAIT_BY_ID = new Map(
  SPECIALIZATIONS.flatMap((specialization) => [
    ...specialization.minorTraits,
    ...specialization.majorTraits.flat()
  ]).map((trait) => [Number(trait.id), trait])
);

export function guardianTraitIcon(traitId: SkillId): string {
  return TRAIT_BY_ID.get(Number(traitId))?.icon || '';
}

// Emit a normalized Guardian proc marker with trait icon and triggering-skill
// attribution shared by core and specialization rules.
export function emitGuardianProc(
  context: GuardianSchedulerContext,
  {
    name,
    at,
    sourceSkill,
    detail = '',
    icon = '',
    procType = 'trait',
    source = 'Trait'
  }: {
    readonly name: string;
    readonly at: number;
    readonly sourceSkill: string;
    readonly detail?: string;
    readonly icon?: string;
    readonly procType?: string;
    readonly source?: string;
  }
): void {
  context.emit({
    type: 'proc',
    procType,
    at,
    source,
    sourceId: name,
    actorType: 'effect',
    name,
    sourceSkill,
    detail,
    icon
  });
}

export function isGuardianSymbolSkill(skill: GuardianSkill | undefined, fallbackName = ''): boolean {
  const name = skill?.name || fallbackName;
  const description = String(skill?.description || '');
  return (
    /^Symbol of /.test(name) ||
    /^Lesser Symbol of /.test(name) ||
    /^Symbol\./.test(description) ||
    /\bcreat(?:e|ing) a symbol\b/i.test(description)
  );
}

function emitLesserSymbolOfBlades(context: GuardianSchedulerContext, skill: GuardianSkill, at: number): void {
  const profile = guardianBalanceProfile(context, PROFILE.furiousFocus);
  const strike = guardianBalanceProfileEffect(profile, 'strike');
  const hits = Math.max(1, Math.trunc(Number(strike?.hits || 5)));
  const interval = Number(strike?.intervalMs || 1000) / 1000;
  // The triggered symbol is one distinct activation so its unequipped weapon-strength roll is shared by its
  // pulses without colliding with the virtue cast's equipped-weapon roll.
  const activationId = context.createActivationId('effect');
  for (let index = 0; index < hits; index += 1) {
    context.emit(
      buildGuardianStrike({
        at: at + index * interval,
        sourceId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES,
        actorType: 'player',
        skillId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES,
        skillName: 'Lesser Symbol of Blades',
        name: 'Lesser Symbol of Blades',
        coefficient: Number(strike?.coefficient || 0.65) / hits,
        skillWeapon: 'Unequipped',
        activationId,
        hitIndex: index + 1,
        totalHits: hits,
        isSymbol: true,
        triggeredBy: skill.name
      })
    );
  }

  emitGuardianProc(context, {
    name: 'Lesser Symbol of Blades',
    at,
    sourceSkill: skill.name,
    detail: 'Furious Focus',
    icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS)
  });
}

export function updateGuardianTraitCastState(context: GuardianCastContext, skill: GuardianSkill): void {
  const at = context.effectiveEnd;
  if (
    skill.id === GUARDIAN_SKILL_IDS.SYMBOL_OF_PUNISHMENT &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.WRIT_OF_PERSISTENCE)
  ) {
    const profile = guardianBalanceProfile(context, PROFILE.writOfPersistence);
    const extension = Number(guardianBalanceProfileEffect(profile, 'buff')?.duration || 2);
    const field = skill.comboFields?.[0];
    const fieldStart = context.start + Number(field?.startMs || 0) / 1000;
    const fieldEnd = fieldStart + Number(field?.duration || 0);
    const strikePackets = (profile?.effects || [])
      .filter((effect) => effect.type === 'strike')
      .flatMap((effect) =>
        (effect.ticks || []).map((tick) => ({
          atMs: Number(tick.atMs),
          coefficient: Number(tick.coefficient)
        }))
      );
    const might = guardianBalanceProfileEffect(profile, 'boon');

    // Writ adds a contiguous field segment because the original field is already active when cast-state hooks run.
    context.emit({
      type: 'combo_field',
      at: fieldEnd,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name,
      activationId: context.action.activationId,
      fieldId: `guardian:${String(context.action.activationId)}:writ-extension`,
      fieldType: field?.fieldType || 'Light',
      expiresAt: fieldEnd + extension,
      ownerId: field?.ownerId || 'guardian',
      ownerActorType: 'player',
      triggeredBy: 'Writ of Persistence'
    });
    for (let index = 0; index < strikePackets.length; index += 1) {
      const packet = strikePackets[index];
      context.emit(
        buildGuardianStrike({
          at: context.start + packet.atMs / 1000,
          sourceId: skill.id,
          skillId: skill.id,
          skillName: skill.name,
          name: skill.name,
          coefficient: packet.coefficient,
          skillWeapon: 'Scepter',
          hitIndex: 13 + index,
          totalHits: 12 + strikePackets.length,
          isSymbol: true,
          triggeredBy: 'Writ of Persistence'
        })
      );
    }

    for (let index = 0; index < Number(might?.applications || 2); index += 1) {
      emitSkillBuff(context, skill, {
        at: context.start + (Number(might?.atMs || 5240) + index * Number(might?.intervalMs || 1000)) / 1000,
        source: 'guardian',
        sourceId: skill.id,
        actorType: 'player',
        kind: 'might',
        duration: Number(might?.duration || 5),
        stacks: Number(might?.stacks || 4),
        recipients: 'party',
        triggeredBy: 'Writ of Persistence'
      });
    }
  }

  if (skill.id === GUARDIAN_SKILL_IDS.SYMBOL_OF_IGNITION) {
    const field = guardianBalanceProfileEffect(guardianBalanceProfile(context, PROFILE.symbolOfIgnition), 'buff');
    const duration = Number(field?.duration || 4);
    context.replaceEvent(context.action, {
      comboFields: [
        {
          ownerId: 'guardian',
          fieldType: 'Light',
          duration,
          startAnchor: 'castEnd'
        }
      ]
    });
    context.emit({
      type: 'guardian.symbol-of-ignition-field',
      at: context.effectiveEnd,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name,
      duration
    });
  }

  if (skill.id === GUARDIAN_SKILL_IDS.PURGING_FLAMES) {
    const durationMultiplier = Number(
      guardianBalanceProfile(context, PROFILE.masterOfConsecrations)?.durationMultiplier || 1.4
    );
    context.replaceEvent(context.action, {
      comboFields: [
        {
          ownerId: 'guardian',
          fieldType: 'Fire',
          duration: hasTrait(context, GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS) ? 5 * durationMultiplier : 5,
          startAnchor: 'castEnd'
        }
      ]
    });
  }

  const virtueSlot = skill.categories?.includes('Virtue') ? String(skill.slot || '') : '';
  if (virtueSlot) {
    if (hasTrait(context, GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE)) {
      const inspired = guardianBalanceProfileEffect(
        guardianBalanceProfile(context, PROFILE.inspiredVirtue),
        'boon',
        virtueSlot === 'Profession_1' ? 0 : virtueSlot === 'Profession_2' ? 1 : 2
      );
      const boon = String(inspired?.boon || 'protection');
      emitSkillBuff(context, skill, {
        at,
        source: 'guardian',
        stacks: Number(inspired?.stacks || 1),
        sourceId: GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE,
        actorType: 'player',
        name: 'Inspired Virtue',
        kind: boon,
        duration: Number(inspired?.duration || 5)
      });
    }

    if (hasTrait(context, GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION)) {
      const resolution = guardianBalanceProfileEffect(
        guardianBalanceProfile(context, PROFILE.virtueOfResolution),
        'boon'
      );
      emitSkillBuff(context, skill, {
        at,
        source: 'guardian',
        sourceId: GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION,
        actorType: 'player',
        name: 'Virtue of Resolution',
        kind: 'resolution',
        duration: Number(resolution?.duration || 3),
        stacks: 1
      });
    }

    if (hasTrait(context, GUARDIAN_TRAIT_IDS.INSPIRING_VIRTUE)) {
      const inspiring = guardianBalanceProfileEffect(guardianBalanceProfile(context, PROFILE.inspiringVirtue), 'buff');
      emitSkillBuff(context, skill, {
        at,
        source: 'guardian',
        sourceId: GUARDIAN_TRAIT_IDS.INSPIRING_VIRTUE,
        actorType: 'player',
        name: 'Inspiring Virtue',
        kind: 'guardian-inspiring-virtue',
        duration: Number(inspiring?.duration || 6),
        stacks: 1
      });
    }

    if (virtueSlot === 'Profession_3' && hasTrait(context, GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE)) {
      const stability = guardianBalanceProfileEffect(
        guardianBalanceProfile(context, PROFILE.indomitableCourage),
        'boon'
      );
      emitSkillBuff(context, skill, {
        at,
        source: 'guardian',
        stacks: Number(stability?.stacks || 3),
        sourceId: GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE,
        actorType: 'player',
        name: 'Indomitable Courage',
        kind: 'stability',
        duration: Number(stability?.duration || 4)
      });
    }
  }

  if (
    virtueSlot === 'Profession_1' &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS) &&
    isInternalCooldownReady(at, professionCoreState(context).furiousFocusReadyAt)
  ) {
    const lesserSymbol =
      context.catalog.skillsById.get(GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES) ||
      ({
        id: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES,
        name: 'Lesser Symbol of Blades',
        cooldown: Number(guardianBalanceProfile(context, PROFILE.furiousFocus)?.cooldown || 10)
      } as GuardianSkill);
    professionCoreState(context).furiousFocusReadyAt = at + context.rechargeDurationFor(lesserSymbol, at);
    emitLesserSymbolOfBlades(context, skill, at);
  }

  if (skill.id === GUARDIAN_SKILL_IDS.PURGING_FLAMES && hasTrait(context, GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS)) {
    const profile = guardianBalanceProfile(context, PROFILE.masterOfConsecrations);
    const strike = guardianBalanceProfileEffect(profile, 'strike');
    const burning = guardianBalanceProfileEffect(profile, 'condition');
    const hits = Math.max(1, Math.trunc(Number(strike?.hits || 2)));
    const interval = Number(strike?.intervalMs || 1000) / 1000;
    for (let index = 0; index < hits; index += 1) {
      const pulseAt = context.start + 6.32 + index * interval;
      context.emit(
        buildGuardianStrike({
          at: pulseAt,
          sourceId: skill.id,
          skillId: skill.id,
          skillName: skill.name,
          name: skill.name,
          coefficient: Number(strike?.coefficient || 0.4) / hits,
          skillWeapon: 'Unequipped',
          hitIndex: 7 + index,
          totalHits: 6 + hits
        })
      );
      emitSkillCondition(context, {
        at: pulseAt,
        source: 'guardian',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        name: `${skill.name} — Burning`,
        condition: String(burning?.condition || 'Burning'),
        stacks: Number(burning?.stacks || 1),
        duration: Number(burning?.duration || 2)
      });
    }
  }
}

export function handleSymbolOfIgnitionField(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const state = resolverState(context);
  state.symbolIgnitionStartsAt = event.at;
  state.symbolIgnitionUntil = event.at + Number(event.duration || 4);
}

// While the symbol window is active, attach its burning to other player hits;
// the symbol's own packets are excluded to prevent self-recursion.
function reactToSymbolOfIgnition(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const profile = guardianBalanceProfile(context, PROFILE.symbolOfIgnition);
  const burning = guardianBalanceProfileEffect(profile, 'condition');
  if (
    !isGw2PlayerActorEvent(event) ||
    !(Number(event.coefficient || 0) > 0) ||
    event.skillId === GUARDIAN_SKILL_IDS.SYMBOL_OF_IGNITION
  ) {
    return;
  }

  const state = resolverState(context);
  const epsilon = resolverEpsilon(context);
  if (
    Number(state.symbolIgnitionUntil || 0) <= Number(state.symbolIgnitionStartsAt || 0) ||
    event.at < Number(state.symbolIgnitionStartsAt || 0) - epsilon ||
    event.at > Number(state.symbolIgnitionUntil || 0) + epsilon
  ) {
    return;
  }

  if (!isInternalCooldownReady(event.at, Number(state.symbolIgnitionReadyAt || 0))) {
    return;
  }

  state.symbolIgnitionReadyAt = event.at + Number(profile?.internalCooldown || 0.25);
  enqueueOrdered(context.queue, {
    type: 'condition',
    at: event.at,
    priority: 5,
    source: 'guardian',
    sourceId: GUARDIAN_SKILL_IDS.SYMBOL_OF_IGNITION,
    actorType: 'player',
    skillId: GUARDIAN_SKILL_IDS.SYMBOL_OF_IGNITION,
    skillName: 'Symbol of Ignition',
    name: 'Symbol of Ignition — Ignition',
    condition: String(burning?.condition || 'Burning'),
    stacks: Number(burning?.stacks || 1),
    duration: Number(burning?.duration || 1),
    triggeredBy: event.skillName,
    projectile: event.projectile === true
  });
}

// Normalize Resolution duration before it enters the queue, then decorate
// canonical symbol packets with scheduler-owned trait effects.
export function observeGuardianScheduledEvent(context: GuardianSchedulerContext, event: GuardianResolverEvent): void {
  if (
    event.type === 'buff' &&
    String(event.kind || '').toLowerCase() === 'resolution' &&
    Number(event.duration || 0) > 0 &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION)
  ) {
    context.replaceEvent(event, {
      duration:
        Number(event.duration) *
        Number(guardianBalanceProfile(context, PROFILE.virtueOfResolution)?.durationMultiplier || 1.25)
    });
    return;
  }

  if (event.type !== 'damage') return;
  const skillId = event.skillId;
  const skill = skillId == null ? undefined : context.catalog.skillsById.get(skillId);
  if (!(event.isSymbol || isGuardianSymbolSkill(skill, event.skillName))) {
    return;
  }

  if (hasTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE)) {
    const exposure = guardianBalanceProfileEffect(
      guardianBalanceProfile(context, PROFILE.symbolicExposure),
      'condition'
    );
    emitSkillCondition(context, {
      at: event.at,
      source: 'guardian',
      sourceId: GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
      actorType: 'effect',
      skillId: GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
      skillName: 'Symbolic Exposure',
      condition: 'Vulnerability',
      stacks: Number(exposure?.stacks || 2),
      duration: Number(exposure?.duration || 5),
      triggeredBy: event.skillName
    });
  }

  if (skillId === GUARDIAN_SKILL_IDS.SYMBOL_OF_RESOLUTION) {
    const sourceSkill =
      skill ||
      ({
        id: GUARDIAN_SKILL_IDS.SYMBOL_OF_RESOLUTION,
        name: event.skillName || 'Symbol of Resolution'
      } as GuardianSkill);
    emitSkillBuff(context, {
      at: event.at,
      source: 'guardian',
      sourceId: skillId,
      actorType: 'player',
      skillId,
      skillName: event.skillName,
      kind: 'resolution',
      stacks: 1,
      duration: gw2SchedulerBoonDuration(context, sourceSkill, 'resolution', 1)
    });
  }
}

function resolverState(context: GuardianResolverContext): GuardianCoreState {
  return professionCoreState(context);
}

function resolverEpsilon(context: GuardianResolverContext): number {
  return Number(context.epsilon || 0.0001);
}

function recordTraitProc(
  context: GuardianResolverContext,
  traitId: SkillId,
  name: string,
  at: number,
  sourceSkill: string | undefined,
  detail: string
): void {
  context.recordProc('trait', name, at, sourceSkill, detail, guardianTraitIcon(traitId));
}

// Queue a resolver-owned buff with canonical trait attribution and explicit
// recipient semantics.
function queueResolverBuff(
  context: GuardianResolverContext,
  {
    at,
    sourceId,
    skillName,
    kind,
    duration,
    stacks = 1,
    priority = -5
  }: {
    readonly at: number;
    readonly sourceId: SkillId;
    readonly skillName: string;
    readonly kind: string;
    readonly duration: number;
    readonly stacks?: number;
    readonly priority?: number;
  }
): void {
  const durationEvent = {
    type: 'buff',
    at,
    source: 'guardian',
    sourceId,
    actorType: 'player',
    skillId: sourceId,
    skillName,
    kind,
    duration,
    stacks
  } as GuardianResolverEvent;
  enqueueOrdered(context.queue, {
    type: 'buff',
    at,
    priority,
    source: 'guardian',
    sourceId,
    actorType: 'player',
    skillId: sourceId,
    skillName,
    kind,
    duration: gw2ResolverBoonDuration(context, durationEvent, kind, duration),
    stacks
  });
}

// Schedule Lesser Symbol of Resolution's pulse sequence as causally ordered
// symbol packets and boons from one activation.
function queueLesserSymbolOfResolution(
  context: GuardianResolverContext,
  at: number,
  sourceSkill: string | undefined
): void {
  const profile = guardianBalanceProfile(context, PROFILE.zealotsResolution);
  const strike = guardianBalanceProfileEffect(profile, 'strike');
  const resolution = guardianBalanceProfileEffect(profile, 'boon');
  const hits = Math.max(1, Math.trunc(Number(strike?.hits || 5)));
  const interval = Number(strike?.intervalMs || 1000) / 1000;
  for (let index = 0; index < hits; index += 1) {
    const pulseAt = at + index * interval;
    enqueueOrdered(
      context.queue,
      buildGuardianStrike({
        at: pulseAt,
        sourceId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION,
        skillId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION,
        skillName: 'Lesser Symbol of Resolution',
        name: 'Lesser Symbol of Resolution',
        coefficient: Number(strike?.coefficient || 0.5) / hits,
        skillWeapon: 'Unequipped',
        hitIndex: index + 1,
        totalHits: hits,
        isSymbol: true,
        triggeredBy: sourceSkill
      })
    );
    queueResolverBuff(context, {
      at: pulseAt,
      sourceId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION,
      skillName: 'Lesser Symbol of Resolution',
      kind: 'resolution',
      duration: Number(resolution?.duration || 2),
      stacks: Number(resolution?.stacks || 1),
      priority: 5
    });
  }
}

function reactToSymbolTraits(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const skill = event.skillId == null ? undefined : context.helpers.skillsById?.get(event.skillId);
  if (!(event.isSymbol || isGuardianSymbolSkill(skill, event.skillName))) {
    return;
  }

  const state = resolverState(context);
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER)) {
    const profile = guardianBalanceProfile(context, PROFILE.symbolicAvenger);
    if (event.at >= state.symbolicAvengerUntil - resolverEpsilon(context)) {
      state.symbolicAvengerStacks = 0;
    }

    state.symbolicAvengerStacks = Math.min(
      Number(profile?.maximumStacks || 5),
      Number(state.symbolicAvengerStacks || 0) + 1
    );
    state.symbolicAvengerUntil = event.at + Number(profile?.pulseInterval || 15);
    recordTraitProc(
      context,
      GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER,
      'Symbolic Avenger',
      event.at,
      event.skillName,
      `${state.symbolicAvengerStacks}/5 stacks`
    );
  }

  if (
    event.skillId === GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE)
  ) {
    // Lesser Symbol applies target Vulnerability directly so it shares condition duration and stacking rules.
    enqueueOrdered(context.queue, {
      type: 'condition',
      at: event.at,
      source: 'guardian',
      sourceId: GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
      actorType: 'effect',
      skillId: GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
      skillName: 'Symbolic Exposure',
      condition: 'Vulnerability',
      duration: 5,
      stacks: 2,
      priority: 5
    });
  }
}

// Trigger the lesser symbol only after cumulative damage crosses the configured
// target-health threshold, with guards against recursion and repeated ICD hits.
function reactToZealotsResolution(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const state = resolverState(context);
  const targetHealth = Number(context.config.target?.health ?? 0);
  const damageDone = combinedTargetDamage(context);
  if (
    !isGw2PlayerActorEvent(event) ||
    !(Number(event.coefficient || 0) > 0) ||
    !(targetHealth > 0) ||
    !(
      damageDone >
      targetHealth * Number(guardianBalanceProfile(context, PROFILE.zealotsResolution)?.threshold || 0.25)
    ) ||
    !isInternalCooldownReady(event.at, Number(state.zealotsResolutionReadyAt || 0)) ||
    !hasTrait(context, GUARDIAN_TRAIT_IDS.ZEALOTS_RESOLUTION) ||
    event.skillId === GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION
  ) {
    return;
  }

  state.zealotsResolutionReadyAt =
    event.at + Number(guardianBalanceProfile(context, PROFILE.zealotsResolution)?.cooldown || 30);
  queueLesserSymbolOfResolution(context, event.at, event.skillName);
  recordTraitProc(
    context,
    GUARDIAN_TRAIT_IDS.ZEALOTS_RESOLUTION,
    'Lesser Symbol of Resolution',
    event.at,
    event.skillName,
    "Zealot's Resolution"
  );
}

export function reactToGuardianDamageTraits(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  reactToSymbolOfIgnition(context, event);
  reactToSymbolTraits(context, event);
  reactToZealotsResolution(context, event);
}

function queueRighteousMight(context: GuardianResolverContext, at: number, detail: string): void {
  const might = guardianBalanceProfileEffect(guardianBalanceProfile(context, PROFILE.righteousInstincts), 'boon');
  queueResolverBuff(context, {
    at,
    sourceId: GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS,
    skillName: 'Righteous Instincts',
    kind: 'might',
    duration: Number(might?.duration || 6),
    stacks: Number(might?.stacks || 1)
  });
  recordTraitProc(context, GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS, 'Righteous Instincts', at, 'Resolution', detail);
}

// React to self Resolution with Righteous Instincts state, scheduling future
// Might ticks only for the newly established active window.
export function reactToGuardianBuffTraits(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  if (
    String(event.kind || '').toLowerCase() !== 'resolution' ||
    !hasTrait(context, GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS)
  ) {
    return;
  }

  const state = resolverState(context);
  const duration = Math.max(0, Number(event.duration || 0));
  const wasActive = event.at < Number(state.resolutionUntil || 0) - resolverEpsilon(context);
  state.resolutionUntil = wasActive ? state.resolutionUntil + duration : event.at + duration;
  if (!wasActive) {
    queueRighteousMight(context, event.at, 'Resolution applied');
    state.righteousNextMightAt =
      event.at + Number(guardianBalanceProfile(context, PROFILE.righteousInstincts)?.pulseInterval || 1);
    enqueueOrdered(context.queue, {
      type: 'guardian.righteous-instincts-tick',
      at: state.righteousNextMightAt,
      priority: -10,
      source: 'guardian',
      sourceId: GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS,
      actorType: 'effect'
    });
  }
}

// Emit a scheduled Righteous Instincts Might tick only while its originating
// Resolution window remains current and active.
export function handleRighteousInstinctsTick(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const state = resolverState(context);
  if (
    !hasTrait(context, GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS) ||
    event.at > Number(state.resolutionUntil || 0) + resolverEpsilon(context) ||
    Math.abs(event.at - Number(state.righteousNextMightAt || 0)) > resolverEpsilon(context)
  ) {
    return;
  }

  queueRighteousMight(context, event.at, 'Resolution interval');
  state.righteousNextMightAt =
    event.at + Number(guardianBalanceProfile(context, PROFILE.righteousInstincts)?.pulseInterval || 1);
  if (state.righteousNextMightAt <= Number(state.resolutionUntil || 0) + resolverEpsilon(context)) {
    enqueueOrdered(context.queue, {
      ...event,
      at: state.righteousNextMightAt
    });
  }
}
