import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

type ToolbeltReaction = (runtime: EngineerRuntime, skill: EngineerSkill, at: number) => void;
type DodgeReaction = (runtime: EngineerRuntime, cast: RuntimeCast<EngineerSkill>) => void;
const toolbeltReactions = new WeakMap<object, ToolbeltReaction[]>();
const dodgeReactions = new WeakMap<object, DodgeReaction[]>();

/** Trait initialization registers synchronous reactions on this simulation's state, in declaration order. */
export function registerToolbeltReaction(runtime: EngineerRuntime, reaction: ToolbeltReaction): void {
  const owner = runtime.profession.core;
  const reactions = toolbeltReactions.get(owner) ?? [];
  reactions.push(reaction);
  toolbeltReactions.set(owner, reactions);
}

/** Dodge rewards run at acceptance; the queued dodge event separately rearms Explosive Entrance. */
export function registerDodgeReaction(runtime: EngineerRuntime, reaction: DodgeReaction): void {
  const owner = runtime.profession.core;
  const reactions = dodgeReactions.get(owner) ?? [];
  reactions.push(reaction);
  dodgeReactions.set(owner, reactions);
}

/** Detects explicit specialization toolbelt skills and ordinary parent-linked toolbelt skills. */
export function isEngineerToolbeltSkill(skill: EngineerSkill | undefined): boolean {
  return skill?.countsAsToolbeltSkill ?? Boolean(skill?.toolbeltParentId);
}

/** All toolbelt entry paths notify the same trait-owned listeners without adding a queued-event delay. */
export function notifyToolbeltActivation(runtime: EngineerRuntime, skill: EngineerSkill, at: number): void {
  if (!isEngineerToolbeltSkill(skill)) return;
  for (const reaction of toolbeltReactions.get(runtime.profession.core) ?? []) reaction(runtime, skill, at);
}

/** Publish accepted dodges after their packet is queued, preserving recharge-reduction ordering. */
export function notifyDodgeActivation(runtime: EngineerRuntime, cast: RuntimeCast<EngineerSkill>): void {
  for (const reaction of dodgeReactions.get(runtime.profession.core) ?? []) reaction(runtime, cast);
}
