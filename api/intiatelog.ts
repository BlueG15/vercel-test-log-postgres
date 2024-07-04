import type { VercelRequest, VercelResponse } from '@vercel/node'
import {default as response} from "../dbControl/response"
import {default as db} from "../dbControl/dbControl"
//max 9 seconds

export default async function handler(req: VercelRequest, res: VercelResponse) {
    await db.initializeLogTable();
    let r = new response(false, "initializeLogTable", 'NULL', 'NULL')
    res.status(200).send(JSON.stringify(r, null, 4))
}
