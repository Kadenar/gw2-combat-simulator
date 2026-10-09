import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { gw2AlliedEffectRecipients } from '#gw2/platform/combat/state/allied-players.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { necromancerActiveMinionCompanionIds } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import {
  ritualistResolverEventReactions,
  triggerRitualistWeaponSpell
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-effects.js';
import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { wieldersBoonCharges } from '#gw2/professions/necromancer/specializations/ritualist/traits/behavior.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const EXPIRE = 'ritualist.weapon-spell-expiry';
const BOND = 'ritualist.painful-bond-pulse';
// Bond stacks duration while the native owner retains pulse cadence and cancellation generations.
function bondExpiresAt(runtime: NecromancerRuntime): number {
  return Math.max(
    runtime.time,
    ...runtime.combat
      .buffApplications('necromancer-painful-bond')
      .filter((application) => application.at <= runtime.time)
      .map((application) => application.expiresAt)
  );
}

const owner = (spell: string, generation: number) => ({ id: `ritualist.weapon-spell:${spell}`, generation });

/** Duration stacking retains the first cadence without queuing idle pulses between disjoint Bond windows. */
function applyBond(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  if (
    event.mode !== 'apply' ||
    !(Number(event.duration) > 0) ||
    runtime.deathTime != null ||
    event.offTarget ||
    runtime.combatStartPending ||
    (runtime.combatStartTime != null && runtime.time < runtime.combatStartTime)
  )
    return;
  const state = ritualistState.from(runtime);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.painfulBond);
  const buff = requireEffect(profile, 'buff', 'necromancer-painful-bond');
  if (!buff) return;
  const expiresAt = gw2EffectExpiresAt(bondExpiresAt(runtime), Number(event.duration));
  runtime.effects.emit({
    kind: 'packet',
    settlement: 'reaction',
    event: {
      ...event,
      type: 'buff',
      at: runtime.time,
      kind: String(buff.kind),
      duration: expiresAt - runtime.time,
      stacks: effectNumber(profile, buff, 'stacks')
    }
  });
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  runtime.cancelOwner({ id: BOND, generation: state.painfulBondGeneration });
  state.painfulBondGeneration++;
  const identity = { id: BOND, generation: state.painfulBondGeneration };
  if (!(interval > 0)) return;
  const firstApplication = !Number.isFinite(state.painfulBondPulseAnchorAt);
  if (firstApplication)
    state.painfulBondPulseAnchorAt = canonicalTime(runtime.time + balanceProfileNumber(profile, 'initialDelay'));
  // At an existing cadence boundary its prior pulse has already settled before this new ordinary application.
  const index = firstApplication
    ? 0
    : Math.max(0, Math.floor(canonicalTime(runtime.time - state.painfulBondPulseAnchorAt) / interval) + 1);
  const at = canonicalTime(state.painfulBondPulseAnchorAt + index * interval);
  if (requireEffect(profile, 'strike', 'Strike') && at < bondExpiresAt(runtime))
    runtime.schedule(BOND, at, event, identity);
}

/** A definition-selected grant replaces only its spell's recipients and generation-owned opportunities. */
function grantWeaponSpell(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  spell: 'nightmare' | 'splinter' | 'resilient'
): void {
  const effect = cast.skill.effects?.find((effect) => effect.type === 'buff');
  if (!effect) return;
  const state = ritualistState.from(runtime);
  const previous = state.weaponSpells[spell];
  if (previous) runtime.cancelOwner(owner(spell, previous.generation));
  const generation = ++state.weaponSpellGeneration;
  const expiresAt = canonicalTime(runtime.time + Number(effect.duration ?? 0));
  const allyStacks = wieldersBoonCharges(runtime, effect);
  const audience = gw2AlliedEffectRecipients(runtime.config, {
    ...effect.audience,
    recipients: 'party',
    eligibleCompanionIds: necromancerActiveMinionCompanionIds(runtime)
  });
  const recipients: Record<string, ChargeGrant> = { player: grantCharges(Number(effect.stacks ?? 0), expiresAt) };
  for (const key of audience.companionIds) recipients[key] = grantCharges(allyStacks, expiresAt);
  // Defensive grants retain allied effect windows independently of the party's offensive strike cadence.
  if (spell === 'resilient')
    for (let index = 1; index <= audience.alliedPlayerCount; index++)
      recipients[`ally:${audience.alliedPlayerIndex ?? index}`] = grantCharges(allyStacks, expiresAt);
  state.weaponSpells[spell] = {
    generation,
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    recipients
  };
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'necromancer',
      sourceId: cast.skill.id,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      kind: String(effect.kind),
      duration: Number(effect.duration ?? 0),
      stacks: Number(effect.stacks ?? 0),
      resolvedAudience: audience
    }
  });
  runtime.schedule(EXPIRE, expiresAt, { spell, generation }, owner(spell, generation), -20);
  if (spell !== 'resilient') grantAlliedWeaponSpell(runtime, spell, audience.alliedPlayerCount, allyStacks, expiresAt);
}

