(function(){
  'use strict';
  const S=window.SahreejCore, q=S.q;
  const TILE_URL='https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';

  async function roadRoute(from,to){
    if(!from||!to) throw new Error('Missing route coordinates');
    const url=`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=false`;
    const r=await fetch(url,{cache:'no-store'});
    if(!r.ok) throw new Error('Routing service unavailable');
    const j=await r.json();
    if(j.code!=='Ok'||!j.routes?.length) throw new Error('No route found');
    return j.routes[0];
  }
  S.roadRoute=roadRoute;

  S.addBaseTiles=function(map){
    const primary=L.tileLayer(TILE_URL,{maxZoom:16,attribution:'Tiles &copy; Esri'}).addTo(map);
    let failures=0, switched=false;
    primary.on('tileerror',()=>{
      failures++;
      if(switched || failures<3) return;
      switched=true;
      try{ map.removeLayer(primary); }catch(e){}
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri'}).addTo(map);
    });
    return primary;
  };

  function tankerIcon(size=48){
    return L.divIcon({
      className:'sahreej-map-icon-wrap',
      html:`<div class="sahreej-tanker-map-icon"><img src="assets/tanker.svg" alt="Water tanker"></div>`,
      iconSize:[size,size],iconAnchor:[size/2,size/2]
    });
  }
  S.driverIcon=tankerIcon;
  S.tankerIcon=tankerIcon;

  function customerIcon(size=42){
    return L.divIcon({
      className:'sahreej-map-icon-wrap',
      html:'<div class="sahreej-customer-map-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.1 7-13a7 7 0 1 0-14 0c0 6.9 7 13 7 13z"/><circle cx="12" cy="9" r="2.6"/></svg></div>',
      iconSize:[size,size],iconAnchor:[size/2,size]
    });
  }
  S.customerIcon=customerIcon;

  function formatRoute(route){
    const km=route.distance/1000;
    const mins=Math.max(1,Math.ceil(route.duration/60));
    return {km,mins,text:`${mins} min · ${km.toFixed(1)} km`};
  }
  S.formatRoute=formatRoute;

  async function ensureMiniRouteMap(hostId,mapId,from,to){
    const host=q(hostId); if(!host||typeof L==='undefined') return null;
    let mapEl=q(mapId);
    if(!mapEl){
      mapEl=document.createElement('div'); mapEl.id=mapId; mapEl.className='route-map';
      host.appendChild(mapEl);
    }
    if(!S._miniMaps) S._miniMaps={};
    let map=S._miniMaps[mapId];
    if(!map){
      map=L.map(mapId,{zoomControl:false,attributionControl:true});
      S.addBaseTiles(map);
      S._miniMaps[mapId]=map;
    }
    const route=await roadRoute(from,to);
    if(map._sahreejRoute){try{map.removeLayer(map._sahreejRoute)}catch(_){} }
    if(map._sahreejDriver){try{map.removeLayer(map._sahreejDriver)}catch(_){} }
    if(map._sahreejDest){try{map.removeLayer(map._sahreejDest)}catch(_){} }
    const coords=route.geometry.coordinates.map(([lng,lat])=>[lat,lng]);
    map._sahreejRoute=L.polyline(coords,{weight:6,opacity:.88,className:'sahreej-route-line'}).addTo(map);
    map._sahreejDriver=L.marker([from.lat,from.lng],{icon:tankerIcon()}).addTo(map).bindTooltip('Water tanker');
    map._sahreejDest=L.marker([to.lat,to.lng],{icon:customerIcon()}).addTo(map).bindTooltip('Delivery point');
    map.fitBounds(map._sahreejRoute.getBounds(),{padding:[34,34]});
    setTimeout(()=>map.invalidateSize(),50);
    return route;
  }
  S.ensureMiniRouteMap=ensureMiniRouteMap;
})();
