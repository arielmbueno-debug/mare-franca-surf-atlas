'use strict';
const clean=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=iso=>new Intl.DateTimeFormat('pt-BR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));
const duration=s=>`${Math.floor(s/3600)}h${String(Math.floor(s/60)%60).padStart(2,'0')}`;
function decodeTransitPolyline(encoded){let i=0,lat=0,lon=0;const coords=[];while(i<encoded.length){const read=()=>{let shift=0,result=0,b;do{if(i>=encoded.length)throw Error('Geometria incompleta');b=encoded.charCodeAt(i++)-63;result|=(b&31)<<shift;shift+=5;}while(b>=32);return result&1?~(result>>1):result>>1;};lat+=read();lon+=read();coords.push([lat/1e6,lon/1e6]);}return coords;}
const map=L.map('map',{zoomSnap:.25,scrollWheelZoom:true}).setView([46.7,.7],6);
L.geoJSON(BASEMAP_GEOGRAPHY,{interactive:false,style:f=>({fillColor:f.properties.code==='FRA'?'#f7f3e6':'#e8eee3',fillOpacity:1,color:'#b2c1b1',weight:.8})}).addTo(map);
for(const [name,lat,lng]of [['FRANÇA',46.9,2.8],['ESPANHA',40.6,-3],['ITÁLIA',44,10.7],['BÉLGICA',50.8,4.6],['Paris',48.8566,2.3522],['Bordeaux',44.8378,-.5792],['Nantes',47.2184,-1.5536]])L.marker([lat,lng],{interactive:false,icon:L.divIcon({className:'country-label',html:name,iconSize:[100,18],iconAnchor:[50,9]})}).addTo(map);
map.attributionControl.addAttribution('<a href="https://www.naturalearthdata.com/">Natural Earth</a> · <a href="https://transitous.org/sources/">Transitous / fontes</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>');
const route=L.layerGroup().addTo(map);
const colors={WALK:'#d1784f',SUBWAY:'#9b718d',TRAM:'#9b718d',BUS:'#9b718d'};
const formatName=p=>p.name==='START'?'Paris · centro':p.name==='END'?'Soulac Centre · praia':p.name;
function fareProducts(value,output=[]){if(Array.isArray(value))for(const v of value)fareProducts(v,output);else if(value&&typeof value==='object'){if(Number.isFinite(value.amount)&&value.currency)output.push(value);else for(const v of Object.values(value))fareProducts(v,output);}return output;}
function show(index){
 const trip=TRANSIT_SAMPLE.itineraries[index];route.clearLayers();const bounds=[];
 for(const leg of trip.legs){const coords=leg.legGeometry?.points?decodeTransitPolyline(leg.legGeometry.points):[[leg.from.lat,leg.from.lon],[leg.to.lat,leg.to.lon]];bounds.push(...coords);L.polyline(coords,{color:'#fffdf5',weight:7,interactive:false}).addTo(route);L.polyline(coords,{color:colors[leg.mode]||'#236e6a',weight:leg.mode==='WALK'?3:4,dashArray:leg.mode==='WALK'?'5 6':null,interactive:false}).addTo(route);}
 const stops=new Map();for(const l of trip.legs.filter(l=>l.mode!=='WALK'))for(const p of [l.from,l.to])stops.set(p.name,p);stops.set('Paris',{name:'Paris',lat:48.8566,lon:2.3522});stops.set('Soulac Centre',TRANSIT_SAMPLE.destination);
 for(const p of stops.values()){const lon=p.lon??p.lng;L.circleMarker([p.lat,lon],{radius:4,color:'#fffdf5',weight:2,fillColor:'#236e6a',fillOpacity:1}).bindTooltip(clean(p.name),{permanent:p.name==='Paris'||p.name==='Soulac Centre',direction:'right',className:'station-label'}).addTo(route);}
 map.fitBounds(bounds,{padding:[45,65],maxZoom:10,animate:false});
 document.getElementById('choices').innerHTML=TRANSIT_SAMPLE.itineraries.map((it,i)=>`<button data-choice="${i}" class="choice ${i===index?'active':''}" aria-pressed="${i===index}"><strong>${duration(it.duration)}</strong><span>${time(it.startTime)} → ${time(it.endTime)}</span><small>${it.legs.filter(l=>l.mode!=='WALK').length} embarques · com conexões e caminhada</small></button>`).join('');
 let legs='';for(let i=0;i<trip.legs.length;i++){const l=trip.legs[i],mins=Math.round(l.duration/60);if(l.duration>0)legs+=`<div class="leg" style="--leg:${colors[l.mode]||'#236e6a'}"><strong>${clean(l.mode==='WALK'?`A pé · ${mins} min`:l.displayName||l.agencyName||l.mode)}</strong><div class="stations">${clean(formatName(l.from))} → ${clean(formatName(l.to))}</div><div class="time">${time(l.startTime)}–${time(l.endTime)} · ${l.realTime?'atualizado pela fonte':'horário programado'}</div></div>`;const next=trip.legs[i+1];if(next){const wait=Math.round((Date.parse(next.startTime)-Date.parse(l.endTime))/60000);if(wait>0)legs+=`<div class="wait">Conexão · ${wait} min de espera</div>`;}}
 document.getElementById('legs').innerHTML=legs;
 const products=[...new Map(fareProducts(trip.fareTransfers).map(p=>[p.name+'|'+p.amount+'|'+p.currency,p])).values()];
 document.getElementById('fare').innerHTML=`<div class="label">PREÇO · DADOS PARCIAIS</div><h2>Total não disponível</h2>${products.map(p=>`<p class="known">${new Intl.NumberFormat('pt-BR',{style:'currency',currency:p.currency}).format(p.amount)} · ${clean(p.name)}</p>`).join('')}<p>O valor informado cobre o bilhete urbano. A fonte não forneceu preços do TGV e do TER. Não é o preço da viagem inteira.</p>`;
}
document.getElementById('choices').addEventListener('click',e=>{const b=e.target.closest('[data-choice]');if(b)show(Number(b.dataset.choice));});
show(0);window.addEventListener('resize',()=>map.invalidateSize());
