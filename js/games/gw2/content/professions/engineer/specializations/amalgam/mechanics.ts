export interface AmalgamNewGenesBoon {
  readonly kind: string;
  readonly duration: number;
  readonly stacks?: number;
}

// Per-morph extra boon granted by the New Genes trait, on top of its universal
// alacrity (5s) + 4 might (12s) that every morph cast receives.
export const AMALGAM_NEW_GENES_BOONS: Readonly<Record<string, AmalgamNewGenesBoon>> = Object.freeze({
  'Defensive Protocol: Cleanse': {
    kind: 'aegis',
    duration: 4,
    stacks: 1
  },
  'Defensive Protocol: Protect': {
    kind: 'protection',
    duration: 4,
    stacks: 1
  },
  'Defensive Protocol: Thorns': {
    kind: 'stability',
    duration: 4,
    stacks: 2
  },
  'Offensive Protocol: Demolish': {
    kind: 'swiftness',
    duration: 6,
    stacks: 1
  },
  'Offensive Protocol: Obliterate': {
    kind: 'might',
    duration: 12,
    stacks: 5
  },
  'Offensive Protocol: Pierce': {
    kind: 'vigor',
    duration: 4,
    stacks: 1
  },
  'Offensive Protocol: Shred': {
    kind: 'fury',
    duration: 6,
    stacks: 1
  }
});
