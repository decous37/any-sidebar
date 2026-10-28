import {useEffect,useState,useSyncExternalStore,useRef} from 'react';
import {MessageCircle,Settings,Sun,Moon,ArrowUpRight,AlertCircle,BookOpen} from 'lucide-react';
import {Client} from './client';
import {PanelStore} from './store';
import {Transport} from './transport';
import {Fault,type TurnView,type PreparedRequest,type AssistantQuote} from '../shared/types';
import Composer from './Composer';
import MessageList from './MessageList';
import SettingsPanel from './SettingsPanel';
import Dialog from './Dialog';
import TooltipButton from './TooltipButton';
const client=new Client(),store=new PanelStore(client),transport=new Transport(client,()=>store.schedule());
export default function App(){
 const s=useSyncExternalStore(store.subscribe,store.snapshot);
 const [settings,setSettings]=useState(false),[focusKey,setFocusKey]=useState(false),[keyPrompt,setKeyPrompt]=useState(false),[busy,setBusy]=useState(false),[followup,setFollowup]=useState(false);
 const sending=useRef(false),settingsButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const unsubscribe=client.onUpdate(e=>{if(e.event==='cancel'&&e.requestId)transport.abortOwned(e.requestId);store.schedule();});void store.initialize();return()=>{unsubscribe();transport.disposeOwner();store.dispose();};},[]);
 useEffect(()=>{const mq=matchMedia('(prefers-color-scheme: dark)');const apply=()=>{document.documentElement.dataset.theme=s.prefs.theme==='system'?(mq.matches?'dark':'light'):s.prefs.theme;};apply();mq.addEventListener('change',apply);return()=>mq.removeEventListener('change',apply);},[s.prefs.theme]);
 useEffect(()=>{document.documentElement.style.setProperty('--conversation-font-size',s.prefs.fontSize+'px');},[s.prefs.fontSize]);
 useEffect(()=>setFollowup(false),[s.view?.session.id]);
 const act=(fn:()=>Promise<unknown>)=>{store.set({error:''});void fn().catch(e=>store.error(e));};
 function requireKey(){if(s.configured)return true;store.set({error:''});setKeyPrompt(true);return false;}
 async function execute(prepare:()=>Promise<PreparedRequest>){
  if(sending.current||!requireKey())return;sending.current=true;setBusy(true);
  try{await store.settlePreferences();const p=await prepare();setFollowup(false);void transport.runPrepared(p);}
  catch(e){if(e instanceof Fault&&e.code==='CREDENTIAL_REQUIRED')setKeyPrompt(true);else store.error(e);}
  finally{sending.current=false;setBusy(false);}
 }
 async function retry(t:TurnView,regenerate=false){if(!s.view)return;await execute(()=>client.call<PreparedRequest>(regenerate?'regenerateLastTurn':'retryLastTurn',{sessionId:s.view!.session.id,turnId:t.turn.id}));}
 async function restore(t:TurnView){if(!s.view)return;if((s.input||s.view.draft.quotes.length||s.view.draft.assistantQuote)&&!confirm('恢复原问题会替换输入文字，并保留已有引用。是否继续？'))return;await client.call('restoreSubmission',{requestId:t.reply.requestId,expectedRevision:s.view.draft.revision});await store.refresh();}
 async function clear(all:boolean){if((!all&&!s.view)||!confirm(all?'清空全部网页的对话、草稿和引用？此操作无法撤销。':'清空当前网页的对话、草稿和引用？此操作无法撤销。'))return;await client.call(all?'clearAll':'clearCurrent',{sessionId:s.view?.session.id});store.set({view:null,input:'',dirty:false});await store.refresh();}
 async function quote(value:AssistantQuote,isFollowup=false){await store.assistantQuote(value);if(isFollowup){setFollowup(true);document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus();}}
 const themeDark=document.documentElement.dataset.theme==='dark';
 return <div className="app-shell">
  <header className="topbar"><div className="brand"><MessageCircle size={19} strokeWidth={1.7}/><span>Any Sidebar</span></div><div className="topbar-actions"><TooltipButton tip="切换亮暗主题" className="icon-button" aria-label="切换亮暗主题" onClick={()=>act(()=>store.preferences({theme:themeDark?'light':'dark'}))}>{themeDark?<Sun size={18}/>:<Moon size={18}/>}</TooltipButton><TooltipButton ref={settingsButton} className="icon-button" tip="设置" aria-label="打开设置" onClick={()=>{setFocusKey(false);setSettings(true);}}><Settings size={18}/></TooltipButton></div></header>
  {s.error&&<div className="notice" role="alert"><AlertCircle size={15}/><div><span>{s.error}</span>{s.conflict&&<div className="conflict-actions"><button className="text-button" onClick={()=>act(()=>store.chooseLocal(true))}>保留本地输入</button><button className="text-button" onClick={()=>act(()=>store.chooseLocal(false))}>采用已保存草稿</button></div>}</div></div>}
  {s.view?.turns.length?<MessageList view={s.view} busy={busy} onRetry={t=>void retry(t)} onRegenerate={t=>void retry(t,true)} onRestore={t=>act(()=>restore(t))} onOlder={()=>act(()=>store.older())} onQuote={(q,f)=>act(()=>quote(q,f))} onClearQuote={id=>act(()=>store.assistantQuote(id))}/>:<main className="welcome"><div className="welcome-icon"><BookOpen size={26} strokeWidth={1.5}/></div><h1>围绕这篇文章，<br/>聊聊你的问题。</h1><p>{s.article?'正文已准备好。划选网页中的一句话，或直接在下方提问。':'打开文章后，正文会在本机读取。未读到正文时，也可以直接提问。'}</p><div className="suggestions">{['总结这篇文章','解释文章的核心观点','列出值得进一步思考的问题'].map(text=><button key={text} disabled={busy||!s.ready||!s.view} onClick={()=>{store.edit(text);void execute(()=>store.prepare());}}>{text}<ArrowUpRight size={14}/></button>)}</div>{!s.configured&&<button className="setup-link" onClick={()=>{setFocusKey(true);setSettings(true);}}>配置 DeepSeek Key<ArrowUpRight size={14}/></button>}</main>}
  <Composer state={s} busy={busy} followup={followup} onRead={()=>act(()=>store.readArticle())} onEdit={v=>store.edit(v)} onSend={()=>void execute(()=>store.prepare())} onStop={()=>act(async()=>{if(s.view?.session.activeRequestId)await transport.stop(s.view.session.activeRequestId);})} onQuoteDelete={id=>act(()=>store.change({kind:'removeQuote',id}))} onAssistantQuoteDelete={id=>act(()=>store.assistantQuote(id))} onMode={()=>act(()=>store.preferences({quoteMode:s.prefs.quoteMode==='latest'?'accumulate':'latest'}))} onPreferences={patch=>act(()=>store.preferences(patch))}/>
  {keyPrompt&&<Dialog title="请先填写 API Key" initialFocus=".confirm-key" onClose={()=>setKeyPrompt(false)}><p>填写 DeepSeek API Key 后即可发送问题。当前问题和引用会保留。</p><div className="dialog-actions"><button className="text-button" onClick={()=>setKeyPrompt(false)}>取消</button><button className="solid-button confirm-key" onClick={()=>{setKeyPrompt(false);setFocusKey(true);setSettings(true);}}>确定</button></div></Dialog>}
  {settings&&<SettingsPanel state={s} focusKey={focusKey} onClose={()=>{setSettings(false);settingsButton.current?.focus();}} onPreferences={p=>store.preferences(p)} onKey={async value=>{const status=await client.call<{configured:boolean}>('setKey',{value});store.set({configured:status.configured});}} onDelete={all=>act(()=>clear(all))}/>}
 </div>;
}
