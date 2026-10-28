import {envelope,string,integer,draftChange,preferencePatch,permitValue,object} from '../shared/validation';
import {Fault,safeError,type PanelOwner,type Quote,type AppError} from '../shared/types';
import type {Envelope,Update} from '../shared/protocol';
import * as browser from './browser';
import * as sessions from './sessions';
import * as requests from './requests';
import * as settings from './settings';
import {openDatabase} from './database';
const ports=new Set<chrome.runtime.Port>();
export function broadcast(update:Update={event:'changed'}){for(const p of ports)try{p.postMessage(update);}catch{ports.delete(p);}}
export async function owners():Promise<Record<string,PanelOwner>>{return ((await chrome.storage.session.get('owners')).owners??{}) as Record<string,PanelOwner>;}
export async function alive(owner:PanelOwner){const contexts=await chrome.runtime.getContexts({documentIds:[owner.documentId]});return contexts.some(c=>c.contextType==='SIDE_PANEL'&&c.documentUrl?.startsWith(chrome.runtime.getURL('sidepanel.html')+'?instance='));}
async function trusted(sender:chrome.runtime.MessageSender){if(sender.id!==chrome.runtime.id||!sender.url)throw new Fault('INVALID_MESSAGE','调用来源不受支持。');const url=new URL(sender.url);if(url.protocol!=='chrome-extension:'||url.hostname!==chrome.runtime.id||url.pathname!=='/sidepanel.html'||!/^[-a-f0-9]{36}$/.test(url.searchParams.get('instance')??''))throw new Fault('INVALID_MESSAGE','侧栏来源不正确。');const contexts=await chrome.runtime.getContexts({documentUrls:[sender.url]});if(contexts.length!==1||contexts[0].contextType!=='SIDE_PANEL'||!contexts[0].documentId)throw new Fault('INVALID_MESSAGE','请从Chrome原生侧边栏使用插件。');if(sender.documentId&&sender.documentId!==contexts[0].documentId)throw new Fault('INVALID_MESSAGE','侧栏文档身份不一致。');return contexts[0];}
export async function registerPanel(sender:chrome.runtime.MessageSender,windowId:number){const ctx=await trusted(sender);const win=await chrome.windows.get(windowId);if(win.incognito||win.type!=='normal'||(ctx.windowId>=0&&ctx.windowId!==windowId))throw new Fault('INVALID_MESSAGE','侧栏窗口身份不一致。');const list=await owners();for(const o of Object.values(list))if(o.open&&!await alive(o))o.open=false;await requests.recover(new Set(Object.values(list).filter(o=>o.open).map(o=>o.id)));const old=Object.values(list).find(o=>o.documentId===ctx.documentId&&o.open);if(old)return old;const owner:PanelOwner={id:crypto.randomUUID(),documentId:ctx.documentId!,windowId,open:true,registeredAt:Date.now()};list[owner.id]=owner;await chrome.storage.session.set({owners:list});return owner;}
export async function closePanel(ownerId:string){const list=await owners();const owner=list[ownerId];if(!owner)return;owner.open=false;await chrome.storage.session.set({owners:list});const bindings=await browser.allBindings();if(bindings[ownerId])await browser.deactivateBinding(bindings[ownerId].id);const owned=await (await openDatabase()).getAllFromIndex('requests','ownerId',ownerId);await requests.recover(new Set(Object.values(list).filter(o=>o.open).map(o=>o.id)));for(const r of owned)broadcast({event:'cancel',requestId:r.id});}
export async function refreshWindows(windowId?:number){for(const o of Object.values(await owners()))if(o.open&&(windowId===undefined||o.windowId===windowId)&&await alive(o)){await browser.resolveBinding(o);broadcast({event:'binding'});}}
export async function route(m:Envelope,sender:chrome.runtime.MessageSender){const args=m.args;if(m.command==='registerPanel')return registerPanel(sender,integer(args.windowId));const source=await trusted(sender);const ownerId=string(args.ownerId);const owner=(await owners())[ownerId];if(!owner||!owner.open||owner.documentId!==source.documentId||!await alive(owner))throw new Fault('OWNER_CLOSED','侧边栏实例已关闭，请重新打开。');const op={ownerId,operationId:m.operationId};const prefs=await settings.getPreferences();const permit=()=>{const p=permitValue(args.permit);if(p.ownerId!==ownerId)throw new Fault('INVALID_MESSAGE','请求所有者不一致。');return p;};
 switch(m.command){
 case 'getActiveBinding':{const b=(await browser.allBindings())[ownerId];return b&&b.readingStatus!=='failed'&&await browser.isBindingCurrent(b)?b:browser.resolveBinding(owner);}
 case 'readArticle':{const b=(await browser.allBindings())[ownerId];if(!b)throw new Fault('PAGE_CHANGED','网页尚未就绪。');return browser.read(b);}
 case 'getView':{const b=(await browser.allBindings())[ownerId]??await browser.resolveBinding(owner);const s=args.sessionId?{id:string(args.sessionId)}:await sessions.openSession(b);return sessions.getView(s.id,prefs.quoteMode,args.beforeOrder===undefined||args.beforeOrder===null?null:integer(args.beforeOrder),args.limit===undefined?50:integer(args.limit));}
 case 'changeDraft':return sessions.changeDraft(string(args.sessionId),integer(args.expectedRevision),draftChange(args.change),op);
 case 'prepare':{const b=(await browser.allBindings())[ownerId];if(!b||b.id!==args.bindingId)throw new Fault('PAGE_CHANGED','当前网页已变化。');try{return await requests.prepare(string(args.sessionId),integer(args.expectedRevision),b,op,()=>alive(owner));}finally{broadcast();}}
 case 'begin':return requests.begin(permit());
 case 'append':{const d=object(args.delta);return requests.append(permit(),{sequence:integer(d.sequence),answerDelta:string(d.answerDelta),reasoningDelta:string(d.reasoningDelta)});}
 case 'finish':return requests.finish(permit(),string(args.reason));
 case 'fail':{const e=object(args.error);const allowed=['CREDENTIAL_REQUIRED','AUTH_FAILED','INSUFFICIENT_BALANCE','RATE_LIMITED','NETWORK_ERROR','API_ERROR','API_BAD_RESPONSE','CONTEXT_TOO_LARGE','STORAGE_FAILED'];if(!allowed.includes(string(e.code)))throw new Fault('INVALID_ARGUMENT','错误类型不正确。');const labels:Record<string,string>={CREDENTIAL_REQUIRED:'Key已清除，请先在设置中配置。',AUTH_FAILED:'Key无效，请修改设置。',INSUFFICIENT_BALANCE:'余额不足，请检查DeepSeek账户。',RATE_LIMITED:'请求过于频繁，请稍后手动重试。',NETWORK_ERROR:'网络连接中断或超时，可手动重试。',API_ERROR:'官方API暂时不可用，请稍后手动重试。',API_BAD_RESPONSE:'回答未正常完成，可手动重试。',CONTEXT_TOO_LARGE:'官方API拒绝了上下文长度，请减少上下文。',STORAGE_FAILED:'本机保存失败，请检查可用空间。'};return requests.fail(permit(),{code:e.code as AppError['code'],message:labels[e.code as string],retryable:true});}
 case 'stop':{const id=string(args.requestId);await requests.stop(id);broadcast({event:'cancel',requestId:id});return null;}
 case 'regenerateLastTurn':return requests.regenerateLastTurn(string(args.sessionId),string(args.turnId),op);
 case 'retryLastTurn':return requests.retryLastTurn(string(args.sessionId),string(args.turnId),op);
 case 'restoreSubmission':return requests.restoreSubmission(string(args.requestId),integer(args.expectedRevision),op);
 case 'getPreferences':return prefs;
 case 'savePreferences':return settings.savePreferences(integer(args.expectedRevision),preferencePatch(args.patch));
 case 'getStatus':return settings.getStatus();
 case 'setKey':return settings.setKey(args.value===null?null:string(args.value));
 case 'readForRequest':return settings.readForRequest(permit());
 case 'clearCurrent':case 'clearAll':{const result=await sessions.clearSessions(m.command==='clearCurrent'?string(args.sessionId):null,op);for(const id of result.cancelledRequestIds)broadcast({event:'cancel',requestId:id});return result;}
 case 'closePanel':return closePanel(ownerId);
 }}
