export function deadeyeCastAvailability(context, skill) {
  if (!skill.stealthAttack) return { ready: true };
  if (skill.malicious) return { ready: true };
  return {
    ready: false,
    retryAt: null,
    code: "thief.malicious-replacement",
    reason:
      `${skill.name} is unavailable — the malicious version replaces it.`,
  };
}
