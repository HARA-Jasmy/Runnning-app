import {build} from 'esbuild';
import {cp,mkdir,rm,readFile} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});
const defaults=JSON.parse(await readFile('supabase.client.json','utf8'));
const url=process.env.PUBLIC_SUPABASE_URL??defaults.url,key=process.env.PUBLIC_SUPABASE_ANON_KEY??defaults.publishableKey;
if(!!url!==!!key)throw Error('Set both PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY');
if(url&&!url.startsWith('https://'))throw Error('Supabase URL must use HTTPS');
if(key.startsWith('sb_secret_'))throw Error('Never expose a secret key');
try{if(key.split('.').length===3&&JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role==='service_role')throw Error('Never expose service_role');}catch(e){if(e.message.includes('Never'))throw e;}
await build({entryPoints:['src/app.js'],bundle:true,format:'esm',outfile:'dist/app.js',target:['es2022'],minify:true,define:{__SUPABASE_URL__:JSON.stringify(url),__SUPABASE_KEY__:JSON.stringify(key)}});
console.log('Built Jasmy Run. Cloud:',Boolean(url&&key));
