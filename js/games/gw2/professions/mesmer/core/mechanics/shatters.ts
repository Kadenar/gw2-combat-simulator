import { mesmerConditionFromProfile } from '#gw2/professions/mesmer/core/mechanics/conditions.js';
import {
  buildMesmerConditions,
  buildMesmerStrikes,
  mesmerPacketOwner
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { cloneShatterConfusion, cloneShatterTier } from '#gw2/professions/mesmer/core/mechanics/shatter-projection.js';
import type {
  MesmerShatterResolverRequest,
  MesmerShatterTraitHit
} from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { triggerBlindingDissipation } from '#gw2/professions/mesmer/core/traits/dueling/index.js';
import { applyCryOfPain } from '#gw2/professions/mesmer/core/traits/illusions/index.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Resolves clone-based shatter packets while keeping repeat strikes ineligible for first-strike traits. */
export function resolveCloneShatter(
  context: MesmerRuntime,
  { skill, shatter, at, spent, castStart, delivery }: MesmerShatterResolverRequest
): readonly MesmerShatterTraitHit[] {
  const tier = cloneShatterTier(shatter, skill, spent);
  const { sources } = tier;
  const strike = tier.strikes[0];

  const addStrikePackets = (): void => {
    if (!strike) return;

    // Each source contributes one hit to every packet, but shatter traits are
    // attached only to the first packet as required by repeat-strike shatters.
    for (const [strikeIndex, packet] of tier.strikes.entries()) {
      buildMesmerStrikes(
        context,
        skill,
        at + (packet.atMs ?? 0) / 1000,
        {
          ...packet,
          atMs: 0,
          source: 'Player',
          weaponStrengthProfileId: 'nonweapon.profession-mechanic'
        },
        { metadata: { shatterTraitEligible: strikeIndex === 0 } }
      ).forEach((packet) => {
        context.effects.emit({
          ...delivery,
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
      });
    }
  };

  if (shatter.kind === 'power') {
    addStrikePackets();
  } else if (shatter.kind === 'confusion') {
    if (strike)
      buildMesmerStrikes(
        context,
        skill,
        at,
        {
          ...strike,
          atMs: 0,
          source: 'Player',
          weaponStrengthProfileId: 'nonweapon.profession-mechanic'
        },
        { skillId: skill.id, metadata: { shatterTraitEligible: true } }
      ).forEach((packet) => {
        context.effects.emit({
          ...delivery,
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
      });

    const baseConfusion = mesmerConditionFromProfile(context, shatter.balanceProfileId || skill.id, 'Confusion');
    const confusion = cloneShatterConfusion(applyCryOfPain(context, baseConfusion), sources);
    if (confusion)
      buildMesmerConditions(context, skill.name, at, confusion, 'Player', '', {
        skillId: skill.id,
        metadata: { shatterTraitEligible: true }
      }).forEach((packet) => {
        context.effects.emit({
          ...delivery,
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
      });

    triggerBlindingDissipation(context, skill.name, at, sources, delivery);
  } else if (shatter.kind === 'defense') {
    // An authored zero still hits; a removed packet cannot trigger hit traits.
    if (strike)
      buildMesmerStrikes(
        context,
        skill,
        at,
        {
          ...strike,
          atMs: 0,
          source: 'Player',
          weaponStrengthProfileId: 'nonweapon.profession-mechanic'
        },
        { metadata: { shatterTraitEligible: true } }
      ).forEach((packet) => {
        context.effects.emit({
          ...delivery,
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
      });
  } else if (shatter.kind === 'control') {
    // The resolved spend supplies player plus clone applications; no cast-completion observation substitutes for them.
    context.effects.emit({
      ...delivery,
      kind: 'profile',
      profile: {
        ...skill,
        effects: tier.effects
      },
      at: castStart,
      fullEnd: at,
      attribution: {
        source: 'Player',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name
      },
      priority: 0
    });
  } else {
    throw new Error(`Unsupported clone shatter kind: ${shatter.kind}.`);
  }

  return shatter.strikes[spent] || shatter.kind === 'control' ? [{ at, count: sources }] : [];
}
