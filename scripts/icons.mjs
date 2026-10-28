import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
const svg=await readFile('assets/icon.svg','utf8');
const browser=await chromium.launch({headless:true});
try{const page=await browser.newPage({deviceScaleFactor:1});for(const size of [16,32,48,128]){await page.setViewportSize({width:size,height:size});await page.setContent('<style>html,body{margin:0;background:transparent;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>'+svg);await page.screenshot({path:`public/icons/icon-${size}.png`,omitBackground:true});}}finally{await browser.close();}
