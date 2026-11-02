/** Canonical Core revenant skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { StrikeEffect } from '#gw2/platform/effects/types.js';
import { CAST_READY, denySkillCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { projectCastRelativeEffectTimingMs } from '#gw2/platform/execution/cast-timing.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { Skill, SkillDefinition } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime, timeKey } from '#kernel/core/clock.js';

// Log-measured impact/aftercast timings are separate from Aura's fixed one-second fuse pulses.
export const REVENANT_WEAPONS_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RevenantSkill>>> = {
  [ID.SERENE_SLASH]: {
    name: 'Serene Slash',
    icon: 'https://render.guildwars2.com/file/F5619506C690982B140AE67DEA7901039FB3615E/3240360.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 560,
    interruptCommitMs: 280,
    effects: [
      {
        type: 'strike',
        coefficient: 0.533,
        hits: 1,
        name: 'Serene Slash',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.ACERBIC_CUT]: {
    name: 'Acerbic Cut',
    icon: 'https://render.guildwars2.com/file/F8A82D3762E99032368064CB2C334C08175F18BD/3240361.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 640,
    interruptCommitMs: 280,
    effects: [
      {
        type: 'strike',
        coefficient: 0.533,
        hits: 1,
        name: 'Acerbic Cut',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 9,
        stacks: 2
      }
    ]
  },
  [ID.MOTIVATING_WHIRL]: {
    name: 'Motivating Whirl',
    icon: 'https://render.guildwars2.com/file/80E5E7E4473D321EC639B9360DCD1266AEAA68A4/3240362.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 440,
    interruptCommitMs: 280,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Motivating Whirl',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.BLOSSOMING_AURA]: {
    name: 'Blossoming Aura',
    icon: 'https://render.guildwars2.com/file/0B604428F84A0A3DB0402FD6CBFB6AA859F33856/3240363.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_2',
    rechargeAnchor: 'castStart',
    duration: 4,
    pulseInterval: 1,
    cooldown: 8,
    energyCost: 10,
    castTimeMs: 600,
    interruptCommitMs: 480,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 4 }, (_, index) => ({
          atMs: 480 + index * 1000,
          coefficient: 1.2 / 4
        })),
        name: 'Pulsing Damage',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 1,
        damageIncreasePerStack: 0.5,
        hits: 1,
        name: 'Final Damage',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      }
    ],
    // The Aura lifecycle pulses these effects as its payload, so the cast itself emits none.
    effectVariants: [{ when: () => true, transform: () => [] }],
    // This declaration activates the Aura lifecycle owned below.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelledBeforeCommit,
        do: { type: 'revenant.blossoming-aura' }
      }
    ]
  },
  [ID.DETONATE_BLOSSOMING_AURA]: {
    name: 'Detonate Blossoming Aura',
    icon: 'https://render.guildwars2.com/file/1CC4BF4C44C2ACB691014E5AB22CF72709A3C91B/3256388.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_2',
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    effects: [],
    // This declaration activates the Aura lifecycle owned below.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelledBeforeCommit,
        do: { type: 'revenant.detonate-aura' }
      },
      { on: 'castCommit', do: { type: 'flipConsume', skillId: ID.DETONATE_BLOSSOMING_AURA } }
    ]
  },
  [ID.OTHERWORLDLY_BOND]: {
    name: 'Otherworldly Bond',
    icon: 'https://render.guildwars2.com/file/93C430490FB3141864AF2C0F992380EECB6B06A4/3240366.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_3',
    flipDuration: 7,
    cooldown: 8,
    energyCost: 5,
    castTimeMs: 520,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 10,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.SLOW,
        stacks: 1,
        duration: 1,
        actorType: ACTOR.PLAYER
      }
    ],
    // This enemy tether offers cancellation and then a pull; ally-target boon payloads do not apply.
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.start-bond' } }]
  },
  [ID.DEACTIVATE_OTHERWORLDLY_BOND]: {
    name: 'Deactivate Otherworldly Bond',
    icon: 'https://render.guildwars2.com/file/E5347DAC6F7B633ABFFA9D1F78BE13FD5F4AE048/3240367.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_3',
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    effects: [],
    // Cancelling the tether also cancels the pending attraction window.
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.release-bond' } }]
  },
  [ID.OTHERWORLDLY_ATTRACTION_ENEMY]: {
    name: 'Otherworldly Attraction (enemy)',
    icon: 'https://render.guildwars2.com/file/0E4308FA6D473FC7B140365FDC67A25AC57B3CDC/3240365.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Scepter',
    cooldown: 0,
    energyCost: 10,
    castTimeMs: 360,
    effects: [
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 6, duration: 10, actorType: ACTOR.PLAYER },
      { type: 'control', controlKind: CONTROL.PULL, actorType: ACTOR.PLAYER }
    ],
    // Releasing the mature enemy tether consumes both follow-ups and triggers disable reactions.
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.release-bond' } }]
  }
};

const REVENANT_BLOSSOMING_AURA = 'revenant.blossoming-aura';
const REVENANT_BOND_EXPIRY = 'revenant.bond-expiry';

/** One tether owns both sequential follow-ups and starts its recharge only when released. */
function releaseRevenantBond(runtime: RevenantRuntime): void {
  const active = runtime.consumeFlip(ID.OTHERWORLDLY_ATTRACTION_ENEMY);
  runtime.consumeFlip(ID.DEACTIVATE_OTHERWORLDLY_BOND);

  if (active)
    runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(ID.OTHERWORLDLY_BOND)!, runtime.time);
}

