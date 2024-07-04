import type { VercelRequest, VercelResponse } from '@vercel/node'
import {default as response} from "../dbControl/response"
import {default as db} from "../dbControl/dbControl"
//max 9 seconds

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let allPrev = (await db.getAllTableName())
  let all = allPrev.map(i => i['table_name']);
  if(!all.includes('logs')){
    let x = new response(true, "getAllLogs", "NULL", "NULL", allPrev)
    res.status(404).send(JSON.stringify(x))
    return;
  }
  let r = await db.getAllLogs();
  res.status(200).send(JSON.stringify(r, null, 4));
}
