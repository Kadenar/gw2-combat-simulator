export function emitGuardianEvent(context, skill, type, event = {}) {
  context.emit({
    type,
    at: context.effectiveEnd,
    source: "guardian",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    ...event,
  });
}

export function handleScheduledStateEvent() {
  // The scheduler applies these state transitions. Resolver registrations keep
  // the corresponding timeline events explicit and validated.
}
