import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
import {
  activeStackCount,
  addTimedStacks,
  grantTimedStacks,
  purgeExpiredStacks
} from '#gw2/platform/combat/resources/timed-stacks.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import {
  impactEffects,
  conditionEffectTicks,
  effectFirstAtMs,
  strikeEffectCoefficient
} from '#gw2/platform/effects/authoring.js';

// Align measured impacts and their attached effects on the nearest 40 ms action tick.
export const REVENANT_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.ABYSSAL_BLITZ]: {
    // The spear lifecycle reduces Abyssal Raze recharge after the qualifying hit.
    castTimeMs: 520,
    cooldown: 10,
    energyCost: 10,
    rechargeReduction: 3,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // The accepted authored strike owns the recharge reward.
        reactions: [
          { on: 'damage.resolved', actor: 'player', packets: 'first', do: { type: 'revenant.spear-recharge' } }
        ],
        name: 'Abyssal Blitz — Mine',
        actorType: 'player',
        ticks: [560, 720, 960].map((atMs) => ({ atMs, coefficient: 0.5 })),
        metadata: {}
      },
      {
        type: 'condition',
        actorType: 'player',
        ticks: [560, 720, 960].map((atMs) => ({ atMs, condition: 'Slow', stacks: 1, duration: 3 })),
        metadata: {}
      },
      {
        type: 'condition',
        actorType: 'player',
        ticks: [560, 720, 960].map((atMs) => ({ atMs, condition: 'Chilled', stacks: 1, duration: 3 })),
        metadata: {}
      },
      {
        type: 'condition',
        actorType: 'player',
        ticks: [560, 720, 960].map((atMs) => ({ atMs, condition: 'Weakness', stacks: 1, duration: 3 })),
        metadata: {}
      }
    ])
  },
  [ID.ABYSSAL_BLOT]: {
    // Abyssal Blot commits after 760 ms, preserving its field and delayed impacts after interruption.
    interruptCommitMs: 760,
    // The spear lifecycle reduces Abyssal Raze recharge after the qualifying hit.
    castTimeMs: 800,
    cooldown: 15,
    energyCost: 12,
    // The initial pull recharges Raze by 3 seconds per target, matching the in-game tooltip.
    rechargeReduction: 3,
    // The dark field spans Blot's five impacts so subsequent spear finishers
    // resolve their combo outcome against the field instead of its damage.
    comboFields: [
      {
        ownerId: 'revenant',
        fieldType: 'Dark',
        duration: 1.12,
        startMs: 960,
        startAnchor: 'castStart',
        inclusiveExpiry: true
      }
    ],
    effects: [
      {
        type: 'strike',
        // The accepted authored strike owns the recharge reward.
        reactions: [
          { on: 'damage.resolved', actor: 'player', packets: 'first', do: { type: 'revenant.spear-recharge' } }
        ],
        name: 'Abyssal Blot',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        ticks: [
          { atMs: 960, coefficient: 0.4 },
          { atMs: 1240, coefficient: 0.4 },
          { atMs: 1520, coefficient: 0.4 },
          { atMs: 1800, coefficient: 0.4 },
          { atMs: 2080, coefficient: 0.4 }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player',
        persistsAfterInterrupt: true,
        ticks: [
          { atMs: 960, condition: 'Poisoned', stacks: 1, duration: 6 },
          { atMs: 1240, condition: 'Poisoned', stacks: 1, duration: 6 },
          { atMs: 1520, condition: 'Poisoned', stacks: 1, duration: 6 },
          { atMs: 1800, condition: 'Poisoned', stacks: 1, duration: 6 },
          { atMs: 2080, condition: 'Poisoned', stacks: 1, duration: 6 }
        ],
        metadata: {}
      },
      // Share one impact timing while preserving independent payloads and declaration order.
      ...impactEffects({ atMs: 960, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
        {
          type: 'condition',
          condition: 'Chilled',
          stacks: 1,
          duration: 2,
          actorType: 'player'
        },
        {
          type: 'control',
          actorType: 'player',
          controlKind: 'pull'
        }
      ])
    ]
  },
  [ID.ABYSSAL_FORCE]: {
    // The spear lifecycle reduces Abyssal Raze recharge after the qualifying hit.
    castTimeMs: 520,
    cooldown: 6,
    energyCost: 4,
    rechargeReduction: 5,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 1160, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // The accepted authored strike owns the recharge reward.
        reactions: [
          { on: 'damage.resolved', actor: 'player', packets: 'first', do: { type: 'revenant.spear-recharge' } }
        ],
        coefficient: 0.8,
        hits: 1,
        name: 'Abyssal Force',
        actorType: 'player',
        metadata: {}
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ])
  },
  [ID.ABYSSAL_STRIKE]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    // The spear lifecycle reduces Abyssal Raze recharge after the qualifying hit.
    castTimeMs: 520,
    interruptCommitMs: 396,
    cooldown: 0,
    energyCost: 0,
    rechargeReduction: 1,
    nextChainId: null,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          // The accepted authored strike owns the recharge reward.
          reactions: [
            { on: 'damage.resolved', actor: 'player', packets: 'first', do: { type: 'revenant.spear-recharge' } }
          ],
          coefficient: 0.85,
          hits: 1,
          name: 'Abyssal Strike',
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Torment',
          stacks: 1,
          duration: 3,
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Vulnerability',
          stacks: 1,
          duration: 6,
          actorType: 'player'
        }
      ]
    )
  },
  [ID.ABYSSAL_RAZE]: {
    // This declaration schedules the live-stack impact owned below.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'revenant.abyssal-raze' } }
    ],
    // Impact reads live Crushing Abyss stacks, emits scaled damage, then grants one stack.
    // A qualifying weapon swap consumes the pool.
    castTimeMs: 600,
    cooldown: 1,
    ammoCastLockout: 1,
    ammo: 3,
    ammoRecharge: 15,
    energyCost: 8,
    maximumStacks: 3,
    comboFinishers: [
      {
        ownerId: 'revenant',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        damageIncreasePerStack: 0.33,
        name: 'Abyssal Raze',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 5,
        actorType: 'player',
        metadata: { trigger: 'crushing-abyss' }
      },
      {
        type: 'buff',
        sourceId: 72962,
        kind: 'crushing-abyss',
        duration: 10,
        stacks: 1,
        name: 'Crushing Abyss',
        actorType: 'player'
      }
    ])
  }
});

