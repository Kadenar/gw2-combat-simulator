/**
 * Observation: damage accounting, audit events, and end-of-run projections.
 *
 * Ports `system/audit.cpp`. Damage totals are accumulated in every output mode
 * so score runs and detailed runs report identical numbers; only the event
 * history is limited to detailed runs. Audit reads state but never changes
 * combat behavior or consumes random draws.
 */
import { getSkill, canCastSkill } from '#gw2/platform/combat-engine/queries.js';
import { effectiveEffectDuration } from '#gw2/platform/combat-engine/effect-rules.js';
import { entityName, ownerOf, view } from '#gw2/platform/combat-engine/registry.js';
import { relativeAttribute } from '#gw2/platform/combat-engine/systems/attributes.js';
import type { AuditType, Effect } from '#gw2/platform/combat-engine/configuration.js';
import type { Entity, Registry } from '#gw2/platform/combat-engine/registry.js';
import type { AuditEvent, DamageType, SkillStatus } from '#gw2/platform/combat-engine/types.js';

const DAMAGE_TYPES: Partial<Record<Effect, DamageType>> = {
  BURNING: 'burning',
  BLEEDING: 'bleeding',
  TORMENT: 'torment_stationary',
  POISON: 'poison',
  CONFUSION: 'confusion',
  BINDING_BLADE: 'binding_blade'
};

export interface DamageTotals {
  total: number;
  readonly bySourceActor: Map<string, number>;
}

type EventBody = AuditEvent extends infer Event
  ? Event extends AuditEvent
    ? Omit<Event, 'timeMs' | 'actor'>
    : never
  : never;

function record(registry: Registry, type: AuditType, actorEntity: Entity, body: EventBody): void {
  if (!registry.detailed || !registry.encounter.auditsToPerform.has(type)) return;
  registry.auditEvents.push({ timeMs: registry.tick, actor: entityName(registry, actorEntity), ...body } as AuditEvent);
}

export function recordActorCreated(registry: Registry, actorEntity: Entity): void {
  record(registry, 'ACTOR_CREATED', actorEntity, { type: 'actor_created' });
}

