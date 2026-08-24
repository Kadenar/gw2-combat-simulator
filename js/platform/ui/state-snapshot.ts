import type { Gw2ResolverEvent } from '../gw2/types.js';

function percent(value: number, signed = false): string {
  const numeric = Number(value || 0) * 100;
  const rounded = numeric
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
  return `${signed && numeric > 0 ? '+' : ''}${rounded}%`;
}

/** Formats critical-chance contributors and cap behavior for snapshot hover text. */
export function criticalChanceTooltip(event: Gw2ResolverEvent, heading: string): string {
  const lines = [heading];
  for (const [index, contributor] of (event.criticalChanceContributors || []).entries()) {
    lines.push(`${contributor.label}: ${percent(contributor.amount, index > 0)}`);
  }

  const finalChance = Number(event.criticalChance || 0);
  const beforeCap = Number(event.criticalChanceBeforeCap ?? finalChance);
  if (Math.abs(beforeCap - finalChance) > 1e-12) {
    lines.push(`Before cap: ${percent(beforeCap)}`);
  }

  lines.push(`Final: ${percent(finalChance)}`);
  return lines.join('\n');
}
