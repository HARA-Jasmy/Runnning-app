import test from 'node:test';
import assert from 'node:assert/strict';
import {GPSPoller} from '../src/gps-poller.js';

test('uses watchPosition and throttles accepted fixes',()=>{
 let ok,bad,cleared=null,watchCalls=0,received=0;
 const geo={watchPosition(a,b,opts){watchCalls++;ok=a;bad=b;assert.equal(opts.enableHighAccuracy,true);return 42},clearWatch(id){cleared=id}};
 const poller=new GPSPoller(geo,{interval:5000});
 poller.start(()=>received++,()=>{});assert.equal(watchCalls,1);
 ok({timestamp:1000,coords:{}});assert.equal(received,1);
 ok({timestamp:3000,coords:{}});assert.equal(received,1);
 ok({timestamp:6000,coords:{}});assert.equal(received,2);
 poller.stop();assert.equal(cleared,42);
 ok({timestamp:12000,coords:{}});assert.equal(received,2);
 void bad;
});

test('forwards watcher errors and reports unavailable watcher',()=>{
 let bad,errorCode=null;
 const poller=new GPSPoller({watchPosition(a,b){bad=b;return 7},clearWatch(){} });
 poller.start(()=>{},e=>{errorCode=e.code});bad({code:1});assert.equal(errorCode,1);poller.stop();
 const unavailable=new GPSPoller({});let unavailableCode=null;unavailable.start(()=>{},e=>{unavailableCode=e.code});assert.equal(unavailableCode,2);
});
