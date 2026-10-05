import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import {
  buildMesmerConditions,
  buildMesmerStrikes,
  mesmerPacketOwner
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { mesmerConditionFromProfile } from '#gw2/professions/mesmer/core/mechanics/conditions.js';
import {
  bladesongConfusion,
  bladesongTier
} from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/bladesong-projection.js';
import type {
  MesmerShatterResolverRequest,
  MesmerShatterTraitHit
} from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { applyCryOfPain, masterOfFragmentationRequiem } from '#gw2/professions/mesmer/core/traits/illusions.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { virtuosoState } from '#gw2/professions/mesmer/specializations/virtuoso/state.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Resolves Virtuoso Bladesong packets and reports their actual impact timing to shared shatter traits. */
export function resolveBladesong(
  context: MesmerRuntime,
  { skill, shatter, at, castStart, spent, delivery }: MesmerShatterResolverRequest
): readonly MesmerShatterTraitHit[] {
  const tier = bladesongTier(shatter, skill, spent);
  const { strike } = tier;
  const packetTicks = () => strike?.ticks ?? [];

  const addBladeDamage = (ticks: readonly { readonly atMs: number; readonly coefficient: number }[]) =>
    strike
      ? buildMesmerStrikes(
          context,
          skill,
          at,
          {
            ...strike,
            ...(ticks.length ? { ticks } : {}),
            source: 'Player',
            weaponStrengthProfileId: 'nonweapon.profession-mechanic'
          },
          { metadata: { shatterTraitEligible: true, blade: true } }
        ).map((packet) => {
          context.effects.emit({
            ...delivery,
            kind: 'packet',
            event: packet,
            owner: mesmerPacketOwner(packet),
            priority: Number(packet.priority ?? 0)
          });
          return packet;
        })
      : [];

  if (shatter.kind === 'blade-power') {
    const ticks = packetTicks();
    return addBladeDamage(ticks).map((event) => ({ at: event.at, count: 1 }));
  }

  if (shatter.kind === 'blade-confusion') {
    const baseConfusion = mesmerConditionFromProfile(context, shatter.balanceProfileId || skill.id, 'Confusion');
    const confusion = bladesongConfusion(shatter, spent, applyCryOfPain(context, baseConfusion));
    const ticks = packetTicks();

    const hits = addBladeDamage(ticks);
    if (confusion)
      buildMesmerConditions(context, skill.name, at, confusion, 'Player', '', { skillId: skill.id }).forEach(
        (packet) => {
          context.effects.emit({
            ...delivery,
            kind: 'packet',
            event: packet,
            owner: mesmerPacketOwner(packet),
            priority: Number(packet.priority ?? 0)
          });
        }
      );
    return hits.map((event) => ({ at: event.at, count: 1 }));
  }

  if (shatter.kind === 'blade-control') {
    // A blade cannot impact before the activation has actually committed its resource spend.
    const damageAt = Math.max(at, castStart + (shatter.damageAtMs || 0) / 1000);
    if (strike)
      buildMesmerStrikes(
        context,
        skill,
        damageAt,
        {
          ...strike,
          source: 'Player',
          weaponStrengthProfileId: 'nonweapon.profession-mechanic'
        },
        { metadata: { shatterTraitEligible: true, blade: true } }
      ).forEach((packet) => {
        context.effects.emit({
          ...delivery,
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
      });
    context.effects.emit({
      ...delivery,
      kind: 'profile',
      profile: { ...skill, effects: tier.effects },
      at: castStart,
      fullEnd: damageAt,
      attribution: {
        source: 'Player',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name
      },
      priority: 0
    });
    return strike ? [{ at: damageAt, count: 1 }] : [];
  }

  if (shatter.kind === 'blade-requiem') {
    const ticks = masterOfFragmentationRequiem(context, packetTicks());
    return addBladeDamage(ticks).map((event) => ({ at: event.at, count: 1 }));
  }

  if (shatter.kind === 'blade-defense') {
    return tier.traitStrike ? [{ at, count: 1 }] : [];
  }

  throw new Error(`Unsupported Bladesong kind: ${shatter.kind}.`);
}

/** Requires at least one stocked blade before a Virtuoso bladesong can begin. */
export function virtuosoAvailability(
  context: MechanicQueriesOf<MesmerRuntime>,
  skill: MesmerSkill
): AvailabilityResult {
  // Explicit IDs must obey the same weapon replacement as the palette.
  if (skill.id === ID.BLADECALL_NON_VIRTUOSO) {
    return denySkillCast(skill, 'mesmer.virtuoso-dagger-replaced', 'Virtuoso replaces this dagger skill.');
  }

  if (!skill.shatter || virtuosoState.from(context).numericResource >= 1) {
    return { ready: true };
  }

  return {
    ready: false,
    retryAt: null,
    code: 'mesmer.no-blades',
    reason: `${skill.name} requires at least one blade.`
  };
}
