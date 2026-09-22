self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
  let data = {};
  try{
    data = event.data ? event.data.json() : {};
  }catch(_){}

  const title = data.title || 'Sahreej';
  const options = {
    body:data.body || 'You have a new Sahreej update.',
    tag:data.tag || ('sahreej-' + (data.notificationId || Date.now())),
    renotify:true,
    data:{
      notificationId:data.notificationId || null,
      orderId:data.orderId || null,
      notificationType:data.notificationType || null,
      url:data.url || './'
    },
    icon:'assets/logo.svg',
    badge:'assets/logo.svg',
    requireInteraction:data.notificationType === 'driver_offer'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = data.url || './';

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    let client = windows.find(c => {
      try{ return new URL(c.url).origin === self.location.origin; }
      catch(_){ return false; }
    });

    if(client){
      try{
        if('navigate' in client) await client.navigate(target);
      }catch(_){}
      await client.focus();
      client.postMessage({
        type:'SAHREEJ_NOTIFICATION_CLICK',
        notificationId:data.notificationId || null,
        orderId:data.orderId || null,
        notificationType:data.notificationType || null
      });
      return;
    }

    await self.clients.openWindow(target);
  })());
});