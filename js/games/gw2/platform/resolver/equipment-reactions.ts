import { enqueueOrdered } from '../../../../kernel/events/queue.js';
import { isInternalCooldownReady } from '../../../../kernel/core/clock.js';
import type { SchedulerRecord } from '../engine/types.js';
import { isGw2PlayerActorEvent } from '../combat/state/event-ownership.js';
import { FOOD_DATA, NOURISHMENT_ICON } from '../equipment/consumables/food.js';
import { SIGIL_PROCS } from '../equipment/sigils/catalog.js';
import { onResolvedCriticalHit } from '../../integrations/patches/authoring/mechanics.js';
import { consumeExpectedCriticalProgress } from '../combat/numeric.js';
import { gw2SigilSet } from '../combat/query/runtime-rules.js';
import {
  createSigilConditionEvent,
  createSigilStrikeEvent,
  isResolverCriticalSigil
} from '../equipment/sigils/proc-events.js';
import {
  handleBoonRelics,
  handleComboRelic,
  handleConditionRelics,
  handleControlRelics,
  handlePeithaRelic,
  handleRelicDamageResolved,
  handleRelicsAfterHit,
  handleWeaknessVulnerabilityRelic
} from './relic-reactions.js';
import { skillForEvent } from './event-skill.js';
import { gw2ResolverBoonDuration } from './boon-duration.js';

import type { NativeResolvedDamageDetails } from '../../integrations/patches/authoring/module-types.js';
import type { Gw2ConditionHelpers } from '../equipment/relics/types.js';
import type {
  Gw2ConditionResolution,
  Gw2ResolverEvent,
  Gw2ResolverReactionContributions,
  Gw2ResolverReactionRegistry,
  Gw2ResolverRuntime
} from './types.js';
import type { Gw2SigilProc } from '../equipment/types.js';

export const GW2_REACTION_ORDER = Object.freeze({
  EARLY_COMMON: -200,
  COMMON: -100,
  PROFESSION: 0,
  LATE_COMMON: 100,
  FINAL_COMMON: 200
});

type Dispatch = Gw2ResolverReactionRegistry['dispatch'];

const SIGIL_PROC_LOOKUP = SIGIL_PROCS as Readonly<Record<string, Gw2SigilProc>>;

interface CriticalFoodEffect {
  readonly type: 'boon' | 'condition';
  readonly name: string;
  readonly stacks: number;
  readonly duration: number;
}

interface CriticalFoodProc {
  readonly type: string;
  readonly chance: number;
  readonly icdMs?: number;
  readonly flatDamage?: number;
  readonly name: string;
  readonly dayEffect?: CriticalFoodEffect;
  readonly nightEffect?: CriticalFoodEffect;
}

function conditionHelpers(context: Gw2ResolverRuntime, details: SchedulerRecord): Gw2ConditionHelpers {
  const activeConditionStackCount =
    details.activeConditionStackCount as Gw2ConditionResolution['activeConditionStackCount'];
  return {
    activeConditionStackCount: (_relicContext, condition, at) => activeConditionStackCount(context, condition, at),
    // Relic rules keep their narrow context-first contract while condition
    // resolution is owned by the full runtime that dispatched the reaction.
    applyCondition: (_relicContext, event) => context.applyCondition(event)
  };
}

function criticalFoodProc(ctx: Gw2ResolverRuntime): CriticalFoodProc | undefined {
  const proc = FOOD_DATA[String(ctx.config.food || '')]?.proc as CriticalFoodProc | undefined;
  return proc?.type === 'critStrike' ? proc : undefined;
}

function isResolvedCriticalSigilCause(
  ctx: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  details: NativeResolvedDamageDetails
): boolean {
  if (!(Number(event.coefficient) > 0) && event.canTriggerCriticalSigils !== true) {
    return false;
  }

  if (!isGw2PlayerActorEvent(event) && event.canTriggerCriticalSigils !== true) {
    return false;
  }

  const critical = details.hitContext?.critical;
  if (!critical) return false;
  if (ctx.random.stochastic) return critical.didCrit === true;
  if (!(critical.chance > 0)) return false;
  return consumeExpectedCriticalProgress(ctx.sigil, critical.chance);
}

