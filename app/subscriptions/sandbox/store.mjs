import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {WeeklyStore as CoreStore} from './store-core.mjs';
export * from './store-core.mjs';
export class WeeklyStore extends CoreStore {
 constructor(path,options){const database=new DatabaseSync(path);database.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));super(database,options)}
}
