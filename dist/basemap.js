'use strict';
function installBasemap(map, spots) {
 const button=document.getElementById('basemapBtn');
 const status=document.getElementById('mapStatus');
 map.createPane('atlasLand');map.getPane('atlasLand').style.zIndex='190';
 map.createPane('atlasLabels');map.getPane('atlasLabels').style.zIndex='195';
 map.getPane('atlasLand').style.pointerEvents='none';map.getPane('atlasLabels').style.pointerEvents='none';
 const renderer=L.canvas({pane:'atlasLand',padding:.4});
 L.geoJSON(BASEMAP_GEOGRAPHY,{pane:'atlasLand',renderer,interactive:false,style:f=>({color:'#99b0a4',weight:.8,fillColor:f.properties.code==='FRA'?'#f3f0e1':'#e8ece2',fillOpacity:1,opacity:.9})}).addTo(map);
 map.attributionControl.addAttribution('<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>');
 const countryLabels=L.layerGroup();
 for(const f of BASEMAP_GEOGRAPHY.features){const p=f.properties;if(p.x< -20||p.x>32||p.y<30||p.y>62)continue;L.marker([p.y,p.x],{pane:'atlasLabels',interactive:false,keyboard:false,icon:L.divIcon({className:'base-country-label',html:p.name,iconSize:[120,20],iconAnchor:[60,10]})}).addTo(countryLabels);}
 const cityLabels=L.layerGroup();
 const cities=[...new Map(spots.map(s=>[s.city,{name:s.city,lat:s.lat,lng:s.lng}])).values()];
 function updateLabels(){
  if(map.getZoom()<8.5){if(!map.hasLayer(countryLabels))countryLabels.addTo(map);map.removeLayer(cityLabels);return;}
  map.removeLayer(countryLabels);cityLabels.clearLayers();const placed=[];
  for(const c of cities){if(!map.getBounds().pad(.05).contains([c.lat,c.lng]))continue;const pixel=map.latLngToContainerPoint([c.lat,c.lng]);if(placed.some(p=>Math.abs(pixel.x-p.x)<95&&Math.abs(pixel.y-p.y)<25))continue;placed.push(pixel);L.marker([c.lat,c.lng],{pane:'atlasLabels',interactive:false,keyboard:false,icon:L.divIcon({className:'base-city-label',html:c.name,iconSize:[150,22],iconAnchor:[-12,2]})}).addTo(cityLabels);}
  if(!map.hasLayer(cityLabels))cityLabels.addTo(map);
 }
 map.on('moveend zoomend',updateLabels);updateLabels();
 let layer=null,gl=null,timeout=null,mode='essential',pending=false,errors=0,generation=0;
 let preference=location.protocol==='file:'?'essential':'detailed';try{preference=localStorage.getItem('mare-basemap-mode')||preference;}catch{}
 const attribution='<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · © <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
 function updateButton(){button.textContent=pending?'◌ Carregando detalhes…':mode==='detailed'?'▧ Mapa detalhado':'▧ Mapa essencial';button.setAttribute('aria-label',pending?'Carregando mapa detalhado. Usar mapa essencial':mode==='detailed'?'Mapa detalhado. Usar mapa essencial':'Mapa essencial. Carregar mapa detalhado');button.title=mode==='essential'?'Mapa local de orientação, com litoral aproximado. Clique para carregar ruas e mais detalhes.':'Clique para usar o mapa local, sem depender do provedor externo.';button.dataset.mode=mode;}
 function essential(reason=''){
  generation++;clearTimeout(timeout);pending=false;mode='essential';
  if(layer){try{map.removeLayer(layer);}catch{}layer=null;gl=null;}
  map.attributionControl.removeAttribution(attribution);
  status.textContent=reason;status.hidden=!reason;updateButton();
 }
 function detailed(){
  if(pending||mode==='detailed')return;
  pending=true;errors=0;status.hidden=true;updateButton();const attempt=++generation;
  try{
   if(!window.maplibregl||!window.MaplibreGLLeaflet)throw new Error('Detalhes indisponíveis');
   layer=MaplibreGLLeaflet.maplibreGL({style:BASEMAP_STYLE,interactive:false,attributionControl:{customAttribution:attribution},maxZoom:18}).addTo(map);
   gl=layer.getMaplibreMap();
   gl.once('load',()=>{if(attempt!==generation)return;clearTimeout(timeout);pending=false;mode='detailed';status.hidden=true;updateButton();});
   gl.on('error',event=>{if(attempt!==generation)return;const error=event.error||{};errors++;if(error.status===401||error.status===403||errors>=3)essential('Mapa essencial ativo. Os detalhes externos não carregaram; litoral aproximado, picos e filtros continuam disponíveis.');});
   timeout=setTimeout(()=>{if(attempt===generation&&pending)essential('Mapa essencial ativo. Os detalhes externos demoraram a responder; você pode tentar novamente pelo botão do mapa.');},15000);
  }catch{essential('Mapa essencial ativo: litoral aproximado e todos os picos disponíveis.');}
 }
 button.addEventListener('click',()=>{const next=pending||mode==='detailed'?'essential':'detailed';try{localStorage.setItem('mare-basemap-mode',next);}catch{}next==='essential'?essential():detailed();});
 updateButton();if(preference!=='essential')detailed();
 return {essential,detailed};
}
