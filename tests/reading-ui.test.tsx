import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,act} from '@testing-library/react';
import TooltipButton from '../src/sidepanel/TooltipButton';
import MessageList from '../src/sidepanel/MessageList';
import type {SessionView} from '../src/shared/types';
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
it('提示延迟、焦点、Esc及点击关闭，按钮无原生title',()=>{
 vi.useFakeTimers();render(<TooltipButton tip="复制" aria-label="复制回答">Copy</TooltipButton>);const button=screen.getByRole('button');
 expect(button.hasAttribute('title')).toBe(false);fireEvent.pointerEnter(button);act(()=>vi.advanceTimersByTime(349));expect(screen.queryByRole('tooltip')).toBeNull();act(()=>vi.advanceTimersByTime(1));expect(screen.getByRole('tooltip').textContent).toBe('复制');fireEvent.keyDown(document,{key:'Escape'});expect(screen.queryByRole('tooltip')).toBeNull();
 act(()=>button.focus());expect(screen.getByRole('tooltip')).toBeTruthy();fireEvent.click(button);expect(screen.queryByRole('tooltip')).toBeNull();fireEvent.pointerEnter(button);fireEvent.pointerLeave(button);act(()=>vi.advanceTimersByTime(400));expect(screen.queryByRole('tooltip')).toBeNull();
});
it('流式回答和布局改变只在跟随时滚底，点击到底恢复跟随',()=>{
 let resize=()=>{};vi.stubGlobal('ResizeObserver',class{constructor(fn:()=>void){resize=fn;}observe(){}disconnect(){}});
 const view:SessionView={session:{id:'s',pageKey:'p',canonicalUrl:'https://example.com',revision:0,nextTurnOrder:1,activeRequestId:'r',createdAt:0,updatedAt:0},draft:{sessionId:'s',revision:0,promptRevision:0,prompt:'',includeArticle:true,quotes:[],updatedAt:0},turns:[],nextBeforeOrder:null};
 const {container}=render(<MessageList view={view} busy={false} onRetry={()=>{}} onRegenerate={()=>{}} onRestore={()=>{}} onOlder={()=>{}} onQuote={()=>{}} onClearQuote={()=>{}}/>);
 const el=container.querySelector('.messages') as HTMLDivElement;let height=2000;Object.defineProperties(el,{scrollHeight:{get:()=>height},clientHeight:{value:500}});el.scrollTo=vi.fn((options?:ScrollToOptions|number)=>{el.scrollTop=typeof options==='object'?options.top!:options??0;fireEvent.scroll(el);});
 act(()=>resize());expect(el.scrollTop).toBe(2000);el.scrollTop=300;fireEvent.scroll(el);expect(screen.getByLabelText('到底部')).toBeTruthy();height=2400;act(()=>resize());expect(el.scrollTop).toBe(300);
 fireEvent.click(screen.getByLabelText('到底部'));expect(el.scrollTo).toHaveBeenCalled();expect(screen.queryByLabelText('到底部')).toBeNull();height=2600;act(()=>resize());expect(el.scrollTop).toBe(2600);
});
