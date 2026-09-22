(function(){
  'use strict';
  const S=window.SahreejCore, q=S.q;
  const bucket='driver-documents';
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const objectUrls=new Set();
  if(!q('deliveryVerificationStyles')){
    const s=document.createElement('style');s.id='deliveryVerificationStyles';
    s.textContent='.delivery-proof-card{margin:14px 0;padding:18px;border-radius:20px;background:#111;color:#fff;text-align:center;box-shadow:0 5px 18px #0002}.delivery-proof-card h3{margin:0 0 6px;font-size:18px}.delivery-proof-card p{margin:0;opacity:.78;font-size:13px;line-height:1.45}.delivery-pin{font-size:38px;font-weight:950;letter-spacing:9px;padding:10px 0 7px}';
    document.head.appendChild(s);
  }

  function ensureTrackingOpen(){
    if(q('tracking') && !q('tracking').classList.contains('active')){
      try{openScreen('tracking')}catch(_){ }
    }
  }

  function clearLegacyTrackingUi(){
    ['realCustomerCancelOrder','sahreejNoDriverState','serverNoDriverState','assignedDriverCard','driverInfoCard'].forEach(id=>q(id)?.remove());
  }

  function setTrackingSummary(order){
    if(q('trackSize')) q('trackSize').textContent=Number(order.tanker_capacity_l||0).toLocaleString()+' L';
    if(q('trackAddress')) q('trackAddress').textContent=order.delivery_address||'';
    if(q('trackPrice')) q('trackPrice').textContent='$'+Number(order.customer_price_usd||0).toFixed(2);
  }

  async function mediaUrl(path){
    if(!path) return null;
    try{
      // Authenticated download is more reliable on Safari than rendering a short-lived
      // signed URL from the private bucket. RLS still protects the file.
      const {data,error}=await window.sahreejSupabase.storage.from(bucket).download(path);
      if(error) throw error;
      if(!data) return null;
      const url=URL.createObjectURL(data);
      objectUrls.add(url);
      return url;
    }catch(downloadError){
      console.warn('driver media download',downloadError);
      try{
        const {data,error}=await window.sahreejSupabase.storage.from(bucket).createSignedUrl(path,600);
        if(error) throw error;
        return data?.signedUrl||null;
      }catch(signError){
        console.warn('driver media url',signError);
        return null;
      }
    }
  }

  async function getDriver(order){
    if(!order?.driver_id||!order?.id) return null;
    try{
      let result=await window.sahreejSupabase.rpc('get_my_assigned_driver_details_v2',{p_order_id:order.id});
      if(result.error){
        console.warn('assigned driver v2 lookup',result.error);
        result=await window.sahreejSupabase.rpc('get_my_assigned_driver_details',{p_order_id:order.id});
      }
      if(result.error) throw result.error;
      const row=Array.isArray(result.data)?result.data[0]:result.data;
      if(!row) return null;
      const [driverUrl,tankerUrl]=await Promise.all([mediaUrl(row.driver_photo_path),mediaUrl(row.tanker_photo_path)]);
      return {...row,driverUrl,tankerUrl};
    }catch(e){console.warn('assigned driver lookup',e);return null;}
  }

  async function getDeliveryPin(orderId){
    try{
      const {data,error}=await window.sahreejSupabase.rpc('get_my_delivery_pin',{p_order_id:orderId});
      if(error)throw error;
      const pin=String(data||'').trim();
      return /^\d{4}$/.test(pin)?pin:'';
    }catch(e){console.warn('delivery pin unavailable',e);return '';}
  }

  function deliveryPinCard(pin){
    return `<div class="delivery-proof-card" id="deliveryCustomerVerification"><h3>Your delivery PIN</h3><div class="delivery-pin">${esc(pin)}</div><p>Only give this PIN to the driver after your water has been delivered. Giving the correct PIN confirms the delivery.</p></div>`;
  }

  function terminalDoneButton(){
    let b=q('v86TrackingDone');
    if(!b){
      b=document.createElement('button');b.id='v86TrackingDone';b.className='primary';b.style.cssText='width:100%;margin-bottom:10px';b.textContent='Done';
      b.onclick=()=>{try{closeScreen('tracking')}catch(_){ } if(typeof showCustomerTab==='function') showCustomerTab('home')};
      q('trackingSheet')?.appendChild(b);
    }
    return b;
  }

  function driverCard(driver,order,step){
    if(!driver){
      return `<div class="trip-progress"><span class="on"></span><span class="${step>=2?'on':''}"></span><span class="${step>=3?'on':''}"></span><span></span></div><div class="card"><strong>Loading driver details…</strong><span class="muted">Driver information is syncing.</span></div>`;
    }
    const phone=String(driver.phone||'').replace(/[^0-9+]/g,'');
    const initials=(driver.full_name||'D').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
    return `<div class="trip-progress"><span class="on"></span><span class="${step>=2?'on':''}"></span><span class="${step>=3?'on':''}"></span><span></span></div>
      <div class="driver-public-card">
        ${driver.tankerUrl?`<div class="driver-public-tanker"><img src="${esc(driver.tankerUrl)}" alt="Registered water tanker"></div>`:''}
        <div class="driver-public-body">
          <div class="driver-public-head">
            <div class="driver-public-avatar">${driver.driverUrl?`<img src="${esc(driver.driverUrl)}" alt="${esc(driver.full_name||'Driver')}">`:esc(initials)}</div>
            <div class="driver-public-copy"><strong>${esc(driver.full_name||'Driver')}</strong><span>Plate ${esc(driver.vehicle_plate||'—')}</span></div>
            <div class="driver-public-capacity">${Number(driver.tanker_capacity_l||order.tanker_capacity_l||0).toLocaleString()} L</div>
          </div>
          <div class="driver-public-actions">${phone?`<a href="tel:${esc(phone)}">Call driver</a>`:'<button disabled>Call unavailable</button>'}<button onclick="sahreejCreateSupportCase('customer',window.sahreejActiveServerOrderId||localStorage.getItem('sahreejActiveServerOrderId'))">Get help</button></div>
        </div>
      </div>`;
  }

  let lastCustomerRenderKey='';
  let lastTerminalToastId='';
  let driverDetailsReadyForOrder='';

  async function renderCustomerState(order){
    if(!order) return;
    clearLegacyTrackingUi();q('sahreejCleanTrackingCard')?.remove();ensureTrackingOpen();setTrackingSummary(order);

    const renderKey=[order.id,order.status,order.driver_id,order.tanker_capacity_l,order.delivery_address,order.customer_price_usd].join('|');
    const activeDriverState=['assigned','driver_arrived','delivering'].includes(order.status);
    if(lastCustomerRenderKey===renderKey && (!activeDriverState || driverDetailsReadyForOrder===order.id)) return;

    localStorage.setItem('sahreejActiveServerOrderId',order.id);window.sahreejActiveServerOrderId=order.id;
    const badge=q('trackStatus'),title=q('trackTitle'),sub=q('trackSub'),host=q('realAssignedDriverHost'),cancel=q('cancelCustomerOrderBtn');
    q('v86TrackingDone')?.remove();

    if(order.status==='requested'||order.status==='searching'){
      lastCustomerRenderKey=renderKey;driverDetailsReadyForOrder='';
      if(badge)badge.textContent='SEARCHING';if(title)title.textContent='Searching for a driver…';if(sub)sub.textContent='We’re looking for the nearest approved Sahreej driver.';if(host)host.innerHTML='';if(cancel)cancel.style.display='';return;
    }

    if(activeDriverState){
      const driver=await getDriver(order);
      if(badge)badge.textContent=String(order.status).replaceAll('_',' ').toUpperCase();
      if(title)title.textContent=order.status==='assigned'?'Driver is on the way':order.status==='driver_arrived'?'Your tanker has arrived':'Water delivery in progress';
      if(sub)sub.textContent=order.status==='assigned'?`${driver?.full_name||'Your driver'} accepted your request.`:order.status==='driver_arrived'?'Your driver has arrived at the delivery location.':'Your water is being delivered now.';
      if(host){
        const step=order.status==='assigned'?1:order.status==='driver_arrived'?2:3;
        let html=driverCard(driver,order,step);
        if(order.status==='delivering'){
          const pin=await getDeliveryPin(order.id);
          if(pin)html=deliveryPinCard(pin)+html;
        }
        host.innerHTML=html;
      }
      if(cancel)cancel.style.display=['assigned','driver_arrived'].includes(order.status)?'':'none';
      S.polishTracking?.(order);
      S.updateCustomerLiveRoute?.(order,true).catch(e=>console.warn('route render',e));
      lastCustomerRenderKey=renderKey;
      if(driver?.full_name && driver?.vehicle_plate && driver?.driverUrl && driver?.tankerUrl) driverDetailsReadyForOrder=order.id;
      return;
    }

    lastCustomerRenderKey=renderKey;driverDetailsReadyForOrder='';
    if(order.status==='delivered'){
      if(badge)badge.textContent='DELIVERED';if(title)title.textContent='Delivery completed';if(sub)sub.textContent='Your water delivery has been completed.';if(cancel)cancel.style.display='none';const eta=q('liveEta');if(eta)eta.style.display='none';
      const driver=await getDriver(order);if(host)host.innerHTML=driver?.full_name?`<div class="card" style="margin:14px 0"><strong>${esc(driver.full_name)}</strong><span class="muted">Delivery completed</span></div>`:'';
      localStorage.removeItem('sahreejActiveServerOrderId');localStorage.removeItem('sahreejActiveOrder');window.sahreejActiveServerOrderId=null;terminalDoneButton();
      if(typeof toast==='function'&&lastTerminalToastId!==order.id){toast('Delivery completed');lastTerminalToastId=order.id;}S.refreshCustomerActivity?.();return;
    }

    if(order.status==='cancelled_admin' && order.dispatch_failure_reason==='no_driver_available'){
      if(badge)badge.textContent='NO DRIVER AVAILABLE';
      if(title)title.textContent='No driver available right now';
      if(sub)sub.textContent='We could not find an available tanker nearby. You can search again.';
      if(host)host.innerHTML='<div class="card" style="margin:14px 0"><strong>No available driver found</strong><span class="muted">Try searching again. Sahreej will check the nearest approved drivers.</span><button class="primary" style="margin-top:12px" onclick="sahreejRetryDispatch()">Search again</button></div>';
      if(cancel)cancel.style.display='none';
      const eta=q('liveEta');if(eta)eta.style.display='none';
      localStorage.setItem('sahreejActiveServerOrderId',order.id);window.sahreejActiveServerOrderId=order.id;
      S.refreshCustomerActivity?.();
      return;
    }

    if(String(order.status).startsWith('cancelled')){
      if(badge)badge.textContent='CANCELLED';if(title)title.textContent='Order cancelled';if(sub)sub.textContent='This order is no longer active.';if(host)host.innerHTML='';if(cancel)cancel.style.display='none';const eta=q('liveEta');if(eta)eta.style.display='none';
      localStorage.removeItem('sahreejActiveServerOrderId');localStorage.removeItem('sahreejActiveOrder');window.sahreejActiveServerOrderId=null;terminalDoneButton();S.refreshCustomerActivity?.();
    }
  }
  S.renderCustomerState=renderCustomerState;

  async function pollTick(id){let o=await S.fetchOrder(id).catch(()=>null);if(!o)o=await S.fetchMyCustomerActive().catch(()=>null);if(!o)return;await renderCustomerState(o);if(S.TERMINAL.includes(o.status))clearInterval(window.v8CustomerPoll);}
  S.startCustomerPoll=function(id){clearInterval(window.v8CustomerPoll);pollTick(id).catch(e=>console.warn('Customer poll initial',e));window.v8CustomerPoll=setInterval(()=>pollTick(id).catch(e=>console.warn('Customer poll',e)),1000);};
})();

