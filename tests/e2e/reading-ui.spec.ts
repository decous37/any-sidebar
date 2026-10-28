import {test,expect} from '@playwright/test';
import {launch,Panel,type Harness} from './harness';
let h:Harness;
test.beforeEach(async()=>{h=await launch();});test.afterEach(async()=>{await h?.close();});
async function reload(){const before=await h.panel.evaluate('performance.timeOrigin');await h.panel.raw('Page.enable');await h.panel.raw('Page.reload');await expect.poll(()=>h.panel.evaluate('performance.timeOrigin')).not.toBe(before);await h.panel.wait('已读取文章正文');}
async function answer(){
 await h.panel.click('打开设置');await h.panel.fill('input[type=password]','TEST_ONLY_NOT_REAL');await h.panel.click('保存 Key');await h.panel.wait('已配置 Key');await h.panel.click('关闭设置');
 const text=Array.from({length:45},(_,i)=>`第${i+1}段：用于验证历史阅读位置和滚动跟随的模拟文字。`).join('\n\n')+'\n\n```js\n'+('const sample = "long code";'.repeat(20))+'\n```\n\n|列一|列二|\n|---|---|\n|'+('长内容'.repeat(50))+'|内容|';
 h.panel.responseBody='data: '+JSON.stringify({choices:[{delta:{content:text},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n';
 await h.panel.fill('textarea','长回答布局测试');await h.panel.click('发送问题');await h.panel.wait('已完成');
}
const distance="(()=>{const e=document.querySelector('.messages');return e.scrollHeight-e.clientHeight-e.scrollTop})()";
test('短提示亮暗、键盘、Esc、点击及边缘，窄屏消息不溢出',async()=>{
 await answer();
 for(const theme of ['light','dark']){
  await h.panel.click('打开设置');await h.panel.select('主题',theme);await h.panel.click('关闭设置');
  for(const width of [320,480,600]){
   await h.panel.raw('Emulation.setDeviceMetricsOverride',{width,height:850,deviceScaleFactor:1,mobile:false});
   await expect.poll(()=>h.panel.evaluate('innerWidth')).toBe(width);
   expect(await h.panel.evaluate("document.querySelectorAll('button[title],.quote-preview[title]').length")).toBe(0);
   expect(await h.panel.evaluate("(()=>{const m=document.querySelector('.messages');return m.scrollWidth<=m.clientWidth&&document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.send-button').getBoundingClientRect().right<=innerWidth})()")).toBe(true);
   await h.panel.raw('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await h.panel.raw('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
   await h.panel.evaluate("document.querySelector('[aria-label=\"复制回答\"]').focus()");
   await expect.poll(()=>h.panel.evaluate("document.querySelector('[role=tooltip]')?.textContent")).toBe('复制');
   expect(await h.panel.evaluate("(()=>{const r=document.querySelector('[role=tooltip]').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()")).toBe(true);
   await h.panel.raw('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   expect(await h.panel.evaluate("document.querySelector('[role=tooltip]')===null")).toBe(true);
  }
 }
 await h.panel.evaluate("document.querySelector('[aria-label=\"复制回答\"]').blur()");
 const point=await h.panel.evaluate<{x:number;y:number}>("(()=>{const b=document.querySelector('[aria-label=\"打开设置\"]').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()");
 await h.panel.raw('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await expect.poll(()=>h.panel.evaluate("document.querySelector('[role=tooltip]')?.textContent")).toBe('设置');
 await h.panel.click('打开设置');expect(await h.panel.evaluate("document.querySelector('[role=tooltip]')===null")).toBe(true);await h.panel.click('关闭设置');
 await h.panel.screenshot('artifacts/verification/v021-dark-compact.png');
});
test('四档字号、历史位置、引用高度与一键到底；重载保留偏好',async()=>{
 await answer();await expect.poll(()=>h.panel.evaluate<number>(distance)).toBeLessThan(2);
 await h.panel.evaluate("(()=>{const e=document.querySelector('.messages');e.scrollTop=120;e.dispatchEvent(new Event('scroll'))})()");await h.panel.wait('AI可能会出错');
 await expect.poll(()=>h.panel.evaluate("!!document.querySelector('[aria-label=\"到底部\"]')")).toBe(true);
 for(const font of [12,13,14,16]){
  await h.panel.click('打开设置');await h.panel.select('字号',String(font));await h.panel.click('关闭设置');
  await expect.poll(()=>h.panel.evaluate("getComputedStyle(document.querySelector('.markdown')).fontSize")).toBe(font+'px');
  for(const selector of ['.question','textarea','.markdown code','.markdown table'])expect(await h.panel.evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).fontSize`)).toBe(font+'px');
  expect(await h.panel.evaluate<number>(distance)).toBeGreaterThan(100);
 }
 await h.article.evaluate(()=>{const r=document.createRange();r.selectNodeContents(document.querySelector('article p')!);const s=getSelection()!;s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('pointerup'));});await h.panel.wait('1 条引用');
 expect(await h.panel.evaluate<number>(distance)).toBeGreaterThan(100);expect(await h.panel.evaluate("!!document.querySelector('[aria-label=\"到底部\"]')")).toBe(true);
 await h.panel.raw('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await h.panel.click('到底部');await expect.poll(()=>h.panel.evaluate<number>(distance)).toBeLessThan(2);
 await expect.poll(()=>h.panel.evaluate("document.querySelector('[aria-label=\"到底部\"]')===null")).toBe(true);
 await reload();expect(await h.panel.evaluate("getComputedStyle(document.querySelector('.markdown')).fontSize")).toBe('16px');await h.panel.screenshot('artifacts/verification/v021-reading.png');
});
test('旧字号偏好默认13px，打开的另一原生侧栏同步字号',async()=>{
 await h.extension.evaluate(async()=>{const {preferences}=await chrome.storage.local.get('preferences');const next:Record<string,unknown>={revision:0,updatedAt:Date.now(),...(preferences as Record<string,unknown>)};delete next.fontSize;await chrome.storage.local.set({preferences:next});});await reload();
 expect(await h.panel.evaluate("getComputedStyle(document.querySelector('textarea')).fontSize")).toBe('13px');
 const firstTarget=await h.panel.evaluate<string>('location.href');
 const windowId=await h.extension.evaluate(async()=>{const w=await chrome.windows.create({url:'http://127.0.0.1:4173/article.html',focused:false});await chrome.sidePanel.open({windowId:w!.id!});return w!.id!;});
 const cdp=await h.context.newCDPSession(h.extension);let targetId='';
 await expect.poll(async()=>{const list=await cdp.send('Target.getTargets');const t=list.targetInfos.find(t=>t.url.includes('/sidepanel.html?instance=')&&t.url!==firstTarget);targetId=t?.targetId??'';return !!t;},{timeout:15000}).toBe(true);
 const {sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:false});const other=new Panel(cdp,sessionId);await other.wait('已读取文章正文');
 await h.extension.evaluate(async id=>{await chrome.windows.update(id,{state:'minimized'});},windowId);
 await h.panel.click('打开设置');await h.panel.select('字号','14');await h.panel.click('关闭设置');
 await expect.poll(()=>other.evaluate("getComputedStyle(document.querySelector('textarea')).fontSize")).toBe('14px');
 await reload();expect(await h.panel.evaluate("getComputedStyle(document.querySelector('textarea')).fontSize")).toBe('14px');
});
test('真实流式渲染：上翻暂停、到底恢复，再次上翻仍保持阅读位置',async()=>{
 await answer();
 await h.panel.raw('Page.enable');
 await h.panel.raw('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const nativeFetch=window.fetch;window.fetch=(input,init)=>String(input).startsWith('https://api.deepseek.com/')?Promise.resolve(new Response(new ReadableStream({start(c){let n=0;const encoder=new TextEncoder();const timer=setInterval(()=>{c.enqueue(encoder.encode('data: '+JSON.stringify({choices:[{delta:{content:'\\n\\n流式段落'+(++n)+'。'.repeat(150)}}]})+'\\n\\n'));if(n===40){clearInterval(timer);c.enqueue(encoder.encode('data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\\n\\ndata: [DONE]\\n\\n'));c.close();}},120);init.signal.addEventListener('abort',()=>{clearInterval(timer);c.error(new DOMException('Aborted','AbortError'));});}}),{headers:{'Content-Type':'text/event-stream'}})):nativeFetch(input,init);})()`});
 await reload();
 await h.panel.fill('textarea','验证流式滚动');await h.panel.click('发送问题');await h.panel.wait('流式段落3');
 await h.panel.evaluate("(()=>{const e=document.querySelector('.messages');e.scrollTop=100;e.dispatchEvent(new Event('scroll'))})()");await h.panel.wait('流式段落8');
 expect(await h.panel.evaluate("document.querySelector('.messages').scrollTop")).toBeLessThan(150);await h.panel.click('到底部');await h.panel.wait('流式段落15');await expect.poll(()=>h.panel.evaluate<number>(distance)).toBeLessThan(2);
 await h.panel.evaluate("(()=>{const e=document.querySelector('.messages');e.dispatchEvent(new WheelEvent('wheel',{deltaY:-300,bubbles:true}));e.scrollTop=200;e.dispatchEvent(new Event('scroll'))})()");await h.panel.wait('流式段落25');expect(await h.panel.evaluate("document.querySelector('.messages').scrollTop")).toBeLessThan(250);
 await h.panel.click('停止生成');expect(await h.panel.evaluate("!!document.querySelector('[aria-label=\"到底部\"]')")).toBe(true);
});
