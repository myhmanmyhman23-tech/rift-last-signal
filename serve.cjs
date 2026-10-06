// Optional local preview: node serve.cjs. The game also works via index.html.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/game.js':'game.js'};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8'};
let port=4173;
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  const file=files[pathname];if(!file){res.writeHead(404);res.end('Not found');return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  fs.readFile(path.join(__dirname,file),(error,data)=>{if(error){res.writeHead(500);res.end('Could not read game file');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);});
});
server.on('error',error=>{if(error.code==='EADDRINUSE'&&port<4183){port++;server.listen(port,'127.0.0.1');}else{console.error(error);process.exitCode=1;}});
server.on('listening',()=>console.log(`РАЗЛОМ: http://127.0.0.1:${port}`));
server.listen(port,'127.0.0.1');
