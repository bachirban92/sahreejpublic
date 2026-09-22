(function(){
  'use strict';
  const S=window.SahreejCore, q=S.q;
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function setOnlyDriverPage(id){
    ['driverDashboard','driverActivityPage','driverEarningsPage','driverAccountPage'].forEach(pid=>{const el=q(pid);if(!el)return;const active=pid===id;el.classList.toggle('active',active);el.style.display=active?'block':'none';});
    if(q('driverNav')) q('driverNav').style.display='';
  }
  S.setOnlyDriverPage=setOnlyDriverPage;

  function moveApplicationPanel(){const panel=q('driverApplicationReviewPanel'),account=q('driverAccountPage');if(panel&&account&&panel.parentElement!==account){account.appendChild(panel);panel.style.margin='12px 0';panel.style.display='block';}}
  S.moveApplicationPanel=moveApplicationPanel;

  window.showDriverPage=function(id){const valid=['driverDashboard','driverActivityPage','driverEarningsPage','driverAccountPage'];const target=valid.includes(id)?id:'driverDashboard';setOnlyDriverPage(target);const page=q(target);if(page){try{page.scrollTop=0;page.scrollLeft=0}catch(_){}}try{window.scrollTo(0,0)}catch(_){}if(target==='driverAccountPage')moveApplicationPanel();if(target==='driverDashboard')setTimeout(()=>S.restoreDriverState?.(),50);if(target==='driverActivityPage'||target==='driverEarningsPage')setTimeout(()=>S.refreshDriverMetrics?.(),20);};

  async function refreshDriverAvailability(){
    try{
      const session=await S.requireSession();
      const {data:profile,error:pErr}=await window.sahreejSupabase.from('driver_profiles').select('full_name,status,tanker_capacity_l,vehicle_plate').eq('user_id',session.user.id).maybeSingle();if(pErr)throw pErr;
      const {data:presence,error:prErr}=await window.sahreejSupabase.from('driver_presence').select('is_online,updated_at').eq('driver_id',session.user.id).maybeSingle();if(prErr&&prErr.code!=='PGRST116')throw prErr;
      const approved=String(profile?.status||'').toLowerCase()==='approved',online=!!presence?.is_online;
      if(q('driverDashName'))q('driverDashName').textContent=profile?.full_name||'Driver';
      if(q('driverOnlineToggle')){q('driverOnlineToggle').checked=online;q('driverOnlineToggle').disabled=!approved;}
      if(q('driverOnlineTitle'))q('driverOnlineTitle').textContent=approved?(online?"You're online":"You're offline"):'Driver approval pending';
      if(q('driverOnlineSub'))q('driverOnlineSub').textContent=approved?(online?'GPS is active. Waiting for nearby customer requests.':'Go online to receive tanker requests.'):'Sahreej must approve your driver account before you can go online.';
      if(approved&&online) window.sahreejStartDriverGps?.();
      else window.sahreejStopDriverGps?.();
    }catch(e){console.warn('refreshDriverAvailability',e)}
  }
  S.refreshDriverAvailability=refreshDriverAvailability;

  let driverGpsWatchId=null;
  let driverGpsHeartbeatTimer=null;
  let driverGpsLastCoords=null;
  let driverGpsLastSentAt=0;
  let driverGpsSending=false;

  async function sendDriverGps(coords,force=false){
    if(!coords||driverGpsSending)return;
    const now=Date.now();
    if(!force&&now-driverGpsLastSentAt<12000)return;
    driverGpsSending=true;
    try{
      const latitude=Number(coords.latitude),longitude=Number(coords.longitude);
      if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return;
      const heading=Number(coords.heading),accuracy=Number(coords.accuracy);
      const {data,error}=await window.sahreejSupabase.rpc('update_my_driver_presence_location',{
        p_latitude:latitude,
        p_longitude:longitude,
        p_heading:Number.isFinite(heading)?heading:null,
        p_accuracy_m:Number.isFinite(accuracy)?accuracy:null
      });
      if(error)throw error;
      if(data!==true){
        window.sahreejStopDriverGps?.();
        await refreshDriverAvailability().catch(()=>{});
        return;
      }
      driverGpsLastSentAt=now;
    }catch(e){
      console.warn('driver GPS heartbeat',e);
    }finally{
      driverGpsSending=false;
    }
  }

  window.sahreejStartDriverGps=function(){
    if(!navigator.geolocation)return;
    if(driverGpsWatchId===null){
      try{
        driverGpsWatchId=navigator.geolocation.watchPosition(
          pos=>{driverGpsLastCoords=pos.coords;sendDriverGps(pos.coords,false);},
          err=>console.warn('driver GPS watch',locationErrorMessage(err)),
          {enableHighAccuracy:true,timeout:20000,maximumAge:5000}
        );
      }catch(e){console.warn('driver GPS watch start',e)}
    }
    if(!driverGpsHeartbeatTimer){
      driverGpsHeartbeatTimer=setInterval(async()=>{
        if(driverGpsLastCoords){await sendDriverGps(driverGpsLastCoords,true);return;}
        try{const pos=await currentPosition();driverGpsLastCoords=pos.coords;await sendDriverGps(pos.coords,true);}catch(e){console.warn('driver GPS heartbeat location',e)}
      },60000);
    }
  };

  window.sahreejStopDriverGps=function(){
    if(driverGpsWatchId!==null){
      try{navigator.geolocation.clearWatch(driverGpsWatchId)}catch(_){}
      driverGpsWatchId=null;
    }
    if(driverGpsHeartbeatTimer){clearInterval(driverGpsHeartbeatTimer);driverGpsHeartbeatTimer=null;}
    driverGpsLastCoords=null;driverGpsLastSentAt=0;
  };

  window.toggleDriverOnline=async function(){
    const toggle=q('driverOnlineToggle'),desired=!!toggle?.checked;if(toggle)toggle.disabled=true;
    try{
      await S.requireSession();
      if(desired){
        if(!navigator.geolocation)throw new Error('Location is not supported on this device');
        const pos=await currentPosition();
        const {latitude,longitude,heading,accuracy}=pos.coords;
        const {error}=await window.sahreejSupabase.rpc('set_my_driver_online',{p_online:true,p_latitude:latitude,p_longitude:longitude,p_heading:Number.isFinite(heading)?heading:null,p_accuracy_m:Number.isFinite(accuracy)?accuracy:null});if(error)throw error;
        if(typeof sahreejStartDriverGps==='function')sahreejStartDriverGps();
      }else{
        const {error}=await window.sahreejSupabase.rpc('set_my_driver_online',{p_online:false,p_latitude:null,p_longitude:null,p_heading:null,p_accuracy_m:null});if(error)throw error;
        if(typeof sahreejStopDriverGps==='function')sahreejStopDriverGps();
      }
      await refreshDriverAvailability();
    }catch(e){S.runtimeError(e.message||'Could not update driver availability');await refreshDriverAvailability().catch(()=>{});}finally{if(toggle)toggle.disabled=false;}
  };

  function locationErrorMessage(err){
    if(!err)return 'Could not get your current location';
    if(err.code===1)return 'Location permission is required. Allow location access in your browser settings and try again.';
    if(err.code===2)return 'Your location is currently unavailable. Move to an area with a better GPS signal and try again.';
    if(err.code===3)return 'Location timed out. Check your GPS signal and try again.';
    return err.message||'Could not get your current location';
  }
  function currentPosition(){
    if(!navigator.geolocation) return Promise.reject(new Error('Location is not supported on this device'));
    return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,e=>reject(new Error(locationErrorMessage(e))),{enableHighAccuracy:true,timeout:15000,maximumAge:5000}));
  }

  async function customerContact(orderId){
    try{
      const {data,error}=await window.sahreejSupabase.rpc('get_my_active_delivery_customer_contact',{p_order_id:orderId});
      if(error)throw error;
      return Array.isArray(data)?(data[0]||null):(data||null);
    }catch(e){console.warn('customer contact unavailable',e);return null;}
  }

  function activeHost(){const dash=q('driverDashboard');if(!dash)return null;const body=dash.querySelector('.body')||dash;let host=q('v8DriverActiveDelivery');if(!host){host=document.createElement('div');host.id='v8DriverActiveDelivery';host.style.cssText='margin:12px 16px;padding:18px;border:1px solid #ddd;border-radius:20px;background:#fff;position:relative;z-index:35';body.insertBefore(host,body.firstChild);}return host;}
  async function orderRpc(name,id,extra={}){const {error}=await window.sahreejSupabase.rpc(name,{p_order_id:id,...extra});if(error)throw error;}

  function finishDriverJobLocally(message){
    clearInterval(window.v8DriverActiveTimer);lastDriverRenderKey='';q('v8DriverActiveDelivery')?.remove();document.body.classList.remove('driver-job-active');if(q('driverWaiting'))q('driverWaiting').style.display='';localStorage.removeItem('sahreejDriverActiveServerOrderId');window.sahreejDriverActiveServerOrderId=null;S.refreshDriverMetrics?.();S.refreshDriverAvailability?.();if(typeof toast==='function')toast(message);
  }

  async function verifyDeliveryPin(order,button){
    const raw=prompt('Enter the customer’s 4-digit delivery PIN:');
    if(raw===null)return;
    const pin=String(raw).trim();
    if(!/^\d{4}$/.test(pin)){if(typeof toast==='function')toast('Enter the 4-digit delivery PIN');return;}
    button.disabled=true;button.textContent='Verifying PIN…';
    try{
      const {data,error}=await window.sahreejSupabase.rpc('driver_verify_delivery_pin_v2',{p_order_id:order.id,p_pin:pin});
      if(error)throw error;
      const result=Array.isArray(data)?data[0]:data;
      if(!result?.success){
        const locked=result?.locked_until?new Date(result.locked_until):null;
        const suffix=locked&&!Number.isNaN(locked.getTime())?(' Locked until '+locked.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})):''; 
        throw new Error((result?.message||'Incorrect delivery PIN')+suffix);
      }
      finishDriverJobLocally('Delivery confirmed');
    }catch(e){
      button.disabled=false;button.textContent='Enter delivery PIN';
      S.runtimeError('Could not complete delivery',e.message||String(e));
    }
  }

  let lastDriverRenderKey='';
  async function renderActive(order){
    setOnlyDriverPage('driverDashboard');moveApplicationPanel();const host=activeHost();if(!host)return;
    if(!order||S.TERMINAL.includes(order.status)){lastDriverRenderKey='';host.remove();document.body.classList.remove('driver-job-active');if(q('driverWaiting'))q('driverWaiting').style.display='';localStorage.removeItem('sahreejDriverActiveServerOrderId');window.sahreejDriverActiveServerOrderId=null;S.refreshDriverMetrics?.();return;}

    if(q('driverWaiting'))q('driverWaiting').style.display='none';q('v50DriverActiveDelivery')?.remove();q('v51DriverActiveDelivery')?.remove();q('realDriverLifecycleCard')?.remove();
    const key=[order.id,order.status,order.tanker_capacity_l,order.delivery_address,order.driver_earnings_usd].join('|');if(lastDriverRenderKey===key&&host.isConnected)return;lastDriverRenderKey=key;
    let label='',rpc='';
    if(order.status==='assigned'){label="I've arrived";rpc='driver_mark_arrived'}
    if(order.status==='driver_arrived'){label='Start delivery';rpc='driver_start_delivery'}
    if(order.status==='delivering'){label='Enter delivery PIN';rpc='driver_verify_delivery_pin'}

    document.body.classList.add('driver-job-active');host.classList.add('driver-job-card');
    const customer=await customerContact(order.id);
    const customerPhone=String(customer?.customer_phone||'').replace(/\s+/g,'');
    const customerTel=customerPhone?(customerPhone.startsWith('+')?customerPhone:'+961'+customerPhone.replace(/^0/,'')):'';
    const customerName=customer?.customer_name||'Customer';
    const dlat=Number(order.delivery_latitude),dlng=Number(order.delivery_longitude);const navUrl=(Number.isFinite(dlat)&&Number.isFinite(dlng))?`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dlat+','+dlng)}`:'#';
    const canCancel=['assigned','driver_arrived'].includes(order.status);
    const pinNotice=order.status==='delivering'?'<div class="card" style="margin:12px 0;background:#f7f7f7"><strong>Delivery confirmation required</strong><span class="muted">Finish unloading the water, then ask the customer for their 4-digit Sahreej delivery PIN.</span></div>':'';
    host.innerHTML=`<div class="driver-job-header"><div><span class="status">${String(order.status).replaceAll('_',' ').toUpperCase()}</span><div class="driver-job-main">${Number(order.tanker_capacity_l||0).toLocaleString()} L delivery</div></div><strong>${Number(order.driver_earnings_usd||0).toFixed(2)}</strong></div><div class="driver-job-address">${order.delivery_address||'Pinned delivery location'}</div>${order.delivery_instructions?`<div class="card" style="margin:10px 0;background:#f7f7f7"><small>DELIVERY INSTRUCTIONS</small><strong style="display:block;margin-top:4px">${esc(order.delivery_instructions)}</strong></div>`:''}<div id="v8DriverActiveRouteMeta" class="offer-route-meta">Calculating route…</div><div id="v8DriverActiveMapHost"></div>${pinNotice}<div class="driver-job-meta"><div><small>Capacity</small><strong>${Number(order.tanker_capacity_l||0).toLocaleString()} L</strong></div><div><small>Earnings</small><strong>${Number(order.driver_earnings_usd||0).toFixed(2)}</strong></div></div><div class="driver-job-actions"><a class="navigate-btn" href="${navUrl}" target="_blank" rel="noopener">Navigate to customer</a>${customerTel?`<a class="secondary" href="tel:${customerTel}">Call ${esc(customerName)}</a>`:'<button class="secondary" disabled>Customer phone unavailable</button>'}${label?`<button class="primary" id="v8DriverAction">${label}</button>`:''}${canCancel?'<button class="secondary" id="v8DriverCancel">Cancel delivery</button>':''}</div>`;

    if(['assigned','driver_arrived'].includes(order.status)){
      (async()=>{try{const p=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:10000,maximumAge:5000}));const from={lat:p.coords.latitude,lng:p.coords.longitude};const to={lat:Number(order.delivery_latitude),lng:Number(order.delivery_longitude)};if(Number.isFinite(to.lat)&&Number.isFinite(to.lng)){const route=await S.ensureMiniRouteMap('v8DriverActiveMapHost','v8DriverActiveMap',from,to);const f=S.formatRoute(route);if(q('v8DriverActiveRouteMeta'))q('v8DriverActiveRouteMeta').textContent=`About ${f.mins} min · ${f.km.toFixed(1)} km to customer`;}}catch(_){if(q('v8DriverActiveRouteMeta'))q('v8DriverActiveRouteMeta').textContent='Route unavailable';}})();
    }else if(q('v8DriverActiveRouteMeta'))q('v8DriverActiveRouteMeta').style.display='none';

    const action=q('v8DriverAction');
    if(action){action.onclick=async()=>{
      if(order.status==='delivering')return verifyDeliveryPin(order,action);
      action.disabled=true;
      try{
        if(order.status==='assigned'){
          action.textContent='Checking location…';
          const pos=await currentPosition();
          const {latitude,longitude,accuracy}=pos.coords;
          const {error}=await window.sahreejSupabase.rpc('driver_mark_arrived',{
            p_order_id:order.id,
            p_latitude:latitude,
            p_longitude:longitude,
            p_accuracy_m:Number.isFinite(accuracy)?accuracy:null
          });
          if(error)throw error;
          if(typeof toast==='function')toast('Arrival confirmed');
        }else{
          await orderRpc(rpc,order.id);
        }
        lastDriverRenderKey='';
        const fresh=await S.fetchOrder(order.id);
        await renderActive(fresh);
      }catch(e){
        const msg=e?.code===1?'Location permission is required to confirm arrival':(e.message||String(e));
        S.runtimeError(order.status==='assigned'?'Cannot confirm arrival':'Could not update delivery',msg);
      }finally{
        action.disabled=false;
        action.textContent=order.status==='assigned'?"I've arrived":(order.status==='driver_arrived'?'Start delivery':'Enter delivery PIN');
      }
    };}

    const cancel=q('v8DriverCancel');
    if(cancel){cancel.onclick=async()=>{const reason=prompt('Reason for cancelling this delivery:');if(reason===null)return;const clean=reason.trim();if(clean.length<3){if(typeof toast==='function')toast('Please enter a cancellation reason');return;}cancel.disabled=true;cancel.textContent='Cancelling…';try{await orderRpc('driver_cancel_order',order.id,{p_reason:clean});finishDriverJobLocally('Delivery cancelled');}catch(e){cancel.disabled=false;cancel.textContent='Cancel delivery';S.runtimeError('Could not cancel delivery',e.message||String(e));}};}

    window.sahreejDeliveryCoords={lat:Number(order.delivery_latitude),lng:Number(order.delivery_longitude)};window.address=order.delivery_address;if(typeof sahreejStartDriverGps==='function'){try{sahreejStartDriverGps()}catch(_){}}
  }
  S.renderDriverActive=renderActive;
  S.startDriverActivePoll=function(id){clearInterval(window.v8DriverActiveTimer);window.v8DriverActiveTimer=setInterval(async()=>{try{const o=await S.fetchOrder(id);if(!o)return;await renderActive(o);if(S.TERMINAL.includes(o.status))clearInterval(window.v8DriverActiveTimer);}catch(e){console.warn('Driver active poll',e)}},1500);};
})();
