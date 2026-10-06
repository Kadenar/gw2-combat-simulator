import type { EnduranceController } from '#gw2/platform/combat/resources/endurance-policy.js';
import type { ResourceController } from '#gw2/platform/combat/resources/resource-policy.js';
import type { CastControl, RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RotationCursor } from '#gw2/platform/execution/rotation-cursor.js';
import type { FlipWindowOptions, SkillFlipWindow } from '#gw2/platform/execution/skill-flips.js';
import type { CooldownController } from '#gw2/platform/execution/cooldown-contracts.js';
import type { SimulationStep } from '#gw2/platform/results/types.js';
import type { MechanicContext, MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { EffectReactionRegistry } from '#gw2/platform/resolver/effect-reactions.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { WorkOwner } from '#gw2/platform/simulation/work-contract.js';
import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/skills/types.js';

/** The single mutable context contains both command control and actual combat state. */
export interface Gw2Runtime<T extends object = object, TSkill extends Skill = Skill> extends Gw2ResolverRuntime {
  /** Live skill lookups retain the profession type while unrelated resolver helpers stay shared. */
  readonly helpers: Omit<Gw2ResolverRuntime['helpers'], 'skills' | 'skillsById' | 'skillsByName'> &
    CanonicalCatalog<TSkill>;
  profession: T;
  time: number;
  inputReadyAt: number;
  combatActive: boolean;
  rotationEndTime: number | null;
  readonly cursor: RotationCursor;
  readonly castController: CastControl;
  readonly effectReactions: EffectReactionRegistry<T>;
  readonly cooldownController: CooldownController;
  readonly mechanics: MechanicContext<T, TSkill>;
  readonly mechanicQueries: MechanicQueryContext<T, TSkill>;
  readonly history: Gw2ResolverEvent[];
  readonly equipmentBuffPolicies: readonly import('#gw2/platform/combat/effect-state.js').BuffStatePolicy[];
  readonly facts: import('#gw2/platform/combat/history/executed-facts.js').ExecutedFactsReader;
  readonly observations: import('#gw2/platform/combat/history/executed-facts.js').ExecutedFactsWriter;
  readonly steps: SimulationStep[];
  resourceController: ResourceController;
  endurance: EnduranceController;
  readonly hasExplicitCombatStart: boolean;
  /**
   * Opens a follow-up window on the profession's Core state. A finite window retires itself at expiry, and only this
   * occurrence: a later rearm of the same skill survives the older deadline.
   */
  armFlip(skillId: SkillId, window?: FlipWindowOptions): SkillFlipWindow;
  /** Retires a follow-up once; an absent window is already consumed. */
  consumeFlip(skillId: SkillId): SkillFlipWindow | undefined;
  /** True once combat has started: always without an explicit marker, otherwise from the executed marker onward. */
  combatStartedAt(at?: number): boolean;
  /** Queues private work; cancellation uses its owner and generation rather than a packet identity. */
  schedule(name: string, at: number, data?: unknown, owner?: WorkOwner, priority?: number): void;
  /** Snapshots cast data without cloning executable skill declarations; handlers receive `{ ...data, cast }`. */
  scheduleForCast(
    name: string,
    at: number,
    cast: RuntimeCast<TSkill>,
    data?: Record<string, unknown>,
    owner?: WorkOwner,
    priority?: number
  ): void;
  cancelOwner(owner: WorkOwner): void;
}
