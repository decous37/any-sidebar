/** UI-facing catalog contract. New providers supply models and capabilities here;
 * network adapters and their Chrome permissions must be added separately. */
export interface ModelDefinition {
  id: string;
  label: string;
  thinking: boolean;
  reasoningEfforts: readonly ('low'|'high'|'max')[];
}
export interface ProviderDefinition {
  id: string;
  label: string;
  models: readonly ModelDefinition[];
}
export const PROVIDERS = [{
  id: 'deepseek',
  label: 'DeepSeek',
  models: [
    {id:'deepseek-flash',label:'deepseek-flash',thinking:true,reasoningEfforts:['low','high','max']},
    {id:'deepseek-v4-pro',label:'deepseek-v4-pro',thinking:true,reasoningEfforts:['low','high','max']},
  ],
}] as const satisfies readonly ProviderDefinition[];
export type ModelId = (typeof PROVIDERS)[number]['models'][number]['id'];
export const MODELS = PROVIDERS.flatMap(provider=>provider.models);
export const MODEL_IDS = MODELS.map(model=>model.id);
