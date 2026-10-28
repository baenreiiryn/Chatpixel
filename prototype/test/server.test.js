import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
test('HTTP, proteção de origem, autenticação e início OAuth PKCE',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'chatpixel-test-'));const port=43219,base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),CHATPIXEL_CONFIG_DIR:dir},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',c=>reject(Error(`Servidor saiu: ${c}`)));});
  const html=await fetch(base);assert.equal(html.status,200);assert.match(await html.text(),/width="1280" height="720"/);
  assert.deepEqual(await(await fetch(base+'/api/session')).json(),{connected:false,planEnabled:false});
  assert.equal((await fetch(base+'/api/interpret',{method:'POST',headers:{Origin:'https://evil.example'}})).status,403);
  assert.equal((await fetch(base+'/api/interpret',{method:'POST',headers:{Origin:base}})).status,401);
  assert.equal((await fetch(base+'/server.mjs')).status,404);
  const login=await fetch(base+'/auth/login',{redirect:'manual'});assert.equal(login.status,302);
  const u=new URL(login.headers.get('location'));assert.equal(u.origin,'https://auth.openai.com');assert.equal(u.searchParams.get('client_id'),'dynamic_agent_client');assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.equal(u.searchParams.get('redirect_uri'),base+'/auth/callback');assert.ok(u.searchParams.get('nonce'));assert.ok(u.searchParams.get('state'));assert.match(u.searchParams.get('ext_agent_host_id'),/^urn:uuid:/);
  assert.equal((await fetch(base+'/auth/callback?state=fake&code=fake')).status,400);
 }finally{child.kill();await new Promise(resolve=>child.once('close',resolve));await rm(dir,{recursive:true,force:true});}
});