export function connect(port:chrome.runtime.Port,ready:Promise<void>=Promise.resolve()){if(port.name!=='page-chat-panel')return;ports.add(port);port.onDisconnect.addListener(()=>ports.delete(port));port.onMessage.addListener((raw:unknown)=>{void (async()=>{let m:Envelope|undefined;try{await ready;m=envelope(raw);const data=await route(m,port.sender??{});port.postMessage({messageId:m.messageId,ok:true,data});if(!['getView','getActiveBinding','readArticle','getPreferences','getStatus','readForRequest'].includes(m.command))broadcast();}catch(e){try{port.postMessage({messageId:m?.messageId??'',ok:false,error:safeError(e)});}catch{ports.delete(port);}}})();});}
let captureQueue:Promise<unknown>=Promise.resolve();
export function acceptCapture(raw:unknown,sender:chrome.runtime.MessageSender){const result=captureQueue.then(()=>acceptCaptured(raw,sender));captureQueue=result.catch(()=>{});return result;}
async function acceptCaptured(raw:unknown,sender:chrome.runtime.MessageSender){
 const msg=object(raw);if(!['quote','selection-cleared'].includes(String(msg.target))||sender.id!==chrome.runtime.id||sender.frameId!==0||!sender.tab?.id||!sender.documentId)return;
 const isClear=msg.target==='selection-cleared';const q=isClear?null:object(msg.quote);
 if(q){for(const k of ['id','bindingId','pageKey','sourceUrl','sourceTitle','text'])string(q[k]);integer(q.selectedAt);}
 const bindingId=string(isClear?msg.bindingId:q!.bindingId);
 for(const b of Object.values(await browser.allBindings()))if(b.tabId===sender.tab.id&&b.documentId===sender.documentId&&b.id===bindingId){
  const o=(await owners())[b.ownerId];if(!o?.open||!await alive(o)||!await browser.isBindingCurrent(b))return;
  const mode=(await settings.getPreferences()).quoteMode;
  if(isClear)await sessions.clearSelection(b,string(msg.quoteId),mode,{operationId:string(msg.operationId),ownerId:o.id});
  else await sessions.acceptQuote(b,q as unknown as Quote,mode,{operationId:string(q!.id),ownerId:o.id});
  broadcast();return;
 }
}
export async function startup(){await settings.initialize();const list=await owners();for(const o of Object.values(list))if(o.open&&!await alive(o))o.open=false;await chrome.storage.session.set({owners:list});await requests.recover(new Set(Object.values(list).filter(o=>o.open).map(o=>o.id)));}
