import {it,expect} from 'vitest';
import {initialize,getPreferences,getStatus,setKey,savePreferences,readForRequest} from '../src/background/settings';
import {registerPanel} from '../src/background/coordinator';
it('可信初始化、凭据管理及偏好一致性',async()=>{await initialize();expect(chrome.storage.local.setAccessLevel).toHaveBeenCalledWith({accessLevel:'TRUSTED_CONTEXTS'});await setKey('TEST_ONLY_SECRET');expect(await getStatus()).toEqual({configured:true});const p=await getPreferences();expect(p.model).toBe('deepseek-flash');await savePreferences(p.revision,{quoteMode:'latest'});await expect(savePreferences(p.revision,{theme:'dark'})).rejects.toMatchObject({code:'REVISION_CONFLICT'});await setKey(null);expect(await getStatus()).toEqual({configured:false});});
it('凭据许可与消息来源拒绝伪造',async()=>{await expect(readForRequest({sessionId:'fake',requestId:'fake',ownerId:'fake',token:'fake'})).rejects.toThrow();await expect(registerPanel({id:'web',documentId:'fake',url:'https://example.com'},1)).rejects.toThrow();expect((await registerPanel({id:chrome.runtime.id,documentId:'doc',url:chrome.runtime.getURL('sidepanel.html?instance=00000000-0000-4000-8000-000000000000')},1)).documentId).toBe('doc');});
it('旧偏好默认13px，四档字号保留其他设置并拒绝非法值',async()=>{
 const old=await getPreferences();const legacy:Partial<typeof old>={...old};delete legacy.fontSize;await chrome.storage.local.set({preferences:legacy});
 expect((await getPreferences()).fontSize).toBe(13);
 for(const fontSize of [12,13,14,16] as const){const before=await getPreferences();const next=await savePreferences(before.revision,{fontSize});expect(next.fontSize).toBe(fontSize);expect(next.model).toBe(before.model);expect((await getPreferences()).fontSize).toBe(fontSize);}
 const p=await getPreferences();await expect(savePreferences(p.revision,{fontSize:15 as 13})).rejects.toMatchObject({code:'INVALID_ARGUMENT'});expect((await getPreferences()).fontSize).toBe(p.fontSize);
});