(function(){
  'use strict';
  const S=window.SahreejCore,q=S.q;
  let routeMap=null,routeLayer=null,driverMarker=null,destMarker=null,lastRouteAt=0,lastPos=null,baseLayer=null;

  function customerPoint(order){const lat=Number(order?.delivery_latitude),lng=Number(order?.delivery_longitude);return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;}

  function resizeMap(){if(!routeMap)return;[0,100,300,700].forEach(ms=>setTimeout(()=>{try{routeMap.invalidateSize(true);}catch(_){}},ms));}

  function ensureMap(dest){
    const el=q('trackMap');if(!el||typeof L==='undefined')return null;
    el.style.display='block';el.style.position='absolute';el.style.inset='0';el.style.width='100%';el.style.height='100%';el.style.zIndex='2';
    if(!routeMap){
      routeMap=L.map(el,{zoomControl:false,attributionControl:false,preferCanvas:true});
      baseLayer=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,crossOrigin:true}).addTo(routeMap);
      routeMap.setView([dest.lat,dest.lng],16,{animate:false});
    }
    if(!destMarker)destMarker=L.marker([dest.lat,dest.lng],{icon:S.customerIcon?S.customerIcon():undefined}).addTo(routeMap);else destMarker.setLatLng([dest.lat,dest.lng]);
    resizeMap();return routeMap;
  }

  async function activeDriverLocation(){
    try{const {data,error}=await window.sahreejSupabase.rpc('get_my_active_driver_location');if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(!row||row.latitude==null||row.longitude==null)return null;return{lat:Number(row.latitude),lng:Number(row.longitude),updated_at:row.updated_at};}
    catch(e){console.warn('live driver location',e);return null;}
  }

  async function updateLiveRoute(order,force=false){
    if(!order||!['assigned','driver_arrived','delivering'].includes(order.status))return;
    const dest=customerPoint(order);if(!dest)return;
    const map=ensureMap(dest);if(!map)return;
    const pos=await activeDriverLocation();
    if(!pos){map.setView([dest.lat,dest.lng],16,{animate:false});resizeMap();return;}
    if(!driverMarker)driverMarker=L.marker([pos.lat,pos.lng],{icon:S.driverIcon?S.driverIcon():undefined}).addTo(map);else driverMarker.setLatLng([pos.lat,pos.lng]);
    const moved=!lastPos||Math.hypot(pos.lat-lastPos.lat,pos.lng-lastPos.lng)>0.00012;const due=Date.now()-lastRouteAt>8000;
    if(force||moved||due){
      lastPos=pos;lastRouteAt=Date.now();
      try{
        const route=await S.roadRoute({lat:pos.lat,lng:pos.lng},dest);
        if(routeLayer){try{map.removeLayer(routeLayer)}catch(_){}}
        const coords=route.geometry.coordinates.map(([lng,lat])=>[lat,lng]);
        routeLayer=L.polyline(coords,{weight:6,opacity:.9}).addTo(map);
        const f=S.formatRoute(route);const eta=q('liveEta');if(eta){eta.style.display='';eta.textContent=`${f.mins} min · ${f.km.toFixed(1)} km`;}
        const bounds=routeLayer.getBounds();if(bounds?.isValid?.())map.fitBounds(bounds,{paddingTopLeft:[40,90],paddingBottomRight:[40,300],maxZoom:17,animate:false});
      }catch(e){console.warn('live route draw',e);map.fitBounds([[pos.lat,pos.lng],[dest.lat,dest.lng]],{paddingTopLeft:[40,90],paddingBottomRight:[40,300],maxZoom:17,animate:false});}
      resizeMap();
    }
  }

  S.updateCustomerLiveRoute=updateLiveRoute;

  clearInterval(window.v88CustomerRouteTimer);
  window.v88CustomerRouteTimer=setInterval(async()=>{const id=window.sahreejActiveServerOrderId||localStorage.getItem('sahreejActiveServerOrderId');if(!id)return;const order=await S.fetchOrder(id).catch(()=>null);if(order)updateLiveRoute(order,false).catch(()=>{});},3000);
})();
