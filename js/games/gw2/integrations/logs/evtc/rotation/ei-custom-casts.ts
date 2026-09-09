import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import { effectEvidence, isBuffApply, isBuffRemoveAll } from '#gw2/integrations/logs/evtc/rotation/ei-inference.js';
import { usesModernAnimations } from '#gw2/integrations/logs/evtc/recording.js';
import { legacyActivationActions, modernAnimationActions } from '#gw2/integrations/logs/evtc/rotation/animations.js';

const BUFF_RULES: readonly {
  profession: string;
  specialization: string | null;
  skillId: number;
  buffId: number;
  offset?: number;
  duration?: number;
}[] = [
  { profession: 'guardian', specialization: 'willbender', skillId: 62603, buffId: 62632, offset: 440, duration: 500 },
  { profession: 'necromancer', specialization: null, skillId: 71799, buffId: 71947, offset: 750, duration: 750 },
  { profession: 'ranger', specialization: null, skillId: 31535, buffId: 31584 },
  { profession: 'elementalist', specialization: null, skillId: 5529, buffId: 5588 },
  { profession: 'engineer', specialization: null, skillId: 73122, buffId: 73090 }
];
const EFFECT_RULES = [
  { profession: 'elementalist', skillId: 5687, guid: '0FA8EF1CE419504A9D03004D6CF5F073', duration: 1000 },
  { profession: 'revenant', skillId: 72938, guid: '25908EB455863D43AE70FB3F4A22D6E4', duration: 3000 }
];

/** EI EICastParse calls ProfHelper's custom animated finders independently of ordinary buff-gain finders. */
export function eiCustomAnimatedActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const { log, profile, playerAddress } = context;
  const result: EvtcRecordedRotationAction[] = [];
  const names = new Map(log.skills.map((s) => [s.id, s.name]));
  const candidateSkills = new Set(
    [...BUFF_RULES, ...EFFECT_RULES]
      .filter((rule) => rule.profession === profile.professionId)
      .map((rule) => rule.skillId)
  );
  if (!candidateSkills.size) return result;
  // Only actors carrying a relevant skill can suppress a custom cast; avoid decoding every ambient NPC.
  const candidateActors = new Set(
    log.events.filter((event) => candidateSkills.has(event.skillId)).map((event) => event.source)
  );
  // EI suppresses these custom rules when an animation exists for this skill on any actor.
  const decode = usesModernAnimations(log) ? modernAnimationActions : legacyActivationActions;
  const recordedSkills = new Set(
    log.agents
      .filter((agent) => candidateActors.has(agent.address))
      .flatMap((agent) => decode(log, agent.address, names).map((action) => action.rawSkillId))
  );
  const recorded = (id: number): boolean => recordedSkills.has(id);
  const append = (
    skillId: number,
    start: number,
    duration: number,
    eventIndex: number,
    rule: string,
    metadataAccurate = true
  ): void => {
    result.push({
      start,
      end: start + duration,
      expectedDuration: duration,
      rawSkillId: skillId,
      rawName: names.get(skillId) ?? 'Unknown ' + skillId,
      evidence: 'effect',
      status: 'completed',
      eventIndex,
      eiRule: rule,
      castOrigin: 'skill',
      metadataAccurate
    });
  };

  for (const rule of BUFF_RULES) {
    if (
      rule.profession !== profile.professionId ||
      (rule.specialization && rule.specialization !== profile.specializationId) ||
      recorded(rule.skillId)
    )
      continue;
    if (rule.skillId === 71799 && Number(log.events.find((e) => e.stateChange === 15)?.source ?? 0n) >= 159951)
      continue;
    const applies = log.events
      .map((event, eventIndex) => ({ event, eventIndex }))
      .filter(
        ({ event }) => event.skillId === rule.buffId && event.target === playerAddress && isBuffApply(log, event, true)
      );
    const removals = log.events.filter(
      (e) => e.skillId === rule.buffId && e.source === playerAddress && isBuffRemoveAll(log, e)
    );
    if (rule.duration != null)
      for (const { event, eventIndex } of applies)
        append(
          rule.skillId,
          event.time - (rule.offset ?? 0),
          rule.duration,
          eventIndex,
          'ProfHelper.ComputeEndWithBuffApplyCastEvents'
        );
    else
      for (let i = 0; i < Math.min(applies.length, removals.length); i++)
        append(
          rule.skillId,
          applies[i].event.time,
          removals[i].time - applies[i].event.time,
          applies[i].eventIndex,
          'ProfHelper.ComputeUnderBuffCastEvents'
        );
  }

  const effects = effectEvidence(log);
  for (const rule of EFFECT_RULES) {
    if (rule.profession !== profile.professionId || recorded(rule.skillId)) continue;
    const signals = effects.filter((e) => e.guid === rule.guid && e.event.source === playerAddress);
    for (const signal of signals) {
      if (
        rule.skillId === 72938 &&
        signals.some((other) => other.event.time < signal.event.time && signal.event.time - other.event.time < 300)
      )
        continue;
      append(
        rule.skillId,
        signal.event.time,
        rule.duration,
        signal.eventIndex,
        'ProfHelper.ComputeEffectCastEvents',
        false
      );
    }
  }

  return result;
}
