import { CONTROL } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { weaponStrengthProfileForName } from '#gw2/platform/equipment/weapons/strength.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import {
  effectNumber,
  requireEffect,
  requireSkillFromContext,
  skillNumber
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import {
  attribution,
  spiritFields
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/attribution.js';
import { ritualistPartyBoonPolicy } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/party-boons.js';
import {
  beginRitualistSpiritAction,
  ritualistSpiritActionOwner,
  summonRitualistSpirit
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-lifecycle.js';
import { RITUALIST_SPIRIT_SKILL_IDS } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-projection.js';
import {
  spiritDefinition,
  type SpiritDefinition
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirits.js';
import { painfulBondSkill } from '#gw2/professions/necromancer/specializations/ritualist/skills/spirit-attacks.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

export const INNERVATE = new Map<SkillId, string>([
  [ID.INNERVATE_ANGUISH, 'anguish'],
  [ID.INNERVATE_WANDERLUST, 'wanderlust'],
  [ID.INNERVATE_PRESERVATION, 'preservation']
]);

/** Finite spirit attacks retain one activation and ordered secondary conditions while sharing common damage resolution. */
function strikePackets(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  spirit: SpiritDefinition,
  ticks: SpiritDefinition['summonTicks'],
  attackType: string
): SimulationEventBase[] {
  return ticks.map((tick, index) => {
    const at = canonicalTime(runtime.time + tick.atMs / 1000 + (cast.command.impactDelayMs ?? 0) / 1000);
    return buildResolverStrike({
      ...attribution(cast),
      ...spiritFields(spirit.key, attackType),
      at,
      coefficient: tick.coefficient,
      skillWeapon: 'Unequipped',
      hitIndex: index + 1,
      totalHits: ticks.length,
      ...(attackType === 'summon-spirits'
        ? {
            sourceId: `ritualist.${spirit.key}.summon-spirits`,
            weaponStrength: skillNumber(cast.skill, 'weaponStrength')
          }
        : {
            weaponStrengthProfileId: 'transform.ritualist-shroud',
            activationId: spirit.key === 'wanderlust' ? `${cast.id}:field` : cast.id,
            name: spirit.key === 'wanderlust' ? 'Spirit of Wanderlust - Initial Attack' : cast.skill.name
          })
    });
  });
}

const FIELD = 'ritualist.wanderlust-field';
interface SpiritField {
  events: SimulationEventBase[];
  skillId: SkillId;
  at: number;
  attribution: ReturnType<typeof attribution>;
}

/** Once the field exists, its remaining pulses survive later spirit commands, replacements, and despawns. */
export const ritualistSpiritActionTasks: NonNullable<RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>['tasks']> =
  {
    [FIELD](runtime, data) {
      const field = data as SpiritField;
      for (const event of field.events) runtime.effects.emit({ kind: 'packet', event });
      const opening = requireSkillFromContext(runtime, field.skillId);
      runtime.effects.emit({
        kind: 'profile',
        profile: opening,
        effects: requireSkillAction(opening, 'opening').effects.filter((effect) => effect.type === 'condition'),
        at: field.at,
        attribution: { ...field.attribution, ...spiritFields('wanderlust', 'initial') },
        transform: (event) => ({ ...event, name: `${opening.name} — ${event.condition}` })
      });
    }
  };

/** Pending spirit hits belong to the current attack even when their damage is attributed to the player. */
function strikes(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  spirit: SpiritDefinition,
  ticks: SpiritDefinition['summonTicks'],
  attackType: string
): void {
  for (const event of strikePackets(runtime, cast, spirit, ticks, attackType))
    runtime.effects.emit({ kind: 'packet', event, owner: ritualistSpiritActionOwner(runtime, spirit.key) });
}

/** This skill family owns its actions; hooks retain registration and cross-owner ordering. */
export const ritualistSpiritActions: NonNullable<
  RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>['sideEffectHandlers']
> = {
  'ritualist.wanderlust-opening'(runtime, context) {
    if (context.kind !== 'cast' || context.cast.cancelled) return;

    const cast = context.cast;
    const swing = spiritDefinition(runtime, cast.skill.id)?.summonTicks[0];

    if (!swing) return;

    const skillWeapon = gw2ActivePrimaryWeapon(runtime.config, runtime.activeWeaponSet) || 'Unequipped';
    runtime.effects.emit({
      kind: 'packet',
      event: buildResolverStrike({
        ...attribution(cast),
        source: 'necromancer',
        at: canonicalTime(cast.start + swing.atMs / 1000 + (cast.command.impactDelayMs ?? 0) / 1000),
        coefficient: swing.coefficient,
        skillWeapon,
        weaponStrengthProfileId: weaponStrengthProfileForName(skillWeapon)?.id
      })
    });
  },
  'ritualist.summon-anguish'(runtime, context) {
    if (context.kind !== 'cast') return;

    const cast = context.cast;
    const spirit = spiritDefinition(runtime, cast.skill.id)!;
    summonRitualistSpirit(runtime, cast, spirit);
    const opening = cast.skill;
    runtime.effects.emit({
      kind: 'profile',
      profile: opening,
      effects: requireSkillAction(opening, 'opening').effects.filter((effect) => effect.type === 'condition'),
      attribution: attribution(cast),
      transform: (event) => ({
        ...event,
        name: `${cast.skill.name} — ${event.condition}`,
        offTarget: cast.command.offTarget
      })
    });
    strikes(runtime, cast, spirit, spirit.summonTicks, 'initial');
    const profile = requireSkillFromContext(runtime, painfulBondSkill.id);
    const effect = requireEffect(profile, 'buff', 'necromancer-painful-bond');

    if (effect && spirit.summonTicks.length) {
      const at = canonicalTime(
        runtime.time + spirit.summonTicks[0].atMs / 1000 + (cast.command.impactDelayMs ?? 0) / 1000
      );
      const duration = effectNumber(profile, effect, 'duration');
      // The summon grants Bond independently of whether its subsequent attack is interrupted.
      runtime.effects.emit({
        kind: 'packet',
        event: {
          ...attribution(cast),
          type: 'necromancer.painful-bond',
          at,
          mode: 'apply',
          duration,
          triggeredBy: cast.skill.name
        }
      });
    }
  },
  'ritualist.summon-wanderlust'(runtime, context) {
    if (context.kind !== 'cast') return;

    const cast = context.cast;
    const spirit = spiritDefinition(runtime, cast.skill.id)!;
    const key = spirit.key;
    summonRitualistSpirit(runtime, cast, spirit);
    const first = spirit.lingeringTicks[0];

    if (first) {
      const at = canonicalTime(runtime.time + first.atMs / 1000 + (cast.command.impactDelayMs ?? 0) / 1000);
      // Cancellation before creation removes the whole field; its emitted pulses become independent afterward.
      runtime.schedule(
        FIELD,
        Math.min(ritualistState.from(runtime).activeSpirits[key].busyUntil, at),
        {
          events: strikePackets(runtime, cast, spirit, spirit.lingeringTicks, 'initial'),
          skillId: cast.skill.id,
          at,
          attribution: attribution(cast)
        } satisfies SpiritField,
        ritualistSpiritActionOwner(runtime, key),
        // Complete field creation before an autoattack opportunity at the same boundary can replace the action.
        -1
      );
    }
  },
  'ritualist.summon-preservation'(runtime, context) {
    if (context.kind !== 'cast') return;

    const cast = context.cast;
    const spirit = spiritDefinition(runtime, cast.skill.id)!;
    summonRitualistSpirit(runtime, cast, spirit);
    for (const effect of cast.skill.effects ?? [])
      if (effect.type === 'boon') {
        runtime.effects.emit({
          kind: 'profile',
          profile: cast.skill,
          effects: [effect],
          ...ritualistPartyBoonPolicy(runtime, cast)
        });
      }
  },
  'ritualist.innervate'(runtime, context) {
    if (context.kind !== 'cast') return;

    const cast = context.cast;
    const innervate = INNERVATE.get(cast.skill.id)!;
    for (const effect of cast.skill.effects ?? []) {
      if (effect.type === 'boon') {
        runtime.effects.emit({
          kind: 'profile',
          profile: cast.skill,
          effects: [effect],
          ...ritualistPartyBoonPolicy(runtime, cast)
        });
      } else
        runtime.effects.emit({
          kind: 'profile',
          profile: cast.skill,
          effects: [effect],
          at: runtime.time,
          attribution: { ...attribution(cast), ...spiritFields(innervate, 'innervate') },
          skillWeaponFallback: 'Profession mechanic',
          transform: (event) => ({ ...event, at: canonicalTime(event.at + (cast.command.impactDelayMs ?? 0) / 1000) })
        });
    }
  },
  'ritualist.summon-spirits'(runtime, context) {
    if (context.kind !== 'cast') return;

    const cast = context.cast;
    // The shared inventory preserves command ordering and the same participating spirits shown by tooltips.
    for (const id of RITUALIST_SPIRIT_SKILL_IDS) {
      const spirit = spiritDefinition(runtime, id)!;

      const actor = ritualistState.from(runtime).activeSpirits[spirit.key];

      if (!actor) continue;

      // Summon Spirits leaves the opening action intact; only subsequent actions can be replaced by its command.
      if (actor.actionGeneration === 0 && actor.busyUntil > runtime.time) continue;

      beginRitualistSpiritAction(runtime, spirit.key, spirit.activeDuration);
      strikes(runtime, cast, spirit, spirit.activeTicks, 'summon-spirits');

      if (spirit.key === 'wanderlust')
        runtime.effects.emit({
          kind: 'packet',
          owner: ritualistSpiritActionOwner(runtime, spirit.key),
          event: {
            ...attribution(cast),
            ...spiritFields(spirit.key, 'summon-spirits'),
            type: 'control',
            controlKind: CONTROL.DAZE,
            sourceId: `ritualist.${spirit.key}.summon-spirits`,
            at: canonicalTime(
              runtime.time + (spirit.activeTicks[0]?.atMs ?? 0) / 1000 + (cast.command.impactDelayMs ?? 0) / 1000
            )
          }
        });
    }
  }
};
