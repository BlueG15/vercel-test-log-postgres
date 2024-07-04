import * as pg from "pg" 
import {default as response} from './response';

interface customPoolClient extends pg.PoolClient {
    lastQuery : string | any[]
}

class databaseController {
    //note: property name gets lowercased when fetched
    pool : pg.Pool | undefined = undefined

    //1 sigular query
    query = async (text : string, params? : any[]) => {
        if (!this.pool) return undefined
        try{
            const start = Date.now()
            const res = await this.pool.query(text, params)
            const duration = Date.now() - start
            console.log('executed query', { text, duration }, JSON.stringify(res))
            return res.rows
        } catch(e){
            console.log(`executed query: \n ${text} \n with errors: \n ${e} \n`)
            return [] as any[][]
        }
    }
    //full query returns the full response, just in case you want to check uhh data types? idk
    //example full response is 
    //"{\"command\":\"SELECT\",\"rowCount\":0,\"oid\":null,\"rows\":[],\"fields\":[{\"name\":\"roomid\",\"tableID\":40975,\"columnID\":1,\"dataTypeID\":1043,\"dataTypeSize\":-1,\"dataTypeModifier\":11,\"format\":\"text\"}],\"_parsers\":[null],\"_types\":{\"_types\":{\"arrayParser\":{},\"builtins\":{\"BOOL\":16,\"BYTEA\":17,\"CHAR\":18,\"INT8\":20,\"INT2\":21,\"INT4\":23,\"REGPROC\":24,\"TEXT\":25,\"OID\":26,\"TID\":27,\"XID\":28,\"CID\":29,\"JSON\":114,\"XML\":142,\"PG_NODE_TREE\":194,\"SMGR\":210,\"PATH\":602,\"POLYGON\":604,\"CIDR\":650,\"FLOAT4\":700,\"FLOAT8\":701,\"ABSTIME\":702,\"RELTIME\":703,\"TINTERVAL\":704,\"CIRCLE\":718,\"MACADDR8\":774,\"MONEY\":790,\"MACADDR\":829,\"INET\":869,\"ACLITEM\":1033,\"BPCHAR\":1042,\"VARCHAR\":1043,\"DATE\":1082,\"TIME\":1083,\"TIMESTAMP\":1114,\"TIMESTAMPTZ\":1184,\"INTERVAL\":1186,\"TIMETZ\":1266,\"BIT\":1560,\"VARBIT\":1562,\"NUMERIC\":1700,\"REFCURSOR\":1790,\"REGPROCEDURE\":2202,\"REGOPER\":2203,\"REGOPERATOR\":2204,\"REGCLASS\":2205,\"REGTYPE\":2206,\"UUID\":2950,\"TXID_SNAPSHOT\":2970,\"PG_LSN\":3220,\"PG_NDISTINCT\":3361,\"PG_DEPENDENCIES\":3402,\"TSVECTOR\":3614,\"TSQUERY\":3615,\"GTSVECTOR\":3642,\"REGCONFIG\":3734,\"REGDICTIONARY\":3769,\"JSONB\":3802,\"REGNAMESPACE\":4089,\"REGROLE\":4096}},\"text\":{},\"binary\":{}},\"RowCtor\":null,\"rowAsArray\":false,\"_prebuiltEmptyResultObject\":{\"roomid\":null}}"
    fullQquery = async (text : string, params? : any[]) => {
        if (!this.pool) return undefined
        try{
            const start = Date.now()
            const res = await this.pool.query(text, params)
            const duration = Date.now() - start
            console.log('executed query', { text, duration }, JSON.stringify(res))
            return res
        } catch(e){
            console.log(`executed query: \n ${text} \n with errors: \n ${e} \n`)
            return [] as unknown as pg.QueryArrayResult<any>
        }
    }

    //for multiple sqls in a row, see manual transactions: https://node-postgres.com/features/transactions
    //transactions ussually dotn return shit, so dont use this for SELECT
    getClient = async () => {
        if (!this.pool) return undefined
        const start = Date.now()
        const client = (await this.pool.connect()) as customPoolClient
        client.lastQuery = "DEFAULT_QUERY"
        const query = client.query
        const release = client.release
        // set a timeout of 5 seconds, after which we will log this client's last query
        const timeout = setTimeout(() => {
        console.error('A client has been checked out for more than 5 seconds!')
        console.error(`The last executed query on this client was: ${JSON.stringify(client.lastQuery)}`)
        }, 5000)
        // monkey patch the query method to keep track of the last query executed
        client.query = (...args) => {
            client.lastQuery = args
            return query.apply(client, args)
        }
        client.release = () => {
            // clear our timeout
            clearTimeout(timeout)
            // set the methods back to their old un-monkey-patched version
            client.query = query
            client.release = release
            const duration = Date.now() - start
            console.log(`executed transaction with last query: \n ${client.lastQuery} \n in ${duration}ms`)
            return release.apply(client)
        }
        return client
    }

