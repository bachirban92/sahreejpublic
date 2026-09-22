(function(){
  'use strict';
  const S=window.SahreejCore;
  const q=S.q;
  const digits=v=>String(v||'').replace(/\D/g,'');

  function normalizePhone(value){
    let d=digits(value);
    if(d.startsWith('961')) d=d.slice(3);
    if(d.length===7) d='0'+d;
    return d;
  }
  S.normalizeLebanonPhone=normalizePhone;

  function devDriverCredential(phone){
    const local=normalizePhone(phone);
    if(local.length<7) throw new Error('Enter your registered mobile number');
    return { local };
  }

  async function currentDriverProfile(){
    const session=await S.requireSession();
    const {data,error}=await window.sahreejSupabase
      .from('driver_profiles')
      .select('user_id,full_name,phone,vehicle_plate,tanker_capacity_l,status,rating')
      .eq('user_id',session.user.id)
      .maybeSingle();
    if(error) throw error;
    return data||null;
  }
  S.currentDriverProfile=currentDriverProfile;

  async function establishDevDriverSession(phone){
    const c=devDriverCredential(phone);
    const client=window.sahreejSupabase;
    if(!client) throw new Error('Backend unavailable');

    // DEVELOPMENT ONLY: create a real Supabase anonymous auth session, then
    // claim the already-registered driver by phone via a protected RPC.
    // This avoids OTP, Twilio, fake email addresses and email rate limits.
    // Reuse an existing browser auth session when available. Repeatedly
    // signing out and immediately creating a new anonymous session can trigger
    // storage/session churn in mobile Safari.
    let session=(await client.auth.getSession()).data?.session || null;
    if(!session?.user?.id){
      const anon=await client.auth.signInAnonymously();
      if(anon.error){
        const msg=String(anon.error.message||'');
        if(/anonymous|disabled/i.test(msg)){
          throw new Error('Enable Anonymous Sign-Ins in Supabase Authentication settings for development login.');
        }
        throw anon.error;
      }
      session=anon.data?.session || (await client.auth.getSession()).data?.session;
    }
    if(!session?.user?.id) throw new Error('Could not establish driver session');

    // Move/attach the existing driver record for this phone to this authenticated
    // development session so all RLS policies and auth.uid() checks keep working.
    const {data:claim,error:claimError}=await client.rpc('dev_claim_driver_phone',{p_phone:c.local});
    if(claimError){
      if(String(claimError.message||'').includes('dev_claim_driver_phone')){
        throw new Error('Run the Sahreej V8.1 development-login SQL in Supabase first.');
      }
      throw claimError;
    }
    if(claim===false) throw new Error('No registered driver was found for that phone number');

    localStorage.setItem('sahreejSupabaseUserId',session.user.id);
    return session;
  }
  S.establishDevDriverSession=establishDevDriverSession;

  window.driverLogin=async function(){
    const button=[...document.querySelectorAll('#driverSignIn button')]
      .find(b=>(b.textContent||'').trim().toLowerCase()==='sign in');
    if(button){button.disabled=true;button.textContent='Signing in…'}
    try{
      const typed=q('driverPhone')?.value?.trim()||'';
      const entered=normalizePhone(typed);
      if(entered.length<7) throw new Error('Enter your registered mobile number');

      await establishDevDriverSession(typed);
      const profile=await currentDriverProfile();
      if(!profile) throw new Error('No registered driver was found for that phone number');
      if(normalizePhone(profile.phone)!==entered) throw new Error('That mobile number does not match this driver account');

      localStorage.setItem('sahreejDriverProfile',JSON.stringify({
        ...profile,
        name:profile.full_name,
        plate:profile.vehicle_plate,
        capacity:Number(profile.tanker_capacity_l||0)
      }));
      localStorage.setItem('sahreejDriver','1');
      localStorage.setItem('sahreejDriverSession','1');
      localStorage.setItem('sahreejRole','driver');
      localStorage.removeItem('sahreejCustomerSignedIn');

      try{closeScreen('auth')}catch(_){}
      if(typeof enterDriverMode==='function') enterDriverMode();
      if(typeof showDriverPage==='function') showDriverPage('driverDashboard');
      setTimeout(()=>S.restoreDriverState?.(),100);
      if(typeof toast==='function') toast('Signed in');
      return true;
    }catch(err){
      console.error('Driver sign in failed',err);
      if(typeof toast==='function') toast(err?.message||'Could not sign in');
      return false;
    }finally{
      if(button){button.disabled=false;button.textContent='Sign in'}
    }
  };

  window.openDriverEntry=async function(){
    openScreen('auth');
    if(typeof setAuthRole==='function') setAuthRole('driver');
    if(typeof setDriverAuthMode==='function') setDriverAuthMode('signin');
    const cached=(()=>{try{return JSON.parse(localStorage.getItem('sahreejDriverProfile')||'null')}catch(_){return null}})();
    if(q('driverPhone') && cached?.phone) q('driverPhone').value=cached.phone;
  };


  async function establishDevCustomerSession(phone, fullName){
    const local=normalizePhone(phone);
    if(local.length<7) throw new Error('Enter your mobile number');
    const client=window.sahreejSupabase;
    if(!client) throw new Error('Backend unavailable');

    // Reuse the current browser session instead of signOut -> signIn on every
    // login attempt. This is both faster and avoids a known-problematic auth
    // storage churn pattern on iPhone Safari.
    let session=(await client.auth.getSession()).data?.session || null;
    if(!session?.user?.id){
      const anon=await client.auth.signInAnonymously();
      if(anon.error){
        const msg=String(anon.error.message||'');
        if(/anonymous|disabled/i.test(msg)) throw new Error('Enable Anonymous Sign-Ins in Supabase Authentication settings for development login.');
        throw anon.error;
      }
      session=anon.data?.session || (await client.auth.getSession()).data?.session;
    }
    if(!session?.user?.id) throw new Error('Could not establish customer session');

    // This RPC is the single backend write for development customer auth.
    // It owns the phone mapping and receives the signup name directly. Keeping
    // profile creation here avoids a second overlapping ON CONFLICT write.
    const {data:claim,error}=await client.rpc('dev_claim_customer_phone',{
      p_phone: local,
      p_full_name: fullName || null
    });
    if(error){
      if(String(error.message||'').includes('dev_claim_customer_phone')){
        throw new Error('Run the Sahreej V8.5 customer phone-login SQL in Supabase first.');
      }
      throw error;
    }
    if(!claim) throw new Error('Could not open customer account');

    // Read the authoritative name back from profiles. `profiles` intentionally has
    // no phone column; phone remains owned by the development phone mapping RPC.
    const {data:profile,error:profileReadError}=await client
      .from('profiles')
      .select('full_name,role')
      .eq('id',session.user.id)
      .maybeSingle();
    if(profileReadError) throw profileReadError;

    localStorage.setItem('sahreejSupabaseUserId',session.user.id);
    return {session,account:{...(claim||{}),full_name:profile?.full_name||claim?.full_name||fullName||null}};
  }
  S.establishDevCustomerSession=establishDevCustomerSession;

  async function devCustomerLogin(mode){
    const phone=q('authPhone')?.value?.trim()||'';
    const normalized=normalizePhone(phone);
    if(normalized.length<7) throw new Error('Enter a valid Lebanese mobile number');
    const fullName=(q('authName')?.value?.trim()||localStorage.getItem('sahreejCustomerName')||'').trim();
    if(mode==='signup' && !fullName) throw new Error('Enter your name');

    const result=await establishDevCustomerSession(phone, fullName || null);
    const account=result.account || {};
    const name=account.full_name || fullName || localStorage.getItem('sahreejCustomerName') || 'Customer';
    const storedPhone=account.phone || normalized;

    localStorage.setItem('sahreejCustomerName',name);
    localStorage.setItem('sahreejCustomerPhone',storedPhone);
    localStorage.setItem('sahreejCustomerRegistered','1');
    localStorage.setItem('sahreejCustomerSignedIn','1');
    localStorage.removeItem('sahreejDriverSession');
    localStorage.setItem('sahreejRole','customer');
    if(typeof applySignedInState==='function') applySignedInState();
    try{closeScreen('auth')}catch(_){}
    if(typeof showCustomerTab==='function') showCustomerTab('home');
    else if(typeof showTab==='function') showTab('home');
    setTimeout(()=>S.restoreCustomerState?.(),100);
    if(typeof toast==='function') toast(mode==='signup'?'Account created':'Signed in');
    return true;
  }

  // V8.5: customer development auth is phone-only too. No localStorage-only
  // account check and no prototype OTP screen. The backend mapping preserves
  // the customer identity across browsers during development.
  window.sendDemoOtp=async function(){
    const mode=window.customerAuthMode||'signin';
    const button=[...document.querySelectorAll('#customerAuth button')]
      .find(b=>/sign in|create account|sign up|continue/i.test((b.textContent||'').trim()));
    if(button){button.disabled=true; const old=button.textContent; button.dataset.oldText=old; button.textContent=mode==='signup'?'Creating…':'Signing in…';}
    try{
      return await devCustomerLogin(mode);
    }catch(err){
      console.error('Customer phone login failed',err);
      if(typeof toast==='function') toast(err?.message||'Could not sign in');
      return false;
    }finally{
      if(button){button.disabled=false; button.textContent=button.dataset.oldText|| (mode==='signup'?'Create account':'Sign in'); delete button.dataset.oldText;}
    }
  };

  window.switchToCustomer=function(){
    if(typeof toast==='function') toast('Sign out first to use Sahreej as a customer.');
  };
})();
