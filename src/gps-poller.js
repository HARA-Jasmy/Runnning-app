// Continuous position watcher. Browser/OS controls the GPS hardware.
// watchPosition is materially more reliable on iOS Safari than repeatedly
// starting getCurrentPosition calls, while the app still throttles accepted
// fixes so downstream processing remains lightweight.
export class GPSPoller {
 constructor(geo,{interval=5000,now=()=>Date.now()}={}){
  Object.assign(this,{geo,interval,now});this.epoch=0;this.watchId=null;this.lastAcceptedAt=-Infinity;
 }
 stop(){this.epoch++;if(this.watchId!==null&&this.geo?.clearWatch)this.geo.clearWatch(this.watchId);this.watchId=null;}
 start(ok,error){
  this.stop();const epoch=this.epoch;this.lastAcceptedAt=-Infinity;
  if(!this.geo?.watchPosition){error({code:2,message:'Geolocation watch is unavailable'});return;}
  const onPosition=position=>{
   if(epoch!==this.epoch)return;
   const ts=Number.isFinite(position?.timestamp)?position.timestamp:this.now();
   if(ts-this.lastAcceptedAt<this.interval)return;
   this.lastAcceptedAt=ts;ok(position);
  };
  const onError=err=>{if(epoch===this.epoch)error(err);};
  try{
   this.watchId=this.geo.watchPosition(onPosition,onError,{enableHighAccuracy:true,maximumAge:3000,timeout:20000});
  }catch(err){onError(err);}
 }
}
