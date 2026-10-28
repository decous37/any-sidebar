import {useRef,useLayoutEffect,useState,type KeyboardEvent} from 'react';
import {ArrowUp,Square,ChevronDown,X,Quote as QuoteIcon,BookOpen,RefreshCw} from 'lucide-react';
import type {State} from './store';
import type {PreferenceValues,ModelId} from '../shared/types';
import {PROVIDERS} from '../shared/providers';
import ModelPicker from './ModelPicker';
import ThinkingPicker from './ThinkingPicker';
import Dialog from './Dialog';
import TooltipButton from './TooltipButton';
interface Props {state:State;busy:boolean;followup?:boolean;onEdit:(v:string)=>void;onSend:()=>void;onStop:()=>void;onQuoteDelete:(id:string)=>void;onAssistantQuoteDelete:(id:string)=>void;onMode:()=>void;onPreferences:(patch:Partial<PreferenceValues>)=>void;onRead:()=>void}
export default function Composer({state,busy,followup,onEdit,onSend,onStop,onQuoteDelete,onAssistantQuoteDelete,onMode,onPreferences,onRead}:Props){
 const [preview,setPreview]=useState<{label:string;text:string}|null>(null);
 const input=useRef<HTMLTextAreaElement>(null),composing=useRef(false),justComposed=useRef(0);
 const quotes=state.view?.draft.quotes??[],ai=state.view?.draft.assistantQuote;
 const active=!!state.view?.session.activeRequestId||busy;
 useLayoutEffect(()=>{const el=input.current;if(!el)return;const resize=()=>{el.style.height='44px';if(el.value)el.style.height=Math.max(44,Math.min(88,el.scrollHeight))+'px';};resize();let width=el.clientWidth;const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>{if(el.clientWidth!==width){width=el.clientWidth;resize();}});observer?.observe(el);return()=>observer?.disconnect();},[state.input,state.prefs.fontSize]);
 function key(e:KeyboardEvent<HTMLTextAreaElement>){if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&!composing.current&&e.keyCode!==229&&Date.now()-justComposed.current>80){e.preventDefault();if(!active&&state.input.trim())onSend();}}
 const readingLabel=state.reading||(state.binding&&!state.article&&!state.articleError)?'正在读取文章正文…':state.article?'已读取文章正文':state.ready?'未读取正文':'正在连接…';
 const all=[...quotes.map(q=>({id:q.id,text:q.text,label:'网页引用',remove:()=>onQuoteDelete(q.id)})),...(ai?[{id:ai.id,text:ai.text,label:'AI 回答',remove:()=>onAssistantQuoteDelete(ai.id)}]:[])];
 return <footer className="composer-area"><div className="composer">
  <div className="composer-context"><BookOpen size={12}/><span className="reading-status" role="status" aria-live="polite" title={state.articleError||undefined}>{readingLabel}</span><span className="context-title" title={state.binding?.url}>{state.article?.title}</span><TooltipButton tip="重新读取正文" className={'icon-button context-refresh '+(state.reading?'spinning':'')} aria-label="重新读取正文" disabled={state.reading||!state.ready} onClick={onRead}><RefreshCw size={12}/></TooltipButton></div>
  {all.length>0&&<div className="quote-area"><div className="quote-heading"><span><QuoteIcon size={12}/>{all.length} 条引用</span><TooltipButton className="text-button" tip="引用模式" onClick={onMode}>{state.prefs.quoteMode==='accumulate'?'累积引用':'仅最新引用'}<ChevronDown size={11}/></TooltipButton></div><div className="quote-list">{all.map(q=><div className="quote-item" key={q.id}><span className="quote-source">{q.label}</span><button className="quote-preview" aria-label={'查看'+q.label} onClick={()=>setPreview(q)}><p>{q.text}</p></button><TooltipButton className="icon-button small" aria-label={q.label==='AI 回答'?'删除 AI 引用':'删除引用'} tip="删除引用" onClick={q.remove}><X size={12}/></TooltipButton></div>)}</div></div>}
  <textarea ref={input} aria-label="问题" placeholder={followup?'基于这条回答，继续提问…':'问问这篇文章…'} value={state.input} disabled={!state.view} onChange={e=>onEdit(e.target.value)} onKeyDown={key} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;justComposed.current=Date.now();}} rows={2}/>
  <div className="composer-bottom"><ThinkingPicker prefs={state.prefs} disabled={!state.ready} onChange={onPreferences}/><ModelPicker providers={PROVIDERS} value={state.prefs.model} disabled={!state.ready} onChange={value=>onPreferences({model:value as ModelId})}/><TooltipButton className="send-button" aria-label={active?'停止生成':'发送问题'} tip={active?'停止生成':'发送'} disabled={!active&&(!state.input.trim()||!state.view||state.conflict)} onClick={active?onStop:onSend}>{active?<Square size={16} fill="currentColor"/>:<ArrowUp size={20}/>}</TooltipButton></div>
 </div><div className="composer-caption">AI可能会出错，请注意甄别</div>
 {preview&&<Dialog title={preview.label} onClose={()=>setPreview(null)}><div className="quote-full">{preview.text}</div><div className="dialog-actions"><button className="solid-button" onClick={()=>setPreview(null)}>关闭</button></div></Dialog>}
 </footer>;
}
