import { runCoreFixtures } from './fixture-harness-core.js';

const output = document.getElementById('fixture-output');
try {
    const result = runCoreFixtures();
    output.textContent = JSON.stringify({
        power: result.attributes.attributes.Power.final,
        cooldownSteps: result.cooldown.steps,
        concurrentSteps: result.concurrent.steps,
    }, null, 2);
    output.dataset.status = 'passed';
} catch (error) {
    output.textContent = error.stack;
    output.dataset.status = 'failed';
}