const REVENANT_ABYSSAL_RAZE = 'revenant.abyssal-raze-impact';

function activeCrushingAbyss(runtime: RevenantRuntime): number[] {
  const core = runtime.profession.core;
  core.crushingAbyss = purgeExpiredStacks(core.crushingAbyss, runtime.time);
  return core.crushingAbyss;
}

// Emit Abyssal Raze's stack-scaled strike and Torment packets at the current instant.
function abyssalRazePackets(
  runtime: RevenantRuntime,
  skill: RevenantSkill,
  stacks: number,
  activationId?: string,
  triggeredBy = ''
): void {
  const strike = skill.effects?.find((effect) => effect.type === 'strike');
  const conditions = skill.effects?.filter((effect) => effect.type === 'condition') ?? [];
  const baseTorment = conditions.find((effect) => !effect.metadata?.trigger);
  const crushingTorment = conditions.find((effect) => effect.metadata?.trigger === 'crushing-abyss');
  if (strike?.type !== 'strike' || !baseTorment || !crushingTorment)
    throw new Error('Abyssal Raze is missing its declarative effects.');
  const base = strikeEffectCoefficient(strike);
  const common = {
    at: runtime.time,
    source: 'revenant',
    sourceId: skill.id,
    actorType: 'player' as const,
    skillId: skill.id,
    skillName: skill.name,
    skillWeapon: 'Spear',
    ...(activationId ? { activationId } : {}),
    ...(triggeredBy ? { triggeredBy } : {})
  };
  runtime.effects.emit({
    kind: 'packet',
    event: buildResolverStrike({
      ...common,
      name: triggeredBy ? 'Abyssal Raze — Crushing Abyss' : 'Abyssal Raze',
      coefficient: triggeredBy ? base : base * (1 + Number(strike.damageIncreasePerStack || 0) * stacks)
    })
  });
  const baseTick = conditionEffectTicks(baseTorment)[0];
  runtime.effects.emit({
    kind: 'packet',
    event: buildResolverCondition({
      ...common,
      name: 'Abyssal Raze — Torment',
      condition: 'Torment',
      stacks: baseTick?.stacks || 0,
      duration: baseTick?.duration || 0
    })
  });
  if (stacks > 0) {
    const crushingTick = conditionEffectTicks(crushingTorment)[0];
    runtime.effects.emit({
      kind: 'packet',
      event: buildResolverCondition({
        ...common,
        name: 'Abyssal Raze — Crushing Abyss Torment',
        condition: 'Torment',
        stacks: (crushingTick?.stacks || 0) * stacks,
        duration: crushingTick?.duration || 0
      })
    });
  }
}

