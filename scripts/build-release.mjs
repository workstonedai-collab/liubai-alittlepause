import {mkdir,rm,cp,readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url)),web=resolve(root,'dist/web');
const filter=p=>!/(?:^|\/)(?:node_modules|verification|\.DS_Store)(?:\/|$)/.test(p)&&!p.endsWith('.cjs')&&!p.endsWith('.md');
await rm(web,{recursive:true,force:true});await mkdir(web,{recursive:true});
await cp(join(root,'public'),web,{recursive:true,filter});
await cp(join(root,'apps/web'),join(web,'apps/web'),{recursive:true,filter});
await cp(join(root,'packages'),join(web,'packages'),{recursive:true,filter});
for(const e of await readdir(web)){if(e.endsWith('.js')){const p=join(web,e);await writeFile(p,(await readFile(p,'utf8')).replaceAll("'../apps/","'./apps/").replaceAll("'../packages/","'./packages/"));}}
let html=await readFile(join(web,'index.html'),'utf8');html=html.replace('</head>','<meta name="liubai-offline" content="enabled">\n</head>');await writeFile(join(web,'index.html'),html);
const assets=[],hash=createHash('sha256');
async function walk(dir,prefix=''){for(const e of(await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const p=join(prefix,e.name);if(e.isDirectory())await walk(join(dir,e.name),p);else{assets.push('./'+p);hash.update(p);hash.update(await readFile(join(dir,e.name)));}}}
await walk(web);assets.push('./');const worker=(await readFile(join(root,'scripts/offline-worker-template.js'),'utf8')).replace('__BUILD_VERSION__',hash.digest('hex').slice(0,20)).replace('/* __BUILD_ASSETS__ */ []',JSON.stringify(assets));await writeFile(join(web,'offline-worker.js'),worker);
console.log('Built dist/web');
if(process.argv.includes('--extension')){
 const ext=resolve(root,'dist/extension');await rm(ext,{recursive:true,force:true});await cp(web,ext,{recursive:true});
 await cp(join(root,'apps/extension'),join(ext,'apps/extension'),{recursive:true,filter:p=>filter(p)&&!p.split('/').includes('_locales')&&!/(build\.mjs|ui\.js|coordinator\.js|storage\.js|journal\.html|popup\.html|worker\.js|manifest\.json)$/.test(p)});
 await cp(join(root,'apps/extension/popup.html'),join(ext,'popup.html'));await cp(join(root,'apps/extension/manifest.json'),join(ext,'manifest.json'));await cp(join(root,'apps/extension/_locales'),join(ext,'_locales'),{recursive:true});
 html=(await readFile(join(ext,'index.html'),'utf8')).replace('<meta name="liubai-offline" content="enabled">','').replace('</head>','<meta name="liubai-platform" content="extension">\n</head>');await writeFile(join(ext,'index.html'),html);await rm(join(ext,'offline-worker.js'),{force:true});
 console.log('Built dist/extension');
}
