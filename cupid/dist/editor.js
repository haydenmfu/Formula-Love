import {containQuestion,releaseQuestion} from './containers.js';
import {TYPES,clone,edges,validateTree} from './engine.js';
import {connections,inputsFor,layoutTree,setFlow,removeConnection,migrateTree,addEnd} from './graph-model.js';
import {heartSvg} from './avatars.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let context,zoom=.8,view='visual',pending=null,undo=null,ownerKey=null;
let cancelConnection=null;
const helpText='Drag a dot to connect · click a step to edit';
const isEnd=n=>n.type==='terminal'&&n.outcome==='match';
const question=n=>['boolean','scale','category','text'].includes(n.type);
const group=n=>n.type==='boolean'?'binary':n.type==='scale'?'scalar':n.type==='category'?'choice':n.type==='text'?'open':['count','sum','hobbies'].includes(n.type)?'organization':'other';
const size=t=>({width:Math.max(1200,...t.nodes.map(n=>n.x+310)),height:Math.max(900,...t.nodes.map(n=>n.y+(['count','sum'].includes(n.type)?180+(n.inputs?.length||0)*65:300)))});
const ICON={boolean:'M9 12l2 2 4-4M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',scale:'M5 9h14M5 15h14M10 3 8 21M16 3l-2 18',category:'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',text:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',count:'M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5',sum:'M12 5v14M5 12h14',hobbies:'M12 20S3 14 3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12-9 12Z',reject:'M18 6 6 18M6 6l12 12',friends:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',undo:'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',play:'M7 5l12 7-12 7z',plus:'M12 5v14M5 12h14',minus:'M5 12h14',close:'M18 6 6 18M6 6l12 12'};
const icon=(k,s=14)=>`<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[k]}"/></svg>`;
const KIND={boolean:'Yes or no',scale:'Number',category:'Multiple choice',text:'Written response',count:'At least N',sum:'Add up numbers',hobbies:'Hobby check'};
// Connectors carry no glyphs: hollow while open, filled once connected.
function marker(label,attributes,connected){return `<button type="button" class="port ${connected?'connected':'open'}" ${attributes} aria-label="${esc(label)}" title="${esc(label)}"></button>`;}
let selectedId=null;
export function editorMarkup(tree,key){
  if(ownerKey!==key){ownerKey=key;undo=null;pending=null;closePopup();}
  selectedId=null;
  const {width,height}=size(tree),links=connections(tree),open=tree.nodes.flatMap(n=>edges(n)).filter(e=>!e.to).length,asked=tree.nodes.filter(question).length;
  const into=id=>id===tree.start||links.some(e=>e.kind==='flow'&&e.to===id),start=tree.nodes.find(n=>n.id===tree.start);
  const card=n=>{
    const inputs=inputsFor(n),flows=edges(n),dataUsed=links.some(e=>e.kind==='data'&&e.from===n.id),pos=`data-card="${esc(n.id)}" style="left:${n.x}px;top:${n.y}px" tabindex="0"`;
    const inPort=n.mode!=='input'?`<div class="flow-in">${marker('Input: '+n.label,`data-flow-in="${esc(n.id)}"`,into(n.id))}</div>`:'';
    if(isEnd(n))return `<article class="graph-node end-node" ${pos} aria-label="End: compatible">${inPort}${heartSvg()}<span>Compatible</span></article>`;
    if(n.type==='terminal')return `<article class="graph-node outcome-node" ${pos} aria-label="Outcome: ${esc(n.label)}">${inPort}${icon(n.outcome==='friends'?'friends':'reject')}<span>${n.outcome==='friends'?'Friends':'Reject'}</span></article>`;
    const block=['count','sum'].includes(n.type);
    return `<article class="graph-node ${group(n)}${block?' count-container':''}" ${pos} aria-label="Edit ${esc(n.label)}">${inPort}<div class="node-inputs">${(n.type==='count'?[]:inputs).map((id,i)=>`<div class="input-slot">${marker(`Input ${i+1}: ${id?tree.nodes.find(q=>q.id===id)?.label:'not connected'} · ${n.type==='count'?'yes / no only':'numbers only'}`,`data-data-in="${esc(n.id)}" data-slot="${i}"`,!!id)}<span>${i+1}</span></div>`).join('')}</div><header>${icon(n.type,13)}<span>${KIND[n.type]}</span></header><div class="graph-node-title">${esc(n.label)}</div>${block?`<div class="node-summary">${n.type==='count'?`At least ${n.threshold} of ${inputs.length} yes`:`Total above ${n.threshold}`}</div>${containerSlots(n,tree)}`:''}${['boolean','scale'].includes(n.type)?`<div class="value-row">${marker('Value output: '+n.label+(dataUsed?'':' · optional, drag to a block'),`data-value-out="${esc(n.id)}"`,dataUsed)}</div>`:''}${flows.length?`<div class="flow-outputs">${flows.map((edge,i)=>`<div class="answer"><span>${esc(edge.label)}</span>${marker(edge.label+': '+(edge.to?tree.nodes.find(q=>q.id===edge.to)?.label:'not connected'),`data-flow-out="${esc(n.id)}" data-slot="${i}"`,!!edge.to)}${edge.to?'':`<button type="button" class="add-next" data-add-from="${esc(n.id)}" data-slot="${i}" aria-label="Add the step after ${esc(edge.label)}" title="Add the next step">${icon('plus',10)}</button>`}</div>`).join('')}</div>`:''}</article>`;
  };
  const visible=tree.nodes.filter(n=>!tree.nodes.some(b=>['count','sum'].includes(b.type)&&b.inputs?.includes(n.id)&&n.mode==='input'));
  const canvas=`<div class="graph-scroll"><div class="graph-space" style="width:${width*zoom}px;height:${height*zoom}px"><div class="graph-canvas" style="width:${width}px;height:${height}px;transform:scale(${zoom})">${!tree.nodes.length?`<div class="empty-tree"><h2>Start your formula</h2><p>Add your first question. Start and the End heart come with it.</p><button class="primary" data-editor="add">${icon('plus',12)} Add first question</button></div>`:''}<svg class="graph-wires" width="${width}" height="${height}"></svg>${start?`<div class="start-bubble" style="left:${Math.max(8,start.x-120)}px;top:${start.y}px">${icon('play',10)}<span>Start</span><button type="button" class="port connected" data-start-out aria-label="Start: drag to the first question" title="Drag to the first question"></button></div>`:''}${visible.map(card).join('')}</div></div></div>`;
  const advanced=`<div class="advanced"><label class="completion-setting">Accept at <input id="completion-threshold" type="number" min="1" max="100" step="1" value="${tree.completionThreshold??100}" aria-label="Formula completion threshold">% completion <small>Reject and Friends outcomes stay final.</small></label><textarea id="tree-json" class="code" aria-label="Formula JSON" spellcheck="false">${esc(JSON.stringify(tree,null,2))}</textarea><div class="actions"><button data-editor="apply" class="primary">Apply changes</button><button data-editor="import">Import formula</button><input id="tree-import" type="file" accept=".json" hidden><button data-editor="clear" class="ghost danger right">Clear formula</button></div><p id="editor-error" class="error"></p></div>`;
  const status=pending?'Select an input dot to connect. Escape cancels.':!tree.nodes.length?'':open?`${open} ${open===1?'answer still needs':'answers still need'} somewhere to go`:`Every answer leads somewhere · ${asked} ${asked===1?'question':'questions'}`;
  return `<section class="graph-editor"><div class="canvas-area${view==='advanced'?' is-advanced':''}">${view==='advanced'?advanced:canvas}<div class="canvas-chip view-chip"><button data-editor="visual" class="${view==='visual'?'active':''}">Editor</button><button data-editor="advanced" class="${view==='advanced'?'active':''}">Advanced</button></div>${view==='visual'?`<div class="canvas-chip tools-chip"><button data-editor="undo" ${!undo?'disabled':''} aria-label="Undo" title="Undo">${icon('undo')}</button><span class="chip-sep"></span><button data-editor="minus" aria-label="Zoom out" title="Zoom out">${icon('minus')}</button><span class="zoom-label">${Math.round(zoom*100)}%</span><button data-editor="plus" aria-label="Zoom in" title="Zoom in">${icon('plus')}</button><button data-editor="fit">Fit</button><span class="chip-sep"></span><button data-editor="cleanup">Tidy</button><button data-editor="add" class="chip-primary">${icon('plus',12)}Add step</button></div>${status?`<div class="canvas-status${open?' needs':''}"><span class="dot"></span><span class="editor-help" role="status">${status}</span></div>`:''}`:''}</div><aside class="step-panel" hidden aria-label="Step settings"></aside></section>`;
}
function commit(tree,message){const errors=validateTree(tree,{allowUnconnected:true});if(errors.length)throw Error(errors.join('\n'));pending=null;undo=clone(context.tree);refreshTree(tree);context.notify(message);}
export function mountEditor(tree,change,notify){
  context={tree,change,notify};
  if(!document.querySelector('.graph-editor'))return;
  document.querySelectorAll('[data-editor]').forEach(b=>b.onclick=()=>editorAction(b.dataset.editor,b));
  document.querySelectorAll('[data-add-from]').forEach(b=>{b.onpointerdown=e=>e.stopPropagation();b.onclick=e=>{e.stopPropagation();addMenu(b,{from:b.dataset.addFrom,slot:Number(b.dataset.slot)});};});
  document.querySelectorAll('[data-card]').forEach(el=>{
    el.onpointerdown=e=>dragNode(e,el);
    el.onclick=e=>{if(e.target.closest('button')||el.dataset.dragged)return;nodePopup(el.dataset.card,el);};
    el.onkeydown=e=>{if(e.target===el&&(e.key==='Enter'||e.key===' ')){e.preventDefault();nodePopup(el.dataset.card,el);}};
  });
  document.querySelectorAll('.port').forEach(p=>{p.onpointerdown=e=>dragConnection(e,p);p.onclick=e=>{e.stopPropagation();if(e.detail===0)connectPort(p);};});
  const viewport=document.querySelector('.graph-scroll');
  if(viewport){
    viewport.addEventListener('wheel',e=>{
      e.preventDefault();if(cancelConnection)return;
      const r=viewport.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
      const x=(viewport.scrollLeft+px)/zoom,y=(viewport.scrollTop+py)/zoom;
      zoom=Math.max(.3,Math.min(1.5,zoom*Math.exp(-e.deltaY*(e.deltaMode===1?.025:.0015))));
      const bounds=size(context.tree),canvas=viewport.querySelector('.graph-canvas'),space=viewport.querySelector('.graph-space');
      canvas.style.transform=`scale(${zoom})`;space.style.width=bounds.width*zoom+'px';space.style.height=bounds.height*zoom+'px';
      viewport.scrollLeft=x*zoom-px;viewport.scrollTop=y*zoom-py;
      document.querySelector('.zoom-label').textContent=Math.round(zoom*100)+'%';drawWires();
    },{passive:false});
    viewport.onpointerdown=e=>{
      if(e.button!==0||e.target.closest('[data-card],.edge-hit,button'))return;
      e.preventDefault();const x=e.clientX,y=e.clientY,left=viewport.scrollLeft,top=viewport.scrollTop;
      viewport.setPointerCapture(e.pointerId);viewport.classList.add('panning');
      viewport.onpointermove=p=>{viewport.scrollLeft=left-(p.clientX-x);viewport.scrollTop=top-(p.clientY-y);};
      const end=()=>{viewport.onpointermove=null;viewport.onpointerup=null;viewport.onpointercancel=null;viewport.classList.remove('panning');if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);};
      viewport.onpointerup=end;viewport.onpointercancel=end;
    };
  }
  document.querySelectorAll('[data-contained]').forEach(el=>{
    el.onpointerdown=e=>dragContained(e,el);
    el.onclick=e=>{e.stopPropagation();nodePopup(el.dataset.contained,el);};
  });
  const threshold=document.querySelector('#completion-threshold');if(threshold)threshold.onchange=e=>{const value=Number(e.target.value);if(!Number.isInteger(value)||value<1||value>100){e.target.value=context.tree.completionThreshold??100;return notify('Choose a whole percentage from 1 to 100.');}const draft=clone(context.tree);draft.completionThreshold=value;commit(draft,'Completion threshold saved.');};
  requestAnimationFrame(drawWires);
}
function refreshTree(tree){
  const box=document.querySelector('.graph-scroll'),left=box?.scrollLeft||0,top=box?.scrollTop||0,pageX=window.scrollX,pageY=window.scrollY;
  context.change(tree);
  document.querySelector('.graph-scroll')?.scrollTo(left,top);window.scrollTo(pageX,pageY);
}
function redraw(){refreshTree(context.tree);}
function editorAction(action,el){
  try{
    if(['visual','advanced'].includes(action)){view=action;pending=null;closePopup();redraw();}
    else if(action==='plus'||action==='minus'){zoom=Math.max(.3,Math.min(1.5,zoom+(action==='plus'?.1:-.1)));redraw();}
    else if(action==='fit'){fit();}
    else if(action==='clear'){const el=popup('<h2>Clear this formula?</h2><p>Remove every step and connection. You can Undo immediately afterward.</p><div class="actions" style="margin-top:16px"><button id="cancel-clear">Cancel</button><button id="confirm-clear" class="danger">Clear all steps</button></div>');el.querySelector('#cancel-clear').onclick=closePopup;el.querySelector('#confirm-clear').onclick=()=>{commit({start:'',nodes:[]},'Formula cleared. Undo is available.');closePopup();};}
    else if(action==='cleanup'){if(!context.tree.nodes.length)return;const t=clone(context.tree);layoutTree(t,{heights:Object.fromEntries([...document.querySelectorAll('[data-card]')].map(el=>[el.dataset.card,el.offsetHeight]))});commit(t,'Formula arranged. Use Fit to see all of it.');}
    else if(action==='undo'&&undo){const t=undo;undo=null;refreshTree(t);context.notify('Previous version restored.');}
    else if(action==='add')addMenu(el||document.querySelector('[data-editor="add"]'),null);
    else if(action==='apply'){const t=migrateTree(JSON.parse(document.querySelector('#tree-json').value));commit(t,'Formula applied.');}
    else if(action==='import'){const input=document.querySelector('#tree-import');input.onchange=async()=>{const file=input.files[0];if(file?.size>200000)return context.notify('Choose a file under 200 KB.');if(file)document.querySelector('#tree-json').value=await file.text();};input.click();}
  }catch(e){const box=document.querySelector('#editor-error');if(box)box.textContent=e.message;else context.notify(e.message);}
}
function fit(){const box=document.querySelector('.graph-scroll');if(!box)return;const bounds=size(context.tree);zoom=Math.max(.3,Math.min(1,box.clientWidth/bounds.width,(box.clientHeight-52)/bounds.height));redraw();}
function draftConnection(source,p){
  const t=clone(context.tree);
  if(source.kind==='start'){const n=t.nodes.find(n=>n.id===p.dataset.flowIn);if(!p.dataset.flowIn||n?.type==='terminal')throw Error('Start connects to a question or block.');t.start=n.id;const errors=validateTree(t,{allowUnconnected:true});if(errors.length)throw Error(errors.join('\n'));return t;}
  if(source.kind==='flow'&&p.dataset.flowIn)setFlow(t.nodes.find(n=>n.id===source.from),source.index,p.dataset.flowIn);
  else if(source.kind==='data'&&p.dataset.dataIn){
    const block=t.nodes.find(n=>n.id===p.dataset.dataIn),q=t.nodes.find(n=>n.id===source.from);
    if(q.type!==(block.type==='count'?'boolean':'scale'))throw Error('This input accepts '+(block.type==='count'?'binary':'scalar')+' questions only.');
    block.inputs[Number(p.dataset.slot)]=q.id;
  }else throw Error('Choose a compatible input.');
  const errors=validateTree(t,{allowUnconnected:true});if(errors.length)throw Error(errors.join('\n'));return t;
}
function dragConnection(event,port){
  event.stopPropagation();if(event.button!==0)return;
  const source=port.dataset.startOut!==undefined?{kind:'start'}:port.dataset.flowOut?{kind:'flow',from:port.dataset.flowOut,index:Number(port.dataset.slot)}:port.dataset.valueOut?{kind:'data',from:port.dataset.valueOut}:null;
  if(!source)return;
  event.preventDefault();cancelConnection?.();closePopup();pending=null;
  const canvas=document.querySelector('.graph-canvas'),svg=canvas.querySelector('svg'),scroll=document.querySelector('.graph-scroll');
  const valid=[...canvas.querySelectorAll(source.kind==='data'?'[data-data-in]':'[data-flow-in]')].filter(p=>{try{draftConnection(source,p);return true;}catch{return false;}});
  valid.forEach(p=>p.classList.add('can-connect'));port.classList.add('drag-source');
  const preview=document.createElementNS('http://www.w3.org/2000/svg','path');preview.setAttribute('class','connection-preview '+source.kind);svg.append(preview);
  const center=p=>{const r=p.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};};
  let snapped=null,last={clientX:event.clientX,clientY:event.clientY},frame=0,moved=false;
  const paint=()=>{
    const rect=canvas.getBoundingClientRect(),bounds=scroll.getBoundingClientRect();let distance=30,target=null;
    if(last.clientX>=bounds.left&&last.clientX<=bounds.right&&last.clientY>=bounds.top&&last.clientY<=bounds.bottom)for(const p of valid){const c=center(p),d=Math.hypot(c.x-last.clientX,c.y-last.clientY);if(d<distance){distance=d;target=p;}}
    snapped?.classList.remove('snap-target');snapped=target;snapped?.classList.add('snap-target');
    const a=center(port),b=target?center(target):{x:last.clientX,y:last.clientY};
    preview.setAttribute('d',curve({x:(a.x-rect.left)/zoom,y:(a.y-rect.top)/zoom},{x:(b.x-rect.left)/zoom,y:(b.y-rect.top)/zoom},source.kind));
    preview.classList.toggle('snapped',!!target);
  };
  const move=e=>{last=e;moved ||= Math.hypot(e.clientX-event.clientX,e.clientY-event.clientY)>4;paint();};
  const cleanup=()=>{cancelAnimationFrame(frame);preview.remove();valid.forEach(p=>p.classList.remove('can-connect','snap-target'));port.classList.remove('drag-source');port.removeEventListener('pointermove',move);port.removeEventListener('pointerup',finish);port.removeEventListener('pointercancel',cancel);document.removeEventListener('keydown',key);if(port.hasPointerCapture(event.pointerId))port.releasePointerCapture(event.pointerId);cancelConnection=null;const h=document.querySelector('.editor-help');if(h)h.textContent=helpText;};
  const finish=e=>{move(e);const target=snapped;cleanup();if(target&&moved){const left=scroll.scrollLeft,top=scroll.scrollTop;commit(draftConnection(source,target),'Connection saved.');document.querySelector('.graph-scroll')?.scrollTo(left,top);}};
  const cancel=()=>cleanup(),key=e=>{if(e.key==='Escape')cleanup();};
  const tick=()=>{if(moved){const r=scroll.getBoundingClientRect(),speed=v=>Math.min(14,Math.max(0,v));const dx=last.clientX<r.left+35?-speed(r.left+35-last.clientX):last.clientX>r.right-35?speed(last.clientX-r.right+35):0,dy=last.clientY<r.top+35?-speed(r.top+35-last.clientY):last.clientY>r.bottom-35?speed(last.clientY-r.bottom+35):0;if(dx||dy){scroll.scrollBy(dx,dy);paint();}}frame=requestAnimationFrame(tick);};
  cancelConnection=cleanup;port.setPointerCapture(event.pointerId);port.addEventListener('pointermove',move);port.addEventListener('pointerup',finish);port.addEventListener('pointercancel',cancel);document.addEventListener('keydown',key);document.querySelector('.editor-help').textContent='Drag to a highlighted input. Release to connect; Escape cancels.';paint();frame=requestAnimationFrame(tick);
}
function connectPort(p){
  if(p.dataset.startOut!==undefined){pending={kind:'start'};document.querySelector('.editor-help').textContent='Select the input dot on the left of a question to start there. Escape cancels.';return;}
  if(p.dataset.flowOut){pending={kind:'flow',from:p.dataset.flowOut,index:Number(p.dataset.slot)};document.querySelector('.editor-help').textContent='Select an input dot on the left edge of a step. Escape cancels.';return;}
  if(p.dataset.valueOut){pending={kind:'data',from:p.dataset.valueOut};document.querySelector('.editor-help').textContent='Select a numbered input on a matching block. Escape cancels.';return;}
  if(!pending)return context.notify('Choose an output dot first.');
  if(pending.kind==='start'){try{commit(draftConnection(pending,p),'Start moved.');pending=null;}catch(e){context.notify(e.message);}return;}
  const t=clone(context.tree);
  try{
    if(pending.kind==='flow'&&p.dataset.flowIn){setFlow(t.nodes.find(n=>n.id===pending.from),pending.index,p.dataset.flowIn);}
    else if(pending.kind==='data'&&p.dataset.dataIn){const n=t.nodes.find(n=>n.id===p.dataset.dataIn),source=t.nodes.find(n=>n.id===pending.from);if(source.type!==(n.type==='count'?'boolean':'scale'))throw Error(n.type==='count'?'This block only accepts binary questions.':'Sum score only accepts scalar questions.');n.inputs[Number(p.dataset.slot)]=source.id;}
    else throw Error('Flow outputs connect to flow inputs; values connect to numbered block inputs.');
    commit(t,'Connection saved.');pending=null;document.querySelector('.editor-help').textContent='Connection saved. Click an edge to delete it.';
  }catch(e){context.notify(e.message);}
}
function dragNode(e,el){
  if(e.button!==0||e.target.closest('button'))return;
  e.stopPropagation();closePopup();const node=context.tree.nodes.find(n=>n.id===el.dataset.card),before=clone(context.tree);
  const sx=e.clientX,sy=e.clientY,ox=node.x,oy=node.y;let moved=false,drop=null;
  el.setPointerCapture(e.pointerId);
  el.onpointermove=ev=>{if(!moved&&Math.abs(ev.clientX-sx)+Math.abs(ev.clientY-sy)<5)return;moved=true;node.x=Math.max(30,Math.round(ox+(ev.clientX-sx)/zoom));node.y=Math.max(50,Math.round(oy+(ev.clientY-sy)/zoom));el.style.left=node.x+'px';el.style.top=node.y+'px';drop=findSlot(ev.clientX,ev.clientY,node.type);drawWires();};
  const end=()=>{el.onpointermove=null;el.onpointerup=null;el.onpointercancel=null;clearSlots();if(moved){if(drop){const draft=clone(before);try{containQuestion(draft,node.id,drop.dataset.block,Number(drop.dataset.slot));context.tree=before;commit(draft,'Question placed inside block.');return;}catch(error){context.notify(error.message);}}el.dataset.dragged='true';undo=before;const box=document.querySelector('.graph-scroll'),left=box.scrollLeft,top=box.scrollTop;context.change(context.tree);document.querySelector('.graph-scroll').scrollTo(left,top);}};
  el.onpointerup=end;el.onpointercancel=end;
}
function closePopup(){closeMenu();const panel=document.querySelector('.step-panel');if(panel&&!panel.hidden){panel.hidden=true;panel.innerHTML='';document.querySelector('.graph-editor')?.classList.remove('with-panel');}if(selectedId)select(null);}
function containerSlots(block,tree){return '<div class="container-slots">'+block.inputs.map((id,i)=>{
 const q=tree.nodes.find(n=>n.id===id);
 return `<div class="question-slot ${q?'filled':''}" data-accept="${block.type==='count'?'boolean':'scale'}" data-block="${esc(block.id)}" data-slot="${i}"><span class="slot-number">${i+1}</span>${q?`<button class="contained-question" data-contained="${esc(q.id)}" data-owner="${esc(block.id)}" data-index="${i}">${esc(q.label)}</button>`:`<span>Drop a ${block.type==='count'?'yes/no':'scalar'} question here</span>`}</div>`;
 }).join('')+'</div>';}
