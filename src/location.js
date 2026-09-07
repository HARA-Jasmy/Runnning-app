// Request directly from a user gesture. Do not depend on navigator.permissions,
// whose availability and behavior differ across Safari versions.
export class LocationRequest {
  constructor(geo,secure,{setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}={}) {
    this.geo=geo;this.secure=secure;this.setTimer=setTimer;this.clearTimer=clearTimer;this.epoch=0;
  }
  cancel(){this.epoch++;this.clearTimer(this.timer);}
  request(onSuccess,onError){
    this.cancel();const epoch=this.epoch;
    const fail=error=>{if(epoch!==this.epoch)return;this.cancel();onError(error);};
    if(!this.secure||!this.geo){fail({code:0});return;}
    this.timer=this.setTimer(()=>fail({code:3}),25000);
    try {
      this.geo.getCurrentPosition(position=>{
        if(epoch!==this.epoch)return;
        const c=position.coords;
        if(![c.latitude,c.longitude,c.accuracy,position.timestamp].every(Number.isFinite)||Math.abs(c.latitude)>90||Math.abs(c.longitude)>180||c.accuracy<0||Math.abs(Date.now()-position.timestamp)>30000){fail({code:2});return;}
        this.cancel();onSuccess({lat:c.latitude,lon:c.longitude,accuracy:c.accuracy,timestamp:position.timestamp,altitude:c.altitude});
      },fail,{enableHighAccuracy:true,maximumAge:0,timeout:20000});
    } catch(error){fail({code:error.name==='SecurityError'?1:2});}
  }
}
