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
