import type { VercelRequest, VercelResponse } from '@vercel/node'
import {default as response} from "../dbControl/response"
import {default as db} from "../dbControl/dbControl"
//max 9 seconds

function getPropertyNameFromReqObject(req : VercelRequest, propertyName : string, defaultValue? : any){
    let res : any = defaultValue
    if (req.body && req.body[propertyName]) {
        res = req.body[propertyName];
    } else if (req.query[propertyName]) {
        res = req.query[propertyName];
    } else if (req.cookies[propertyName]) {
        res = req.cookies[propertyName];
    }
    return res
}

export default async function handler(req: VercelRequest, res: VercelResponse) {

    let allPrev = (await db.getAllTableName())
    let all = allPrev.map(i => i['table_name']);
    if(!all.includes('logs')){
        let x = new response(true, "getAllLogs", "NULL", "NULL", allPrev)
        res.status(404).send(JSON.stringify(x))
        return;
    }

    let logType = getPropertyNameFromReqObject(req, "type");
    let roomID = getPropertyNameFromReqObject(req, "room");
    let userName = getPropertyNameFromReqObject(req, "name");
    let userID = getPropertyNameFromReqObject(req, "uid")
    let logMessege = getPropertyNameFromReqObject(req, "messege");
    
    let r = await db.writeLog(logType, roomID, userID, userName, logMessege);
    res.status(200).send(JSON.stringify(r, null, 4));
}
