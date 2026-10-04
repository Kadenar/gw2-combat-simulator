import type {
  ActionContext,
  ResourceGrantAmount,
  SideEffectAction,
  SkillSideEffect
} from '#gw2/platform/effects/actions.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Ordinary actions receive only the services they can mutate; profession verbs keep their typed context. */
export type SideEffectServices = Pick<
  MechanicContext,
  'helpers' | 'time' | 'cooldownController' | 'resourceController' | 'endurance' | 'armFlip' | 'consumeFlip' | 'effects'
>;

/** Resolve live patch data at the point of application, rejecting invalid amounts before mutating a pool. */
export function sideEffectAmount(
  runtime: Pick<MechanicContext, 'helpers'>,
  amount: ResourceGrantAmount,
  skill?: Skill
): number {
  const value =
    typeof amount === 'number'
      ? amount
      : 'skillField' in amount
        ? skill?.[amount.skillField]
        : balanceProfileNumber(requireBalanceProfileFromContext(runtime, amount.profile), amount.field);
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new RangeError('Side-effect amounts must be finite and non-negative.');
  return value;
}

/** The platform owns ordinary pool and packet mutations; named profession verbs retain state-machine ownership. */
export function applySideEffect<TContext extends SideEffectServices>(
  runtime: TContext,
  context: ActionContext,
  action: SideEffectAction,
  handlers: Readonly<Record<string, (runtime: TContext, context: ActionContext, action: SideEffectAction) => void>> = {}
): void {
  switch (action.type) {
    case 'rechargeReset':
      for (const id of action.skillIds) runtime.cooldownController.clear(id);
      return;
    case 'ammoRestore': {
      const count = sideEffectAmount(runtime, action.count);
      for (const id of action.skillIds) {
        const skill = runtime.helpers.skillsById.get(id);
        if (!skill) throw new TypeError(`Unknown ammo restoration skill: ${id}.`);
        runtime.cooldownController.restoreAmmo(skill, count, runtime.time);
      }

      return;
    }

    case 'resourceGrant': {
      const amount = sideEffectAmount(runtime, action.amount, context.skill);
      if (action.resource === 'endurance') runtime.endurance.grant(amount);
      else runtime.resourceController.grant(action.resource, amount);
      return;
    }

    case 'flipArm':
      if (context.kind !== 'cast') throw new TypeError('flipArm requires a cast trigger.');
      runtime.armFlip(action.skillId, {
        expiresAt:
          action.durationSec === null
            ? Infinity
            : runtime.time + sideEffectAmount(runtime, action.durationSec ?? Number(context.skill.flipDuration)),
        // Some follow-ups must expire before same-time cast work, matching their previous lifecycle owner.
        expiryPriority: action.expiryPriority
      });
      return;
    case 'flipConsume':
      // Consumption is phase-owned by the declaration and leaves any later rearm's expiry independent.
      if (context.kind !== 'cast') throw new TypeError('flipConsume requires a cast trigger.');
      runtime.consumeFlip(action.skillId);
      return;
    case 'emitProfile': {
      const profile = requireBalanceProfileFromContext(runtime, action.profileId);
      runtime.effects.emit({
        kind: 'profile',
        profile: profile,
        effects: action.effects ? (profile.effects ?? []).filter(action.effects) : undefined,
        cause: context.kind === 'effect' ? context.trigger.event : undefined,
        attribution: {
          source: 'Trait',
          sourceId: action.profileId,
          actorType: 'effect',
          skillId: context.kind === 'cast' ? context.skill.id : context.trigger.event.skillId,
          skillName: context.kind === 'cast' ? context.skill.name : context.trigger.event.skillName,
          activationId: context.kind === 'cast' ? context.cast.id : context.trigger.event.activationId,
          ...action.attribution
        },
        transform: (event) => ({ ...event, name: action.attribution?.name ?? event.name })
      });
      return;
    }

    default: {
      const handler = handlers[action.type];
      if (!handler) throw new TypeError(`No side-effect handler registered for ${action.type}.`);
      handler(runtime, context, action);
    }
  }
}

/** The runtime dispatches start rewards for every accepted cast and commit rewards only for successful casts. */
export function applySkillSideEffects<T extends object>(
  runtime: MechanicContext<T>,
  cast: RuntimeCast,
  on: SkillSideEffect['on'],
  handlers?: Readonly<
    Record<string, (runtime: MechanicContext<T>, context: ActionContext, action: SideEffectAction) => void>
  >
): void {
  for (const effect of cast.skill.sideEffects ?? []) {
    if (effect.on === on && (!effect.when || effect.when(runtime.queries, cast)))
      applySideEffect(runtime, { kind: 'cast', skill: cast.skill, cast }, effect.do, handlers);
  }
}
