import { FOOD_DATA, NOURISHMENT_ICON } from '#gw2/platform/equipment/consumables/food.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

/** Critical-strike food procs: the selected food's proc data and the packets a successful proc emits. */

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

/** The selected food's critical-strike proc, if it has one. */
export function criticalFoodProc(ctx: Gw2ResolverRuntime): CriticalFoodProc | undefined {
  const proc = FOOD_DATA[ctx.config.food || '']?.proc as CriticalFoodProc | undefined;
  return proc?.type === 'critStrike' ? proc : undefined;
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
