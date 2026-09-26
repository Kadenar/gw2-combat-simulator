import { canonicalTime } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { weaponStrengthProfileForName } from '#gw2/platform/equipment/weapons/strength.js';
import { buildResolverStrike, buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import { castCompleted } from '#gw2/platform/skills/timing.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import { denySkillCast } from '#gw2/professions/shared/availability.js';
import { grantNecromancerLifeForce, necromancerLifeForce } from '#gw2/professions/necromancer/core/hooks.js';
import { registerNecromancerShroudLifecycle } from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import {
  necromancerActiveBoonCompanionIds,
  registerCreatureSummonReaction,
  registerNecromancerCreatureStrikeMultiplier,
  runCreatureSummonReactions
} from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { spiritDefinition } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirits.js';
import { ritualistSpellHooks } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spells.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import {
  RITUALIST_BALANCE_PROFILE_IDS as PROFILE,
  RITUALIST_SPIRIT_PROFILE_BY_SKILL_ID
} from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

const AUTO = 'ritualist.spirit-auto';
const PACKET = 'ritualist.spirit-packet';
const INNERVATE = new Map<SkillId, string>([
  [ID.INNERVATE_ANGUISH, 'anguish'],
  [ID.INNERVATE_WANDERLUST, 'wanderlust'],
  [ID.INNERVATE_PRESERVATION, 'preservation']
]);
const owner = (key: string, generation: number) => ({ id: `spirit:${key}`, generation });
type Spirit = NonNullable<ReturnType<typeof spiritDefinition>>;
interface SpiritPacket {
  key: string;
  generation: number;
  event: SimulationEventBase;
}
interface SpiritAuto {
  key: string;
  generation: number;
  skillId: SkillId;
  anchor: number;
  pulse: number;
  activationId: string;
}

/** Removing a spirit cancels autonomous work; already committed player attacks retain their separate lifetime. */
function clearSpirits(runtime: NecromancerRuntime): void {
  const state = ritualistState.from(runtime);
  for (const key of Object.keys(state.activeSpirits)) runtime.cancelOwner(owner(key, state.spiritGenerations[key]));
  state.activeSpirits = {};
  runtime.resourceController.refresh('lifeForce');
}

function attribution(cast: RuntimeCast) {
  return {
    at: cast.effectiveEnd,
    source: 'Spirit',
    sourceId: cast.skill.id,
    actorType: 'player' as const,
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    icon: cast.skill.icon,
    activationId: cast.id,
    offTarget: cast.command.offTarget
  };
}

function spiritFields(key: string, attackType: string) {
  return {
    summonKind: 'spirit',
    summonOwner: `spirit:${key}`,
    metadata: {
      spirit: key,
      spiritAttackType: attackType,
      anguishConditionalDamage: key === 'anguish' && attackType !== 'innervate'
    }
  };
}

/** Boons choose current recipients and attributes when the spirit or Innervate actually completes. */
function boon(runtime: NecromancerRuntime, cast: RuntimeCast, kind: string, duration: number, stacks: number): void {
  const event = {
    ...attribution(cast),
    at: runtime.time,
    source: 'necromancer',
    type: 'buff' as const,
    kind,
    duration,
    stacks,
    audience: {
      recipients: 'party' as const,
      maximumRecipients: 5,
      eligibleCompanionIds: necromancerActiveBoonCompanionIds(runtime)
    }
  };
  queueResolverBoon(runtime, event, event);
}

/** Finite player attacks are committed payloads; autonomous attacks alone retain spirit lifetime and busy-state checks. */
function queuePacket(runtime: NecromancerRuntime, key: string, event: SimulationEventBase, autonomous = false): void {
  if (!autonomous) {
    runtime.emit(event);
    return;
  }

  const generation = ritualistState.from(runtime).spiritGenerations[key];
  runtime.schedule(PACKET, event.at, { key, generation, event }, owner(key, generation));
}

/** Finite spirit attacks retain one activation and ordered secondary conditions while sharing common damage resolution. */
function strikes(
  runtime: NecromancerRuntime,
  cast: RuntimeCast,
  spirit: Spirit,
  ticks: Spirit['summonTicks'],
  attackType: string
): void {
  for (const [index, tick] of ticks.entries()) {
    const at = canonicalTime(runtime.time + tick.atMs / 1000 + Number(cast.command.impactDelayMs ?? 0) / 1000);
    queuePacket(
      runtime,
      spirit.key,
      buildResolverStrike({
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
              weaponStrength: balanceProfileNumber(
                requireBalanceProfileFromContext(runtime, PROFILE.resources),
                'weaponStrength'
              )
            }
          : {
              weaponStrengthProfileId: 'transform.ritualist-shroud',
              activationId: spirit.key === 'wanderlust' ? `${cast.id}:field` : cast.id,
              name: spirit.key === 'wanderlust' ? 'Spirit of Wanderlust - Initial Attack' : cast.skill.name
            })
      })
    );
  }
}

