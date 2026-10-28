import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {launch,type Harness} from './harness';
let h:Harness;
test.beforeEach(async()=>{h=await launch();});test.afterEach(async()=>{await h?.close();});
test('轻盈界面：白色输入、紧凑正文状态、单行提示与亮暗窄屏',async()=>{
 const measurements=[];
 for(const theme of ['light','dark']){
  await h.panel.click('打开设置');await h.panel.select('主题',theme);await h.panel.click('关闭设置');
  await expect.poll(()=>h.panel.evaluate('document.documentElement.dataset.theme')).toBe(theme);
  for(const width of [320,480,600]){
   await h.panel.raw('Emulation.setDeviceMetricsOverride',{width,height:850,deviceScaleFactor:1,mobile:false});
   const result=await h.panel.evaluate<{width:number;overflow:boolean;contextHeight:number;caption:string;background:string;contrast:number;controlsVisible:boolean}>(`(()=>{
    const composer=document.querySelector('.composer'),context=document.querySelector('.composer-context'),caption=document.querySelector('.composer-caption');
    const root=getComputedStyle(document.documentElement);const rgb=x=>{const e=document.createElement('span');e.style.color=x;document.body.append(e);const n=getComputedStyle(e).color.match(/[\\d.]+/g).map(Number);e.remove();return n;};
    const luminance=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const a=luminance(rgb(root.getPropertyValue('--secondary'))),b=luminance(rgb(root.getPropertyValue('--bg')));
    const controlsVisible=[...document.querySelectorAll('.composer-bottom button')].every(e=>{const r=e.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;});
    return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,contextHeight:context.getBoundingClientRect().height,caption:caption.textContent,background:getComputedStyle(composer).backgroundColor,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),controlsVisible};
   })()`);
   expect(result.width).toBe(width);expect(result.overflow).toBe(false);expect(result.contextHeight).toBeLessThanOrEqual(32);expect(result.caption).toBe('AI可能会出错，请注意甄别');expect(result.contrast).toBeGreaterThanOrEqual(4.5);expect(result.controlsVisible).toBe(true);if(theme==='light')expect(result.background).toBe('rgb(255, 255, 255)');
   expect(await h.panel.text()).not.toContain('对话仅保存在此浏览器');expect(await h.panel.text()).not.toContain('仅发送问题时，相关内容才会提交给 DeepSeek。');
   if(width===480)await h.panel.screenshot('artifacts/verification/sidebar-'+theme+'.png');
   measurements.push({theme,...result});
  }
 }
 await writeFile('artifacts/verification/layout.json',JSON.stringify(measurements,null,2));
});
test('本地阅读性能：大正文、划选和主题反馈',async()=>{
 const start=Date.now();await h.article.goto('http://127.0.0.1:4173/large-article.html');await h.panel.wait('长文章测试');await h.panel.wait('已读取文章正文');const articleMs=Date.now()-start;expect(articleMs).toBeLessThan(3000);
 const quoteStart=Date.now();await h.article.evaluate(()=>{const r=document.createRange();const n=document.querySelector('article p')!.firstChild!;r.setStart(n,0);r.setEnd(n,30);const s=getSelection()!;s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('pointerup'));});await h.panel.wait('1 条引用');const quoteMs=Date.now()-quoteStart;expect(quoteMs).toBeLessThan(300);
 const themeStart=Date.now();const before=await h.panel.evaluate('document.documentElement.dataset.theme');await h.panel.click('切换亮暗主题');await expect.poll(()=>h.panel.evaluate('document.documentElement.dataset.theme')).not.toBe(before);const themeMs=Date.now()-themeStart;expect(themeMs).toBeLessThan(300);
 await writeFile('artifacts/verification/performance.json',JSON.stringify({browser:h.context.browser()?.version(),articleMs,quoteMs,themeMs,scope:'Chromium 自动化；正文数字包含本机夹具导航耗时，不代替真实 Chrome 的完整性能验收'},null,2));
});
test('无Key的一键提问：保留问题并打开配置，不调用模型',async()=>{
 await h.panel.click('总结这篇文章');await h.panel.wait('请先填写 API Key');expect(h.requests).toHaveLength(0);await h.panel.click('确定');await h.panel.click('关闭设置');expect(await h.panel.evaluate("document.querySelector('textarea').value")).toBe('总结这篇文章');
});
