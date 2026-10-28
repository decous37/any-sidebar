import {connect,acceptCapture,startup,refreshWindows,owners,closePanel} from './coordinator';
const ready=startup();
chrome.runtime.onConnect.addListener(port=>connect(port,ready));
chrome.runtime.onMessage.addListener((raw,sender)=>{void ready.then(()=>acceptCapture(raw,sender)).catch(()=>{});});
chrome.runtime.onInstalled.addListener(()=>{void chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});});
chrome.tabs.onActivated.addListener(info=>{void ready.then(()=>refreshWindows(info.windowId));});
const navigate=(d:{tabId:number;frameId:number})=>{if(d.frameId!==0)return;void ready.then(async()=>{const list=await chrome.tabs.get(d.tabId).catch(()=>null);if(list?.active)await refreshWindows(list.windowId);});};
chrome.webNavigation.onCommitted.addListener(navigate);
// A committed redirect may precede the final document/tab metadata. Reconcile
// once loading finishes so the open sidebar always follows the final article.
chrome.webNavigation.onCompleted.addListener(navigate);
chrome.webNavigation.onHistoryStateUpdated.addListener(navigate);
chrome.webNavigation.onReferenceFragmentUpdated.addListener(navigate);
chrome.permissions.onAdded.addListener(()=>{void ready.then(()=>refreshWindows());});
chrome.permissions.onRemoved.addListener(()=>{void ready.then(()=>refreshWindows());});
chrome.sidePanel.onOpened.addListener(d=>{void ready.then(()=>refreshWindows(d.windowId));});
chrome.sidePanel.onClosed.addListener(d=>{void ready.then(async()=>{for(const o of Object.values(await owners()))if(o.open&&o.windowId===d.windowId)await closePanel(o.id);});});
chrome.windows.onRemoved.addListener(id=>{void ready.then(async()=>{for(const o of Object.values(await owners()))if(o.open&&o.windowId===id)await closePanel(o.id);});});