function createResolvedCriticalSigilEffects(
  ctx: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  details: NativeResolvedDamageDetails
): void {
  const names = (gw2SigilSet(ctx.config, ctx.activeWeaponSet).names || []).filter(isResolverCriticalSigil);
  if (!names.length || !isResolvedCriticalSigilCause(ctx, event, details)) {
    return;
  }

  const sourceSkill = event.skillName || '';
  for (const name of names) {
    const proc = SIGIL_PROC_LOOKUP[name];
    const readyAt = ctx.sigil.readyAt.get(name) || 0;
    if (proc?.trigger !== 'crit' || !isInternalCooldownReady(event.at, readyAt)) {
      continue;
    }

    ctx.sigil.readyAt.set(name, event.at + proc.cooldown);
    const effect =
      proc.effect === 'strike'
        ? createSigilStrikeEvent(name, proc, sourceSkill)
        : createSigilConditionEvent(name, proc, sourceSkill);
    enqueueOrdered(ctx.queue, { ...effect, at: event.at } as Gw2ResolverEvent);
    ctx.recordProc('sigil', `Sigil of ${name}`, event.at, sourceSkill, '', String(proc.icon || ''));
  }
}

function createCriticalFoodEffect(dispatch: Dispatch, ctx: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  const proc = criticalFoodProc(ctx);
  if (!proc) return;
  const conditionalEffect = ctx.config.timeOfDay === 'night' ? proc.nightEffect : proc.dayEffect;
  const commonEvent = {
    at: event.at,
    skillName: proc.name,
    source: 'Food',
    sourceId: `food.${String(proc.name || 'proc').toLowerCase()}`,
    actorType: 'effect',
    triggeredBy: event.skillName
  } as const;
  let foodEvent: Gw2ResolverEvent;
  if (conditionalEffect?.type === 'boon') {
    const name = conditionalEffect.name;
    foodEvent = {
      ...commonEvent,
      type: 'buff',
      name: `${proc.name} — ${name}`,
      kind: name.toLowerCase(),
      stacks: conditionalEffect.stacks,
      duration: gw2ResolverBoonDuration(ctx, event, name, conditionalEffect.duration)
    } as Gw2ResolverEvent;
  } else if (conditionalEffect?.type === 'condition') {
    foodEvent = {
      ...commonEvent,
      type: 'condition',
      name: `${proc.name} — ${conditionalEffect.name}`,
      condition: conditionalEffect.name,
      stacks: conditionalEffect.stacks,
      duration: conditionalEffect.duration
    } as Gw2ResolverEvent;
  } else {
    foodEvent = {
      ...commonEvent,
      type: 'damage',
      name: proc.name,
      coefficient: 0,
      flatDamage: proc.flatDamage,
      damageKind: 'condition',
      lifeSiphon: true,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      noCrit: true
    } as Gw2ResolverEvent;
  }

  const professionUpdates =
    dispatch('food-proc.created', ctx, foodEvent, {
      proc,
      triggeringEvent: event
    }) || {};
  enqueueOrdered(ctx.queue, { ...foodEvent, ...professionUpdates });
  ctx.recordProc(
    'food',
    proc.name,
    event.at,
    event.skillName,
    '',
    String(FOOD_DATA[String(ctx.config.food || '')]?.icon || NOURISHMENT_ICON)
  );
}

