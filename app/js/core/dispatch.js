(function(){
  'use strict';
  const S=window.SahreejCore, q=S.q;

  async function pendingOffer(){
    let r=await window.sahreejSupabase.rpc('get_my_pending_driver_offer_v2');
    if(r.error) r=await window.sahreejSupabase.rpc('get_my_pending_driver_offer');
    if(r.error) throw r.error;
    return Array.isArray(r.data)?(r.data[0]||null):(r.data||null);
  }

  function removeOffer(){
    const card=q('realDriverOfferCard');
    if(card){
      const map=S._miniMaps?.v8OfferMap;
      if(map){try{map.remove()}catch(_){};delete S._miniMaps.v8OfferMap;}
      card.remove();
    }
    document.body.classList.remove('driver-offer-active');
    S._driverOfferRenderKey=null;
    clearInterval(window.v8OfferCountdownTimer);
  }
  S.removeOffer=removeOffer;

  async function geolocate(){
    if(!navigator.geolocation)return null;
    try{
      const p=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:10000,maximumAge:4000}));
      return {lat:p.coords.latitude,lng:p.coords.longitude};
    }catch(_){return null;}
  }

  async function enrichOfferRoute(offer){
    const lat=Number(offer.delivery_latitude),lng=Number(offer.delivery_longitude);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
    const from=await geolocate();if(!from)return;
    const meta=q('v8OfferRouteMeta');
    try{
      const route=await S.ensureMiniRouteMap('v8OfferMapHost','v8OfferMap',from,{lat,lng});
      const f=S.formatRoute(route);
      if(meta)meta.textContent=`${f.mins} min · ${f.km.toFixed(1)} km to pickup location`;
    }catch(_){if(meta)meta.textContent=`${Number(offer.distance_km||0).toFixed(1)} km away`;}
  }

  async function expireOffer(offerId){
    try{await window.sahreejSupabase.rpc('expire_my_driver_offer',{p_offer_id:offerId});}
    catch(e){console.warn('offer expiry handoff',e);}
    removeOffer();
  }

  function renderOffer(offer){
    if(!offer){removeOffer();return;}
    const dash=q('driverDashboard');if(!dash)return;
    const body=dash.querySelector('.body')||dash;
    const offerId=offer.offer_id||offer.id;
    const renderKey=[offerId,offer.delivery_latitude,offer.delivery_longitude,offer.expires_at].join('|');
    let card=q('realDriverOfferCard');

    if(card&&S._driverOfferRenderKey===renderKey)return;
    if(card)removeOffer();

    card=document.createElement('div');
    card.id='realDriverOfferCard';
    card.dataset.v8='1';
    card.style.cssText='margin:12px 16px;padding:0;border:0;border-radius:24px;background:#fff;position:relative;z-index:45;overflow:hidden;box-shadow:0 12px 35px #0002';
    body.insertBefore(card,body.firstChild);
    document.body.classList.add('driver-offer-active');
    S._driverOfferRenderKey=renderKey;

    const fallbackDistance=Number(offer.distance_km||0);
    card.innerHTML=`
      <div style="padding:18px 18px 14px;background:#111;color:#fff">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px">
          <div><div style="font-size:12px;font-weight:850;letter-spacing:.08em;opacity:.7">NEW REQUEST</div><strong style="display:block;font-size:24px;margin-top:4px">${Number(offer.tanker_capacity_l||0).toLocaleString()} L delivery</strong><div id="v8OfferRouteMeta" style="font-size:14px;opacity:.78;margin-top:5px">${fallbackDistance>0?fallbackDistance.toFixed(1)+' km away':'Calculating route…'}</div></div>
          <div id="v8OfferCountdown" style="width:54px;height:54px;border-radius:50%;background:#fff;color:#111;display:grid;place-items:center;font-size:18px;font-weight:950;flex:none">—</div>
        </div>
      </div>
      <div id="v8OfferMapHost" style="min-height:150px;background:#eee"></div>
      <div style="padding:16px 18px 18px">
        <div style="font-weight:850;font-size:16px;line-height:1.35">${offer.delivery_address||'Pinned delivery location'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">
          <div style="padding:13px;border-radius:16px;background:#f4f4f4"><small style="display:block;color:#666">TANKER</small><strong style="font-size:18px">${Number(offer.tanker_capacity_l||0).toLocaleString()} L</strong></div>
          <div style="padding:13px;border-radius:16px;background:#f4f4f4"><small style="display:block;color:#666">YOUR EARNINGS</small><strong style="font-size:18px">$${Number(offer.driver_earnings_usd||0).toFixed(2)}</strong></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1.4fr;gap:10px;margin-top:16px"><button class="secondary" id="v8DeclineOffer" style="min-height:52px">Decline</button><button class="primary" id="v8AcceptOffer" style="min-height:52px">Accept delivery</button></div>
      </div>`;

    q('v8DeclineOffer').onclick=()=>declineOffer(offerId);
    q('v8AcceptOffer').onclick=()=>acceptOffer(offerId);
    enrichOfferRoute(offer).catch(()=>{});
    try{navigator.vibrate?.([120,70,120]);}catch(_){}

    clearInterval(window.v8OfferCountdownTimer);
    if(offer.expires_at){
      let expiryHandled=false;
      const updateCountdown=()=>{
        const sec=Math.max(0,Math.ceil((new Date(offer.expires_at).getTime()-Date.now())/1000));
        const el=q('v8OfferCountdown');if(el)el.textContent=String(sec);
        if(sec<=5&&el){el.style.background='#ffe5e5';el.style.color='#9e1111';}
        if(sec<=0&&!expiryHandled){expiryHandled=true;clearInterval(window.v8OfferCountdownTimer);expireOffer(offerId);}
      };
      updateCountdown();
      window.v8OfferCountdownTimer=setInterval(updateCountdown,250);
    }
  }

  async function acceptOffer(offerId){
    const accept=q('v8AcceptOffer'),decline=q('v8DeclineOffer');
    if(accept){accept.disabled=true;accept.textContent='Accepting…';}
    if(decline)decline.disabled=true;
    try{
      const {data,error}=await window.sahreejSupabase.rpc('accept_driver_offer',{p_offer_id:offerId});if(error)throw error;
      let order=null;const candidate=typeof data==='string'?data:(data?.order_id||data?.id);
      if(candidate)order=await S.fetchOrder(candidate).catch(()=>null);
      for(let i=0;(!order||!S.DRIVER_ACTIVE.includes(order.status))&&i<8;i++){await S.sleep(200);order=await S.fetchMyDriverActive().catch(()=>null);}
      if(!order)throw new Error('Offer was accepted but no assigned delivery was found.');
      localStorage.setItem('sahreejDriverActiveServerOrderId',order.id);window.sahreejDriverActiveServerOrderId=order.id;
      removeOffer();await S.renderDriverActive(order);S.startDriverActivePoll(order.id);if(typeof toast==='function')toast('Delivery accepted');
    }catch(e){
      S.runtimeError('Could not accept delivery',e.message||String(e));
      if(accept){accept.disabled=false;accept.textContent='Accept delivery';}
      if(decline)decline.disabled=false;
    }
  }
  S.acceptOffer=acceptOffer;

  async function declineOffer(offerId){
    const accept=q('v8AcceptOffer'),decline=q('v8DeclineOffer');
    if(decline){decline.disabled=true;decline.textContent='Declining…';}
    if(accept)accept.disabled=true;
    try{
      const {error}=await window.sahreejSupabase.rpc('decline_driver_offer',{p_offer_id:offerId});if(error)throw error;
      removeOffer();if(typeof toast==='function')toast('Request declined');
    }catch(e){
      S.runtimeError('Could not decline request',e.message||String(e));
      if(decline){decline.disabled=false;decline.textContent='Decline';}
      if(accept)accept.disabled=false;
    }
  }
  S.declineOffer=declineOffer;

  S.startOfferPoll=function(){
    clearInterval(window.v8OfferPoll);
    const tick=async()=>{
      try{
        const active=await S.fetchMyDriverActive();
        if(active){removeOffer();localStorage.setItem('sahreejDriverActiveServerOrderId',active.id);await S.renderDriverActive(active);S.startDriverActivePoll(active.id);return;}
        renderOffer(await pendingOffer());
      }catch(e){console.warn('Offer poll',e);}
    };
    tick();window.v8OfferPoll=setInterval(tick,1500);
  };

  window.sahreejAcceptRealOffer=offerId=>acceptOffer(offerId);
  window.sahreejDeclineRealOffer=offerId=>declineOffer(offerId);
})();
