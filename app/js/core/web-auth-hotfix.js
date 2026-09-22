(function(){
  'use strict';
  try{
    if(window.Capacitor && typeof window.Capacitor.isNativePlatform==='function' && window.Capacitor.isNativePlatform()) return;
  }catch(_){}

  const S=window.SahreejCore=window.SahreejCore||{};

  function esc(v){
    return String(v??'').replace(/[&<>'"]/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    }[ch]));
  }

  function normalize(value){
    if(typeof S.normalizeLebanonPhone==='function') return S.normalizeLebanonPhone(value);
    let d=String(value||'').replace(/\D/g,'');
    if(d.startsWith('961')) d=d.slice(3);
    if(d.length===7) d='0'+d;
    return d;
  }

  function closeSafeAuth(){
    document.getElementById('sahreejWebAuthSafe')?.remove();
    document.documentElement.style.overflow='';
    document.body.style.overflow='';
  }

  function renderSafeAuth(mode){
    closeSafeAuth();
    const selected=mode || (localStorage.getItem('sahreejCustomerRegistered')==='1'?'signin':'signup');
    const signup=selected==='signup';

    const root=document.createElement('div');
    root.id='sahreejWebAuthSafe';
    root.innerHTML=`
      <style>
        #sahreejWebAuthSafe{position:fixed;inset:0;z-index:2147483000;background:#f7f8fa;overflow:auto;-webkit-overflow-scrolling:touch;font-family:Inter,system-ui,-apple-system,Arial,sans-serif;color:#111}
        #sahreejWebAuthSafe *{box-sizing:border-box}
        #sahreejWebAuthSafe .wa-head{height:68px;background:#fff;border-bottom:1px solid #e8e8e8;display:flex;align-items:center;gap:12px;padding:0 18px;position:sticky;top:0;z-index:2}
        #sahreejWebAuthSafe .wa-back{border:0;background:transparent;color:#1680f5;font-size:36px;line-height:1;padding:0;width:36px}
        #sahreejWebAuthSafe .wa-head strong{font-size:22px}
        #sahreejWebAuthSafe .wa-body{max-width:480px;margin:0 auto;padding:24px 18px 42px}
        #sahreejWebAuthSafe .wa-tabs{display:grid;grid-template-columns:1fr 1fr;background:#ececec;border-radius:16px;padding:4px;margin-bottom:28px}
        #sahreejWebAuthSafe .wa-tab{border:0;background:transparent;border-radius:12px;padding:13px;font-weight:850;font-size:17px;color:#1680f5}
        #sahreejWebAuthSafe .wa-tab.active{background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.08)}
        #sahreejWebAuthSafe h1{font-size:32px;line-height:1.08;margin:0 0 10px}
        #sahreejWebAuthSafe .wa-copy{color:#6b6b6b;font-size:17px;line-height:1.45;margin-bottom:24px}
        #sahreejWebAuthSafe label{display:block;font-size:13px;font-weight:900;margin:16px 2px 7px;color:#444}
        #sahreejWebAuthSafe input{width:100%;border:0;background:#eee;border-radius:16px;padding:16px 18px;font:inherit;font-size:18px;outline:none}
        #sahreejWebAuthSafe .wa-phone{display:grid;grid-template-columns:92px 1fr;gap:10px}
        #sahreejWebAuthSafe .wa-prefix{background:#eee;border-radius:16px;display:grid;place-items:center;font-size:20px;font-weight:900}
        #sahreejWebAuthSafe .wa-submit{width:100%;border:0;border-radius:16px;background:#111;color:#fff;padding:17px;margin-top:24px;font-size:18px;font-weight:900}
        #sahreejWebAuthSafe .wa-submit:disabled{opacity:.55}
        #sahreejWebAuthSafe .wa-error{display:none;margin-top:14px;padding:12px 14px;border-radius:12px;background:#fff0f0;color:#a31919;font-size:14px}
      </style>
      <div class="wa-head">
        <button class="wa-back" type="button" aria-label="Close">‹</button>
        <strong>Account access</strong>
      </div>
      <div class="wa-body">
        <div class="wa-tabs">
          <button class="wa-tab ${selected==='signin'?'active':''}" data-mode="signin" type="button">Sign in</button>
          <button class="wa-tab ${selected==='signup'?'active':''}" data-mode="signup" type="button">Sign up</button>
        </div>
        ${signup?'<label for="sahreejSafeName">Name</label><input id="sahreejSafeName" autocomplete="name" placeholder="Your name" value="'+esc(localStorage.getItem('sahreejCustomerName')||'')+'">':''}
        <h1>${signup?'Create your account':'Welcome back'}</h1>
        <div class="wa-copy">${signup?'Create a Sahreej customer account with your name and mobile number.':'Enter your Lebanese mobile number to sign in.'}</div>
        <label for="sahreejSafePhone">Mobile number</label>
        <div class="wa-phone">
          <div class="wa-prefix">+961</div>
          <input id="sahreejSafePhone" inputmode="tel" autocomplete="tel" placeholder="71 234 567" value="${esc(localStorage.getItem('sahreejCustomerPhone')||'')}">
        </div>
        <div class="wa-error" id="sahreejSafeError"></div>
        <button class="wa-submit" id="sahreejSafeSubmit" type="button">${signup?'Create account':'Sign in'}</button>
      </div>`;

    document.body.appendChild(root);
    document.documentElement.style.overflow='hidden';
    document.body.style.overflow='hidden';
    root.querySelector('.wa-back').onclick=closeSafeAuth;
    root.querySelectorAll('.wa-tab').forEach(btn=>btn.onclick=()=>renderSafeAuth(btn.dataset.mode));
    root.querySelector('#sahreejSafeSubmit').onclick=()=>submitSafeAuth(selected);
  }

  async function submitSafeAuth(mode){
    const root=document.getElementById('sahreejWebAuthSafe');
    if(!root)return;
    const btn=root.querySelector('#sahreejSafeSubmit');
    const err=root.querySelector('#sahreejSafeError');
    const raw=String(root.querySelector('#sahreejSafePhone')?.value||'').trim();
    const phone=normalize(raw);
    const name=String(root.querySelector('#sahreejSafeName')?.value||'').trim();
    err.style.display='none';

    if(phone.length<7){
      err.textContent='Enter a valid Lebanese mobile number';
      err.style.display='block';
      return;
    }
    if(mode==='signup' && !name){
      err.textContent='Enter your name';
      err.style.display='block';
      return;
    }
    if(typeof S.establishDevCustomerSession!=='function'){
      err.textContent='Sign-in service is still loading. Try again.';
      err.style.display='block';
      return;
    }

    btn.disabled=true;
    btn.textContent=mode==='signup'?'Creating…':'Signing in…';
    try{
      const result=await S.establishDevCustomerSession(raw,name||null);
      const account=result?.account||{};
      const finalName=account.full_name||name||localStorage.getItem('sahreejCustomerName')||'Customer';
      localStorage.setItem('sahreejCustomerName',finalName);
      localStorage.setItem('sahreejCustomerPhone',account.phone||phone);
      localStorage.setItem('sahreejCustomerRegistered','1');
      localStorage.setItem('sahreejCustomerSignedIn','1');
      localStorage.removeItem('sahreejDriverSession');
      localStorage.setItem('sahreejRole','customer');
      try{window.applySignedInState?.();}catch(_){}
      closeSafeAuth();
      try{window.showCustomerTab?.('account');}catch(_){}
      try{window.toast?.(mode==='signup'?'Account created':'Signed in');}catch(_){}
      setTimeout(()=>S.restoreCustomerState?.(),250);
    }catch(e){
      console.error('Safe web auth failed',e);
      err.textContent=e?.message||'Could not sign in';
      err.style.display='block';
      btn.disabled=false;
      btn.textContent=mode==='signup'?'Create account':'Sign in';
    }
  }

  window.openAuth=()=>renderSafeAuth();
  window.handleCustomerAuthButton=function(){
    if(localStorage.getItem('sahreejCustomerSignedIn')==='1'){
      if(typeof window.openCustomerProfilePanel==='function') return window.openCustomerProfilePanel();
    }
    renderSafeAuth();
  };
  window.SahreejWebAuth={open:renderSafeAuth,close:closeSafeAuth};
})();