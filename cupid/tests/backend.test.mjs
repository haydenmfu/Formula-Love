import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore} from '../backend/store.mjs';
const tree={start:'q',nodes:[{id:'q',type:'boolean',key:'kind',label:'Are you kind?',x:0,y:0,yes:'yes',no:'no'},{id:'yes',type:'terminal',label:'Compatible',outcome:'match',x:0,y:100},{id:'no',type:'terminal',label:'Reject',outcome:'reject',x:100,y:100}]};
test('SQL accounts create reciprocal matches, isolate answers, revoke and persist',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cupid-')),path=join(dir,'test.sqlite');let s=createStore(path);
 try{
 const a=s.register({username:'alice',password:'password-for-test'}),b=s.register({username:'bobby',password:'another-password'});
 assert.equal(s.authenticate(a.token),a.id);assert.throws(()=>s.login({username:'alice',password:'wrong'}));
 s.saveProfile(b.id,{privateHobbies:'secret hobby',name:'Bob'});
 s.saveTree(a.id,structuredClone(tree));s.saveTree(b.id,structuredClone(tree));
 const qa=s.questions(a.id)[0],qb=s.questions(b.id)[0];assert.equal(JSON.stringify(qa).includes(b.id),false);
 assert.throws(()=>s.answer(b.id,qa.token,true));assert.throws(()=>s.answer(a.id,qa.token,'true'));
 s.answer(a.id,qa.token,true);assert.equal(s.matches(a.id).length,0);s.answer(b.id,qb.token,true);
 assert.equal(s.matches(a.id).length,1);assert.equal(s.matches(b.id).length,1);assert.equal(JSON.stringify(s.matches(a.id)).includes('secret hobby'),false);
 s.close();s=createStore(path);assert.equal(s.matches(a.id).length,1);
 const changed=structuredClone(tree);changed.nodes[0].label='Changed meaning?';s.saveTree(a.id,changed);assert.equal(s.matches(a.id).length,0);assert.equal(s.questions(b.id).length,1);
 s.logout(a.token);assert.equal(s.authenticate(a.token),undefined);
 }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
test('accounts get a password identity, a public profile and progress on paths',()=>{
 const s=createStore(':memory:');
 try{
 const a=s.register({username:'carol',password:'password-for-test'}),b=s.register({username:'dave_1',password:'another-password'});
 assert.deepEqual(s.me(a.id).identities,['password']);
 assert.equal(s.db.prepare('SELECT user_id FROM identities WHERE provider=? AND subject=?').get('password','carol').user_id,a.id);
 assert.throws(()=>s.saveProfile(a.id,{avatar:'dragon'}));s.saveProfile(a.id,{avatar:'fox',privateHobbies:'hidden thing',bio:'match-only bio'});
 assert.deepEqual(s.paths(b.id),[]);s.saveTree(a.id,structuredClone(tree));
 assert.deepEqual(s.paths(b.id),[{owner:{id:a.id,username:'carol',avatar:'fox'},passed:0,total:1,status:'pending',reviewing:false}]);assert.equal(JSON.stringify(s.paths(b.id)).includes('Are you kind'),false);assert.deepEqual(s.visitors(a.id),[]);
 assert.equal(s.questions(b.id,'someone-else').length,0);s.answer(b.id,s.questions(b.id,a.id)[0].token,true);
 assert.deepEqual(s.paths(b.id)[0],{owner:{id:a.id,username:'carol',avatar:'fox'},passed:1,total:1,status:'match',reviewing:false});
 assert.deepEqual(s.visitors(a.id),[{visitor:{id:b.id,username:'dave_1',avatar:null},passed:1,total:1,status:'match',reviewing:false}]);
 }finally{s.close();}
});
test('number questions accept typed decimals within limits and enforce whole numbers when asked',()=>{
 const s=createStore(':memory:');
 try{
 const a=s.register({username:'erin',password:'password-for-test'}),b=s.register({username:'finn',password:'another-password'});
 const hours={start:'h',nodes:[{id:'h',type:'scale',key:'hours',label:'How many hours a day do you work out?',min:0,max:24,ranges:[{from:null,to:'no'},{from:1,to:'yes'}],x:0,y:0},{id:'yes',type:'terminal',label:'Compatible',outcome:'match',x:300,y:0},{id:'no',type:'terminal',label:'Reject',outcome:'reject',x:300,y:120}]};
 s.saveTree(a.id,structuredClone(hours));let q=s.questions(b.id)[0];assert.deepEqual([q.type,q.min,q.max,q.integer],['scale',0,24,false]);
 for(const bad of [25,-1,'2',Infinity])assert.throws(()=>s.answer(b.id,q.token,bad));
 s.answer(b.id,q.token,1.5);assert.equal(s.paths(b.id)[0].status,'match');
 const whole=structuredClone(hours);whole.nodes[0].integer=true;s.saveTree(a.id,whole);q=s.questions(b.id)[0];assert.equal(q.integer,true);
 assert.throws(()=>s.answer(b.id,q.token,1.5));s.answer(b.id,q.token,2);
 }finally{s.close();}
});
test('open-ended responses wait for review, then route by the owner decision; blocks hide people',()=>{
 const s=createStore(':memory:');
 try{
 const a=s.register({username:'gwen',password:'password-for-test'}),b=s.register({username:'hugo',password:'another-password'}),c=s.register({username:'ivy',password:'third-password'});
 const prompt={start:'q',nodes:[{id:'q',type:'text',key:'restaurant',label:'The order is wrong. What do you do?',x:0,y:0,yes:'yes',no:'no'},{id:'yes',type:'terminal',label:'Compatible',outcome:'match',x:300,y:0},{id:'no',type:'terminal',label:'Reject',outcome:'reject',x:300,y:120}]};
 s.saveTree(a.id,structuredClone(prompt));
 let q=s.questions(b.id)[0];assert.deepEqual([q.type,q.label],['text','The order is wrong. What do you do?']);
 for(const bad of ['', '   ', 'x'.repeat(1001), 42])assert.throws(()=>s.answer(b.id,q.token,bad));
 s.answer(b.id,q.token,'  Politely ask for a fix.  ');
 assert.equal(s.questions(b.id).length,0);assert.equal(s.me(a.id).reviewCount,1);
 const [sent]=s.sentResponses(b.id);assert.deepEqual([sent.status,sent.owner.username,sent.text],['pending','gwen','Politely ask for a fix.']);
 const [item]=s.inbox(a.id);assert.deepEqual([item.from.username,item.prompt,item.text],['hugo','The order is wrong. What do you do?','Politely ask for a fix.']);
 assert.throws(()=>s.decide(b.id,item.id,true));assert.throws(()=>s.decide(a.id,item.id,'yes'));
 s.decide(a.id,item.id,true);assert.equal(s.sentResponses(b.id)[0].status,'approved');assert.equal(s.inbox(a.id).length,0);assert.equal(s.paths(b.id)[0].status,'match');
 q=s.questions(c.id)[0];s.answer(c.id,q.token,'Leave without paying.');s.decide(a.id,s.inbox(a.id)[0].id,false);
 assert.equal(s.sentResponses(c.id)[0].status,'rejected');assert.equal(s.questions(c.id).length,0);assert.equal(s.paths(c.id)[0].status,'reject');assert.equal(s.matches(c.id).length,0);
 const reworded=structuredClone(prompt);reworded.nodes[0].label='The order is late. What do you do?';s.saveTree(a.id,reworded);assert.equal(s.questions(b.id).length,1);
 s.block(a.id,c.id);assert.equal(s.paths(c.id).length,0);assert.equal(s.visitors(a.id).some(v=>v.visitor.id===c.id),false);assert.equal(s.questions(c.id).length,0);assert.equal(s.sentResponses(c.id).length,0);
 assert.throws(()=>s.report(b.id,a.id,''));s.report(b.id,a.id,'Test report');assert.equal(s.db.prepare('SELECT COUNT(*) n FROM reports').get().n,1);
 }finally{s.close();}
});
