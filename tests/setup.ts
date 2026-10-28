import 'fake-indexeddb/auto';
import {webcrypto} from 'node:crypto';
import {vi} from 'vitest';
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
const local:Record<string,unknown>={},session:Record<string,unknown>={};
const area=(data:Record<string,unknown>)=>({get:vi.fn(async(k:string)=>({[k]:data[k]})),set:vi.fn(async(v:Record<string,unknown>)=>{Object.assign(data,v);}),remove:vi.fn(async(k:string)=>{delete data[k];}),setAccessLevel:vi.fn(async()=>{})});
Object.defineProperty(globalThis,'chrome',{configurable:true,value:{storage:{local:area(local),session:area(session)},runtime:{id:'test-extension',getURL:(s:string)=>'chrome-extension://test-extension/'+s,getContexts:vi.fn(async()=>[{contextType:'SIDE_PANEL',documentId:'doc',windowId:1,documentUrl:'chrome-extension://test-extension/sidepanel.html?instance=00000000-0000-4000-8000-000000000000'}])},windows:{get:vi.fn(async()=>({id:1,type:'normal',incognito:false}))},scripting:{executeScript:vi.fn(async()=>[])},tabs:{query:vi.fn(async()=>[]),get:vi.fn(async()=>({id:1,windowId:1,active:true,url:'https://example.com/a'})),sendMessage:vi.fn(async()=>({ok:true}))},webNavigation:{getFrame:vi.fn(async()=>({documentId:'page-doc',url:'https://example.com/a'}))}}});
Object.defineProperty(globalThis,'matchMedia',{value:()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}}),configurable:true});
