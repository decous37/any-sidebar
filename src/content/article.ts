import {Readability} from '@mozilla/readability';
import TurndownService from 'turndown';
import {gfm} from 'turndown-plugin-gfm';
import {Fault,type PageBinding,type ArticleSnapshot} from '../shared/types';
const excluded='script,style,noscript,input,textarea,select,button,form,[contenteditable]:not([contenteditable="false"]),iframe,object,embed,img,picture,video,audio,source,link,meta,svg,canvas,[hidden],[aria-hidden="true"]';
export function filteredDocument(source:Document):Document {
 const copy=source.implementation.createHTMLDocument(source.title);
 function clone(node:Node):Node|null {if(node.nodeType===Node.TEXT_NODE)return copy.createTextNode(node.textContent??'');if(!(node instanceof Element)||node.matches(excluded))return null; const el=copy.createElement(node.tagName.toLowerCase()); for(const name of ['id','class','colspan','rowspan'])if(node.hasAttribute(name))el.setAttribute(name,node.getAttribute(name)!);for(const child of node.childNodes){const next=clone(child);if(next)el.append(next);}return el;}
 const body=clone(source.body);if(body)copy.body.replaceChildren(...body.childNodes);return copy;
}
export function extractArticle(source:Document,binding:PageBinding):ArticleSnapshot {
 const filtered=filteredDocument(source);const parsed=new Readability(filtered,{charThreshold:80}).parse();if(!parsed?.content||!parsed.textContent?.trim()||parsed.textContent.trim().length<80)throw new Fault('PAGE_READ_FAILED','没有找到可靠的文章正文，可选中文字或直接提问。',true);
 const td=new TurndownService({codeBlockStyle:'fenced',headingStyle:'atx'});td.use(gfm);
 // Keep empty headers explicit instead of inventing column names.
 td.addRule('plainTable',{filter:'table',replacement:(_content,node)=>{const rows=Array.from((node as HTMLTableElement).rows);if(!rows.length)return '';const width=Math.max(...rows.map(r=>r.cells.length));if(rows.some(r=>Array.from(r.cells).some(c=>c.colSpan!==1||c.rowSpan!==1)))throw new Fault('PAGE_READ_FAILED','此表格结构暂时无法完整读取，请改为划选引用。',true);const values=rows.map(r=>Array.from(r.cells).map(c=>(c.textContent??'').trim().replace(/\|/g,'\\|').replace(/\s*\n\s*/g,' ')));const header=rows[0].querySelector('th')?values.shift()!:Array(width).fill('') as string[];return '\n\n'+[header,Array(width).fill('---'),...values].map(r=>'| '+Array.from({length:width},(_,i)=>r[i]??'').join(' | ')+' |').join('\n')+'\n\n';}});
 const markdown=td.turndown(parsed.content).trim();let hash=2166136261;for(let i=0;i<markdown.length;i++)hash=Math.imul(hash^markdown.charCodeAt(i),16777619);
 return {id:binding.id+':'+Date.now(),bindingId:binding.id,pageKey:binding.pageKey,url:binding.url,title:parsed.title||source.title,markdown,contentDigest:(hash>>>0).toString(16),capturedAt:Date.now()};
}
