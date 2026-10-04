import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/occurrence-driver.js';
import {
  queueNightmareWeapon,
  queueSplinterWeapon
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-effects.js';
import { requireBalanceProfileFromContext as damageProfile } from '#gw2/platform/skills/balance-profiles.js';
import { RITUALIST_BALANCE_PROFILE_IDS as DAMAGE_PROFILE } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import { NECROMANCER_SKILL_IDS as DAMAGE_SKILL } from '#gw2/professions/necromancer/data/ids.js';
import { timedEffectState } from '#gw2/platform/combat/effect-state.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { weaponStrengthProfileForName } from '#gw2/platform/equipment/weapons/strength.js';
import { buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { necromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/resources.js';
import { registerNecromancerShroudLifecycle } from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import {
  necromancerActiveBoonCompanionIds,
  runCreatureSummonReactions
} from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { attribution } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/attribution.js';
import {
  emitPainfulBond,
  ritualistSpellHooks
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spells.js';
import { spiritDefinition } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirits.js';
import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import {
  applyEmpoweringSpirits,
  armSoulTwisting,
  consumeSoulTwisting,
  initializeRitualistSummonTraits,
  lingeringSpiritsActive
} from '#gw2/professions/necromancer/specializations/ritualist/traits/behavior.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

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

/** Finite player attacks are committed payloads; autonomous attacks alone retain spirit lifetime and busy-state checks. */
function queuePacket(runtime: NecromancerRuntime, key: string, event: SimulationEventBase, autonomous = false): void {
  if (!autonomous) {
    runtime.effects.emit({ kind: 'packet', event: event });
    return;
  }

  const generation = ritualistState.from(runtime).spiritGenerations[key];
  runtime.schedule(PACKET, event.at, { key, generation, event }, owner(key, generation));
}

/** Finite spirit attacks retain one activation and ordered secondary conditions while sharing common damage resolution. */
function strikes(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  spirit: Spirit,
  ticks: Spirit['summonTicks'],
  attackType: string
): void {
  for (const [index, tick] of ticks.entries()) {
    const at = canonicalTime(runtime.time + tick.atMs / 1000 + (cast.command.impactDelayMs ?? 0) / 1000);
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
function summon(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>, spirit: Spirit): void {
  const state = ritualistState.from(runtime);
  const key = spirit.key;
  runtime.cancelOwner(owner(key, state.spiritGenerations[key] ?? 0));
  state.spiritGenerations[key] = (state.spiritGenerations[key] ?? 0) + 1;
  state.activeSpirits[key] = true;
  state.spiritInitialUntil[key] = canonicalTime(runtime.time + (key === 'anguish' ? 1.1 : 0));
  state.spiritBusyUntil[key] = canonicalTime(runtime.time + spirit.initialBusyMs / 1000);
  runtime.resourceController.refresh('lifeForce');
  consumeSoulTwisting(runtime, cast);

  runCreatureSummonReactions(runtime, cast.skill, runtime.time, 1, cast.id);
  applyEmpoweringSpirits(runtime, cast, key);

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
export const ritualistHooks: RuntimeHooks<NecromancerRuntimeState, NecromancerSkill> = {
  // Each weapon-spell charge is a known effect, independent of who could consume it.
  damageEffects: [
    {
      id: 'ritualist.painful-bond',
      name: 'Painful Bond',
      source: 'Profession',
      unit: 'pulse',
      sourceIds: ['ritualist.painful-bond'],
      emit(runtime) {
        emitPainfulBond(runtime, damageInputEvent(runtime));
      }
    },
    {
      id: 'nightmare-weapon',
      name: 'Nightmare Weapon',
      source: 'Profession',
      unit: 'charge',
      sourceIds: [DAMAGE_SKILL.NIGHTMARE_WEAPON],
      emit: (runtime) =>
        queueNightmareWeapon(
          runtime,
          damageInputEvent(runtime),
          damageProfile(runtime, DAMAGE_PROFILE.nightmareWeaponProc)
        )
    },
    {
      id: 'splinter-weapon',
      name: 'Splinter Weapon',
      source: 'Profession',
      unit: 'charge',
      sourceIds: [DAMAGE_SKILL.SPLINTER_WEAPON],
      emit: (runtime) =>
        queueSplinterWeapon(
          runtime,
          damageInputEvent(runtime),
          damageProfile(runtime, DAMAGE_PROFILE.splinterWeaponProc)
        )
    }
  ],

  // Recipient pools already own replacement and charge consumption; publish their retained grants directly.
  buffPolicies: () =>
    ['nightmare', 'splinter', 'resilient'].map((spell) => ({ kind: spell + '-weapon', owner: 'profession' as const })),
  observeEffects(runtime) {
    return Object.entries(ritualistState.from(runtime).weaponSpells).flatMap(([spell, state]) =>
      Object.entries(state.recipients ?? {}).map(([recipient, grant]) =>
        timedEffectState(spell + '-weapon', [{ stacks: grant.charges, expiresAt: grant.expiresAt }], null, {
          recipient:
            recipient === 'player' ? 'self' : recipient.startsWith('ally:') ? recipient : 'companion:' + recipient
        })
      )
    );
  },
  ...ritualistSpellHooks,
  resources: {
    lifeForce: {
      ...necromancerLifeForce,
      recovery(runtime) {
        if (
          !runtime.profession.core.activeShroud &&
          Object.keys(ritualistState.from(runtime).activeSpirits).length &&
          lingeringSpiritsActive(runtime)
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
        armSoulTwisting(runtime);
      },
      onExit: () => {
        if (!lingeringSpiritsActive(runtime)) clearSpirits(runtime);
      },
      onDepletion: () => clearSpirits(runtime)
    });
    initializeRitualistSummonTraits(runtime);
  },
  availability(runtime, skill) {
    const key = INNERVATE.get(skill.id);
    return key && !ritualistState.from(runtime).activeSpirits[key]
      ? denySkillCast(skill, 'necromancer.spirit', `requires an active ${key} spirit.`)
      : { ready: true };
  },
  sideEffectHandlers: {
    ...ritualistSpellHooks.sideEffectHandlers,
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
      const key = spirit.key;
      summon(runtime, cast, spirit);
      const opening = requireBalanceProfileFromContext(runtime, PROFILE.anguish);
      runtime.effects.emit({
        kind: 'profile',
        profile: opening,
        effects: opening.effects?.filter((effect) => effect.type === 'condition'),
        attribution: attribution(cast),
        transform: (event) => ({
          ...event,
          name: `${cast.skill.name} — ${event.condition}`,
          offTarget: cast.command.offTarget
        })
      });
      strikes(runtime, cast, spirit, spirit.summonTicks, 'initial');
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.painfulBond);
      const effect = requireEffect(profile, 'buff', 'necromancer-painful-bond');
      if (effect && spirit.summonTicks.length) {
        const at = canonicalTime(
          runtime.time + spirit.summonTicks[0].atMs / 1000 + (cast.command.impactDelayMs ?? 0) / 1000
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
    },
    'ritualist.summon-wanderlust'(runtime, context) {
      if (context.kind !== 'cast') return;
      const cast = context.cast;
      const spirit = spiritDefinition(runtime, cast.skill.id)!;
      const key = spirit.key;
      summon(runtime, cast, spirit);
      strikes(runtime, cast, spirit, spirit.lingeringTicks, 'initial');
      const first = spirit.lingeringTicks[0];
      if (first) {
        const opening = requireBalanceProfileFromContext(runtime, PROFILE.wanderlust);
        runtime.effects.emit({
          kind: 'profile',
          profile: opening,
          effects: opening.effects?.filter((effect) => effect.type === 'condition'),
          at: canonicalTime(runtime.time + first.atMs / 1000 + (cast.command.impactDelayMs ?? 0) / 1000),
          attribution: { ...attribution(cast), ...spiritFields(key, 'initial') },
          transform: (event) => ({
            ...event,
            name: `${cast.skill.name} — ${event.condition}`,
            offTarget: cast.command.offTarget
          })
        });
      }
    },
    'ritualist.summon-preservation'(runtime, context) {
      if (context.kind !== 'cast') return;
      const cast = context.cast;
      const spirit = spiritDefinition(runtime, cast.skill.id)!;
      summon(runtime, cast, spirit);
      for (const effect of cast.skill.effects ?? [])
        if (effect.type === 'boon') {
          // Shared emission owns transport; the mechanic selects attribution and delivery.
          const emissionRuntime: NecromancerRuntime = runtime;
          const emissionCast: RuntimeCast<NecromancerSkill> = cast;
          const emissionProfile: Skill = cast.skill;
          const emissionEffects: readonly SkillEffect[] = [effect];

          emissionRuntime.effects.emit({
            kind: 'profile',
            profile: emissionProfile,
            effects: emissionEffects,
            attribution: { ...attribution(emissionCast), source: 'necromancer' },
            transform: (event) => ({
              ...event,
              icon: emissionCast.skill.icon,
              offTarget: emissionCast.command.offTarget,
              audience: {
                recipients: 'party',
                maximumRecipients: 5,
                eligibleCompanionIds: necromancerActiveBoonCompanionIds(emissionRuntime)
              }
            })
          });
        }
    },
    'ritualist.innervate'(runtime, context) {
      if (context.kind !== 'cast') return;
      const cast = context.cast;
      const innervate = INNERVATE.get(cast.skill.id)!;
      grantNecromancerLifeForce(runtime, Number(cast.skill.innervateLifeForceGain ?? 0));
      for (const effect of cast.skill.effects ?? []) {
        if (effect.type === 'boon') {
          // Shared emission owns transport; the mechanic selects attribution and delivery.
          const emissionRuntime: NecromancerRuntime = runtime;
          const emissionCast: RuntimeCast<NecromancerSkill> = cast;
          const emissionProfile: Skill = cast.skill;
          const emissionEffects: readonly SkillEffect[] = [effect];

          emissionRuntime.effects.emit({
            kind: 'profile',
            profile: emissionProfile,
            effects: emissionEffects,
            attribution: { ...attribution(emissionCast), source: 'necromancer' },
            transform: (event) => ({
              ...event,
              icon: emissionCast.skill.icon,
              offTarget: emissionCast.command.offTarget,
              audience: {
                recipients: 'party',
                maximumRecipients: 5,
                eligibleCompanionIds: necromancerActiveBoonCompanionIds(emissionRuntime)
              }
            })
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
              runtime.time + (spirit.activeTicks[0]?.atMs ?? 0) / 1000 + (cast.command.impactDelayMs ?? 0) / 1000
            )
          });
        state.spiritBusyUntil[spirit.key] = Math.max(
          state.spiritBusyUntil[spirit.key],
          canonicalTime(runtime.time + spirit.activeDuration)
        );
      }
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
        runtime.effects.emit({ kind: 'packet', event: work.event });
    }
  }
};