    //a customized version for just querry text, no interaction beteen querries, no params
    transac = async (queryArr : string[]) => {
        const client = await this.getClient()
        if(!client) return undefined
        let text = "default_query"
        try{
            await client.query('BEGIN')
            queryArr.forEach(async i => {
                try{
                    await client.query(i)
                }catch(e){
                    text = i
                    console.log(i)
                    throw e
                }
            });
            await client.query('COMMIT')
        }catch(e){
            await client.query('ROLLBACK')
            console.error(`executed query: \n ${text} \n with errors: \n ${e} \n`)
            return false
        } finally {
            client.release()
            return true
        }
    }

    sanitizeString = (str : string) => {
        if(!str || !str.length) return "unknownPlayer"
        const reg = new RegExp(/(\W)+|SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|AND|OR|CREATE|ALTER|DROP|TABLE|DATABASE|BEGIN|COMMIT|ROLLBACK/gim)
        str = str.replace(reg, "")
        return (!str || !str.length) ? "unknownPlayer" : str
    }

    getAllTableName = async () => {
        var a = await this.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
        `)
        return a as string[]
    }

    initializeLogTable = async () => {
        await this.transac([
            `DROP TABLE IF EXISTS logs`,
            `CREATE TABLE IF NOT EXISTS logs (
                index INTEGER PRIMARY KEY,
                type VARCHAR(20),
                roomID VARCHAR(10),
                userID VARCHAR(20),
                userName VARCHAR(20),
                logTime VARCHAR(30),
                message TEXT
            );`,
            `INSERT INTO logs (index, type, roomID, userID, userName, logTime, message) VALUES (0, 'default', 'NULL', 'NULL', 'NULL', 'NULL', 'default initial log');`,
            `INSERT INTO logs (index, type, roomID, userID, userName, logTime, message) VALUES (1, 'default', 'NULL', 'NULL', 'NULL', 'NULL', 'default initial log 2');`,
            `INSERT INTO logs (index, type, roomID, userID, userName, logTime, message) VALUES (2, 'default', 'NULL', 'NULL', 'NULL', 'NULL', 'default initial log 3');`,
        ]);
        return
    }

    writeLog = async (type = `NULL`, roomID = `NULL`, userID = `NULL`, userName = `NULL`, messege = `NULL`) => {
        try{
            var logTime = new Date().toISOString()
            var a = await this.query(`SELECT index FROM logs`)
            if(!a) throw new Error("cannot querry")
            let q = `INSERT INTO logs (index, type, roomID, userID, userName, logTime, message) VALUES (${a.length}, '${type}', '${roomID}', '${userID}', '${userName}', '${logTime}', '${messege}');`
            await this.query(q)
            return new response(false, 'writeLog', userName, 'successfully write log', {"playerID": userID, "logPos": a.length, "fullQuery": q})
        }catch(err : any){
            return new response(true, "writeLog", userName, 'fail to write log for some reason', {"errStr": JSON.stringify(err)})
        }
    }
    
    getAllLogs = async () => {
        var a = await this.query(`SELECT * FROM logs`)
        return a
    }
    
    test = async () => {
        var a = await this.query(`SELECT index FROM logs`)
        return a
    }
    
    deleteEarlyLogs = async(n) => {
        if(isNaN(n) || n == Infinity || n <= 0){
            return 
        }
        await this.transac([
            `DELETE FROM logs
            WHERE index BETWEEN 1 AND ${n};`,
            `UPDATE logs
            SET index = index - ${n}
            WHERE index > ${n};`
        ])
    }
    
    cleanAllTablesButLogs = async () => {
        var all = await this.getAllTableName()
        var q = [] as string[]
        all.forEach(i => {
            if(i['table_name'] != 'logs'){
                q.push(`DROP TABLE ${i['table_name']};`)
            }
        })
        await this.transac(q)
        return
    }

    cleanAllTables = async () => {
        var all = await this.getAllTableName()
        var q = [] as string[]
        all.forEach(i => {
            q.push(`DROP TABLE ${i['table_name']};`)
        })
        await this.transac(q)
        return
    }

    constructor(){
        this.pool = new pg.Pool({
            connectionString: process.env.POSTGRES_URL,
        });
    }
}

let dbController = new databaseController();
export default dbController

