import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { RotationActionStatus } from '#gw2/integrations/logs/lib/rotation/model.js';
import { isUncommittedCast } from '#gw2/integrations/logs/lib/rotation/timing.js';

export interface ChainAction {
  readonly start: number;
  readonly end: number;
  readonly eventIndex: number;
  readonly rawSkillId: number;
  readonly rawName: string;
  readonly status: RotationActionStatus;
  readonly canonicalSkillId?: number;
  readonly canonicalName?: string;
}

export interface AutoattackChainPolicy<Action extends ChainAction> {
  readonly skillFor: (action: Action) => Skill | null;
  readonly skillById: (skillId: number) => Skill | null;
  readonly resetsChain: (action: Action, skill: Skill | null) => boolean;
  readonly trustExplicitRootReset?: boolean;
}

/** Repairs incomplete weapon-1 chain signals while leaving source-specific reset evidence to the adapter. */
export function normalizeAutoattackChains<Action extends ChainAction>(
  actions: readonly Action[],
  policy: AutoattackChainPolicy<Action>
): Action[] {
  const sorted = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  let activeChainRoot: number | null = null;
  let expectedSkillId: number | null = null;
  const result: Action[] = [];

  for (const action of sorted) {
    const skill = policy.skillFor(action);
    const autoattack =
      String(skill?.slot || '')
        .trim()
        .toLowerCase() === 'weapon_1';
    if (autoattack && action.status === 'interrupted') continue;
    const chainRoot = Number(skill?.chainRoot);
    if (autoattack && Number.isFinite(chainRoot)) {
      const rawSkillId = Number(skill?.id);
      const continuesChain = activeChainRoot === chainRoot && expectedSkillId != null;
      const explicitRootReset = policy.trustExplicitRootReset === true && rawSkillId === chainRoot;
      const canonicalId: number = continuesChain && !explicitRootReset ? expectedSkillId! : chainRoot;
      const canonical = policy.skillById(canonicalId);
      result.push({
        ...action,
        canonicalSkillId: canonicalId,
        canonicalName: canonical?.name || action.canonicalName || action.rawName
      });
      // EI can label a pre-commit cancellation as a reduced cast; keep its input without advancing the chain.
      if (isUncommittedCast(canonical, action.end - action.start)) continue;
      activeChainRoot = chainRoot;
      const next = canonical?.nextChainId == null ? null : Number(canonical.nextChainId);
      expectedSkillId = next != null && Number.isFinite(next) ? next : chainRoot;
      continue;
    }

    if (policy.resetsChain(action, skill)) {
      activeChainRoot = null;
      expectedSkillId = null;
    }

    result.push(action);
  }

  return result;
}
