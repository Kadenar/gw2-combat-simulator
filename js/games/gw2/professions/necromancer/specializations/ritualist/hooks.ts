import {
  canActivateRitualistSpirit,
  initializeRitualistSpiritLifecycle,
  markRitualistSpiritBusy,
  ritualistSpiritTasks,
  summonRitualistSpirit
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-lifecycle.js';
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
import { necromancerActiveBoonCompanionIds } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import {
  attribution,
  spiritFields
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/attribution.js';
import {
  emitPainfulBond,
  ritualistSpellHooks
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spells.js';
import { spiritDefinition } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirits.js';
import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import {
  initializeRitualistSummonTraits,
  lingeringSpiritsActive
} from '#gw2/professions/necromancer/specializations/ritualist/traits/behavior.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const INNERVATE = new Map<SkillId, string>([
  [ID.INNERVATE_ANGUISH, 'anguish'],
  [ID.INNERVATE_WANDERLUST, 'wanderlust'],
  [ID.INNERVATE_PRESERVATION, 'preservation']
]);
type Spirit = NonNullable<ReturnType<typeof spiritDefinition>>;

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
    runtime.effects.emit({
      kind: 'packet',
      event: buildResolverStrike({
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
    });
  }
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
    initializeRitualistSpiritLifecycle(runtime);
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
      summonRitualistSpirit(runtime, cast, spirit);
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
      summonRitualistSpirit(runtime, cast, spirit);
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
      for (const id of [ID.ANGUISH, ID.WANDERLUST, ID.PRESERVATION]) {
        const spirit = spiritDefinition(runtime, id)!;
        if (!canActivateRitualistSpirit(runtime, spirit.key)) continue;
        strikes(runtime, cast, spirit, spirit.activeTicks, 'summon-spirits');
        if (spirit.key === 'wanderlust')
          runtime.effects.emit({
            kind: 'packet',
            event: {
              ...attribution(cast),
              ...spiritFields(spirit.key, 'summon-spirits'),
              type: 'control',
              controlKind: 'daze',
              sourceId: `ritualist.${spirit.key}.summon-spirits`,
              at: canonicalTime(
                runtime.time + (spirit.activeTicks[0]?.atMs ?? 0) / 1000 + (cast.command.impactDelayMs ?? 0) / 1000
              )
            }
          });
        markRitualistSpiritBusy(runtime, spirit);
      }
    }
  },
  tasks: {
    ...ritualistSpellHooks.tasks,
    ...ritualistSpiritTasks
  }
};
