import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { ResourceKey } from '#gw2/platform/combat/resources/resource-policy.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { MechanicContext, MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { ReadonlyMechanicState } from '#gw2/platform/profession-definition/runtime-context.js';

/** Shared accessors keep per-run capability shapes stable while following live owner state. */
class MechanicQueries<T extends object, TSkill extends Skill> implements MechanicQueryContext<T, TSkill> {
  readonly #runtime: Gw2Runtime<T, TSkill>;
  readonly hasExplicitCombatStart: MechanicQueryContext<T, TSkill>['hasExplicitCombatStart'];
  readonly combat: MechanicQueryContext<T, TSkill>['combat'];
  readonly castController: MechanicQueryContext<T, TSkill>['castController'];
  readonly resourceController: MechanicQueryContext<T, TSkill>['resourceController'];
  readonly endurance: MechanicQueryContext<T, TSkill>['endurance'];
  readonly procs: MechanicQueryContext<T, TSkill>['procs'];
  readonly facts: MechanicQueryContext<T, TSkill>['facts'];
  readonly cooldownController: MechanicQueryContext<T, TSkill>['cooldownController'];
  readonly combatStartedAt: MechanicQueryContext<T, TSkill>['combatStartedAt'];
  constructor(runtime: Gw2Runtime<T, TSkill>) {
    this.#runtime = runtime;
    const combat = runtime.combat;
    const recharge = runtime.cooldownController;
    this.hasExplicitCombatStart = runtime.hasExplicitCombatStart;
    this.combat = Object.freeze({
      activeBoonStacks: combat.activeBoonStacks,
      boonApplications: combat.boonApplications,
      get timeline() {
        return combat.timeline;
      },
      targetHasCondition: combat.targetHasCondition,
      targetConditionStacks: combat.targetConditionStacks,
      targetConditionCount: combat.targetConditionCount,
      targetHealthLoss: combat.targetHealthLoss,
      targetHealthBelow: combat.targetHealthBelow,
      remainingTargetHealthFraction: combat.remainingTargetHealthFraction,
      statsAt: combat.statsAt,
      conditionDurationMultiplier: combat.conditionDurationMultiplier
    });
    this.castController = Object.freeze({
      hasInFlight: (id: SkillId) => runtime.castController.hasInFlight(id),
      inFlightSkillIds: () => runtime.castController.inFlightSkillIds(),
      currentLaneEnd: () => runtime.castController.currentLaneEnd(),
      pendingCombatStart: () => runtime.castController.pendingCombatStart(),
      pendingChargeRelease: () => runtime.castController.pendingChargeRelease()
    });
    this.resourceController = Object.freeze({
      value: (key: ResourceKey) => runtime.resourceController.value(key),
      readyAt: (key: ResourceKey, cost: number) => runtime.resourceController.readyAt(key, cost)
    });
    this.endurance = Object.freeze({ readyAt: (cost: number) => runtime.endurance.readyAt(cost) });
    this.procs = Object.freeze({ deadline: runtime.procs.deadline });
    this.facts = Object.freeze({
      read: runtime.facts.read,
      ofType: runtime.facts.ofType,
      actionFor: runtime.facts.actionFor
    });
    this.cooldownController = Object.freeze({
      readyAt: recharge.readyAt,
      hasCooldown: recharge.hasCooldown,
      hasAmmo: recharge.hasAmmo,
      readAmmo: recharge.readAmmo,
      rechargeFor: recharge.rechargeFor,
      rate: recharge.rate,
      project: recharge.project,
      remaining: recharge.remaining
    });
    this.combatStartedAt = runtime.combatStartedAt;
  }

  get profession() {
    return this.#runtime.profession as ReadonlyMechanicState<T>;
  }

  get config() {
    return this.#runtime.config;
  }

  get time() {
    return this.#runtime.time;
  }

  get activeWeaponSet() {
    return this.#runtime.activeWeaponSet;
  }

  get combatStartTime() {
    return this.#runtime.combatStartTime;
  }

  get combatStartPending() {
    return this.#runtime.combatStartPending;
  }

