import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import type { StrikeEffect } from '#gw2/platform/effects/types.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { projectCastRelativeEffectTimingMs } from '#gw2/platform/execution/cast-timing.js';
/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Log-measured impact/aftercast timings are separate from Aura's fixed one-second fuse pulses.
export const REVENANT_WEAPONS_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.BLOSSOMING_AURA]: {
    // This declaration activates the Aura lifecycle owned below.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'revenant.blossoming-aura' } }
    ],
    castTimeMs: 600,
    interruptCommitMs: 480,
    rechargeAnchor: 'castStart',
    duration: 4,
    pulseInterval: 1,
    cooldown: 8,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 4 }, (_, index) => ({
          atMs: 480 + index * 1000,
          coefficient: 4.8 / 4
        })),
        name: 'Pulsing Damage',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 1,
        damageIncreasePerStack: 0.5,
        hits: 1,
        name: 'Final Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.DEACTIVATE_OTHERWORLDLY_BOND]: {
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.DEACTIVATE_OTHERWORLDLY_BOND } }],
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.ACERBIC_CUT]: {
    castTimeMs: 640,
    interruptCommitMs: 280,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.533,
        hits: 1,
        name: 'Acerbic Cut',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 9,
        stacks: 2
      }
    ]
  },
  [ID.SERENE_SLASH]: {
    castTimeMs: 560,
    interruptCommitMs: 280,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.533,
        hits: 1,
        name: 'Serene Slash',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        actorType: 'player'
      }
    ]
  },
  [ID.MOTIVATING_WHIRL]: {
    castTimeMs: 440,
    interruptCommitMs: 280,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Motivating Whirl',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        actorType: 'player'
      }
    ]
  },
  [ID.OTHERWORLDLY_BOND]: {
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.DEACTIVATE_OTHERWORLDLY_BOND } }],
    castTimeMs: 520,
    flipDuration: 7,
    cooldown: 8,
    energyCost: 5,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 9,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.DETONATE_BLOSSOMING_AURA]: {
    // This declaration activates the Aura lifecycle owned below.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'revenant.detonate-aura' } },
      { on: 'castCommit', do: { type: 'flipConsume', skillId: ID.DETONATE_BLOSSOMING_AURA } }
    ],
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  }
});

const REVENANT_BLOSSOMING_AURA = 'revenant.blossoming-aura';

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
  const stacks = Math.min(
    3,
    Math.max(0, Math.floor((runtime.time - expiresAt + Number(skill.duration) + 1e-9) / Number(skill.pulseInterval)))
  );
  const common = {
    at: runtime.time,
    source: 'revenant',
    sourceId: skill.id,
    actorType: 'player' as const,
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
      actorType: 'player',
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
  sideEffectHandlers: {
    'revenant.blossoming-aura'(runtime, context) {
      if (context.kind === 'cast') startRevenantBlossomingAura(runtime, context.cast);
    },
    'revenant.detonate-aura'(runtime, context) {
      if (context.kind === 'cast') detonateRevenantBlossomingAura(runtime, context.cast);
    }
  },
  modifyEffects(_runtime, cast, effects) {
    return cast.skill.id === ID.BLOSSOMING_AURA || cast.skill.id === ID.DETONATE_BLOSSOMING_AURA ? [] : effects;
  },
  tasks: { [REVENANT_BLOSSOMING_AURA]: revenantBlossomingAuraPulse }
} satisfies RuntimeHooks<RevenantRuntimeState, RevenantSkill>;
