import { canonicalTime } from '#kernel/core/clock.js';
import { gw2AlliedEffectRecipients, gw2AlliedPlayerAssumptions } from '#gw2/platform/combat/state/allied-players.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { castCompleted, gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { necromancerActiveMinionCompanionIds } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import {
  ritualistResolverEventReactions,
  triggerRitualistWeaponSpell
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-effects.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { NecromancerRuntime, NecromancerRuntimeState } from '#gw2/professions/necromancer/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

const EXPIRE = 'ritualist.weapon-spell-expiry';
const ALLY = 'ritualist.weapon-spell-opportunity';
const BOND = 'ritualist.painful-bond-pulse';
const BOND_END = 'ritualist.painful-bond-expiry';
const SPELLS = new Map<number, string>([
  [ID.NIGHTMARE_WEAPON, 'nightmare'],
  [ID.SPLINTER_WEAPON, 'splinter'],
  [ID.RESILIENT_WEAPON, 'resilient']
]);
const owner = (spell: string, generation: number) => ({ id: `ritualist.weapon-spell:${spell}`, generation });

interface AllyOpportunity {
  spell: 'nightmare' | 'splinter';
  generation: number;
  allyIndex: number;
  anchor: number;
  pulse: number;
  interval: number;
}

/** Replacements cancel all old opportunities; each ally retains only one next wake while its current grant is spendable. */
function scheduleAlly(runtime: NecromancerRuntime, work: AllyOpportunity): void {
  const active = ritualistState.from(runtime).weaponSpells[work.spell];
  const grant = active?.recipients?.[`ally:${work.allyIndex}`];
  const at = canonicalTime(work.anchor + work.pulse * work.interval);
  if (active?.generation === work.generation && grant && grant.charges > 0 && at < grant.expiresAt)
    runtime.schedule(ALLY, at, work, owner(work.spell, work.generation));
}

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
  runtime.emit({
    ...event,
    type: 'buff',
    at: runtime.time,
    kind: String(buff.kind),
    duration: Number(event.duration),
    stacks: effectNumber(profile, buff, 'stacks')
  });
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  runtime.cancelOwner({ id: BOND, generation: state.painfulBondGeneration });
  state.painfulBondGeneration++;
  state.painfulBondUntil = gw2EffectExpiresAt(Math.max(runtime.time, state.painfulBondUntil), Number(event.duration));
  const identity = { id: BOND, generation: state.painfulBondGeneration };
  runtime.schedule(BOND_END, state.painfulBondUntil, null, identity, -20);
  if (!(interval > 0)) return;
  const firstApplication = !Number.isFinite(state.painfulBondPulseAnchorAt);
  if (firstApplication)
    state.painfulBondPulseAnchorAt = canonicalTime(runtime.time + balanceProfileNumber(profile, 'initialDelay'));
  // At an existing cadence boundary its prior pulse has already settled before this new ordinary application.
  const index = firstApplication
    ? 0
    : Math.max(0, Math.floor(canonicalTime(runtime.time - state.painfulBondPulseAnchorAt) / interval) + 1);
  const at = canonicalTime(state.painfulBondPulseAnchorAt + index * interval);
  if (requireEffect(profile, 'strike', 'Strike') && at < state.painfulBondUntil)
    runtime.schedule(BOND, at, event, identity);
}

