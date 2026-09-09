import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {GPSPoller} from '../src/gps-poller.js';
import {RunTracker} from '../src/tracker.js';
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const gpsSource=app.slice(app.indexOf('let lastFix='),app.indexOf('function startRun()'));
test('GPS timeout and permission errors recover without pausing; inaccurate fixes display but do not count',()=>{
 let now=Date.now(),callbacks,cleared=0;const tracker=new RunTracker(()=>now);tracker.start();const texts={};
 const geo={watchPosition(ok,bad){callbacks={ok,bad};return 1},clearWatch(){cleared++}};
 const sandbox={GPSPoller:class extends GPSPoller {constructor(g){super(g,{interval:0,now:()=>now})}},tracker,navigator:{geolocation:geo},window:{isSecureContext:true},watch:null,timer:null,text:(k,v)=>texts[k]=v,clearInterval(){},setInterval(){return 1},updateRun(){}};
 vm.createContext(sandbox);vm.runInContext(gpsSource+'\ndrawLiveRoute=()=>{};watchGPS();',sandbox);
 callbacks.bad({code:3});assert.equal(tracker.paused,false);assert.match(texts['#gpsHelp'],/タイムアウト/);
 vm.runInContext('watchGPS()',sandbox);callbacks.bad({code:1});assert.match(texts['#gpsHelp'],/Safari/);assert.equal(tracker.paused,false);
 const fix=(lat,accuracy)=>{vm.runInContext('watchGPS()',sandbox);callbacks.ok({coords:{latitude:lat,longitude:141.3545,accuracy,altitude:null},timestamp:now});};
 fix(43.0618,120);assert.equal(tracker.points.length,0);assert.equal(vm.runInContext('lastFix.lat',sandbox),43.0618);assert.match(texts['#gpsHelp'],/概算/);
 fix(43.0618,5);now+=5000;fix(43.0619,5);assert.ok(tracker.distance>10);
 const old=callbacks;vm.runInContext('watchGPS()',sandbox);old.bad({code:1});assert.equal(texts['.gps-status span:last-child'],'取得中');
 tracker.pause();const count=tracker.points.length;old.ok({coords:{latitude:43.062,longitude:141,accuracy:5},timestamp:now});assert.equal(tracker.points.length,count);assert.ok(cleared>0);
});
test('English translations cover GPS errors and campaign and switch back to Japanese',()=>{
 let source=readFileSync(new URL('../src/i18n.js',import.meta.url),'utf8').replaceAll('export ','');
 const sandbox={localStorage:{getItem:()=> 'en'}};vm.createContext(sandbox);vm.runInContext(source,sandbox);
 assert.equal(vm.runInContext("translate('走って北海道グルメを当てよう！')",sandbox),'Run for a chance to win Hokkaido food!');
 assert.equal(vm.runInContext("translate('位置精度 ±120m')",sandbox),'Accuracy ±120 m');
 assert.equal(vm.runInContext("translate('GPSを再取得')",sandbox),'Retry GPS');
 assert.equal(vm.runInContext("language='ja';translate('GPSを再取得')",sandbox),'GPSを再取得');
});

for(const mode of ['unsupported','insecure','security-error','permission-denied','timeout']){
 test(`Confirmed run opens the run screen and keeps controls/timer active with ${mode}`,async()=>{
  const tracker=new RunTracker();let currentScreen='home',ticks=0;const texts={};
  const geo={clearWatch(){},watchPosition(ok,error){
   assert.equal(currentScreen,'run','screen must be shown before requesting GPS');
   if(mode==='security-error')throw Object.assign(Error('Blocked'),{name:'SecurityError'});
   error({code:mode==='timeout'?3:1});return 1;
  }};
  const sandbox={GPSPoller:class extends GPSPoller {constructor(g){super(g,{interval:0})}},tracker,navigator:mode==='unsupported'?{}:{geolocation:geo},window:{isSecureContext:mode!=='insecure'},watch:null,timer:null,saveError:false,latest:null,permissionFix:null,
   text:(k,v)=>texts[k]=v,clearInterval(){},setInterval(fn){ticks++;return 1},updateRun(){},navigate:s=>currentScreen=s,
   $$:()=>[],$:()=>({}),drawRoute(){},drawLiveRoute(){},lock:()=>new Promise(()=>{})};
  vm.createContext(sandbox);
  const startSource=app.slice(app.indexOf('async function beginRun()'),app.indexOf('function updateRun()'));
  vm.runInContext(gpsSource+'\n'+startSource,sandbox);
  await vm.runInContext('drawLiveRoute=()=>{};beginRun()',sandbox);
  assert.equal(currentScreen,'run');assert.equal(tracker.active,true);assert.equal(tracker.paused,false);assert.equal(tracker.distance,0);assert.equal(ticks,1);assert.ok(texts['#gpsHelp']);
 });
}

test('opening run screen does not request GPS; central start requests synchronously',()=>{
 const tracker=new RunTracker();let requests=0,currentScreen='home';
 const sandbox={tracker,saveError:false,navigate:s=>currentScreen=s,beginRun:()=>{requests++;tracker.start();},updateRun(){}};
 vm.createContext(sandbox);
 vm.runInContext(app.slice(app.indexOf('function startRun()'),app.indexOf('async function beginRun()')),sandbox);
 vm.runInContext(app.slice(app.indexOf('async function pauseRun()'),app.indexOf('async function finishRun()')),sandbox);
 vm.runInContext('startRun()',sandbox);assert.equal(currentScreen,'run');assert.equal(requests,0);
 vm.runInContext('pauseRun()',sandbox);assert.equal(requests,1);assert.equal(tracker.active,true);
});
