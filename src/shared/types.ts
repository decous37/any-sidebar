import type {ModelId} from './providers';
export type {ModelId} from './providers';
export type ReasoningEffort = 'low' | 'high' | 'max';
export type ThemePreference = 'system' | 'light' | 'dark';
export type QuoteMode = 'accumulate' | 'latest';
export type ReadingStatus = 'idle' | 'reading' | 'ready' | 'unsupported' | 'permission-required' | 'failed';
export type GenerationStatus = 'preparing' | 'prepared' | 'connecting' | 'streaming' | 'complete' | 'failed' | 'stopped' | 'interrupted' | 'truncated';
export type ErrorCode = 'PAGE_UNSUPPORTED' | 'PAGE_PERMISSION_REQUIRED' | 'PAGE_READ_FAILED' | 'PAGE_READ_TIMEOUT' | 'PAGE_CHANGED' | 'SESSION_NOT_FOUND' | 'REVISION_CONFLICT' | 'REQUEST_BUSY' | 'REQUEST_NOT_ACTIVE' | 'TURN_NOT_RETRYABLE' | 'OWNER_CLOSED' | 'CREDENTIAL_REQUIRED' | 'AUTH_FAILED' | 'INSUFFICIENT_BALANCE' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'API_ERROR' | 'API_BAD_RESPONSE' | 'CONTEXT_TOO_LARGE' | 'STORAGE_FAILED' | 'SCHEMA_MIGRATION_FAILED' | 'INVALID_MESSAGE' | 'INVALID_ARGUMENT';
export interface AppError { code: ErrorCode; message: string; retryable: boolean; currentRevision?: number }
export class Fault extends Error implements AppError {
  constructor(public code: ErrorCode, message: string, public retryable = false, public currentRevision?: number) { super(message); }
}
export function safeError(e: unknown): AppError { return e instanceof Fault ? {code:e.code,message:e.message,retryable:e.retryable,...(e.currentRevision === undefined ? {} : {currentRevision:e.currentRevision})} : {code:'STORAGE_FAILED',message:'操作未能保存，请检查本机空间后重试。',retryable:true}; }
export type PageKey = string;
export interface PanelOwner {id:string; documentId:string; windowId:number; open:boolean; registeredAt:number}
export interface PageBinding {id:string;ownerId:string;windowId:number;tabId:number;documentId:string|null;url:string;pageKey:PageKey;readingStatus:ReadingStatus;revision:number}
export interface ArticleSnapshot {id:string;bindingId:string;pageKey:PageKey;url:string;title:string;markdown:string;contentDigest:string;capturedAt:number}
export interface Quote {id:string;pageKey:PageKey;sourceUrl:string;sourceTitle:string;bindingId:string;text:string;selectedAt:number}
export type QuoteContext = {quoteId:string} & ({status:'matched';headingPath:string[];before:string;after:string}|{status:'ambiguous'|'not-found'|'source-mismatch'|'article-unavailable'});
export interface AssistantQuote {id:string;sourceTurnId:string;sourceRequestId:string;text:string;selectedAt:number}
export interface DraftRecord {assistantQuote?:AssistantQuote|null;sessionId:string;revision:number;promptRevision:number;prompt:string;quotes:Quote[];includeArticle:boolean;updatedAt:number}
export interface DraftSubmission {assistantQuote?:AssistantQuote|null;prompt:string;quotes:Quote[];includeArticle:boolean;draftRevision:number;promptRevision:number}
export interface SessionRecord {id:string;pageKey:PageKey;canonicalUrl:string;revision:number;nextTurnOrder:number;activeRequestId:string|null;createdAt:number;updatedAt:number}
export interface TurnRecord {assistantQuote?:AssistantQuote|null;id:string;sessionId:string;order:number;question:string;quotes:Quote[];activeRequestId:string;completedRequestId:string|null;createdAt:number}
export interface ApiMessage {role:'system'|'user'|'assistant';content:string}
export interface ResolvedModelOptions {model:ModelId;thinkingEnabled:boolean;reasoningEffort:ReasoningEffort|null;maxOutputTokens:number}
export interface ContextBudget {modelContextLimit:number;reservedOutputTokens:number;reservedEnvelopeTokens:number;inputUpperBound:number;method:string;allowed:boolean}
export interface RequestSnapshot {promptVersion?:string;articleError?:AppError|null;id:string;sessionId:string;turnId:string;submission:DraftSubmission;article:ArticleSnapshot|null;historyRefs:{turnId:string;requestId:string}[];apiMessages:ApiMessage[];options:ResolvedModelOptions;budget:ContextBudget;createdAt:number}
export interface GenerationRecord {regeneration?:boolean;id:string;sessionId:string;turnId:string;ownerId:string;submission:DraftSubmission;permitToken:string|null;snapshotId:string|null;status:GenerationStatus;answer:string;reasoning:string;lastSequence:number;finishReason:string|null;error:AppError|null;createdAt:number;updatedAt:number}
export interface RequestPermit {sessionId:string;requestId:string;ownerId:string;token:string}
export interface PreparedRequest {generation:GenerationRecord;snapshot:RequestSnapshot;permit:RequestPermit}
export interface OperationContext {operationId:string;ownerId:string}
export interface OperationReceipt {operationId:string;ownerId:string;kind:string;scopeId:string|null;resultRef:string|null;resultRevision:number|null;createdAt:number}
export interface StreamDelta {sequence:number;answerDelta:string;reasoningDelta:string}
export type DraftChange = {kind:'prompt';value:string}|{kind:'removeQuote';id:string}|{kind:'includeArticle';value:boolean}|{kind:'assistantQuote';value:AssistantQuote}|{kind:'removeAssistantQuote';id:string};
export type FontSize = 12|13|14|16;
export interface PreferenceValues {fontSize:FontSize;theme:ThemePreference;quoteMode:QuoteMode;model:ModelId;thinkingEnabled:boolean;reasoningEffort:ReasoningEffort}
export interface PreferencesRecord extends PreferenceValues {revision:number;updatedAt:number}
export interface CredentialStatus {configured:boolean}
export interface CredentialValue {apiKey:string}
export type ReplyView = Pick<GenerationRecord,'status'|'answer'|'reasoning'|'error'> & {requestId:string;options:ResolvedModelOptions|null;retryable:boolean;displayRequestId?:string;restoredAnswer?:boolean};
export interface TurnView {turn:TurnRecord;reply:ReplyView}
export interface SessionView {session:SessionRecord;draft:DraftRecord;turns:TurnView[];nextBeforeOrder:number|null}
export interface DeleteResult {scope:'current'|'all';deletedSessions:number;cancelledRequestIds:string[]}
export const terminal = (s:GenerationStatus) => ['complete','failed','stopped','interrupted','truncated'].includes(s);
