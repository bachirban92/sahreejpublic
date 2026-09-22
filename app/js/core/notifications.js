(function(){
  'use strict';

  const S = window.SahreejCore = window.SahreejCore || {};
  const q = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const prefKey = 'sahreejNotificationsEnabled';
  const vapidPublicKey = 'BC0_uWCXZYBEvxXahqMZsWlESLUgdmTW3KTNuoCd7eIYFF9GdgnupNGegdVHrCR9Lf9P0CiAEkH4iQWML0cf24Y';
  const seen = new Set();

  let channel = null;
  let pollTimer = null;
  let currentUserId = null;

  function enabled(){ return localStorage.getItem(prefKey) === '1'; }
  function basicSupported(){ return 'Notification' in window && 'serviceWorker' in navigator; }
  function pushSupported(){ return basicSupported() && 'PushManager' in window; }
  function permission(){ return basicSupported() ? Notification.permission : 'unsupported'; }
  function isIos(){ return /iphone|ipad|ipod/i.test(navigator.userAgent || ''); }
  function isStandalone(){
    return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  }

  function urlBase64ToUint8Array(value){
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(ch => ch.charCodeAt(0)));
  }

  async function swRegistration(){
    if(!('serviceWorker' in navigator)) return null;
    try{
      const reg = await navigator.serviceWorker.register('sahreej-sw.js', {scope:'./'});
      await navigator.serviceWorker.ready;
      return reg;
    }catch(e){
      console.warn('notification service worker', e);
      return null;
    }
  }

  async function session(){
    const {data,error} = await window.sahreejSupabase.auth.getSession();
    if(error) throw error;
    return data?.session || null;
  }

  async function fetchNotifications(limit=30){
    const s = await session();
    if(!s?.user?.id) return [];
    const {data,error} = await window.sahreejSupabase
      .from('notification_events')
      .select('id,order_id,type,title,body,read_at,created_at')
      .eq('user_id',s.user.id)
      .order('created_at',{ascending:false})
      .limit(limit);
    if(error) throw error;
    return data || [];
  }

  async function markRead(id){
    if(!id) return;
    try{
      await window.sahreejSupabase.rpc('mark_my_notification_read',{p_notification_id:id});
    }catch(e){
      console.warn('mark notification read', e);
    }
  }

  async function openFromNotification(n){
    if(!n) return;
    await markRead(n.id || n.notificationId);

    const type = n.type || n.notificationType;
    const role = localStorage.getItem('sahreejRole');

    if(type === 'driver_offer' || role === 'driver' || localStorage.getItem('sahreejDriverSession') === '1'){
      try{
        if(typeof showDriverPage === 'function') showDriverPage('driverDashboard');
      }catch(_){}
      setTimeout(() => S.restoreDriverState?.(), 50);
      return;
    }

    const orderId = n.order_id || n.orderId;
    if(orderId){
      try{
        const order = await S.fetchOrder?.(orderId);
        if(order){
          localStorage.setItem('sahreejActiveServerOrderId', order.id);
          await S.renderCustomerState?.(order);
          S.startCustomerPoll?.(order.id);
          return;
        }
      }catch(e){
        console.warn('open notification order', e);
      }
    }

    if(typeof showCustomerTab === 'function') showCustomerTab('activity');
  }

  async function registerPushSubscription(sub){
    const json = sub?.toJSON?.() || {};
    const endpoint = json.endpoint || sub?.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if(!endpoint || !p256dh || !auth) throw new Error('Push subscription is incomplete');

    const {error} = await window.sahreejSupabase.rpc('upsert_my_push_subscription',{
      p_endpoint:endpoint,
      p_p256dh:p256dh,
      p_auth:auth,
      p_user_agent:navigator.userAgent || null
    });
    if(error) throw error;
  }

  async function ensurePushSubscription({create=false}={}){
    if(!pushSupported() || permission() !== 'granted' || !enabled()) return null;

    const reg = await swRegistration();
    if(!reg?.pushManager) return null;

    let sub = await reg.pushManager.getSubscription();
    if(!sub && create){
      sub = await reg.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:urlBase64ToUint8Array(vapidPublicKey)
      });
    }

    if(sub) await registerPushSubscription(sub);
    return sub;
  }

  async function removePushSubscription(){
    if(!('serviceWorker' in navigator)) return;
    try{
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager?.getSubscription?.();
      if(!sub) return;

      try{
        await window.sahreejSupabase.rpc('delete_my_push_subscription',{p_endpoint:sub.endpoint});
      }catch(e){
        console.warn('delete push subscription', e);
      }

      try{ await sub.unsubscribe(); }catch(e){ console.warn('unsubscribe push', e); }
    }catch(e){
      console.warn('remove push subscription', e);
    }
  }

  async function showSystemNotification(n){
    if(!basicSupported() || permission() !== 'granted' || !enabled()) return false;
    const reg = await swRegistration();
    if(!reg) return false;

    try{
      await reg.showNotification(n.title || 'Sahreej',{
        body:n.body || 'You have a new Sahreej update.',
        tag:'sahreej-' + (n.id || n.type || Date.now()),
        renotify:true,
        data:{
          notificationId:n.id,
          orderId:n.order_id,
          notificationType:n.type,
          type:n.type
        }
      });
      return true;
    }catch(e){
      console.warn('show notification', e);
      return false;
    }
  }

  async function handleNew(n,{system=true}={}){
    if(!n?.id || seen.has(n.id)) return;
    seen.add(n.id);

    if(system && document.hidden){
      const shown = await showSystemNotification(n);
      if(shown) return;
    }

    if(typeof toast === 'function'){
      toast((n.title ? n.title + ': ' : '') + (n.body || 'New Sahreej update'));
    }
  }

  function buttonStatus(){
    if(!basicSupported()) return 'Unavailable';
    if(isIos() && !isStandalone()) return 'Install app';
    if(permission() === 'granted' && enabled()) return 'On';
    if(permission() === 'denied') return 'Blocked';
    return 'Off';
  }

  function ensureAccountButtons(){
    const customer = q('account');
    if(customer && !q('customerNotificationsBtn')){
      const settings = [...customer.querySelectorAll('.accountbtn')].find(b => /settings/i.test(b.textContent || ''));
      const btn = document.createElement('button');
      btn.className = 'accountbtn';
      btn.id = 'customerNotificationsBtn';
      btn.innerHTML = '<span>Notifications <small id="customerNotificationState" class="muted"></small></span><b>›</b>';
      btn.onclick = () => openPanel();
      (settings?.parentNode || customer).insertBefore(btn, settings || null);
    }

    const driver = q('driverAccountPage');
    if(driver && !q('driverNotificationsBtn')){
      const support = [...driver.querySelectorAll('.accountbtn')].find(b => /help/i.test(b.textContent || ''));
      const btn = document.createElement('button');
      btn.className = 'accountbtn';
      btn.id = 'driverNotificationsBtn';
      btn.innerHTML = '<span>Notifications <small id="driverNotificationState" class="muted"></small></span><b>›</b>';
      btn.onclick = () => openPanel();
      (support?.parentNode || driver).insertBefore(btn, support || null);
    }

    const a = q('customerNotificationState');
    const b = q('driverNotificationState');
    const s = buttonStatus();
    if(a) a.textContent = '· ' + s;
    if(b) b.textContent = '· ' + s;
  }

  async function enableNotifications(){
    if(!basicSupported()){
      if(typeof toast === 'function') toast('Notifications are not supported on this browser');
      return;
    }

    if(isIos() && !isStandalone()){
      if(typeof toast === 'function') toast('Add Sahreej to your Home Screen first, then enable notifications from the app.');
      openPanel();
      return;
    }

    if(!pushSupported()){
      if(typeof toast === 'function') toast('Background push is not supported on this device');
      return;
    }

    try{
      await swRegistration();
      const result = await Notification.requestPermission();

      if(result === 'granted'){
        localStorage.setItem(prefKey,'1');
        await ensurePushSubscription({create:true});
        await subscribe();
        if(typeof toast === 'function') toast('Notifications enabled');
      }else{
        localStorage.removeItem(prefKey);
        if(typeof toast === 'function'){
          toast(result === 'denied'
            ? 'Notifications are blocked in browser settings'
            : 'Notifications were not enabled');
        }
      }

      ensureAccountButtons();
      openPanel();
    }catch(e){
      console.warn('enable notifications', e);
      if(typeof toast === 'function') toast(e.message || 'Could not enable notifications');
    }
  }

  async function disableNotifications(){
    localStorage.removeItem(prefKey);
    await removePushSubscription();
    ensureAccountButtons();
    openPanel();
  }

  async function openPanel(){
    const title = q('accountPanelTitle');
    const body = q('accountPanelBody');
    if(!title || !body) return;

    title.textContent = 'Notifications';
    try{ openScreen('accountPanel'); }
    catch(_){ q('accountPanel')?.classList.add('active'); }

    let rows = [];
    try{ rows = await fetchNotifications(20); }catch(_){}

    const p = permission();
    const needsInstall = isIos() && !isStandalone();
    const status = needsInstall
      ? 'Install Sahreej'
      : p === 'granted' && enabled()
        ? 'On'
        : p === 'denied'
          ? 'Blocked by browser'
          : basicSupported()
            ? 'Off'
            : 'Unavailable';

    let action = '';
    if(needsInstall){
      action = '<div class="card"><strong>Add Sahreej to your Home Screen</strong><span class="muted">On iPhone and iPad, background notifications are available from the installed Home Screen app. Open Sahreej in Safari, tap Share, then Add to Home Screen.</span></div>';
    }else if(p === 'granted' && enabled()){
      action = '<button class="secondary" onclick="SahreejNotifications.disable()">Turn off notifications</button>';
    }else if(p === 'denied'){
      action = '<div class="card"><strong>Notifications are blocked</strong><span class="muted">Allow notifications for Sahreej in your browser or device settings, then come back here.</span></div>';
    }else{
      action = '<button class="primary" onclick="SahreejNotifications.enable()">Enable notifications</button>';
    }

    const items = rows.map(n =>
      `<button class="customer-order-row" style="margin-bottom:10px" onclick='SahreejNotifications.open(${JSON.stringify({id:n.id,order_id:n.order_id,type:n.type}).replace(/'/g,"&#39;")})'>
        <div><strong>${esc(n.title)}</strong><span class="muted" style="display:block;margin-top:4px">${esc(n.body)}</span></div>
        <div class="row" style="margin-top:8px"><span class="muted">${new Date(n.created_at).toLocaleString()}</span><span class="status">${n.read_at ? 'READ' : 'NEW'}</span></div>
      </button>`
    ).join('');

    body.innerHTML = `
      <div class="card"><div class="row"><div><strong>Device notifications</strong><span class="muted" style="display:block;margin-top:4px">Get delivery and driver-request alerts while Sahreej is in the background.</span></div><span class="status">${esc(status)}</span></div></div>
      ${action}
      <h3 style="margin-top:22px">Recent alerts</h3>
      ${items || '<div class="card"><strong>No alerts yet</strong><span class="muted">Delivery updates and driver requests will appear here.</span></div>'}
    `;
  }

  async function subscribe(){
    const s = await session();
    const uid = s?.user?.id;
    if(!uid) return;

    currentUserId = uid;

    if(channel){
      try{ await window.sahreejSupabase.removeChannel(channel); }catch(_){}
    }

    channel = window.sahreejSupabase.channel('sahreej-notifications-' + uid)
      .on('postgres_changes',{
        event:'INSERT',
        schema:'public',
        table:'notification_events',
        filter:'user_id=eq.' + uid
      }, payload => {
        handleNew(payload.new,{system:true}).catch(() => {});
      })
      .subscribe();

    try{
      const initial = await fetchNotifications(50);
      initial.forEach(n => seen.add(n.id));
    }catch(_){}

    if(enabled() && permission() === 'granted'){
      ensurePushSubscription({create:false}).catch(e => console.warn('push sync', e));
    }

    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      try{
        const s2 = await session();
        if(!s2?.user?.id || s2.user.id !== currentUserId) return;
        const rows = await fetchNotifications(10);
        for(const n of rows.reverse()) await handleNew(n,{system:true});
      }catch(_){}
    },7000);
  }

  async function handleLaunchParams(){
    const params = new URLSearchParams(location.search);
    const id = params.get('notification_id');
    const orderId = params.get('order_id');
    const type = params.get('notification_type');
    if(!id && !orderId && !type) return;

    try{
      history.replaceState({},'',location.pathname + location.hash);
    }catch(_){}

    setTimeout(() => {
      openFromNotification({
        id,
        notificationId:id,
        order_id:orderId,
        orderId,
        type,
        notificationType:type
      }).catch(() => {});
    },500);
  }

  navigator.serviceWorker?.addEventListener('message', event => {
    const d = event.data;
    if(d?.type !== 'SAHREEJ_NOTIFICATION_CLICK') return;
    openFromNotification({
      id:d.notificationId,
      order_id:d.orderId,
      type:d.notificationType
    }).catch(() => {});
  });

  window.SahreejNotifications = {
    enable:enableNotifications,
    disable:disableNotifications,
    open:openFromNotification,
    panel:openPanel,
    subscribe
  };

  S.openNotificationsPanel = openPanel;

  window.addEventListener('load',() => {
    ensureAccountButtons();
    swRegistration().catch(() => {});
    setTimeout(() => subscribe().catch(() => {}),2200);
    handleLaunchParams().catch(() => {});
  });

  window.addEventListener('focus',() => {
    ensureAccountButtons();
    subscribe().catch(() => {});
  });
})();