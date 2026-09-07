// Browser GPS is a measurement aid, never proof of a verified sporting result.
export function metersBetween(a,b){const r=x=>x*Math.PI/180,dlat=r(b.lat-a.lat),dlon=r(b.lon-a.lon);const h=Math.sin(dlat/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dlon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
export class RunTracker{
 constructor(now=()=>Date.now()){this.now=now;this.reset();}
 reset(){this.active=false;this.paused=false;this.startedAt=null;this.elapsed=0;this.segmentAt=0;this.points=[];this.distance=0;this.last=null;this.splits=[];this.lastSplitSeconds=0;this.rejected=0;}
 start(){this.reset();this.active=true;this.startedAt=this.now();this.segmentAt=this.startedAt;}
 seconds(){return (this.elapsed+(this.active&&!this.paused?this.now()-this.segmentAt:0))/1000;}
 pause(){if(!this.active||this.paused)return;this.elapsed+=this.now()-this.segmentAt;this.paused=true;this.last=null;}
 resume(){if(!this.active||!this.paused)return;this.segmentAt=this.now();this.paused=false;this.last=null;}
 add(p){
  if(!this.active||this.paused)return {accepted:false};
  if(![p.lat,p.lon,p.accuracy,p.timestamp].every(Number.isFinite)||Math.abs(p.lat)>90||Math.abs(p.lon)>180||p.accuracy<0||p.accuracy>50||Math.abs(this.now()-p.timestamp)>30000){this.rejected++;this.last=null;return {accepted:false,reason:'位置精度を確認中'};}
  let delta=0,segmentStart=!this.last;
  if(this.last){const dt=(p.timestamp-this.last.timestamp)/1000;if(dt<=0)return {accepted:false};delta=metersBetween(this.last,p);
   if(dt>30){delta=0;segmentStart=true;}else if(delta/dt>8){this.rejected++;this.last=null;return {accepted:false,reason:'速すぎる移動を除外しました'};}
   // Ignore stationary GPS noise; keep anchor until meaningful movement arrives.
   else if(delta<Math.max(3,Math.min(p.accuracy,this.last.accuracy)*.5))return {accepted:false};
  }
  const previous=this.distance;this.distance+=delta;const seconds=this.seconds();
  this.points.push({...p,segmentStart,elapsed:seconds,distance:this.distance});this.last=p;
  for(let km=Math.floor(previous/1000)+1;km<=Math.floor(this.distance/1000);km++){
   const last=this.points[this.points.length-2];const t=last?last.elapsed+(seconds-last.elapsed)*(km*1000-previous)/(this.distance-previous):seconds;
   this.splits.push({km,seconds:t-this.lastSplitSeconds,altitude:Number.isFinite(p.altitude)?Math.round(p.altitude):null});this.lastSplitSeconds=t;
  }
  return {accepted:true};
 }
 finish(){if(!this.active)return null;const seconds=this.seconds();this.active=false;this.elapsed=seconds*1000;this.paused=false;return {id:crypto.randomUUID(),started_at:new Date(this.startedAt).toISOString(),duration_seconds:Math.round(seconds),distance_m:Math.round(this.distance),points:this.points,splits:this.splits,verification_status:'pending',rejected_points:this.rejected};}
}
export const dayKey=d=>{const t=new Date(d);return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;};
export function summarize(runs,now=new Date()){
 const today=runs.filter(r=>dayKey(r.started_at)===dayKey(now)),month=runs.filter(r=>dayKey(r.started_at).slice(0,7)===dayKey(now).slice(0,7));
 const sum=(a,k)=>a.reduce((n,r)=>n+Number(r[k]||0),0);return {todayDistance:sum(today,'distance_m')/1000,todaySeconds:sum(today,'duration_seconds'),runCount:today.length,monthDistance:sum(month,'distance_m')/1000,totalDistance:sum(runs,'distance_m')/1000,totalRuns:runs.length,totalDays:new Set(runs.map(r=>dayKey(r.started_at))).size,runDays:new Set(month.map(r=>dayKey(r.started_at))).size,entries:0};
}
export const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
