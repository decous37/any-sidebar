import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
const root=resolve('tests/fixtures');
createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));if(!path.startsWith(root+sep))throw Error();res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await readFile(path));}catch{res.statusCode=404;res.end('Not found');}}).listen(4173,'127.0.0.1');