/** One autonomous wake per spirit advances the shared animation grid; both animation start and impact check busy state. */
function auto(runtime: NecromancerRuntime, data: unknown): void {
  const work = data as SpiritAuto;
  const state = ritualistState.from(runtime);
  if (
    !state.activeSpirits[work.key] ||
    state.spiritGenerations[work.key] !== work.generation ||
    runtime.deathTime != null
  )
    return;
  const spirit = spiritDefinition(runtime, work.skillId);
  if (!spirit || !(spirit.attackCoefficient > 0)) return;
  const skill = runtime.helpers.skillsById.get(work.skillId)!;
  if (!(state.spiritBusyUntil[work.key] > runtime.time))
    queuePacket(
      runtime,
      work.key,
      buildResolverStrike({
        at: canonicalTime(runtime.time + spirit.autoattackImpactDelayMs / 1000),
        source: 'Spirit',
        sourceId: skill.id,
        skillId: skill.id,
        skillName: `${skill.name} Autoattack`,
        icon: skill.icon,
        actorType: 'summon',
        coefficient: spirit.attackCoefficient,
        skillWeapon: 'Unequipped',
        weaponStrength: spirit.attackWeaponStrength,
        canCrit: true,
        summonInheritsCriticalAttributes: true,
        ...spiritFields(work.key, 'autoattack'),
        activationId: `${work.activationId}:auto:${work.pulse}`
      }),
      true
    );
  const interval = balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'pulseInterval');
  const at = canonicalTime(work.anchor + (work.pulse + 1) * interval);
  if (at > runtime.time)
    runtime.schedule(AUTO, at, { ...work, pulse: work.pulse + 1 }, owner(work.key, work.generation));
}

/** Replacing one creature preserves the shared cadence and refunds Soul Twisting only after its summon has committed. */
function summon(runtime: NecromancerRuntime, cast: RuntimeCast, spirit: Spirit): void {
  const state = ritualistState.from(runtime);
  const key = spirit.key;
  runtime.cancelOwner(owner(key, state.spiritGenerations[key] ?? 0));
  state.spiritGenerations[key] = (state.spiritGenerations[key] ?? 0) + 1;
  state.activeSpirits[key] = true;
  state.spiritInitialUntil[key] = canonicalTime(runtime.time + (key === 'anguish' ? 1.1 : 0));
  state.spiritBusyUntil[key] = canonicalTime(runtime.time + spirit.initialBusyMs / 1000);
  runtime.resourceController.refresh('lifeForce');
  if (state.soulTwistingAvailable) {
    state.soulTwistingAvailable = false;
    runtime.cooldownController.clear(cast.skill.id);
  }

  runCreatureSummonReactions(runtime, cast.skill as NecromancerSkill, runtime.time, 1, cast.id);
  if (hasTrait(runtime, TRAIT.EMPOWERING_SPIRITS)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.empoweringSpirits);
    for (const kind of ['quickness', key === 'anguish' ? 'might' : key === 'wanderlust' ? 'fury' : 'resolution']) {
      const effect = requireEffect(profile, 'boon', kind);
      if (effect)
        boon(runtime, cast, kind, effectNumber(profile, effect, 'duration'), effectNumber(profile, effect, 'stacks'));
    }
  }

  if (key === 'anguish') {
    for (const [condition, stacks, duration] of [
      ['Crippled', 1, 4],
      ['Vulnerability', 8, 10]
    ] as const)
      queuePacket(
        runtime,
        key,
        buildResolverCondition({ ...attribution(cast), at: runtime.time, condition, stacks, duration })
      );
    strikes(runtime, cast, spirit, spirit.summonTicks, 'initial');
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.painfulBond);
    const effect = requireEffect(profile, 'buff', 'necromancer-painful-bond');
    if (effect && spirit.summonTicks.length) {
      const at = canonicalTime(
        runtime.time + spirit.summonTicks[0].atMs / 1000 + Number(cast.command.impactDelayMs ?? 0) / 1000
      );
      const duration = effectNumber(profile, effect, 'duration');
      queuePacket(runtime, key, {
        ...attribution(cast),
        type: 'necromancer.painful-bond',
        at,
        mode: 'apply',
        duration,
        triggeredBy: cast.skill.name
      });
    }
  } else if (key === 'wanderlust') {
    strikes(runtime, cast, spirit, spirit.lingeringTicks, 'initial');
    const first = spirit.lingeringTicks[0];
    if (first)
      for (const [index, [condition, stacks, duration]] of (
        [
          ['Chilled', 1, 2],
          ['Vulnerability', 4, 6],
          ['Weakness', 1, 4],
          ['Slow', 1, 2]
        ] as const
      ).entries()) {
        queuePacket(
          runtime,
          key,
          buildResolverCondition({
            ...attribution(cast),
            ...spiritFields(key, 'initial'),
            at: canonicalTime(
              runtime.time + first.atMs / 1000 + index + Number(cast.command.impactDelayMs ?? 0) / 1000
            ),
            condition,
            stacks,
            duration
          })
        );
      }
  }

  const resources = requireBalanceProfileFromContext(runtime, PROFILE.resources);
  const interval = balanceProfileNumber(resources, 'pulseInterval');
  if (!(interval > 0) || !(spirit.attackCoefficient > 0)) return;
  if (!Number.isFinite(state.spiritAutoAnchorAt)) {
    state.spiritAutoAnchorAt = canonicalTime(
      runtime.time +
        (state.resummonedSpiritAutoCycle
          ? balanceProfileNumber(resources, 'resummonedSpiritAttackDelayMs') / 1000
          : balanceProfileNumber(resources, 'initialDelay'))
    );
    state.resummonedSpiritAutoCycle = false;
  }

  const pulse = Math.max(0, Math.floor(canonicalTime(runtime.time - state.spiritAutoAnchorAt) / interval) + 1);
  runtime.schedule(
    AUTO,
    canonicalTime(state.spiritAutoAnchorAt + pulse * interval),
    {
      key,
      generation: state.spiritGenerations[key],
      skillId: cast.skill.id,
      anchor: state.spiritAutoAnchorAt,
      pulse,
      activationId: cast.id
    },
    owner(key, state.spiritGenerations[key])
  );
}