  get combatActive() {
    return this.#runtime.combatActive;
  }

  get traits() {
    return this.#runtime.traits;
  }

  get helpers() {
    return this.#runtime.helpers;
  }
}

/** One frozen query capability follows state replacement without exposing its private owner reference. */
export function createMechanicQueryContext<T extends object, TSkill extends Skill>(
  runtime: Gw2Runtime<T, TSkill>
): MechanicQueryContext<T, TSkill> {
  return Object.freeze(new MechanicQueries(runtime));
}

/** Shared accessors preserve live service replacement without allocating new getter functions for every run. */
class MechanicCommands<T extends object, TSkill extends Skill> implements MechanicContext<T, TSkill> {
  readonly #runtime: Gw2Runtime<T, TSkill>;
  readonly hasExplicitCombatStart: MechanicContext<T, TSkill>['hasExplicitCombatStart'];
  readonly combat: MechanicContext<T, TSkill>['combat'];
  readonly procs: MechanicContext<T, TSkill>['procs'];
  readonly cooldownController: MechanicContext<T, TSkill>['cooldownController'];
  readonly facts: MechanicContext<T, TSkill>['facts'];
  readonly observations: MechanicContext<T, TSkill>['observations'];
  readonly effectReactions: MechanicContext<T, TSkill>['effectReactions'];
  readonly armFlip: MechanicContext<T, TSkill>['armFlip'];
  readonly consumeFlip: MechanicContext<T, TSkill>['consumeFlip'];
  readonly combatStartedAt: MechanicContext<T, TSkill>['combatStartedAt'];
  readonly schedule: MechanicContext<T, TSkill>['schedule'];
  readonly scheduleForCast: MechanicContext<T, TSkill>['scheduleForCast'];
  readonly cancelOwner: MechanicContext<T, TSkill>['cancelOwner'];
  constructor(runtime: Gw2Runtime<T, TSkill>) {
    this.#runtime = runtime;
    this.hasExplicitCombatStart = runtime.hasExplicitCombatStart;
    this.combat = runtime.combat;
    this.procs = runtime.procs;
    this.cooldownController = runtime.cooldownController;
    this.facts = runtime.facts;
    this.observations = runtime.observations;
    this.effectReactions = Object.freeze({ register: runtime.effectReactions.register });
    this.armFlip = runtime.armFlip;
    this.consumeFlip = runtime.consumeFlip;
    this.combatStartedAt = runtime.combatStartedAt;
    this.schedule = runtime.schedule;
    this.scheduleForCast = runtime.scheduleForCast;
    this.cancelOwner = runtime.cancelOwner;
  }

  get queries() {
    return this.#runtime.mechanicQueries;
  }

  get profession() {
    return this.#runtime.profession;
  }

  set profession(state: T) {
    this.#runtime.profession = state;
  }

  get config() {
    return this.#runtime.config;
  }

  get time() {
    return this.#runtime.time;
  }

  get activeWeaponSet() {
    return this.#runtime.activeWeaponSet;
  }

  get combatStartTime() {
    return this.#runtime.combatStartTime;
  }

  get combatStartPending() {
    return this.#runtime.combatStartPending;
  }

  get combatActive() {
    return this.#runtime.combatActive;
  }

  get deathTime() {
    return this.#runtime.deathTime;
  }

  get castController() {
    return this.#runtime.castController;
  }

  get resourceController() {
    return this.#runtime.resourceController;
  }

  get endurance() {
    return this.#runtime.endurance;
  }

  get traits() {
    return this.#runtime.traits;
  }

  get helpers() {
    return this.#runtime.helpers;
  }

  get effects() {
    return this.#runtime.effects;
  }

  get random() {
    return this.#runtime.random;
  }
}

/** Bind the named author operations once per run; the aggregate owner remains inaccessible to consumers. */
export function createMechanicContext<T extends object, TSkill extends Skill>(
  runtime: Gw2Runtime<T, TSkill>
): MechanicContext<T, TSkill> {
  return Object.freeze(new MechanicCommands(runtime));
}