/** A committed Abyssal Raze resolves at its authored impact, reading the stacks that exist at that instant. */
function startRevenantAbyssalRaze(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const strike = cast.skill.effects?.find((effect) => effect.type === 'strike');
  if (!strike) throw new Error('Abyssal Raze is missing its strike effect.');
  runtime.schedule(REVENANT_ABYSSAL_RAZE, canonicalTime(cast.start + (effectFirstAtMs(strike) || 0) / 1000), {
    activationId: cast.id
  });
}

/** Impact packets use the current stack count; the impact then grants one more Crushing Abyss stack. */
function revenantAbyssalRazeImpact(runtime: RevenantRuntime, data: unknown): void {
  const skill = runtime.helpers.skillsById.get(ID.ABYSSAL_RAZE);
  if (!skill) return;
  const { activationId } = data as { activationId: string };
  abyssalRazePackets(runtime, skill, activeStackCount(activeCrushingAbyss(runtime), runtime.time), activationId);
  const effect = skill.effects?.find((candidate) => candidate.type === 'buff' && candidate.kind === 'crushing-abyss');
  if (effect?.type !== 'buff') throw new Error('Abyssal Raze is missing Crushing Abyss.');
  const maximum = Math.max(0, Number(skill.maximumStacks || 0));
  const duration = Math.max(0, effect.duration || 0);
  const grant = addTimedStacks(activeCrushingAbyss(runtime), 1, runtime.time, duration, maximum);
  // At the cap the grant lands nothing, and the buff must not be published either.
  if (grant.added === 0) return;
  runtime.profession.core.crushingAbyss = grant.expiries;
  const effectId = effect.sourceId ?? ID.ABYSSAL_RAZE;
  const effectName = effect.name || 'Crushing Abyss';
  runtime.effects.emit({
    kind: 'packet',
    event: {
      ...{
        type: 'buff',
        at: runtime.time,
        source: 'revenant',
        sourceId: ID.ABYSSAL_RAZE,
        actorType: 'player',
        skillId: effectId,
        skillName: effectName,
        activationId,
        icon: skill.icon,
        name: effectName,
        kind: 'crushing-abyss',
        duration,
        stacks: 1
      },
      fixedDuration: true
    }
  });
  runtime.effects.emit({
    kind: 'announcement',
    log: true,
    attribution: {
      source: 'revenant',
      sourceId: ID.ABYSSAL_RAZE,
      actorType: 'player',
      skillId: effectId,
      skillName: effectName
    },
    announcement: {
      at: runtime.time,
      sourceSkill: skill.name,
      icon: skill.icon,
      name: effectName,
      detail: `${runtime.profession.core.crushingAbyss.length}/${maximum} stacks`,
      type: 'skill'
    }
  });
}

