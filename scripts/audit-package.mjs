import {readdir,readFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
export async function audit(root='dist'){
 const files=[];async function walk(dir,prefix=''){for(const name of await readdir(dir)){const f=join(dir,name),rel=prefix+name;if((await stat(f)).isDirectory())await walk(f,rel+'/');else files.push(rel);}}await walk(root);
 const pkg=JSON.parse(await readFile('package.json','utf8'));const m=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
 if(m.version!==pkg.version||m.manifest_version!==3||m.minimum_chrome_version!=='142')throw Error('版本或清单不一致');
 if(JSON.stringify([...m.permissions].sort())!==JSON.stringify(['sidePanel','storage','scripting','activeTab','webNavigation'].sort()))throw Error('权限不符合设计');
 if(JSON.stringify(m.host_permissions)!==JSON.stringify(['http://*/*','https://*/*']))throw Error('网页读取权限不正确');
 for(const f of ['manifest.json','sidepanel.html','background.js','content.js','privacy.html','icons/icon-16.png','icons/icon-32.png','icons/icon-48.png','icons/icon-128.png'])if(!files.includes(f))throw Error('缺少 '+f);
 for(const f of files){if(!/^(manifest\.json|sidepanel\.html|background\.js|content\.js|privacy\.html|icons\/icon-(16|32|48|128)\.png|assets\/[A-Za-z0-9_-]+\.(js|css))$/.test(f))throw Error('非白名单文件 '+f);if(/\.(js|css|html|json)$/.test(f)){const text=await readFile(join(root,f),'utf8');if(/\beval\s*\(|new\s+Function\s*\(|https?:\/\/localhost|TEST_ONLY|__TEST|\/Users\//.test(text))throw Error('发现开发或动态代码风险 '+f);if(/\bsk-[a-zA-Z0-9]{20,}/.test(text))throw Error('疑似密钥 '+f);}}
 const html=await readFile(join(root,'sidepanel.html'),'utf8');for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){const path=match[1].replace(/^\.\//,'');if(!files.includes(path))throw Error('入口资源缺失 '+path);}
 return {version:m.version,files:files.sort(),limitations:'静态审计不能代替运行时网络和凭据隔离验证'};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve('scripts/audit-package.mjs'))console.log(JSON.stringify(await audit(),null,2));
