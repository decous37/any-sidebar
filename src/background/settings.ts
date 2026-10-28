import {DEFAULTS} from '../shared/models';
import {preferencePatch} from '../shared/validation';
import {Fault,terminal,type PreferencesRecord,type PreferenceValues,type RequestPermit} from '../shared/types';
import {openDatabase} from './database';
import {normalizeAll} from './sessions';
let ready:Promise<void>|undefined;
export function initialize(){return ready??=Promise.all([chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}),chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'})]).then(()=>{});}
export async function getPreferences():Promise<PreferencesRecord>{await initialize();const {preferences}=await chrome.storage.local.get('preferences');return preferences?{...DEFAULTS,...preferences as PreferencesRecord}:{...DEFAULTS,revision:0,updatedAt:Date.now()};}
let queue:Promise<unknown>=Promise.resolve();
export function savePreferences(expected:number,patch:Partial<PreferenceValues>){const work=async()=>{const old=await getPreferences();if(old.revision!==expected)throw new Fault('REVISION_CONFLICT','设置已更新，请重新选择。',true,old.revision);const next={...old,...preferencePatch(patch),revision:old.revision+1,updatedAt:Date.now()};await chrome.storage.local.set({preferences:next});await normalizeAll(next.quoteMode);return next;};const result=queue.then(work);queue=result.catch(()=>{});return result;}
export async function getStatus(){await initialize();return {configured:!!(await chrome.storage.local.get('credential')).credential};}
export async function setKey(value:string|null){await initialize();if(value===null)await chrome.storage.local.remove('credential');else {if(!value.trim()||/[\r\n]/.test(value))throw new Fault('INVALID_ARGUMENT','请填写有效的API Key。');await chrome.storage.local.set({credential:value.trim()});}return getStatus();}
export async function readForRequest(p:RequestPermit){await initialize();const r=await (await openDatabase()).get('requests',p.requestId);if(!r||r.ownerId!==p.ownerId||r.sessionId!==p.sessionId||r.permitToken!==p.token||terminal(r.status))throw new Fault('REQUEST_NOT_ACTIVE','请求许可已失效。');const apiKey=(await chrome.storage.local.get('credential')).credential as string|undefined;if(!apiKey)throw new Fault('CREDENTIAL_REQUIRED','请先在设置中填写DeepSeek API Key。');return {apiKey};}
