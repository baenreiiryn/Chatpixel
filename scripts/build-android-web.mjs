import {rename,access,mkdtemp,rmdir} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import path from 'node:path';import os from 'node:os';
const api=path.join(process.cwd(),'app/api'),scratch=await mkdtemp(path.join(os.tmpdir(),'chatpixel-export-')),parked=path.join(scratch,'api');let moved=false;
try{try{await access(api);await rename(api,parked);moved=true;}catch(error){if(error.code!=='ENOENT')throw error;}
 const result=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit',env:{...process.env,CHATPIXEL_ANDROID_EXPORT:'1',NEXT_TELEMETRY_DISABLED:'1'}});if(result.status!==0)process.exitCode=result.status||1;
}finally{if(moved)await rename(parked,api);await rmdir(scratch);}
