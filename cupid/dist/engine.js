import {migrateTree,flowEdges,connections,rangeLabel} from './graph-model.js';
export const TYPES = {boolean:'Yes / no',scale:'Number',category:'Multiple choice',count:'At least N',sum:'Sum score',hobbies:'Compatible hobbies',terminal:'Outcome'};
export const clone=x=>JSON.parse(JSON.stringify(x));
export function demoTree(){return {start:'kind',nodes:[
{id:'kind',type:'boolean',label:'Would your friends call you kind?',key:'kind',x:340,y:65,yes:'lifestyle',no:'pass'},
{id:'lifestyle',type:'scale',label:'How many hours a week do you exercise?',key:'exercise_hours',min:0,max:80,ranges:[{from:null,to:'qualities'},{from:3,to:'hobbies'},{from:8,to:'hobbies'}],x:340,y:225},
{id:'qualities',type:'count',label:'Two out of three works for me',items:[{key:'curious',label:'Are you curious?'},{key:'funny',label:'Are you funny?'},{key:'ambitious',label:'Are you ambitious?'}],threshold:2,yes:'hobbies',no:'pass',x:70,y:420},
{id:'hobbies',type:'hobbies',label:'Compatible hobbies?',yes:'connect',no:'friends',x:420,y:590},
{id:'pass',type:'terminal',label:'Not a fit',outcome:'reject',x:750,y:225},
{id:'friends',type:'terminal',label:'Better as friends',outcome:'friends',x:740,y:785},
{id:'connect',type:'terminal',label:'Worth a conversation',outcome:'match',x:330,y:785}
]};}
export function initialState({demo=false}={}){const tree=demo?demoTree():{start:"",nodes:[]};return {version:1,active:'you',profiles:[
{id:'you',name:'You',bio:'Curious about people, terrible at small talk. Usually building something or finding a new game.',publicHobbies:'Programming, hiking, sci-fi books',privateHobbies:'League of Legends, board games',answers:{kind:true,exercise_hours:5,curious:true,funny:true,ambitious:true},attraction:{alex:8},tree:migrateTree(clone(tree))},
{id:'alex',name:'Alex',bio:'Weekend trails, cooperative games, and an unreasonable number of unfinished side projects.',publicHobbies:'Trail walking, reading fantasy, cooking',privateHobbies:'LoL, tabletop games',answers:{kind:true,exercise_hours:2.5,curious:true,funny:true,ambitious:false},attraction:{you:7},tree:migrateTree(clone(tree))}
]};}
export const edges=flowEdges;
export function validateTree(t,{allowUnconnected=false}={}){const e=[];migrateTree(t);if(t?.completionThreshold!==undefined&&(!Number.isInteger(t.completionThreshold)||t.completionThreshold<1||t.completionThreshold>100))return ['Completion threshold must be an integer from 1 to 100.'];if(allowUnconnected&&t&&Array.isArray(t.nodes)&&t.nodes.length===0&&t.start==='')return [];if(!t||!Array.isArray(t.nodes)||!t.nodes.length)return ['A tree needs at least one node.'];if(t.nodes.length>100)return ['Use at most 100 nodes in this prototype.'];const ids=new Set();for(const n of t.nodes){if(!n||typeof n.id!=='string'||!n.id){e.push('Every node needs a text ID.');continue}if(ids.has(n.id))e.push(`Duplicate ID: ${n.id}`);ids.add(n.id)}if(!ids.has(t.start))e.push('Choose an existing start node.');for(const n of t.nodes){if(!n||!TYPES[n.type]){e.push('Unknown node type.');continue}if(typeof n.label!=='string'||!n.label.trim())e.push(`${n.id}: add a label.`);if(!Number.isFinite(n.x)||!Number.isFinite(n.y)||n.x<0||n.y<0)e.push(`${n.id}: positions must be nonnegative numbers.`);if(['boolean','scale','category'].includes(n.type)&& (typeof n.key!=='string'||!n.key.trim()||['__proto__','constructor','prototype'].includes(n.key)))e.push(`${n.id}: add a valid answer key.`);
if(n.type==='scale'){const limit=v=>v==null||Number.isFinite(v),has=Number.isFinite;if(!limit(n.min)||!limit(n.max)||(has(n.min)&&has(n.max)&&n.min>=n.max))e.push(`${n.id}: answer limits must be numbers, with the minimum below the maximum.`);if(!Array.isArray(n.ranges)||!n.ranges.length){e.push(`${n.id}: add number branches.`);continue}if(n.ranges[0]?.from!==null)e.push(`${n.id}: the first branch must start at the lowest value.`);let prev=has(n.min)?n.min:-Infinity;for(const r of n.ranges.slice(1)){if(!has(r?.from)||r.from<=prev||(has(n.max)&&r.from>n.max)||(n.integer&&!Number.isInteger(r.from)))e.push(`${n.id}: each branch must start above the previous one${n.integer?', at a whole number':''}, within the answer limits.`);prev=r?.from}}
if(n.type==='category'){if(!Array.isArray(n.options)||!n.options.length||n.options.some(o=>typeof o.value!=='string'||!o.value.trim())||new Set(n.options.map(o=>o.value)).size!==n.options.length){e.push(`${n.id}: add distinct category labels.`);continue}}
if(['count','sum'].includes(n.type)){
  const type=n.type==='count'?'boolean':'scale';
  if(!Array.isArray(n.inputs)||n.inputs.length<2||n.inputs.length>8)e.push(n.id+': use 2–8 input slots.');
  else {
    const connected=n.inputs.filter(Boolean);
    if(new Set(connected).size!==connected.length)e.push(n.id+': each input must be a different question.');
    for(const id of n.inputs){if(id===''&&allowUnconnected)continue;const source=t.nodes.find(q=>q.id===id);if(!source||source.type!==type)e.push(n.id+': inputs must connect to '+type+' questions.');}
  }
  if(n.type==='count'&&(!Number.isInteger(n.threshold)||n.threshold<1||n.threshold>(n.inputs||[]).length))e.push(n.id+': invalid required count.');
  if(n.type==='sum'&&!Number.isFinite(n.threshold))e.push(n.id+': sum threshold must be a number.');
}
if(n.mode==='input'&&!['boolean','scale'].includes(n.type))e.push(n.id+': only binary or scalar questions can supply values.');
if(n.id===t.start&&n.mode==='input')e.push('Start must be a flow node, not an input-only question.');
if(n.type==='terminal'&&!['match','friends','reject'].includes(n.outcome))e.push(`${n.id}: choose match, friends, or reject.`);try{for(const edge of edges(n))if(!(allowUnconnected && edge.to==='') && !ids.has(edge.to))e.push(`${n.id}: branch “${edge.label}” has no valid destination.`)}catch{e.push(`${n.id}: invalid branches.`)}}
if(e.length)return [...new Set(e)];
for(const n of t.nodes)for(const edge of flowEdges(n))if(t.nodes.some(q=>q.id===edge.to&&q.mode==='input'))e.push(n.id+': flow cannot enter an input-only question.');
if(e.length)return [...new Set(e)];const visiting=new Set(),visited=new Set();function walk(id){if(visiting.has(id)){e.push('A branch creates a loop. Connect it to a later step or an outcome.');return}if(visited.has(id))return;visiting.add(id);for(const edge of connections(t).filter(e=>e.from===id))if(ids.has(edge.to))walk(edge.to);visiting.delete(id);visited.add(id)}for(const n of t.nodes)walk(n.id);return [...new Set(e)];}
const groups=[['league of legends','lol','league'],['board games','tabletop games','tabletop gaming'],['programming','coding','software development'],['hiking','trail walking','trekking'],['sci-fi books','science fiction','reading fantasy','fantasy books'],['video games','gaming','pc gaming'],['cooking','baking'],['running','jogging']];
const terms=s=>String(s||'').split(/[,;\n]/).map(x=>x.trim().toLowerCase()).filter(Boolean);
export function hobbyOverlap(a,b){const left=terms(`${a.publicHobbies},${a.privateHobbies}`),right=terms(`${b.publicHobbies},${b.privateHobbies}`);if(!left.length||!right.length)return {value:null,method:'local demo',reason:'Both profiles need hobbies before overlap can be checked.'};const normalize=x=>groups.findIndex(g=>g.includes(x));const overlap=left.some(l=>right.some(r=>l===r||(normalize(l)>=0&&normalize(l)===normalize(r))));return {value:overlap,method:'local demo',reason:overlap?'The demo found a shared hobby or a related hobby group.':'The demo found no known overlap. It may miss related interests.'};}
export function evaluate(tree,owner,candidate){const errors=validateTree(tree);if(errors.length)return {status:'invalid',trace:[],errors};let id=tree.start;const trace=[];while(id){const n=tree.nodes.find(x=>x.id===id);if(n.type==='terminal'){trace.push({id:n.id,label:n.label,detail:'Outcome'});return {status:n.outcome,trace}}let value,detail='',to;
if(n.type==='hobbies'){const result=hobbyOverlap(owner,candidate);value=result.value;detail=result.reason;}
else if(['count','sum'].includes(n.type)){
  const sources=n.inputs.map(id=>tree.nodes.find(q=>q.id===id));
  const values=sources.map(q=>questionValue(q,owner,candidate));
  if(n.type==='count'){
    const yes=values.filter(v=>v===true).length,unknown=values.filter(v=>v===null).length;
    value=yes>=n.threshold?true:yes+unknown<n.threshold?false:null;
    detail=yes+' of '+values.length+' yes; '+n.threshold+' required'+(unknown?'; '+unknown+' unanswered':'')+'.';
  } else {
    const total=values.reduce((sum,v)=>sum+(v??0),0);
    value=values.some(v=>v===null)?null:total>n.threshold;
    detail=values.some(v=>v===null)?'Waiting for all scalar inputs.':values.join(' + ')+' = '+total+'; must be greater than '+n.threshold+'.';
  }
}
else {value=n.source==='attraction'?owner.attraction[candidate.id]:candidate.answers[n.key];if(n.type==='boolean'&&typeof value!=='boolean')value=null;if(n.type==='scale'&&!numberOk(n,value))value=null;if(n.type==='category'&&!n.options.some(o=>o.value===value))value=null;}
if(value===undefined||value===null){trace.push({id:n.id,label:n.label,detail:detail||'Not answered yet.',pending:true});return {status:'pending',trace}}
if(n.type==='scale'){const i=n.ranges.findLastIndex(r=>r.from===null||value>=r.from);to=n.ranges[i].to;detail=`${value} · branch ${rangeLabel(n,i)}${n.source==='attraction'?' · your appearance rating':''}`;}else if(n.type==='category'){to=n.options.find(o=>o.value===value).to;detail=value;}else{to=value?n.yes:n.no;detail=detail|| (value?'Yes':'No');}trace.push({id:n.id,label:n.label,detail,to});id=to;}
return {status:'invalid',trace,errors:['No outcome reached.']};}
export function mutual(a,b){const forward=evaluate(a.tree,a,b),reverse=evaluate(b.tree,b,a);const attraction=Number(a.attraction[b.id])>=6&&Number(b.attraction[a.id])>=6;return {forward,reverse,attraction,matched:forward.status==='match'&&reverse.status==='match'&&attraction};}
export function questionValue(n,owner,candidate){
 const v=n.source==='attraction'?owner.attraction[candidate.id]:candidate.answers[n.key];
 if(n.type==='boolean')return typeof v==='boolean'?v:null;
 if(n.type==='scale')return numberOk(n,v)?v:null;
 return null;
}
// A number answer must be finite, whole when required, and inside any limits the owner set.
export function numberOk(n,v){return Number.isFinite(v)&&(!n.integer||Number.isInteger(v))&&(!Number.isFinite(n.min)||v>=n.min)&&(!Number.isFinite(n.max)||v<=n.max);}
export function questionsFor(owner,candidate){
 const result=evaluate(owner.tree,owner,candidate),last=result.status==='pending'?result.trace.at(-1):null;
 const blocked=owner.tree.nodes.find(n=>n.id===last?.id),needed=new Set(blocked?.inputs||[last?.id]);
 const seen=new Set();
 return owner.tree.nodes.filter(n=>['boolean','scale','category'].includes(n.type)&&n.source!=='attraction').map(n=>({...n,needed:needed.has(n.id)&&questionValue(n,owner,candidate)===null})).filter(n=>{if(seen.has(n.key))return false;seen.add(n.key);return true;}).sort((a,b)=>Number(b.needed)-Number(a.needed));
}
