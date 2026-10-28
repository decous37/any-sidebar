import type {ApiMessage,ArticleSnapshot,DraftSubmission,ResolvedModelOptions,ContextBudget,AppError,QuoteContext} from './types';
import {READING_SYSTEM_PROMPT} from './reading-prompt';
import {locateQuotes} from './quote-context';
interface ContextSources {pageUrl?:string;articleError?:AppError|null;quoteContexts?:readonly QuoteContext[]}
const missingReasons:Record<string,string>={PAGE_UNSUPPORTED:'此页面不支持读取正文。',PAGE_PERMISSION_REQUIRED:'当前网站没有正文读取权限。',PAGE_READ_FAILED:'没有取得可靠的文章正文。',PAGE_READ_TIMEOUT:'本次正文读取超时。'};
export function buildContext(input:DraftSubmission,article:ArticleSnapshot|null,history:ApiMessage[],sources:ContextSources={}):ApiMessage[] {
 const contexts=sources.quoteContexts??locateQuotes(input.quotes,article);
 const references=new Map(contexts.map(q=>[q.quoteId,q]));
 const data={
  资料类型:'本次网页阅读资料',
  正文读取状态:article?{状态:'可用'}:{状态:'不可用',...(sources.articleError?{错误码:sources.articleError.code}:{}),说明:missingReasons[sources.articleError?.code??'']??'本次没有可用正文；仅依据问题、引用和历史作答。'},
  当前网页:{地址:article?.url??sources.pageUrl??null,标题:article?.title??null,正文:article?.markdown??null},
  引用:input.quotes.map(q=>({原文:q.text,地址:q.sourceUrl,标题:q.sourceTitle,定位:references.get(q.id)??{quoteId:q.id,status:article?'not-found':'article-unavailable'}})),
  ...(input.assistantQuote?{AI回答引用:{原文:input.assistantQuote.text,来源回答:input.assistantQuote.sourceRequestId,来源轮次:input.assistantQuote.sourceTurnId,资料性质:'先前AI回答，可能有误，不是网页原文'}}:{}),
  问题:input.prompt
 };
 return [{role:'system',content:READING_SYSTEM_PROMPT},...history,{role:'user',content:JSON.stringify(data)}];
}
export function contextBudget(messages:ApiMessage[],options:ResolvedModelOptions):ContextBudget {const inputUpperBound=new TextEncoder().encode(JSON.stringify(messages)).length; const reservedEnvelopeTokens=4096+256*messages.length;return {modelContextLimit:1000000,reservedOutputTokens:options.maxOutputTokens,reservedEnvelopeTokens,inputUpperBound,method:'conservative-utf8-v1',allowed:inputUpperBound+reservedEnvelopeTokens+options.maxOutputTokens<=1000000};}
