import { professionCoreState } from "../../../platform/engine/profession.js";
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from "../data/ids.js";
import { SPECIALIZATIONS } from "../data/guardian-api-metadata.js";
import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import { isInternalCooldownReady } from "../../../platform/engine/clock.js";
import { isGw2PlayerActorEvent } from "../../../platform/gw2/event-ownership.js";
import { buildGuardianStrike } from "./events.js";
import type {
  SchedulerRecord,
  SkillId,
} from "../../../platform/engine/types.js";
import type {
  GuardianCastContext,
  GuardianCoreState,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill,
  GuardianState,
} from "../types.js";

type GuardianTraitContext =
  | (GuardianCastContext & { readonly traits?: ReadonlySet<SkillId> })
  | (GuardianSchedulerContext & { readonly traits?: ReadonlySet<SkillId> })
  | (GuardianResolverContext & { readonly traits?: ReadonlySet<SkillId> });

const TRAIT_BY_ID = new Map(
  SPECIALIZATIONS.flatMap((specialization) => [
    ...specialization.minorTraits,
    ...specialization.majorTraits.flat(),
  ]).map((trait) => [Number(trait.id), trait]),
);

export function hasGuardianTrait(
  context: GuardianTraitContext,
  traitId: SkillId,
): boolean {
  if (context.traits?.has(traitId) || context.traits?.has(String(traitId))) {
    return true;
  }
  const traitName = TRAIT_BY_ID.get(Number(traitId))?.name;
  const configured = [
    ...(context.config?.traitIds || []),
    ...(context.config?.selectedTraitIds || []),
    ...(context.config?.selectedTraits || []),
  ];
  return configured.some(
    (value) =>
      value === traitId ||
      String(value) === String(traitId) ||
      Boolean(traitName && value === traitName),
  );
}

export function guardianTraitIcon(traitId: SkillId): string {
  return TRAIT_BY_ID.get(Number(traitId))?.icon || "";
}

export function emitGuardianProc(
  context: GuardianSchedulerContext,
  {
    name,
    at,
    sourceSkill,
    detail = "",
    icon = "",
    procType = "trait",
    source = "Trait",
  }: {
    readonly name: string;
    readonly at: number;
    readonly sourceSkill: string;
    readonly detail?: string;
    readonly icon?: string;
    readonly procType?: string;
    readonly source?: string;
  },
): void {
  context.emit({
    type: "proc",
    procType,
    at,
    source,
    sourceId: name,
    actorType: "effect",
    name,
    sourceSkill,
    detail,
    icon,
  });
}

export function emitGuardianBuff(
  context: GuardianSchedulerContext,
  skill: GuardianSkill,
  at: number,
  kind: string,
  duration: number,
  extra: SchedulerRecord = {},
): void {
  context.emit({
    type: "buff",
    at,
    source: "guardian",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    kind,
    stacks: 1,
    duration,
    ...extra,
  });
}

export function isGuardianSymbolSkill(
  skill: GuardianSkill | undefined,
  fallbackName = "",
): boolean {
  const name = skill?.name || fallbackName;
  const description = String(skill?.description || "");
  return (
    /^Symbol of /.test(name) ||
    /^Lesser Symbol of /.test(name) ||
    /^Symbol\./.test(description) ||
    /\bcreat(?:e|ing) a symbol\b/i.test(description)
  );
}

function emitLesserSymbolOfBlades(
  context: GuardianSchedulerContext,
  skill: GuardianSkill,
  at: number,
): void {
  for (let index = 0; index < 5; index += 1) {
    context.emit(
      buildGuardianStrike({
        at: at + index,
        sourceId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES,
        actorType: "effect",
        skillId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES,
        skillName: "Lesser Symbol of Blades",
        name: "Lesser Symbol of Blades",
        coefficient: 0.65,
        skillWeapon: "Unequipped",
        hitIndex: index + 1,
        totalHits: 5,
        isSymbol: true,
        triggeredBy: skill.name,
      }),
    );
  }
  emitGuardianProc(context, {
    name: "Lesser Symbol of Blades",
    at,
    sourceSkill: skill.name,
    detail: "Furious Focus",
    icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS),
  });
}

