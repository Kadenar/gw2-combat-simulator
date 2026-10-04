import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { skillForEvent } from '#gw2/platform/combat/query/event-skill.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { FOOD_DATA, NOURISHMENT_ICON } from '#gw2/platform/equipment/consumables/food.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { invokeRelicHook } from '#gw2/platform/equipment/relics/runtime.js';
import { decideCriticalSigils } from '#gw2/platform/equipment/sigils/critical-procs.js';
import { SIGIL_BY_ID, SIGIL_PROCS } from '#gw2/platform/equipment/sigils/data.js';
import { gw2SigilIds } from '#gw2/platform/equipment/sigils/loadout.js';
import { createCriticalSigilEvent } from '#gw2/platform/equipment/sigils/proc-events.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/mechanics.js';

import type { Gw2ConditionHelpers } from '#gw2/platform/equipment/relics/types.js';
import type { Gw2SigilProc } from '#gw2/platform/equipment/sigils/types.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverEvent, Gw2ResolverReactionContributions } from '#gw2/platform/resolver/types.js';

const GW2_REACTION_ORDER = Object.freeze({
  EARLY_COMMON: -200,
  COMMON: -100,
  LATE_COMMON: 100,
  FINAL_COMMON: 200
});

const SIGIL_PROC_LOOKUP = SIGIL_PROCS as Readonly<Record<number, Gw2SigilProc>>;

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

function conditionHelpers(context: Gw2ResolverRuntime, details: Record<string, unknown>): Gw2ConditionHelpers {
  const activeConditionStackCount =
    details.activeConditionStackCount as Gw2ConditionResolution['activeConditionStackCount'];
  return {
    activeConditionStackCount: (_relicContext, condition, at) => activeConditionStackCount(context, condition, at)
  };
}

function criticalFoodProc(ctx: Gw2ResolverRuntime): CriticalFoodProc | undefined {
  const proc = FOOD_DATA[ctx.config.food || '']?.proc as CriticalFoodProc | undefined;
  return proc?.type === 'critStrike' ? proc : undefined;
}

/** Accepted hits claim critical sigils from the shared sampled outcome and live ICD map. */
function createResolvedCriticalSigilEffects(
  ctx: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  details: NativeResolvedDamageDetails
): void {
  const critical = details.hitContext?.critical;
  if (!critical) return;
  const decision = decideCriticalSigils(event, gw2SigilIds(ctx.config, ctx.activeWeaponSet), critical, ctx.procs);
  const sourceSkill = event.skillName || '';
  for (const { id, readyAt } of decision.procs) {
    const proc = SIGIL_PROC_LOOKUP[id];
    // Decisions are synchronous; commit their deadlines before queueing any derived effects.
    ctx.procs.readyAt[`sigil.${id}`] = readyAt;
    ctx.effects.emit({
      kind: 'packet',
      event: {
        ...createCriticalSigilEvent(id, proc, sourceSkill),
        at: event.at
      }
    });
    ctx.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'sigil',
        name: `Sigil of ${SIGIL_BY_ID[id].name}`,
        at: event.at,
        sourceSkill: sourceSkill,
        detail: '',
        icon: proc.icon || ''
      }
    });
  }
}

/** Enqueues each food proc directly so its normal damage, condition, or boon handler resolves it. */
export function createCriticalFoodEffect(ctx: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  const proc = criticalFoodProc(ctx);
  if (!proc) return;
  const conditionalEffect = ctx.config.timeOfDay === 'night' ? proc.nightEffect : proc.dayEffect;
  const commonEvent = {
    at: event.at,
    skillName: proc.name,
    source: 'Food',
    sourceId: `food.${(proc.name || 'proc').toLowerCase()}`,
    actorType: 'effect',
    ownerActorType: 'player',
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
      duration: conditionalEffect.duration
    };
  } else if (conditionalEffect?.type === 'condition') {
    foodEvent = {
      ...commonEvent,
      type: 'condition',
      name: `${proc.name} — ${conditionalEffect.name}`,
      condition: conditionalEffect.name,
      stacks: conditionalEffect.stacks,
      duration: conditionalEffect.duration
    };
  } else {
    // Nourishment is a flat life-siphon strike, so it bypasses coefficient and critical scaling but stays strike damage.
    foodEvent = {
      ...commonEvent,
      type: 'damage',
      name: proc.name,
      coefficient: 0,
      flatDamage: proc.flatDamage,
      damageKind: 'life-steal',
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      canCrit: false
    };
  }

  ctx.effects.emit({ kind: 'packet', durationContext: event, event: foodEvent });
  ctx.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'food',
      name: proc.name,
      at: event.at,
      sourceSkill: event.skillName,
      detail: '',
      icon: String(FOOD_DATA[ctx.config.food || '']?.icon || NOURISHMENT_ICON)
    }
  });
}

