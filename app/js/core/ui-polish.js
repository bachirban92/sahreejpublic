(function(){
  'use strict';
  const S=window.SahreejCore;
  const $=id=>document.getElementById(id);
  const tankerAsset='assets/tanker.svg';
  let pricingCache=null, pricingAt=0;

  function money(v){return '$'+Number(v||0).toFixed(2)}
  function etaForCapacity(){ return 'Checking nearby drivers…'; }

  async function loadPricing(force=false){
    if(!force && pricingCache && Date.now()-pricingAt<30000) return pricingCache;
    if(!window.sahreejSupabase) throw new Error('Pricing service unavailable');
    let data=null, error=null;
    try{
      ({data,error}=await window.sahreejSupabase.rpc('get_active_pricing'));
    }catch(e){ error=e; }
    if(error || !Array.isArray(data) || !data.length){
      const res=await window.sahreejSupabase.from('pricing')
        .select('tanker_capacity_l,customer_price_usd,active')
        .eq('active',true).order('tanker_capacity_l',{ascending:true});
      if(res.error) throw res.error;
      data=res.data||[];
    }
    pricingCache=(data||[]).filter(r=>r.active!==false && Number(r.tanker_capacity_l)>0);
    pricingAt=Date.now();
    return pricingCache;
  }
  S.loadActivePricing=loadPricing;

  async function renderTankerOptions(force=false){
    const mount=$('tankerOptions');
    if(!mount) return false;
    mount.innerHTML='<div class="pricing-loading"><span class="spinner"></span><strong>Loading available tankers…</strong></div>';
    const choose=$('chooseBtn'); if(choose){choose.disabled=true;choose.textContent='Choose a tanker';}
    try{
      const rows=await loadPricing(force);
      if(!rows.length) throw new Error('No tanker sizes are available right now');
      mount.innerHTML='';
      rows.forEach((r,i)=>{
        const cap=Number(r.tanker_capacity_l), price=Number(r.customer_price_usd), eta=etaForCapacity(cap);
        const el=document.createElement('div');
        el.className='tanker'+(i===0?' selected':'');
        el.dataset.size=cap.toLocaleString()+' L'; el.dataset.capacity=String(cap); el.dataset.price=String(price); el.dataset.eta=eta;
        el.innerHTML=`<div class="art"><img class="tanker-brand-icon" src="${tankerAsset}" alt="Water tanker"></div><div><strong>${cap.toLocaleString()} L</strong><span class="muted">${eta}</span></div><div class="price">${money(price)}<small>total</small></div>`;
        el.onclick=()=>window.pickTanker?.(el);
        mount.appendChild(el);
      });
      const first=mount.querySelector('.tanker');
      if(first){
        window.pickTanker?.(first);
        window.selectedCapacity=Number(first.dataset.capacity);
        window.selectedTankerCapacity=Number(first.dataset.capacity);
      }
      if(choose) choose.disabled=false;
      return true;
    }catch(e){
      mount.innerHTML=`<div class="pricing-empty"><div><strong>Tankers unavailable</strong><div class="muted">${String(e.message||'Could not load pricing')}</div></div></div>`;
      return false;
    }
  }
  S.renderTankerOptions=renderTankerOptions;

  // Backend pricing owns both customer and driver capacity choices.
  async function renderDriverCapacityOptions(){
    const select=$('driverCapacity'); if(!select) return;
    try{
      const rows=await loadPricing();
      if(!rows.length) return;
      const current=Number(String(select.value||'').replace(/\D/g,''));
      select.innerHTML=rows.map(r=>`<option value="${Number(r.tanker_capacity_l)}">${Number(r.tanker_capacity_l).toLocaleString()} L</option>`).join('');
      if(rows.some(r=>Number(r.tanker_capacity_l)===current)) select.value=String(current);
    }catch(_){ }
  }

  // Keep the selected human-readable address as part of the order record.
  if(typeof window.setLocation==='function'){
    const originalSetLocation=window.setLocation;
    window.setLocation=function(label){
      window.deliveryAddress=String(label||'').trim()||'Pinned location';
      window.address=window.deliveryAddress;
      return originalSetLocation.apply(this,arguments);
    };
  }

  if(typeof window.openSelector==='function'){
    const originalOpenSelector=window.openSelector;
    window.openSelector=function(){
      const r=originalOpenSelector.apply(this,arguments);
      setTimeout(()=>renderTankerOptions(true),60);
      return r;
    };
  }

  if(typeof window.openConfirm==='function'){
    const originalOpenConfirm=window.openConfirm;
    window.openConfirm=function(){
      const selected=document.querySelector('#tankerOptions .tanker.selected');
      if(!selected){if(typeof toast==='function')toast('Choose a tanker size');return;}
      window.selectedTankerCapacity=Number(selected.dataset.capacity||String(selected.dataset.size||'').replace(/\D/g,''));
      const r=originalOpenConfirm.apply(this,arguments);
      const addr=$('cAddress'); if(addr) addr.textContent=window.deliveryAddress||window.address||addr.textContent;
      return r;
    };
  }

  // Remove prototype-only shortcuts and duplicate stale UI surfaces.
  function removePrototypeUi(){
    document.querySelectorAll('.chips').forEach(chips=>{
      const t=(chips.textContent||'').toLowerCase();
      if(t.includes('home')&&t.includes('work')) chips.remove();
    });
    ['sahreejCleanTrackingCard','v50DriverActiveDelivery','realDriverLifecycleCard','driverRequest','driverActive'].forEach(id=>$(id)?.remove());
    document.querySelectorAll('button').forEach(b=>{
      if(/^demo:/i.test((b.textContent||'').trim())) b.remove();
    });
  }

  // Prevent old demo lifecycle entry points from mutating canonical live state.
  ['demoAdvance','demoTracking','simulateDriverArrival','simulateDelivery'].forEach(name=>{
    if(name in window) window[name]=function(){console.warn(name+' is disabled in V8.12');};
  });

  function polishLocationLabels(){
    const addr=window.deliveryAddress||window.address;
    if(addr){
      if($('homeAddress')) $('homeAddress').textContent=addr;
      if($('selectAddress')) $('selectAddress').textContent=addr;
    }
  }

  window.addEventListener('load',()=>{
    removePrototypeUi();
    polishLocationLabels();
    renderDriverCapacityOptions();
    setTimeout(()=>{removePrototypeUi();renderDriverCapacityOptions();},1800);
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){removePrototypeUi();polishLocationLabels();}});
})();
