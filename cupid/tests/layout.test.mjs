import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutTree} from '../dist/graph-model.js';
const end=id=>({id,type:'terminal',label:id,x:0,y:0,outcome:'match'});
test('cleanup stacks number destinations top to bottom by output, independent of node order',()=>{
 const t={start:'s',nodes:[{id:'s',type:'scale',ranges:[{min:1,max:3,to:'low'},{min:4,max:7,to:'mid'},{min:8,max:10,to:'high'}]},end('high'),end('mid'),end('low')]};
 layoutTree(t,{heights:{s:90}});const get=id=>t.nodes.find(n=>n.id===id);
 assert.ok(get('low').y<get('mid').y&&get('mid').y<get('high').y);assert.equal(get('low').x-get('s').x,320);
});
test('yes is above no and column gaps depend on the preceding column only',()=>{
 const t={start:'b',nodes:[{id:'b',type:'boolean',yes:'yes',no:'no'},end('no'),end('yes')]};layoutTree(t,{heights:{b:85,no:400}});
 assert.ok(t.nodes[2].y<t.nodes[1].y);assert.equal(t.nodes[1].x-t.nodes[0].x,320);
});
