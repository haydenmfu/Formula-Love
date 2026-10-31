export function apiHandler(store){
 const attempts=new Map();
 return async(req,res)=>{
 const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/api/'))return false;
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 try{
 if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)throw Object.assign(Error('Cross-origin requests are not allowed.'),{status:403});
 let body={};if(['POST','PUT'].includes(req.method)){if(!req.headers['content-type']?.startsWith('application/json'))throw Object.assign(Error('JSON required.'),{status:415});let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>250000)throw Object.assign(Error('Request too large.'),{status:413});}try{body=JSON.parse(text);}catch{throw Object.assign(Error('Invalid JSON.'),{status:400});}if(!body||typeof body!=='object')throw Object.assign(Error('Object required.'),{status:400});}
 const route=req.method+' '+url.pathname;
 if(['POST /api/register','POST /api/login'].includes(route)){const key=req.socket.remoteAddress,now=Date.now(),recent=(attempts.get(key)||[]).filter(t=>now-t<60000);if(recent.length>=15)throw Object.assign(Error('Try again in a minute.'),{status:429});recent.push(now);attempts.set(key,recent);send(200,route.endsWith('register')?store.register(body):store.login(body));return true;}
 const token=req.headers.authorization?.replace(/^Bearer /,''),id=store.authenticate(token);if(!id){send(401,{error:'Sign in first.'});return true;}
 let result;
 switch(route){
 case 'POST /api/logout':store.logout(token);result={ok:true};break;
 case 'GET /api/me':result=store.me(id);break;
 case 'PUT /api/profile':result=store.saveProfile(id,body);break;
 case 'PUT /api/tree':result=store.saveTree(id,body);break;
 case 'GET /api/questions':result=store.questions(id,url.searchParams.get('owner'));break;
 case 'POST /api/answers':result=store.answer(id,body.token,body.value);break;
 case 'GET /api/matches':result=store.matches(id);break;
 case 'GET /api/paths':result=store.paths(id);break;
 case 'GET /api/visitors':result=store.visitors(id);break;
 case 'GET /api/responses/sent':result=store.sentResponses(id);break;
 case 'GET /api/responses/inbox':result=store.inbox(id);break;
 case 'POST /api/responses/decide':result=store.decide(id,body.id,body.approve);break;
 case 'POST /api/block':result=store.block(id,body.userId);break;
 case 'POST /api/report':result=store.report(id,body.userId,body.reason);break;
 default:send(404,{error:'Unknown API route.'});return true;
 }send(200,result);
 }catch(e){send(e.status||500,{error:e.status?e.message:'Unable to complete request.'});if(!e.status)console.error(e);}
 return true;
 };
}
