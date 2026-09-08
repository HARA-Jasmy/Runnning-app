// Sponsor slots read creative from public/ads.json so a campaign can be swapped
// without a rebuild. Slots are opt-in per screen; tracking and permission screens
// never call renderAd, so no ad can appear there.
import {escapeHtml as esc} from './tracker.js';
let cache=null;
async function load(){
 if(cache)return cache;
 try{const r=await fetch('/ads.json',{cache:'no-store'});cache=r.ok?await r.json():{};}catch{cache={};}
 return cache;
}
export async function renderAd(container,slot){
 if(!container)return;
 const ads=await load(),ad=ads[slot];
 if(!ad||!ad.headline){container.hidden=true;container.innerHTML='';return;}
 const cta=ad.cta?(/^https?:\/\//.test(ad.href||'')?`<a class="ad-cta" href="${esc(ad.href)}" target="_blank" rel="noopener noreferrer sponsored">${esc(ad.cta)}</a>`:`<button class="ad-cta" type="button" data-toast="広告の内容は表示サンプルです。">${esc(ad.cta)}</button>`):'';
 container.hidden=false;
 const image=ad.image&&/^\/assets\/[a-zA-Z0-9_.-]+$/.test(ad.image)?`<img class="ad-image" src="${esc(ad.image)}" alt="${esc(ad.imageAlt||'')}" loading="lazy">`:'';
 container.innerHTML=`<div class="ad-heading"><span class="ad-badge">PR</span><span>スポンサー広告</span></div><div class="ad-main">${image}<div class="ad-copy"><span class="ad-sponsor">${esc(ad.sponsor||'スポンサー広告')}</span><b>${esc(ad.headline).replace(/\n/g,'<br>')}</b>${ad.body?`<p>${esc(ad.body)}</p>`:''}</div></div>${cta}`;
}
