(function(){
  'use strict';

  const S=window.SahreejCore=window.SahreejCore||{};
  const $=id=>document.getElementById(id);
  const DRAFT_KEY='sahreejOrderDraftV819';
  const MAX_NEARBY_KM=40;
  const tankerAsset='assets/tanker.svg';
  let availabilityRequest=0;
  let pickerMap=null;

  function normalizeCoords(c){
    if(!c) return null;
    let lat,lng;
    if(Array.isArray(c)){lat=Number(c[0]);lng=Number(c[1]);}
    else {lat=Number(c.lat??c.latitude??c[0]);lng=Number(c.lng??c.lon??c.longitude??c[1]);}
    return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;
  }
  S.normalizeDeliveryCoords=normalizeCoords;

  function readDraft(){
    try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')||{};}catch(_){return {};}
  }
  function writeDraft(patch){
    const current=readDraft();
    const next={...current,...patch,updatedAt:Date.now()};
    localStorage.setItem(DRAFT_KEY,JSON.stringify(next));
    return next;
  }
  function canonical(){
    const d=readDraft();
    const coords=normalizeCoords(window.sahreejDeliveryCoords)||normalizeCoords(d.coords);
    const address=String(window.deliveryAddress||window.address||d.address||'').trim();
    const capacity=Number(window.selectedTankerCapacity||window.selectedCapacity||d.capacity||0)||null;
    const price=Number(window.chosen?.price??d.price??0)||null;
    return {coords,address,capacity,price};
  }
  S.getOrderDraft=canonical;

  function setCanonicalLocation(coords,address){
    const c=normalizeCoords(coords);
    if(!c) return null;
    const label=String(address||'').trim()||`Pinned location · ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
    window.sahreejDeliveryCoords={lat:c.lat,lng:c.lng};
    window.deliveryAddress=label;
    window.address=label;
    try{address=label}catch(_){ }
    writeDraft({coords:c,address:label});
    const homeAddress=$('homeAddress'); if(homeAddress) homeAddress.textContent=label;
    const selectAddress=$('selectAddress'); if(selectAddress) selectAddress.textContent=label;
    const confirm=$('cAddress'); if(confirm) confirm.textContent=label;
    return {coords:c,address:label};
  }
  S.setCanonicalLocation=setCanonicalLocation;

  function hydrateDraft(){
    const d=readDraft();
    if(d.coords){
      const c=normalizeCoords(d.coords);
      if(c){
        window.sahreejDeliveryCoords=c;
        if(d.address){window.deliveryAddress=d.address;window.address=d.address;}
        const homeAddress=$('homeAddress'); if(homeAddress&&d.address) homeAddress.textContent=d.address;
      }
    }
    if(d.capacity){window.selectedTankerCapacity=Number(d.capacity);window.selectedCapacity=Number(d.capacity);}
  }

  async function reverseGeocode(lat,lng){
    if(typeof window.sahreejReverseGeocode==='function'){
      try{return await window.sahreejReverseGeocode(lat,lng);}catch(_){ }
    }
    return `Pinned location · ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  function ensurePointOnMap(mapId,coords,zoom=16){
    const c=normalizeCoords(coords); if(!c||typeof L==='undefined') return null;
    const map=(window.maps&&window.maps[mapId]) || (typeof window.mapBase==='function'?window.mapBase(mapId,[c.lat,c.lng],zoom):null);
    if(!map) return null;
    map.setView([c.lat,c.lng],zoom,{animate:false});
    if(!S._locationMarkers) S._locationMarkers={};
    if(S._locationMarkers[mapId]){try{map.removeLayer(S._locationMarkers[mapId]);}catch(_){}}
    S._locationMarkers[mapId]=L.circleMarker([c.lat,c.lng],{radius:8,weight:4,color:'#fff',fillColor:'#111',fillOpacity:1}).addTo(map);
    setTimeout(()=>{try{map.invalidateSize();map.setView([c.lat,c.lng],zoom,{animate:false});}catch(_){}},80);
    return map;
  }

  // One authoritative location setter. Search, GPS and map pin all end here.
  window.setLocation=function(label){
    const c=normalizeCoords(window.sahreejDeliveryCoords);
    if(!c){ if(typeof toast==='function') toast('Choose a delivery location first'); return; }
    setCanonicalLocation(c,label);
    try{closeScreen('locationScreen')}catch(_){ }
    window.openSelector();
  };

  window.useGPS=function(homeOnly){
    if(!navigator.geolocation){if(typeof toast==='function') toast('Location is not available on this device');return;}
    if(typeof toast==='function') toast('Finding your location…');
    navigator.geolocation.getCurrentPosition(async p=>{
      const c={lat:Number(p.coords.latitude),lng:Number(p.coords.longitude)};
      const fallback=`Pinned location · ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
      setCanonicalLocation(c,fallback);
      ensurePointOnMap('homeMap',c,16);
      const label=await reverseGeocode(c.lat,c.lng);
      setCanonicalLocation(c,label);
      if(homeOnly){
        ensurePointOnMap('homeMap',c,16);
        if(typeof toast==='function') toast('Location updated');
        return;
      }
      try{closeScreen('locationScreen')}catch(_){ }
      window.openSelector();
    },err=>{
      if(typeof toast==='function') toast(err&&err.code===1?'Location permission was denied':'Could not get your current location');
    },{enableHighAccuracy:true,timeout:15000,maximumAge:10000});
  };
  try{useGPS=window.useGPS}catch(_){ }

  window.openMapPicker=function(){
    try{closeScreen('locationScreen')}catch(_){ }
    openScreen('mapPicker');
    setTimeout(()=>{
      const c=canonical().coords||normalizeCoords(window.Beirut)||{lat:33.8938,lng:35.5018};
      pickerMap=typeof window.mapBase==='function'?window.mapBase('pickMap',[c.lat,c.lng],16):null;
      if(pickerMap){
        pickerMap.setView([c.lat,c.lng],16,{animate:false});
        setTimeout(()=>{try{pickerMap.invalidateSize();}catch(_){ }},50);
      }
    },80);
  };
  try{openMapPicker=window.openMapPicker}catch(_){ }

  window.confirmMapLocation=async function(){
    // legacy-ui keeps its Leaflet map registry in a top-level `let maps`,
    // which is intentionally not a window property. Reuse the map instance
    // returned by mapBase instead of looking for window.maps.pickMap.
    const fallback=canonical().coords||normalizeCoords(window.Beirut)||{lat:33.8938,lng:35.5018};
    const map=pickerMap || (typeof window.mapBase==='function'
      ? window.mapBase('pickMap',[fallback.lat,fallback.lng],16)
      : null);
    if(map) pickerMap=map;
    const center=map?.getCenter?.();
    if(!center){if(typeof toast==='function') toast('Map is still loading. Try again.');return;}
    const c={lat:Number(center.lat),lng:Number(center.lng)};
    const btn=document.querySelector('#mapPicker .map-confirm .primary');
    const old=btn?.textContent;
    if(btn){btn.disabled=true;btn.textContent='Finding address…';}
    const label=await reverseGeocode(c.lat,c.lng);
    setCanonicalLocation(c,label);
    if(btn){btn.disabled=false;btn.textContent=old||'Confirm this location';}
    try{closeScreen('mapPicker')}catch(_){ }
    window.openSelector();
  };
  try{confirmMapLocation=window.confirmMapLocation}catch(_){ }

  async function activePricing(){
    if(typeof S.loadActivePricing==='function') return await S.loadActivePricing(true);
    const {data,error}=await window.sahreejSupabase.rpc('get_active_pricing');
    if(error) throw error;
    return (data||[]).filter(r=>r.active!==false);
  }

  async function nearestDrivers(coords){
    const c=normalizeCoords(coords); if(!c) return [];
    const {data,error}=await window.sahreejSupabase.rpc('get_nearby_driver_availability',{
      p_latitude:c.lat,
      p_longitude:c.lng,
      p_max_distance_km:MAX_NEARBY_KM
    });
    if(error) throw error;
    return Array.isArray(data)?data:[];
  }

  async function routeAvailability(driver,customer){
    const from={lat:Number(driver.driver_latitude),lng:Number(driver.driver_longitude)};
    if(!Number.isFinite(from.lat)||!Number.isFinite(from.lng)){
      const d=Number(driver.straight_line_distance_km);
      return {...driver,route:null,availability_text:Number.isFinite(d)?`Driver about ${d.toFixed(1)} km away`:'Driver nearby'};
    }
    try{
      const route=await S.roadRoute(from,customer);
      const f=S.formatRoute(route);
      return {...driver,route,road_km:f.km,eta_minutes:f.mins,availability_text:`${f.mins} min · ${f.km.toFixed(1)} km away`};
    }catch(_){
      const d=Number(driver.straight_line_distance_km);
      return {...driver,route:null,availability_text:Number.isFinite(d)?`Driver ${d.toFixed(1)} km away · ETA unavailable`:'Driver nearby · ETA unavailable'};
    }
  }

  function money(v){return '$'+Number(v||0).toFixed(2);}

  async function renderRealTankerAvailability(){
    const req=++availabilityRequest;
    const mount=$('tankerOptions');
    const choose=$('chooseBtn');
    const draft=canonical();
    if(!mount||!draft.coords) return false;
    mount.innerHTML='<div class="pricing-loading"><span class="spinner"></span><strong>Checking nearby drivers…</strong></div>';
    if(choose){choose.disabled=true;choose.textContent='Checking nearby drivers…';}

    try{
      const [pricing,nearby]=await Promise.all([activePricing(),nearestDrivers(draft.coords)]);
      if(req!==availabilityRequest) return false;
      const nearestByCapacity=new Map((nearby||[]).map(r=>[Number(r.tanker_capacity_l),r]));
      const routed=await Promise.all((pricing||[]).map(async p=>{
        const cap=Number(p.tanker_capacity_l);
        const driver=nearestByCapacity.get(cap);
        return {pricing:p,availability:driver?await routeAvailability(driver,draft.coords):null};
      }));
      if(req!==availabilityRequest) return false;
      mount.innerHTML='';

      let firstAvailable=null;
      routed.forEach(({pricing:p,availability:a})=>{
        const cap=Number(p.tanker_capacity_l), price=Number(p.customer_price_usd);
        const el=document.createElement('button');
        el.type='button';
        const available=!!a;
        el.className='tanker'+(available?'':' tanker-unavailable');
        el.disabled=!available;
        el.setAttribute('aria-label',`${cap.toLocaleString()} litre tanker, ${available?(a.availability_text||'driver nearby'):'no nearby drivers'}, ${money(price)} total`);
        el.dataset.capacity=String(cap);
        el.dataset.size=cap.toLocaleString()+' L';
        el.dataset.price=String(price);
        el.dataset.available=available?'1':'0';
        el.dataset.eta=available&&a.eta_minutes?String(a.eta_minutes):'';
        if(available&&a.road_km) el.dataset.roadKm=String(a.road_km||'');
        const status=available?(a.availability_text||'Driver nearby'):'No nearby drivers';
        el.innerHTML=`<div class="art"><img class="tanker-brand-icon" src="${tankerAsset}" alt="Water tanker"></div><div><strong>${cap.toLocaleString()} L</strong><span class="muted">${status}</span></div><div class="price">${money(price)}<small>total</small></div>`;
        if(available)el.onclick=()=>window.pickTanker(el);
        mount.appendChild(el);
        if(available&&!firstAvailable) firstAvailable=el;
      });

      if(firstAvailable){
        window.pickTanker(firstAvailable);
      }else{
        window.selectedTankerCapacity=null;window.selectedCapacity=null;
        if(choose){choose.disabled=true;choose.textContent='No nearby drivers';}
      }
      return true;
    }catch(e){
      console.error('Driver availability check failed',e);
      mount.innerHTML=`<div class="pricing-empty"><div><strong>Could not check nearby drivers</strong><div class="muted">${String(e.message||'Try again shortly')}</div></div></div>`;
      if(choose){choose.disabled=true;choose.textContent='Try again';choose.onclick=()=>renderRealTankerAvailability();}
      return false;
    }
  }
  S.renderRealTankerAvailability=renderRealTankerAvailability;

  window.pickTanker=function(el){
    if(!el||el.dataset.available!=='1'){
      if(typeof toast==='function') toast('No nearby driver for this tanker size');
      return;
    }
    document.querySelectorAll('#tankerOptions .tanker').forEach(x=>x.classList.remove('selected'));
    el.classList.add('selected');
    const cap=Number(el.dataset.capacity),price=Number(el.dataset.price);
    window.selectedTankerCapacity=cap;window.selectedCapacity=cap;
    window.chosen={size:cap.toLocaleString()+' L',price,eta:el.dataset.eta||''};
    writeDraft({capacity:cap,price});
    const choose=$('chooseBtn');
    if(choose){choose.disabled=false;choose.textContent=`Choose ${cap.toLocaleString()} L · ${money(price)}`;choose.onclick=()=>window.openConfirm();}
  };
  try{pickTanker=window.pickTanker}catch(_){ }

  window.openSelector=function(){
    const d=canonical();
    if(!d.coords){openLocation();return;}
    const label=d.address||`Pinned location · ${d.coords.lat.toFixed(5)}, ${d.coords.lng.toFixed(5)}`;
    setCanonicalLocation(d.coords,label);
    openScreen('selector');
    setTimeout(()=>{
      ensurePointOnMap('selectMap',d.coords,16);
      renderRealTankerAvailability();
    },90);
  };
  try{openSelector=window.openSelector}catch(_){ }

  function customerSignedIn(){return localStorage.getItem('sahreejCustomerSignedIn')==='1';}

  window.openConfirm=function(){
    const d=canonical();
    const selected=document.querySelector('#tankerOptions .tanker.selected');
    if(!d.coords){if(typeof toast==='function')toast('Set your delivery location first');openLocation();return;}
    if(!selected||selected.dataset.available!=='1'){if(typeof toast==='function')toast('Choose a tanker with a nearby driver');return;}
    const cap=Number(selected.dataset.capacity),price=Number(selected.dataset.price);
    writeDraft({coords:d.coords,address:d.address,capacity:cap,price});
    window.selectedTankerCapacity=cap;window.selectedCapacity=cap;
    window.chosen={size:cap.toLocaleString()+' L',price,eta:selected.dataset.eta||''};
    $('cSize').textContent=cap.toLocaleString()+' L';
    $('cPrice').textContent=money(price);
    $('cAddress').textContent=d.address||`Pinned location · ${d.coords.lat.toFixed(5)}, ${d.coords.lng.toFixed(5)}`;
    const notice=$('orderAuthNotice'); if(notice) notice.style.display=customerSignedIn()?'none':'block';
    const btn=$('requestBtn'); if(btn) btn.textContent=customerSignedIn()?`Request tanker · ${money(price)}`:'Sign in to request';
    try{closeScreen('selector')}catch(_){ }
    openScreen('confirm');
  };
  try{openConfirm=window.openConfirm}catch(_){ }

  function openCustomerSigninPreservingDraft(){
    const d=canonical();
    writeDraft(d);
    localStorage.setItem('sahreejPostAuthAction','continueOrderV819');
    if(typeof setAuthRole==='function') setAuthRole('customer');
    if(typeof setCustomerAuthMode==='function') setCustomerAuthMode(localStorage.getItem('sahreejCustomerRegistered')==='1'?'signin':'signup');
    openScreen('auth');
    if(typeof toast==='function') toast('Sign in to request your tanker');
  }

  const previousAuth=window.sendDemoOtp;
  if(typeof previousAuth==='function'){
    window.sendDemoOtp=async function(){
      const result=await previousAuth.apply(this,arguments);
      if(result && localStorage.getItem('sahreejPostAuthAction')==='continueOrderV819'){
        localStorage.removeItem('sahreejPostAuthAction');
        hydrateDraft();
        setTimeout(()=>{
          try{closeScreen('auth')}catch(_){ }
          window.openConfirm();
        },80);
      }
      return result;
    };
    try{sendDemoOtp=window.sendDemoOtp}catch(_){ }
  }

  window.requestTanker=async function(){
    const d=canonical();
    if(!d.coords){if(typeof toast==='function')toast('Set your delivery location first');openLocation();return null;}
    if(!d.capacity){if(typeof toast==='function')toast('Choose a tanker size');window.openSelector();return null;}
    if(!customerSignedIn()){openCustomerSigninPreservingDraft();return null;}

    const btn=$('requestBtn');
    const old=btn?.textContent;
    if(btn){btn.disabled=true;btn.textContent='Checking driver…';}
    try{
      // Re-check availability immediately before creating the order so the confirmation
      // cannot rely on an old/static ETA.
      const nearby=await nearestDrivers(d.coords);
      const candidate=(nearby||[]).find(r=>Number(r.tanker_capacity_l)===Number(d.capacity));
      if(!candidate) throw new Error('No nearby driver is available for this tanker size now');

      const session=await S.requireSession();
      if(!session?.user?.id) throw new Error('Please sign in again');
      const existing=await S.fetchMyCustomerActive().catch(()=>null);
      if(existing){
        localStorage.setItem('sahreejActiveServerOrderId',existing.id);
        await S.renderCustomerState?.(existing);
        S.startCustomerPoll?.(existing.id);
        try{closeScreen('confirm')}catch(_){ }
        if(typeof toast==='function') toast('Opening your active order');
        return existing.id;
      }

      if(btn) btn.textContent='Requesting…';
      const payment=(typeof getPayment==='function'?getPayment().label:'Cash on delivery');
      const {data,error}=await window.sahreejSupabase.rpc('create_dispatch_order',{
        p_tanker_capacity_l:Number(d.capacity),
        p_payment_method:payment,
        p_delivery_address:d.address||`Pinned location · ${d.coords.lat.toFixed(5)}, ${d.coords.lng.toFixed(5)}`,
        p_delivery_latitude:d.coords.lat,
        p_delivery_longitude:d.coords.lng
      });
      if(error) throw error;
      const orderId=typeof data==='string'?data:(data?.order_id||data?.id||data);
      if(!orderId) throw new Error('Order was not created');
      const order=await S.fetchOrder(orderId);
      localStorage.setItem('sahreejActiveServerOrderId',orderId);
      localStorage.removeItem('sahreejActiveOrder');
      localStorage.removeItem(DRAFT_KEY);
      window.sahreejActiveServerOrderId=orderId;
      try{closeScreen('confirm')}catch(_){ }
      if(order) await S.renderCustomerState?.(order);
      S.startCustomerPoll?.(orderId);
      if(typeof toast==='function') toast('Order placed · Searching for a driver');
      return orderId;
    }catch(e){
      console.error('Order request failed',e);
      if(typeof toast==='function') toast(e.message||'Could not place order');
      return null;
    }finally{
      if(btn){btn.disabled=false;btn.textContent=customerSignedIn()?`Request tanker · ${money(d.price)}`:'Sign in to request';}
    }
  };
  try{requestTanker=window.requestTanker}catch(_){ }

  // Restore location/tanker draft after reload or auth-screen navigation.
  window.addEventListener('load',()=>{
    hydrateDraft();
    setTimeout(()=>{
      const d=canonical();
      if(d.coords){ensurePointOnMap('homeMap',d.coords,16);}
    },1400);
  });

})();