export function audit(registry: Registry, damage: DamageTotals): void {
  registry.actorCreated.forEach((entity) => recordActorCreated(registry, entity));

  if (registry.detailed) {
    registry.skillsActions.forEach((actorEntity, states) => {
      for (const state of states) {
        if (state.actionProgress[0] + state.actionProgress[1] > 1) continue;
        const skill = registry.isSkill.get(state.skillEntity);
        const castDuration = registry.hasQuickness.has(actorEntity) ? skill.castDuration[1] : skill.castDuration[0];
        record(registry, 'SKILL_CASTS', actorEntity, { type: 'skill_cast_begin', skill: skill.skillKey, castDuration });
      }
    });
    registry.finishedCastingSkills.forEach((actorEntity, skillEntities) => {
      for (const skillEntity of skillEntities) {
        record(registry, 'SKILL_CASTS', actorEntity, {
          type: 'skill_cast_end',
          skill: registry.isSkill.get(skillEntity).skillKey
        });
      }
    });
    registry.equippedBundle.forEach((actorEntity, bundle) =>
      record(registry, 'BUNDLES', actorEntity, { type: 'equipped_bundle', bundle })
    );
    registry.droppedBundle.forEach((actorEntity, bundle) =>
      record(registry, 'BUNDLES', actorEntity, { type: 'dropped_bundle', bundle })
    );
    registry.incomingEffects.forEach((actorEntity, applications) => {
      for (const { sourceEntity, application } of applications) {
        const actualSource = ownerOf(registry, sourceEntity);
        const durationMs =
          application.effect == null
            ? application.baseDurationMs
            : effectiveEffectDuration(application.baseDurationMs, application.effect, (attribute) =>
                relativeAttribute(registry, actualSource, actorEntity, attribute)
              );
        record(registry, 'EFFECT_APPLICATIONS', actorEntity, {
          type: 'effect_application',
          sourceActor: entityName(registry, actualSource),
          sourceSkill: application.sourceSkill,
          effect: application.effect ?? '',
          uniqueEffect: application.uniqueEffect.uniqueEffectKey,
          numStacks: application.numStacks,
          durationMs
        });
      }
    });
  }

  registry.incomingDamage.forEach((actorEntity, events) => {
    for (const event of events) {
      const damageType: DamageType | undefined =
        event.effect == null ? (event.skill === '' ? undefined : 'strike') : DAMAGE_TYPES[event.effect];
      if (damageType === undefined) throw new Error('Unknown source for damage!');
      const sourceActor = entityName(registry, event.sourceEntity);
      damage.total += event.value;
      damage.bySourceActor.set(sourceActor, (damage.bySourceActor.get(sourceActor) ?? 0) + event.value);
      if (!registry.detailed || !registry.encounter.auditsToPerform.has('DAMAGE')) continue;

      // Attribution lookup is presentation only, so score runs skip it without affecting totals.
      let sourceSkill = 'unknown_skill';
      if (event.skill !== '') {
        const skill = getSkill(registry, event.skill, event.sourceEntity);
        sourceSkill = skill.attributeDamageToSkill === '' ? skill.skillKey : skill.attributeDamageToSkill;
      }

      record(registry, 'DAMAGE', actorEntity, {
        type: 'damage',
        sourceActor,
        sourceSkill,
        damageType,
        damage: event.value
      });
    }
  });

  if (registry.detailed) {
    view([registry.combatStatsUpdated, registry.combatStats]).forEach((actorEntity) => {
      record(registry, 'COMBAT_STATS', actorEntity, {
        type: 'combat_stats_update',
        updatedHealth: registry.combatStats.get(actorEntity).health
      });
    });
    registry.durationExpired.forEach((entity) => {
      record(registry, 'EFFECT_EXPIRATION', ownerOf(registry, entity), {
        type: 'effect_expired',
        sourceActor: entityName(registry, registry.sourceActor.get(entity)),
        sourceSkill: registry.sourceSkill.get(entity),
        effect: registry.isEffect.tryGet(entity)?.effect ?? '',
        uniqueEffect: registry.isUniqueEffect.tryGet(entity)?.uniqueEffectKey ?? ''
      });
    });
    registry.isDownstate.forEach((actorEntity) =>
      record(registry, 'ACTOR_DOWNSTATE', actorEntity, { type: 'actor_downstate' })
    );
  }

  registry.isAfk.forEach((actorEntity) => {
    const name = entityName(registry, actorEntity);
    registry.afkTicksByActor.set(name, (registry.afkTicksByActor.get(name) ?? 0) + registry.stepMs);
  });
}

/** End-of-run availability for each root actor's executable skills, as the reference report exposes it. */
export function skillStatuses(registry: Registry): Record<string, Record<string, SkillStatus>> {
  const statuses: Record<string, Record<string, SkillStatus>> = {};
  view([registry.isActor], [registry.owner]).forEach((actorEntity) => {
    const actorStatuses: Record<string, SkillStatus> = {};
    view([registry.isSkill, registry.owner]).forEach((skillEntity) => {
      if (registry.owner.get(skillEntity) !== actorEntity) return;
      const skill = registry.isSkill.get(skillEntity);
      if (!skill.executable) return;
      const castability = canCastSkill(registry, skillEntity);
      const cooldown = registry.cooldown.tryGet(skillEntity);
      let withoutAlacrity = 0;
      let withAlacrity = 0;
      if (cooldown) {
        const fraction = cooldown.progress[0] / cooldown.duration[0] + cooldown.progress[1] / cooldown.duration[1];
        withoutAlacrity = cooldown.duration[0] - Math.trunc(fraction * cooldown.duration[0]);
        withAlacrity = cooldown.duration[1] - Math.trunc(fraction * cooldown.duration[1]);
      }

      actorStatuses[skill.skillKey] = {
        isAvailableToCast: castability.canCast,
        unavailableToCastReason: castability.reason,
        remainingCooldownWithoutAlacrity: withoutAlacrity,
        remainingCooldownWithAlacrity: withAlacrity,
        ammo: registry.ammo.tryGet(skillEntity)?.currentAmmo ?? 0
      };
    });
    statuses[entityName(registry, actorEntity)] = actorStatuses;
  });
  return statuses;
}