function clearSlots(){document.querySelectorAll('.question-slot').forEach(el=>el.classList.remove('drop-ready'));}
function findSlot(x,y,type){clearSlots();if(!['boolean','scale'].includes(type))return null;const slot=[...document.querySelectorAll('.question-slot:not(.filled)')].find(el=>{const r=el.getBoundingClientRect();return el.dataset.accept===type&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;});slot?.classList.add('drop-ready');return slot;}
function dragContained(e,el){
 if(e.button!==0)return;e.stopPropagation();
 const sx=e.clientX,sy=e.clientY;let moved=false,drop=null,ghost=null;
 el.setPointerCapture(e.pointerId);
 el.onpointermove=p=>{
  if(!moved&&Math.hypot(p.clientX-sx,p.clientY-sy)<6)return;
  if(!moved){moved=true;ghost=el.cloneNode(true);ghost.className='contained-drag-preview';document.body.append(ghost);}
  ghost.style.left=p.clientX+12+'px';ghost.style.top=p.clientY+12+'px';drop=findSlot(p.clientX,p.clientY,context.tree.nodes.find(n=>n.id===el.dataset.contained).type);
 };
 const finish=p=>{
  el.onpointermove=null;el.onpointerup=null;el.onpointercancel=null;ghost?.remove();clearSlots();
  if(!moved||p.type==='pointercancel')return;
  el.onclick=e=>e.stopPropagation();
  const t=clone(context.tree),canvas=document.querySelector('.graph-canvas').getBoundingClientRect();
  try{if(drop){containQuestion(t,el.dataset.contained,drop.dataset.block,Number(drop.dataset.slot));}
  else{const bounds=document.querySelector('.graph-scroll').getBoundingClientRect();if(p.clientX<bounds.left||p.clientX>bounds.right||p.clientY<bounds.top||p.clientY>bounds.bottom)return;
   releaseQuestion(t,el.dataset.owner,Number(el.dataset.index),Math.max(30,(p.clientX-canvas.left)/zoom),Math.max(50,(p.clientY-canvas.top)/zoom));}
   commit(t,drop?'Question moved into slot.':'Question moved out of block.');
  }catch(error){context.notify(error.message);}
 };
 el.onpointerup=finish;el.onpointercancel=finish;
}
// Settings live in a panel docked to the right of the canvas; the selected step and its wires turn accent.
function popup(html){
  closeMenu();const panel=document.querySelector('.step-panel');if(!panel)return null;
  panel.innerHTML=`<button type="button" class="panel-close" aria-label="Close settings">${icon('close',16)}</button><div class="panel-body">${html}</div>`;
  panel.hidden=false;document.querySelector('.graph-editor').classList.add('with-panel');
  panel.querySelector('.panel-close').onclick=closePopup;requestAnimationFrame(drawWires);return panel;
}
function select(id){selectedId=id;document.querySelectorAll('.graph-node.selected').forEach(n=>n.classList.remove('selected'));if(id)document.querySelector(`[data-card="${CSS.escape(id)}"]`)?.classList.add('selected');drawWires();}
const MENU=[['Ask another question',[['boolean','Yes or no'],['scale','Number'],['category','Multiple choice'],['text','Written response']]],['End the path',[['end','Reach the heart'],['reject','Reject'],['friends','Friends']]],['Combine answers',[['count','At least N are yes'],['sum','Add up numbers'],['hobbies','Compare hobbies']]]];
function closeMenu(){document.querySelector('.add-menu')?.remove();}
// One menu for every way of adding a step; from an answer's +, the new step arrives already connected.
function addMenu(anchor,source){
  closeMenu();const from=source&&context.tree.nodes.find(n=>n.id===source.from),label=from?edges(from)[source.slot]?.label:'';
  const el=document.createElement('div');el.className='add-menu';el.setAttribute('role','menu');
  el.innerHTML=`<input class="menu-search" placeholder="${source?`Connect “${esc(label)}” to…`:'Add a step…'}" aria-label="Search step types">`+MENU.map(([h,items])=>[h,items.filter(([k])=>source||!['end','reject','friends'].includes(k))]).filter(([,items])=>items.length).map(([h,items])=>`<div class="menu-group"><div class="menu-heading">${h}</div>${items.map(([k,l])=>`<button type="button" class="menu-item" role="menuitem" data-kind="${k}">${k==='end'?heartSvg('mini'):icon(k)}<span>${l}</span></button>`).join('')}</div>`).join('');
  document.body.append(el);
  const r=anchor.getBoundingClientRect(),m=el.getBoundingClientRect();
  el.style.left=Math.max(8,Math.min(window.innerWidth-m.width-8,r.right+8))+'px';el.style.top=Math.max(8,Math.min(window.innerHeight-m.height-8,r.top-48))+'px';
  const search=el.querySelector('.menu-search');search.focus({preventScroll:true});
  search.oninput=()=>{const q=search.value.trim().toLowerCase();el.querySelectorAll('.menu-item').forEach(b=>b.hidden=!!q&&!b.textContent.toLowerCase().includes(q));el.querySelectorAll('.menu-group').forEach(g=>g.hidden=![...g.querySelectorAll('.menu-item')].some(b=>!b.hidden));};
  search.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();el.querySelector('.menu-item:not([hidden])')?.click();}else if(e.key==='ArrowDown'){e.preventDefault();el.querySelector('.menu-item:not([hidden])')?.focus();}};
  el.onkeydown=e=>{const items=[...el.querySelectorAll('.menu-item:not([hidden])')],i=items.indexOf(document.activeElement);if(i<0)return;if(e.key==='ArrowDown'){e.preventDefault();items[Math.min(items.length-1,i+1)].focus();}if(e.key==='ArrowUp'){e.preventDefault();(i?items[i-1]:search).focus();}};
  el.querySelectorAll('.menu-item').forEach(b=>b.onclick=()=>{closeMenu();try{createStep(b.dataset.kind,source);}catch(e){context.notify(e.message);}});
}
function createStep(kind,source){
  const t=clone(context.tree),from=source&&t.nodes.find(n=>n.id===source.from);
  if(kind==='end'){setFlow(from,source.slot,t.nodes.find(isEnd)?.id||addEnd(t));commit(t,'Connected to the heart.');return;}
  const type=['reject','friends'].includes(kind)?'terminal':kind,id='node_'+Date.now().toString(36),viewport=document.querySelector('.graph-scroll'),fromEl=from&&document.querySelector(`[data-card="${CSS.escape(from.id)}"]`);
  const at=from?{x:from.x+(fromEl?.offsetWidth||240)+110,y:Math.max(50,from.y+source.slot*40)}:{x:Math.max(30,Math.round(((viewport?.scrollLeft||0)+(viewport?.clientWidth||500)/2)/zoom-120)),y:Math.max(50,Math.round(((viewport?.scrollTop||0)+(viewport?.clientHeight||400)/2)/zoom-60))};
  const n={id,type,label:type==='terminal'?(kind==='friends'?'Friends':'Reject'):TYPES[type],...at};
  if(question(n))n.key=id;
  if(['boolean','count','sum','hobbies','text'].includes(type)){n.yes='';n.no='';}
  if(type==='scale')Object.assign(n,{min:0,max:null,integer:false,ranges:[{from:null,to:''},{from:5,to:''}]});
  if(type==='category')n.options=[{value:'Choice A',to:''},{value:'Choice B',to:''}];
  if(type==='count')Object.assign(n,{inputs:['','',''],threshold:2});
  if(type==='sum')Object.assign(n,{inputs:['',''],threshold:14});
  if(type==='terminal')n.outcome=kind;
  const first=!t.nodes.length;if(first)t.start=id;t.nodes.push(n);if(from)setFlow(from,source.slot,id);if(first||!t.nodes.some(isEnd))addEnd(t);
  commit(t,first?'First question added, with Start and the End heart.':from?'Step added and connected.':'Step added.');
  if(type!=='terminal'){nodePopup(id);const q=document.querySelector('.step-panel [name=label]');q?.focus();q?.select();}
}
window.addEventListener('resize',closeMenu);
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(document.querySelector('.add-menu')){closeMenu();return;}closePopup();pending=null;const help=document.querySelector('.editor-help');if(help)help.textContent=helpText;});
document.addEventListener('pointerdown',e=>{if(e.target.closest('.add-menu,.add-next,[data-editor="add"]'))return;closeMenu();if(e.target.closest('.graph-scroll')&&!e.target.closest('[data-card],.edge-hit,.port,.start-bubble'))closePopup();});
function field(label,name,value,type='text',extra=''){return `<label class="field"><span>${label}</span><input name="${name}" value="${esc(value)}" type="${type}" ${type==='number'?'step="any"':''}>${extra}</label>`;}
function options(nodes,value){return `<option value="">Not connected</option>`+nodes.map(n=>`<option value="${esc(n.id)}" ${n.id===value?'selected':''}>${esc(n.label)}</option>`).join('');}
function nodePopup(id,anchor){
  const t=context.tree,n=t.nodes.find(n=>n.id===id);select(id);
  if(isEnd(n)){popup(`<span class="eyebrow">End</span><h2>The heart</h2><p class="small muted">Every branch that reaches the heart is compatible. Connect as many branches here as you like. The End heart cannot be deleted.</p>`,anchor);return;}
  const binaryOrScalar=['boolean','scale'].includes(n.type);
  const html=`<span class="eyebrow">${question(n)?'Question':'Block'} settings</span><h2>${esc(TYPES[n.type])}</h2><form id="popup-form">${n.type==='terminal'?'':question(n)?`<label class="field"><span>Question</span><textarea name="label" rows="2" placeholder="${n.type==='boolean'?'Do you play Valorant?':n.type==='scale'?'How many hours a week do you exercise?':n.type==='text'?'We are at a restaurant and the order is wrong. What do you do?':'What does your ideal weekend look like?'}">${esc(n.label)}</textarea><small class="hint">Ask the person answering directly.</small></label>`:field('Label','label',n.label)}${question(n)?field('Answer ID','key',n.key,'text','<small class="hint">Questions with the same ID share one answer.</small>'):''}${binaryOrScalar?`<label class="field"><span>Question role</span><select name="mode"><option value="flow" ${n.mode!=='input'?'selected':''}>Branch on this answer</option><option value="input" ${n.mode==='input'?'selected':''}>Input for a block only</option></select><small class="hint">Both roles can supply values to blocks.</small></label>`:''}${n.type==='scale'?`<div class="rule-row">${field('Lowest allowed','min',n.min??'','number')}${field('Highest allowed','max',n.max??'','number')}</div><label class="inline-check"><input type="checkbox" name="integer" ${n.integer?'checked':''}> Whole numbers only</label><p class="hint">Leave a limit blank for no limit. Each branch takes values from its starting number up to the next branch.</p><div id="range-rows"></div><button type="button" id="add-range">Add branch</button>`:''}${n.type==='category'?`<div class="field"><span>Choices</span><div id="option-rows"></div><button type="button" id="add-option">Add choice</button></div>`:''}${['count','sum'].includes(n.type)?`<p class="small muted">${n.type==='count'?'Only yes / no questions can connect here.':'Only number questions can connect here. The sum must be strictly greater than the threshold.'}</p>${field(n.type==='count'?'Number of yes answers required':'Sum must be greater than','threshold',n.threshold,'number')}<label class="field"><span>Input slots</span><select name="slots">${Array.from({length:7},(_,i)=>i+2).map(i=>`<option ${n.inputs.length===i?'selected':''}>${i}</option>`).join('')}</select></label>${n.inputs.map((id,i)=>`<label class="field"><span>Input ${i+1} · ${n.type==='count'?'yes / no':'number'}</span><select name="input-${i}">${options(t.nodes.filter(q=>q.type===(n.type==='count'?'boolean':'scale')),id)}</select></label>`).join('')}`:''}${n.type==='hobbies'?'<p class="small muted">Checks profile hobbies using the local demo matcher.</p>':''}${n.type==='text'?'<p class="hint">They write a response of up to 1,000 characters. You read it in Review and approve it or not. Send "Not approved" to a Reject outcome to make it an instant reject.</p>':''}${['boolean','count','sum','hobbies','text'].includes(n.type)&&n.mode!=='input'?['yes','no'].map(k=>`<label class="field"><span>${n.type==='text'?(k==='yes'?'If approved':'If not approved'):'If '+k}</span><select name="${k}">${options(t.nodes.filter(q=>q.id!==n.id&&q.mode!=='input'),n[k])}</select></label>`).join(''):''}${n.type==='terminal'?`<label class="field"><span>Outcome</span><select name="outcome">${[['reject','Reject'],['friends','Friends']].map(([v,l])=>`<option value="${v}" ${n.outcome===v?'selected':''}>${l}</option>`).join('')}</select><small class="hint">Compatible branches connect to the End heart instead.</small></label>`:''}<p id="popup-error" class="error"></p><button type="submit" class="primary">Save changes</button></form><div class="actions" style="margin-top:18px"><button id="make-start" ${n.mode==='input'||t.start===n.id?'disabled':''}>Make start</button><button id="delete-node" class="danger">Delete step</button></div><details style="margin-top:16px"><summary>Step IDs</summary>${t.nodes.map(q=>`<p class="hint">${esc(q.id)} · ${esc(q.label)}</p>`).join('')}</details>`;
  const el=popup(html,anchor);
  if(n.type==='scale'){
    const container=el.querySelector('#range-rows');
    // The first branch always starts at the lowest value, so every answer lands in exactly one branch.
    const add=r=>{const row=document.createElement('div');row.className='range-row';const first=!container.children.length;row.innerHTML=`<div class="range-numbers">${first?'<span class="range-start">Lowest values</span>':`<label>From<input data-from type="number" step="any" value="${r.from??''}" required></label><button type="button" aria-label="Remove branch">×</button>`}</div><label>Continue to<select>${options(t.nodes.filter(q=>q.id!==id&&q.mode!=='input'),r.to)}</select></label>`;row.querySelector('button')?.addEventListener('click',()=>row.remove());container.append(row);};
    n.ranges.forEach(add);
    el.querySelector('#add-range').onclick=()=>{const froms=[...container.querySelectorAll('[data-from]')].map(i=>Number(i.value)).filter(Number.isFinite),base=froms.length?Math.max(...froms):Number(el.querySelector('[name=min]').value)||0;add({from:base+1,to:''});};
  }
  if(n.type==='category'){
    const container=el.querySelector('#option-rows');
    const add=o=>{const row=document.createElement('div');row.className='range-row';row.innerHTML=`<div class="range-numbers option-line"><label>Choice<input data-option value="${esc(o.value)}" required maxlength="120"></label><button type="button" aria-label="Remove choice">×</button></div><label>Continue to<select>${options(t.nodes.filter(q=>q.id!==id&&q.mode!=='input'),o.to)}</select></label>`;row.querySelector('button').onclick=()=>{if(container.children.length>2)row.remove();else context.notify('Keep at least two choices.');};container.append(row);};
    n.options.forEach(add);
    el.querySelector('#add-option').onclick=()=>add({value:'',to:''});
  }
  el.querySelector('#popup-form').onsubmit=e=>{
    e.preventDefault();const f=new FormData(e.target),draft=clone(t),node=draft.nodes.find(q=>q.id===id);
    try{
      node.label=String(f.get('label')).trim();if(question(node))node.key=String(f.get('key')).trim();
      if(binaryOrScalar)node.mode=f.get('mode');
      if(node.type==='scale'){const limit=v=>String(v).trim()===''?null:Number(v);node.min=limit(f.get('min'));node.max=limit(f.get('max'));node.integer=f.has('integer');node.ranges=[...el.querySelectorAll('.range-row')].map(row=>({from:row.querySelector('[data-from]')?Number(row.querySelector('[data-from]').value):null,to:row.querySelector('select').value})).sort((a,b)=>a.from===null?-1:b.from===null?1:a.from-b.from);}
      if(node.type==='category')node.options=[...el.querySelectorAll('.range-row')].map(row=>({value:row.querySelector('[data-option]').value.trim(),to:row.querySelector('select').value}));
      if(['count','sum'].includes(node.type)){node.threshold=Number(f.get('threshold'));node.inputs=Array.from({length:+f.get('slots')},(_,i)=>String(f.get('input-'+i)||''));}
      for(const k of ['yes','no','outcome'])if(f.has(k))node[k]=f.get(k);if(node.type==='terminal')node.label={friends:'Friends',reject:'Reject'}[node.outcome];
      commit(draft,'Step saved.');closePopup();
    }catch(e){el.querySelector('#popup-error').textContent=e.message;}
  };
  el.querySelector('#make-start').onclick=()=>{const draft=clone(t);draft.start=id;try{commit(draft,'Start updated.');closePopup();}catch(e){context.notify(e.message);}};
  el.querySelector('#delete-node').onclick=()=>{if(isEnd(n))return context.notify('The End heart stays.');if(t.start===id)return context.notify('Move Start to another step first.');const draft=clone(t);for(const edge of connections(draft))if(edge.from===id||edge.to===id)removeConnection(draft,edge);draft.nodes=draft.nodes.filter(q=>q.id!==id);commit(draft,'Step and its connections removed. Undo is available.');closePopup();};
}