export function updateGuardianTraitCastState(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  const at = context.effectiveEnd;
  if (
    skill.categories?.includes("Virtue") &&
    String(skill.slot) === "Profession_1" &&
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS) &&
    isInternalCooldownReady(at, professionCoreState(context).furiousFocusReadyAt)
  ) {
    professionCoreState(context).furiousFocusReadyAt = at + 10;
    emitLesserSymbolOfBlades(context, skill, at);
  }
}

export function observeGuardianScheduledEvent(
  context: GuardianSchedulerContext,
  event: GuardianResolverEvent,
): void {
  if (event.type !== "damage") return;
  const skillId = event.skillId;
  const skill =
    skillId == null ? undefined : context.catalog.skillsById.get(skillId);
  if (!(event.isSymbol || isGuardianSymbolSkill(skill, event.skillName))) {
    return;
  }
  if (hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE)) {
    context.emit({
      type: "buff",
      at: event.at,
      source: "guardian",
      sourceId: GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
      actorType: "effect",
      skillId: GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
      skillName: "Symbolic Exposure",
      kind: "target-vulnerability",
      stacks: 2,
      duration: 5,
      triggeredBy: event.skillName,
    });
  }
  if (skillId === GUARDIAN_SKILL_IDS.SYMBOL_OF_RESOLUTION) {
    context.emit({
      type: "buff",
      at: event.at,
      source: "guardian",
      sourceId: skillId,
      actorType: "player",
      skillId,
      skillName: event.skillName,
      kind: "resolution",
      stacks: 1,
      duration: 1,
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
  detail: string,
): void {
  context.recordProc(
    "trait",
    name,
    at,
    sourceSkill,
    detail,
    guardianTraitIcon(traitId),
  );
}

function queueResolverBuff(
  context: GuardianResolverContext,
  {
    at,
    sourceId,
    skillName,
    kind,
    duration,
    stacks = 1,
    priority = -5,
  }: {
    readonly at: number;
    readonly sourceId: SkillId;
    readonly skillName: string;
    readonly kind: string;
    readonly duration: number;
    readonly stacks?: number;
    readonly priority?: number;
  },
): void {
  enqueueOrdered(context.queue, {
    type: "buff",
    at,
    priority,
    source: "guardian",
    sourceId,
    actorType: "player",
    skillId: sourceId,
    skillName,
    kind,
    duration,
    stacks,
  });
}

function queueLesserSymbolOfResolution(
  context: GuardianResolverContext,
  at: number,
  sourceSkill: string | undefined,
): void {
  for (let index = 0; index < 5; index += 1) {
    const pulseAt = at + index;
    enqueueOrdered(
      context.queue,
      buildGuardianStrike({
        at: pulseAt,
        sourceId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION,
        skillId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION,
        skillName: "Lesser Symbol of Resolution",
        name: "Lesser Symbol of Resolution",
        coefficient: 0.5,
        skillWeapon: "Unequipped",
        hitIndex: index + 1,
        totalHits: 5,
        isSymbol: true,
        triggeredBy: sourceSkill,
      }),
    );
    queueResolverBuff(context, {
      at: pulseAt,
      sourceId: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION,
      skillName: "Lesser Symbol of Resolution",
      kind: "resolution",
      duration: 2,
      priority: 5,
    });
  }
}

function reactToSymbolTraits(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  const skill =
    event.skillId == null
      ? undefined
      : context.helpers.skillsById?.get(event.skillId);
  if (!(event.isSymbol || isGuardianSymbolSkill(skill, event.skillName))) {
    return;
  }
  const state = resolverState(context);
  if (hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER)) {
    if (event.at >= state.symbolicAvengerUntil - resolverEpsilon(context)) {
      state.symbolicAvengerStacks = 0;
    }
    state.symbolicAvengerStacks = Math.min(
      5,
      Number(state.symbolicAvengerStacks || 0) + 1,
    );
    state.symbolicAvengerUntil = event.at + 15;
    recordTraitProc(
      context,
      GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER,
      "Symbolic Avenger",
      event.at,
      event.skillName,
      `${state.symbolicAvengerStacks}/5 stacks`,
    );
  }
  if (
    event.skillId === GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION &&
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE)
  ) {
    queueResolverBuff(context, {
      at: event.at,
      sourceId: GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
      skillName: "Symbolic Exposure",
      kind: "target-vulnerability",
      duration: 5,
      stacks: 2,
      priority: 5,
    });
  }
}