/** Swapping between identical weapon types, including Spear to Spear, preserves Crushing Abyss and its expiry. */
function sameWeaponSets(runtime: RevenantRuntime): boolean {
  const set = (index: number) => gw2ConfiguredWeaponSet(runtime.config, index).map((weapon) => weapon || '');
  return JSON.stringify(set(1)) === JSON.stringify(set(2));
}

/** A committed swap to a genuinely different set spends maximum Crushing Abyss on an empowered Raze. */
function completeRevenantCrushingAbyssSwap(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const skill = runtime.helpers.skillsById.get(ID.ABYSSAL_RAZE);
  if (!skill) return;
  const maximum = Math.max(0, Number(skill.maximumStacks || 0));
  if (activeCrushingAbyss(runtime).length < maximum || sameWeaponSets(runtime)) return;
  runtime.profession.core.crushingAbyss = [];
  abyssalRazePackets(runtime, skill, maximum, cast.id, 'Swap Weapons');
}

/** The first landed hit of a spear skill reduces Abyssal Raze's live recharge by its authored seconds. */
function reactRevenantSpearRecharge(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  const source = runtime.helpers.skillsById.get(Number(event.skillId));
  const seconds = Number(source?.rechargeReduction || 0);
  const raze = runtime.helpers.skillsById.get(ID.ABYSSAL_RAZE);
  if (!source || !seconds || !raze || !(Number(raze.ammoRecharge) > 0)) return;
  // Spear reductions are authored in base seconds; the shared controller converts them to tracked recharge time.
  const reducedBy = runtime.cooldownController.reduceSkillRecharge(raze, seconds, runtime.time);
  if (reducedBy <= 0) return;
  const cooldownReduction = Number(reducedBy.toFixed(3));
  runtime.effects.emit({
    kind: 'announcement',
    log: true,
    attribution: {
      source: 'revenant',
      sourceId: source.id,
      actorType: 'player',
      skillId: source.id,
      skillName: source.name
    },
    announcement: {
      at: runtime.time,
      sourceSkill: source.name,
      icon: source.icon || '',
      name: `${source.name} — Abyssal Raze recharge`,
      detail: `${cooldownReduction}s`,
      cooldownReduction,
      type: 'skill'
    },
    cause: event
  });
}

/** Spear owns Crushing Abyss initialization, live impact scaling, recharge rewards, and swap consumption. */
export const spearLifecycle = {
  initialize(runtime) {
    // Initial Crushing Abyss feeds the same expiring pool read by Raze and consumed by weapon swap.
    for (const buff of runtime.config.initialBuffs ?? []) {
      if (buff.kind !== 'crushing-abyss') continue;
      const skill = runtime.helpers.skillsById.get(ID.ABYSSAL_RAZE)!;
      runtime.profession.core.crushingAbyss = grantTimedStacks([], {
        at: runtime.time,
        expiresAt: runtime.time + buff.duration,
        count: buff.stacks,
        maximumStacks: Number(skill.maximumStacks),
        retain: 'latest-expiry'
      });
    }
  },
  sideEffectHandlers: {
    'revenant.abyssal-raze'(runtime, context) {
      if (context.kind === 'cast') startRevenantAbyssalRaze(runtime, context.cast);
    },
    'revenant.spear-recharge'(runtime, context) {
      if (context.kind === 'effect') reactRevenantSpearRecharge(runtime, context.trigger.event);
    }
  },
  modifyEffects(_runtime, cast, effects) {
    return cast.skill.id === ID.ABYSSAL_RAZE ? [] : effects;
  },
  onCastCommit(runtime, cast) {
    if (cast.skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS) completeRevenantCrushingAbyssSwap(runtime, cast);
  },
  tasks: { [REVENANT_ABYSSAL_RAZE]: revenantAbyssalRazeImpact }
} satisfies RuntimeHooks<RevenantRuntimeState, RevenantSkill>;
