import type {PreferenceValues, ResolvedModelOptions} from './types';
export const ENDPOINT = 'https://api.deepseek.com/chat/completions';
export const DEFAULTS:PreferenceValues = {fontSize:13,theme:'system',quoteMode:'accumulate',model:'deepseek-flash',thinkingEnabled:true,reasoningEffort:'high'};
export function resolveOptions(p:PreferenceValues):ResolvedModelOptions {return {model:p.model,thinkingEnabled:p.thinkingEnabled,reasoningEffort:p.thinkingEnabled?p.reasoningEffort:null,maxOutputTokens:!p.thinkingEnabled?8192:p.reasoningEffort==='max'?131072:65536};}
export function apiOptions(o:ResolvedModelOptions) {return {model:o.model,thinking:{type:o.thinkingEnabled?'enabled':'disabled'},reasoning_effort:o.reasoningEffort??'none',max_tokens:o.maxOutputTokens,stream:true};}
