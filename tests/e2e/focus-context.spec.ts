import {test,expect} from '@playwright/test';
import {launch,type Harness} from './harness';
let h:Harness;
test.beforeEach(async()=>{h=await launch();});test.afterEach(async()=>{await h?.close();});
async function press(key:string,code:string,vk:number){await h.panel.raw('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk});await h.panel.raw('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk});}
test('思考与模型圆角焦点框贴合完整控件，亮暗窄屏无裁剪或输入外框联动',async()=>{
 for(const theme of ['light','dark']){
  await h.panel.click('打开设置');await h.panel.select('主题',theme);await h.panel.click('关闭设置');
  for(const width of [320,480,600]){
   await h.panel.raw('Emulation.setDeviceMetricsOverride',{width,height:850,deviceScaleFactor:1,mobile:false});
   await press('Tab','Tab',9);
   for(const label of ['思考强度','选择模型']){
    await h.panel.evaluate(`document.querySelector('select[aria-label="${label}"]').focus()`);
    await expect.poll(()=>h.panel.evaluate(`getComputedStyle(document.querySelector('select[aria-label="${label}"]').parentElement).boxShadow`)).toContain('inset');
    const metrics=await h.panel.evaluate<{outline:string;composerOutline:string;aligned:boolean;round:string;overflow:boolean}>(`(()=>{const s=document.querySelector('select[aria-label="${label}"]'),p=s.parentElement,a=s.getBoundingClientRect(),b=p.getBoundingClientRect();return {outline:getComputedStyle(s).outlineStyle,composerOutline:getComputedStyle(document.querySelector('.composer')).outlineStyle,aligned:['left','right','top','bottom'].every(k=>Math.abs(a[k]-b[k])<1),round:getComputedStyle(p).borderRadius,overflow:document.documentElement.scrollWidth>innerWidth};})()`);
    expect(metrics).toEqual({outline:'none',composerOutline:'none',aligned:true,round:'16px',overflow:false});
   }
   await h.panel.evaluate("document.querySelector('textarea').focus()");expect(await h.panel.evaluate("getComputedStyle(document.querySelector('.composer')).outlineStyle")).toBe('solid');expect(await h.panel.evaluate("[...document.querySelectorAll('.picker-control')].every(p=>getComputedStyle(p).boxShadow==='none')")).toBe(true);
  }
  await press('Tab','Tab',9);await h.panel.evaluate("document.querySelector('[aria-label=\"选择模型\"]').focus()");await h.panel.screenshot('artifacts/verification/v022-focus-'+theme+'.png');
 }
});
test('原生下拉值与显示同步，长名称完整焦点框和禁用状态',async()=>{
 await press('Tab','Tab',9);await h.panel.evaluate("document.querySelector('[aria-label=\"思考强度\"]').focus()");
 await h.panel.select('思考强度','max');await press('Escape','Escape',27);
 // Native macOS popup keyboard interaction is checked in daily Chrome, not claimed from minimized CDP tests.
 await expect.poll(()=>h.panel.evaluate("document.querySelector('[aria-label=\"思考强度\"]').value")).toBe('max');
 await expect.poll(()=>h.panel.evaluate("document.querySelector('.thinking-picker .picker-value').textContent")).toBe('思考·最高');
 await h.panel.raw('Emulation.setDeviceMetricsOverride',{width:320,height:850,deviceScaleFactor:1,mobile:false});
 await h.panel.evaluate("(()=>{const p=document.querySelector('.model-picker');p.querySelector('.picker-value').textContent='用于长名称布局测试的模型名称 Very Long Model Name';p.querySelector('option:checked').textContent='用于长名称布局测试的模型名称 Very Long Model Name';p.querySelector('select').focus();})()");
 const result=await h.panel.evaluate<{ellipsis:boolean;arrowInside:boolean;visible:boolean;aligned:boolean}>("(()=>{const p=document.querySelector('.model-picker'),v=p.querySelector('.picker-value'),r=p.getBoundingClientRect(),s=p.querySelector('select').getBoundingClientRect(),a=p.querySelector('svg').getBoundingClientRect(),send=document.querySelector('.send-button').getBoundingClientRect();return {ellipsis:v.scrollWidth>v.clientWidth,arrowInside:a.left>=r.left&&a.right<=r.right,visible:send.right<=innerWidth,aligned:Math.abs(s.width-r.width)<1};})()");
 expect(result).toEqual({ellipsis:true,arrowInside:true,visible:true,aligned:true});
 await h.panel.evaluate("(()=>{const p=document.querySelector('.model-picker'),s=p.querySelector('select');s.blur();s.disabled=true;p.dataset.disabled='true';s.focus();})()");expect(await h.panel.evaluate("getComputedStyle(document.querySelector('.model-picker')).boxShadow")).toBe('none');expect(await h.panel.evaluate("document.activeElement===document.querySelector('.model-picker select')")).toBe(false);
});
test('真正发送reading-v1结构、定位与完整正文，追问顺序和原上下文重新生成',async()=>{
 await h.panel.click('打开设置');await h.panel.fill('input[type=password]','TEST_ONLY_NOT_REAL');await h.panel.click('保存 Key');await h.panel.wait('已配置 Key');await h.panel.click('关闭设置');
 await h.article.evaluate(()=>{const r=document.createRange();r.selectNodeContents(document.querySelector('article p')!);const s=getSelection()!;s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('pointerup'));});await h.panel.wait('1 条引用');
 await h.panel.fill('textarea','结合文章解释这段');await h.panel.click('发送问题');await h.panel.wait('已完成');expect(h.requests).toHaveLength(1);
 const first=h.requests[0].messages as {role:string;content:string}[];expect(first.map(m=>m.role)).toEqual(['system','user']);expect(first[0].content).toContain('Any Sidebar');const data=JSON.parse(first.at(-1)!.content);expect(data.引用[0].定位.status).toBe('matched');expect(data.当前网页.正文).toContain('青色灯塔');expect(Object.keys(data).at(-1)).toBe('问题');
 await h.panel.fill('textarea','那为什么这样？');await h.panel.click('发送问题');await expect.poll(()=>h.requests.length).toBe(2);await expect.poll(()=>h.panel.evaluate("[...document.querySelectorAll('.reply-status')].at(-1).textContent")).toBe('已完成');const next=h.requests[1].messages as {role:string;content:string}[];expect(next.map(m=>m.role)).toEqual(['system','user','assistant','user']);expect(next[2].content).toContain('模拟回答');
 await h.panel.click('重新生成');await expect.poll(()=>h.requests.length).toBe(3);expect(h.requests[2].messages).toEqual(h.requests[1].messages);
});
