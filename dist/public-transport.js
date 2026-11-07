/* Maré public transport integration — MIT. See project source and data licences. */
'use strict';
const TRANSIT_CODE_URL='https://github.com/arielmbueno-debug/mare-franca-surf-atlas';
function decodeTransitShape(encoded){let i=0,lat=0,lon=0;const coords=[];while(i<encoded.length){const read=()=>{let shift=0,result=0,b;do{if(i>=encoded.length||shift>30)throw Error('Geometria incompleta');b=encoded.charCodeAt(i++)-63;if(b<0||b>63)throw Error('Geometria inválida');result|=(b&31)<<shift;shift+=5;}while(b>=32);return result&1?~(result>>1):result>>1;};lat+=read();lon+=read();const a=lat/1e6,o=lon/1e6;if(Math.abs(a)>90||Math.abs(o)>180)throw Error('Coordenadas inválidas');coords.push([a,o]);}return coords;}
function parisDateParts(date){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));}
function parisLocalToIso(date,time){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))throw Error('Escolha uma data e um horário válidos.');
 const [y,m,d]=date.split('-').map(Number),[h,n]=time.split(':').map(Number),wall=Date.UTC(y,m-1,d,h,n);let utc=wall;
 for(let i=0;i<3;i++){const p=parisDateParts(new Date(utc));utc+=wall-Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);}
 const check=parisDateParts(new Date(utc));if(`${check.year}-${check.month}-${check.day}`!==date||`${check.hour}:${check.minute}`!==time)throw Error('Esse horário não existe em Paris nessa data. Escolha outro horário.');
 return new Date(utc).toISOString();
}
function transitFareSummary(itinerary){
 const transit=itinerary.legs.filter(l=>l.mode!=='WALK'),groups=itinerary.fareTransfers||[],seen=new Set(),products=[];let complete=transit.length>0,total=0,currency=null;
 const collect=value=>{if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object'){if(Number.isFinite(value.amount)&&value.currency)products.push(value);else Object.values(value).forEach(collect);}};
 for(const leg of transit){const index=leg.fareTransferIndex;if(!Number.isInteger(index)||!groups[index]){complete=false;continue;}if(seen.has(index))continue;seen.add(index);const group=groups[index];collect(group);
  let product=null;
  if(!group.rule&&group.effectiveFareLegProducts?.length===1&&group.effectiveFareLegProducts[0]?.length===1&&group.effectiveFareLegProducts[0][0]?.length===1)product=group.effectiveFareLegProducts[0][0][0];
  if(group.rule==='AB'&&group.transferProducts?.length===1)product=group.transferProducts[0];
  if(!product||!Number.isFinite(product.amount)||product.amount<0||!product.currency||(product.riderCategory&&product.riderCategory.isDefaultFareCategory!==true)){complete=false;continue;}
  if(currency&&currency!==product.currency){complete=false;continue;}currency=product.currency;total+=product.amount;
 }
 const unique=[...new Map(products.map(p=>[`${p.name}|${p.amount}|${p.currency}`,p])).values()];
 return {complete:complete&&!!currency,total:complete&&currency?total:null,currency,products:unique};
}
function installPublicTransport(map,{onUpdate,onBeforeDraw}={}){
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const clock=s=>new Intl.DateTimeFormat('pt-BR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}).format(new Date(s));
 const duration=s=>{const m=Math.round(s/60);return m>=60?`${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`:`${m} min`;};
 const money=(n,c)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:c}).format(n);
 const today=()=>{const p=parisDateParts(new Date());return `${p.year}-${p.month}-${p.day}`;};
 const tomorrow=parisDateParts(new Date(Date.now()+86400000));let day=`${tomorrow.year}-${tomorrow.month}-${tomorrow.day}`,time='08:00';
 const cache=new Map(),layer=L.layerGroup().addTo(map);let spot=null,busy=false,message='',attempt=0,controller=null,lastCall=0,visibleKey=null;
 const colors={WALK:'#d1784f',SUBWAY:'#9b718d',SUBURBAN:'#9b718d',TRAM:'#9b718d',BUS:'#9b718d',FERRY:'#547eae'};
 const attribution=`<a href="https://transitous.org/sources/" target="_blank" rel="noopener">Transitous / fontes</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>`;
 const key=s=>`${s.id}|${day}|${time}`;
 const getResult=s=>{const v=cache.get(key(s));return v&&Date.now()-v.checkedAt<300000?v:null;};
 const labelPlace=p=>p.name==='START'?'Paris · centro':p.name==='END'?(spot?.name||'Praia'):p.name;
 function clearOverlay(){if(visibleKey)map.attributionControl.removeAttribution(attribution);layer.clearLayers();visibleKey=null;document.querySelector('.map-area').classList.remove('route-visible');}
 function cancel(){attempt++;controller?.abort();controller=null;busy=false;}
 function attachSpot(s){if(spot?.id!==s.id){cancel();clearOverlay();message='';}spot=s;}
 function detachSpot(){cancel();clearOverlay();spot=null;message='';}
 function render(s){
  const result=getResult(s),it=result?.itineraries[result.index],fare=it?transitFareSummary(it):null;
  const offline=location.protocol==='file:';
  let content=`<div class="transit-close-row"><b>PLANEJAR VIAGEM</b><button data-close aria-label="Fechar planejamento de transporte">×</button></div><div class="transit-date-row"><label>DATA<input id="transitDate" type="date" value="${day}" min="${today()}" aria-label="Data da viagem de transporte público"></label><label>SAÍDA<input id="transitTime" type="time" value="${time}" aria-label="Horário de saída de Paris"></label></div><p class="transit-zone">Horário de Paris · centro → setor da praia${/^\d{4}-\d{2}-\d{2}$/.test(day)?'<br>'+new Intl.DateTimeFormat('pt-BR',{timeZone:'Europe/Paris',day:'2-digit',month:'short',year:'numeric'}).format(new Date(day+'T12:00:00Z')):''}</p><button class="trip-draw transit-search" data-transit-search ${busy||offline?'disabled':''}>${busy?'◌ Buscando conexões…':result?'⌁ Ver conexões no mapa':'⌁ Traçar trem / transporte no mapa'}</button>`;
  if(offline)content+='<p class="trip-status">A busca de horários está disponível na <a href="https://mare-franca-surf-atlas-ariel.a341.chatgpt.site" target="_blank" rel="noopener">versão online do atlas ↗</a>.</p>';
  if(message)content+=`<p class="trip-status transit-error" role="status">${esc(message)}</p>`;
  if(it){
   content+=`<div class="transit-options" aria-label="Alternativas de transporte">${result.itineraries.map((v,i)=>`<button data-transit-option="${i}" class="${i===result.index?'active':''}" aria-pressed="${i===result.index}"><b>${duration(v.duration)}</b><span>${clock(v.startTime)} → ${clock(v.endTime)}</span></button>`).join('')}</div><p class="transit-summary">${new Intl.DateTimeFormat('pt-BR',{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit'}).format(new Date(it.startTime))} · ${it.legs.filter(l=>l.mode!=='WALK').length} embarques · inclui conexões e caminhada</p>`;
   content+=`<div class="transit-price"><span>TARIFAS DA FONTE</span><strong>${fare.complete?money(fare.total,fare.currency):'Total não informado'}</strong>${fare.products.map(p=>`<p>${money(p.amount,p.currency)} · ${esc(p.name||'Tarifa publicada')}</p>`).join('')}<small>${fare.complete?'Valor publicado na base, sem confirmação de reserva ou disponibilidade.':'Valores acima são parciais e não representam o preço da viagem inteira. Tarifas ausentes não significam gratuidade.'}</small><a href="https://www.sncf-connect.com/" target="_blank" rel="noopener">Consultar preços de passagens na SNCF ↗</a></div>`;
   content+='<div class="transit-legs">';
   for(let i=0;i<it.legs.length;i++){const l=it.legs[i];if(l.duration>0){const name=l.mode==='WALK'?`A pé · ${duration(l.duration)}`:l.displayName||l.routeShortName||l.agencyName||l.mode;content+=`<div class="transit-leg" style="--leg:${colors[l.mode]||'#236e6a'}"><b>${esc(name)}</b><span>${esc(labelPlace(l.from))} → ${esc(labelPlace(l.to))}</span><small>${clock(l.startTime)}–${clock(l.endTime)} · ${l.realTime?'atualizado pela fonte':'programado'}</small></div>`;}const next=it.legs[i+1],wait=next?Math.round((Date.parse(next.startTime)-Date.parse(l.endTime))/60000):0;if(wait>0)content+=`<div class="transit-wait">Conexão · ${wait} min de espera</div>`;}
   content+='</div><div class="transit-map-actions"><button data-transit-show>Enquadrar trajeto ↗</button><button data-transit-clear>Limpar desenho ×</button></div>';
   content+=`<p class="trip-footnote">Consulta: ${clock(result.checkedAt)} (Paris). Trem em verde, urbano em roxo e caminhada tracejada. Trechos sem geometria são esquemáticos. Cobertura e alterações dependem da fonte; confira antes de viajar.</p>`;
  }
  content+=`<p class="transit-credits"><a href="https://transitous.org/sources/" target="_blank" rel="noopener">Transitous / fontes ↗</a> · <a href="${TRANSIT_CODE_URL}/issues" target="_blank" rel="noopener">Contato e código aberto ↗</a></p>`;
  return content;
 }
 function draw(result){
  if(!spot)return;onBeforeDraw?.();clearOverlay();const it=result.itineraries[result.index],bounds=[];
  for(const l of it.legs){let coords=[];try{if(l.legGeometry?.points)coords=decodeTransitShape(l.legGeometry.points);}catch{}const schematic=coords.length<2;if(schematic)coords=[[l.from.lat,l.from.lon],[l.to.lat,l.to.lon]];bounds.push(...coords);L.polyline(coords,{color:'#fffdf4',weight:8,interactive:false}).addTo(layer);L.polyline(coords,{color:colors[l.mode]||'#236e6a',weight:l.mode==='WALK'?3:4,dashArray:l.mode==='WALK'||schematic?'5 6':null,interactive:false}).addTo(layer);}
  const stops=new Map();for(const l of it.legs.filter(l=>l.mode!=='WALK'))for(const p of [l.from,l.to])stops.set(`${p.lat.toFixed(5)},${p.lon.toFixed(5)}`,p);
  for(const p of stops.values())L.circleMarker([p.lat,p.lon],{radius:4,color:'#fffdf4',weight:2,fillColor:'#236e6a',fillOpacity:1}).bindTooltip(esc(p.name),{className:'station-label'}).addTo(layer);
  for(const [name,lat,lon]of [['Paris',48.8566,2.3522],[spot.name,spot.lat,spot.lng]])L.circleMarker([lat,lon],{radius:5,color:'#fffdf4',weight:2,fillColor:'#236e6a',fillOpacity:1}).bindTooltip(esc(name),{permanent:true,direction:'right',className:'station-label'}).addTo(layer);
  visibleKey=key(spot);map.attributionControl.addAttribution(attribution);document.querySelector('.map-area').classList.add('route-visible');const size=map.getSize();map.fitBounds(bounds,{paddingTopLeft:[30,100],paddingBottomRight:innerWidth<=760?[30,Math.round(size.y*.43)+20]:[Math.min(360,size.x*.5),100],maxZoom:11,animate:false});
  if(innerWidth<=760){const card=document.getElementById('transitCard'),panel=document.getElementById('detailPanel');if(card)panel.scrollTop+=card.getBoundingClientRect().top-panel.getBoundingClientRect().top-14;}
 }
 async function search(){
  if(!spot||busy||location.protocol==='file:')return;let iso;
  try{iso=parisLocalToIso(day,time);}catch(e){message=e.message;onUpdate?.();return;}
  const cached=getResult(spot);if(cached){message='';draw(cached);onUpdate?.();return;}
  cancel();const current=++attempt,s=spot,cacheKey=key(s);controller=new AbortController();const requestController=controller;busy=true;message='';onUpdate?.();let timer;
  try{
   await new Promise(resolve=>setTimeout(resolve,Math.max(0,1200-(Date.now()-lastCall))));if(requestController.signal.aborted)return;lastCall=Date.now();timer=setTimeout(()=>requestController.abort(),30000);
   const url=new URL('https://api.transitous.org/api/v6/plan');for(const [k,v]of Object.entries({fromPlace:'48.8566,2.3522',toPlace:`${s.lat},${s.lng}`,time:iso,numItineraries:'2',maxItineraries:'2',withFares:'true'}))url.searchParams.set(k,v);
   const response=await fetch(url,{signal:requestController.signal});if(!response.ok)throw Error(response.status===429?'A fonte está ocupada. Aguarde um pouco e tente novamente.':'A fonte de transporte não respondeu. Tente outra data ou confira no Maps.');const data=await response.json();
   const itineraries=(data.itineraries||[]).filter(it=>Number.isFinite(it.duration)&&Number.isFinite(Date.parse(it.startTime))&&Number.isFinite(Date.parse(it.endTime))&&Array.isArray(it.legs)&&it.legs.some(l=>l.mode!=='WALK')&&it.legs.every(l=>l.from&&l.to&&[l.from.lat,l.from.lon,l.to.lat,l.to.lon].every(Number.isFinite))).slice(0,3);
   if(!itineraries.length)throw Error('Nenhuma conexão encontrada nessa data até o pico. A cobertura ou o acesso final pode ser limitado. Confira também no Maps.');if(current!==attempt)return;
   const result={itineraries,index:0,checkedAt:Date.now()};cache.set(cacheKey,result);busy=false;onUpdate?.();draw(result);
  }catch(e){if(current===attempt)message=e.name==='AbortError'?'A consulta demorou a responder. Tente novamente.':e instanceof TypeError?'Sem conexão com a fonte de transporte. Tente novamente ou consulte no Maps.':e.message;}
  finally{clearTimeout(timer);if(current===attempt){busy=false;controller=null;onUpdate?.();}}
 }
 const panel=document.getElementById('detailPanel');
 panel.addEventListener('change',e=>{if(e.target.id==='transitDate'||e.target.id==='transitTime'){cancel();clearOverlay();day=document.getElementById('transitDate').value;time=document.getElementById('transitTime').value;message='';onUpdate?.();}});
 panel.addEventListener('click',e=>{if(e.target.closest('[data-transit-search]'))search();const option=e.target.closest('[data-transit-option]');if(option&&spot){const result=getResult(spot),index=Number(option.dataset.transitOption);if(result?.itineraries[index]){result.index=index;onUpdate?.();draw(result);}}if(e.target.closest('[data-transit-show]')&&spot){const result=getResult(spot);if(result)draw(result);}if(e.target.closest('[data-transit-clear]'))clearOverlay();});
 return {attachSpot,detachSpot,clearOverlay,render,cancel};
}
