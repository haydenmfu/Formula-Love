import {evaluate,edges} from './engine.js';
export function treeProgress(tree,owner,candidate){
 const result=evaluate(tree,owner,candidate),nodes=new Map(tree.nodes.map(n=>[n.id,n]));
 if(result.status==='invalid')return {passed:0,total:0,qualified:false};
 const memo=new Map();
 function remaining(id){if(memo.has(id))return memo.get(id);const n=nodes.get(id);if(!n)return -Infinity;
  if(n.type==='terminal')return n.outcome==='match'?0:-Infinity;
  const value=1+Math.max(...edges(n).map(e=>remaining(e.to)));memo.set(id,value);return value;
 }
 let passed=0,total=remaining(tree.start);
 for(const step of result.trace){const n=nodes.get(step.id);if(n.type==='terminal'||step.pending)break;
  const rest=remaining(step.to);if(!Number.isFinite(rest))break;passed++;total=passed+rest;
 }
 if(!Number.isFinite(total))total=0;
 const threshold=tree.completionThreshold??100;
 const qualified=result.status==='match'||(result.status==='pending'&&total>0&&passed/total*100>=threshold);
 return {passed,total,qualified};
}
export const bestProgress=list=>list.reduce((a,b)=>b.passed>a.passed||(b.passed===a.passed&&b.total>0&&(a.total===0||b.total<a.total))?b:a,{passed:0,total:0});
export function progressSummary(profiles,user){
 const peers=profiles.filter(p=>p.id!==user.id);
 return {incoming:bestProgress(peers.map(p=>treeProgress(user.tree,user,p))),outgoing:bestProgress(peers.map(p=>treeProgress(p.tree,p,user)))};
}
