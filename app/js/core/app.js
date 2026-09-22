(function(){
  'use strict';
  const S=window.SahreejCore, q=S.q;

  async function restoreDriverState(){
    try{
      stripLegacyDriverUi();
      await S.refreshDriverAvailability?.();
      await S.refreshDriverMetrics?.();
      S.moveApplicationPanel?.();
      const active=await S.fetchMyDriverActive();
      if(active){
        localStorage.setItem('sahreejDriverActiveServerOrderId',active.id);
        await S.renderDriverActive(active);
        S.startDriverActivePoll(active.id);
      }else{
        q('v8DriverActiveDelivery')?.remove();
        S.startOfferPoll?.();
      }
    }catch(e){console.warn('restoreDriverState',e)}
  }
  S.restoreDriverState=restoreDriverState;

  async function restoreCustomerState(){
    const localId=localStorage.getItem('sahreejActiveServerOrderId');
    try{
      let order=localId?await S.fetchOrder(localId):null;
      if(!order || !S.CUSTOMER_ACTIVE.includes(order.status)) order=await S.fetchMyCustomerActive().catch(()=>null);
      if(order){
        localStorage.setItem('sahreejActiveServerOrderId',order.id);
        await S.renderCustomerState(order);
        S.startCustomerPoll(order.id);
      }else if(localId){
        localStorage.removeItem('sahreejActiveServerOrderId');
      }
    }catch(e){console.warn('restoreCustomerState',e)}
  }
  S.restoreCustomerState=restoreCustomerState;

  function stripLegacyDriverUi(){
    ['sahreejRealOnlineCard','realDriverAvailabilityMeta','driverGpsStatus','driverGpsControls','realDriverLifecycleCard','v50DriverActiveDelivery','v51DriverActiveDelivery','driverActiveJob','sahreejCleanTrackingCard'].forEach(id=>q(id)?.remove());
    const online=document.querySelector('#driverDashboard .driver-online-card');
    if(online){online.style.removeProperty('display');online.style.removeProperty('visibility');online.removeAttribute('aria-hidden');}
  }
  S.stripLegacyDriverUi=stripLegacyDriverUi;

  function stripInternalUi(){
    ['sahreejDevAuthBadge','sahreejAdminEntry','adminDriverReviewScreen','driverRequest','driverActive'].forEach(id=>q(id)?.remove());
    const offers=[...document.querySelectorAll('#realDriverOfferCard')];offers.slice(1).forEach(el=>el.remove());
    stripLegacyDriverUi();S.moveApplicationPanel?.();
  }

  async function restoreAll(){
    clearLegacyTimers();stripInternalUi();
    const role=localStorage.getItem('sahreejRole');
    if(role==='driver'||localStorage.getItem('sahreejDriverSession')==='1') await restoreDriverState();
    else await restoreCustomerState();
  }
  S.restoreAll=restoreAll;

  const LEGACY_TIMERS=['sahreejOfferPoll','sahreejOfferTimer','sahreejDispatchPoll','sahreejDispatchMonitorTimer','v50OfferTimer','v50DriverOrderTimer','v50CustomerTimer','v51CustomerPoll','v6OfferPoll','v6DriverActiveTimer','v6CustomerPoll','sahreejCustomerLivePoll','sahreejCustomerOrderPollTimer','sahreejDispatchCountdownTimer','sahreejDispatchPollTimer','sahreejServerDispatchMonitorTimer','sahreejTrackingTimer'];
  function clearLegacyTimers(){LEGACY_TIMERS.forEach(k=>{try{if(window[k]) clearInterval(window[k]);window[k]=null}catch(_){}})}
  clearLegacyTimers();

  window.sahreejStartServerDispatchMonitor=function(id){if(id)S.startCustomerPoll?.(id)};
  window.sahreejMonitorServerDispatch=window.sahreejStartServerDispatchMonitor;
  window.sahreejSubscribeToOrder=function(id){if(id)S.startCustomerPoll?.(id)};
  window.sahreejRenderTrackingFromServer=async function(){
    const id=localStorage.getItem('sahreejActiveServerOrderId');
    let o=id?await S.fetchOrder(id).catch(()=>null):null;
    if(!o)o=await S.fetchMyCustomerActive().catch(()=>null);
    if(o)await S.renderCustomerState?.(o);return o;
  };

  const isNative=(()=>{try{return !!(window.Capacitor&&typeof window.Capacitor.isNativePlatform==='function'&&window.Capacitor.isNativePlatform())}catch(_){return false}})();
  let lastWebRestore=0;
  function maybeRestoreWeb(){
    const now=Date.now();
    if(now-lastWebRestore<15000) return;
    lastWebRestore=now;
    setTimeout(restoreAll,250);
  }

  window.addEventListener('load',()=>{
    removeLiteralNewlineArtifacts();
    clearLegacyTimers();
    stripInternalUi();
    if(isNative) setTimeout(restoreAll,600);
    else maybeRestoreWeb();
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden) return;
    if(isNative) setTimeout(restoreAll,100);
    else maybeRestoreWeb();
  });
  window.addEventListener('focus',()=>{
    if(isNative) setTimeout(stripInternalUi,100);
  });

  function removeLiteralNewlineArtifacts(root=document.body){
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const bad=[];
    while(walker.nextNode()){
      const node=walker.currentNode;
      const value=String(node.nodeValue||'');
      const compact=value.replace(/\s/g,'');
      if(compact && /^(?:\\n|\\r)+$/.test(compact)) bad.push(node);
    }
    bad.forEach(node=>node.remove());
  }
  S.removeLiteralNewlineArtifacts=removeLiteralNewlineArtifacts;

  function loadCoreModule(src,dataKey){
    if(document.querySelector(`script[${dataKey}]`))return;
    const script=document.createElement('script');script.src=src;script.setAttribute(dataKey,'1');script.defer=true;document.head.appendChild(script);
  }

  const build='851';
  loadCoreModule(`js/core/performance.js?v=${build}`,'data-sahreej-performance');
  loadCoreModule(`js/core/account.js?v=${build}`,'data-sahreej-account');
  loadCoreModule(`js/core/driver-media.js?v=${build}`,'data-sahreej-driver-media');
  loadCoreModule(`js/core/driver-profile-media.js?v=${build}`,'data-sahreej-driver-profile-media');
  loadCoreModule(`js/core/live-delivery-polish.js?v=${build}`,'data-sahreej-live-delivery-polish');
  loadCoreModule(`js/core/notifications.js?v=${build}`,'data-sahreej-notifications');
})();