/** Ritualist uses the shared Core resource owner and actual creature callbacks, with specialization-owned lifetimes. */
export const ritualistHooks: Partial<RuntimeProfession<NecromancerRuntimeState>> = {
  ...ritualistSpellHooks,
  resources: {
    lifeForce: {
      ...necromancerLifeForce,
      recovery(runtime) {
        if (
          !runtime.profession.core.activeShroud &&
          Object.keys(ritualistState.from(runtime).activeSpirits).length &&
          hasTrait(runtime, TRAIT.LINGERING_SPIRITS)
        )
          return (
            (-runtime.profession.core.lifeForce.maximum *
              balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'lifeForceDrain')) /
            100
          );
        return necromancerLifeForce.recovery(runtime);
      }
    }
  },
  initialize(runtime) {
    registerNecromancerShroudLifecycle(runtime, 'ritualist.shroud', {
      onEnter(skill) {
        if (skill.shroudEntry !== 'ritualist') return;
        const state = ritualistState.from(runtime);
        state.resummonedSpiritAutoCycle = Object.keys(state.activeSpirits).length > 0;
        state.spiritAutoAnchorAt = NaN;
        state.soulTwistingAvailable = hasTrait(runtime, TRAIT.SOUL_TWISTING);
      },
      onExit: () => {
        if (!hasTrait(runtime, TRAIT.LINGERING_SPIRITS)) clearSpirits(runtime);
      },
      onDepletion: () => clearSpirits(runtime)
    });
    registerCreatureSummonReaction(runtime, 'ritualist.creature-summon-traits', (skill, at, count, activationId) => {
      if (hasTrait(runtime, TRAIT.BOON_OF_CREATION))
        grantNecromancerLifeForce(
          runtime,
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.boonOfCreation), 'lifeForceGain') *
            count
        );
      if (!hasTrait(runtime, TRAIT.EXPLOSIVE_GROWTH)) return;
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.explosiveGrowth);
      const strike = requireEffect(profile, 'strike', 'Strike');
      if (strike)
        runtime.emit(
          buildResolverStrike({
            type: 'damage',
            at,
            source: 'Trait',
            sourceId: TRAIT.EXPLOSIVE_GROWTH,
            actorType: 'effect',
            skillId: TRAIT.EXPLOSIVE_GROWTH,
            skillName: 'Explosive Growth',
            parentSkillName: skill.name,
            // The summon triggers an independent trait strike; it must not reuse the summon cast's weapon roll.
            activationId: `${activationId}:explosive-growth:${at}`,
            triggeredBy: skill.name,
            coefficient: effectNumber(profile, strike, 'coefficient') * count,
            skillWeapon: 'Unequipped'
          })
        );
    });
    registerNecromancerCreatureStrikeMultiplier(runtime, 'ritualist.spirits-strength', () =>
      hasTrait(runtime, TRAIT.SPIRITS_STRENGTH) ? 1.5 : 1
    );
  },
  availability(runtime, skill) {
    const key = INNERVATE.get(skill.id);
    return key && !ritualistState.from(runtime).activeSpirits[key]
      ? denySkillCast(skill, 'necromancer.spirit', `requires an active ${key} spirit.`)
      : { ready: true };
  },
  modifyEffects(runtime, cast, effects) {
    if (cast.skill.id === ID.ESSENCE_BLAST) {
      const skillWeapon = gw2ActivePrimaryWeapon(runtime.config, runtime.activeWeaponSet) || 'Unequipped';
      return effects.map((effect) => ({
        ...effect,
        atMs: ((cast.fullEnd - cast.start) * 1000 * 14) / 15,
        timingAnchor: 'castStart' as const,
        timingScale: 'fixed' as const,
        weapon: skillWeapon,
        weaponStrengthProfileId: weaponStrengthProfileForName(skillWeapon)?.id,
        metadata: { activeSpirits: Object.keys(ritualistState.from(runtime).activeSpirits).length }
      }));
    }

    return RITUALIST_SPIRIT_PROFILE_BY_SKILL_ID[Number(cast.skill.id)] ||
      INNERVATE.has(cast.skill.id) ||
      cast.skill.id === ID.SUMMON_SPIRITS
      ? []
      : ritualistSpellHooks.modifyEffects!(runtime, cast, effects);
  },
  onCastStart(runtime, cast) {
    if (cast.skill.id !== ID.WANDERLUST || !castCompleted(cast)) return;
    const swing = spiritDefinition(runtime, cast.skill.id)?.summonTicks[0];
    if (!swing) return;
    const skillWeapon = gw2ActivePrimaryWeapon(runtime.config, runtime.activeWeaponSet) || 'Unequipped';
    runtime.emit(
      buildResolverStrike({
        ...attribution(cast),
        source: 'necromancer',
        at: canonicalTime(cast.start + swing.atMs / 1000 + Number(cast.command.impactDelayMs ?? 0) / 1000),
        coefficient: swing.coefficient,
        skillWeapon,
        weaponStrengthProfileId: weaponStrengthProfileForName(skillWeapon)?.id
      })
    );
  },
  onCastComplete(runtime, cast) {
    ritualistSpellHooks.onCastComplete!(runtime, cast);
    // A cast cancelled after its commit point (aftercast cancel) still summons; earlier cancellation summons nothing.
    if (cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
    const spirit = spiritDefinition(runtime, cast.skill.id);
    if (spirit) summon(runtime, cast, spirit);
    const innervate = INNERVATE.get(cast.skill.id);
    if (innervate) grantNecromancerLifeForce(runtime, Number(cast.skill.innervateLifeForceGain ?? 0));
    if (spirit || innervate)
      for (const effect of cast.skill.effects ?? []) {
        if (effect.type === 'boon')
          boon(runtime, cast, String(effect.boon), Number(effect.duration), Number(effect.stacks));
        else if (innervate)
          for (const { event } of materializeSkillEffectApplications({
            skill: cast.skill,
            effect,
            start: runtime.time,
            fullEnd: runtime.time,
            baseEvent: { ...attribution(cast), ...spiritFields(innervate, 'innervate') },
            skillWeaponFallback: 'Profession mechanic'
          }))
            runtime.emit({ ...event, at: canonicalTime(event.at + Number(cast.command.impactDelayMs ?? 0) / 1000) });
      }

    if (cast.skill.id !== ID.SUMMON_SPIRITS) return;
    const state = ritualistState.from(runtime);
    for (const id of [ID.ANGUISH, ID.WANDERLUST, ID.PRESERVATION]) {
      const spirit = spiritDefinition(runtime, id)!;
      if (!state.activeSpirits[spirit.key] || state.spiritInitialUntil[spirit.key] > runtime.time) continue;
      strikes(runtime, cast, spirit, spirit.activeTicks, 'summon-spirits');
      if (spirit.key === 'wanderlust')
        queuePacket(runtime, spirit.key, {
          ...attribution(cast),
          ...spiritFields(spirit.key, 'summon-spirits'),
          type: 'control',
          controlKind: 'daze',
          sourceId: `ritualist.${spirit.key}.summon-spirits`,
          at: canonicalTime(
            runtime.time +
              Number(spirit.activeTicks[0]?.atMs ?? 0) / 1000 +
              Number(cast.command.impactDelayMs ?? 0) / 1000
          )
        });
      state.spiritBusyUntil[spirit.key] = Math.max(
        state.spiritBusyUntil[spirit.key],
        canonicalTime(runtime.time + spirit.activeDuration)
      );
    }
  },
  tasks: {
    ...ritualistSpellHooks.tasks,
    [AUTO]: auto,
    [PACKET](runtime, data) {
      const work = data as SpiritPacket;
      const state = ritualistState.from(runtime);
      if (
        state.activeSpirits[work.key] &&
        state.spiritGenerations[work.key] === work.generation &&
        !(state.spiritBusyUntil[work.key] > runtime.time)
      )
        runtime.emit(work.event);
    }
  }
};
