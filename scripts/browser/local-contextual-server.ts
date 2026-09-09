import { createApplicationServer } from '../../src/app/server.ts';
import { contextualFixture } from '../../tests/fixtures/contextual-provider.ts';
const app=createApplicationServer({agentProviders:{provider:contextualFixture}});
app.server.listen(3013,'127.0.0.1',()=>console.log('Local UI fixture server: http://127.0.0.1:3013. No live provider calls.'));
for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>void app.close());
