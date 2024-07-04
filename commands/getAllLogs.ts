import type { VercelRequest, VercelResponse } from '@vercel/node'
import {default as db} from "../dbControl/dbControl"
//max 9 seconds

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let all = (await db.getAllTableName()).map(i => i['table_name']);
  if(!all.includes('logs')){
    await db.initializeLogTable();
  }
  let r = await db.getAllLogs();
  res.status(200).send(JSON.stringify(r, null, 4));
}
