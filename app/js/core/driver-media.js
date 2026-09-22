(function(){
  'use strict';
  const S=window.SahreejCore||{};
  const q=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const bucket='driver-documents';

  function addStyles(){
    if(q('sahreejDriverMediaStyles')) return;
    const s=document.createElement('style');
    s.id='sahreejDriverMediaStyles';
    s.textContent=`
      .driver-media-card{margin:14px 0;padding:14px;border:1px solid #e7e7e7;border-radius:20px;background:#fff}
      .driver-media-title{display:block;font-size:15px;font-weight:900;margin-bottom:4px}
      .driver-media-copy{display:block;font-size:13px;color:#666;margin-bottom:12px}
      .driver-media-upload{display:grid;grid-template-columns:86px 1fr;gap:12px;align-items:center;margin-top:10px}
      .driver-media-preview{width:86px;height:74px;border-radius:16px;background:#f2f3f4;overflow:hidden;display:grid;place-items:center;color:#777;font-size:12px;text-align:center}
      .driver-media-preview.round{width:74px;height:74px;border-radius:50%}
      .driver-media-preview img{width:100%;height:100%;object-fit:cover}
      .driver-media-upload input{width:100%;font-size:13px}
      .driver-public-card{margin:14px 0;border:1px solid #e5e5e5;border-radius:22px;background:#fff;overflow:hidden}
      .driver-public-tanker{height:142px;background:#f1f3f4;display:grid;place-items:center;overflow:hidden}
      .driver-public-tanker img{width:100%;height:100%;object-fit:cover}
      .driver-public-body{padding:14px}
      .driver-public-head{display:flex;gap:12px;align-items:center}
      .driver-public-avatar{width:62px;height:62px;border-radius:50%;background:#eceff1;overflow:hidden;display:grid;place-items:center;font-weight:900;font-size:22px;flex:none}
      .driver-public-avatar img{width:100%;height:100%;object-fit:cover}
      .driver-public-copy{min-width:0;flex:1}
      .driver-public-copy strong{display:block;font-size:19px}
      .driver-public-copy span{display:block;margin-top:3px;color:#666;font-size:14px}
      .driver-public-capacity{font-weight:950;white-space:nowrap}
      .driver-public-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
      .driver-public-actions a,.driver-public-actions button{min-height:48px;border:0;border-radius:14px;background:#f1f1f1;color:#111;font-weight:900;font-size:15px;text-decoration:none;display:grid;place-items:center}
      .driver-own-media{display:grid;grid-template-columns:88px 1fr;gap:12px;align-items:center;margin:14px 0}
      .driver-own-media img{width:88px;height:76px;border-radius:14px;object-fit:cover;background:#f2f2f2}
    `;
    document.head.appendChild(s);
  }

  function preview(inputId,hostId,round){
    const input=q(inputId),host=q(hostId); if(!input||!host) return;
    const f=input.files?.[0];
    if(!f){host.innerHTML=round?'Driver photo':'Tanker photo';return;}
    const u=URL.createObjectURL(f);
    host.innerHTML=`<img src="${u}" alt="Preview">`;
  }

  function injectRegistrationMedia(){
    const screen=q('driverOnboarding');
    if(!screen||q('driverMediaRegistrationCard')) return;
    const docs=screen.querySelector('.driver-docs-card');
    if(!docs) return;
    const card=document.createElement('div');
    card.id='driverMediaRegistrationCard';
    card.className='driver-media-card';
    card.innerHTML=`
      <span class="driver-media-title">Driver & tanker photos</span>
      <span class="driver-media-copy">Required for approval. Customers will see these photos only after you accept their delivery.</span>
      <label class="fieldlabel">Driver photo</label>
      <div class="driver-media-upload">
        <div class="driver-media-preview round" id="driverPhotoPreview">Driver photo</div>
        <input id="driverPhoto" type="file" accept="image/*" capture="user">
      </div>
      <label class="fieldlabel">Tanker photo</label>
      <div class="driver-media-upload">
        <div class="driver-media-preview" id="tankerPhotoPreview">Tanker photo</div>
        <input id="tankerPhoto" type="file" accept="image/*" capture="environment">
      </div>`;
    docs.parentNode.insertBefore(card,docs);
    q('driverPhoto')?.addEventListener('change',()=>preview('driverPhoto','driverPhotoPreview',true));
    q('tankerPhoto')?.addEventListener('change',()=>preview('tankerPhoto','tankerPhotoPreview',false));
    const copy=docs.querySelector('.muted');
    if(copy) copy.textContent='Upload clear photos or PDFs. These files are stored securely with your driver application.';
  }

  function ext(file){
    const n=String(file?.name||'');
    const x=n.includes('.')?n.split('.').pop().toLowerCase():'';
    if(x && /^[a-z0-9]{2,5}$/.test(x)) return x;
    const m=String(file?.type||'').split('/')[1]||'jpg';
    return m==='jpeg'?'jpg':m.replace(/[^a-z0-9]/g,'')||'jpg';
  }

  async function ensureRegistrationSession(){
    const client=window.sahreejSupabase;
    if(!client) throw new Error('Backend unavailable');
    let session=(await client.auth.getSession()).data?.session;
    if(session?.user?.id) return session;
    const r=await client.auth.signInAnonymously();
    if(r.error) throw r.error;
    session=r.data?.session;
    if(!session?.user?.id) throw new Error('Could not create driver registration session');
    return session;
  }

  async function upload(uid,file,path){
    const {error}=await window.sahreejSupabase.storage.from(bucket).upload(path,file,{upsert:true,contentType:file.type||undefined});
    if(error) throw error;
    return path;
  }

  async function saveDocument(uid,type,inputId){
    const file=q(inputId)?.files?.[0];
    if(!file) throw new Error('Upload all required documents');
    const path=`${uid}/documents/${type}-${Date.now()}.${ext(file)}`;
    await upload(uid,file,path);
    const {error}=await window.sahreejSupabase.rpc('save_my_driver_document',{
      p_type:type,
      p_storage_path:path,
      p_original_filename:file.name,
      p_mime_type:file.type||'application/octet-stream'
    });
    if(error) throw error;
  }

  async function registerDriver(){
    const name=q('driverName')?.value?.trim()||'';
    const phone=q('driverRegPhone')?.value?.trim()||'';
    const plate=q('driverPlate')?.value?.trim()||'';
    const capacity=Number(String(q('driverCapacity')?.value||'').replace(/[^0-9]/g,''));
    const driverPhoto=q('driverPhoto')?.files?.[0];
    const tankerPhoto=q('tankerPhoto')?.files?.[0];
    const docs=[['id','driverDocId'],['driving_license','driverDocLicense'],['vehicle_registration','driverDocVehicle'],['insurance','driverDocInsurance']];
    if(!name||!phone||!plate||!capacity) throw new Error('Complete the required driver and tanker details');
    if(!driverPhoto) throw new Error('Add a clear photo of the driver');
    if(!tankerPhoto) throw new Error('Add a clear photo of the tanker');
    for(const [,id] of docs) if(!q(id)?.files?.[0]) throw new Error('Upload all 4 required documents');

    const session=await ensureRegistrationSession();
    const uid=session.user.id;
    const client=window.sahreejSupabase;

    const {error:profileError}=await client.from('driver_profiles').upsert({
      user_id:uid,
      full_name:name,
      phone:phone.replace(/\s+/g,''),
      vehicle_plate:plate,
      tanker_capacity_l:capacity,
      status:'pending',
      approved_at:null,
      rejection_reason:null
    },{onConflict:'user_id'});
    if(profileError) throw profileError;

    const stamp=Date.now();
    const driverPhotoPath=await upload(uid,driverPhoto,`${uid}/profile/driver-photo-${stamp}.${ext(driverPhoto)}`);
    const tankerPhotoPath=await upload(uid,tankerPhoto,`${uid}/tanker/tanker-photo-${stamp}.${ext(tankerPhoto)}`);
    const {error:mediaError}=await client.from('driver_profiles').update({
      driver_photo_path:driverPhotoPath,
      tanker_photo_path:tankerPhotoPath
    }).eq('user_id',uid);
    if(mediaError) throw mediaError;

    for(const [type,id] of docs) await saveDocument(uid,type,id);

    localStorage.setItem('sahreejDriverProfile',JSON.stringify({name,phone,plate,capacity,status:'pending',driver_photo_path:driverPhotoPath,tanker_photo_path:tankerPhotoPath}));
    localStorage.setItem('sahreejDriver','1');
    localStorage.setItem('sahreejDriverSession','1');
    localStorage.setItem('sahreejRole','driver');
    localStorage.setItem('sahreejSupabaseUserId',uid);
    try{closeScreen('driverOnboarding')}catch(_){}
    if(typeof enterDriverMode==='function') enterDriverMode();
    if(typeof showDriverPage==='function') showDriverPage('driverAccountPage');
    setTimeout(()=>S.restoreDriverState?.(),100);
    if(typeof toast==='function') toast('Application submitted for approval');
  }

  window.submitDriverRegistration=async function(){
    const button=[...document.querySelectorAll('#driverOnboarding button')].find(b=>/submit registration/i.test(b.textContent||''));
    if(button){button.disabled=true;button.dataset.old=button.textContent;button.textContent='Submitting…';}
    try{return await registerDriver();}
    catch(e){console.error('Driver registration failed',e); if(typeof toast==='function') toast(e?.message||'Could not submit registration'); return false;}
    finally{if(button){button.disabled=false;button.textContent=button.dataset.old||'Submit registration';}}
  };

  async function signed(path){
    if(!path) return null;
    const {data,error}=await window.sahreejSupabase.storage.from(bucket).createSignedUrl(path,600);
    if(error) return null;
    return data?.signedUrl||null;
  }

  async function ownMedia(){
    try{
      const session=await S.requireSession();
      const {data,error}=await window.sahreejSupabase.from('driver_profiles')
        .select('full_name,driver_photo_path,tanker_photo_path,tanker_capacity_l,vehicle_plate,status')
        .eq('user_id',session.user.id).maybeSingle();
      if(error||!data) return null;
      const [driverUrl,tankerUrl]=await Promise.all([signed(data.driver_photo_path),signed(data.tanker_photo_path)]);
      return {...data,driverUrl,tankerUrl};
    }catch(_){return null;}
  }

  async function paintOwnMedia(){
    const d=await ownMedia(); if(!d) return;
    const avatar=q('driverAvatar');
    if(avatar && d.driverUrl){avatar.innerHTML=`<img src="${d.driverUrl}" alt="Driver" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;}
  }

  const oldEnter=window.enterDriverMode;
  if(typeof oldEnter==='function'){
    window.enterDriverMode=function(){const r=oldEnter.apply(this,arguments);setTimeout(paintOwnMedia,50);return r;};
  }

  const oldToggle=window.toggleDriverOnline;
  if(typeof oldToggle==='function'){
    window.toggleDriverOnline=async function(){
      const toggle=q('driverOnlineToggle');
      if(toggle?.checked){
        try{
          const d=await ownMedia();
          if(!d || String(d.status||'').toLowerCase()!=='approved') throw new Error('Your driver account must be approved before going online');
          if(!d.driver_photo_path||!d.tanker_photo_path) throw new Error('Add your driver and tanker photos before going online');
        }catch(e){if(toggle) toggle.checked=false;if(typeof toast==='function') toast(e.message);return;}
      }
      return oldToggle.apply(this,arguments);
    };
  }

  addStyles();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{injectRegistrationMedia();paintOwnMedia();});
  else {injectRegistrationMedia();paintOwnMedia();}
  window.addEventListener('load',()=>{setTimeout(injectRegistrationMedia,100);setTimeout(paintOwnMedia,400);});
})();
