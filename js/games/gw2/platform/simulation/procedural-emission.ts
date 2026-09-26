/**
 * Shared building blocks for packets that profession mechanics build themselves rather than materialize from a cast's
 * authored effects. Professions keep only their own attribution defaults; splitting, effect expansion, deferral, and
 * boon-duration sampling are the same everywhere, so they live here and in `Gw2Runtime.emitProcedural`.
 */
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import type { EffectEventBase } from '#gw2/platform/engine/effects/materializer.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { BalanceProfile, Skill, SkillEffect } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';

/** A procedural strike whose total coefficient is divided across its hits. */
export interface ProceduralStrike {
  readonly at: number;
  readonly coefficient: number;
  readonly hits?: number;
  readonly hitIndex?: number;
  readonly totalHits?: number;
}

/**
 * Divides one procedural strike into single-hit packets so each hit is an independent resolved-hit fact. The total
 * coefficient is shared equally; `intervalSeconds` spaces consecutive hits, and explicit hit positions are kept.
 */
export function splitStrikeHits<T extends ProceduralStrike>(packet: T, intervalSeconds = 0): T[] {
  const hits = Math.max(1, Math.trunc(Number(packet.hits ?? 1)));
  return Array.from({ length: hits }, (_, index) => ({
    ...packet,
    at: packet.at + index * intervalSeconds,
    coefficient: Number(packet.coefficient || 0) / hits,
    hits: 1,
    hitIndex: packet.hitIndex ?? index + 1,
    totalHits: packet.totalHits ?? hits
  }));
}

/** Weapon identity for a mechanic's strike: the skill's own weapon, or none for utility and profession skills. */
export function proceduralSkillWeapon(skill: Pick<Skill, 'skillWeapon' | 'type' | 'weapon'>): string {
  return skill.skillWeapon ?? (skill.type === 'Weapon' ? String(skill.weapon || '') : 'Unequipped');
}

export interface EmitEffectsOptions {
  /** The skill or balance profile whose effects are expanded; it names and times the packets. */
  readonly owner: Skill | BalanceProfile;
  /** Defaults to the owner's authored effects. */
  readonly effects?: readonly SkillEffect[];
  /** Cast start for cast-anchored timing; defaults to now. */
  readonly at?: number;
  /** Cast end for end-anchored timing; defaults to `at`. */
  readonly fullEnd?: number;
  /** Attribution for every packet, or per effect when the effect's own actor or source decides it. */
  readonly baseEvent: EffectEventBase | ((effect: SkillEffect) => EffectEventBase);
  readonly skillWeaponFallback?: string;
  /** The triggering packet each emitted packet is placed beside. */
  readonly cause?: Gw2ResolverEvent | null;
  /** Adjusts one materialized packet before emission, for profession-specific attribution or delivery fields. */
  readonly transform?: (event: SimulationEventBase, effect: SkillEffect) => SimulationEventBase;
}

/**
 * Expands a skill's or balance profile's effects at one instant and emits each packet procedurally. Trait procs,
 * state-selected skill variants, and delayed detonations all share this path instead of repeating the expansion loop.
 */
export function emitEffects<T extends object>(runtime: Gw2Runtime<T>, options: EmitEffectsOptions): void {
  const at = options.at ?? runtime.time;
  for (const effect of options.effects ?? options.owner.effects ?? []) {
    for (const { event } of materializeSkillEffectApplications({
      skill: options.owner as Skill,
      effect,
      start: at,
      fullEnd: options.fullEnd ?? at,
      baseEvent: typeof options.baseEvent === 'function' ? options.baseEvent(effect) : options.baseEvent,
      skillWeaponFallback: options.skillWeaponFallback
    }))
      runtime.emitProcedural(options.transform ? options.transform(event, effect) : event, { cause: options.cause });
  }
}
