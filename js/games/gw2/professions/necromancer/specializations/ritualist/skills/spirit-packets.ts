/** Construct spirit attack payloads while the lifecycle owns their admission and cancellation. */
import { CONTROL } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import {
  attribution,
  spiritFields
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/attribution.js';
import type { SpiritDefinition } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirits.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Apply the authored attack offset and optional travel delay on the canonical clock. */
export function spiritImpactAt(at: number, cast: RuntimeCast<NecromancerSkill>, offsetMs: number): number {
  return canonicalTime(at + offsetMs / 1000 + (cast.command.impactDelayMs ?? 0) / 1000);
}

/** Anguish applies independent conditions before its owned barrage; Wanderlust's swing belongs to the player. */
export function prepareRitualistSpiritOpening(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  spirit: SpiritDefinition
): SimulationEventBase[] {
  if (spirit.key !== 'anguish') return [];

  const opening = cast.skill;
  runtime.effects.emit({
    kind: 'profile',
    profile: opening,
    effects: requireSkillAction(opening, 'opening').effects.filter((effect) => effect.type === 'condition'),
    attribution: attribution(cast),
    transform: (event) => ({
      ...event,
      name: `${cast.skill.name} - ${event.condition}`,
      offTarget: cast.command.offTarget
    })
  });
  return strikePackets(runtime, cast, spirit, spirit.summonTicks, 'initial');
}

/** Finite spirit attacks retain one activation and ordered secondary conditions while sharing common damage resolution. */
function strikePackets(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  spirit: SpiritDefinition,
  ticks: SpiritDefinition['summonTicks'],
  attackType: string
): SimulationEventBase[] {
  return ticks.map((tick, index) => {
    const at = spiritImpactAt(runtime.time, cast, tick.atMs);
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

/** Strike and control packets from one command share the lifecycle's accepted action. */
export function ritualistSpiritCommandPackets(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  spirit: SpiritDefinition
): SimulationEventBase[] {
  const events = strikePackets(runtime, cast, spirit, spirit.activeTicks, 'summon-spirits');

  if (spirit.key === 'wanderlust')
    events.push({
      ...attribution(cast),
      ...spiritFields(spirit.key, 'summon-spirits'),
      type: 'control',
      controlKind: CONTROL.DAZE,
      sourceId: `ritualist.${spirit.key}.summon-spirits`,
      at: spiritImpactAt(runtime.time, cast, spirit.activeTicks[0]?.atMs ?? 0)
    });

  return events;
}

/** A queued field retains its selected strike payload and the identity used to resolve its conditions. */
export interface RitualistSpiritField {
  events: SimulationEventBase[];
  skillId: SkillId;
  at: number;
  attribution: ReturnType<typeof attribution>;
}

/** Build fields only when lingering ticks exist; delayed impacts retain the original activation attribution. */
export function ritualistSpiritField(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  spirit: SpiritDefinition
): RitualistSpiritField | null {
  const first = spirit.lingeringTicks[0];

  if (!first) return null;

  return {
    events: strikePackets(runtime, cast, spirit, spirit.lingeringTicks, 'initial'),
    skillId: cast.skill.id,
    at: spiritImpactAt(runtime.time, cast, first.atMs),
    attribution: attribution(cast)
  };
}

/** Created fields emit their strikes before the selected opening conditions, independently of the spirit's later actions. */
export function emitRitualistSpiritField(runtime: NecromancerRuntime, field: RitualistSpiritField): void {
  for (const event of field.events) runtime.effects.emit({ kind: 'packet', event });
  const opening = requireSkill(runtime.helpers, field.skillId);
  runtime.effects.emit({
    kind: 'profile',
    profile: opening,
    effects: requireSkillAction(opening, 'opening').effects.filter((effect) => effect.type === 'condition'),
    at: field.at,
    attribution: { ...field.attribution, ...spiritFields('wanderlust', 'initial') },
    transform: (event) => ({ ...event, name: `${opening.name} - ${event.condition}` })
  });
}
