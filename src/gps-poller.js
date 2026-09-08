// One outstanding acquisition at a time. Browser/OS controls the GPS hardware.
export class GPSPoller {
 constructor(geo,{interval=5000,now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout}={}){
  Object.assign(this,{geo,interval,now,setTimer,clearTimer});this.epoch=0;
 }
 stop(){this.epoch++;this.clearTimer(this.timer);}
 start(ok,error){
  this.stop();const epoch=this.epoch;
  const request=()=>{
   if(epoch!==this.epoch)return;
   const started=this.now();let settled=false;
   const finish=(callback,value)=>{
    if(settled||epoch!==this.epoch)return;settled=true;
    callback(value);
    if(epoch===this.epoch&&value?.code!==1&&value?.name!=='SecurityError')
     this.timer=this.setTimer(request,Math.max(0,this.interval-(this.now()-started)));
   };
   try{this.geo.getCurrentPosition(p=>finish(ok,p),e=>finish(error,e),{enableHighAccuracy:true,maximumAge:0,timeout:5000});}
   catch(e){finish(error,e);}
  };request();
 }
}