/** Resolver-time equipment hooks. Scheduler-owned sigil generation stays out. */
export function createGw2EquipmentReactionContributions({
  dispatch
}: {
  readonly dispatch: Dispatch;
}): Gw2ResolverReactionContributions {
  const criticalFoodReaction = onResolvedCriticalHit<Gw2ResolverRuntime, Gw2ResolverEvent, NativeResolvedDamageDetails>(
    {
      id: 'food.critical-strike',
      materialization: 'threshold',
      chanceOnCriticalHit: (ctx) => criticalFoodProc(ctx)?.chance || 0,
      actorTypes: ['player'],
      when: (ctx, event) =>
        isGw2PlayerActorEvent(event) && Number(event.coefficient) > 0 && criticalFoodProc(ctx) != null,
      expectedProgress: {
        get: (ctx) => ctx.food.criticalProgress,
        set: (ctx, value) => {
          ctx.food.criticalProgress = value;
        }
      },
      internalCooldown: {
        duration: (ctx) => Number(criticalFoodProc(ctx)?.icdMs || 0) / 1000,
        readyAt: (ctx) => ctx.food.readyAt,
        setReadyAt: (ctx, readyAt) => {
          ctx.food.readyAt = readyAt;
        }
      },
      randomStream: 'food.critical-strike',
      attribution: { kind: 'effect', id: 'food.critical-strike' },
      handler: (ctx, event, _details, application) => {
        // Food procs are discrete events, so materialize every threshold application independently.
        for (let proc = 0; proc < application.quantity; proc += 1) {
          createCriticalFoodEffect(dispatch, ctx, event);
        }
      }
    }
  );

  return Object.freeze({
    'combo.resolved': [
      {
        id: 'relic.combo',
        order: GW2_REACTION_ORDER.COMMON,
        // All successful combos reach the relic runtime so Steamshrieker can accept leaps as well as blasts.
        handler: (ctx, event) => handleComboRelic(ctx, event)
      }
    ],
    'buff.applied': [
      {
        id: 'sigil.severance',
        order: GW2_REACTION_ORDER.EARLY_COMMON,
        handler(ctx, event) {
          if (String(event.kind || '').toLowerCase() !== 'sigil-severance') return;
          ctx.sigil.severanceUntil = Math.max(
            ctx.sigil.severanceUntil,
            event.at + Math.max(0, Number(event.duration || 0))
          );
        }
      },
      {
        id: 'relic.boon',
        order: GW2_REACTION_ORDER.COMMON,
        handler: (ctx, event) => handleBoonRelics(ctx, event)
      }
    ],
    'damage.resolved': [
      {
        id: 'sigil.critical-strike',
        order: GW2_REACTION_ORDER.EARLY_COMMON,
        handler(ctx, event, details = {}) {
          createResolvedCriticalSigilEffects(ctx, event, details);
        }
      },
      {
        id: 'relic.damage-resolved',
        order: GW2_REACTION_ORDER.COMMON,
        handler: (ctx, event) => handleRelicDamageResolved(ctx, event)
      },
      {
        id: 'food.critical-strike',
        order: GW2_REACTION_ORDER.LATE_COMMON,
        handler(ctx, event, details = {}) {
          criticalFoodReaction.handler(ctx, event, details);
        }
      },
      {
        id: 'relic.after-hit',
        order: GW2_REACTION_ORDER.FINAL_COMMON,
        handler: (ctx, event) => handleRelicsAfterHit(ctx, event, skillForEvent(ctx.helpers, event))
      }
    ],
    'condition.applied': [
      {
        id: 'relic.condition',
        order: GW2_REACTION_ORDER.LATE_COMMON,
        handler(ctx, application, details = {}) {
          handleConditionRelics(ctx, application, conditionHelpers(ctx, details));
        }
      }
    ],
    'control.resolved': [
      {
        id: 'relic.control',
        order: GW2_REACTION_ORDER.COMMON,
        handler(ctx, event, details = {}) {
          handleControlRelics(ctx, event, conditionHelpers(ctx, details));
        }
      }
    ],
    'peitha.resolved': [
      {
        id: 'relic.peitha',
        order: GW2_REACTION_ORDER.COMMON,
        handler(ctx, event, details = {}) {
          handlePeithaRelic(ctx, event, conditionHelpers(ctx, details).applyCondition);
        }
      }
    ],
    'weakness-vulnerability.resolved': [
      {
        id: 'relic.weakness-vulnerability',
        order: GW2_REACTION_ORDER.COMMON,
        handler: (ctx, event) => handleWeaknessVulnerabilityRelic(ctx, event)
      }
    ]
  });
}
