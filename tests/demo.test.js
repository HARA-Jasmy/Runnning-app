import test from 'node:test';
import assert from 'node:assert/strict';
import * as demo from '../src/demo-data.js';
test('demo shows multiple members and filtered rankings while blocking account mutations',async()=>{
 const t=await demo.teamInfo();assert.equal(t.members.length,6);
 assert.ok(Math.abs(t.members.reduce((n,m)=>n+m.recorded_distance_km,0)-t.recorded_distance_km)<0.001);
 assert.equal((await demo.rankings('month','all','individual')).length,6);
 assert.equal((await demo.rankings('month','jp','individual')).length,3);
 assert.equal((await demo.rankings('month','all','team')).length,5);
 await assert.rejects(demo.deleteData(),/デモ/);await assert.rejects(demo.setPassword('unused'),/デモ/);
 const first=await demo.load();first.profile.nickname='Changed';assert.equal((await demo.load()).profile.nickname,'Hana');
});
