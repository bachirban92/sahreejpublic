(function(){
  'use strict';
  const S=window.SahreejCore||{};
  const q=id=>document.getElementById(id);
  const bucket='driver-documents';
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const previousOpen=window.openDriverAccountPanel;

  function ensureStyles(){
    if(q('driverProfileMediaStyles'))return;
    const s=document.createElement('style');s.id='driverProfileMediaStyles';s.textContent=`
      .driver-profile-photo-wrap{display:flex;align-items:center;gap:16px;margin:12px 0 22px}.driver-profile-photo-wrap input{min-width:0;flex:1}
      .driver-profile-photo-circle{width:96px;height:96px;border-radius:50%;overflow:hidden;background:#f0f1f2;display:grid;place-items:center;flex:0 0 96px;color:#777}.driver-profile-photo-circle img{width:100%;height:100%;object-fit:cover;object-position:center}
      .driver-tanker-photo-wrap{display:flex;align-items:center;gap:16px;margin:12px 0 22px}.driver-tanker-photo-wrap input{min-width:0;flex:1}
      .driver-tanker-photo-frame{width:132px;height:88px;border-radius:16px;overflow:hidden;background:#f0f1f2;display:grid;place-items:center;flex:0 0 132px;color:#777}.driver-tanker-photo-frame img{width:100%;height:100%;object-fit:cover;object-position:center}`;document.head.appendChild(s);
  }

  async function session(){if(S.requireSession)return S.requireSession();const {data,error}=await window.sahreejSupabase.auth.getSession();if(error)throw error;if(!data?.session)throw new Error('Authentication required');return data.session;}
  async function signed(path){if(!path)return null;const {data,error}=await window.sahreejSupabase.storage.from(bucket).createSignedUrl(path,600);if(error)return null;return data?.signedUrl||null;}
  function openPanel(title,html){q('accountPanelTitle').textContent=title;q('accountPanelBody').innerHTML=html;if(typeof openScreen==='function')openScreen('accountPanel');}

  async function loadVehicleMedia(){
    ensureStyles();openPanel('My tanker','<div class="card"><strong>Loading your tanker…</strong></div>');
    try{
      const s=await session();const {data:p,error}=await window.sahreejSupabase.from('driver_profiles').select('full_name,tanker_capacity_l,vehicle_plate,status,driver_photo_path,tanker_photo_path').eq('user_id',s.user.id).maybeSingle();if(error)throw error;if(!p)throw new Error('Driver profile not found');
      const [driverUrl,tankerUrl]=await Promise.all([signed(p.driver_photo_path),signed(p.tanker_photo_path)]);
      openPanel('My tanker',`<div class="driver-account-detail-card"><div><small>Capacity</small><strong>${p.tanker_capacity_l?Number(p.tanker_capacity_l).toLocaleString()+' L':'—'}</strong></div><div><small>Plate</small><strong>${esc(p.vehicle_plate||'—')}</strong></div><div><small>Status</small><strong>${esc(String(p.status||'—').replaceAll('_',' '))}</strong></div></div><div class="driver-media-card"><span class="driver-media-title">Driver photo</span><span class="driver-media-copy">Choose an existing photo from your library or take a new one.</span><div class="driver-profile-photo-wrap"><div class="driver-profile-photo-circle">${driverUrl?`<img src="${esc(driverUrl)}" alt="Driver photo">`:'Missing'}</div><input id="profileDriverPhoto" type="file" accept="image/*"></div><span class="driver-media-title">Tanker photo</span><span class="driver-media-copy">Choose an existing tanker photo or take a new one.</span><div class="driver-tanker-photo-wrap"><div class="driver-tanker-photo-frame">${tankerUrl?`<img src="${esc(tankerUrl)}" alt="Tanker photo">`:'Missing'}</div><input id="profileTankerPhoto" type="file" accept="image/*"></div><button class="primary" id="saveDriverMediaBtn" onclick="sahreejSaveDriverMedia()">Save photos</button>${(!p.driver_photo_path||!p.tanker_photo_path)?'<div class="warn">Both photos are required before this driver can go online.</div>':''}</div>`);
    }catch(e){openPanel('My tanker',`<div class="card"><strong>Could not load tanker details</strong><span class="muted">${esc(e.message||'Try again')}</span></div>`);}
  }

  async function compressImage(file,maxSide=1280,quality=.8){
    if(!file||!String(file.type||'').startsWith('image/'))return file;
    const bitmap=await createImageBitmap(file).catch(()=>null);if(!bitmap)return file;
    const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));return blob||file;
  }

  async function upload(path,file){const {error}=await window.sahreejSupabase.storage.from(bucket).upload(path,file,{upsert:true,contentType:file.type||'image/jpeg',cacheControl:'3600'});if(error)throw error;return path;}

  window.sahreejSaveDriverMedia=async function(){
    const driverFile=q('profileDriverPhoto')?.files?.[0],tankerFile=q('profileTankerPhoto')?.files?.[0];if(!driverFile&&!tankerFile){if(typeof toast==='function')toast('Choose at least one photo');return;}
    const btn=q('saveDriverMediaBtn');if(btn){btn.disabled=true;btn.textContent='Optimizing photos…';}
    try{
      const s=await session(),uid=s.user.id,stamp=Date.now();let driverPath=null,tankerPath=null;
      const [driverOptimized,tankerOptimized]=await Promise.all([driverFile?compressImage(driverFile,960,.78):null,tankerFile?compressImage(tankerFile,1280,.78):null]);
      if(btn)btn.textContent='Saving photos…';
      if(driverOptimized)driverPath=await upload(`${uid}/profile/driver-photo-${stamp}.jpg`,driverOptimized);
      if(tankerOptimized)tankerPath=await upload(`${uid}/tanker/tanker-photo-${stamp}.jpg`,tankerOptimized);
      const {error}=await window.sahreejSupabase.rpc('save_my_driver_media',{p_driver_photo_path:driverPath,p_tanker_photo_path:tankerPath});if(error)throw error;
      if(typeof toast==='function')toast('Photos saved');await loadVehicleMedia();
    }catch(e){console.error('driver media save',e);if(typeof toast==='function')toast(e.message||'Could not save photos');}finally{if(btn){btn.disabled=false;btn.textContent='Save photos';}}
  };

  window.openDriverAccountPanel=function(type){if(type==='vehicle')return loadVehicleMedia();if(typeof previousOpen==='function')return previousOpen(type);};ensureStyles();
})();
