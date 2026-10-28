import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {zipSync} from 'fflate';
import {audit} from './audit-package.mjs';
import {createHash} from 'node:crypto';
const result=await audit();const input={};for(const f of result.files)input[f]=new Uint8Array(await readFile('dist/'+f));for(const f of ['LICENSE','THIRD_PARTY_NOTICES.txt'])input[f]=new Uint8Array(await readFile(f));const zip=zipSync(input,{level:9});await mkdir('release',{recursive:true});const name=`release/any-sidebar-${result.version}.zip`;await writeFile(name,zip);console.log(JSON.stringify({file:name,bytes:zip.length,sha256:createHash('sha256').update(zip).digest('hex')}));
