import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { SIGIL_DATA, SIGIL_NAMES, SIGIL_PROCS } from '../../../js/platform/gw2/gear-data.js';

const EXPECTED_SIGIL_ICONS = {
  Accuracy: 'https://render.guildwars2.com/file/4B0EFF29FD064E5E93E4F8616BE309A451450AED/220661.png',
  Agony: 'https://render.guildwars2.com/file/BAF34EB051D118F8A7C1645E0D940ED0660E6269/220658.png',
  Air: 'https://render.guildwars2.com/file/C337CC61DF2F5EE44B7D053EFF33059111024444/220676.png',
  Blight: 'https://render.guildwars2.com/file/AE0A1C7816B56296FEA527E1D01376491374195A/941026.png',
  Bursting: 'https://render.guildwars2.com/file/7ABFCEDF80329157F734FD56B293765D9B940FAD/619703.png',
  Concentration: 'https://render.guildwars2.com/file/C501D2CCF95A7B59F15EEDEF9C7D42C2DECE48E7/1201533.png',
  Demons: 'https://render.guildwars2.com/file/52D5D9FE5E0B9091415092A9E21DE830010D2E0E/220674.png',
  Doom: 'https://render.guildwars2.com/file/6CE4D1D6E5392C4CC8BACA595E3393EBF208BEED/220686.png',
  Earth: 'https://render.guildwars2.com/file/251EE3B8B5ADB8D7F7A35DBAEFABA35AEACDF51B/220677.png',
  Energy: 'https://render.guildwars2.com/file/3A064B97AB7D0E1F1250EFB5F06798A8FE623708/220688.png',
  Force: 'https://render.guildwars2.com/file/D7420E430D002E07382035EF0D0F77370C4EE6B8/220662.png',
  Geomancy: 'https://render.guildwars2.com/file/B79B430645DDF54E6792909A52F5CA40A4911407/220687.png',
  Hydromancy: 'https://render.guildwars2.com/file/B5F3E2021863079919299707290698504B5C7E90/220689.png',
  Ice: 'https://render.guildwars2.com/file/10E0D93F4B303CD03F6FEE0C5AAEEB070E0EFAC1/220680.png',
  Impact: 'https://render.guildwars2.com/file/D9ACA0C94D90A76B1C500D5DE6D62B6820FEDAE2/221170.png',
  Malice: 'https://render.guildwars2.com/file/797D052CB4EA63A61A3225962128D197ACB3ED17/619709.png',
  Night: 'https://render.guildwars2.com/file/CFDC642093029E790C03381D73C703BDFFA9CDFF/499391.png',
  Severance: 'https://render.guildwars2.com/file/396D7A5DBFA03BC49C12DAB532C4E34D342F0B51/1766396.png',
  Smoldering: 'https://render.guildwars2.com/file/60AAB7109E5D679901E00DC066774EE5FB3E6052/220659.png',
  Torment: 'https://render.guildwars2.com/file/E42EB6198022E5B4D71C5EE41465DD4EB84A0465/665778.png',
  Venom: 'https://render.guildwars2.com/file/080B4F940A05E60A084AA4B1D230F923A1A47CEC/220664.png'
};

test('all selectable sigils use their official render icons', () => {
  assert.deepEqual(SIGIL_NAMES, Object.keys(EXPECTED_SIGIL_ICONS).sort());
  for (const name of SIGIL_NAMES) {
    assert.equal(SIGIL_DATA[name].icon, EXPECTED_SIGIL_ICONS[name], name);
  }
});

test('all proc sigils inherit their canonical sigil icon', () => {
  for (const [name, proc] of Object.entries(SIGIL_PROCS)) {
    assert.equal(proc.icon, SIGIL_DATA[name].icon, name);
  }
});

test('Sigil of Earth procs use the Superior Sigil of Earth icon', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['Bladecall'],
    defaultSimulationConfig({
      stats: {
        ...defaults.stats,
        precision: 3100
      },
      boons: {
        ...defaults.boons,
        fury: true
      },
      sigilSets: [
        { names: ['Earth'], strike: 1, condition: 1 },
        { names: [], strike: 1, condition: 1 }
      ]
    })
  );
  const proc = result.procSteps.find((step) => step.skill === 'Sigil of Earth');

  assert.equal(proc?.icon, 'https://render.guildwars2.com/file/251EE3B8B5ADB8D7F7A35DBAEFABA35AEACDF51B/220677.png');
});
