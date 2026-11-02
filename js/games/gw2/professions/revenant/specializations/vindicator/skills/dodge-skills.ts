import { ACTOR, BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { effectFirstAtMs } from '#gw2/platform/effects/authoring.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { VINDICATOR_LANDING_MS } from '#gw2/professions/revenant/data/vindicator-dodge.js';
import {
  imperialImpactDodge,
  saintsShieldDodge
} from '#gw2/professions/revenant/specializations/vindicator/traits/behavior.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

export const VINDICATOR_LANDING_TASK = 'revenant.vindicator-landing';

/** The grandmaster trait selects the dodge landing, so no separate dodge choice can drift from the build. */
export function selectedDodge(runtime: MechanicQueriesOf<RevenantRuntime>): RevenantSkill | undefined {
  const skillId = saintsShieldDodge(runtime) ?? imperialImpactDodge(runtime) ?? ID.DEATH_DROP;
  return runtime.helpers.skillsById.get(skillId);
}

/** Resolves the selected payload at its authored offset after the dodge's airborne phase. */
export function scheduleLanding(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>, origin: number): void {
  const profile = selectedDodge(runtime);
  const effect = profile?.effects?.find((candidate) => candidate.type === 'strike' || candidate.type === 'boon');

  if (!profile || !effect) return;

  const offset = effect.type === 'strike' ? effectFirstAtMs(effect) : effect.atMs;
  runtime.schedule(VINDICATOR_LANDING_TASK, canonicalTime(origin + Math.max(0, offset || 0) / 1000), {
    origin,
    skillId: cast.skill.id,
    activationId: cast.id
  });
}

export const VINDICATOR_DODGE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RevenantSkill>>> = {
  // Saint's Shield replaces dodge damage with a party alacrity application at the landing effect point.
  [ID.SAINTS_SHIELD]: {
    name: "Saint's Shield",
    icon: 'https://render.guildwars2.com/file/42D514BF15A3F84ECECBACC7E05F95CAE03EBF6D/2491539.png',
    type: 'Action',
    slot: 'Action',
    cooldown: 0,
    energyCost: 0,
    castTimeMs: VINDICATOR_LANDING_MS,
    effects: [
      {
        type: 'boon',
        boon: BOON.ALACRITY,
        duration: 4,
        stacks: 1,
        atMs: 160,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ]
  },
  [ID.DEATH_DROP]: {
    name: 'Death Drop',
    icon: 'https://render.guildwars2.com/file/2864D963D3FC9156E6F52FA95DD34C2DE30306BE/2491537.png',
    type: 'Action',
    slot: 'Action',
    cooldown: 0,
    energyCost: 0,
    castTimeMs: VINDICATOR_LANDING_MS,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 160, coefficient: 3.3 }],
        name: 'Death Drop',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 10,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.IMPERIAL_IMPACT]: {
    name: 'Imperial Impact',
    icon: 'https://render.guildwars2.com/file/955F334FAA12550A15127A6200CB7BDE4D41BD0A/2491538.png',
    type: 'Action',
    slot: 'Action',
    cooldown: 0,
    energyCost: 0,
    castTimeMs: VINDICATOR_LANDING_MS,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 160, coefficient: 2 }],
        name: 'Imperial Impact',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      // The landing chills foes and shares both boons with the party; tooltips read these same packets.
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 10,
        stacks: 5,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      {
        type: 'boon',
        boon: BOON.PROTECTION,
        duration: 5,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ]
  }
};
