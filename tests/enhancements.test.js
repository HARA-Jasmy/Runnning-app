import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('enhancements and translation settle without starving user interactions',()=>{
 // A separate process bounds failures: a MutationObserver loop starves timers
 // in the page, so an in-page timeout cannot detect this regression reliably.
 const result=spawnSync(process.execPath,['--input-type=module','-e',`
  import assert from 'node:assert/strict';
  import {readFileSync} from 'node:fs';
  import {JSDOM} from 'jsdom';
  const dom=new JSDOM(readFileSync('public/index.html','utf8'),{
   url:'https://jasmy-running-app.vercel.app/',runScripts:'outside-only'
  });
  const w=dom.window,d=w.document;
  let starts=0,watchClicks=0;
  d.querySelector('#homeStartButton').onclick=()=>starts++;
  d.querySelector('[data-sheet="watch-setup"]').onclick=()=>watchClicks++;
  w.eval(readFileSync('src/i18n.js','utf8').replace(/export /g,'')+';initLanguage(()=>{});');
  w.eval(readFileSync('src/enhancements.js','utf8'));
  const settle=()=>new Promise(resolve=>w.setTimeout(resolve,20));
  await settle();
  for(const language of ['en','ja']){
   const select=d.querySelector('#loginLanguage');
   select.value=language;select.dispatchEvent(new w.Event('change'));
   await settle();
   d.querySelector('[data-run-source="gps"]').click();
   d.querySelector('#homeStartButton').click();
   d.querySelector('[data-run-source="watch"]').click();
   d.querySelector('#homeStartButton').click();
   await settle();
  }
  assert.equal(starts,2);assert.equal(watchClicks,2);
  assert.equal(d.querySelectorAll('.run-source-selector').length,1);
  d.querySelector('#sheetContent').innerHTML='<h2 id="sheetTitle">Apple Watch連携</h2><p class="sheet-description"></p><select id="country"><option value="jp">Japan</option></select>';
  await settle();
  assert.equal(d.querySelector('#sheetTitle').textContent,'Apple Watch / Health連携');
  assert.ok(d.querySelector('#country').options.length>200);
  assert.equal(d.querySelector('#country').value,'jp');
  dom.window.close();
 `],{encoding:'utf8',timeout:5000});
 assert.equal(result.error,undefined,result.error?.message);
 assert.equal(result.status,0,result.stderr);
});
