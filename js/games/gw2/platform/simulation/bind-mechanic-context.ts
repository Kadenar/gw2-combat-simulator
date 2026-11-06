/** Contexts compose owner-provided capabilities while private live accessors preserve state replacement. */
import { createEnduranceQueries } from '#gw2/platform/combat/resources/endurance-controller.js';
import { createResourceQueries } from '#gw2/platform/combat/resources/resource-controller.js';
import { createCastQueries } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext, MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { ReadonlyMechanicState } from '#gw2/platform/profession-definition/runtime-context.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Shared accessors keep per-run capability shapes stable while following live owner state. */
class MechanicQueries<T extends object, TSkill extends Skill> implements MechanicQueryContext<T, TSkill> {
  readonly #runtime: Gw2Runtime<T, TSkill>;
  readonly combat: MechanicQueryContext<T, TSkill>['combat'];
  readonly castController: MechanicQueryContext<T, TSkill>['castController'];
  readonly resourceController: MechanicQueryContext<T, TSkill>['resourceController'];
  readonly endurance: MechanicQueryContext<T, TSkill>['endurance'];
  readonly facts: MechanicQueryContext<T, TSkill>['facts'];
  readonly cooldownController: MechanicQueryContext<T, TSkill>['cooldownController'];
  readonly autoattackController: MechanicQueryContext<T, TSkill>['autoattackController'];
  constructor(runtime: Gw2Runtime<T, TSkill>) {
    this.#runtime = runtime;
    this.combat = runtime.combat.queries;
    this.castController = createCastQueries(() => runtime.castController);
    this.resourceController = createResourceQueries(() => runtime.resourceController);
    this.endurance = createEnduranceQueries(() => runtime.endurance);
    this.facts = runtime.facts;
    this.cooldownController = runtime.cooldownController.queries;
    this.autoattackController = runtime.autoattackController.queries;
  }

  get profession() {
    return this.#runtime.profession as ReadonlyMechanicState<T>;
  }

  get flips() {
    return this.#runtime.flips;
  }

  get config() {
    return this.#runtime.config;
  }

  get time() {
    return this.#runtime.time;
  }

  get engagement() {
    return this.#runtime.engagement;
  }

  get activeWeaponSet() {
    return this.#runtime.activeWeaponSet;
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
  readonly combat: MechanicContext<T, TSkill>['combat'];
  readonly procs: MechanicContext<T, TSkill>['procs'];
  readonly cooldownController: MechanicContext<T, TSkill>['cooldownController'];
  readonly autoattackController: MechanicContext<T, TSkill>['autoattackController'];
  readonly facts: MechanicContext<T, TSkill>['facts'];
  readonly observations: MechanicContext<T, TSkill>['observations'];
  readonly effectReactions: MechanicContext<T, TSkill>['effectReactions'];
  readonly armFlip: MechanicContext<T, TSkill>['armFlip'];
  readonly consumeFlip: MechanicContext<T, TSkill>['consumeFlip'];
  readonly clearFlip: MechanicContext<T, TSkill>['clearFlip'];
  readonly expireFlip: MechanicContext<T, TSkill>['expireFlip'];
  readonly schedule: MechanicContext<T, TSkill>['schedule'];
  readonly scheduleForCast: MechanicContext<T, TSkill>['scheduleForCast'];
  readonly cancelOwner: MechanicContext<T, TSkill>['cancelOwner'];
  readonly fireTrigger: MechanicContext<T, TSkill>['fireTrigger'];
  constructor(runtime: Gw2Runtime<T, TSkill>) {
    this.#runtime = runtime;
    this.combat = runtime.combat;
    this.procs = runtime.procs;
    this.autoattackController = runtime.autoattackController.mechanics;
    this.cooldownController = runtime.cooldownController.mechanics;
    this.facts = runtime.facts;
    this.observations = runtime.observations;
    this.effectReactions = runtime.effectReactions.registration;
    this.armFlip = runtime.armFlip;
    this.consumeFlip = runtime.consumeFlip;
    this.clearFlip = runtime.clearFlip;
    this.expireFlip = runtime.expireFlip;
    this.schedule = runtime.schedule;
    this.scheduleForCast = runtime.scheduleForCast;
    this.cancelOwner = runtime.cancelOwner;
    this.fireTrigger = runtime.fireTrigger;
  }

  get queries() {
    return this.#runtime.mechanicQueries;
  }

  get flips() {
    return this.#runtime.flips;
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

  get engagement() {
    return this.#runtime.engagement;
  }

  get activeWeaponSet() {
    return this.#runtime.activeWeaponSet;
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

  get alliedStrikes() {
    return this.#runtime.alliedStrikeController.grants;
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
