/** Resolve critical food procs by catalog ID so combat and isolated occurrences attribute the same payload. */
import { ACTOR, BOON_NAMES, type BoonId } from '#gw2/platform/constants.js';
import type { PacketEmission, ProfileEmission } from '#gw2/platform/effects/emission.js';
import { FOOD_DATA, NOURISHMENT_ICON } from '#gw2/platform/equipment/consumables/food.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';

type CriticalFoodEffect = (
  { readonly type: 'boon'; readonly boon: BoonId } | { readonly type: 'condition'; readonly name: string }
) & {
  readonly stacks: number;
  readonly duration: number;
};

interface CriticalFoodProc {
  readonly foodId: string;
  readonly sourceId: string;
  readonly icon: string;
  readonly chance: number;
  readonly icdMs?: number;
  readonly flatDamage?: number;
  readonly name: string;
  readonly dayEffect?: CriticalFoodEffect;
  readonly nightEffect?: CriticalFoodEffect;
}

const criticalFoodProcs = new Map<string, CriticalFoodProc>();
for (const [foodId, food] of Object.entries(FOOD_DATA)) {
  if (food.proc?.type === 'critStrike')
    criticalFoodProcs.set(foodId, {
      ...food.proc,
      foodId,
      sourceId: `food.${foodId}`,
      icon: food.icon || NOURISHMENT_ICON
    });
}

export function criticalFoodProc(foodId: string | undefined): CriticalFoodProc | undefined {
  return foodId === undefined ? undefined : criticalFoodProcs.get(foodId);
}

/** Enqueues each food proc directly so its normal damage, condition, or boon handler resolves it. */
export function createCriticalFoodEffect(
  ctx: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  proc: CriticalFoodProc
): void {
  const conditionalEffect = ctx.config.timeOfDay === 'night' ? proc.nightEffect : proc.dayEffect;
  const commonEvent = {
    at: event.at,
    skillName: proc.name,
    source: 'Food',
    sourceId: proc.sourceId,
    actorType: ACTOR.EFFECT,
    ownerActorType: ACTOR.PLAYER,
    triggeredBy: event.skillName
  } as const;
  let request: PacketEmission | ProfileEmission;

  if (conditionalEffect?.type === 'boon') {
    const name = BOON_NAMES[conditionalEffect.boon];
    // A food boon owns a separate yield even when several procs share the triggering skill.
    request = {
      kind: 'profile',
      profile: { id: commonEvent.sourceId, name: proc.name },
      at: event.at,
      attribution: commonEvent,
      effects: [
        {
          type: 'boon',
          boon: conditionalEffect.boon,
          stacks: conditionalEffect.stacks,
          duration: conditionalEffect.duration
        }
      ],
      transform: (packet) => ({ ...packet, name: `${proc.name} - ${name}` })
    };
  } else if (conditionalEffect?.type === 'condition') {
    request = {
      kind: 'packet',
      event: {
        ...commonEvent,
        type: 'condition',
        name: `${proc.name} - ${conditionalEffect.name}`,
        condition: conditionalEffect.name,
        stacks: conditionalEffect.stacks,
        duration: conditionalEffect.duration
      }
    };
  } else {
    // Nourishment is a flat life-siphon strike, so it bypasses coefficient and critical scaling but stays strike damage.
    request = {
      kind: 'packet',
      event: {
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
      }
    };
  }

  ctx.effects.emit({ ...request, durationContext: event });
  ctx.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'food',
      name: proc.name,
      at: event.at,
      sourceSkill: event.skillName,
      detail: '',
      icon: proc.icon
    }
  });
}
