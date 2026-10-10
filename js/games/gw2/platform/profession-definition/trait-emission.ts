import type { ProfileEmission } from '#gw2/platform/effects/emission.js';
import type { EffectEventBase } from '#gw2/platform/effects/materializer.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { SimulationEvent, SimulationEventBase } from '#gw2/platform/events/events.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

/** Attribution may depend on the accepted cast or event, while profiles keep ownership of effect payloads. */
export type TraitAttribution = Partial<
  EffectEventBase &
    Pick<
      SimulationEventBase,
      'name' | 'priority' | 'offTarget' | 'parentSkillName' | 'icon' | 'skillWeapon' | 'audience'
    >
>;

/** Delivery needs causal identity; complete resolver events also supply default skill attribution. */
export type TraitProfileCause = NonNullable<ProfileEmission['cause']> &
  Partial<Pick<SimulationEventBase, 'skillId' | 'skillName'>>;

export interface TraitProfileOptions {
  /** Explicit delivery preserves accepted cast timing and ownership for deferred trait payloads. */
  readonly at?: number;
  readonly fullEnd?: number;
  readonly skillWeaponFallback?: string;
  readonly cast?: ProfileEmission['cast'];
  /** Cancellation follows the granting mechanic independently of cast attribution. */
  readonly owner?: ProfileEmission['owner'];
  readonly priority?: number;
  readonly settlement?: ProfileEmission['settlement'];
  readonly durationContext?: ProfileEmission['durationContext'];
  /** A named effect uses the same removed-effect validation as authored skill payloads. */
  readonly effect?: { readonly type: SkillEffect['type']; readonly name: string };
  readonly receipt?: boolean;
  /** Identity of the triggering action; defaults to the cause's identity. */
  readonly skillId?: SkillId | null;
  readonly skillName?: string;
  readonly activationId?: string;
  readonly effects?: (effect: SkillEffect) => boolean;
  readonly attribution?: TraitAttribution | ((effect: SkillEffect) => TraitAttribution);
  /** Keep profile-authored component labels when the existing delivery distinguishes sibling effects. */
  readonly preserveName?: boolean;
  /** Preserve effect-specific labels and audience while using the shared profile materializer. */
  readonly transform?: ProfileEmission['transform'];
}

/**
 * Emit a trait-owned balance profile. The trait owns attribution and the profile owns the payload, so compiled
 * triggers and imperative listeners produce identical packets for the same profile.
 */
export function emitTraitProfile(
  runtime: Pick<MechanicCombatContext, 'effects' | 'helpers'>,
  trait: SkillId,
  profileId: SkillId,
  cause: TraitProfileCause | null | undefined,
  options: TraitProfileOptions & { readonly receipt: true }
): readonly SimulationEvent[];
export function emitTraitProfile(
  runtime: Pick<MechanicCombatContext, 'effects' | 'helpers'>,
  trait: SkillId,
  profileId: SkillId,
  cause: TraitProfileCause | null | undefined,
  options?: TraitProfileOptions
): void;
export function emitTraitProfile(
  runtime: Pick<MechanicCombatContext, 'effects' | 'helpers'>,
  trait: SkillId,
  profileId: SkillId,
  cause: TraitProfileCause | null | undefined,
  options: TraitProfileOptions = {}
): readonly SimulationEvent[] | void {
  const { attribution } = options;
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  const namedEffect = options.effect ? requireEffect(profile, options.effect.type, options.effect.name) : undefined;
  const effects = options.effect ? (namedEffect ? [namedEffect] : []) : profile.effects;
  // Effect-specific identity preserves authored actor ownership across mixed profiles.
  const attributionFor = (effect: SkillEffect): TraitAttribution =>
    (typeof attribution === 'function' ? attribution(effect) : attribution) ?? {};
  const baseAttribution = {
    source: 'Trait',
    sourceId: trait,
    actorType: 'effect' as const,
    skillId: options.skillId === undefined ? cause?.skillId : options.skillId,
    skillName: options.skillName ?? cause?.skillName,
    activationId: options.activationId ?? cause?.activationId ?? options.cast?.activationId
  };
  const request: ProfileEmission = {
    kind: 'profile',
    profile,
    effects: options.effects ? effects?.filter(options.effects) : effects,
    at: options.at,
    fullEnd: options.fullEnd,
    skillWeaponFallback: options.skillWeaponFallback,
    cast: options.cast,
    owner: options.owner,
    priority: options.priority,
    settlement: options.settlement,
    durationContext: options.durationContext,
    cause,
    transform: (event, effect) => {
      // Metadata was merged with authored effect/tick annotations during materialization; identity must not erase it.
      const { metadata: _metadata, ...identity } = attributionFor(effect);
      const attributed = {
        ...event,
        name: options.preserveName ? event.name : profile.name,
        ...identity
      };
      return options.transform ? options.transform(attributed, effect) : attributed;
    },
    attribution:
      typeof attribution === 'function'
        ? (effect) => ({ ...baseAttribution, ...attributionFor(effect) })
        : { ...baseAttribution, ...attribution }
  };
  if (options.receipt) return runtime.effects.emit({ ...request, receipt: true });
  runtime.effects.emit(request);
}

export interface TraitSkillOptions {
  /** Report the trait proc beside the skill's own packets. */
  readonly announce?: boolean;
  readonly ownerActorType?: EffectEventBase['ownerActorType'];
}

/**
 * Invoke a triggered skill under its own identity, keeping the trigger only as cause and parent. Returns false when the
 * selected patch removed the skill's effects, so callers can leave armed state armed.
 */
export function invokeTraitSkill(
  runtime: Pick<MechanicCombatContext, 'effects' | 'helpers'>,
  trait: SkillId,
  skillId: SkillId,
  cause: Gw2ResolverEvent,
  options: TraitSkillOptions = {}
): boolean {
  const skill = runtime.helpers.skillsById.get(skillId);
  if (!skill) throw new TypeError(`Trait ${trait} invokes unknown skill ${skillId}.`);
  if (!skill.effects?.length) return false;
  runtime.effects.emit({
    kind: 'profile',
    profile: skill,
    at: cause.at,
    cause,
    attribution: {
      source: 'Trait',
      sourceId: skill.id,
      actorType: 'effect',
      ownerActorType: options.ownerActorType ?? 'player',
      skillId: skill.id,
      skillName: skill.name,
      triggeredBy: cause.skillName
    },
    transform: (event) => ({ ...event, parentSkillName: cause.skillName, icon: skill.icon })
  });
  if (options.announce)
    runtime.effects.emit({
      kind: 'announcement',
      attribution: { source: 'Trait', sourceId: trait, actorType: 'effect' },
      cause,
      announcement: { type: 'trait', name: skill.name, at: cause.at, sourceSkill: cause.skillName, icon: skill.icon }
    });
  return true;
}
