'use strict';
const $ = id => document.getElementById(id);
const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const fullMonths = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const regions = [...new Set(SPOTS.map(s => s.region))];
const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const color = s => s.quality >= 5 ? '#d35d38' : s.quality >= 4 ? '#236e6a' : '#71898d';
const dots = n => `<span class="rating-dots" aria-label="${n} de 5">${Array.from({length:5},(_,i)=>`<i class="${i<n?'filled':''}"></i>`).join('')}</span>`;
const state = {query:'',region:'',level:'',month:0,quality:false,consistent:false,favorites:false,sort:'quality',selected:null};
const initialId=new URLSearchParams(location.search).get('pico');
let saved;
try { const raw=JSON.parse(localStorage.getItem('mare-france-saved')||'[]'); saved=new Set(Array.isArray(raw)?raw:[]); } catch {saved=new Set();}
let filtered = [], markers = new Map(), listOpen = false;
const map = L.map('map', {zoomControl:false, minZoom:4,maxZoom:17,zoomSnap:.25,zoomDelta:.5,scrollWheelZoom:true}).setView([46.3,1.8],6);
L.control.zoom({position:'topright'}).addTo(map);
const basemap=installBasemap(map,SPOTS);
const journey=installJourney(map,{onMeasureStart:()=>closeDetail()});
const cluster = L.markerClusterGroup({maxClusterRadius:34,disableClusteringAtZoom:11,showCoverageOnHover:false,spiderfyOnMaxZoom:true,animate:!matchMedia('(prefers-reduced-motion: reduce)').matches,iconCreateFunction:g=>L.divIcon({className:'surf-cluster',html:`<span class="cluster-dot">${g.getChildCount()}</span>`,iconSize:[34,34]})});
map.addLayer(cluster);
const seasonText = s => s.months.map(m=>months[m-1]).join(' · ');
const tooltip = s => `<div class="tooltip-inner"><div class="tooltip-region">${esc(s.region)} · ${esc(s.type)}</div><h3>${esc(s.name)}</h3><p>${esc(s.city)} · ${esc(s.level)}</p><div class="tooltip-metrics"><span>Qualidade ${s.quality}/5 ${dots(s.quality)}</span><span>Constância ${s.consistency}/5 ${dots(s.consistency)}</span></div><div class="tooltip-season"><b>Melhor janela</b><br>${esc(seasonText(s))}<br>${esc(s.cityInfo)}</div><div class="tooltip-hint">Perfil típico · clique para abrir a ficha ↗</div></div>`;
for(const s of SPOTS){
 const marker=L.marker([s.lat,s.lng],{title:`${s.name}, ${s.city}`,alt:s.name,keyboard:true,icon:L.divIcon({className:'surf-marker',html:`<span class="pin" style="--dot:${color(s)}"></span>`,iconSize:[16,16],iconAnchor:[8,8]})});
 marker.bindTooltip(tooltip(s),{className:'surf-tooltip',direction:'auto',offset:[11,0],opacity:1});
 marker.on('click',()=>selectSpot(s.id,true));
 markers.set(s.id,marker);
}
$('totalSpots').textContent=SPOTS.length;
$('totalRegions').textContent=regions.length;
$('region').insertAdjacentHTML('beforeend',regions.map(r=>`<option>${esc(r)}</option>`).join(''));
$('month').insertAdjacentHTML('beforeend',fullMonths.map((m,i)=>`<option value="${i+1}">${m} · janela recomendada</option>`).join(''));
function updateSaved(){
 try{localStorage.setItem('mare-france-saved',JSON.stringify([...saved]));}catch{}
 $('favCount').textContent=saved.size;
 $('favoritesBtn').setAttribute('aria-pressed',state.favorites);
}
function toggleSaved(id){
 saved.has(id)?saved.delete(id):saved.add(id);updateSaved();
 if(state.favorites)render();else renderList();
 if(state.selected===id)renderDetail(SPOTS.find(s=>s.id===id));
}
function render(){
 const q=norm(state.query.trim());
 filtered=SPOTS.filter(s=>(!q||norm(`${s.name} ${s.city} ${s.region}`).includes(q))&&(!state.region||s.region===state.region)&&(!state.level||s.level===state.level)&&(!state.month||s.months.includes(state.month))&&(!state.quality||s.quality>=4)&&(!state.consistent||s.consistency>=4)&&(!state.favorites||saved.has(s.id)));
 filtered.sort((a,b)=>state.sort==='name'?a.name.localeCompare(b.name,'pt-BR'):state.sort==='distance'?journey.parisDistance(a)-journey.parisDistance(b):state.sort==='north'?b.lat-a.lat:state.sort==='consistency'?b.consistency-a.consistency||b.quality-a.quality:b.quality-a.quality||b.consistency-a.consistency||a.name.localeCompare(b.name,'pt-BR'));
 cluster.clearLayers();cluster.addLayers(filtered.map(s=>markers.get(s.id)));
 $('resultCount').textContent=filtered.length;if($('mobileCount'))$('mobileCount').textContent=filtered.length;
 $('mapSubtitle').textContent=state.region||`${filtered.length} picos · mapa explorável`;
 $('qualityChip').setAttribute('aria-pressed',state.quality);$('consistentChip').setAttribute('aria-pressed',state.consistent);
 if(state.selected&&!filtered.some(s=>s.id===state.selected))closeDetail();
 renderList();updateSaved();markSelected();
}
function renderList(){
 $('spotList').innerHTML=filtered.length?filtered.map(s=>`<article class="spot-card ${s.id===state.selected?'selected':''}" data-id="${esc(s.id)}"><button class="card-main" data-open="${esc(s.id)}" aria-label="Ver ${esc(s.name)}"><div class="card-top"><i class="card-dot" style="--dot:${color(s)}"></i>${esc(s.region)} <span>· ${esc(s.type)}</span></div><h2>${esc(s.name)}</h2><div class="card-city">${esc(s.city)}</div><div class="card-distance">↔ ${tripDistanceLabel(journey.parisDistance(s))} de Paris · linha reta</div><div class="card-bottom"><span class="card-level">${esc(s.level)}</span><span class="card-rating" title="Qualidade editorial ${s.quality}/5">${dots(s.quality)} ${s.quality}/5</span><span class="card-rating" title="Constância editorial">≋ ${s.consistency}/5</span></div></button><button class="save-btn ${saved.has(s.id)?'saved':''}" data-save="${esc(s.id)}" aria-label="${saved.has(s.id)?'Remover dos salvos':'Salvar'} ${esc(s.name)}" aria-pressed="${saved.has(s.id)}">${saved.has(s.id)?'♥':'♡'}</button></article>`).join(''):`<div class="empty-state"><strong>Nenhuma onda por aqui… ainda.</strong>${state.favorites?'Salve seus picos favoritos tocando no coração, ou ajuste os filtros.':'Experimente outra região, mês ou nível para abrir novas possibilidades.'}<br><button data-reset>Mostrar todos os picos ↗</button></div>`;
}
function markSelected(){
 for(const [id,m]of markers)m.getElement()?.classList.toggle('active',id===state.selected);
}
function selectSpot(id,fromMap=false){
 const s=SPOTS.find(s=>s.id===id);if(!s)return;
 if(journey.isMeasuring()){journey.addPoint(s);setListOpen(false);return;}
 state.selected=id;renderList();renderDetail(s);setListOpen(false);markers.get(id).closeTooltip();
 $('mapInstruction').hidden=true;
 if(!fromMap||map.getZoom()<11){
  const zoom=Math.max(map.getZoom(),12);map.setView([s.lat,s.lng],zoom,{animate:false});
  if(innerWidth>760)map.panBy([155,0],{animate:false});else map.panBy([0,Math.round(map.getSize().y*.20)],{animate:false});
 }
 markSelected();
 const url=new URL(location.href);url.searchParams.set('pico',id);history.replaceState(null,'',url);
}
function renderDetail(s){
 if(!s)return;
 journey.attachSpot(s);
 $('detailPanel').innerHTML=`<div class="detail-hero"><div class="eyebrow">${esc(s.region)} / FRANÇA</div><button class="close-detail" data-close aria-label="Fechar ficha">×</button><h2>${esc(s.name)}</h2><p>${esc(s.city)} &nbsp; ${s.lat.toFixed(3)}°, ${s.lng.toFixed(3)}°</p></div><div class="detail-body"><div class="detail-tags"><span>${esc(s.level)}</span><span>${esc(s.type)}</span><span>Perfil típico · sem dados ao vivo</span></div><p class="detail-desc">${esc(s.description)}</p><section id="tripCard" class="trip-card" aria-label="Como chegar desde Paris">${journey.tripMarkup(s)}</section><div class="metric-grid"><div><div class="metric-label">QUALIDADE · POTENCIAL</div><div class="metric-value">${s.quality}<small>/5</small>${dots(s.quality)}</div></div><div><div class="metric-label">CONSTÂNCIA · HABITUAL</div><div class="metric-value">${s.consistency}<small>/5</small>${dots(s.consistency)}</div></div></div><h3>Quando planejar sua sessão</h3><div class="calendar" aria-label="Melhores meses: ${esc(seasonText(s))}">${months.map((m,i)=>`<span class="${s.months.includes(i+1)?'good':''} ${state.month===i+1?'chosen':''}">${m}<i></i></span>`).join('')}</div><div class="season-note">■ Janela recomendada para o perfil indicado</div><h3>O que faz a onda funcionar</h3><dl class="conditions"><div><dt>Swell favorável</dt><dd>${esc(s.swell)}</dd></div><div><dt>Vento favorável</dt><dd>${esc(s.wind)}</dd></div><div><dt>Maré</dt><dd>${esc(s.tide)}</dd></div></dl><h3>Depois de sair do mar</h3><p class="city-info">${esc(s.cityInfo)}</p><div class="caution">↗ <b>Olho no pico.</b> ${esc(s.caution)}</div><div class="detail-actions"><a href="https://www.google.com/search?q=${encodeURIComponent(s.name+' '+s.city+' surf forecast')}" target="_blank" rel="noopener">Procurar previsão ↗</a><button data-detail-save="${esc(s.id)}" aria-pressed="${saved.has(s.id)}">${saved.has(s.id)?'♥ Salvo':'♡ Salvar pico'}</button></div><div class="detail-links"><a href="${esc(s.source)}" target="_blank" rel="noopener">Fonte do guia ↗</a><a href="https://www.google.com/maps/search/?api=1&query=${s.lat}%2C${s.lng}" target="_blank" rel="noopener">Localizar praia ↗</a></div><p class="editorial-note">Guia editorial, sem condições ao vivo. Notas e meses indicam potencial, não garantia. Coordenadas aproximadas. O mar e as regras locais precisam ser conferidos antes da sessão.</p></div>`;
 $('detailPanel').hidden=false;$('detailPanel').scrollTop=0;
}
function closeDetail(){journey.detachSpot();state.selected=null;$('detailPanel').hidden=true;$('mapInstruction').hidden=false;renderList();markSelected();const url=new URL(location.href);url.searchParams.delete('pico');history.replaceState(null,'',url);}
function fitResults(){
 if(!filtered.length)return;
 closeDetail();
 map.fitBounds(L.latLngBounds(filtered.map(s=>[s.lat,s.lng])),{paddingTopLeft:[45,75],paddingBottomRight:[45,95],maxZoom:11,animate:false});
}
function reset(){Object.assign(state,{query:'',region:'',level:'',month:0,quality:false,consistent:false,favorites:false});$('search').value='';$('region').value='';$('level').value='';$('month').value='0';render();fitResults();}
function setListOpen(open){listOpen=open;document.querySelector('.app').classList.toggle('list-open',open);$('mobileList').innerHTML=open?'⌖ Voltar ao mapa':`☷ Ver picos <span id="mobileCount">${filtered.length}</span>`;if(!open)setTimeout(()=>map.invalidateSize(),50);}
function showAbout(){if(!$('aboutDialog').open)$('aboutDialog').showModal();}
$('search').addEventListener('input',e=>{state.query=e.target.value;render();});
for(const key of ['region','level','month','sort'])$(key).addEventListener('change',e=>{state[key]=key==='month'?Number(e.target.value):e.target.value;render();if(key==='region')fitResults();else if(state.selected)renderDetail(SPOTS.find(s=>s.id===state.selected));});
$('qualityChip').onclick=()=>{state.quality=!state.quality;render();};$('consistentChip').onclick=()=>{state.consistent=!state.consistent;render();};
$('favoritesBtn').onclick=()=>{state.favorites=!state.favorites;render();if(innerWidth<=760)setListOpen(true);};
$('reset').onclick=reset;$('fitBtn').onclick=fitResults;$('exploreNav').onclick=()=>{reset();setListOpen(false);};
$('spotList').addEventListener('click',e=>{const save=e.target.closest('[data-save]'),open=e.target.closest('[data-open]');if(save)toggleSaved(save.dataset.save);else if(open)selectSpot(open.dataset.open);else if(e.target.closest('[data-reset]'))reset();});
$('spotList').addEventListener('mouseover',e=>{if(innerWidth<=760)return;const card=e.target.closest('[data-id]');if(!card||card.contains(e.relatedTarget))return;const marker=markers.get(card.dataset.id);if(map.hasLayer(marker))marker.openTooltip();});
$('spotList').addEventListener('mouseout',e=>{const card=e.target.closest('[data-id]');if(card&&!card.contains(e.relatedTarget))markers.get(card.dataset.id)?.closeTooltip();});
$('detailPanel').addEventListener('click',e=>{if(e.target.closest('[data-close]'))closeDetail();const save=e.target.closest('[data-detail-save]');if(save)toggleSaved(save.dataset.detailSave);});
for(const id of ['aboutBtn','methodBtn','legendInfo'])$(id).onclick=showAbout;
$('closeDialog').onclick=()=>$('aboutDialog').close();
$('aboutDialog').addEventListener('click',e=>{if(e.target===$('aboutDialog')){const r=$('aboutDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('aboutDialog').close();}});
$('mobileList').onclick=()=>setListOpen(!listOpen);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('aboutDialog').open)closeDetail();if(e.key==='/'&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();if(innerWidth<=760)setListOpen(true);$('search').focus();}});
const sourceHosts=[...new Map(SPOTS.map(s=>[new URL(s.source).hostname.replace(/^www\./,''),s.source])).entries()];
$('sources').innerHTML=`<a href="https://www.surfingfrance.com/federation/les-spots-de-surf-en-france.html" target="_blank" rel="noopener">Fédération Française de Surf ↗</a>`+sourceHosts.map(([host,url])=>`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(host)} ↗</a>`).join('');
render();fitResults();
if(initialId&&SPOTS.some(s=>s.id===initialId))selectSpot(initialId);
map.on('zoomend moveend',markSelected);
window.addEventListener('resize',()=>{map.invalidateSize();if(innerWidth>760&&listOpen)setListOpen(false);});