/** Keep delayed availability in the shared flip windows so casting and the weapon palette agree. */
function startRevenantBond(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const matureAt = runtime.time + 4;
  const expiresAt = runtime.time + Number(cast.skill.flipDuration);
  runtime.cooldownController.clear(cast.skill.id);
  runtime.armFlip(ID.DEACTIVATE_OTHERWORLDLY_BOND, {
    visibleAt: runtime.time,
    availableAt: runtime.time + 1,
    expiresAt: matureAt
  });
  const window = runtime.armFlip(ID.OTHERWORLDLY_ATTRACTION_ENEMY, {
    availableAt: matureAt,
    expiresAt,
    expiryPriority: 1
  });
  runtime.schedule(REVENANT_BOND_EXPIRY, expiresAt, window.identity);
}

interface AuraPulse {
  readonly index: number;
  readonly expiresAt: number;
  readonly activationId: string;
}

function auraSkill(runtime: RevenantRuntime): RevenantSkill {
  return runtime.helpers.skillsById.get(ID.BLOSSOMING_AURA)!;
}

function auraPulseTicks(skill: Skill) {
  const pulse = skill.effects?.find((effect) => effect.type === 'strike' && effect.name === 'Pulsing Damage');
  const ticks = (pulse as StrikeEffect | undefined)?.ticks;

  if (!pulse || !ticks?.length) throw new Error('Blossoming Aura is missing its pulse ticks.');

  return { pulse, ticks };
}

/** Only the initial impact follows cast speed; the attached aura then ticks on a fixed fuse. */
function startRevenantBlossomingAura(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const skill = cast.skill;
  const { ticks } = auraPulseTicks(skill);
  const firstAt =
    cast.start + projectCastRelativeEffectTimingMs(skill, (cast.fullEnd - cast.start) * 1000, ticks[0].atMs) / 1000;
  const expiresAt = canonicalTime(firstAt + Number(skill.duration));
  for (let index = 0; index <= ticks.length; index += 1)
    runtime.schedule(
      REVENANT_BLOSSOMING_AURA,
      index === ticks.length ? expiresAt : canonicalTime(firstAt + index * Number(skill.pulseInterval)),
      { index, expiresAt, activationId: cast.id } satisfies AuraPulse
    );
}

