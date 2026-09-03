import type { SkillId } from '#gw2/platform/engine/types.js';

export interface NormalizedLoopAction {
  readonly sequenceIndex: number;
  readonly skillId: SkillId;
  readonly name: string;
  readonly icon: string;
  readonly activationId: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly rotationIndex: number | null;
  readonly weaponSet: number;
  readonly attunement: string;
  readonly weaponLine: string;
  readonly weaponLineDestination: string | null | undefined;
  readonly cancelled: boolean;
}

export interface LoopToken {
  readonly key: string;
  readonly kind: 'skill' | 'auto-chain';
  readonly name: string;
  readonly primarySkillId: SkillId;
  readonly skillIds: readonly SkillId[];
  readonly count: number;
  readonly actions: readonly NormalizedLoopAction[];
}

export interface SequenceAlignment {
  readonly matches: readonly (LoopToken | null)[];
  readonly insertions: readonly { readonly slot: number; readonly token: LoopToken }[];
}

export const skillKey = (skillId: SkillId): string => `skill:${String(skillId)}`;

export function matchingSkillId(left: SkillId, right: SkillId): boolean {
  return String(left) === String(right);
}

export function baseSkillToken(action: NormalizedLoopAction): LoopToken {
  return {
    key: skillKey(action.skillId),
    kind: 'skill',
    name: action.name,
    primarySkillId: action.skillId,
    skillIds: [action.skillId],
    count: 1,
    actions: [action]
  };
}

export function combineConsecutiveTokens(tokens: readonly LoopToken[]): LoopToken[] {
  const combined: LoopToken[] = [];
  for (const token of tokens) {
    const previous = combined.at(-1);
    if (previous?.key === token.key && previous.kind === token.kind) {
      combined[combined.length - 1] = {
        ...previous,
        count: previous.count + token.count,
        actions: [...previous.actions, ...token.actions]
      };
      continue;
    }

    combined.push(token);
  }

  return combined;
}

/**
 * Collapses complete autoattack chains without letting interleaved instant casts break the authored sequence.
 */
export function tokenizeActions(
  actions: readonly NormalizedLoopAction[],
  autoattackChains: ReadonlyMap<string, readonly SkillId[]>
): LoopToken[] {
  const autoattackRootBySkill = new Map<string, SkillId>();
  for (const chain of autoattackChains.values()) {
    for (const skillId of chain) autoattackRootBySkill.set(String(skillId), chain[0]);
  }

  const claimedChainIndexes = new Set<number>();
  const chainTokenByStart = new Map<number, LoopToken>();
  for (let start = 0; start < actions.length; start += 1) {
    if (claimedChainIndexes.has(start)) continue;
    const chain = autoattackChains.get(String(actions[start].skillId));
    if (!chain) continue;
    const matchedIndexes = [start];
    let cursor = start + 1;
    let complete = true;
    for (const expectedSkillId of chain.slice(1)) {
      let matchedIndex = -1;
      const scanEnd = Math.min(actions.length, cursor + 6);
      for (let candidateIndex = cursor; candidateIndex < scanEnd; candidateIndex += 1) {
        const candidate = actions[candidateIndex];
        if (matchingSkillId(candidate.skillId, expectedSkillId)) {
          matchedIndex = candidateIndex;
          break;
        }

        if (autoattackRootBySkill.get(String(candidate.skillId)) === chain[0]) break;
      }

      if (matchedIndex < 0 || actions[matchedIndex].startMs - actions[start].startMs > 5000) {
        complete = false;
        break;
      }

      matchedIndexes.push(matchedIndex);
      cursor = matchedIndex + 1;
    }

    if (!complete) continue;
    const chainActions = matchedIndexes.map((index) => actions[index]);
    for (const index of matchedIndexes) claimedChainIndexes.add(index);
    chainTokenByStart.set(start, {
      key: `auto-chain:${String(chain[0])}`,
      kind: 'auto-chain',
      name: 'Auto Attack Chain',
      primarySkillId: chain[0],
      skillIds: chain,
      count: 1,
      actions: chainActions
    });
  }

  const tokens: LoopToken[] = [];
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    const chainToken = chainTokenByStart.get(index);
    if (chainToken) {
      tokens.push(chainToken);
      continue;
    }

    if (claimedChainIndexes.has(index)) continue;
    const incompleteChainRoot = autoattackRootBySkill.get(String(action.skillId));
    if (incompleteChainRoot != null) {
      tokens.push({
        ...baseSkillToken(action),
        key: `auto-chain-fragment:${String(incompleteChainRoot)}`
      });
      continue;
    }

    tokens.push(baseSkillToken(action));
  }

  return combineConsecutiveTokens(tokens);
}

/** Computes key-based edit distance so loop comparisons ignore display metadata and timings. */
export function sequenceEditDistance(left: readonly LoopToken[], right: readonly LoopToken[]): number {
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_value, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = left[leftIndex - 1].key === right[rightIndex - 1].key ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitution
      );
    }

    previous = current;
  }

  return previous[right.length];
}

export function sequenceSimilarity(left: readonly LoopToken[], right: readonly LoopToken[]): number {
  const length = Math.max(left.length, right.length);
  return length ? 1 - sequenceEditDistance(left, right) / length : 1;
}

/** Aligns a candidate to a reference while retaining unmatched candidate tokens as ordered insertions. */
export function alignToReference(reference: readonly LoopToken[], candidate: readonly LoopToken[]): SequenceAlignment {
  const rows = reference.length + 1;
  const columns = candidate.length + 1;
  const distance = Array.from({ length: rows }, () => Array<number>(columns).fill(0));
  for (let row = 0; row < rows; row += 1) distance[row][0] = row;
  for (let column = 0; column < columns; column += 1) distance[0][column] = column;
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitution = reference[row - 1].key === candidate[column - 1].key ? 0 : 1;
      distance[row][column] = Math.min(
        distance[row - 1][column] + 1,
        distance[row][column - 1] + 1,
        distance[row - 1][column - 1] + substitution
      );
    }
  }

  const matches: (LoopToken | null)[] = Array(reference.length).fill(null);
  const insertions: { slot: number; token: LoopToken }[] = [];
  let row = reference.length;
  let column = candidate.length;
  while (row > 0 || column > 0) {
    if (
      row > 0 &&
      column > 0 &&
      reference[row - 1].key === candidate[column - 1].key &&
      distance[row][column] === distance[row - 1][column - 1]
    ) {
      matches[row - 1] = candidate[column - 1];
      row -= 1;
      column -= 1;
      continue;
    }

    if (row > 0 && distance[row][column] === distance[row - 1][column] + 1) {
      row -= 1;
      continue;
    }

    if (column > 0 && distance[row][column] === distance[row][column - 1] + 1) {
      insertions.push({ slot: row, token: candidate[column - 1] });
      column -= 1;
      continue;
    }

    if (row > 0 && column > 0) {
      insertions.push({ slot: row - 1, token: candidate[column - 1] });
      row -= 1;
      column -= 1;
      continue;
    }

    if (row > 0) row -= 1;
    else if (column > 0) {
      insertions.push({ slot: 0, token: candidate[column - 1] });
      column -= 1;
    }
  }

  return { matches, insertions: insertions.reverse() };
}
