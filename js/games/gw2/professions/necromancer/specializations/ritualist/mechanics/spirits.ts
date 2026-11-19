/** Interpret selected Ritualist attacks once for execution and tooltips; live scheduling belongs to the lifecycle. */
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { strikeEffectTicks } from '#gw2/platform/effects/authoring.js';
import { copyStrikePayload, type StrikePayloadFields } from '#gw2/platform/effects/strike-payload.js';
import type { ConditionEffect, StrikeEffect, StrikeTick } from '#gw2/platform/effects/types.js';
import type { EffectMetadata } from '#gw2/platform/events/events.js';
import {
  effectNumber,
  requireEffect,
  requireSkill,
  skillNumber,
  type SkillSource
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

interface SpiritStrikePayload extends StrikePayloadFields {
  readonly coefficient: number;
  readonly weaponStrengthProfileId?: string;
  readonly metadata: EffectMetadata;
}

/** Resolved payloads keep runtime attribution separate; their effects provide the same values to tooltip formatting. */
export interface SpiritAttack {
  readonly ticks: readonly { readonly atMs: number; readonly payload: SpiritStrikePayload }[];
  readonly effects: readonly StrikeEffect[];
}

/** Selected attack roles and recovery values require only the catalog, never live combat state. */
export interface SpiritDefinition {
  readonly key: 'anguish' | 'wanderlust' | 'preservation';
  readonly initialBusyMs: number;
  readonly resummonBusyMs: number;
  readonly autoattackImpactDelayMs: number;
  readonly autoattack?: SpiritAttack;
  readonly playerSwing?: SpiritAttack;
  readonly summon?: SpiritAttack;
  readonly lingering?: SpiritAttack;
  readonly active?: SpiritAttack;
  readonly activeDuration: number;
  readonly openingConditions: readonly ConditionEffect[];
}

/** Named roles cannot change when a patch removes or adds a sibling effect. */
const SPIRIT_ATTACKS: ReadonlyMap<
  SkillId,
  {
    readonly key: SpiritDefinition['key'];
    readonly autoattack: string;
    readonly playerSwing?: string;
    readonly summon?: string;
    readonly lingering?: string;
    readonly active?: string;
  }
> = new Map([
  [
    ID.ANGUISH,
    {
      key: 'anguish',
      autoattack: 'Anguish Autoattack',
      summon: 'Anguish Initial Barrage',
      active: 'Summon Spirits - Anguish'
    }
  ],
  [
    ID.WANDERLUST,
    {
      key: 'wanderlust',
      autoattack: 'Wanderlust Autoattack',
      playerSwing: 'Wanderlust Initial Swing',
      lingering: 'Wanderlust Initial Field',
      active: 'Summon Spirits - Wanderlust'
    }
  ],
  [ID.PRESERVATION, { key: 'preservation', autoattack: 'Preservation Autoattack' }]
]);

export const RITUALIST_SPIRIT_SKILL_IDS = Object.freeze([...SPIRIT_ATTACKS.keys()]);

/** Preserve whole-coefficient autos, the first player swing, and finite spirit timelines while resolving payload overrides. */
function interpretAttack(
  effect: StrikeEffect | undefined,
  mode: 'auto' | 'player' | 'spirit'
): SpiritAttack | undefined {
  if (!effect) return undefined;

  const authoredTicks: readonly StrikeTick[] =
    mode === 'auto' ? [{ atMs: 0, coefficient: effect.coefficient! }] : strikeEffectTicks(effect);
  const selectedTicks = mode === 'player' ? authoredTicks.slice(0, 1) : authoredTicks;

  if (!selectedTicks.length) return undefined;

  const ticks = selectedTicks.map((tick) => {
    const fields: StrikePayloadFields = {};
    copyStrikePayload(effect, fields);
    copyStrikePayload(tick, fields);
    const payload: SpiritStrikePayload = {
      ...fields,
      coefficient: tick.coefficient,
      weaponStrengthProfileId: mode === 'player' ? undefined : effect.weaponStrengthProfileId,
      // The player swing always uses the equipped weapon, including when a selected effect declares fixed strength.
      ...(mode === 'player' ? { weaponStrength: undefined } : {}),
      metadata: { ...effect.metadata, ...tick.metadata }
    };
    return { atMs: tick.atMs, payload };
  });

  return {
    ticks,
    // Scalar effects let the formatter retain tick-specific critical flags and flat formulas without reinterpreting timelines.
    effects: ticks.map(({ atMs, payload }) => ({
      ...effect,
      ...payload,
      atMs,
      ticks: undefined,
      hits: 1,
      applications: undefined,
      intervalMs: undefined
    }))
  };
}

/** Select and normalize executable roles from the chosen catalog while retaining command recovery without damage. */
export function spiritDefinition(source: SkillSource, skillId: SkillId): SpiritDefinition | undefined {
  const attackNames = SPIRIT_ATTACKS.get(skillId);

  if (!attackNames) return undefined;

  const summon: NecromancerSkill = requireSkill(source, skillId);
  const profile = requireSkill(source, summon.summonAttackId as SkillId);
  const opening = requireSkillAction(summon, 'opening');
  const command = requireSkill(source, ID.SUMMON_SPIRITS);
  const commands = requireSkillAction(command, 'commands');
  const autoattack = requireEffect(profile, 'strike', attackNames.autoattack);
  const active = attackNames.active ? requireEffect(command, 'strike', attackNames.active, commands) : undefined;
  const lingering = interpretAttack(
    attackNames.lingering ? requireEffect(summon, 'strike', attackNames.lingering, opening) : undefined,
    'spirit'
  );

  return {
    key: attackNames.key,
    initialBusyMs: skillNumber(profile, 'initialBusyMs'),
    resummonBusyMs: skillNumber(profile, 'resummonBusyMs'),
    autoattackImpactDelayMs: skillNumber(profile, 'autoattackImpactDelayMs'),
    autoattack: interpretAttack(
      autoattack && effectNumber(profile, autoattack, 'coefficient') > 0 ? autoattack : undefined,
      'auto'
    ),
    playerSwing: interpretAttack(
      attackNames.playerSwing ? requireEffect(summon, 'strike', attackNames.playerSwing, opening) : undefined,
      'player'
    ),
    summon: interpretAttack(
      attackNames.summon ? requireEffect(summon, 'strike', attackNames.summon, opening) : undefined,
      'spirit'
    ),
    lingering,
    active: interpretAttack(active, 'spirit'),
    // Removed strikes have no recovery; Preservation's commanded heal owns its separate busy window.
    activeDuration: attackNames.active
      ? active
        ? effectNumber(command, active, 'duration')
        : 0
      : skillNumber(profile, 'commandBusyMs') / 1000,
    // Anguish conditions are independent; Wanderlust conditions require its selected field.
    openingConditions:
      attackNames.key === 'anguish' || lingering
        ? opening.effects.filter((effect): effect is ConditionEffect => effect.type === 'condition')
        : []
  };
}
