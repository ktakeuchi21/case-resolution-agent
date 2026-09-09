import test from 'node:test';
import assert from 'node:assert/strict';
import { configuredPublicOrigin, configuredFrontendOrigin } from '../src/app/origin.ts';

test('production requires an exact trusted origin and redacts invalid inputs', () => {
  assert.throws(() => configuredPublicOrigin({NODE_ENV:'production'}), /PUBLIC_ORIGIN_REQUIRED/);
  for (const raw of ['not a URL','https://example.com/','http://example.com','https://example.com/#fragment','https://user:synthetic@example.com']) {
    assert.throws(() => configuredPublicOrigin({NODE_ENV:'production',PUBLIC_ORIGIN:raw}), {message:'PUBLIC_ORIGIN_INVALID'});
  }
  assert.equal(configuredPublicOrigin({PUBLIC_ORIGIN:'http://127.0.0.1:3001',NODE_ENV:'production'}),'http://127.0.0.1:3001');
});
test('Render origin is used only under the provider flag and must be its exact HTTPS origin', () => {
  const env={NODE_ENV:'production',RENDER:'true',RENDER_EXTERNAL_URL:'https://synthetic.onrender.com'};
  assert.equal(configuredPublicOrigin(env),env.RENDER_EXTERNAL_URL);
  assert.throws(() => configuredPublicOrigin({...env,RENDER:'false'}),/PUBLIC_ORIGIN_REQUIRED/);
  for (const url of ['http://synthetic.onrender.com','https://onrender.com.attacker.invalid','https://synthetic.onrender.com/']) {
    assert.throws(() => configuredPublicOrigin({...env,RENDER_EXTERNAL_URL:url}),/PUBLIC_ORIGIN_INVALID/);
  }
  assert.equal(configuredPublicOrigin({...env,PUBLIC_ORIGIN:'https://portfolio.example.com'}),'https://portfolio.example.com');
});
test('local development retains an unconfigured loopback server path', () => {
  assert.equal(configuredPublicOrigin({}),undefined);
});
test('optional frontend origin is exact and never a wildcard or credential-bearing URL',()=>{
  assert.equal(configuredFrontendOrigin({}),undefined);
  assert.equal(configuredFrontendOrigin({FRONTEND_ORIGIN:'https://frontend.onrender.com'}),'https://frontend.onrender.com');
  for(const raw of ['*','https://frontend.onrender.com/','https://frontend.onrender.com/path','http://frontend.onrender.com','https://user:secret@frontend.onrender.com','https://one.example,https://two.example'])assert.throws(()=>configuredFrontendOrigin({FRONTEND_ORIGIN:raw}),{message:'FRONTEND_ORIGIN_INVALID'});
});
