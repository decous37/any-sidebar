import {createRoot} from 'react-dom/client';
import App from './App';
import './styles.css';
const instance=new URL(location.href).searchParams.get('instance');
if(!instance)location.replace(chrome.runtime.getURL('sidepanel.html')+'?instance='+crypto.randomUUID());
else createRoot(document.getElementById('root')!).render(<App/>);
