import test from 'node:test';
import assert from 'node:assert/strict';
import {GpsSampler} from '../src/gps-sampler.js';
test('requests no faster than five seconds, avoids overlap, ignores fixes after stop',()=>{
 let now=0,pending,queued,requests=0,received=0,delay;
 const sampler=new GpsSampler({getCurrentPosition(ok,bad){requests++;pending={ok,bad};}},{now:()=>now,setTimer(fn,ms){queued=fn;delay=ms;return 1},clearTimer(){queued=null}});
 sampler.start(()=>received++,()=>{});assert.equal(requests,1);assert.equal(queued,null);
 now=1000;pending.ok({coords:{}});assert.equal(delay,4000);assert.equal(received,1);
 now=5000;queued();assert.equal(requests,2);const stale=pending;sampler.stop();stale.ok({coords:{}});assert.equal(received,1);assert.equal(queued,null);
 sampler.start(()=>received++,()=>{});pending.bad({code:1});assert.equal(queued,null);
});
test('timeouts retry and slow requests never overlap',()=>{
 let now=0,bad,queued,delay,requests=0;
 const sampler=new GpsSampler({getCurrentPosition(ok,error){requests++;bad=error}},{now:()=>now,setTimer(fn,ms){queued=fn;delay=ms},clearTimer(){queued=null}});
 sampler.start(()=>{},()=>{});now=10000;assert.equal(requests,1);bad({code:3});assert.equal(delay,0);queued();assert.equal(requests,2);
});
