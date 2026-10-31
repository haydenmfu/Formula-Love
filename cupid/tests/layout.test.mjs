import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutTree,migrateTree,addEnd} from '../dist/graph-model.js';
const end=id=>({id,type:'terminal',label:id,x:0,y:0,outcome:'match'});
test('cleanup stacks number destinations top to bottom by output, independent of node order',()=>{
 const t={start:'s',nodes:[{id:'s',type:'scale',ranges:[{min:1,max:3,to:'low'},{min:4,max:7,to:'mid'},{min:8,max:10,to:'high'}]},end('high'),end('mid'),end('low')]};
 layoutTree(t,{heights:{s:90}});const get=id=>t.nodes.find(n=>n.id===id);
 assert.ok(get('low').y<get('mid').y&&get('mid').y<get('high').y);assert.equal(get('low').x-get('s').x,320);assert.equal(get('s').x,190);
});
test('yes is above no and column gaps depend on the preceding column only',()=>{
 const t={start:'b',nodes:[{id:'b',type:'boolean',yes:'yes',no:'no'},end('no'),end('yes')]};layoutTree(t,{heights:{b:85,no:400}});
 assert.ok(t.nodes[2].y<t.nodes[1].y);assert.equal(t.nodes[1].x-t.nodes[0].x,320);
});
test('older formulas merge every Compatible outcome into one End heart and rewire its branches',()=>{
 const t={start:'q',nodes:[{id:'q',type:'boolean',key:'k',label:'Q',x:0,y:0,yes:'m1',no:'m2'},{id:'m1',type:'terminal',outcome:'match',label:'Yay',x:0,y:0},{id:'m2',type:'terminal',outcome:'match',label:'Also yay',x:0,y:0},{id:'r',type:'terminal',outcome:'reject',label:'Reject',x:0,y:0}]};
 migrateTree(t);assert.deepEqual(t.nodes.map(n=>n.id),['q','m1','r']);assert.equal(t.nodes[0].no,'m1');assert.deepEqual([t.nodes[1].end,t.nodes[1].label],[true,'End']);
 assert.equal(addEnd(t),null);const lone={start:'q',nodes:[{id:'q',type:'boolean',x:10,y:40,yes:'',no:''}]};assert.equal(addEnd(lone),'end');assert.deepEqual(lone.nodes[1],{id:'end',type:'terminal',outcome:'match',end:true,label:'End',x:350,y:40});
});
