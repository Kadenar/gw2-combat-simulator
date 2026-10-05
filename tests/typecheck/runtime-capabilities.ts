import type { CastDetailContext, EffectOwnershipContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import type { MechanicContext, MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';

// Negative checks guard the canonical family, not a separately narrowed test-only alias.
function ownership(context: EffectOwnershipContext<WarriorSkill>) {
  const charges: boolean | undefined = context.skillFor(1)?.dragonSlash;
  // @ts-expect-error Lifetime selection cannot inspect or mutate the command cursor.
  context.cursor.consume();
  // @ts-expect-error Lifetime selection cannot enqueue directly.
  context.queue.enqueue({});
  // @ts-expect-error Lifetime selection cannot write reporting history.
  context.history.push({});
  // @ts-expect-error Lifetime selection cannot mutate unrelated mechanic state.
  context.profession.core.adrenaline.value = 0;
  // @ts-expect-error Lifetime selection has no runtime escape hatch.
  context.runtime;
  // @ts-expect-error Selected-content queries cannot be replaced by a mechanic.
  context.skillFor = () => undefined;
  return charges;
}

const hooks: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = {
  availability(context, skill) {
    const slash: boolean | undefined = skill.dragonSlash;
    context.endurance.readyAt(50);
    context.cooldownController.readAmmo(skill.id);
    // Gameplay observations are readable here, but recording is reserved for lifecycle/event handlers.
    context.facts.read();
    // @ts-expect-error Readiness cannot acquire the history writer.
    context.observations;
    // @ts-expect-error Readers cannot interrupt recorded actions.
    context.facts.interruptAction('cast:1', context.time);
    // @ts-expect-error Readiness cannot change an owned resource.
    context.profession.core.adrenaline.value = 0;
    // @ts-expect-error Readiness cannot spend while projecting affordability.
    context.endurance.spend(50);
    // @ts-expect-error Readiness cannot advance ammunition or publish work.
    context.cooldownController.refreshAmmo(skill, context.time);
    void slash;
    return { ready: true };
  },
  modifySkillId(context, skillId) {
    context.hasTrait(1);
    // @ts-expect-error Skill identity selection has no profession-state reader.
    context.readProfessionState();
    // @ts-expect-error Identity selection cannot observe or mutate mechanic state.
    context.profession;
    // @ts-expect-error Identity selection has no command cursor.
    context.cursor;
    return skillId;
  },
  rechargeStart(context, cast, at) {
    const dragonSlash: boolean | undefined = cast.skill.dragonSlash;
    context.requireBalanceProfile(1);
    // @ts-expect-error Recharge anchor policies cannot move the clock.
    context.time = 0;
    // @ts-expect-error Recharge anchor policies cannot mutate existing recharge.
    context.cooldownController;
    void dragonSlash;
    return at;
  },
  boonDuration(context, _event, _base, scaled) {
    context.hasTrait(1);
    context.requireBalanceProfile(1);
    // @ts-expect-error Duration policy cannot publish additional effects.
    context.effects;
    // @ts-expect-error Duration policy cannot alter its profession's state.
    context.profession;
    return scaled;
  },
  maximumAmmo(context, skill, maximum) {
    // Capacity policies retain concrete skills and content queries while losing unrelated execution capabilities.
    const dragonSlash: boolean | undefined = skill.dragonSlash;
    const state = context.readProfessionState();
    const trait: boolean = context.hasTrait(1);
    const profile = context.requireBalanceProfile(1);
    // @ts-expect-error A capacity policy cannot mutate nested mechanic state.
    state.core.adrenaline.value = 0;
    // @ts-expect-error A capacity policy cannot mutate the pool it is configuring.
    context.ammo.clear();
    // @ts-expect-error Capacity selection cannot reset recharge.
    context.cooldownController.resetAll();
    // @ts-expect-error There is no runtime escape hatch or registry identity.
    context.runtime;
    // @ts-expect-error Capacity selection cannot inspect commands.
    context.cursor;
    // @ts-expect-error Selected-content queries cannot be replaced.
    context.requireBalanceProfile = () => profile;
    // @ts-expect-error Selected catalog maps are not exposed.
    context.helpers;
    // @ts-expect-error Capacity selection cannot write executed facts.
    context.history.push({});
    // @ts-expect-error Capacity selection cannot enqueue work.
    context.queue;
    void dragonSlash;
    void trait;
    return maximum;
  },
  castDetail(context, cast) {
    const dragonSlash: boolean | undefined = cast.skill.dragonSlash;
    const state = context.readProfessionState();
    // @ts-expect-error A label cannot mutate its profession's nested state.
    state.core.adrenaline.value = 0;
    if (state.specialization.kind === 'Bladesworn') {
      const charges: number = state.specialization.state.dragonCharges.value;
      // @ts-expect-error Maps remain queryable but release retirement belongs to the mechanic.
      state.specialization.state.dragonSlashReleases.clear();
      // @ts-expect-error Charge observations cannot be changed through a label.
      state.specialization.state.dragonChargeReachedAt.push(0);
      void charges;
    }

    // @ts-expect-error Acceptance labels cannot consume the current command.
    context.cursor.consume();
    // @ts-expect-error Acceptance labels cannot mutate cooldowns or resources.
    context.cooldownController.resetAll();
    // @ts-expect-error Acceptance labels cannot enqueue work.
    context.queue.enqueue({});
    // @ts-expect-error Acceptance labels cannot append report history.
    context.history.push({});
    // @ts-expect-error There is no aggregate runtime escape hatch.
    context.runtime;
    // @ts-expect-error The state query itself cannot be replaced.
    context.readProfessionState = () => state;
    return dragonSlash ? 'Release' : undefined;
  },
  effectOwner(context) {
    ownership(context);
    return undefined;
  }
};
composeRuntimeHooks([hooks]);

function castStores(runtime: Gw2Runtime<WarriorRuntimeState, WarriorSkill>) {
  runtime.castController.hasInFlight(1);
  const release = runtime.castController.pendingChargeRelease();
  if (release) {
    const charges: number | undefined = release.charges;
    // @ts-expect-error Release intent is immutable.
    release.charges = 1;
    // @ts-expect-error Release intent has no cursor operations.
    release.consume();
    // @ts-expect-error The raw authored command is not exposed.
    release.command;
    void charges;
  }

  // @ts-expect-error Reservations belong to cast execution, not profession callbacks.
  runtime.inFlight.clear();
  // @ts-expect-error Lockout mutations must use their owner.
  runtime.lockouts.clear();
}

void castStores;

function readOnlyCollections(
  context: CastDetailContext<{ entries: Map<string, { count: number }>; flags: Set<string>; act: () => void }>
) {
  const state = context.readProfessionState();
  const count: number | undefined = state.entries.get('entry')?.count;
  // @ts-expect-error Map entries also lose their mutation capabilities.
  state.entries.get('entry')!.count = 1;
  // @ts-expect-error Sets expose membership queries, never mutations.
  state.flags.add('changed');
  // @ts-expect-error State-owned operations cannot be invoked from a label.
  state.act();
  return count;
}

void readOnlyCollections;

/** Author capabilities expose deliberate operations and concrete data, never another owner's writable storage. */
function mechanicBoundaries(context: MechanicContext<WarriorRuntimeState, WarriorSkill>) {
  context.resourceController.replace('motivation', 0);
  context.resourceController.replace('adrenaline', 1);
  context.cooldownController.setReadyAt(1, 2);
  // @ts-expect-error Only cast execution can reset every cooldown.
  context.cooldownController.resetAll();
  // @ts-expect-error Only cast execution can spend cast ammunition.
  context.cooldownController.spendAmmo;
  // @ts-expect-error Only cast execution can commit an ammunition lockout.
  context.cooldownController.setAmmoLockout;
  // @ts-expect-error Internal lockout work is not an ammunition observation.
  context.cooldownController.readAmmo(1)!.lockoutProgress;
  context.castController.lockInputUntil(2);
  context.procs.setDeadline('trait', 2);
  // @ts-expect-error Only the coordinator controls the clock.
  context.time = 2;
  // @ts-expect-error Named work replaces access to the shared heap.
  context.queue.enqueue({});
  // @ts-expect-error Mechanics cannot inspect future commands.
  context.cursor.command;
  // @ts-expect-error Recharge observations cannot mutate the owner's magazine.
  context.cooldownController.readAmmo(1)!.charges = 0;
  // @ts-expect-error Nested recharge work is read-only too.
  context.cooldownController.readAmmo(1)!.recharges.push({ startedAt: 0, work: 1 });
  // @ts-expect-error Proc storage remains private to its owner.
  context.procs.readyAt.trait = 0;
  // @ts-expect-error Report arrays are unavailable to author callbacks.
  context.resolved.push({});
  // @ts-expect-error Executed observations cannot be rewritten by their readers.
  context.facts.read()[0].at = 0;
  // @ts-expect-error Bound services do not expose the aggregate owner.
  context.combat.runtime;
}

function queryBoundaries(context: MechanicQueryContext<WarriorRuntimeState, WarriorSkill>) {
  const skill: WarriorSkill | undefined = context.helpers.skillsById.get(1);
  context.combat.targetHealthBelow(0.5);
  // @ts-expect-error Query callbacks do not receive the unused proc capability.
  context.procs;
  // @ts-expect-error Query callbacks cannot schedule or emit effects.
  context.effects.emit({});
  // @ts-expect-error Query callbacks cannot revise boon state.
  context.combat.reviseBoonExpiry(
    'fury',
    () => true,
    () => 0
  );
  // @ts-expect-error Query callbacks cannot rewrite executed actions.
  context.observations.interruptAction('cast', 0);
  // @ts-expect-error Query callbacks cannot claim a proc while checking eligibility.
  context.procs.claim('trait');
  // @ts-expect-error Query callbacks cannot change the accepted input lane.
  context.castController.lockInputUntil(1);
  // @ts-expect-error Readiness cannot settle resource clocks.
  context.resourceController.advance();
  context.resourceController.value('affinity');
  context.resourceController.readyAt('affinity', 1);
  // @ts-expect-error Read-only queries cannot replace a balance.
  context.resourceController.replace('affinity', 0);
  // @ts-expect-error Read-only queries cannot grant resources.
  context.resourceController.grant('affinity', 1);
  return skill;
}

void mechanicBoundaries;
void queryBoundaries;
