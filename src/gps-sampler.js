// Request fixes at most once per five seconds, without a continuous GPS watch.
// Browser/OS controls the hardware; this does not guarantee a battery saving.
export class GpsSampler {
 constructor(geo,{now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout}={}){this.geo=geo;this.now=now;this.setTimer=setTimer;this.clearTimer=clearTimer;this.epoch=0;this.timer=null;}
 stop(){this.epoch++;this.clearTimer(this.timer);this.timer=null;}
 start(onFix,onError){
  this.stop();const epoch=this.epoch;
  const request=()=>{
   if(epoch!==this.epoch)return;
   const started=this.now();let settled=false;
   const complete=(callback,value)=>{
    if(settled||epoch!==this.epoch)return;settled=true;
    callback(value);
    if(epoch===this.epoch&&value?.code!==1&&value?.name!=='SecurityError')this.timer=this.setTimer(request,Math.max(0,5000-(this.now()-started)));
   };
   try{this.geo.getCurrentPosition(p=>complete(onFix,p),e=>complete(onError,e),{enableHighAccuracy:true,maximumAge:0,timeout:10000});}
   catch(e){complete(onError,e);}
  };request();
 }
}
