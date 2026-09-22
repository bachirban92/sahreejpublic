(function(){
  'use strict';

  const S=window.SahreejCore=window.SahreejCore||{};
  const previousOpenAccountPanel=window.openAccountPanel;
  let editorMap=null;
  let editorMarker=null;
  let editorCoords=null;

  const $=id=>document.getElementById(id);

  function signedIn(){
    return localStorage.getItem('sahreejCustomerSignedIn')==='1';
  }

  function esc(v){
    return String(v??'').replace(/[&<>'"]/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    }[ch]));
  }

  async function getSession(){
    const client=window.sahreejSupabase;
    if(!client) throw new Error('Backend unavailable');
    const {data,error}=await client.auth.getSession();
    if(error) throw error;
    if(!data?.session?.user?.id) throw new Error('Sign in again to use saved places');
    return data.session;
  }

  async function fetchSavedPlaces(){
    const session=await getSession();
    const {data,error}=await window.sahreejSupabase
      .from('saved_places')
      .select('id,label,address_text,latitude,longitude,created_at')
      .eq('user_id',session.user.id)
      .order('created_at',{ascending:true});
    if(error) throw error;
    return data||[];
  }

  async function renderSavedPlaces(){
    const title=$('accountPanelTitle');
    const body=$('accountPanelBody');
    if(!title || !body) return;

    title.textContent='Saved places';
    if(typeof window.openScreen==='function') window.openScreen('accountPanel');

    if(!signedIn()){
      body.innerHTML=`
        <div class="card">
          <strong>Sign in to use saved places</strong>
          <span class="muted">Your saved delivery locations belong to your Sahreej account.</span>
        </div>`;
      return;
    }

    body.innerHTML=`<div class="card"><strong>Loading saved places…</strong></div>`;
    try{
      const places=await fetchSavedPlaces();
      const rows=places.map(p=>`
        <div class="card saved-place-row" data-id="${esc(p.id)}">
          <div class="row" style="align-items:flex-start;gap:12px">
            <div style="flex:1;min-width:0">
              <strong>${esc(p.label)}</strong>
              <span class="muted" style="display:block;margin-top:4px">${esc(p.address_text)}</span>
            </div>
            <button class="saved-place-use" type="button" onclick="sahreejUseSavedPlace('${esc(p.id)}')">Use</button>
          </div>
          <button class="saved-place-delete" type="button" onclick="sahreejDeleteSavedPlace('${esc(p.id)}')">Remove</button>
        </div>`).join('');

      body.innerHTML=`
        ${rows || `<div class="card"><strong>No saved places yet</strong><span class="muted">Add Home, Work, or another delivery location.</span></div>`}
        <button class="secondary" type="button" onclick="sahreejOpenSavedPlaceEditor()">Add saved place</button>`;
    }catch(err){
      console.error('Saved places load failed',err);
      body.innerHTML=`
        <div class="card"><strong>Could not load saved places</strong><span class="muted">${esc(err?.message||'Try again')}</span></div>
        <button class="secondary" type="button" onclick="renderSavedPlaces()">Try again</button>`;
    }
  }
  window.renderSavedPlaces=renderSavedPlaces;

  async function reverseGeocode(lat,lng){
    if(typeof window.sahreejReverseGeocode==='function'){
      try{return await window.sahreejReverseGeocode(lat,lng);}catch(_){ }
    }
    return `Pinned location · ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
  }

  function placeEditorHtml(){
    return `
      <div class="card saved-place-editor">
        <label class="saved-place-label">Name</label>
        <input id="savedPlaceLabel" class="search" maxlength="40" placeholder="Home, Work, Mom's house…">

        <label class="saved-place-label" style="margin-top:14px">Location</label>
        <div id="savedPlaceAddress" class="saved-place-address">Choose a location on the map</div>
        <div id="savedPlaceMap" style="height:240px;border-radius:18px;overflow:hidden;margin-top:10px;background:#f2f2f2"></div>

        <button class="secondary" type="button" style="margin-top:12px" onclick="sahreejSavedPlaceUseGPS()">Use my current location</button>
        <button class="primary" id="savedPlaceSaveBtn" type="button" style="margin-top:10px" onclick="sahreejSavePlace()">Save place</button>
        <button class="secondary" type="button" style="margin-top:10px" onclick="renderSavedPlaces()">Cancel</button>
      </div>`;
  }

  function setEditorCoords(coords,address){
    const c=S.normalizeDeliveryCoords?.(coords) || (coords&&Number.isFinite(Number(coords.lat))&&Number.isFinite(Number(coords.lng))?{lat:Number(coords.lat),lng:Number(coords.lng)}:null);
    if(!c) return;
    editorCoords=c;
    const addr=$('savedPlaceAddress');
    if(addr) addr.textContent=address||`Pinned location · ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
    if(editorMap){
      editorMap.setView([c.lat,c.lng],16,{animate:false});
      if(editorMarker){editorMarker.setLatLng([c.lat,c.lng]);}
      else if(typeof L!=='undefined') editorMarker=L.circleMarker([c.lat,c.lng],{radius:8,weight:4,color:'#fff',fillColor:'#111',fillOpacity:1}).addTo(editorMap);
    }
  }

  window.sahreejOpenSavedPlaceEditor=function(){
    const title=$('accountPanelTitle');
    const body=$('accountPanelBody');
    if(!title||!body) return;
    title.textContent='Add saved place';
    body.innerHTML=placeEditorHtml();

    const draft=S.getOrderDraft?.();
    const start=draft?.coords || {lat:33.8938,lng:35.5018};
    const initialAddress=draft?.address || 'Move the map to the location';
    editorCoords={lat:Number(start.lat),lng:Number(start.lng)};
    $('savedPlaceAddress').textContent=initialAddress;

    setTimeout(()=>{
      if(typeof L==='undefined') return;
      try{editorMap?.remove();}catch(_){ }
      editorMap=L.map('savedPlaceMap',{zoomControl:false}).setView([editorCoords.lat,editorCoords.lng],16);
      if(S.addBaseTiles) S.addBaseTiles(editorMap);
      else L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,attribution:'Tiles &copy; Esri'}).addTo(editorMap);
      editorMarker=L.circleMarker([editorCoords.lat,editorCoords.lng],{radius:8,weight:4,color:'#fff',fillColor:'#111',fillOpacity:1}).addTo(editorMap);
      let geocodeTimer=null;
      editorMap.on('move',()=>{
        const c=editorMap.getCenter();
        editorCoords={lat:c.lat,lng:c.lng};
        editorMarker.setLatLng([c.lat,c.lng]);
      });
      editorMap.on('moveend',()=>{
        clearTimeout(geocodeTimer);
        geocodeTimer=setTimeout(async()=>{
          const c=editorMap.getCenter();
          editorCoords={lat:c.lat,lng:c.lng};
          const label=await reverseGeocode(c.lat,c.lng);
          if($('savedPlaceAddress')) $('savedPlaceAddress').textContent=label;
        },250);
      });
      setTimeout(()=>editorMap.invalidateSize(),100);
    },80);
  };

  window.sahreejSavedPlaceUseGPS=function(){
    if(!navigator.geolocation){if(typeof toast==='function')toast('Location is not available');return;}
    if(typeof toast==='function') toast('Finding your location…');
    navigator.geolocation.getCurrentPosition(async p=>{
      const c={lat:Number(p.coords.latitude),lng:Number(p.coords.longitude)};
      const label=await reverseGeocode(c.lat,c.lng);
      setEditorCoords(c,label);
      if(typeof toast==='function') toast('Location updated');
    },()=>{if(typeof toast==='function')toast('Please allow location access');},{enableHighAccuracy:true,timeout:15000,maximumAge:10000});
  };

  window.sahreejSavePlace=async function(){
    const label=String($('savedPlaceLabel')?.value||'').trim();
    const address=String($('savedPlaceAddress')?.textContent||'').trim();
    if(!label){if(typeof toast==='function')toast('Enter a name for this place');return;}
    if(!editorCoords){if(typeof toast==='function')toast('Choose a location');return;}

    const btn=$('savedPlaceSaveBtn');
    if(btn){btn.disabled=true;btn.textContent='Saving…';}
    try{
      const session=await getSession();
      const {error}=await window.sahreejSupabase.from('saved_places').insert({
        user_id:session.user.id,
        label,
        address_text:address||`Pinned location · ${editorCoords.lat.toFixed(5)}, ${editorCoords.lng.toFixed(5)}`,
        latitude:editorCoords.lat,
        longitude:editorCoords.lng
      });
      if(error) throw error;
      if(typeof toast==='function') toast('Saved place added');
      await renderSavedPlaces();
    }catch(err){
      console.error('Save place failed',err);
      if(typeof toast==='function')toast(err?.message||'Could not save place');
    }finally{
      if(btn){btn.disabled=false;btn.textContent='Save place';}
    }
  };

  window.sahreejDeleteSavedPlace=async function(id){
    try{
      const {error}=await window.sahreejSupabase.from('saved_places').delete().eq('id',id);
      if(error) throw error;
      if(typeof toast==='function') toast('Saved place removed');
      await renderSavedPlaces();
    }catch(err){
      console.error('Delete saved place failed',err);
      if(typeof toast==='function')toast(err?.message||'Could not remove place');
    }
  };

  window.sahreejUseSavedPlace=async function(id){
    try{
      const session=await getSession();
      const {data,error}=await window.sahreejSupabase
        .from('saved_places')
        .select('id,label,address_text,latitude,longitude')
        .eq('id',id)
        .eq('user_id',session.user.id)
        .single();
      if(error) throw error;
      const coords={lat:Number(data.latitude),lng:Number(data.longitude)};
      if(!Number.isFinite(coords.lat)||!Number.isFinite(coords.lng)) throw new Error('This saved place has no map location');
      S.setCanonicalLocation?.(coords,data.address_text);
      try{closeScreen('accountPanel')}catch(_){ }
      if(typeof showCustomerTab==='function') showCustomerTab('home');
      if(typeof toast==='function') toast(`${data.label} selected`);
    }catch(err){
      console.error('Use saved place failed',err);
      if(typeof toast==='function')toast(err?.message||'Could not use saved place');
    }
  };

  async function renderAccountSettings(){
    const title=$('accountPanelTitle');
    const body=$('accountPanelBody');
    if(!title||!body)return;
    title.textContent='Settings';
    if(typeof window.openScreen==='function') window.openScreen('accountPanel');

    let deletion=null;
    if(signedIn()){
      try{
        const {data,error}=await window.sahreejSupabase.rpc('get_my_account_deletion_request');
        if(error)throw error;
        deletion=Array.isArray(data)?data[0]:data;
      }catch(_){}
    }

    const deletionCard=deletion&&['requested','pending_settlement','processing'].includes(String(deletion.status||'')) ? `
      <div class="card">
        <strong>Account deletion requested</strong>
        <span class="muted" style="display:block;margin-top:5px">${deletion.status==='pending_settlement'
          ? 'Your request is waiting for driver settlement to be cleared.'
          : deletion.status==='processing'
            ? 'Your account deletion request is being processed.'
            : 'Your account deletion request has been received.'}</span>
      </div>` : '';

    body.innerHTML=`
      <button class="accountbtn" type="button" onclick="openCustomerProfilePanel()"><span>Profile</span><b>›</b></button>
      <button class="accountbtn" type="button" onclick="SahreejNotifications?.panel?.()"><span>Notifications</span><b>›</b></button>
      <div class="card"><div class="row"><span>Language</span><strong>English</strong></div></div>
      ${deletionCard}
      ${signedIn() && !deletionCard ? '<button class="secondary" type="button" style="margin-top:12px" onclick="sahreejRequestAccountDeletion()">Delete account</button>' : ''}
    `;
  }
  window.sahreejRenderAccountSettings=renderAccountSettings;

  window.sahreejRequestAccountDeletion=async function(){
    if(!signedIn()){if(typeof toast==='function')toast('Sign in first');return;}
    const ok=confirm('Request permanent deletion of your Sahreej account and associated personal data? Active deliveries must be finished first.');
    if(!ok)return;
    const reason=prompt('Reason (optional):','');
    if(reason===null)return;
    try{
      const {data,error}=await window.sahreejSupabase.rpc('request_my_account_deletion',{p_reason:reason.trim()||null});
      if(error)throw error;
      const row=Array.isArray(data)?data[0]:data;
      if(typeof toast==='function')toast(row?.status==='pending_settlement'?'Deletion requested · settlement must be cleared first':'Account deletion requested');
      await renderAccountSettings();
    }catch(err){
      console.error('Account deletion request failed',err);
      if(typeof toast==='function')toast(err?.message||'Could not request account deletion');
    }
  };

  window.openAccountPanel=function(type){
    if(type==='places') return renderSavedPlaces();
    if(type==='settings') return renderAccountSettings();
    if(type==='payments'){
      const title=$('accountPanelTitle'),body=$('accountPanelBody');
      if(title&&body){
        title.textContent='Payments';
        body.innerHTML='<div class="card"><strong>Cash on delivery</strong><span class="muted" style="display:block;margin-top:5px">Pay the driver when your tanker is delivered.</span></div>';
        if(typeof window.openScreen==='function')window.openScreen('accountPanel');
        return;
      }
    }
    if(typeof previousOpenAccountPanel==='function') return previousOpenAccountPanel(type);
  };
})();