function curve(start,end,kind='flow'){
  // Flow runs left to right; data drops from a question's bottom edge into a block's top slots.
  const bend=kind==='data'?Math.max(55,Math.min(180,Math.abs(end.y-start.y)*.48+Math.abs(end.x-start.x)*.12)):Math.max(55,Math.min(180,Math.abs(end.x-start.x)*.48+Math.abs(end.y-start.y)*.12));
  return kind==='data'
    ? 'M '+start.x+' '+start.y+' C '+start.x+' '+(start.y+bend)+', '+end.x+' '+(end.y-bend)+', '+end.x+' '+end.y
    : 'M '+start.x+' '+start.y+' C '+(start.x+bend)+' '+start.y+', '+(end.x-bend)+' '+end.y+', '+end.x+' '+end.y;
}
function drawWires(){
  const canvas=document.querySelector('.graph-canvas'),svg=canvas?.querySelector('svg');if(!svg)return;
  const origin=canvas.getBoundingClientRect(),nodes=new Map([...canvas.querySelectorAll('[data-card]')].map(el=>[el.dataset.card,el]));
  const center=el=>{const r=el.getBoundingClientRect();return {x:(r.left+r.width/2-origin.left)/zoom,y:(r.top+r.height/2-origin.top)/zoom};};
  const links=connections(context.tree);svg.innerHTML=links.map((e,i)=>{
    const source=nodes.get(e.from),target=nodes.get(e.to);if(!source||!target)return '';
    const out=source.querySelector(e.kind==='data'?'[data-value-out]':`[data-flow-out][data-slot="${e.index}"]`),input=target.querySelector(e.kind==='data'?`[data-data-in][data-slot="${e.index}"]`:'[data-flow-in]');if(!out||!input)return '';
    const d=curve(center(out),center(input),e.kind);
    return `<path class="edge-line ${e.kind}${selectedId&&(e.from===selectedId||e.to===selectedId)?' active':''}" d="${d}"/><path class="edge-hit" d="${d}" data-edge="${i}" tabindex="0" role="button" aria-label="Delete ${esc(e.label)} connection from ${esc(context.tree.nodes.find(n=>n.id===e.from).label)}"/>`;
  }).join('');
  // Start sits just left of the first question, centred on its input; its wire cannot be deleted, only moved.
  const bubble=canvas.querySelector('.start-bubble'),first=nodes.get(context.tree.start);
  const into=first?.querySelector('[data-flow-in]');if(bubble&&first&&into){bubble.style.top=Math.round(center(into).y-bubble.offsetHeight/2)+'px';bubble.style.left=Math.max(8,first.offsetLeft-120)+'px';const out=bubble.querySelector('[data-start-out]');if(out&&into)svg.insertAdjacentHTML('afterbegin',`<path class="edge-line flow start-line" d="${curve(center(out),center(into))}"/>`);}
  svg.querySelectorAll('[data-edge]').forEach(p=>{const open=()=>{const edge=links[Number(p.dataset.edge)];const el=popup(`<h2>Connection</h2><p class="small muted">${esc(context.tree.nodes.find(n=>n.id===edge.from).label)} → ${esc(context.tree.nodes.find(n=>n.id===edge.to).label)}</p><button id="remove-edge" class="danger" style="margin-top:16px">Delete edge</button>`);el.querySelector('#remove-edge').onclick=()=>{const t=clone(context.tree);removeConnection(t,edge);commit(t,'Edge deleted. Undo is available.');closePopup();};};p.onclick=open;p.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};});
}
window.addEventListener('resize',drawWires);
document.fonts?.ready.then(drawWires);
