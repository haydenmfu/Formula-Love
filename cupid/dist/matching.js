import {evaluate,questionsFor} from './engine.js';
import {treeProgress} from './progress.js';
// Return only question content and an aggregate count, never owners or traces.
export function matchingFeed(profiles,user,skipped=new Set()){
 let count=0;const questions=[],seen=new Set();
 for(const owner of profiles){
  if(owner.id===user.id)continue;
  const result=evaluate(owner.tree,owner,user);
  if(treeProgress(owner.tree,owner,user).qualified&&treeProgress(user.tree,user,owner).qualified)count++;
  if(result.status!=='pending')continue;
  for(const q of questionsFor(owner,user).filter(q=>q.needed)){
   if(seen.has(q.key)||skipped.has(q.key))continue;seen.add(q.key);
   const clean={key:q.key,label:q.label,type:q.type};
   if(q.type==='scale'){clean.min=q.min??null;clean.max=q.max??null;clean.integer=!!q.integer;}
   if(q.type==='category')clean.options=q.options.map(o=>({value:o.value}));
   // Open-ended prompts carry no options; the owner reviews the written response.
   questions.push(clean);
  }
 }
 return {count,questions};
}
