/** The same synchronous business transactions run on Durable Object SQLite. */
export function durableSqlAdapter(storage){
 return {
  exec:statement=>storage.sql.exec(statement),
  prepare:statement=>({
   get:(...bindings)=>storage.sql.exec(statement,...bindings).toArray()[0],
   all:(...bindings)=>storage.sql.exec(statement,...bindings).toArray(),
   run:(...bindings)=>{const cursor=storage.sql.exec(statement,...bindings);cursor.toArray();return {changes:cursor.rowsWritten}},
  }),
  transactionSync:fn=>storage.transactionSync(fn),
  close:()=>{},
 };
}
