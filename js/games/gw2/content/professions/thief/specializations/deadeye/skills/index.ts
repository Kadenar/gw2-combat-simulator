import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const DEADEYE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.STEAL_WARMTH]: {
    // Custom: Gates stealth by Malice, shares boons, consumes the stored skill, and applies traits; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-stolen-skill',
    castTimeMs: 250,
    cooldown: 0.5,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.5 }],
        name: 'Steal Warmth',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 10,
        stacks: 1
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Chilled', stacks: 1, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.STEAL_RESISTANCE]: {
    // Custom: Gates stealth by Malice, shares boons, consumes the stored skill, and applies traits; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-stolen-skill',
    castTimeMs: 250,
    cooldown: 0.5,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.5 }],
        name: 'Steal Resistance',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 5,
        stacks: 1
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Torment', stacks: 3, duration: 8 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.STEAL_PRECISION]: {
    // Custom: Gates stealth by Malice, shares boons, consumes the stored skill, and applies traits; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-stolen-skill',
    castTimeMs: 250,
    cooldown: 0.5,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.5 }],
        name: 'Steal Precision',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 8,
        stacks: 1
      },
      {
        type: 'blind',
        actorType: 'player',
        duration: 6
      }
    ]
  },
  [ID.STEAL_HEALTH]: {
    // Custom: Gates stealth by Malice, shares boons, consumes the stored skill, and applies traits; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-stolen-skill',
    castTimeMs: 250,
    cooldown: 0.5,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.5 }],
        name: 'Steal Health',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Bleeding', stacks: 5, duration: 8 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.STEAL_STRENGTH]: {
    // Custom: Gates stealth by Malice, shares boons, consumes the stored skill, and applies traits; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-stolen-skill',
    castTimeMs: 250,
    cooldown: 0.5,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.5 }],
        name: 'Steal Strength',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 12,
        stacks: 5
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Weakness', stacks: 1, duration: 8 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SHADOW_FLARE]: {
    // Custom: Arms the temporary Shadow Swap follow-up; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-shadow-flare',
    quicknessCastTimeMs: 480,
    cooldown: 20,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        // Scale the observed cast-end hit from cast start so Quickness preserves packet alignment.
        ticks: [{ atMs: 480, coefficient: 1 }],
        name: 'Shadow Flare',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.BINDING_SHADOW]: {
    castTimeMs: 750,
    cooldown: 20,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1 }],
        name: 'Binding Shadow',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Immobilized', stacks: 1, duration: 2 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Poisoned', stacks: 2, duration: 10 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Vulnerability', stacks: 15, duration: 10 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.MERCY]: {
    // Custom: Consumes Malice, refunds initiative, and resets Deadeye's Mark; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-mercy',
    castTimeMs: 0,
    cooldown: 1,
    ammo: 2,
    ammoRecharge: 30,
    ammoCastLockout: 1,
    initiativeCost: 0,
    effects: []
  },
  [ID.STEAL_TIME]: {
    // Custom: Gates stealth by Malice, shares boons, consumes the stored skill, and applies traits; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-stolen-skill',
    quicknessCastTimeMs: 280,
    cooldown: 0.5,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1 }],
        name: 'Steal Time',
        actorType: 'player',
        weaponStrengthProfileId: 'nonweapon.profession-mechanic',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 5,
        stacks: 1
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Slow', stacks: 1, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.STEAL_DURABILITY]: {
    // Custom: Gates stealth by Malice, shares boons, consumes the stored skill, and applies traits; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-stolen-skill',
    castTimeMs: 250,
    cooldown: 0.5,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.5 }],
        name: 'Steal Durability',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 5,
        stacks: 1
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Vulnerability', stacks: 10, duration: 5 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.DEADEYES_MARK]: {
    stealTraitSkill: true,
    movementSkill: true,
    // Custom: Marks the target, initializes Malice/stolen skills, and schedules expiry; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeyes-mark',
    castTimeMs: 0,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
  },
  [ID.STEAL_DEFENSES]: {
    // Custom: Gates stealth by Malice, shares boons, consumes the stored skill, and applies traits; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-stolen-skill',
    castTimeMs: 250,
    cooldown: 0.5,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.5 }],
        name: 'Steal Defenses',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 5,
        stacks: 1
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Poisoned', stacks: 2, duration: 8 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.MALICIOUS_DEATHS_JUDGMENT]: {
    // Custom: Snapshots Malice, scales malicious packets, and consumes stealth; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-stealth-attack',
    quicknessCastTimeMs: 600,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.67 }],
        name: "Malicious Death's Judgment — Packet 1",
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Rifle',
    stealthAttack: true,
    malicious: true
  },
  [ID.STEAL_MOBILITY]: {
    // Custom: Gates stealth by Malice, shares boons, consumes the stored skill, and applies traits; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-stolen-skill',
    castTimeMs: 250,
    cooldown: 0.5,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.5 }],
        name: 'Steal Mobility',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Immobilized', stacks: 1, duration: 1.5 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.MALICIOUS_RESTORATION]: {
    castTimeMs: 0,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
  },
  [ID.SHADOW_MELD]: {
    // Custom: Clears Revealed at cast start so stealth can apply; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-shadow-meld',
    quicknessCastTimeMs: 440,
    cooldown: 5,
    ammo: 2,
    ammoRecharge: 25,
    ammoCastLockout: 5,
    initiativeCost: 0,
    effects: [
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.SHADOW_SWAP]: {
    // Custom: Consumes the Shadow Swap follow-up; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-shadow-swap',
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1 }],
        name: 'Shadow Swap',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SHADOW_GUST]: {
    castTimeMs: 500,
    cooldown: 30,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.4 }],
        name: 'Shadow Gust',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'knockback',
        duration: 450
      }
    ]
  },
  [ID.MALICIOUS_SURPRISE_SHOT]: {
    // Custom: Snapshots Malice, scales malicious packets, and consumes stealth; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-stealth-attack',
    castTimeMs: 250,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.6 }],
        name: 'Malicious Surprise Shot',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Bleeding', stacks: 3, duration: 5 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Immobilized', stacks: 1, duration: 2 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Shortbow',
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_SNEAK_ATTACK]: {
    // Custom: Snapshots Malice, scales malicious packets, and consumes stealth; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-stealth-attack',
    castTimeMs: 1000,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 136 + index * 136, coefficient: 1.8 / 5 })),
        name: 'Malicious Sneak Attack',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Bleeding', stacks: 5, duration: 5 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Torment', stacks: 1, duration: 1 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Pistol',
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_BACKSTAB]: {
    // Custom: Snapshots Malice, scales malicious packets, and consumes stealth; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-stealth-attack',
    quicknessCastTimeMs: 440,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.5 }],
        name: 'Front damage',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Dagger',
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_TACTICAL_STRIKE]: {
    // Custom: Snapshots Malice, scales malicious packets, and consumes stealth; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-stealth-attack',
    quicknessCastTimeMs: 440,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2 }],
        name: 'Malicious Tactical Strike',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'daze',
        duration: 1
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'daze',
        duration: 3
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Vulnerability', stacks: 10, duration: 5 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Sword',
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_SHADOWSQUALL]: {
    // Custom: Snapshots Malice, scales malicious packets, and consumes stealth; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-stealth-attack',
    castTimeMs: 2500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 8 }, (_, index) => ({ atMs: 210.336 + index * 210.336, coefficient: 1.6 / 8 })),
        name: 'Malicious Shadowsquall',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Poisoned', stacks: 1, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'Regeneration',
        duration: 2.5,
        stacks: 1
      }
    ],
    requiredMainHand: 'Scepter',
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_HOOK_STRIKE]: {
    // Custom: Snapshots Malice, scales malicious packets, and consumes stealth; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-stealth-attack',
    castTimeMs: 0,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.65 }],
        name: 'Malicious Hook Strike',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 0.75,
        stacks: 1
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'knockdown',
        duration: 4
      }
    ],
    requiredMainHand: 'Staff',
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_CUNNING_SALVO]: {
    // Custom: Snapshots Malice, scales malicious packets, and consumes stealth; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-stealth-attack',
    castTimeMs: 500,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.5 }],
        name: 'Malicious Cunning Salvo',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Bleeding', stacks: 1, duration: 8 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Poisoned', stacks: 1, duration: 1 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Crippled', stacks: 1, duration: 4 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Axe',
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_ASHEN_ASSAULT]: {
    preservesStealth: true,
    spearStealthAttack: true,
    // Custom: Snapshots Malice, scales the final hit/Torment, refunds initiative, and consumes stealth; see `deadeye/execution/index.ts`.
    handlerId: 'thief.deadeye-spear-stealth-attack',
    castTimeMs: 575,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: 173.913043478261 + index * 173.913043478261,
          coefficient: 1.5 / 5
        })),
        name: 'Malicious Ashen Assault',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.3 }],
        name: 'Malicious Ashen Assault — Final Strike',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Vulnerability', stacks: 5, duration: 8 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Bleeding', stacks: 3, duration: 4 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Poisoned', stacks: 3, duration: 4 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Spear',
    stealthAttack: true,
    malicious: true
  }
});
