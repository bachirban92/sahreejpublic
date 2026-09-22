(function(){
  'use strict';
  const S=window.SahreejCore=window.SahreejCore||{};
  let banner=null;
  let restoring=false;

  function ensureBanner(){
    if(banner?.isConnected)return banner;
    banner=document.createElement('div');
    banner.id='sahreejNetworkBanner';
    banner.setAttribute('role','status');
    banner.setAttribute('aria-live','polite');
    banner.style.cssText='position:fixed;left:50%;transform:translateX(-50%);top:calc(10px + env(safe-area-inset-top));z-index:12000;max-width:min(92vw,520px);padding:10px 14px;border-radius:999px;background:#111;color:#fff;font-size:13px;font-weight:800;box-shadow:0 6px 18px #0003;display:none;text-align:center';
    document.body.appendChild(banner);
    return banner;
  }

  function show(text){
    const b=ensureBanner();
    b.textContent=text;
    b.style.display='block';
  }
  function hideSoon(){
    const b=ensureBanner();
    setTimeout(()=>{if(navigator.onLine)b.style.display='none';},1800);
  }

  async function restore(){
    if(restoring)return;
    restoring=true;
    try{
      const role=localStorage.getItem('sahreejRole');
      if(role==='driver'||localStorage.getItem('sahreejDriverSession')==='1'){
        await S.restoreDriverState?.();
      }else{
        await S.restoreCustomerState?.();
      }
    }catch(e){console.warn('network restore',e)}
    finally{restoring=false;}
  }

  function offline(){show('You are offline · Sahreej will reconnect automatically');}
  function online(){show('Back online · Reconnecting…');restore().finally(hideSoon);}

  window.addEventListener('offline',offline);
  window.addEventListener('online',online);
  window.addEventListener('load',()=>{if(!navigator.onLine)offline();});
})();