/** Resolver-time equipment hooks. Scheduler-owned sigil generation stays out. */
export function createGw2EquipmentReactionContributions(): Gw2ResolverReactionContributions {
  const criticalFoodReaction = criticalProcHandler<Gw2ResolverRuntime, Gw2ResolverEvent, NativeResolvedDamageDetails>({
    id: 'food.critical-strike',
    chanceOnCriticalHit: (ctx) => criticalFoodProc(ctx)?.chance || 0,
    actorTypes: ['player'],
    when: (ctx, event) =>
      isGw2PlayerActorEvent(event) && Number(event.coefficient) > 0 && criticalFoodProc(ctx) != null,
    internalCooldown: {
      duration: (ctx) => (criticalFoodProc(ctx)?.icdMs || 0) / 1000,
      // The critical-proc handler owns the sampled claim; equipment shares the registry's storage.
      readyAt: (ctx) => ctx.procs.deadline('food.critical-strike'),
      setReadyAt: (ctx, readyAt) => {
        ctx.procs.readyAt['food.critical-strike'] = readyAt;
      }
    },
    randomStream: 'food.critical-strike',
    handler: (ctx, event, _details, application) => {
      // Food procs are discrete events, so materialize every successful sampled application independently.
      for (let proc = 0; proc < application.quantity; proc += 1) {
        createCriticalFoodEffect(ctx, event);
      }
    }
  });

  return Object.freeze({
    'combo.resolved': [
      {
        id: 'relic.combo',
        order: GW2_REACTION_ORDER.COMMON,
        // All successful combos reach the relic runtime so Steamshrieker can accept leaps as well as blasts.
        handler(ctx, event) {
          invokeRelicHook(ctx, 'combo', event);
        }
      }
    ],
    'buff.applied': [
      {
        id: 'relic.boon',
        order: GW2_REACTION_ORDER.COMMON,
        handler(ctx, event) {
          // Only standard boons trigger relic boon rules; generic buffs share this stage.
          if (!isStandardBoon(event.kind || event.boon)) return;
          invokeRelicHook(ctx, 'boon', event);
          // Precast runtimes retain their own buff and cooldown; their rules gate precombat activation.
          for (const relic of ctx.precastRelics || []) {
            relic.rules.boon?.(ctx, relic.state, event);
          }
        }
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
        handler(ctx, event) {
          invokeRelicHook(ctx, 'damageResolved', event);
        }
      },
      {
        id: 'food.critical-strike',
        order: GW2_REACTION_ORDER.LATE_COMMON,
        handler: criticalFoodReaction
      },
      {
        id: 'relic.after-hit',
        order: GW2_REACTION_ORDER.FINAL_COMMON,
        handler(ctx, event, details = {}) {
          // Eligibility uses the resolved profile even when the authored packet inherited its weapon strength.
          const profile = (details as NativeResolvedDamageDetails).hitContext?.weaponStrength?.profileId;
          invokeRelicHook(
            ctx,
            'afterHit',
            profile ? { ...event, weaponStrengthProfileId: profile } : event,
            skillForEvent(ctx.helpers, event)
          );
        }
      }
    ],
    'condition.applied': [
      {
        id: 'relic.condition',
        order: GW2_REACTION_ORDER.LATE_COMMON,
        handler(ctx, application, details = {}) {
          invokeRelicHook(ctx, 'condition', application, conditionHelpers(ctx, details));
        }
      }
    ],
    'control.resolved': [
      {
        id: 'relic.control',
        order: GW2_REACTION_ORDER.COMMON,
        handler(ctx, event, details = {}) {
          invokeRelicHook(ctx, 'control', event, conditionHelpers(ctx, details));
        }
      }
    ],
    'peitha.resolved': [
      {
        id: `relic.${RELIC_IDS.PEITHA}`,
        order: GW2_REACTION_ORDER.COMMON,
        handler(ctx, event) {
          invokeRelicHook(ctx, 'peitha', event);
        }
      }
    ]
  });
}