/** Manual and automatic detonation share scaling and consume the one armed fuse. */
function detonateAura(runtime: RevenantRuntime, activationId?: string): void {
  const flips = runtime.profession.core.availableFlips;
  const expiresAt = flips[ID.DETONATE_BLOSSOMING_AURA]?.expiresAt || 0;

  if (!expiresAt) return;

  const skill = auraSkill(runtime);
  const final = skill.effects?.find((effect) => effect.type === 'strike' && effect.name === 'Final Damage');

  if (final?.type !== 'strike') throw new Error('Blossoming Aura is missing its final strike.');

  // Integer clock arithmetic counts only completed fuse intervals at detonation.
  const stacks = Math.min(
    3,
    Math.max(
      0,
      Math.floor(
        (timeKey(runtime.time) - timeKey(expiresAt - Number(skill.duration))) / timeKey(Number(skill.pulseInterval))
      )
    )
  );
  const common = {
    at: runtime.time,
    source: 'revenant',
    sourceId: skill.id,
    actorType: ACTOR.PLAYER,
    skillId: skill.id,
    skillName: skill.name,
    ...(activationId ? { activationId } : {})
  };
  runtime.effects.emit({
    kind: 'packet',
    event: buildResolverStrike({
      ...common,
      name: final.name,
      coefficient: Number(final.coefficient) * (1 + Number(final.damageIncreasePerStack) * stacks),
      skillWeapon: skill.weapon || ''
    })
  });
  for (const effect of skill.effects ?? [])
    if (effect.type === 'condition' && effect.condition)
      runtime.effects.emit({
        kind: 'packet',
        event: buildResolverCondition({
          ...common,
          condition: effect.condition,
          stacks: Number(effect.stacks),
          duration: Number(effect.duration)
        })
      });
  consumeSkillFlip(flips, ID.DETONATE_BLOSSOMING_AURA);
}

/** The first pulse arms detonation; later pulses and the fuse run only while that same aura remains armed. */
function revenantBlossomingAuraPulse(runtime: RevenantRuntime, data: unknown): void {
  const { index, expiresAt, activationId } = data as AuraPulse;
  const skill = auraSkill(runtime);
  const { pulse, ticks } = auraPulseTicks(skill);
  const flips = runtime.profession.core.availableFlips;

  if (index === 0) armSkillFlip(flips, ID.DETONATE_BLOSSOMING_AURA, runtime.time, expiresAt);
  else if (Number(flips[ID.DETONATE_BLOSSOMING_AURA]?.expiresAt) !== expiresAt) return;

  if (index === ticks.length) {
    detonateAura(runtime, activationId);
    return;
  }

  runtime.effects.emit({
    kind: 'packet',
    event: buildResolverStrike({
      at: runtime.time,
      source: 'revenant',
      sourceId: skill.id,
      actorType: ACTOR.PLAYER,
      skillId: skill.id,
      skillName: skill.name,
      activationId,
      name: pulse.name,
      coefficient: ticks[index].coefficient,
      hitIndex: index + 1,
      totalHits: ticks.length,
      skillWeapon: skill.weapon || ''
    })
  });
}

/** Manual detonation resolves at acceptance of the committed follow-up. */
function detonateRevenantBlossomingAura(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  detonateAura(runtime, cast.id);
}

/** Aura owns its pulses and detonation; its templates must not also emit automatically. */
export const scepterLifecycle = {
  availability(runtime, skill) {
    const bond = runtime.profession.core.availableFlips[ID.OTHERWORLDLY_ATTRACTION_ENEMY];

    if (skill.id === ID.OTHERWORLDLY_BOND && bond && runtime.time < (bond.expiresAt ?? Infinity))
      return denySkillCast(skill, 'revenant.bond-active', 'release the active tether first.');

    return CAST_READY;
  },
  onCastCommit(runtime, cast) {
    // Changing weapons severs the enemy tether, including a pull that has not unlocked yet.
    if (cast.skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS) releaseRevenantBond(runtime);
  },
  sideEffectHandlers: {
    'revenant.start-bond'(runtime, context) {
      if (context.kind === 'cast') startRevenantBond(runtime, context.cast);
    },
    'revenant.release-bond'(runtime) {
      releaseRevenantBond(runtime);
    },
    'revenant.blossoming-aura'(runtime, context) {
      if (context.kind === 'cast') startRevenantBlossomingAura(runtime, context.cast);
    },
    'revenant.detonate-aura'(runtime, context) {
      if (context.kind === 'cast') detonateRevenantBlossomingAura(runtime, context.cast);
    }
  },
  tasks: {
    [REVENANT_BLOSSOMING_AURA]: revenantBlossomingAuraPulse,
    [REVENANT_BOND_EXPIRY](runtime, identity) {
      // A stale expiry must not release a replacement tether.
      if (runtime.profession.core.availableFlips[ID.OTHERWORLDLY_ATTRACTION_ENEMY]?.identity === identity)
        releaseRevenantBond(runtime);
    }
  }
} satisfies RuntimeHooks<RevenantRuntimeState, RevenantSkill>;
