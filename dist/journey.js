'use strict';
const TRIP_PARIS={lat:48.8566,lng:2.3522};
function tripDistanceKm(a,b){
 const rad=n=>n*Math.PI/180;
 const dlat=rad(b.lat-a.lat),dlng=rad(b.lng-a.lng);
 const h=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlng/2)**2;
 return 6371.0088*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
function tripDirectionsUrl(spot,mode){const url=new URL('https://www.google.com/maps/dir/');url.searchParams.set('api','1');url.searchParams.set('origin',`${TRIP_PARIS.lat},${TRIP_PARIS.lng}`);url.searchParams.set('destination',`${spot.lat},${spot.lng}`);url.searchParams.set('travelmode',mode);return url.href;}
function tripDistanceLabel(km){return km<1?`${Math.round(km*1000)} m`:`${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:km<100?1:0}).format(km)} km`;}
function tripDurationLabel(seconds){const minutes=Math.max(5,Math.round(seconds/300)*5);return `${Math.floor(minutes/60)}h${minutes%60?String(minutes%60).padStart(2,'0'):''}`;}
function installJourney(map,{onMeasureStart}={}){
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const get=id=>document.getElementById(id);
 const rulerButton=get('measureBtn'),panel=get('measurePanel');
 const roadLayer=L.layerGroup().addTo(map),measureLayer=L.layerGroup().addTo(map);
 const cache=new Map();let selected=null,activeRoad=null,pending=null,error='',controller=null,sequence=0,lastRequestAt=0;
 let measuring=false,points=[],travelMode='car';
 const transit=installPublicTransport(map,{onUpdate:refreshTrip,onBeforeDraw:()=>{stopMeasure();clearRoute();}});
 function parisMarker(layer){return L.marker(TRIP_PARIS,{interactive:false,keyboard:false,icon:L.divIcon({className:'trip-origin-marker',html:'<span>Paris</span><i></i>',iconSize:[55,30],iconAnchor:[27,25]})}).addTo(layer);}
 const routeAttribution='<a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener">OSRM / FOSSGIS</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
 function clearRoute(){if(activeRoad)map.attributionControl.removeAttribution(routeAttribution);roadLayer.clearLayers();activeRoad=null;document.querySelector('.map-area').classList.remove('route-visible');}
 function cancelRequest(){sequence++;controller?.abort();controller=null;pending=null;}
 function attachSpot(s){if(selected?.id!==s.id){cancelRequest();clearRoute();error='';}selected=s;transit.attachSpot(s);}
 function detachSpot(){cancelRequest();clearRoute();selected=null;error='';transit.detachSpot();}
 function tripMarkup(s){
  const result=cache.get(s.id),busy=pending===s.id,routeError=selected?.id===s.id?error:'';
  const heading=`<div class="trip-heading"><span>DE PARIS ATÉ A PRAIA</span><button class="trip-close" data-close aria-label="Fechar ficha do pico">×</button></div><div class="trip-straight"><strong>${tripDistanceLabel(tripDistanceKm(TRIP_PARIS,s))}</strong><span>em linha reta<br><b>desde o centro de Paris</b></span></div><p class="trip-origin-note">Saída: centro de Paris · destino: ${esc(s.name)}</p>`;
  const road=`${result?`<div class="trip-road-result"><div><b>${tripDistanceLabel(result.distance/1000)}</b><span>pela rota de carro</span></div><div><b>≈ ${tripDurationLabel(result.duration)}</b><span>sem trânsito / paradas</span></div></div>`:''}<button class="trip-draw" data-trip-draw="${esc(s.id)}" ${busy?'disabled':''}>${busy?'◌ Calculando trajeto…':result?'⌁ Ver trajeto de carro no mapa':'⌁ Traçar de carro no mapa'}</button>${activeRoad===s.id?'<button class="trip-clear" data-trip-clear>Limpar trajeto do mapa ×</button>':''}<div class="trip-external"><a href="${esc(tripDirectionsUrl(s,'driving'))}" target="_blank" rel="noopener">Carro no Maps ↗</a><a href="${esc(tripDirectionsUrl(s,'transit'))}" target="_blank" rel="noopener">Trem / transporte ↗</a></div><p class="trip-status" role="status">${esc(routeError||'Abra o Maps para consultar caminhos, conexões e horários para sua data.')}</p>${result?`<p class="trip-footnote">Estimativa OSRM até uma via próxima ao pico.${result.snap>100?` Último trecho: cerca de ${tripDistanceLabel(result.snap/1000)} em linha reta; confirme o acesso à praia.`:''} ${s.region==='Córsega'||/Sauzon|Bangor/.test(s.city)?'Pode envolver balsa; confira a travessia e o embarque. ':''}Sem trânsito, paradas ou espera de balsa. <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener">Fonte ↗</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">Corrigir mapa ↗</a></p>`:''}`;
  const tabs=`<div class="trip-mode-tabs" aria-label="Meio de transporte"><button data-trip-mode="car" aria-pressed="${travelMode==='car'}">Carro</button><button data-trip-mode="transit" aria-pressed="${travelMode==='transit'}">Trem + transporte</button></div>`;
  return heading+tabs+(travelMode==='transit'?`<section id="transitCard" aria-label="Planejar transporte público">${transit.render(s)}</section>`:road);
 }
 function refreshTrip(){if(selected&&get('tripCard'))get('tripCard').innerHTML=tripMarkup(selected);}
 function stopMeasure(){measuring=false;points=[];measureLayer.clearLayers();panel.hidden=true;rulerButton.setAttribute('aria-pressed','false');get('map').classList.remove('is-measuring');}
 function showRoad(s,result){
  transit.clearOverlay();stopMeasure();clearRoute();activeRoad=s.id;map.attributionControl.addAttribution(routeAttribution);
  const coords=result.coordinates.map(p=>[p[1],p[0]]);
  L.polyline(coords,{color:'#fffdf4',weight:8,opacity:.95,interactive:false}).addTo(roadLayer);
  L.polyline(coords,{color:'#d35d38',weight:4,opacity:1,interactive:false}).addTo(roadLayer);
  parisMarker(roadLayer);
  const end=coords.at(-1);
  L.circleMarker(end,{radius:5,color:'#236e6a',weight:2,fillColor:'#fffdf4',fillOpacity:1,interactive:false}).addTo(roadLayer);
  if(result.snap>30)L.polyline([end,[s.lat,s.lng]],{color:'#236e6a',weight:2,dashArray:'4 5',interactive:false}).addTo(roadLayer);
  document.querySelector('.map-area').classList.add('route-visible');
  const size=map.getSize(),mobile=innerWidth<=760;
  map.fitBounds(L.latLngBounds([[TRIP_PARIS.lat,TRIP_PARIS.lng],...coords,[s.lat,s.lng]]),{paddingTopLeft:[30,100],paddingBottomRight:mobile?[30,Math.round(size.y*.43)+20]:[Math.min(360,size.x*.5),100],maxZoom:11,animate:false});
  refreshTrip();
  if(mobile){const detail=get('detailPanel'),card=get('tripCard');detail.scrollTop+=card.getBoundingClientRect().top-detail.getBoundingClientRect().top-14;}
 }
 async function drawRoad(s){
  if(pending)return;
  if(cache.has(s.id)){showRoad(s,cache.get(s.id));return;}
  const attempt=++sequence;controller=new AbortController();const requestController=controller;
  pending=s.id;error='';refreshTrip();let timer;
  try{
   await new Promise(resolve=>setTimeout(resolve,Math.max(0,1100-(Date.now()-lastRequestAt))));
   if(requestController.signal.aborted)return;
   lastRequestAt=Date.now();timer=setTimeout(()=>requestController.abort(),14000);
   const coordinates=`${TRIP_PARIS.lng},${TRIP_PARIS.lat};${s.lng},${s.lat}`;
   const response=await fetch(`https://routing.openstreetmap.de/routed-car/route/v1/driving/${coordinates}?overview=simplified&geometries=geojson&steps=false`,{signal:requestController.signal});
   if(!response.ok)throw new Error('O serviço de trajetos está indisponível. Use os links do Maps para continuar.');
   const data=await response.json(),route=data.routes?.[0],snap=data.waypoints?.at(-1)?.distance;
   if(data.code!=='Ok'||!route||!Array.isArray(route.geometry?.coordinates)||route.geometry.coordinates.length<2||!Number.isFinite(route.distance)||!Number.isFinite(route.duration))throw new Error('Não foi possível encontrar uma rota de carro. Consulte as opções e travessias no Maps.');
   if(!Number.isFinite(snap)||snap>3000)throw new Error('A estrada encontrada fica longe deste pico. Consulte o acesso final e as travessias no Maps.');
   if(attempt!==sequence)return;
   const result={distance:route.distance,duration:route.duration,coordinates:route.geometry.coordinates,snap};
   cache.set(s.id,result);pending=null;showRoad(s,result);
  }catch(e){if(attempt===sequence){error=e.name==='AbortError'?'O cálculo demorou a responder. Tente novamente ou abra a rota no Maps.':e instanceof TypeError?'Sem conexão com o serviço de trajetos. Abra uma das opções do Maps para continuar.':e.message;}}
  finally{clearTimeout(timer);if(attempt===sequence){pending=null;controller=null;refreshTrip();}}
 }
 function updateMeasure(){
  measureLayer.clearLayers();let km=0;
  for(let i=1;i<points.length;i++)km+=tripDistanceKm(points[i-1],points[i]);
  if(points.length>1)L.polyline(points,{color:'#d35d38',weight:3,dashArray:'7 6',interactive:false}).addTo(measureLayer);
  points.forEach((point,i)=>L.circleMarker(point,{radius:5,color:'#fffdf4',weight:2,fillColor:'#d35d38',fillOpacity:1,interactive:false}).bindTooltip(String(i+1),{permanent:true,direction:'top',offset:[0,-5],className:'ruler-point-label'}).addTo(measureLayer));
  get('measureDistance').textContent=tripDistanceLabel(km);
  get('measureHelp').textContent=points.length===0?'Clique em dois ou mais lugares do mapa.':points.length===1?'Agora clique no destino. Você pode clicar em um pico.':`${points.length-1} trecho${points.length>2?'s':''} em linha reta · clique para acrescentar.`;
  get('measureUndo').disabled=!points.length;
 }
 function addPoint(point){if(!measuring)return;points.push({lat:point.lat,lng:point.lng});updateMeasure();}
 function startMeasure(){cancelRequest();clearRoute();onMeasureStart?.();measuring=true;points=[];panel.hidden=false;rulerButton.setAttribute('aria-pressed','true');get('map').classList.add('is-measuring');updateMeasure();}
 rulerButton.addEventListener('click',()=>measuring?stopMeasure():startMeasure());
 get('measureParis').addEventListener('click',()=>{points=[{...TRIP_PARIS}];updateMeasure();map.setView([46.9,1.5],6,{animate:false});});
 get('measureUndo').addEventListener('click',()=>{points.pop();updateMeasure();});
 get('measureClear').addEventListener('click',()=>{points=[];updateMeasure();});
 get('measureDone').addEventListener('click',stopMeasure);
 map.on('click',e=>addPoint(e.latlng));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&measuring){stopMeasure();e.preventDefault();e.stopImmediatePropagation();}});
 get('detailPanel').addEventListener('click',e=>{const mode=e.target.closest('[data-trip-mode]');if(mode&&['car','transit'].includes(mode.dataset.tripMode)){travelMode=mode.dataset.tripMode;cancelRequest();transit.cancel();clearRoute();transit.clearOverlay();error='';refreshTrip();return;}const draw=e.target.closest('[data-trip-draw]');if(draw&&selected&&draw.dataset.tripDraw===selected.id)drawRoad(selected);if(e.target.closest('[data-trip-clear]')){clearRoute();refreshTrip();}});
 return {isMeasuring:()=>measuring,addPoint,attachSpot,detachSpot,tripMarkup,parisDistance:s=>tripDistanceKm(TRIP_PARIS,s)};
}