function reactToZealotsResolution(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  const state = resolverState(context);
  const targetHealth = Number(
    context.config.target?.health ?? context.config.targetHP ?? 0,
  );
  const damageDone =
    Number(context.totals?.strike || 0) +
    Number(context.totals?.condition || 0);
  if (
    !isGw2PlayerActorEvent(event) ||
    !(Number(event.coefficient || 0) > 0) ||
    !(targetHealth > 0) ||
    !(damageDone > targetHealth * 0.25) ||
    !isInternalCooldownReady(
      event.at,
      Number(state.zealotsResolutionReadyAt || 0),
    ) ||
    !hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.ZEALOTS_RESOLUTION) ||
    event.skillId === GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION
  ) {
    return;
  }
  state.zealotsResolutionReadyAt = event.at + 30;
  queueLesserSymbolOfResolution(context, event.at, event.skillName);
  recordTraitProc(
    context,
    GUARDIAN_TRAIT_IDS.ZEALOTS_RESOLUTION,
    "Lesser Symbol of Resolution",
    event.at,
    event.skillName,
    "Zealot's Resolution",
  );
}

export function reactToGuardianDamageTraits(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  reactToSymbolTraits(context, event);
  reactToZealotsResolution(context, event);
}

function queueRighteousMight(
  context: GuardianResolverContext,
  at: number,
  detail: string,
): void {
  queueResolverBuff(context, {
    at,
    sourceId: GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS,
    skillName: "Righteous Instincts",
    kind: "might",
    duration: 6,
  });
  recordTraitProc(
    context,
    GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS,
    "Righteous Instincts",
    at,
    "Resolution",
    detail,
  );
}

export function reactToGuardianBuffTraits(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  if (
    String(event.kind || "").toLowerCase() !== "resolution" ||
    !hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS)
  ) {
    return;
  }
  const state = resolverState(context);
  const duration = Math.max(0, Number(event.duration || 0));
  const wasActive =
    event.at < Number(state.resolutionUntil || 0) - resolverEpsilon(context);
  state.resolutionUntil = wasActive
    ? state.resolutionUntil + duration
    : event.at + duration;
  if (!wasActive) {
    queueRighteousMight(context, event.at, "Resolution applied");
    state.righteousNextMightAt = event.at + 1;
    enqueueOrdered(context.queue, {
      type: "guardian.righteous-instincts-tick",
      at: state.righteousNextMightAt,
      priority: -10,
      source: "guardian",
      sourceId: GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS,
      actorType: "effect",
    });
  }
}

export function handleRighteousInstinctsTick(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  const state = resolverState(context);
  if (
    !hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS) ||
    event.at > Number(state.resolutionUntil || 0) + resolverEpsilon(context) ||
    Math.abs(event.at - Number(state.righteousNextMightAt || 0)) >
      resolverEpsilon(context)
  ) {
    return;
  }
  queueRighteousMight(context, event.at, "Resolution interval");
  state.righteousNextMightAt = event.at + 1;
  if (
    state.righteousNextMightAt <=
    Number(state.resolutionUntil || 0) + resolverEpsilon(context)
  ) {
    enqueueOrdered(context.queue, {
      ...event,
      at: state.righteousNextMightAt,
    });
  }
}
