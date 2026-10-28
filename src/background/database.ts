import {openDB,type DBSchema,type IDBPTransaction} from 'idb';
import {Fault,type SessionRecord,type DraftRecord,type TurnRecord,type GenerationRecord,type RequestSnapshot,type OperationReceipt,type OperationContext} from '../shared/types';
export interface DatabaseSchema extends DBSchema {
 sessions:{key:string;value:SessionRecord;indexes:{pageKey:string}};drafts:{key:string;value:DraftRecord};
 turns:{key:string;value:TurnRecord;indexes:{sessionId:string;sessionOrder:[string,number]}};
 requests:{key:string;value:GenerationRecord;indexes:{sessionId:string;ownerId:string}};
 snapshots:{key:string;value:RequestSnapshot;indexes:{sessionId:string}};
 operations:{key:string;value:OperationReceipt;indexes:{scopeId:string}};
}
const stores=['sessions','drafts','turns','requests','snapshots','operations'] as const;
let connection:ReturnType<typeof openDB<DatabaseSchema>>|undefined;
export function openDatabase(){return connection??=openDB<DatabaseSchema>('deepseek-sidebar',1,{upgrade(db){db.createObjectStore('sessions',{keyPath:'id'}).createIndex('pageKey','pageKey',{unique:true});db.createObjectStore('drafts',{keyPath:'sessionId'});const turns=db.createObjectStore('turns',{keyPath:'id'});turns.createIndex('sessionId','sessionId');turns.createIndex('sessionOrder',['sessionId','order'],{unique:true});const requests=db.createObjectStore('requests',{keyPath:'id'});requests.createIndex('sessionId','sessionId');requests.createIndex('ownerId','ownerId');db.createObjectStore('snapshots',{keyPath:'id'}).createIndex('sessionId','sessionId');db.createObjectStore('operations',{keyPath:'operationId'}).createIndex('scopeId','scopeId');},blocking(){void connection?.then(db=>db.close());connection=undefined;},terminated(){connection=undefined;}}).catch(()=>{connection=undefined;throw new Fault('SCHEMA_MIGRATION_FAILED','本机记录打开失败，已有数据未被删除。',true);});}
export type Tx=IDBPTransaction<DatabaseSchema,typeof stores,'readwrite'>;
export async function transaction<T>(work:(tx:Tx)=>Promise<T>):Promise<T>{const db=await openDatabase();const tx=db.transaction(stores,'readwrite');try{const result=await work(tx);await tx.done;return result;}catch(e){try{tx.abort();}catch{}await tx.done.catch(()=>{});if(e instanceof Fault)throw e;throw new Fault('STORAGE_FAILED','保存失败，请检查本机可用空间。',true);}}
export async function receipt(tx:Tx,op:OperationContext,kind:string,scopeId:string|null){const old=await tx.objectStore('operations').get(op.operationId);if(old&&(old.ownerId!==op.ownerId||old.kind!==kind||old.scopeId!==scopeId))throw new Fault('INVALID_ARGUMENT','操作标识冲突。');return old;}
export async function record(tx:Tx,op:OperationContext,kind:string,scopeId:string|null,resultRef:string|null=null,resultRevision:number|null=null){await tx.objectStore('operations').put({operationId:op.operationId,ownerId:op.ownerId,kind,scopeId,resultRef,resultRevision,createdAt:Date.now()});}
