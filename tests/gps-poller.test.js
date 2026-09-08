import test from 'node:test';
import assert from 'node:assert/strict';
import {GPSPoller} from '../src/gps-poller.js';
test('requests every five seconds without overlap; stop drops late callbacks',()=>{
 let now=0,ok,bad,next,delay,calls=0,received=0;
 const poller=new GPSPoller({getCurrentPosition(a,b){calls++;ok=a;bad=b;}},{now:()=>now,setTimer:(fn,ms)=>{next=fn;delay=ms;return 1},clearTimer:()=>{next=null}});
 poller.start(()=>received++,()=>{});assert.equal(calls,1);assert.equal(next,null);
 now=1200;ok({coords:{}});assert.equal(delay,3800);assert.equal(received,1);
 now=5000;next();assert.equal(calls,2);
 poller.stop();ok({coords:{}});assert.equal(received,1);assert.equal(next,null);
 poller.start(()=>received++,()=>{});bad({code:1});assert.equal(next,null);
});
test('timeouts retry and slower requests never overlap',()=>{
 let now=0,bad,next,delay;
 const poller=new GPSPoller({getCurrentPosition(a,b){bad=b;}},{now:()=>now,setTimer:(f,d)=>{next=f;delay=d},clearTimer:()=>{next=null}});
 poller.start(()=>{},()=>{});now=6000;bad({code:3});assert.equal(delay,0);assert.equal(typeof next,'function');poller.stop();
});
