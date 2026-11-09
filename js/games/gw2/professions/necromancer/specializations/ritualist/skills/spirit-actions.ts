/** Apply skill-specific effects while the spirit lifecycle admits and owns pending attacks. */
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { weaponStrengthProfileForName } from '#gw2/platform/equipment/weapons/strength.js';
import { type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { effectNumber, requireEffect, requireSkill } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import {
  attribution,
  spiritFields
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/attribution.js';
import { ritualistPartyBoonPolicy } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/party-boons.js';
import {
  commandRitualistSpirits,
  summonRitualistSpirit
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-lifecycle.js';
import { spiritDefinition } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirits.js';
import { painfulBondSkill } from '#gw2/professions/necromancer/specializations/ritualist/skills/spirit-attacks.js';
import { spiritImpactAt } from '#gw2/professions/necromancer/specializations/ritualist/skills/spirit-packets.js';
import type { NecromancerRuntimeState, NecromancerSkill } from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

export const INNERVATE = new Map<SkillId, string>([
  [ID.INNERVATE_ANGUISH, 'anguish'],
  [ID.INNERVATE_WANDERLUST, 'wanderlust'],
  [ID.INNERVATE_PRESERVATION, 'preservation']
]);

/** This skill family owns its actions; hooks retain registration and cross-owner ordering. */
export const ritualistSpiritActions: NonNullable<
  RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>['sideEffectHandlers']
> = {
  'ritualist.wanderlust-opening'(runtime, context) {
    if (context.kind !== 'cast' || context.cast.cancelledBeforeCommit) return;

    const cast = context.cast;
    const swing = spiritDefinition(runtime, cast.skill.id)?.summonTicks[0];

    if (!swing) return;

    const skillWeapon = gw2ActivePrimaryWeapon(runtime.config, runtime.activeWeaponSet) || 'Unequipped';
    runtime.effects.emit({
      kind: 'packet',
      event: buildResolverStrike({
        ...attribution(cast),
        source: 'necromancer',
        at: spiritImpactAt(cast.start, cast, swing.atMs),
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
    const profile = requireSkill(runtime.helpers, painfulBondSkill.id);
    const effect = requireEffect(profile, 'buff', 'necromancer-painful-bond');

    if (effect && spirit.summonTicks.length) {
      const at = spiritImpactAt(runtime.time, cast, spirit.summonTicks[0].atMs);
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
    summonRitualistSpirit(runtime, cast, spirit);
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
    if (context.kind === 'cast') commandRitualistSpirits(runtime, context.cast);
  }
};
