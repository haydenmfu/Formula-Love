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
 s.answer(a.id,qa.token,true);s.answer(b.id,qb.token,true);assert.equal(s.matches(a.id).length,0);
 s.rate(a.id,b.id,8);assert.equal(s.matches(a.id).length,0);s.rate(b.id,a.id,7);
 assert.equal(s.matches(a.id).length,1);assert.equal(s.matches(b.id).length,1);assert.equal(JSON.stringify(s.matches(a.id)).includes('secret hobby'),false);
 s.rate(b.id,a.id,3);assert.equal(s.matches(a.id).length,0);s.rate(b.id,a.id,8);
 s.close();s=createStore(path);assert.equal(s.matches(a.id).length,1);
 const changed=structuredClone(tree);changed.nodes[0].label='Changed meaning?';s.saveTree(a.id,changed);assert.equal(s.matches(a.id).length,0);assert.equal(s.questions(b.id).length,1);
 s.logout(a.token);assert.equal(s.authenticate(a.token),undefined);
 }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
test('accounts get a password identity, a public profile and server-side progress',()=>{
 const s=createStore(':memory:');
 try{
 const a=s.register({username:'carol',password:'password-for-test'}),b=s.register({username:'dave_1',password:'another-password'});
 assert.deepEqual(s.me(a.id).identities,['password']);
 assert.equal(s.db.prepare('SELECT user_id FROM identities WHERE provider=? AND subject=?').get('password','carol').user_id,a.id);
 assert.throws(()=>s.saveProfile(a.id,{avatar:'dragon'}));s.saveProfile(a.id,{avatar:'fox',privateHobbies:'hidden thing',bio:'match-only bio'});
 const seen=s.candidates(b.id);assert.deepEqual(seen,[{id:a.id,username:'carol',avatar:'fox',score:null}]);
 s.saveTree(a.id,structuredClone(tree));assert.deepEqual(s.progress(b.id).outgoing,{passed:0,total:1});
 s.answer(b.id,s.questions(b.id)[0].token,true);assert.deepEqual(s.progress(b.id).outgoing,{passed:1,total:1});assert.deepEqual(s.progress(a.id).incoming,{passed:1,total:1});
 }finally{s.close();}
});
test('number questions accept typed decimals within limits and enforce whole numbers when asked',()=>{
 const s=createStore(':memory:');
 try{
 const a=s.register({username:'erin',password:'password-for-test'}),b=s.register({username:'finn',password:'another-password'});
 const hours={start:'h',nodes:[{id:'h',type:'scale',key:'hours',label:'How many hours a day do you work out?',min:0,max:24,ranges:[{from:null,to:'no'},{from:1,to:'yes'}],x:0,y:0},{id:'yes',type:'terminal',label:'Compatible',outcome:'match',x:300,y:0},{id:'no',type:'terminal',label:'Reject',outcome:'reject',x:300,y:120}]};
 s.saveTree(a.id,structuredClone(hours));let q=s.questions(b.id)[0];assert.deepEqual([q.type,q.min,q.max,q.integer],['scale',0,24,false]);
 for(const bad of [25,-1,'2',Infinity])assert.throws(()=>s.answer(b.id,q.token,bad));
 s.answer(b.id,q.token,1.5);assert.deepEqual(s.progress(b.id).outgoing,{passed:1,total:1});
 const whole=structuredClone(hours);whole.nodes[0].integer=true;s.saveTree(a.id,whole);q=s.questions(b.id)[0];assert.equal(q.integer,true);
 assert.throws(()=>s.answer(b.id,q.token,1.5));s.answer(b.id,q.token,2);
 }finally{s.close();}
});
