export const EVTC_FIXTURE_PLAYER = 0x1000n;

/** Builds a complete raw EVTC event while keeping each test focused on meaningful fields. */
export function event(overrides = {}) {
  return {
    time: 1_000,
    source: EVTC_FIXTURE_PLAYER,
    target: 0n,
    value: 0,
    buffDamage: 0,
    overstackValue: 0,
    skillId: 0,
    sourceInstance: 1,
    targetInstance: 0,
    sourceMasterInstance: 0,
    targetMasterInstance: 0,
    iff: 0,
    buff: 0,
    result: 0,
    activation: 0,
    buffRemove: 0,
    ninety: 0,
    fifty: 0,
    moving: 0,
    stateChange: 0,
    flanking: 0,
    shields: 0,
    offcycle: 0,
    pad: 0,
    ...overrides
  };
}

/** Builds the shared parsed-log fixture used by cross-profession reconstruction tests. */
export function log(overrides = {}) {
  return {
    header: {
      magic: 'EVTC',
      arcdpsBuild: '20260815',
      revision: 1,
      encounterId: 16199,
      agentCount: 1,
      skillCount: 4,
      eventCount: 0
    },
    agents: [
      {
        address: EVTC_FIXTURE_PLAYER,
        profession: 7,
        elite: 40,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Fixture Chronomancer',
        account: ':Fixture.1234',
        subgroup: '1'
      }
    ],
    skills: [
      { id: 1_000, name: 'Mind Stab' },
      { id: 2_000, name: 'Time Sink' },
      { id: 3_000, name: 'Blink' },
      { id: 65_001, name: 'Dodge' }
    ],
    events: [],
    ...overrides
  };
}

/** Encodes the smallest binary EVTC fixture needed by parser and importer tests. */
export function expandedEvtcFixture({
  interruptedDamage = false,
  secondActivation = false,
  skillName = 'Mind Stab'
} = {}) {
  const header = Buffer.alloc(16);

  header.write('EVTC20260815', 0, 'ascii');
  header[12] = 1;
  header.writeUInt16LE(16_199, 13);
  const agentCount = Buffer.alloc(4);

  agentCount.writeUInt32LE(1);
  const agent = Buffer.alloc(96);

  agent.writeBigUInt64LE(EVTC_FIXTURE_PLAYER, 0);
  agent.writeUInt32LE(7, 8);
  agent.writeUInt32LE(40, 12);
  Buffer.from(['Fixture Chronomancer', ':Fixture.1234', '1', ''].join('\0'), 'utf8').copy(agent, 28);
  const skillCount = Buffer.alloc(4);

  skillCount.writeUInt32LE(1);
  const skill = Buffer.alloc(68);

  skill.writeUInt32LE(1_000, 0);
  skill.write(skillName, 4, 'utf8');
  const activation = Buffer.alloc(64);

  activation.writeBigUInt64LE(1_000n, 0);
  activation.writeBigUInt64LE(EVTC_FIXTURE_PLAYER, 8);
  activation.writeInt32LE(800, 24);
  activation.writeUInt32LE(1_000, 36);
  activation.writeUInt16LE(1, 40);
  activation[56] = 67;

  const laterActivation = Buffer.from(activation);

  laterActivation.writeBigUInt64LE(3_000n, 0);

  if (!interruptedDamage) {
    return Buffer.concat([
      header,
      agentCount,
      agent,
      skillCount,
      skill,
      activation,
      ...(secondActivation ? [laterActivation] : [])
    ]);
  }

  const animationStop = Buffer.alloc(64);

  animationStop.writeBigUInt64LE(1_000n, 0);
  animationStop.writeBigUInt64LE(EVTC_FIXTURE_PLAYER, 8);
  animationStop.writeUInt32LE(1_000, 36);
  animationStop.writeUInt16LE(1, 40);
  animationStop[51] = 4;
  animationStop[56] = 68;
  const damage = Buffer.alloc(64);

  damage.writeBigUInt64LE(1_350n, 0);
  damage.writeBigUInt64LE(EVTC_FIXTURE_PLAYER, 8);
  damage.writeBigUInt64LE(0x2000n, 16);
  damage.writeInt32LE(100, 24);
  damage.writeUInt32LE(1_000, 36);
  damage.writeUInt16LE(1, 40);

  return Buffer.concat([header, agentCount, agent, skillCount, skill, activation, animationStop, damage]);
}
