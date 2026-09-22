
(function(){
  'use strict';
  const S = window.SahreejCore = window.SahreejCore || {};
  S.DRIVER_ACTIVE = ['assigned','driver_arrived','delivering'];
  S.CUSTOMER_ACTIVE = ['requested','searching','assigned','driver_arrived','delivering'];
  S.TERMINAL = ['delivered','cancelled_customer','cancelled_driver','cancelled_admin'];
  S.q = id => document.getElementById(id);
  S.sleep = ms => new Promise(r=>setTimeout(r,ms));

  S.runtimeError = function(message, detail){
    console.error('SAHREEJ', message, detail || '');
    let box = S.q('sahreejRuntimeError');
    if(!box){
      box = document.createElement('div');
      box.id = 'sahreejRuntimeError';
      box.style.cssText = 'display:none;margin:12px 16px;padding:12px 14px;border:1px solid #efb3b3;background:#fff6f6;border-radius:14px;color:#9d1b1b;font-size:13px;word-break:break-word';
      (S.q('app') || document.body).insertBefore(box, (S.q('app') || document.body).firstChild || null);
    }
    box.style.display='block';
    box.innerHTML='<strong>'+String(message||'Something went wrong')+'</strong>'+
      (detail?'<div style="margin-top:5px">'+String(detail)+'</div>':'');
    if(typeof toast==='function') toast(message||'Something went wrong');
  };

  S.clearRuntimeError = function(){
    const box=S.q('sahreejRuntimeError');
    if(box) box.style.display='none';
  };

  S.requireSession = async function(){
    if(typeof sahreejRequireRealSession==='function'){
      const ok=await sahreejRequireRealSession();
      if(!ok) throw new Error('Could not establish secure session');
    }
    const {data:{session},error}=await window.sahreejSupabase.auth.getSession();
    if(error) throw error;
    if(!session?.user?.id) throw new Error('No authenticated session');
    return session;
  };

  S.fetchOrder = async function(id){
    if(!id) return null;
    const {data,error}=await window.sahreejSupabase.from('orders').select('*').eq('id',id).maybeSingle();
    if(error) throw error;
    return data||null;
  };

  S.fetchMyDriverActive = async function(){
    const session=await S.requireSession();
    const {data,error}=await window.sahreejSupabase
      .from('orders').select('*')
      .eq('driver_id',session.user.id)
      .in('status',S.DRIVER_ACTIVE)
      .order('assigned_at',{ascending:false})
      .limit(1).maybeSingle();
    if(error) throw error;
    return data||null;
  };

  S.fetchMyCustomerActive = async function(){
    const session=await S.requireSession();
    const {data,error}=await window.sahreejSupabase
      .from('orders').select('*')
      .eq('customer_id',session.user.id)
      .in('status',S.CUSTOMER_ACTIVE)
      .order('requested_at',{ascending:false})
      .limit(1).maybeSingle();
    if(error) throw error;
    return data||null;
  };
})();
