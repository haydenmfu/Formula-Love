import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
test('server starts outside project directory and serves only app files',async()=>{
  const script=fileURLToPath(new URL('../server.mjs',import.meta.url));
  const child=spawn(process.execPath,[script],{cwd:tmpdir(),env:{...process.env,PORT:'0',CUPID_DB:':memory:'},stdio:['ignore','pipe','pipe']});
  try{
    const url=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Startup timeout')),5000);child.stdout.on('data',c=>{output+=c;const match=output.match(/http:\/\/127\.0\.0\.1:\d+\//);if(match){clearTimeout(timer);resolve(match[0]);}});child.on('error',reject);});
    assert.match(await (await fetch(url).catch(error=>{throw error.cause||error;})).text(),/Cupid/);
    assert.match((await fetch(url+'editor.js')).headers.get('content-type'),/javascript/);
    assert.equal((await fetch(url+'README.md')).status,404);
    assert.equal((await fetch(url,{method:'POST'})).status,405);
    assert.equal((await fetch(url,{method:'HEAD'})).status,200);
    assert.equal((await fetch(url+'api/me')).status,401);
    const registered=await fetch(url+'api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'http_test',password:'test-password-long'})});
    assert.equal(registered.status,200);const session=await registered.json();
    const headers={Authorization:'Bearer '+session.token,'Content-Type':'application/json'};
    assert.equal((await fetch(url+'api/me',{headers})).status,200);
    assert.equal((await fetch(url+'api/profile',{method:'PUT',headers:{...headers,Origin:'https://unrelated.example'},body:'{}'})).status,403);
    assert.deepEqual(await (await fetch(url+'api/matches',{headers})).json(),[]);
    await fetch(url+'api/logout',{method:'POST',headers,body:'{}'});
    assert.equal((await fetch(url+'api/me',{headers})).status,401);
    const conflict=spawn(process.execPath,[script],{env:{...process.env,PORT:new URL(url).port},stdio:['ignore','ignore','pipe']});
    let error='';conflict.stderr.on('data',c=>error+=c);const [code]=await once(conflict,'exit');assert.equal(code,1);assert.match(error,/already in use/);
  }finally{const exited=once(child,'exit');child.kill();await exited;}
});