/** Existing per-recipient spell grants inspect one common strike; replacing a grant never moves its cadence. */
function grantAlliedWeaponSpell(
  runtime: NecromancerRuntime,
  spell: 'nightmare' | 'splinter',
  maximumAllies: number,
  charges: number,
  expiresAt: number
): void {
  const active = ritualistState.from(runtime).weaponSpells[spell];
  runtime.alliedStrikes.registerRecipients(
    (allyIndex) => {
      // Create native charges only after the controller accepts a recipient with a live strike cadence.
      active.recipients![`ally:${allyIndex}`] = grantCharges(charges, expiresAt);
      return {
        id: `ritualist.weapon-spell:${spell}:${allyIndex}`,
        expiresAt: active.recipients![`ally:${allyIndex}`].expiresAt,
        isActive: () =>
          ritualistState.from(runtime).weaponSpells[spell] === active &&
          active.recipients![`ally:${allyIndex}`].charges > 0,
        trigger(opportunity) {
          triggerRitualistWeaponSpell(
            runtime,
            {
              type: 'proc',
              at: opportunity.at,
              source: 'Weapon Spell',
              sourceId: active.skillId!,
              actorType: 'effect',
              skillId: active.skillId,
              skillName: active.skillName,
              activationId: opportunity.activationId,
              metadata: { triggeredByAlly: allyIndex }
            },
            spell,
            [`ally:${allyIndex}`]
          );
        }
      };
    },
    { maximumAllies }
  );
}

/** Weapon spells and Bond own their live grants and timers alongside the specialization's spirit lifecycle. */
export const ritualistSpellHooks: RuntimeHooks<NecromancerRuntimeState, NecromancerSkill> = {
  sideEffectHandlers: {
    'ritualist.nightmare-weapon'(runtime, context) {
      if (context.kind === 'cast') grantWeaponSpell(runtime, context.cast, 'nightmare');
    },
    'ritualist.splinter-weapon'(runtime, context) {
      if (context.kind === 'cast') grantWeaponSpell(runtime, context.cast, 'splinter');
    },
    'ritualist.resilient-weapon'(runtime, context) {
      if (context.kind === 'cast') grantWeaponSpell(runtime, context.cast, 'resilient');
    }
  },
  eventHandlers: { 'necromancer.painful-bond': applyBond },
  reactions: { 'damage.resolved': ritualistResolverEventReactions.damage },
  tasks: {
    [EXPIRE](runtime, data) {
      const { spell, generation } = data as { spell: string; generation: number };
      const state = ritualistState.from(runtime);
      if (state.weaponSpells[spell]?.generation === generation) delete state.weaponSpells[spell];
    },
    [BOND](runtime, data) {
      const state = ritualistState.from(runtime);
      if (runtime.time >= bondExpiresAt(runtime) || runtime.deathTime != null) return;
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.painfulBond);
      const strike = requireEffect(profile, 'strike', 'Strike');
      emitPainfulBond(runtime, data as Gw2ResolverEvent);
      const at = canonicalTime(runtime.time + balanceProfileNumber(profile, 'pulseInterval'));
      if (strike && at > runtime.time && at < bondExpiresAt(runtime))
        runtime.schedule(BOND, at, data, { id: BOND, generation: state.painfulBondGeneration });
    }
  }
};

/** One shared Painful Bond pulse, independent of spirit activation or pulse scheduling. */
export function emitPainfulBond(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.painfulBond);
  const strike = requireEffect(profile, 'strike', 'Strike');
  if (strike)
    runtime.effects.emit({
      kind: 'packet',
      event: buildResolverStrike({
        at: runtime.time,
        source: 'Spirit',
        sourceId: 'ritualist.painful-bond',
        // Bond retains the creating summon's artwork without borrowing its damage identity.
        icon: event.icon,
        actorType: 'effect',
        skillName: 'Painful Bond',
        // Bond's shared cadence belongs to the profession mechanic rather than its latest spirit summon.
        procType: 'profession',
        coefficient: 0,
        flatStrikeBase: effectNumber(profile, strike, 'flatStrikeBase'),
        flatStrikePowerCoeff: effectNumber(profile, strike, 'flatStrikePowerCoeff'),
        skillWeapon: 'Unequipped',
        canCrit: false,
        triggeredBy: event.triggeredBy
      })
    });
}
