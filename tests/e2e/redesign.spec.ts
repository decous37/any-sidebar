import {test,expect} from '@playwright/test';
import {launch,type Harness} from './harness';
let h:Harness;
test.beforeEach(async()=>{h=await launch();});test.afterEach(async()=>{await h?.close();});
async function key(){await h.panel.click('打开设置');await h.panel.fill('input[type=password]','TEST_ONLY_NOT_REAL');await h.panel.click('保存 Key');await h.panel.wait('已配置 Key');await h.panel.click('关闭设置');}
async function ask(question='测试问题'){await h.panel.fill('textarea',question);await h.panel.click('发送问题');await h.panel.wait('已完成');}
async function pageQuote(){await h.article.evaluate(()=>{const r=document.createRange();r.selectNodeContents(document.querySelector('article p')!);const s=getSelection()!;s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('pointerup'));});}
test('缺Key三入口先提示，确认才定位配置且保存不自动发送',async()=>{
 for(const action of ['发送问题','Enter','推荐']){
  await h.panel.fill('textarea','保留原问题');
  if(action==='Enter')await h.panel.evaluate("document.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");else await h.panel.click(action==='推荐'?'总结这篇文章':action);
  await h.panel.wait('请先填写 API Key');expect(await h.panel.evaluate("document.querySelector('.settings-dialog')===null")).toBe(true);expect(h.requests).toHaveLength(0);await h.panel.click('取消');
 }
 await h.panel.click('发送问题');await h.panel.click('确定');await h.panel.wait('DeepSeek API Key');expect(await h.panel.evaluate("document.activeElement===document.querySelector('input[type=password]')")).toBe(true);await h.panel.fill('input[type=password]','TEST_ONLY_NOT_REAL');await h.panel.click('保存 Key');await h.panel.wait('已配置 Key');expect(h.requests).toHaveLength(0);await h.panel.click('关闭设置');expect(await h.panel.evaluate("document.querySelector('textarea').value")).toBe('总结这篇文章');
});
test('AI选文独立替换、取消和输入框聚焦保留，发送冻结完整引用',async()=>{
 await key();await ask();await pageQuote();await h.panel.wait('1 条引用');
 await h.panel.evaluate("(()=>{const p=document.querySelector('.answer-body .markdown p');const r=document.createRange();r.selectNodeContents(p);const s=getSelection();s.removeAllRanges();s.addRange(r);p.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));})()");
 await h.panel.wait('2 条引用');expect(await h.panel.evaluate("document.querySelectorAll('.quote-source')[1].textContent")).toBe('AI 回答');
 await h.panel.fill('textarea','继续围绕这段回答提问');await h.panel.evaluate("document.querySelector('textarea').focus()");expect(await h.panel.evaluate("document.querySelectorAll('.quote-item').length")).toBe(2);
 await h.panel.evaluate("(()=>{getSelection().removeAllRanges();document.querySelector('.messages').dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));})()");await expect.poll(()=>h.panel.evaluate("document.querySelectorAll('.quote-item').length")).toBe(1);
 await h.panel.click('引用回答');await h.panel.wait('2 条引用');await h.panel.click('发送问题');await expect.poll(()=>h.requests.length).toBe(2);await expect.poll(()=>h.panel.evaluate("document.querySelectorAll('.quote-item').length")).toBe(0);const body=JSON.stringify(h.requests[1].messages);expect(body).toContain('AI回答引用');expect(body).toContain('模拟回答');expect(body).toContain('青色灯塔');
 expect(await h.panel.evaluate("document.querySelectorAll('.model-details').length")).toBe(0);
});
test('追问保留草稿，重新生成沿用上下文且双击不重复，失败恢复原答',async()=>{
 await key();await ask('原始问题');await h.panel.fill('textarea','我已有的草稿');await h.panel.click('追问回答');await expect.poll(()=>h.panel.evaluate("document.activeElement===document.querySelector('textarea')")).toBe(true);expect(await h.panel.evaluate("document.querySelector('textarea').value")).toBe('我已有的草稿');expect(h.requests).toHaveLength(1);await h.panel.wait('AI 回答');
 h.panel.responseBody='data: {"choices":[{"delta":{"content":"重新生成的新回答"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
 await h.panel.evaluate("(()=>{const b=document.querySelector('button[aria-label=\\\"重新生成\\\"]');b.click();b.click();})()");await h.panel.wait('重新生成的新回答');expect(h.requests).toHaveLength(2);expect(h.requests[1].messages).toEqual(h.requests[0].messages);expect(await h.panel.evaluate("document.querySelectorAll('.turn').length")).toBe(1);expect(await h.panel.evaluate("document.querySelector('textarea').value")).toBe('我已有的草稿');
 h.panel.responseStatus=429;h.panel.responseBody='{}';await h.panel.click('重新生成');await h.panel.wait('已恢复原回答');expect(await h.panel.text()).toContain('重新生成的新回答');expect(h.requests).toHaveLength(3);await h.panel.screenshot('artifacts/verification/v020-regeneration.png');
});
test('正文失败仍可发送，紧凑输入与长引用预览不丢全文',async()=>{
 await key();await pageQuote();await h.panel.wait('1 条引用');
 const metrics=await h.panel.evaluate<{input:number;line:string;list:number}>("({input:document.querySelector('textarea').getBoundingClientRect().height,line:getComputedStyle(document.querySelector('.quote-item p')).whiteSpace,list:document.querySelector('.quote-list').getBoundingClientRect().height})");expect(metrics.input).toBe(44);expect(metrics.line).toBe('nowrap');expect(metrics.list).toBeLessThanOrEqual(48);
 await h.panel.click('查看网页引用');await h.panel.wait('青色灯塔');await h.panel.click('关闭');
 await h.article.route('**/empty-article.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>无正文</title><body></body>'}));await h.article.goto('http://127.0.0.1:4173/empty-article.html');await h.panel.wait('未读取正文');await ask('没有正文也可以提问');expect(h.requests).toHaveLength(1);expect(JSON.stringify(h.requests[0].messages)).not.toContain('青色灯塔');expect(JSON.stringify(h.requests[0].messages)).toContain('没有正文也可以提问');
});
