import type {PageBinding,Quote} from '../shared/types';
const sensitive='input,textarea,select,button,[contenteditable]:not([contenteditable="false"])';
export function uuid():string {if(crypto.randomUUID)return crypto.randomUUID();const a=crypto.getRandomValues(new Uint8Array(16));a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;return Array.from(a,(x,i)=>([4,6,8,10].includes(i)?'-':'')+x.toString(16).padStart(2,'0')).join('');}
export function selectionText(doc:Document):string|null {const s=doc.getSelection();if(!s?.rangeCount||s.isCollapsed||!s.toString().trim())return null;const range=s.getRangeAt(0);for(const node of [range.startContainer,range.endContainer]){const el=node instanceof Element?node:node.parentElement;if(el?.closest(sensitive))return null;}for(const el of doc.querySelectorAll(sensitive))if(range.intersectsNode(el))return null;return s.toString().trim();}
// Retain identity across a same-document binding refresh, so deselecting can
// remove only the quote that came from this selection.
let lastSelection:{id:string;text:string;url:string}|null=null;
export function startSelection(binding:PageBinding,emit:(q:Quote)=>void,clear:(quoteId:string)=>void=()=>{}):()=>void {
 let timer:ReturnType<typeof setTimeout>|undefined;let active=true;
 if(lastSelection?.url!==binding.url)lastSelection=null;
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>{
  if(!active||location.href!==binding.url)return;
  const text=selectionText(document);
  if(!text){if(lastSelection){clear(lastSelection.id);lastSelection=null;}return;}
  if(lastSelection?.text===text)return;
  const id=uuid();lastSelection={id,text,url:binding.url};
  emit({id,bindingId:binding.id,pageKey:binding.pageKey,sourceUrl:binding.url,sourceTitle:document.title,text,selectedAt:Date.now()});
 },80);};
 // Add on completion only; selectionchange handles cancellation without adding
 // intermediate fragments while the user is still dragging.
 const changed=()=>{if(!selectionText(document))schedule();};
 const key=(e:KeyboardEvent)=>{if(e.key==='Shift'||e.shiftKey)schedule();};
 document.addEventListener('pointerup',schedule);document.addEventListener('keyup',key);document.addEventListener('selectionchange',changed);
 return()=>{active=false;clearTimeout(timer);document.removeEventListener('pointerup',schedule);document.removeEventListener('keyup',key);document.removeEventListener('selectionchange',changed);};
}
