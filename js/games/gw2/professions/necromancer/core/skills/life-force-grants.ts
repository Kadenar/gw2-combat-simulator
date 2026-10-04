import type { ResourceGrantRecipe } from '#gw2/platform/effects/actions.js';
import type { ResourceGrantAction } from '#gw2/platform/effects/resource-grants.js';
import { castResourceGrants, effectResourceGrants } from '#gw2/platform/effects/resource-grants.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { Skill, BalanceProfile } from '#gw2/platform/skills/types.js';
import { necromancerLifeForceAmount } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

interface LifeForceGrant {
  readonly percent: number;
  readonly perCondition?: {
    readonly percent: number;
    readonly count: { readonly kind: 'live-target'; readonly maximum: number } | { readonly kind: 'packet-snapshot' };
  };
}
interface LifeForceParameters extends LifeForceGrant, Readonly<Record<string, unknown>> {
  readonly unit: 'hit' | 'pulse' | 'application' | 'cast';
}
export interface LifeForceGrantAction extends ResourceGrantAction {
  readonly resource: 'lifeForce';
  readonly label: string;
  readonly amount: ResourceGrantRecipe & { readonly parameters: LifeForceParameters };
}

function record(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  for (const key of Object.keys(value))
    if (!keys.includes(key)) throw new TypeError(`${label} has unsupported field ${key}.`);
  return value as Record<string, unknown>;
}

function percentage(value: unknown, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new TypeError(`${label} must be finite and non-negative.`);
}

/** Necromancer owns percentage semantics and observation rules; generic resource actions never interpret them. */
function validateLifeForceParameters(value: unknown, on?: string): asserts value is LifeForceParameters {
  const parameters = record(value, ['unit', 'percent', 'perCondition'], 'Life-force parameters');
  const { unit } = parameters;
  if (typeof unit !== 'string' || !['hit', 'pulse', 'application', 'cast'].includes(unit))
    throw new TypeError('Life-force grant has an invalid unit.');
  const expected = unit === 'cast' ? 'castCommit' : unit === 'application' ? 'condition.applied' : 'damage.resolved';
  if (on !== undefined && on !== expected) throw new TypeError('Life-force unit does not match its trigger.');
  percentage(parameters.percent, 'Life-force percent');
  if (parameters.perCondition !== undefined) {
    const bonus = record(parameters.perCondition, ['percent', 'count'], 'Life-force perCondition');
    percentage(bonus.percent, 'Life-force perCondition percent');
    const count = record(bonus.count, ['kind', 'maximum'], 'Life-force condition count');
    if (count.kind === 'live-target') {
      percentage(count.maximum, 'Life-force condition maximum');
      if (!Number.isInteger(count.maximum)) throw new TypeError('Life-force condition maximum must be an integer.');
    } else if (count.kind !== 'packet-snapshot' || 'maximum' in count) {
      throw new TypeError('Life-force grant requires a live-target maximum or a packet snapshot.');
    }

    if (unit === 'cast') throw new TypeError('Life-force condition bonuses require an accepted effect.');
  }
}

/** Resolve current tuning against the declared condition observation, without mutating any simulation state. */
const resolveLifeForceAmount: ResourceGrantRecipe['resolve'] = (queries, context, parameters) => {
  validateLifeForceParameters(parameters);
  const runtime = queries as MechanicQueriesOf<NecromancerRuntime>;
  let percent = parameters.percent;
  const bonus = parameters.perCondition;
  if (bonus) {
    const count =
      bonus.count.kind === 'live-target'
        ? Math.min(bonus.count.maximum, runtime.combat.targetConditionCount(runtime.time))
        : context.kind === 'effect'
          ? context.trigger.event.metadata?.necromancerConditionCount
          : undefined;
    if (typeof count !== 'number' || !Number.isFinite(count) || count < 0)
      throw new TypeError('Life-force condition grants require their declared condition count.');
    percent += count * bonus.percent;
  }

  return necromancerLifeForceAmount(runtime, percent);
};

/** Declare one ordinary resource reward, retaining all editable quantities in its formula parameters. */
export function lifeForceGrant({
  id,
  unit,
  grant,
  label
}: {
  readonly id: string;
  readonly unit: LifeForceParameters['unit'];
  readonly grant: LifeForceGrant;
  readonly label?: string;
}): LifeForceGrantAction {
  const parameters: LifeForceParameters = { ...grant, unit };
  validateLifeForceParameters(parameters);
  return {
    type: 'resourceGrant',
    resource: 'lifeForce',
    id,
    label:
      label ??
      {
        hit: 'Life force per hit',
        pulse: 'Life force per pulse',
        application: 'Life force on application',
        cast: 'Life force on cast'
      }[unit],
    amount: { parameters, resolve: resolveLifeForceAmount, validate: validateLifeForceParameters }
  };
}

/** Tooltip readers use the same parameter record as execution and patch authoring. */
function lifeForceActions(actions: readonly ResourceGrantAction[]): readonly LifeForceGrantAction[] {
  return actions.filter((action): action is LifeForceGrantAction => {
    if (action.resource !== 'lifeForce' || typeof action.amount !== 'object' || !('parameters' in action.amount))
      return false;
    validateLifeForceParameters(action.amount.parameters);
    return true;
  });
}

export function effectLifeForceGrants(effect: Pick<SkillEffect, 'reactions'>): readonly LifeForceGrantAction[] {
  return lifeForceActions(effectResourceGrants(effect));
}

export function castLifeForceGrants(skill: Skill | BalanceProfile): readonly LifeForceGrantAction[] {
  return lifeForceActions(castResourceGrants(skill));
}