/** Weapon spells and Bond own their live grants and timers alongside the specialization's spirit lifecycle. */
export const ritualistSpellLiveMechanics: Partial<RuntimeProfession<NecromancerRuntimeState>> = {
  modifyEffects: (_runtime, cast, effects) => (SPELLS.has(Number(cast.skill.id)) ? [] : effects),
  onCastComplete(runtime, cast) {
    if (!SPELLS.has(Number(cast.skill.id)) || !castCompleted(cast)) return;
    const spell = SPELLS.get(Number(cast.skill.id));
    const effect = cast.skill.effects?.find((effect) => effect.type === 'buff');
    if (!spell || !effect) return;
    const state = ritualistState.from(runtime);
    const previous = state.weaponSpells[spell];
    if (previous) runtime.cancelOwner(owner(spell, previous.generation));
    const generation = ++state.weaponSpellGeneration;
    const expiresAt = canonicalTime(runtime.time + Number(effect.duration ?? 0));
    const fullBenefit = hasTrait(runtime, TRAIT.WIELDERS_BOON);
    const allyStacks = fullBenefit ? Number(effect.stacks ?? 0) : Number(effect.allyStacks ?? 0);
    const audience = gw2AlliedEffectRecipients(runtime.config, {
      ...effect.audience,
      recipients: 'party',
      eligibleCompanionIds: necromancerActiveMinionCompanionIds(runtime)
    });
    const recipients: Record<string, ChargeGrant> = { player: grantCharges(Number(effect.stacks ?? 0), expiresAt) };
    for (const key of [
      ...audience.companionIds,
      ...Array.from({ length: audience.alliedPlayerCount }, (_, index) => `ally:${index + 1}`)
    ])
      recipients[key] = grantCharges(allyStacks, expiresAt);
    state.weaponSpells[spell] = {
      generation,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      appliedAt: runtime.time,
      recipients,
      alliesReceiveFullBenefit: fullBenefit
    };
    runtime.emit({
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
    });
    runtime.schedule(EXPIRE, expiresAt, { spell, generation }, owner(spell, generation), -20);
    const rate = gw2AlliedPlayerAssumptions(runtime.config).strikesPerSecond;
    if (spell === 'resilient' || !rate) return;
    if (spell !== 'nightmare' && spell !== 'splinter') throw new Error(`Unknown weapon spell: ${spell}`);
    const profile = requireBalanceProfileFromContext(
      runtime,
      spell === 'nightmare' ? PROFILE.nightmareWeaponProc : PROFILE.splinterWeaponProc
    );
    if (
      !requireEffect(profile, 'strike', 'Strike') &&
      !(spell === 'nightmare' && requireEffect(profile, 'condition', 'Vulnerability'))
    )
      return;
    // Model actual strikes on the allied cadence; the shared charge owner alone decides whether its ICD allows a proc.
    const interval = 1 / rate;
    for (let allyIndex = 1; allyIndex <= audience.alliedPlayerCount; allyIndex++)
      scheduleAlly(runtime, { spell, generation, allyIndex, anchor: runtime.time, pulse: 1, interval });
  },
  eventHandlers: { 'necromancer.painful-bond': applyBond },
  reactions: { 'damage.resolved': ritualistResolverEventReactions.damage },
  tasks: {
    [EXPIRE](runtime, data) {
      const { spell, generation } = data as { spell: string; generation: number };
      const state = ritualistState.from(runtime);
      if (state.weaponSpells[spell]?.generation === generation) delete state.weaponSpells[spell];
    },
    [ALLY](runtime, data) {
      const work = data as AllyOpportunity;
      const active = ritualistState.from(runtime).weaponSpells[work.spell];
      if (active?.generation !== work.generation) return;
      // Opportunities are not damage events: only the resulting spell packets enter target resolution.
      if (runtime.combatActive && runtime.deathTime == null)
        triggerRitualistWeaponSpell(
          runtime,
          {
            type: 'proc',
            at: runtime.time,
            source: 'Weapon Spell',
            sourceId: active.skillId!,
            actorType: 'effect',
            skillId: active.skillId,
            skillName: active.skillName,
            metadata: { triggeredByAlly: work.allyIndex }
          },
          work.spell,
          [`ally:${work.allyIndex}`]
        );
      scheduleAlly(runtime, { ...work, pulse: work.pulse + 1 });
    },
    [BOND](runtime, data) {
      const state = ritualistState.from(runtime);
      if (runtime.time >= state.painfulBondUntil || runtime.deathTime != null) return;
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.painfulBond);
      const strike = requireEffect(profile, 'strike', 'Strike');
      if (strike)
        runtime.emit(
          buildResolverStrike({
            at: runtime.time,
            source: 'Spirit',
            sourceId: 'ritualist.painful-bond',
            // Bond retains the creating summon's artwork without borrowing its damage identity.
            icon: (data as Gw2ResolverEvent).icon,
            actorType: 'effect',
            skillName: 'Painful Bond',
            coefficient: 0,
            flatStrikeBase: effectNumber(profile, strike, 'flatStrikeBase'),
            flatStrikePowerCoeff: effectNumber(profile, strike, 'flatStrikePowerCoeff'),
            skillWeapon: 'Unequipped',
            noCrit: true,
            triggeredBy: (data as Gw2ResolverEvent).triggeredBy
          })
        );
      const at = canonicalTime(runtime.time + balanceProfileNumber(profile, 'pulseInterval'));
      if (strike && at > runtime.time && at < state.painfulBondUntil)
        runtime.schedule(BOND, at, data, { id: BOND, generation: state.painfulBondGeneration });
    },
    [BOND_END](runtime) {
      ritualistState.from(runtime).painfulBondUntil = 0;
    }
  }
};
