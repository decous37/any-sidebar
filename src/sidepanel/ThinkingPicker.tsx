import {Brain,ChevronDown} from 'lucide-react';
import {MODELS} from '../shared/providers';
import type {PreferenceValues,ReasoningEffort} from '../shared/types';
export default function ThinkingPicker({prefs,disabled,onChange}:{prefs:PreferenceValues;disabled:boolean;onChange:(patch:Partial<PreferenceValues>)=>void}){
 const model=MODELS.find(m=>m.id===prefs.model),enabled=!!(prefs.thinkingEnabled&&model?.thinking),unavailable=disabled||!model?.thinking;
 return <label className="thinking-picker picker-control" data-enabled={enabled} data-disabled={unavailable}>
  <span className="visually-hidden">思考强度</span><Brain size={13}/><span className="picker-value" aria-hidden="true">{enabled?'思考·'+{low:'低',high:'高',max:'最高'}[prefs.reasoningEffort]:'关闭思考'}</span>
  <select aria-label="思考强度" value={enabled?prefs.reasoningEffort:'off'} disabled={unavailable} onChange={e=>{const value=e.target.value;onChange(value==='off'?{thinkingEnabled:false}:{thinkingEnabled:true,reasoningEffort:value as ReasoningEffort});}}>
   <option value="off">关闭思考</option>{model?.reasoningEfforts.map(e=><option key={e} value={e}>思考·{{low:'低',high:'高',max:'最高'}[e]}</option>)}
  </select><ChevronDown size={11}/>
 </label>;
}
