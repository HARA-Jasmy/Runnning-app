// Isolated in-memory demo: no Auth client, network calls or persistent writes.
export const user={id:'demo-runner'},recovering=false,supabase=null,supabaseUrl='',supabaseAnonKey='';
let profile={nickname:'Hana',country:'jp',unit:'km',consents:{analysis:true,ranking:true},avatar_data:null};
let runs=[];
const people=[['Yuki','jp',86.4],['Alex','us',79.2],['Hana','jp',72.4],['Min','kr',65.8],['Mei','sg',58.6],['Sora','jp',51.2]];
const teams=[['JASMY RUNNERS','jp',413.6],['TOKYO MORNING','jp',365.2],['GLOBAL STRIDERS','us',328.4],['SEOUL RUN CLUB','kr',289.1],['SINGAPORE STEPS','sg',246.7]];
export const isGuest=()=>false;
export async function restore(){return user;}
export async function load(){return {profile:structuredClone(profile),runs:structuredClone(runs)};}
export async function saveProfile(next){profile=structuredClone(next);}
export async function saveRun(run){runs.unshift(structuredClone(run));return run;}
export async function rankings(period,country,type){const scale=period==='week'?0.25:period==='all'?4:1;return (type==='team'?teams:people).filter(p=>country==='all'||p[1]===country).map(([name,,km])=>({name,distance_km:km*scale}));}
export async function teamInfo(){return {name:'JASMY RUNNERS',distance_km:413.6,recorded_distance_km:426.8,recorded_total_km:1284.6,my_recorded_km:72.4,recorded_run_count:48,members:people.map(([nickname,,km],i)=>({id:i===2?user.id:`demo-${i}`,nickname,recorded_distance_km:km+(i===0?13.2:0)}))};}
export async function challenges(){return [];}
export async function entries(){return [];}
export async function publishedWinners(){return [];}
export async function healthSyncStatus(){return {connected:false};}
export async function healthToday(){return null;}
const unavailable=async()=>{throw Error('デモではこの操作は利用できません。本番画面でお試しください。');};
export const loginWithPassword=unavailable,registerWithPassword=unavailable,resetPassword=unavailable,setPassword=unavailable,deleteData=unavailable,joinTeam=unavailable,leaveTeam=unavailable,enroll=unavailable,rotateHealthSyncToken=unavailable,revokeHealthSyncToken=unavailable,enterGuest=unavailable;
export async function logout(){location.href='/';}
