import test from 'node:test';
import { scenarios,runScenario } from '../../scripts/workflow/scenarios.ts';
for(const name of Object.keys(scenarios))test('durable SC-01 '+name,async()=>{await runScenario(name);});
