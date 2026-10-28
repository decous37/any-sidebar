import {useLayoutEffect,useRef,useState,type MouseEvent,type KeyboardEvent} from 'react';
import {Sparkles,RotateCcw,Undo2,Quote,MessageCircle,RefreshCw,ArrowDown} from 'lucide-react';
import type {SessionView,TurnView,AssistantQuote} from '../shared/types';
import {terminal} from '../shared/types';
import TooltipButton from './TooltipButton';
import MarkdownMessage,{CopyButton} from './MarkdownMessage';
const labels={preparing:'准备上下文',prepared:'准备完成',connecting:'等待 DeepSeek',streaming:'正在回答',complete:'已完成',failed:'生成失败',stopped:'已停止',interrupted:'已中断',truncated:'未完成 · 达到长度上限'};
interface Props {view:SessionView;onRetry:(t:TurnView)=>void;onRegenerate:(t:TurnView)=>void;onRestore:(t:TurnView)=>void;onOlder:()=>void;onQuote:(quote:AssistantQuote,followup?:boolean)=>void;onClearQuote:(id:string)=>void;busy:boolean}
export default function MessageList({view,onRetry,onRegenerate,onRestore,onOlder,onQuote,onClearQuote,busy}:Props){
 const scroller=useRef<HTMLDivElement>(null),content=useRef<HTMLDivElement>(null),follow=useRef(true),jumping=useRef(false);
 const [away,setAway]=useState(false);
 function measure(){const el=scroller.current;if(el)setAway(el.scrollHeight-el.scrollTop-el.clientHeight>100);}
 useLayoutEffect(()=>{
  const el=scroller.current,body=content.current;if(!el||!body)return;
  follow.current=true;jumping.current=false;el.scrollTop=el.scrollHeight;measure();
  const observer=new ResizeObserver(()=>{if(follow.current)el.scrollTop=el.scrollHeight;measure();});
  observer.observe(el);observer.observe(body);return()=>observer.disconnect();
 },[view.session.id]);
 function bottom(){const el=scroller.current;if(!el)return;follow.current=true;jumping.current=true;el.scrollTo({top:el.scrollHeight,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 function selection(e:MouseEvent<HTMLDivElement>|KeyboardEvent<HTMLDivElement>){
  if(e.target instanceof Element&&e.target.closest('button,a,summary,input,textarea,select,.thinking'))return;
  const selected=getSelection();const q=view.draft.assistantQuote;
  if(!selected||selected.isCollapsed||!selected.toString().trim()){if(q)onClearQuote(q.id);return;}
  const range=selected.getRangeAt(0),element=(n:Node)=>n instanceof Element?n:n.parentElement;
  const start=element(range.startContainer)?.closest('.markdown'),finish=element(range.endContainer)?.closest('.markdown');
  if(!start||start!==finish)return;
  const answer=start.closest<HTMLElement>('.answer-body');if(!answer)return;
  for(const control of start.querySelectorAll('button,input,textarea,select'))if(range.intersectsNode(control))return;
  const text=selected.toString().trim(),requestId=answer.dataset.requestId!,turnId=answer.dataset.turnId!;
  if(q?.sourceRequestId===requestId&&q.text===text)return;
  onQuote({id:crypto.randomUUID(),sourceTurnId:turnId,sourceRequestId:requestId,text,selectedAt:Date.now()});
 }
 function quote(t:TurnView,followup=false){onQuote({id:crypto.randomUUID(),sourceTurnId:t.turn.id,sourceRequestId:t.reply.displayRequestId??t.reply.requestId,text:t.reply.answer,selectedAt:Date.now()},followup);}
 return <div className="message-area"><div ref={scroller} className="messages" onWheel={()=>{jumping.current=false;}} onPointerDown={()=>{jumping.current=false;}} onKeyDown={()=>{jumping.current=false;}} onPointerUp={selection} onKeyUp={e=>{if(e.key==='Shift'||e.shiftKey||e.key==='Escape')selection(e);}} onScroll={e=>{const el=e.currentTarget;const distance=el.scrollHeight-el.scrollTop-el.clientHeight;if(distance<=1)jumping.current=false;if(!jumping.current)follow.current=distance<=100;measure();}}><div ref={content} className="message-content">
 {view.nextBeforeOrder!==null&&<button className="text-button older" onClick={onOlder}>加载更早的对话</button>}
 {view.turns.map((t,index)=><section className="turn" key={t.turn.id}>
  <div className="question">{(t.turn.quotes.length>0||t.turn.assistantQuote)&&<details className="sent-quotes"><summary>{t.turn.quotes.length+(t.turn.assistantQuote?1:0)} 条引用</summary>{t.turn.quotes.map(q=><blockquote key={q.id}>{q.text}</blockquote>)}{t.turn.assistantQuote&&<blockquote><strong>AI 回答</strong><br/>{t.turn.assistantQuote.text}</blockquote>}</details>}<div>{t.turn.question}</div></div>
  <div className="answer-heading"><Sparkles size={16}/><span>DeepSeek</span><span className="reply-status">{t.reply.restoredAnswer?'已恢复原回答':labels[t.reply.status]}</span></div>
  <div className="answer-body" data-turn-id={t.turn.id} data-request-id={t.reply.displayRequestId??t.reply.requestId}><MarkdownMessage answer={t.reply.answer} reasoning={t.reply.reasoning}/></div>
  {!t.reply.answer&&!terminal(t.reply.status)&&<div className="waiting"><i/>正在处理你的问题</div>}
  {t.reply.restoredAnswer&&<p className="inline-error">重新生成未完成，已保留原回答。</p>}{t.reply.error&&<div className="inline-error">{t.reply.error.message}</div>}
  <div className="reply-tools">{t.reply.answer&&<><CopyButton text={t.reply.answer}/><TooltipButton className="icon-button small" tip="引用" aria-label="引用回答" onClick={()=>quote(t)}><Quote size={15}/></TooltipButton><TooltipButton className="icon-button small" tip="追问" aria-label="追问回答" onClick={()=>quote(t,true)}><MessageCircle size={15}/></TooltipButton></>}
   {index===view.turns.length-1&&t.reply.status==='complete'&&<TooltipButton className="icon-button small" tip="重新生成" aria-label="重新生成" disabled={busy||!!view.session.activeRequestId} onClick={()=>onRegenerate(t)}><RefreshCw size={15}/></TooltipButton>}
   {index===view.turns.length-1&&terminal(t.reply.status)&&t.reply.status!=='complete'&&<>{t.reply.retryable&&<button className="text-button" disabled={busy||!!view.session.activeRequestId} onClick={()=>onRetry(t)}><RotateCcw size={13}/>重试</button>}<button className="text-button" onClick={()=>onRestore(t)}><Undo2 size={13}/>恢复输入</button></>}
  </div>
 </section>)} </div></div>{away&&<TooltipButton tip="到底部" aria-label="到底部" className="jump-bottom icon-button" onClick={bottom}><ArrowDown size={17}/></TooltipButton>}</div>;
}
