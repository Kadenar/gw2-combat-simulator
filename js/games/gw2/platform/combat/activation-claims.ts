export type ActivationClaims = Record<string, true>;

/**
 * Claims one reaction per scope and activation before rewards can reenter it.
 * Each state owner retains claims for the run so delayed impacts stay deduplicated.
 */
export function claimActivation(claims: ActivationClaims, scope: string, activationId: string): boolean {
  // Tuple encoding keeps scopes and IDs distinct even when they contain separators.
  const key = JSON.stringify([scope, activationId]);
  if (Object.hasOwn(claims, key)) return false;
  claims[key] = true;
  return true;
}
