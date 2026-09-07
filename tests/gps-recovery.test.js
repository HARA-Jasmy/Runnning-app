import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {RunTracker} from '../src/tracker.js';
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const gpsSource=app.slice(app.indexOf('let lastFix='),app.indexOf('async function startRun()'));
test('GPS timeout and permission errors recover without pausing; inaccurate fixes display but do not count',()=>{
 let now=Date.now(),callbacks,cleared=0,draws=0;const tracker=new RunTracker(()=>now);tracker.start();const texts={};
 const sandbox={tracker,navigator:{geolocation:{watchPosition(ok,bad){callbacks={ok,bad};return 1},clearWatch(){cleared++}}},window:{isSecureContext:true},watch:null,timer:null,text:(k,v)=>texts[k]=v,clearInterval(){},setInterval(){return 1},updateRun(){}};
 vm.createContext(sandbox);vm.runInContext(gpsSource+'\ndrawLiveRoute=()=>{};watchGPS();',sandbox);
 callbacks.bad({code:3});assert.equal(tracker.paused,false);assert.match(texts['#gpsHelp'],/タイムアウト/);
 callbacks.bad({code:1});assert.match(texts['#gpsHelp'],/Safari/);assert.equal(tracker.paused,false);
 const fix=(lat,accuracy)=>callbacks.ok({coords:{latitude:lat,longitude:141.3545,accuracy,altitude:null},timestamp:now});
 fix(43.0618,120);assert.equal(tracker.points.length,0);assert.equal(vm.runInContext('lastFix.lat',sandbox),43.0618);assert.match(texts['#gpsHelp'],/概算/);
 fix(43.0618,5);now+=5000;fix(43.0619,5);assert.ok(tracker.distance>10);
 const old=callbacks;vm.runInContext('watchGPS()',sandbox);assert.equal(cleared,1);old.bad({code:1});assert.equal(texts['.gps-status span:last-child'],'取得中');
 tracker.pause();fix(43.062,5);assert.equal(tracker.paused,true);assert.match(texts['#gpsHelp'],/再開/);
});
test('English translations cover GPS errors and campaign and switch back to Japanese',()=>{
 let source=readFileSync(new URL('../src/i18n.js',import.meta.url),'utf8').replaceAll('export ','');
 const sandbox={localStorage:{getItem:()=> 'en'}};vm.createContext(sandbox);vm.runInContext(source,sandbox);
 assert.equal(vm.runInContext("translate('走って北海道グルメを当てよう！')",sandbox),'Run for a chance to win Hokkaido food!');
 assert.equal(vm.runInContext("translate('位置精度 ±120m')",sandbox),'Accuracy ±120 m');
 assert.equal(vm.runInContext("translate('GPSを再取得')",sandbox),'Retry GPS');
 assert.equal(vm.runInContext("language='ja';translate('GPSを再取得')",sandbox),'GPSを再取得');
});
