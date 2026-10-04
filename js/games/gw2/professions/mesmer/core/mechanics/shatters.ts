import {
  buildMesmerConditions,
  buildMesmerStrikes,
  mesmerPacketOwner
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { mesmerConditionFromProfile } from '#gw2/professions/mesmer/core/mechanics/conditions.js';
import type {
  MesmerShatterResolverRequest,
  MesmerShatterTraitHit
} from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { applyCryOfPain } from '#gw2/professions/mesmer/core/traits/illusions.js';
import { triggerBlindingDissipation } from '#gw2/professions/mesmer/core/traits/dueling.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Resolves clone-based shatter packets while keeping repeat strikes ineligible for first-strike traits. */
export function resolveCloneShatter(
  context: MesmerRuntime,
  { skill, shatter, at, spent, castStart, delivery }: MesmerShatterResolverRequest
): readonly MesmerShatterTraitHit[] {
  const sources = spent + 1;
  const strike = shatter.strikes[spent];

  const addStrikePackets = (): void => {
    if (!strike) return;
    const ticks = strike.ticks ?? [{ atMs: strike.atMs ?? 0, coefficient: strike.coefficient }];

    // Each source contributes one hit to every packet, but shatter traits are
    // attached only to the first packet as required by repeat-strike shatters.
    for (const [strikeIndex, tick] of ticks.entries()) {
      buildMesmerStrikes(
        context,
        skill,
        at + tick.atMs / 1000,
        {
          ...strike,
          name: undefined,
          summonKind: undefined,
          ticks: undefined,
          coefficient: tick.coefficient,
          hits: sources,
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
          name: undefined,
          summonKind: undefined,
          hits: sources,
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
    const confusion = applyCryOfPain(context, baseConfusion);
    if (confusion)
      buildMesmerConditions(
        context,
        skill.name,
        at,
        {
          ...confusion,
          stacks: sources * (confusion.stacks ?? 1)
        },
        'Player',
        '',
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
          name: undefined,
          summonKind: undefined,
          hits: sources,
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
        effects: (skill.effects || []).map((effect) => ({ ...effect, applications: sources }))
      },
      at: castStart,
      fullEnd: at,
      attribution: {
        source: 'Player',
        sourceId: {
          ...skill,
          effects: (skill.effects || []).map((effect) => ({ ...effect, applications: sources }))
        }.id,
        actorType: 'player',
        skillId: {
          ...skill,
          effects: (skill.effects || []).map((effect) => ({ ...effect, applications: sources }))
        }.id,
        skillName: {
          ...skill,
          effects: (skill.effects || []).map((effect) => ({ ...effect, applications: sources }))
        }.name
      },
      priority: 0
    });
  } else {
    throw new Error(`Unsupported clone shatter kind: ${shatter.kind}.`);
  }

  return strike || shatter.kind === 'control' ? [{ at, count: sources }] : [];
}
