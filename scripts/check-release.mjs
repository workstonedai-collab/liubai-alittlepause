import {readdir,readFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));let errors=[];
async function scan(folder){for(const e of await readdir(folder,{withFileTypes:true})){if(e.name.startsWith('.')||['dist','node_modules'].includes(e.name))continue;const p=resolve(folder,e.name);if(e.isDirectory())await scan(p);else if(/\.(m?js)$/.test(p)){const run=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});if(run.status)errors.push(run.stderr);const text=await readFile(p,'utf8');for(const m of text.matchAll(/(?:from\s*|import\s*)['"]([.][^'"]+)['"]/g)){try{await stat(resolve(dirname(p),m[1]));}catch{errors.push('Missing import: '+p+' '+m[1]);}}}}}
await scan(root);if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('JavaScript syntax and relative imports passed.');
