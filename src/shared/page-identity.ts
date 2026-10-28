export function pageKey(address:string,elementAnchor=false):string {
  const u=new URL(address); const hash=u.hash;
  if(elementAnchor || hash.startsWith('#:~:text=')) u.hash='';
  return u.href;
}
export const readable = (address:string) => /^https?:\/\//.test(address) && !/^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/.test(address);
