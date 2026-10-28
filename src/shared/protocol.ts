import type {AppError} from './types';
export const VERSION=1;
export const PANEL_COMMANDS=['registerPanel','getActiveBinding','readArticle','getView','changeDraft','prepare','begin','append','finish','fail','stop','retryLastTurn','regenerateLastTurn','restoreSubmission','getPreferences','savePreferences','getStatus','setKey','readForRequest','clearCurrent','clearAll','closePanel'] as const;
export type Command=typeof PANEL_COMMANDS[number];
export interface Envelope {version:1;messageId:string;operationId:string;command:Command;args:Record<string,unknown>}
export type Response={messageId:string;ok:true;data:unknown}|{messageId:string;ok:false;error:AppError};
export interface Update {event:'binding'|'changed'|'cancel';sessionId?:string;requestId?:string}
