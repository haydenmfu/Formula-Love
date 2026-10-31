// Question values are data connections; yes/no and range branches are flow connections.
export function inputsFor(node){return ['count','sum'].includes(node.type)?node.inputs||[]:[];}
export function migrateTree(tree){
  if(!tree||!Array.isArray(tree.nodes))return tree;
  for(const node of [...tree.nodes]){
    if(!node||typeof node!=='object')continue;
    // Attraction ratings were removed; a number question that read them now asks the person directly.
    if(node.source)delete node.source;
    // Number questions used to need integer ranges covering every value; branches now start at breakpoints.
    if(node.type==='scale'&&Array.isArray(node.ranges)&&node.ranges.some(r=>r&&'min' in r)){node.ranges=[...node.ranges].sort((a,b)=>a.min-b.min).map((r,i)=>({from:i?r.min:null,to:r.to??''}));node.integer=true;}
    if(node.type!=='count'||!node.items)continue;
    node.inputs=node.items.map((item,i)=>{
      let id=node.id+'_input_'+(i+1);while(tree.nodes.some(n=>n.id===id))id+='_';
      tree.nodes.push({id,type:'boolean',label:item.label,key:item.key,mode:'input',yes:'',no:'',x:Math.max(30,node.x+(i-1)*260),y:Math.max(40,node.y-200)});
      return id;
    });
    delete node.items;
  }
  mergeEnds(tree);
  return tree;
}
// Older formulas could have several Compatible outcomes; they merge into one End and their branches follow.
function mergeEnds(tree){
  const ends=tree.nodes.filter(n=>n&&n.type==='terminal'&&n.outcome==='match');if(!ends.length)return;
  const keep=ends.find(n=>n.end)||ends[0],gone=new Set(ends.filter(n=>n!==keep).map(n=>n.id));
  Object.assign(keep,{end:true,label:'End'});if(!gone.size)return;
  const to=id=>gone.has(id)?keep.id:id;
  for(const n of tree.nodes){if(!n)continue;if('yes' in n)n.yes=to(n.yes);if('no' in n)n.no=to(n.no);for(const r of [...(Array.isArray(n.ranges)?n.ranges:[]),...(Array.isArray(n.options)?n.options:[])])if(r)r.to=to(r.to);}
  tree.start=to(tree.start);tree.nodes=tree.nodes.filter(n=>!n||!gone.has(n.id));
}
export function addEnd(tree){if(tree.nodes.some(n=>n.end))return null;const x=Math.max(0,...tree.nodes.map(n=>n.x))+340,y=tree.nodes[0]?.y??80,id='end';tree.nodes.push({id,type:'terminal',outcome:'match',end:true,label:'End',x,y});return id;}
export function flowEdges(node){
  if(node.type==='terminal'||node.mode==='input')return [];
  if(node.type==='scale')return (node.ranges||[]).map((r,index)=>({label:rangeLabel(node,index),to:r.to,index}));
  if(node.type==='category')return (node.options||[]).map((r,index)=>({label:r.value,to:r.to,index}));
  if(node.type==='text')return [{label:'Approved',to:node.yes,index:0},{label:'Not approved',to:node.no,index:1}];
  return [{label:'Yes',to:node.yes,index:0},{label:'No',to:node.no,index:1}];
}
// A number branch covers values from its breakpoint up to the next one; the first starts at the lowest allowed value.
export function rangeLabel(node,index){
  const r=node.ranges[index];if('min' in r)return `${r.min}–${r.max}`;
  const lower=r.from??(Number.isFinite(node.min)?node.min:null),next=node.ranges[index+1]?.from,upper=next??(Number.isFinite(node.max)?node.max:null),last=next===undefined;
  if(lower===null&&upper===null)return 'Any';
  if(node.integer){const top=last?upper:upper-1;if(lower===null)return `${top} or less`;if(upper===null)return `${lower}+`;return lower===top?`${lower}`:`${lower}–${top}`;}
  if(lower===null)return last?`${upper} or less`:`Under ${upper}`;if(upper===null)return `${lower}+`;return last?`${lower}–${upper}`:`${lower} to under ${upper}`;
}
export function connections(tree){
  return tree.nodes.flatMap(n=>[
    ...flowEdges(n).filter(e=>e.to).map(e=>({kind:'flow',from:n.id,to:e.to,index:e.index,label:e.label})),
    ...inputsFor(n).map((id,index)=>({kind:'data',from:id,to:n.id,index,label:'Input '+(index+1)})).filter(e=>e.from)
  ]);
}
export function setFlow(node,index,to){if(node.type==='scale')node.ranges[index].to=to;else if(node.type==='category')node.options[index].to=to;else node[index===0?'yes':'no']=to;}
export function removeConnection(tree,edge){const n=tree.nodes.find(n=>n.id===(edge.kind==='data'?edge.to:edge.from));if(edge.kind==='data')n.inputs[edge.index]='';else setFlow(n,edge.index,'');}
export function layoutTree(tree,{heights={}}={}){
  // Long edges get virtual nodes, so barycentric sweeps consider crossings across every layer.
  const hidden=new Set(tree.nodes.filter(n=>n.mode==='input'&&tree.nodes.some(b=>['count','sum'].includes(b.type)&&b.inputs?.includes(n.id))).map(n=>n.id));
  const ids=tree.nodes.filter(n=>!hidden.has(n.id)).map(n=>n.id),valid=new Set(ids),links=connections(tree).filter(e=>valid.has(e.from)&&valid.has(e.to));
  if(!ids.length)return {width:1000,height:600,crossings:0};
  const rank=new Map(ids.map(id=>[id,0])),indegree=new Map(ids.map(id=>[id,0]));
  for(const e of links)indegree.set(e.to,indegree.get(e.to)+1);
  const queue=ids.filter(id=>!indegree.get(id));let visited=0;
  while(queue.length){const id=queue.shift();visited++;for(const e of links.filter(e=>e.from===id)){rank.set(e.to,Math.max(rank.get(e.to),rank.get(id)+1));indegree.set(e.to,indegree.get(e.to)-1);if(!indegree.get(e.to))queue.push(e.to);}}
  if(visited!==ids.length)throw Error('Remove loops before cleaning up.');
  const layers=Array.from({length:Math.max(...rank.values())+1},()=>[]),segments=[],paths=new Map();
  for(const id of ids)layers[rank.get(id)].push(id);
  links.forEach((edge,i)=>{let prev=edge.from;const path=new Map();for(let r=rank.get(edge.from)+1;r<rank.get(edge.to);r++){const id='@'+i+':'+r;layers[r].push(id);segments.push([prev,id]);path.set(r,id);prev=id;}segments.push([prev,edge.to]);path.set(rank.get(edge.to),edge.to);paths.set(edge,path);});
  // Respect output order wherever distinct branch paths share a layer.
  const constraints=layers.map(()=>[]);
  for(const id of ids){const outgoing=links.filter(e=>e.from===id&&e.kind==='flow').sort((a,b)=>a.index-b.index);
    for(let i=0;i<outgoing.length;i++)for(let j=i+1;j<outgoing.length;j++)for(const [r,a] of paths.get(outgoing[i])){const b=paths.get(outgoing[j]).get(r);if(b&&a!==b)constraints[r].push([a,b]);}}
  const orderBranches=(row,r)=>{
    const result=[],remaining=new Set(row);
    while(remaining.size){const next=row.find(id=>remaining.has(id)&&!constraints[r].some(([a,b])=>b===id&&remaining.has(a)));
      // Shared destinations can impose conflicting order; retain stable order there.
      if(next===undefined){result.push(...row.filter(id=>remaining.has(id)));break;}result.push(next);remaining.delete(next);}
    return result;
  };
  layers.forEach((row,r)=>layers[r]=orderBranches(row,r));
  const position=()=>new Map(layers.flatMap(row=>row.map((id,i)=>[id,i])));
  const crossings=()=>{const pos=position();let count=0;for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){const [a,b]=segments[i],[c,d]=segments[j];if(a===c||b===d)continue;const row=layers.findIndex(l=>l.includes(a));if(layers[row]?.includes(c)&&layers[row+1]?.includes(b)&&layers[row+1]?.includes(d)&&(pos.get(a)-pos.get(c))*(pos.get(b)-pos.get(d))<0)count++;}return count;};
  let best=layers.map(l=>[...l]),score=crossings();
  for(let pass=0;pass<10;pass++){
    const down=pass%2===0;const order=layers.map((_,i)=>i);if(!down)order.reverse();
    for(const r of order){const pos=position();const bary=id=>{const neighbors=segments.filter(e=>e[down?1:0]===id).map(e=>pos.get(e[down?0:1]));return neighbors.length?neighbors.reduce((a,b)=>a+b,0)/neighbors.length:pos.get(id);};layers[r].sort((a,b)=>bary(a)-bary(b)||pos.get(a)-pos.get(b));}
    layers.forEach((row,r)=>layers[r]=orderBranches(row,r));
    const next=crossings();if(next<=score){score=next;best=layers.map(l=>[...l]);}
  }
  // Layers become columns, left to right; each column is centred against the tallest one.
  const node=id=>tree.nodes.find(n=>n.id===id),gapY=40;
  const tall=id=>{const n=node(id);if(!n)return 40;return heights[id]||(['count','sum'].includes(n.type)?120+(n.inputs?.length||0)*65:80+22*flowEdges(n).length);};
  const columns=best.map(row=>row.map(tall)),span=h=>h.reduce((a,b)=>a+b,0)+gapY*Math.max(0,h.length-1),height=Math.max(...columns.map(span));
  let x=190;
  best.forEach((row,r)=>{let y=60+(height-span(columns[r]))/2,widest=220;row.forEach((id,i)=>{const n=node(id);if(n){n.x=x;n.y=Math.round(y);if(['count','sum'].includes(n.type))widest=260;}y+=columns[r][i]+gapY;});x+=widest+100;});
  return {width:Math.max(1000,x+40),height:Math.max(600,height+160),crossings:score};
}
