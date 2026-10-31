import {containQuestion,releaseQuestion} from './containers.js';
import {TYPES,clone,edges,validateTree} from './engine.js';
import {connections,inputsFor,layoutTree,setFlow,removeConnection,migrateTree} from './graph-model.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let context,zoom=.8,view='visual',pending=null,undo=null,ownerKey=null;
let cancelConnection=null;
const helpText='Scroll to zoom · drag to pan · drag dots to connect · click to edit';
const question=n=>['boolean','scale','category','text'].includes(n.type);
const group=n=>n.type==='boolean'?'binary':n.type==='scale'?'scalar':n.type==='category'?'choice':n.type==='text'?'open':['count','sum','hobbies'].includes(n.type)?'organization':'other';
const size=t=>({width:Math.max(1200,...t.nodes.map(n=>n.x+310)),height:Math.max(900,...t.nodes.map(n=>n.y+(['count','sum'].includes(n.type)?180+(n.inputs?.length||0)*65:300)))});
function marker(label,attributes,connected){return `<button type="button" class="port ${connected===null?'available':connected?'connected':'unconnected'}" ${attributes} aria-label="${esc(label)}" title="${esc(label)}">${connected===null?'○':connected?'✓':'!'}</button>`;}
export function editorMarkup(tree,key){
  if(ownerKey!==key){ownerKey=key;undo=null;pending=null;closePopup();}
  const {width,height}=size(tree),issues=validateTree(tree),links=connections(tree);
  return `<section class="graph-editor"><div class="editor-toolbar"><div class="tabs"><button data-editor="visual" class="${view==='visual'?'active':''}">Tree editor</button><button data-editor="advanced" class="${view==='advanced'?'active':''}">Advanced editor</button></div><div class="actions"><button data-editor="undo" ${!undo?'disabled':''}>Undo</button><button data-editor="cleanup">Tidy layout</button><span class="tool-sep"></span><div class="tool-group"><button data-editor="minus" aria-label="Zoom out">−</button><span class="small">${Math.round(zoom*100)}%</span><button data-editor="plus" aria-label="Zoom in">+</button><button data-editor="fit">Fit</button></div><span class="tool-sep"></span><button class="primary" data-editor="add">Add node</button></div></div><div class="editor-subbar"><label class="completion-setting" title="Explicit Reject or Friends outcomes remain final.">Accept at <input id="completion-threshold" type="number" min="1" max="100" step="1" value="${tree.completionThreshold??100}" aria-label="Tree completion threshold">% completion</label><div class="editor-help" role="status">${pending?'Select a compatible input dot to connect. Escape cancels.':helpText}</div></div>${view==='advanced'?`<div class="advanced"><textarea id="tree-json" class="code" aria-label="Tree JSON" spellcheck="false">${esc(JSON.stringify(tree,null,2))}</textarea><div class="actions"><button data-editor="apply" class="primary">Apply changes</button><button data-editor="import">Import tree</button><input id="tree-import" type="file" accept=".json" hidden></div><p id="editor-error" class="error"></p></div>`:`<div class="graph-scroll"><div class="graph-space" style="width:${width*zoom}px;height:${height*zoom}px"><div class="graph-canvas" style="width:${width}px;height:${height}px;transform:scale(${zoom})">${!tree.nodes.length?'<div class="empty-tree"><h2>Start your tree</h2><p>Add a question, then connect each answer to the next step or an outcome.</p><button class="primary" data-editor="add">Add first node</button></div>':''}<svg class="graph-wires" width="${width}" height="${height}"></svg>${tree.nodes.filter(n=>!tree.nodes.some(b=>['count','sum'].includes(b.type)&&b.inputs?.includes(n.id)&&n.mode==='input')).map(n=>{
    const inputs=inputsFor(n),flows=edges(n),dataUsed=links.some(e=>e.kind==='data'&&e.from===n.id);
    return `<article class="graph-node ${group(n)} ${['count','sum'].includes(n.type)?'count-container':''}" data-card="${esc(n.id)}" style="left:${n.x}px;top:${n.y}px" tabindex="0" aria-label="Edit ${esc(n.label)}">${n.mode!=='input'?`<div class="flow-in">${marker('Flow input: '+n.label,`data-flow-in="${esc(n.id)}"`,n.id===tree.start?null:links.some(e=>e.kind==='flow'&&e.to===n.id))}</div>`:''}<div class="node-inputs">${(n.type==='count'?[]:inputs).map((id,i)=>`<div class="input-slot">${marker(`Input ${i+1}: ${id?tree.nodes.find(q=>q.id===id)?.label:'not connected'} · ${n.type==='count'?'binary only':'scalar only'}`,`data-data-in="${esc(n.id)}" data-slot="${i}"`,!!id)}<span>${i+1}</span></div>`).join('')}</div><header><span>${n.type==='hobbies'?'Auto check':esc(TYPES[n.type])}</span><span>${tree.start===n.id?'START':'⋮⋮'}</span></header><div class="graph-node-title">${esc(n.type==='terminal'?{match:'Compatible',friends:'Friends',reject:'Reject'}[n.outcome]:n.label)}</div>${['count','sum'].includes(n.type)?`<div class="node-summary">${n.type==='count'?`At least ${n.threshold} of ${inputs.length} yes`:`Sum > ${n.threshold}`}</div>`:''}${['count','sum'].includes(n.type)?containerSlots(n,tree):''}${['boolean','scale'].includes(n.type)?`<div class="value-row">${marker('Value output: '+n.label+(dataUsed?'':' · optional, drag to a block'),`data-value-out="${esc(n.id)}"`,dataUsed?true:null)}</div>`:''}${flows.length?`<div class="flow-outputs">${flows.map((edge,i)=>`<div><span>${esc(edge.label)}</span>${marker(edge.label+': '+(edge.to?tree.nodes.find(q=>q.id===edge.to)?.label:'not connected'),`data-flow-out="${esc(n.id)}" data-slot="${i}"`,!!edge.to)}</div>`).join('')}</div>`:''}</article>`;
  }).join('')}</div></div></div>`}<footer class="editor-footer"><div class="type-legend"><span class="binary">Yes / no</span><span class="scalar">Number</span><span class="choice">Multiple choice</span><span class="open">Open-ended</span><span class="organization">Block</span></div><div class="actions"><span>${issues.length?'Draft · connections needed':'All connections valid'} · ${tree.nodes.length} nodes</span><button data-editor="clear" class="ghost danger">Clear tree</button></div></footer></section>`;
}
function commit(tree,message){const errors=validateTree(tree,{allowUnconnected:true});if(errors.length)throw Error(errors.join('\n'));pending=null;undo=clone(context.tree);refreshTree(tree);context.notify(message);}
export function mountEditor(tree,change,notify){
  context={tree,change,notify};
  if(!document.querySelector('.graph-editor'))return;
  document.querySelectorAll('[data-editor]').forEach(b=>b.onclick=()=>editorAction(b.dataset.editor));
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
      document.querySelector('.editor-toolbar .actions .small').textContent=Math.round(zoom*100)+'%';drawWires();
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
  document.querySelector('#completion-threshold').onchange=e=>{const value=Number(e.target.value);if(!Number.isInteger(value)||value<1||value>100){e.target.value=context.tree.completionThreshold??100;return notify('Choose a whole percentage from 1 to 100.');}const draft=clone(context.tree);draft.completionThreshold=value;commit(draft,'Completion threshold saved.');};
  requestAnimationFrame(drawWires);
}
function refreshTree(tree){
  const box=document.querySelector('.graph-scroll'),left=box?.scrollLeft||0,top=box?.scrollTop||0,pageX=window.scrollX,pageY=window.scrollY;
  context.change(tree);
  document.querySelector('.graph-scroll')?.scrollTo(left,top);window.scrollTo(pageX,pageY);
}
function redraw(){refreshTree(context.tree);}
function editorAction(action){
  try{
    if(['visual','advanced'].includes(action)){view=action;pending=null;closePopup();redraw();}
    else if(action==='plus'||action==='minus'){zoom=Math.max(.3,Math.min(1.5,zoom+(action==='plus'?.1:-.1)));redraw();}
    else if(action==='fit'){fit();}
    else if(action==='clear'){const el=popup('<h2>Clear this tree?</h2><p>Remove every node and connection from this tree. You can Undo immediately afterward.</p><div class="actions" style="margin-top:16px"><button id="cancel-clear">Cancel</button><button id="confirm-clear" class="danger">Clear all nodes</button></div>');el.querySelector('#cancel-clear').onclick=closePopup;el.querySelector('#confirm-clear').onclick=()=>{commit({start:'',nodes:[]},'Tree cleared. Undo is available.');closePopup();};}
    else if(action==='cleanup'){if(!context.tree.nodes.length)return;const t=clone(context.tree);layoutTree(t,{heights:Object.fromEntries([...document.querySelectorAll('[data-card]')].map(el=>[el.dataset.card,el.offsetHeight]))});commit(t,'Tree arranged. Use Fit to see the whole tree.');}
    else if(action==='undo'&&undo){const t=undo;undo=null;refreshTree(t);context.notify('Previous tree restored.');}
    else if(action==='add')addPopup();
    else if(action==='apply'){const t=migrateTree(JSON.parse(document.querySelector('#tree-json').value));commit(t,'Tree applied.');}
    else if(action==='import'){const input=document.querySelector('#tree-import');input.onchange=async()=>{const file=input.files[0];if(file?.size>200000)return context.notify('Choose a file under 200 KB.');if(file)document.querySelector('#tree-json').value=await file.text();};input.click();}
  }catch(e){const box=document.querySelector('#editor-error');if(box)box.textContent=e.message;else context.notify(e.message);}
}
function fit(){const box=document.querySelector('.graph-scroll');if(!box)return;const bounds=size(context.tree);zoom=Math.max(.3,Math.min(1,box.clientWidth/bounds.width,box.clientHeight/bounds.height));redraw();}
function draftConnection(source,p){
  const t=clone(context.tree);
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
  const source=port.dataset.flowOut?{kind:'flow',from:port.dataset.flowOut,index:Number(port.dataset.slot)}:port.dataset.valueOut?{kind:'data',from:port.dataset.valueOut}:null;
  if(!source)return;
  event.preventDefault();cancelConnection?.();closePopup();pending=null;
  const canvas=document.querySelector('.graph-canvas'),svg=canvas.querySelector('svg'),scroll=document.querySelector('.graph-scroll');
  const valid=[...canvas.querySelectorAll(source.kind==='flow'?'[data-flow-in]':'[data-data-in]')].filter(p=>{try{draftConnection(source,p);return true;}catch{return false;}});
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
  if(p.dataset.flowOut){pending={kind:'flow',from:p.dataset.flowOut,index:Number(p.dataset.slot)};document.querySelector('.editor-help').textContent='Select a flow input at the top-left of a node. Escape cancels.';return;}
  if(p.dataset.valueOut){pending={kind:'data',from:p.dataset.valueOut};document.querySelector('.editor-help').textContent='Select a numbered input on a matching block. Escape cancels.';return;}
  if(!pending)return context.notify('Choose an output dot first.');
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
function closePopup(){document.querySelector('.node-popup')?.remove();}
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
function popupBounds(){
  const r=document.querySelector('.graph-editor')?.getBoundingClientRect();
  return {left:Math.max(8,r?.left||8)+8,right:Math.min(window.innerWidth-8,r?.right||window.innerWidth-8)-8,top:Math.max(8,r?.top||8)+8,bottom:Math.min(window.innerHeight-8,r?.bottom||window.innerHeight-8)-8};
}
function fitPopup(el,left,top){
  const b=popupBounds();el.style.width=Math.max(180,Math.min(350,b.right-b.left))+'px';el.style.maxHeight=Math.max(100,b.bottom-b.top)+'px';
  const r=el.getBoundingClientRect();el.style.left=Math.max(b.left,Math.min(left,b.right-r.width))+'px';el.style.top=Math.max(b.top,Math.min(top,b.bottom-r.height))+'px';
}
function popup(html,anchor){
  closePopup();const el=document.createElement('section');el.className='node-popup';el.setAttribute('role','dialog');el.setAttribute('aria-label','Node settings');el.innerHTML='<div class="popup-drag" title="Drag to move settings">Settings <span>⋮⋮</span><button class="popup-close" aria-label="Close settings">×</button></div><div class="popup-body">'+html+'</div>';document.body.append(el);
  const rect=anchor?.getBoundingClientRect(),b=popupBounds();
  const left=rect?(rect.right+362<=b.right?rect.right+12:rect.left-362>=b.left?rect.left-362:rect.right+12):b.right-350;
  fitPopup(el,left,rect?.top||b.top);
  const handle=el.querySelector('.popup-drag');handle.onpointerdown=e=>{
    if(e.button!==0||e.target.closest('button'))return;e.preventDefault();
    const r=el.getBoundingClientRect(),x=e.clientX,y=e.clientY;handle.setPointerCapture(e.pointerId);
    handle.onpointermove=p=>fitPopup(el,r.left+p.clientX-x,r.top+p.clientY-y);
    const end=()=>{handle.onpointermove=null;handle.onpointerup=null;handle.onpointercancel=null;if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);};handle.onpointerup=end;handle.onpointercancel=end;
  };
  el.querySelector('.popup-close').onclick=closePopup;el.querySelector('.popup-close').focus({preventScroll:true});return el;
}
window.addEventListener('resize',()=>{const el=document.querySelector('.node-popup');if(el){const r=el.getBoundingClientRect();fitPopup(el,r.left,r.top);}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePopup();pending=null;const help=document.querySelector('.editor-help');if(help)help.textContent=helpText;}});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.node-popup')&&!e.target.closest('[data-card]')&&!e.target.closest('.edge-hit'))closePopup();});
function field(label,name,value,type='text',extra=''){return `<label class="field"><span>${label}</span><input name="${name}" value="${esc(value)}" type="${type}" ${type==='number'?'step="any"':''}>${extra}</label>`;}
function options(nodes,value){return `<option value="">Not connected</option>`+nodes.map(n=>`<option value="${esc(n.id)}" ${n.id===value?'selected':''}>${esc(n.label)}</option>`).join('');}
function nodePopup(id,anchor){
  const t=context.tree,n=t.nodes.find(n=>n.id===id);
  const binaryOrScalar=['boolean','scale'].includes(n.type);
  const html=`<span class="eyebrow">${question(n)?'Question':'Block'} settings</span><h2>${esc(TYPES[n.type])}</h2><form id="popup-form">${n.type==='terminal'?'':question(n)?`<label class="field"><span>Question</span><input name="label" value="${esc(n.label)}" placeholder="${n.type==='boolean'?'Do you play Valorant?':n.type==='scale'?'How many hours a week do you exercise?':n.type==='text'?'We are at a restaurant and the order is wrong. What do you do?':'What does your ideal weekend look like?'}"><small class="hint">Ask the person answering directly.</small></label>`:field('Label','label',n.label)}${question(n)?field('Answer ID','key',n.key,'text','<small class="hint">Questions with the same ID share one answer.</small>'):''}${binaryOrScalar?`<label class="field"><span>Question role</span><select name="mode"><option value="flow" ${n.mode!=='input'?'selected':''}>Branch on this answer</option><option value="input" ${n.mode==='input'?'selected':''}>Input for a block only</option></select><small class="hint">Both roles can supply values to blocks.</small></label>`:''}${n.type==='scale'?`<div class="rule-row">${field('Lowest allowed','min',n.min??'','number')}${field('Highest allowed','max',n.max??'','number')}</div><label class="inline-check"><input type="checkbox" name="integer" ${n.integer?'checked':''}> Whole numbers only</label><p class="hint">Leave a limit blank for no limit. Each branch takes values from its starting number up to the next branch.</p><div id="range-rows"></div><button type="button" id="add-range">Add branch</button>`:''}${n.type==='category'?`<div class="field"><span>Choices</span><div id="option-rows"></div><button type="button" id="add-option">Add choice</button></div>`:''}${['count','sum'].includes(n.type)?`<p class="small muted">${n.type==='count'?'Only yes / no questions can connect here.':'Only number questions can connect here. The sum must be strictly greater than the threshold.'}</p>${field(n.type==='count'?'Number of yes answers required':'Sum must be greater than','threshold',n.threshold,'number')}<label class="field"><span>Input slots</span><select name="slots">${Array.from({length:7},(_,i)=>i+2).map(i=>`<option ${n.inputs.length===i?'selected':''}>${i}</option>`).join('')}</select></label>${n.inputs.map((id,i)=>`<label class="field"><span>Input ${i+1} · ${n.type==='count'?'yes / no':'number'}</span><select name="input-${i}">${options(t.nodes.filter(q=>q.type===(n.type==='count'?'boolean':'scale')),id)}</select></label>`).join('')}`:''}${n.type==='hobbies'?'<p class="small muted">Checks profile hobbies using the local demo matcher.</p>':''}${n.type==='text'?'<p class="hint">They write a response of up to 1,000 characters. You read it in Review and approve it or not. Send "Not approved" to a Reject outcome to make it an instant reject.</p>':''}${['boolean','count','sum','hobbies','text'].includes(n.type)&&n.mode!=='input'?['yes','no'].map(k=>`<label class="field"><span>${n.type==='text'?(k==='yes'?'If approved':'If not approved'):'If '+k}</span><select name="${k}">${options(t.nodes.filter(q=>q.id!==n.id&&q.mode!=='input'),n[k])}</select></label>`).join(''):''}${n.type==='terminal'?`<label class="field"><span>Outcome</span><select name="outcome">${['match','friends','reject'].map(v=>`<option ${n.outcome===v?'selected':''}>${v}</option>`).join('')}</select></label>`:''}<p id="popup-error" class="error"></p><button type="submit" class="primary">Save changes</button></form><div class="actions" style="margin-top:18px"><button id="make-start" ${n.mode==='input'||t.start===n.id?'disabled':''}>Make start</button><button id="delete-node" class="danger">Delete node</button></div><details style="margin-top:16px"><summary>Node IDs</summary>${t.nodes.map(q=>`<p class="hint">${esc(q.id)} · ${esc(q.label)}</p>`).join('')}</details>`;
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
      for(const k of ['yes','no','outcome'])if(f.has(k))node[k]=f.get(k);if(node.type==='terminal')node.label={match:'Compatible',friends:'Friends',reject:'Reject'}[node.outcome];
      commit(draft,'Node saved.');closePopup();
    }catch(e){el.querySelector('#popup-error').textContent=e.message;}
  };
  el.querySelector('#make-start').onclick=()=>{const draft=clone(t);draft.start=id;try{commit(draft,'Start updated.');closePopup();}catch(e){context.notify(e.message);}};
  el.querySelector('#delete-node').onclick=()=>{if(t.start===id)return context.notify('Choose another start node first.');const draft=clone(t);for(const edge of connections(draft))if(edge.from===id||edge.to===id)removeConnection(draft,edge);draft.nodes=draft.nodes.filter(q=>q.id!==id);commit(draft,'Node and its edges removed. Undo is available.');closePopup();};
}
function addPopup(){
  const el=popup('<h2>Add a question or block</h2><div class="addtypes">'+Object.entries(TYPES).map(([type,label])=>`<button data-new="${type}">${label}<small>${({boolean:'They answer yes or no',scale:'They type a number; you route by its value',category:'They pick one of your choices',text:'They write a response; you approve it or not',count:'Combine yes / no answers: at least N must be yes',sum:'Add number answers and compare the total',hobbies:'Compare both people’s hobby lists',terminal:'End the path: compatible, friends or reject'})[type]}</small></button>`).join('')+'</div>');
  el.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>{
    const type=b.dataset.new,t=clone(context.tree),id='node_'+Date.now().toString(36),viewport=document.querySelector('.graph-scroll'),n={id,type,label:TYPES[type],x:Math.max(30,Math.round(((viewport?.scrollLeft||0)+(viewport?.clientWidth||500)/2)/zoom-130)),y:Math.max(50,Math.round(((viewport?.scrollTop||0)+(viewport?.clientHeight||400)/2)/zoom-80))};
    if(question(n))n.key=id;
    if(['boolean','count','sum','hobbies','text'].includes(type)){n.yes='';n.no='';}
    if(type==='scale')Object.assign(n,{min:0,max:null,integer:false,ranges:[{from:null,to:''},{from:5,to:''}]});
    if(type==='category')n.options=[{value:'Choice A',to:''},{value:'Choice B',to:''}];
    if(type==='count')Object.assign(n,{inputs:['','',''],threshold:2});
    if(type==='sum')Object.assign(n,{inputs:['',''],threshold:14});
    if(type==='terminal'){n.outcome='match';n.label='Compatible';}if(!t.nodes.length)t.start=id;t.nodes.push(n);commit(t,'Node added.');closePopup();nodePopup(id,document.querySelector(`[data-card="${id}"]`));
  });
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
    return `<path class="edge-line ${e.kind}" d="${d}"/><path class="edge-hit" d="${d}" data-edge="${i}" tabindex="0" role="button" aria-label="Delete ${esc(e.label)} connection from ${esc(context.tree.nodes.find(n=>n.id===e.from).label)}"/>`;
  }).join('');
  svg.querySelectorAll('[data-edge]').forEach(p=>{const open=()=>{const edge=links[Number(p.dataset.edge)];const el=popup(`<h2>Connection</h2><p class="small muted">${esc(context.tree.nodes.find(n=>n.id===edge.from).label)} → ${esc(context.tree.nodes.find(n=>n.id===edge.to).label)}</p><button id="remove-edge" class="danger" style="margin-top:16px">Delete edge</button>`);el.querySelector('#remove-edge').onclick=()=>{const t=clone(context.tree);removeConnection(t,edge);commit(t,'Edge deleted. Undo is available.');closePopup();};};p.onclick=open;p.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};});
}
window.addEventListener('resize',drawWires);
document.fonts?.ready.then(drawWires);
