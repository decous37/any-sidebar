import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import {pageKey} from './page-identity';
import type {ArticleSnapshot,Quote,QuoteContext} from './types';
interface Node {type:string;value?:string;depth?:number;children?:Node[]}
interface Heading {rawAt:number;at:number;depth:number;text:string}
interface Projection {raw:string;text:string;headings:Heading[]}
const parser=unified().use(remarkParse).use(remarkGfm);
const whitespace=(text:string)=>text.replace(/\s+/gu,' ').trim();
/** A visible-text projection: strip formatting, never code tokens or link labels. */
function project(markdown:string):Projection {
 const raw:string[]=[],normalized:string[]=[],headings:Heading[]=[];let rawLength=0,length=0,lastSpace=true;
 function append(value:string){raw.push(value);rawLength+=value.length;for(const part of value.split(/(\s+)/u)){if(!part)continue;if(/^\s/u.test(part)){if(!lastSpace){normalized.push(' ');length++;lastSpace=true;}}else{normalized.push(part);length+=part.length;lastSpace=false;}}}
 function inline(node:Node):string {return node.value??node.children?.map(inline).join('')??'';}
 function visit(node:Node){
  if(['html','image','imageReference','definition','footnoteDefinition'].includes(node.type))return;
  if(['text','inlineCode','code'].includes(node.type)){if(node.type==='code')append('\n');append(node.value??'');if(node.type==='code')append('\n');return;}
  if(node.type==='break'||node.type==='thematicBreak'){append('\n');return;}
  const block=['root','heading','paragraph','blockquote','list','listItem','table','tableRow','tableCell'].includes(node.type);
  if(block)append('\n');
  if(node.type==='heading')headings.push({rawAt:rawLength,at:length,depth:node.depth??1,text:whitespace(inline(node))});
  for(const child of node.children??[])visit(child);
  if(block)append('\n');
 }
 visit(parser.parse(markdown));return {raw:raw.join(''),text:normalized.join(''),headings};
}
function occurrence(text:string,needle:string){if(!needle)return {index:-1,ambiguous:false};const index=text.indexOf(needle);return {index,ambiguous:index>=0&&text.indexOf(needle,index+1)>=0};}
function sameSource(quote:Quote,article:ArticleSnapshot){try{return quote.pageKey===article.pageKey&&pageKey(quote.sourceUrl,true)===pageKey(article.url,true);}catch{return false;}}
/** Parse once per article. Ambiguous visible matches never inherit the first section. */
export function locateQuotes(quotes:readonly Quote[],article:ArticleSnapshot|null):QuoteContext[] {
 const eligible=article&&quotes.some(q=>sameSource(q,article));let projection:Projection|null=null;
 if(eligible)try{projection=project(article.markdown);}catch{/* Unlocatable references can still be sent alongside the complete article. */}
 return quotes.map(quote=>{
  const base={quoteId:quote.id};if(!article)return {...base,status:'article-unavailable'};
  if(!sameSource(quote,article))return {...base,status:'source-mismatch'};
  if(!projection)return {...base,status:'not-found'};
  const exact=occurrence(projection.raw,quote.text),needle=whitespace(quote.text),normalized=occurrence(projection.text,needle);
  // An exact occurrence still needs this check: another copy may use bold, links or different whitespace.
  if(normalized.ambiguous||exact.ambiguous)return {...base,status:'ambiguous'};
  if(normalized.index<0)return {...base,status:'not-found'};
  const useExact=exact.index>=0,text=useExact?projection.raw:projection.text,index=useExact?exact.index:normalized.index,end=index+(useExact?quote.text.length:needle.length);
  const path:Heading[]=[];for(const heading of projection.headings){if((useExact?heading.rawAt:heading.at)>index)break;while(path.length&&path.at(-1)!.depth>=heading.depth)path.pop();path.push(heading);}
  return {...base,status:'matched',headingPath:path.map(h=>h.text),before:Array.from(text.slice(0,index)).slice(-400).join('').trim(),after:Array.from(text.slice(end)).slice(0,400).join('').trim()};
 });
}
