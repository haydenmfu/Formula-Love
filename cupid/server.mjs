import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {createStore} from './backend/store.mjs';
import {apiHandler} from './backend/api.mjs';
import {fileURLToPath} from 'node:url';
import {extname,relative,resolve,sep} from 'node:path';
import {spawn} from 'node:child_process';
const root=fileURLToPath(new URL('./dist/',import.meta.url));
await mkdir(new URL('./data/',import.meta.url),{recursive:true});
const store=createStore(process.env.CUPID_DB||fileURLToPath(new URL('./data/cupid.sqlite',import.meta.url)));
const api=apiHandler(store);
const port=Number(process.env.PORT??4173);
if(!Number.isInteger(port)||port<0||port>65535){console.error('PORT must be a number between 0 and 65535.');process.exit(1);}
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  if(await api(req,res))return;
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});return res.end('Method not allowed');}
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(root,'.'+(path==='/'?'/index.html':path)),rel=relative(root,file);
    if(rel==='..'||rel.startsWith('..'+sep)){res.writeHead(403);return res.end('Forbidden');}
    const content=await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:content);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. If Formula:Love is running, open http://127.0.0.1:${port}/. Otherwise stop the other server or set PORT to another number.`:error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
  const url=`http://127.0.0.1:${server.address().port}/`;
  console.log(`Formula:Love ready at ${url}\nKeep this window open. Press Ctrl+C to stop.\nAccounts and trees are saved in cupid/data/cupid.sqlite.`);
  if(process.argv.includes('--open')){
    const command=process.platform==='win32'?'rundll32.exe':process.platform==='darwin'?'open':'xdg-open';
    const child=spawn(command,process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url],{stdio:'ignore',windowsHide:true});
    child.on('error',()=>console.log(`Open ${url} in your browser.`));child.unref();
  }
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
