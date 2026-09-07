import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('only published winner nicknames are readable, and app users cannot publish results',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create table public.challenges(id uuid primary key);');await db.exec(await readFile('docs/challenge-winners.sql','utf8'));
 await db.exec("insert into public.challenges values('00000000-0000-0000-0000-000000000001'); insert into public.challenge_winners(challenge_id,nickname,challenge_month,challenge_title,published_at) values ('00000000-0000-0000-0000-000000000001','Published',current_date,'Campaign',now()-interval '1 day'),('00000000-0000-0000-0000-000000000001','Draft',current_date,'Campaign',null),('00000000-0000-0000-0000-000000000001','Future',current_date,'Campaign',now()+interval '1 day'); set role anon;");
 assert.deepEqual((await db.query('select nickname from public.challenge_winners')).rows,[{nickname:'Published'}]);
 await db.exec('reset role;set role authenticated;');assert.deepEqual((await db.query('select nickname from public.challenge_winners')).rows,[{nickname:'Published'}]);
 await assert.rejects(db.exec("update public.challenge_winners set nickname='Changed'"),/permission denied/);
 }finally{await db.close();}
});
