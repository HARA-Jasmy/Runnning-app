import {requestEmailLink} from './email-auth.js';
import {createClient} from '@supabase/supabase-js';
const url=__SUPABASE_URL__,key=__SUPABASE_KEY__;
export const supabase=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
export const supabaseUrl=url,supabaseAnonKey=key;
export let user=null;
let guest=false;
const blank=()=>({nickname:'Runner',country:'jp',consents:{analysis:false,research:false,marketing:false},unit:'km'});
function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('jasmy-run-local',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function local(key,value,remove=false){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('records',value===undefined&&!remove?'readonly':'readwrite'),s=t.objectStore('records');const r=remove?s.delete(key):value===undefined?s.get(key):s.put(value,key);t.oncomplete=()=>{d.close();resolve(r.result)};t.onerror=()=>{d.close();reject(t.error)}});}
function check(r){if(r.error)throw r.error;return r.data;}
export const isGuest=()=>guest;
export async function restore(){if(supabase){const s=check(await supabase.auth.getSession());user=s.session?.user||null;}return user;}
export async function enterGuest(){guest=true;user=null;return load();}
export async function signInWithEmail(email){return requestEmailLink(supabase,email,location.origin);}
export async function logout(){if(supabase&&user)check(await supabase.auth.signOut());user=null;guest=false;}
export async function load(){
 if(guest)return {profile:await local('profile')||blank(),runs:await local('runs')||[]};
 if(!user)throw Error('ログインしてください');
 const p=check(await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle());
 const runs=[];for(let offset=0;;offset+=100){const batch=check(await supabase.from('runs').select('*').eq('user_id',user.id).order('started_at',{ascending:false}).order('id').range(offset,offset+99));runs.push(...batch);if(batch.length<100)break;}
 return {profile:p||blank(),runs};
}
export async function saveProfile(profile){if(guest)return local('profile',profile);check(await supabase.from('profiles').upsert({id:user.id,nickname:profile.nickname,country:profile.country,consents:profile.consents,unit:profile.unit,avatar_data:profile.avatar_data||null}));}
export async function saveRun(run){if(guest){const runs=await local('runs')||[];if(!runs.some(r=>r.id===run.id))runs.unshift(run);await local('runs',runs);return run;}return check(await supabase.from('runs').upsert({...run,user_id:user.id},{onConflict:'id'}).select().single());}
export async function deleteData(){if(guest){await local('runs',[],true);await local('profile',{},true);}else check(await supabase.rpc('delete_my_app_data'));}
export async function rankings(period,country,type){if(guest)return [];return check(await supabase.rpc('get_rankings',{p_period:period,p_country:country==='all'?null:country,p_type:type}));}
export async function teamInfo(){if(guest)return null;return check(await supabase.rpc('get_my_team'));}
export async function joinTeam(name){if(guest)throw Error('チームへの参加にはクラウドのログインが必要です。');return check(await supabase.rpc('join_team',{p_name:name}));}
export async function leaveTeam(){if(guest)return;check(await supabase.from('team_members').delete().eq('user_id',user.id));}
export async function challenges(){if(guest)return [];return check(await supabase.from('challenges').select('*').order('starts_on',{ascending:false}));}
export async function entries(){if(guest)return [];return check(await supabase.from('challenge_entries').select('*').eq('user_id',user.id));}
export async function enroll(id){if(guest)throw Error('参加にはクラウドのログインが必要です。');check(await supabase.from('challenge_participants').upsert({challenge_id:id,user_id:user.id}));}

export async function publishedWinners(){if(!supabase)return [];return check(await supabase.from('challenge_winners').select('id,nickname,published_at,challenge_month,challenge_title').order('published_at',{ascending:false}).limit(500));}

// Apple Watch (via the user's own "Duffy" app) step/distance sync.
// Tokens are opaque and shown once; only their hash lives server-side. Totals here
// never reach rankings, team distance or challenge entries — those come from runs only.
export async function healthSyncStatus(){if(guest||!user)return {connected:false};return check(await supabase.rpc('health_sync_status'));}
export async function rotateHealthSyncToken(){if(guest||!user)throw Error('クラウドのログインが必要です。');return check(await supabase.rpc('rotate_health_sync_token'));}
export async function revokeHealthSyncToken(){if(guest||!user)return;check(await supabase.rpc('revoke_health_sync_token'));}
export async function healthToday(){if(guest||!user)return null;const day=new Date().toISOString().slice(0,10);return check(await supabase.from('health_daily_totals').select('steps,distance_m,updated_at').eq('day',day).maybeSingle());}
