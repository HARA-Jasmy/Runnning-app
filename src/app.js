import {GPSPoller} from './gps-poller.js';
import {LocationRequest} from './location.js';
import {initLanguage,locale,translate} from './i18n.js';
import {resizeAvatar} from './avatar.js';
import * as data from './data.js';
import {renderAd} from './ads.js';
import {RunTracker,summarize,escapeHtml as esc,dayKey} from './tracker.js';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const tracker=new RunTracker();let profile={nickname:'Runner',country:'jp',consents:{},unit:'km'},runs=[],latest=null,watch=null,timer=null,wake=null,screen='login',saving=false,saveError=false,ready=false,team=null,challengeList=[],challengeEntries=[],rankRequest=0,previousFocus=null,health=null;
const locationRequest=new LocationRequest(navigator.geolocation,window.isSecureContext);let permissionFix=null;
let rankType='individual',period='month',region='global';
const time=n=>{n=Math.max(0,Math.floor(n));const h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;return `${h?h+':':''}${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`};
const factor=()=>profile.unit==='mile'?0.621371:1,unit=()=>profile.unit==='mile'?'mi':'km';
const distance=m=>(m/1000*factor()).toFixed(2);
const pace=(s,km)=>{if(!km)return '—';const n=Math.round(s/km);return `${Math.floor(n/60)}'${String(n%60).padStart(2,'0')}”`};
const text=(s,t)=>{const el=$(s);if(el)el.textContent=t;};
function toast(t){text('#toast',t);$('#toast').classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>$('#toast').classList.remove('show'),5000);}
const safe=fn=>async(...args)=>{try{return await fn(...args)}catch(e){if(screen==='ranking')$('#rankRows').innerHTML='<p class="empty-state">読み込めませんでした。タブを選び直して再試行してください。</p>';if(screen==='team')$('#team-overview').innerHTML='<p class="empty-state">読み込めませんでした。チームタブを押して再試行してください。</p>';toast(e.message||'処理に失敗しました。もう一度お試しください。');}};
function navigate(name){if(saveError&&name!=='result'){toast('未保存の走行記録を再保存してください。');return;}if(!ready&&name!=='login')return;if(screen==='location'&&name!=='location')locationRequest.cancel();screen=name;$$('.screen').forEach(el=>{const active=el.id===`screen-${name}`;el.classList.toggle('active',active);el.inert=!active;});$('#bottomNav').classList.toggle('visible',name!=='login');const key=$(`#screen-${name}`)?.dataset.nav;$$('[data-nav-go]').forEach(b=>b.classList.toggle('active',b.dataset.navGo===key));if(name==='ranking')safe(renderRanking)();if(name==='team')safe(renderTeam)();if(name==='challenge')safe(renderChallenge)();if(name==='run')updateRun();}
function modal(title,body){previousFocus=document.activeElement;text('#sheetContent','');$('#sheetContent').innerHTML=`<button class="sheet-close-top" data-action="close-sheet" aria-label="閉じる">×</button><h2 id="sheetTitle">${esc(title)}</h2>${body}`;$('#sheetOverlay').classList.add('show');$('#sheetOverlay').setAttribute('aria-hidden','false');$$('.screen').forEach(e=>e.inert=true);$('#bottomNav').inert=true;$('#sheetContent button').focus();}
function close(){if(saving)return;$('#sheetOverlay').classList.remove('show');$('#sheetOverlay').setAttribute('aria-hidden','true');$$('.screen').forEach(e=>e.inert=!e.classList.contains('active'));$('#bottomNav').inert=false;previousFocus?.focus();}
const note=s=>`<p class="sheet-description">${esc(s)}</p>`;
function field(label,id,value=''){return `<label for="${id}">${esc(label)}</label><input id="${id}" type="text" value="${esc(value)}" required maxlength="40">`;}
async function loadApp(){const result=await data.load();profile=result.profile;runs=result.runs;ready=true;latest=runs[0]||null;await refreshHealth();await refreshTeam();renderSummary();}
// Apple Watch (via Duffy) totals are informational only; they never touch runs,
// verification, rankings, team distance or challenge entries.
async function refreshHealth(){if(data.isGuest()){health=null;return;}try{health=await data.healthSyncStatus();if(health.connected)health.today=await data.healthToday();}catch{health=null;}}
function renderHealth(){const on=!!(health?.connected&&health.today&&(health.today.steps||health.today.distance_m));$('#homeWatchLine').hidden=!on;if(on){text('#homeWatchSteps',health.today.steps??0);text('#homeWatchDistance',((health.today.distance_m??0)/1000).toFixed(1));}}
async function refreshTeam(){try{team=await data.teamInfo();}catch{team=undefined;}}
function renderSummary(){$$('.avatar').forEach(img=>img.src=profile.avatar_data||'/assets/83f73b689e45.png');if($('#rankingConsent')){$('#rankingConsent').classList.toggle('on',!!profile.consents.ranking);$('#rankingConsent').setAttribute('aria-checked',!!profile.consents.ranking);}const s=summarize(runs);const kmFactor=factor();text('.greeting','今日も、自分のペースで');text('.greeting-name',`${profile.nickname}さん ☀️`);text('#profileName',profile.nickname);const country=({jp:'Japan',us:'United States',sg:'Singapore',kr:'Korea'})[profile.country]||profile.country;$('.profile-copy > span').innerHTML=`${profile.country==='jp'?'<img class="country-flag" src="/assets/flag-jp.svg" alt="日本の国旗">':`<span aria-hidden="true">${({us:'🇺🇸',sg:'🇸🇬',kr:'🇰🇷'})[profile.country]||'🌐'}</span>`} ${esc(country)}`;text('.home-date',new Date().toLocaleDateString(locale(),{month:'long',day:'numeric',weekday:'short'}));text('#storageStatus',data.isGuest()?'端末保存モード · このブラウザに保存します':'クラウド保存 · PDLは未連携');
 text('#homeTodayDistance',(s.todayDistance*kmFactor).toFixed(2));text('.today-line .unit',unit());text('#homeTodayTime',time(s.todaySeconds));text('#homeTodayPace',`${pace(s.todaySeconds,s.todayDistance*kmFactor)}/${unit()}`);text('#homeRunCount',`${s.runCount} Run`);text('#homeMonthDistance',s.monthDistance.toFixed(1));text('#homeMonthPercent',`${Math.min(100,Math.round(s.monthDistance))}%`);$('#homeMonthProgress').style.width=`${Math.min(100,s.monthDistance)}%`;
 text('#totalDistance',(s.totalDistance*kmFactor).toFixed(1));text('.profile-stat span',`総距離 ${unit()}`);text('#totalRuns',s.totalRuns);text('#totalDays',s.totalDays);text('#unitValue',`${unit()} ›`);text('#homeContribution',team?`${Number(team.my_recorded_km||0).toFixed(2)} km`:'—');text('#homeEntries','開催情報を確認');text('[data-go="ranking"] .value-lg','—');text('.rank-change','認定ランを集計');text('[data-go="team"] .value-lg',team?`${Number(team.recorded_distance_km??team.distance_km??0).toFixed(2)} km`:team===undefined?'取得できません':'未参加'); $('[data-go="team"] .small').innerHTML=`今月の記録距離（未認定を含む）<br>あなたの記録 <b id="homeContribution">${team?Number(team.my_recorded_km||0).toFixed(2)+' km':'—'}</b>`;text('[data-go="team"] .team-mini-name',team?.name||'チーム');text('.challenge-mini-copy p','走って北海道グルメを当てよう！');
 const monthRuns=runs.filter(r=>dayKey(r.started_at).slice(0,7)===dayKey(new Date()).slice(0,7));const sec=monthRuns.reduce((a,r)=>a+r.duration_seconds,0);
 $('#insightStats').innerHTML=profile.consents.analysis?`<div class="insight-stat"><b>${(s.monthDistance*kmFactor).toFixed(1)} ${unit()}</b><span>今月の距離</span></div><div class="insight-stat"><b>${pace(sec,s.monthDistance*kmFactor)}</b><span>平均ペース /${unit()}</span></div><div class="insight-stat"><b>${s.runDays}</b><span>今月の走行日数</span></div>`:'<p class="small muted">運動分析はオフです。同意管理から変更できます。</p>';
 $$('[data-consent]').forEach(b=>{b.classList.toggle('on',!!profile.consents[b.dataset.consent]);b.setAttribute('role','switch');b.setAttribute('aria-checked',!!profile.consents[b.dataset.consent]);});
 text('.pdl-card p','あなたのデータは、あなたが管理する。\nPDL連携は準備中');
 renderHealth();renderAd($('#adHome'),'home-bottom');
}
function drawRoute(container,points){if(!container)return;const svg=$('svg.map-svg',container);if(!svg)return;const valid=points||[];svg.setAttribute('viewBox','0 0 350 230');let paths=[];if(valid.length){const lat=valid.map(p=>p.lat),lon=valid.map(p=>p.lon),minLat=Math.min(...lat),maxLat=Math.max(...lat),minLon=Math.min(...lon),maxLon=Math.max(...lon);const cos=Math.cos((maxLat+minLat)/2*Math.PI/180),width=(maxLon-minLon)*cos,height=maxLat-minLat,scale=Math.min(290/(width||.0001),170/(height||.0001));let segment=[];valid.forEach(p=>{if(p.segmentStart&&segment.length){paths.push(segment);segment=[]}segment.push(`${175+((p.lon-(minLon+maxLon)/2)*cos*scale)},${115-(p.lat-(minLat+maxLat)/2)*scale}`)});if(segment.length)paths.push(segment);}
 svg.innerHTML=`<rect width="350" height="230" fill="#f4f6f5"/>${paths.map(path=>`<polyline points="${path.join(' ')}" fill="none" stroke="#f49a42" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}${paths.length?(()=>{const p=paths.at(-1).at(-1).split(',');return `<circle cx="${p[0]}" cy="${p[1]}" r="6" fill="#f49a42" stroke="white" stroke-width="3"/>`})():''}`;
 let caption=$('.map-caption',container);if(!caption){caption=document.createElement('span');caption.className='map-caption';container.append(caption)}caption.textContent=valid.length>1?'GPS軌跡（背景地図なし）':valid.length?'現在地を取得しました。移動すると軌跡が表示されます。':'GPSを取得すると軌跡が表示されます';}
async function lock(){try{wake=await navigator.wakeLock?.request('screen')}catch{}}
function stopWatch(){gpsEpoch++;if(watch!==null)watch.stop();watch=null;clearInterval(timer);timer=null;wake?.release();wake=null;}
let lastFix=null,gpsEpoch=0;
function watchGPS(){
 if(watch!==null)watch.stop();
 clearInterval(timer);timer=setInterval(updateRun,1000);const epoch=++gpsEpoch;if(tracker.paused)return;
 if(!navigator.geolocation||!window.isSecureContext){
  text('.gps-status span:last-child','GPS利用不可');
  text('#gpsHelp','この環境では位置情報を利用できません。時間の計測は続けられます。距離を計測するにはHTTPSのアプリURLをSafariまたはChromeで開いてください。');
  return;
 }
 const onError=err=>{
  if(epoch!==gpsEpoch||!tracker.active)return;
  text('.gps-status span:last-child',err.code===1||err.name==='SecurityError'?'許可が必要':'再取得待ち');
  text('#gpsHelp',err.code===1||err.name==='SecurityError'?'端末とブラウザの位置情報を許可し、GPSを再取得してください。アプリ内ブラウザの場合はSafariまたはChromeで開いてください。':err.code===3?'GPS取得がタイムアウトしました。屋外でGPSを再取得してください。':'現在地を取得できません。端末の位置情報をオンにして再取得してください。');
 };

 text('.gps-status span:last-child','取得中');text('#gpsHelp','位置情報の利用を許可してください。屋外では精度が改善します。');
 try {watch=new GPSPoller(navigator.geolocation);watch.start(pos=>{
  if(epoch!==gpsEpoch||!tracker.active)return;
  const c=pos.coords;if(![c.latitude,c.longitude,c.accuracy].every(Number.isFinite))return;
  lastFix={lat:c.latitude,lon:c.longitude,accuracy:c.accuracy,timestamp:pos.timestamp,altitude:c.altitude};
  const r=tracker.add(lastFix);
  text('.accuracy',`位置精度 ±${Math.round(c.accuracy)}m`);
  text('.gps-status span:last-child',c.accuracy>50?'精度を改善中':'取得済み');
  text('#gpsHelp',c.accuracy>50?'現在地は概算です。精度50m以内になると距離に加算します。':tracker.paused?'一時停止中です。再開を押すと距離計測を続けます。':r.reason||'GPSを取得しました。移動すると軌跡と距離を更新します。');
  drawLiveRoute();updateRun();
 },onError);
 }catch(err){onError(err);}
}
function drawLiveRoute(){
 const points=tracker.points.length?tracker.points:lastFix?[lastFix]:[];
 for(const el of [$('#runMapCard'),$('#fullMap').classList.contains('show')?$('.full-map-body'):null]){
  if(!el)continue;drawRoute(el,points);
  if(lastFix){let label=$('.coordinates',el);if(!label){label=document.createElement('span');label.className='coordinates';el.append(label)}label.textContent=`${lastFix.lat.toFixed(5)}, ${lastFix.lon.toFixed(5)} · ±${Math.round(lastFix.accuracy)}m`;}
 }
}
function startRun(){if(tracker.active){navigate('run');return;}if(saveError)throw Error('前の記録を保存してから開始してください。');openLocation();}
function openLocation(){
 locationRequest.cancel();permissionFix=null;
 $('#requestLocation').disabled=false;$('#beginLocatedRun').disabled=true;$('#locationPreview').hidden=true;
 text('#locationStatus','位置情報はまだ取得していません。');text('#requestLocation','位置情報を許可する');
 navigate('location');
}
function requestLocation(){
 $('#requestLocation').disabled=true;$('#beginLocatedRun').disabled=true;permissionFix=null;$('#locationPreview').hidden=true;
 text('#locationStatus','Safariの確認画面で「許可」を選択してください。現在地を取得しています…');
 // getCurrentPosition is called synchronously inside this click handler.
 locationRequest.request(fix=>{
  permissionFix=fix;$('#requestLocation').disabled=false;$('#beginLocatedRun').disabled=false;
  text('#requestLocation','位置情報を再確認する');
  text('#locationStatus',fix.accuracy<=50?'現在地を取得しました。ランニングを開始できます。':'現在地は概算です。「正確な位置情報」をオンにすると軌跡と距離を計測しやすくなります。');
  $('#locationPreview').hidden=false;drawRoute($('#locationPreview'),[fix]);
 },error=>{
  $('#requestLocation').disabled=false;$('#locationSettings').open=true;
  text('#locationStatus',error.code===1?'位置情報が許可されていません。下の設定手順を確認してください。':error.code===3?'取得に時間がかかっています。屋外で、もう一度お試しください。':error.code===0?'SafariでHTTPSのアプリURLを直接開いてください。':'現在地を取得できません。位置情報サービスの設定を確認してください。');
 });
}
async function beginRun(){if(tracker.active){navigate('run');return;}if(saveError)throw Error('前の記録を保存してから開始してください。');tracker.start();lastFix=permissionFix;$$('.coordinates').forEach(e=>e.remove());latest=null;navigate('run');drawLiveRoute();updateRun();watchGPS();void lock();}
function updateRun(){const km=tracker.distance/1000*factor(),sec=tracker.seconds();text('#runDistance',km.toFixed(2));text('.run-distance .unit',unit());text('#runTime',time(sec));text('#runPace',pace(sec,km));text('#runLap',tracker.splits.length?time(tracker.splits.at(-1).seconds):'—');text('#runLapLabel',tracker.splits.length?`${tracker.splits.at(-1).km} km ラップ`:'直前の1 kmラップ');const laps=$('#liveLapRows');const content=tracker.splits.map(s=>`<div class="split-row"><span>${s.km} km</span><b>${time(s.seconds)}</b></div>`).join('')||'<p class="small muted">1 km到達後に表示します。</p>';if(laps.innerHTML!==content)laps.innerHTML=content;text('.run-stat:nth-child(2) span',`ペース /${unit()}`);text('#runStatusChip',!tracker.active?'STARTで計測開始':tracker.paused?'一時停止中':'ランニング中…');$('#mainRunUse').setAttribute('href',!tracker.active||tracker.paused?'#i-play':'#i-pause');$('#mainRunButton').setAttribute('aria-label',!tracker.active?'開始':tracker.paused?'再開':'一時停止');$('#screenLockButton').disabled=!tracker.active;$('#finishRunButton').disabled=!tracker.active;}
async function pauseRun(){if(!tracker.active)return startRun();if(tracker.paused){tracker.resume();if(watch!==null)watch.stop();clearInterval(timer);watchGPS();await lock();}else{tracker.pause();stopWatch();}updateRun();}
async function finishRun(){if(!tracker.active)return;close();latest=tracker.finish();stopWatch();saveError=true;renderResult();navigate('result');await persistResult();}
async function persistResult(){if(saving||!latest)return;saving=true;try{const result=await data.saveRun(latest);latest=result;saveError=false;const existing=runs.findIndex(r=>r.id===result.id);if(existing<0)runs.unshift(result);else runs[existing]=result;await refreshTeam();renderSummary();toast('走行記録を保存しました。');}catch(e){saveError=true;toast('保存できませんでした。「再保存」を押してください。この画面は閉じないでください。');}finally{saving=false;renderResult();}}
function renderResult(){if(!latest)return;const r=latest;text('#resultDistance',distance(r.distance_m));text('.result-distance > span:last-child',unit());text('#resultTime',time(r.duration_seconds));text('#resultPace',pace(r.duration_seconds,r.distance_m/1000*factor()));text('.result-stat:nth-child(2) span',`平均ペース /${unit()}`);text('#resultCalories',Math.round(r.distance_m/1000*60));text('.result-stat:nth-child(3) span','推定 kcal（体重60kg）');text('#resultDate',new Date(r.started_at).toLocaleString(locale()));$('.verified-card b').textContent=saving?'保存中…':saveError?'保存に失敗・再保存':r.verification_status==='verified'?`${distance(r.distance_m)} ${unit()} 認定済み`:`${distance(r.distance_m)} ${unit()}・未認定`;
 $('.verified-card p').textContent=saveError?'タップして再保存してください':data.isGuest()?'この端末に保存しました。ランキング対象外です。':'保存しました。サーバーでの認定前です。';
 $('#splitRows').innerHTML=r.splits?.length?r.splits.map(s=>`<div class="split-row"><span>${s.km}</span><span>${pace(s.seconds,1)}</span><span>${s.altitude??'—'}</span></div>`).join(''):'<p class="empty-state">1 kmごとの実測スプリットがここに表示されます。</p>';drawRoute($('.result-map')||$('#screen-result .map-card'),r.points);
 renderAd($('#adResult'),'run-result');
}
async function renderRanking(){const request=++rankRequest;$('#rankRows').innerHTML='<p class="empty-state">読み込み中…</p>';const country=region==='global'?'all':$('#countrySelect').value==='all'?profile.country:$('#countrySelect').value;const rows=await data.rankings(period,country,rankType);if(request!==rankRequest)return;$('#rankRows').innerHTML=rows.length?rows.map((r,i)=>`<div class="rank-item"><span>${i+1}</span><span class="rank-name">${esc(r.name)}</span><strong>${Number(r.distance_km).toFixed(1)}</strong></div>`).join(''):`<p class="empty-state">${data.isGuest()?'ランキングはクラウドログイン後に利用できます。':'この条件の認定記録はまだありません。'}</p>`;}
async function renderTeam(){text('#screen-team .header-title','チーム');$('#team-overview').innerHTML='<p class="empty-state">読み込み中…</p>';team=await data.teamInfo();if(!team){text('#screen-team .header-title','チーム');$('#team-overview').innerHTML='<p class="empty-state">チームに参加して、仲間と走ろう。</p><form class="team-form" id="teamForm"><label for="teamName">チーム名</label><input id="teamName" maxlength="40" placeholder="JASMY RUNNERS" required><button class="primary-btn">参加・新規作成</button></form>';$('#teamName').value=sessionStorage.getItem('jasmy-invite')||'';$('#teamForm').onsubmit=e=>{e.preventDefault();safe(async()=>{await data.joinTeam($('#teamName').value.trim());sessionStorage.removeItem('jasmy-invite');await renderTeam();toast('チームに参加しました。')})();};$('#memberList').innerHTML='<p class="empty-state">まだ参加していません。</p>';$('#team-journey').innerHTML='<p class="empty-state">チームに参加すると累計距離が表示されます。</p>';return;}
 text('#screen-team .header-title',team.name);const members=team.members||[];$('#team-overview').innerHTML=`<div class="team-identity"><b>${esc(team.name)}</b></div><div class="profile-stats"><div class="profile-stat"><b>${members.length}</b><span>メンバー</span></div><div class="profile-stat"><b>${Number(team.recorded_distance_km??team.distance_km??0).toFixed(2)}</b><span>今月の記録距離 km</span></div></div><p class="notice">チームに紐づく走行記録を集計します（未認定を含む・却下は除外）。ランキング・抽選は認定済みのみが対象です。</p><p class="small muted">認定距離 ${Number(team.distance_km||0).toFixed(2)} km · 今月 ${Number(team.recorded_run_count||0)} 回 · UTC基準</p><button class="secondary-btn" data-action="refresh-team">記録を更新</button><button class="primary-btn" data-action="invite">チームに招待する</button>`;
 $('#memberList').innerHTML=members.map(m=>`<div class="member-row"><span class="member-avatar">${esc(m.nickname.slice(0,1))}</span><span class="member-copy"><b>${esc(m.nickname)}</b></span><span class="member-distance">${Number(m.recorded_distance_km??m.distance_km??0).toFixed(2)} km</span></div>`).join('');$('#team-journey').innerHTML=`<div class="journey-card"><h3>チームで日本を縦断しよう</h3><p>累計記録距離（未認定を含む） ${Number(team.recorded_total_km??team.total_km??0).toFixed(2)} km / 2,000 km</p><div class="progress"><span style="width:${Math.min(100,Number(team.recorded_total_km??team.total_km??0)/20)}%"></span></div></div>`;renderSummary();}
async function renderChallenge(){renderWinners();renderAd($('#adChallenge'),'challenge-prize');[challengeList,challengeEntries]=await Promise.all([data.challenges(),data.entries()]);const today=new Date().toISOString().slice(0,10),active=challengeList.filter(c=>c.starts_on<=today&&c.ends_on>=today);if(!active.length){text('#challengeNotice','現在開催中のチャレンジはありません。画像は企画イメージです。');text('#challengeEntries','0');text('#challengeRunDays',summarize(runs).runDays);text('#challengeProgressLabel','0 / 10');$('#challengeProgress').style.width='0%';text('.next-entry b','開催情報の公開をお待ちください。');text('.draw-date b','未定');$('.challenge-meta').style.display='none';if($('#enrollButton'))$('#enrollButton').remove();}else{const c=active[0],n=challengeEntries.filter(e=>e.challenge_id===c.id).length;text('#challengeNotice',`${c.title} · ${c.starts_on} 〜 ${c.ends_on}`);text('#challengeEntries',n);text('#challengeProgressLabel',`${n} / ${c.max_entries}`);$('#challengeProgress').style.width=`${Math.min(100,n/c.max_entries*100)}%`;text('.next-entry b',`認定距離 ${c.min_distance_m/1000} km以上の日が対象です。1日1口。`);$('.challenge-meta').style.display='none';text('.draw-date b',c.draw_on||'未定');if(!$('#enrollButton'))$('.entry-card').insertAdjacentHTML('beforeend','<button class="primary-btn" id="enrollButton">このチャレンジに参加</button>');$('#enrollButton').onclick=safe(async()=>{await data.enroll(c.id);toast('参加登録しました。')});}$('#challenge-past').innerHTML=challengeList.filter(c=>c.ends_on<today).map(c=>`<div class="past-card"><b>${esc(c.title)}</b><p>${esc(c.starts_on)} ～ ${esc(c.ends_on)}</p><span>終了</span></div>`).join('')||'<p class="empty-state">過去のチャレンジはありません。</p>';}
function download(name,contents,type='application/json'){const url=URL.createObjectURL(new Blob([contents],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function shareResult(){if(!latest)return;const c=document.createElement('canvas');c.width=1080;c.height=1080;const x=c.getContext('2d');x.fillStyle='#fff8f2';x.fillRect(0,0,1080,1080);x.fillStyle='#111827';x.font='bold 44px sans-serif';x.fillText('Jasmy Run',80,130);x.font='bold 140px sans-serif';x.fillText(`${distance(latest.distance_m)} ${unit()}`,80,440);x.font='36px sans-serif';x.fillText(`${time(latest.duration_seconds)} · ${pace(latest.duration_seconds,latest.distance_m/1000*factor())}/${unit()}`,80,550);x.fillStyle='#ed8125';x.font='bold 42px sans-serif';x.fillText('#RunWithJasmy',80,950);c.toBlob(b=>{if(b)download('jasmy-run-share.png',b,'image/png');});}
const informational={
 'prize-claim':['賞品の受取について','当選者はニックネームで発表します。賞品の受取には、PDLによるマイナンバーカード認証が必要です。現在、認証サービスとの接続を準備しています。受取手続きの開始後に、このページでご案内します。'],
 'consent':['Jasmy PDL連携は準備中','PDLの認証先とAPI接続はまだ設定されていません。PDLへデータは送信されません。メールアドレスでログインしてください。'],
 'pdl-data':['Your Data. Your Control.','PDLへの接続は準備中です。端末保存モードではこのブラウザ内に保存します。クラウドモードではログインした本人の走行記録を保存します。'],
 'access-log':['データのアクセス状況','PDLのアクセス監査ログは未接続です。この画面では第三者によるアクセス履歴の確認はまだできません。'],
 'run-settings':['GPS計測について','高精度GPSを利用します。画面を開いたまま計測してください。画面ロックやバックグラウンドでの継続計測は保証されません。位置精度が50mを超える点や30秒を超える取得間隔は距離に加算しません。'],
 'map-info':['GPS軌跡','実際に取得した位置の軌跡を表示しています。背景の地図サービスには接続していません。共有画像には軌跡と位置情報を含めません。'],
 'ranking-info':['ランキングの集計','認定済みで、ランキング公開に同意した人の距離だけを集計します。期間はUTC基準です。端末保存の記録や未認定の記録は対象外です。'],
 'challenge-info':['チャレンジへの参加','開催中の企画に参加登録し、条件を満たす認定ランがある日に1口を付与します。賞品、開催期間、抽選は運営による設定が必要です。'],
 'privacy':['データの取り扱い（開発版）','GPS取得は「位置情報を許可する」を押した後に行います。端末保存モードの記録はこのブラウザ内に保存され、クラウドやPDLへ送られません。クラウドログイン時はSupabaseに記録とプロフィールを保存します。位置の詳細はランキングに公開しません。エクスポートと削除はマイページから行えます。正式公開前に運営者・問い合わせ先・保存期間を含むポリシーの確定が必要です。'],
 'terms':['開発版の利用について','このアプリは開発版です。GPSによる距離には誤差があります。安全な場所で利用し、画面操作は立ち止まって行ってください。PDL連携、正式な走行認定、賞品抽選はまだ運用されていません。正式な利用規約は公開前に確定します。']
};
async function sheet(kind){if(saveError&&kind==='history'){toast('未保存の走行記録を再保存してください。');return;}if(informational[kind]){modal(...[informational[kind][0],note(informational[kind][1])]);return;}
 if(kind==='verification'){if(saveError){await persistResult();return;}modal('走行記録の状態',note(latest?.verification_status==='verified'?'この記録はサーバー側で認定されています。':'GPSから計算した記録です。車・自転車との識別や走行認定は未実装のため、ランキングには加算しません。'));}
 if(kind==='profile-edit'){
 let avatar=profile.avatar_data||null,processing=false,selection=0;
 modal('プロフィールを編集',`<form id="profileForm"><img id="avatarPreview" class="avatar avatar-preview" alt="プロフィール画像"><label for="avatarFile">プロフィール画像を変更</label><input id="avatarFile" type="file" accept="image/jpeg,image/png,image/webp"><p class="small">JPEG・PNG・WebP、10MBまで。中央を正方形に切り抜きます。</p><button type="button" id="removeAvatar" class="secondary-btn">画像をリセット</button>${field('ニックネーム','nickname',profile.nickname)}<label for="country">国・地域</label><select id="country"><option value="jp">Japan</option><option value="us">United States</option><option value="sg">Singapore</option><option value="kr">Korea</option></select><button class="primary-btn" id="saveProfileButton">保存</button><p id="profileError" role="alert"></p></form>`);
 const preview=$('#avatarPreview'),save=$('#saveProfileButton');preview.src=avatar||'/assets/83f73b689e45.png';$('#country').value=profile.country;
 $('#removeAvatar').onclick=()=>{selection++;processing=false;save.disabled=false;avatar=null;preview.src='/assets/83f73b689e45.png';$('#avatarFile').value='';text('#profileError','');};
 $('#avatarFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;const token=++selection;processing=true;save.disabled=true;text('#profileError','');try{const result=await resizeAvatar(file);if(token!==selection)return;avatar=result;preview.src=avatar;}catch(err){if(token===selection)text('#profileError',err.message);}finally{if(token===selection){processing=false;save.disabled=false;}}};
 $('#profileForm').onsubmit=async e=>{e.preventDefault();if(processing||save.disabled)return;const next={...profile,nickname:$('#nickname').value.trim(),country:$('#country').value,avatar_data:avatar};if(!next.nickname)return;save.disabled=true;try{await data.saveProfile(next);profile=next;renderSummary();close();toast('プロフィールを保存しました。')}catch(err){text('#profileError',err.message)}finally{save.disabled=false}};
 }
 if(kind==='watch-setup'){
 if(data.isGuest()){modal('Apple Watch連携（Duffy）',note('Duffyと同じAppleヘルスケアの歩数・歩行＋走行距離を、iPhone連携アプリから同期します。Duffyに直接コードを入力する機能ではありません。クラウドへログインすると設定できます。ランキングや認定距離、チャレンジの集計には使いません。'));return;}
 const today=health?.connected&&health.today?`<p class="small">今日：${health.today.steps??0} 歩・${((health.today.distance_m??0)/1000).toFixed(1)} km</p>`:'';
 modal('Apple Watch連携（Duffy）',note('Duffyと同じAppleヘルスケアの歩数・歩行＋走行距離を、iPhone連携アプリから同期します。Duffyに直接コードを入力する機能ではありません。ランキングや認定距離、チャレンジの集計には使いません。')+`<p class="small"><b>状態：${health?.connected?'連携中':'未連携'}</b></p>${today}<button class="primary-btn" id="watchIssueButton">${health?.connected?'連携コードを再発行する':'連携コードを発行する'}</button>${health?.connected?'<button class="danger-btn" id="watchRevokeButton" style="margin-top:8px">連携を解除</button>':''}<p class="small muted">iPhone連携アプリが必要です。歩行＋走行距離はランニングのみの距離ではありません。</p>`);
 $('#watchIssueButton').onclick=safe(async()=>{const token=await data.rotateHealthSyncToken();await refreshHealth();renderHealth();modal('連携コードを発行しました',note('このコードは今だけ表示されます。Jasmy Health Syncの連携コード欄に貼り付けてください。再表示はできません。')+`<div class="code-block">${esc(token)}</div><button class="secondary-btn" id="copyWatchToken">コピーする</button>`);$('#copyWatchToken').onclick=async()=>{try{await navigator.clipboard.writeText(token);toast('コピーしました。')}catch{modal('連携コード',`<input readonly aria-label="連携コード" value="${esc(token)}">`);}};});
 $('#watchRevokeButton')?.addEventListener('click',safe(async()=>{await data.revokeHealthSyncToken();await refreshHealth();renderHealth();close();toast('連携を解除しました。')}));
 }
 if(kind==='history'){
 modal('走行履歴',note('読み込み中…'));const result=await data.load();runs=[...result.runs].sort((a,b)=>new Date(b.started_at)-new Date(a.started_at));if(!$('#sheetOverlay').classList.contains('show')||$('#sheetTitle').textContent!=='走行履歴')return;
 modal('走行履歴',note(`${runs.length}回の記録 · ${data.isGuest()?'このブラウザに保存した履歴':'ログイン中のアカウントの履歴'}`)+(runs.length?runs.map(r=>`<button class="history-item" data-run-id="${esc(r.id)}"><div><b>${distance(r.distance_m)} ${unit()}</b><span>${esc(new Date(r.started_at).toLocaleString(locale()))}</span></div><div>${time(r.duration_seconds)}<span>${pace(r.duration_seconds,r.distance_m/1000*factor())} /${unit()}</span><span>${r.verification_status==='verified'?'認定済み':r.verification_status==='rejected'?'集計対象外':'未認定'} ›</span></div></button>`).join(''):note('まだ走行記録がありません。端末保存の記録は、計測したブラウザから確認してください。')));}

 if(kind==='stored-data')modal('保存されているデータ',note(`${data.isGuest()?'このブラウザ':'クラウド'}に走行記録 ${runs.length}件とプロフィール・同意設定を保存しています。PDLにはまだ保存されていません。`));
 if(kind==='delete-data'){if(tracker.active||saveError)throw Error('計測を終了し、未保存の記録を保存してから削除してください。');modal('アプリデータを削除',note('走行履歴、プロフィール、同意設定、チーム参加、チャレンジ参加を削除します。元に戻せません。ログインアカウント自体は残ります。')+'<button class="danger-btn" id="deleteButton">すべてのアプリデータを削除</button>');$('#deleteButton').onclick=safe(async()=>{$('#deleteButton').disabled=true;try{await data.deleteData();latest=null;team=null;await loadApp();close();navigate('home');toast('アプリデータを削除しました。');}catch(e){$('#deleteButton').disabled=false;throw e;}});}
 if(kind==='finish-run'){if(!tracker.active)return;modal('ランニングを終了しますか？',note('計測を終了し、走行履歴に保存します。')+'<button class="primary-btn" id="confirmFinish">終了して保存</button><button class="secondary-btn" data-action="close-sheet">続ける</button>');$('#confirmFinish').onclick=safe(finishRun);}
 if(kind==='share'){if(!latest){toast('先に走行記録を選択してください。');return;}modal('走行結果を共有',note('距離・時間・ペースだけを画像にします。位置情報やルートは含めません。')+'<button class="primary-btn" id="shareImage">共有画像を保存</button>');$('#shareImage').onclick=shareResult;}
 if(kind==='team-menu'){modal('チーム',note('参加中のチームから退出できます。記録そのものは残ります。')+'<button class="danger-btn" id="leaveTeam">チームを退出</button>');$('#leaveTeam').onclick=safe(async()=>{await data.leaveTeam();team=null;close();await renderTeam();toast('チームを退出しました。')});}
}
function tab(group,prefix,value){$$(`${group} button`).forEach(b=>b.classList.toggle('active',Object.values(b.dataset).includes(value)));$$(`.${prefix}-panel`).forEach(p=>p.classList.toggle('active',p.id===`${prefix}-${value}`));}
async function invite(){if(!team)return;const u=new URL(location.origin);u.searchParams.set('team',team.name);try{await navigator.clipboard.writeText(u.href);toast('招待リンクをコピーしました。')}catch{modal('招待リンク',`<input readonly aria-label="招待リンク" value="${esc(u.href)}">`);}}
async function action(a){if(a==='close-sheet')close();else if(a==='open-consent')sheet('consent');else if(a==='open-settings'){navigate('mypage');tab('#mypageTabs','mypage','settings');}else if(a==='open-full-map'){const points=screen==='result'?latest?.points:tracker.points;drawRoute($('.full-map-body'),points);$('#fullMap').classList.add('show');if(screen==='run')drawLiveRoute();}else if(a==='close-full-map')$('#fullMap').classList.remove('show');else if(a==='refresh-team')await renderTeam();else if(a==='invite')await invite();}
document.addEventListener('click',safe(async e=>{const target=e.target.closest('[data-action],[data-sheet],[data-go],[data-nav-go],[data-toast],[data-run-id]');if(!target||target.disabled)return;if(target.dataset.action)return action(target.dataset.action);if(target.dataset.sheet)return sheet(target.dataset.sheet);if(target.dataset.runId){latest=runs.find(r=>r.id===target.dataset.runId);close();renderResult();navigate('result');return;}if(target.dataset.go)return navigate(target.dataset.go);if(target.dataset.navGo)return target.dataset.navGo==='run'&&!tracker.active?startRun():navigate(target.dataset.navGo);if(target.dataset.toast)return toast(target.dataset.toast);}));
$('#sheetOverlay').onclick=e=>{if(e.target===$('#sheetOverlay'))close()};
let emailRetryAt=0;
$('#emailLoginForm').onsubmit=async e=>{
 e.preventDefault();if(!$('#emailLoginForm').reportValidity())return;
 if(Date.now()<emailRetryAt){text('#emailLoginStatus','再送する場合は60秒ほどお待ちください。');return;}
 const signUp=e.submitter?.id==='emailSignupButton';const button=$('#emailLoginButton'),signupButton=$('#emailSignupButton');button.disabled=true;signupButton.disabled=true;text('#emailLoginStatus','認証メールを送信しています…');
 try{await data.signInWithEmail($('#loginEmail').value,signUp);emailRetryAt=Date.now()+60000;text('#emailLoginStatus','認証メールを送信しました。受信した最新のリンクを開いてログインしてください。届かない場合は迷惑メールフォルダーもご確認ください。');}
 catch(error){text('#emailLoginStatus',error.status===429?'送信回数の上限に達しました。時間をおいて再試行してください。':error.code==='otp_disabled'?'初めての方は「新規登録」からお進みください。':'認証メールを送信できませんでした。メールアドレスを確認し、初めての方は「新規登録」からお進みください。');}
 finally{button.disabled=false;signupButton.disabled=false;}
};
$('#homeStartButton').onclick=safe(startRun);$('#resultStartAgain').onclick=safe(startRun);$('#mainRunButton').onclick=safe(pauseRun);$('#screenLockButton').onclick=()=>{const overlay=$('#runLockOverlay');overlay.hidden=false;$('#screen-run .screen-scroll').inert=true;$('#bottomNav').inert=true;$('#unlockRun').focus();};$('#unlockRun').onclick=()=>{if($('#unlockRun').dataset.confirm!=='yes'){$('#unlockRun').dataset.confirm='yes';text('#unlockRun','もう一度押して解除');setTimeout(()=>{delete $('#unlockRun').dataset.confirm;text('#unlockRun','画面ロックを解除');},3000);return;}$('#runLockOverlay').hidden=true;$('#screen-run .screen-scroll').inert=false;$('#bottomNav').inert=false;delete $('#unlockRun').dataset.confirm;text('#unlockRun','画面ロックを解除');$('#screenLockButton').focus();};$('#finishRunButton').onclick=safe(()=>sheet('finish-run'));$('#shareButton').onclick=()=>sheet('share');
$('#exportDataRow').onclick=()=>{download('jasmy-run-data.json',JSON.stringify({exported_at:new Date().toISOString(),storage:data.isGuest()?'device':'cloud',profile,runs},null,2));toast('全走行記録をエクスポートしました。')};
$('#logoutButton').onclick=safe(async()=>{if(tracker.active||saveError)throw Error('計測を終了し、記録を保存してからログアウトしてください。');await data.logout();ready=false;runs=[];latest=null;team=null;navigate('login')});
$('#unitToggle').onclick=safe(async()=>{const next={...profile,unit:profile.unit==='mile'?'km':'mile'};await data.saveProfile(next);profile=next;renderSummary();updateRun();if(latest)renderResult();toast('距離とペースの表示単位を変更しました。月間目標・ランキングはkm基準です。')});
$$('[data-consent]').forEach(b=>{if(['research','marketing','challenge-notification'].includes(b.dataset.consent)){b.disabled=true;b.classList.remove('on');b.setAttribute('aria-label',`${b.getAttribute('aria-label')||'通知'}（準備中）`);return;}b.onclick=safe(async()=>{b.disabled=true;try{const key=b.dataset.consent,next={...profile,consents:{...profile.consents,[key]:!profile.consents[key]}};await data.saveProfile(next);profile=next;renderSummary();toast('同意設定を保存しました。')}finally{b.disabled=false}});});
$$('#rankingType button').forEach(b=>b.onclick=safe(async()=>{rankType=b.dataset.rankType;$$('#rankingType button').forEach(x=>x.classList.toggle('active',x===b));await renderRanking()}));
$$('#rankingPeriod button').forEach(b=>b.onclick=safe(async()=>{period=b.dataset.period;$$('#rankingPeriod button').forEach(x=>x.classList.toggle('active',x===b));await renderRanking()}));
$$('[data-region]').forEach(b=>b.onclick=safe(async()=>{region=b.dataset.region;$$('[data-region]').forEach(x=>x.classList.toggle('active',x===b));await renderRanking()}));$('#countrySelect').onchange=safe(async()=>{region='country';$$('[data-region]').forEach(b=>b.classList.toggle('active',b.dataset.region===region));await renderRanking()});
$$('#teamTabs button').forEach(b=>b.onclick=()=>tab('#teamTabs','team',b.dataset.teamTab));$$('#mypageTabs button').forEach(b=>b.onclick=()=>tab('#mypageTabs','mypage',b.dataset.mypageTab));
$$('#challengeTabs button').forEach(b=>b.onclick=()=>{$$('#challengeTabs button').forEach(x=>x.classList.toggle('active',x===b));$('#challenge-current').style.display=b.dataset.challengeTab==='current'?'block':'none';$('#challenge-past').classList.toggle('active',b.dataset.challengeTab==='past')});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){close();$('#fullMap').classList.remove('show');}if(e.key==='Tab'&&$('#sheetOverlay').classList.contains('show')){const focusables=$$('button:not(:disabled),input,select,a[href]',$('#sheetContent'));const first=focusables[0],last=focusables.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
window.addEventListener('beforeunload',e=>{if(tracker.active||saveError){e.preventDefault();e.returnValue=''}});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&tracker.active&&!tracker.paused){lock();updateRun()}});
// No fake route or seeded personal statistics appear before the first measurement.
$$('.map-card,.result-map,.full-map-body').forEach(el=>drawRoute(el,[]));text('.gps-status span:last-child','待機中');text('.accuracy','位置精度 —');$('#movementBanner').remove();
const inviteName=new URL(location.href).searchParams.get('team');if(inviteName){sessionStorage.setItem('jasmy-invite',inviteName.slice(0,40));}
// Public ranking consent is separate from private profile storage.
$('#mypage-consent').insertAdjacentHTML('beforeend','<div class="consent-card"><div class="consent-card-head"><div><h3>ランキング公開</h3><p>ニックネーム、国・地域、認定距離を他のログイン利用者へ公開します。位置の軌跡は公開しません。</p></div><button class="switch" id="rankingConsent" role="switch" aria-checked="false" aria-label="ランキング公開"></button></div></div>');
$('#rankingConsent').onclick=safe(async()=>{const next={...profile,consents:{...profile.consents,ranking:!profile.consents.ranking}};await data.saveProfile(next);profile=next;$('#rankingConsent').classList.toggle('on',!!profile.consents.ranking);$('#rankingConsent').setAttribute('aria-checked',!!profile.consents.ranking);toast('ランキング公開設定を保存しました。')});
safe(async()=>{navigate('login');if(await data.restore()){await loadApp();navigate('home');}if(ready){$('#rankingConsent').classList.toggle('on',!!profile.consents.ranking);$('#rankingConsent').setAttribute('aria-checked',!!profile.consents.ranking);}updateRun();})();

$('#retryGPS').onclick=$('#locateGPS').onclick=safe(()=>{if(tracker.active){if(tracker.paused){toast('再開するとGPSを取得します。');return;}watchGPS();}else openLocation();});
$('#requestLocation').onclick=requestLocation;
$('#beginLocatedRun').onclick=safe(()=>{if(!permissionFix)return;if(Date.now()-permissionFix.timestamp>30000){requestLocation();return;}if(tracker.active){lastFix=permissionFix;navigate('run');drawLiveRoute();watchGPS();}else return beginRun();});
$('#viewRunScreen').onclick=()=>{navigate('run');drawLiveRoute();};
$('#routeExample').ontoggle=()=>{if(!$('#routeExample').open)return;drawRoute($('#routeDemo'),[{lat:43.06,lon:141.35},{lat:43.061,lon:141.3505},{lat:43.0615,lon:141.352},{lat:43.0625,lon:141.3525},{lat:43.063,lon:141.354}]);text('#routeDemo .map-caption','軌跡の表示例・保存されません');};
initLanguage(()=>{if(ready)renderSummary();updateRun();if(latest)renderResult();});

let winnerRequest=0;
async function renderWinners(){
 const request=++winnerRequest;text('#winnerList','読み込み中…');
 try{
  const rows=await data.publishedWinners();if(request!==winnerRequest)return;
  const months=[...new Set(rows.map(r=>r.challenge_month?.slice(0,7)).filter(Boolean))].sort().reverse();
  const select=$('#winnerMonth'),previous=select.value;select.innerHTML=months.length?months.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join(''):'<option value="">発表待ち</option>';if(months.includes(previous))select.value=previous;select.disabled=!months.length;
  const show=()=>{$('#winnerList').innerHTML=rows.filter(r=>r.challenge_month?.slice(0,7)===select.value).map(r=>`<div class="winner-row"><span class="winner-badge" aria-hidden="true">★</span><div><b translate="no">${esc(r.nickname)}</b><span translate="no">${esc(r.challenge_title||'')}</span></div></div>`).join('')||'<p class="empty-state">当選者の発表をお待ちください。</p>';};select.onchange=show;show();
 }catch{if(request!==winnerRequest)return;$('#winnerList').innerHTML='<p class="empty-state">当選者を読み込めませんでした。</p><button class="secondary-btn" id="retryWinners">再読み込み</button>';$('#retryWinners').onclick=renderWinners;}
}
