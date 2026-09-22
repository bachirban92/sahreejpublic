(function(){
  'use strict';
  const S=window.SahreejCore, q=S.q;

  function normalizeCoords(c){
    if(!c) return null;
    let lat,lng;
    if(Array.isArray(c)){lat=Number(c[0]);lng=Number(c[1]);}
    else {lat=Number(c.lat??c.latitude??c[0]);lng=Number(c.lng??c.lon??c.longitude??c[1]);}
    return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;
  }

  async function requestTanker(){
    const btn=q('requestBtn');
    if(btn?.disabled) return null;
    if(btn){btn.disabled=true;btn.dataset.oldText=btn.textContent;btn.textContent='Checking…';}
    try{
      await S.requireSession();
      const existing=await S.fetchMyCustomerActive().catch(()=>null);
      if(existing){
        localStorage.setItem('sahreejActiveServerOrderId',existing.id);
        await S.renderCustomerState(existing);
        S.startCustomerPoll(existing.id);
        if(typeof toast==='function') toast('Opening your active order');
        return existing.id;
      }

      const coords=normalizeCoords(window.sahreejDeliveryCoords);
      if(!coords) throw new Error('Set your delivery location first');
      const selected=document.querySelector('#selector .tanker.selected');
      const capacity=Number(window.selectedTankerCapacity||window.selectedCapacity||selected?.dataset?.capacity||String(selected?.dataset?.size||window.chosen?.size||'').replace(/[^\d]/g,''));
      if(!capacity) throw new Error('Choose a tanker size');
      const payment=(typeof getPayment==='function'?getPayment().label:'Cash on delivery');
      const addr=window.deliveryAddress||window.address||'Pinned location';
      if(btn) btn.textContent='Requesting…';

      const note=String(q('deliveryInstructions')?.value||'').trim();
      const {data,error}=await window.sahreejSupabase.rpc('create_dispatch_order_v2',{p_tanker_capacity_l:capacity,p_payment_method:payment,p_delivery_address:addr,p_delivery_latitude:coords.lat,p_delivery_longitude:coords.lng,p_delivery_instructions:note||null});
      if(error) throw error;
      const orderId=typeof data==='string'?data:(data?.order_id||data?.id||data);
      if(!orderId) throw new Error('Order was not created');
      const order=await S.fetchOrder(orderId);
      if(!order) throw new Error('Order was created but could not be loaded');
      localStorage.setItem('sahreejActiveServerOrderId',order.id);localStorage.removeItem('sahreejActiveOrder');window.sahreejActiveServerOrderId=order.id;
      if(q('deliveryInstructions'))q('deliveryInstructions').value='';
      try{closeScreen('confirm')}catch(_){ }
      await S.renderCustomerState(order);S.startCustomerPoll(order.id);
      if(typeof toast==='function') toast('Order placed · Searching for a driver');
      return order.id;
    }catch(e){S.runtimeError(e.message||'Could not place order');return null;}
    finally{if(btn){btn.disabled=false;btn.textContent=btn.dataset.oldText||'Request tanker';delete btn.dataset.oldText;}}
  }
  window.requestTanker=requestTanker;
  try{requestTanker=window.requestTanker}catch(_){}

  window.sahreejCustomerCancelActiveOrder=async function(){
    const btn=q('cancelCustomerOrderBtn');
    try{
      const order=await S.fetchMyCustomerActive();
      if(!order){localStorage.removeItem('sahreejActiveServerOrderId');if(typeof toast==='function')toast('No active order');return;}
      if(!['requested','searching','assigned','driver_arrived'].includes(order.status)){
        if(typeof toast==='function')toast('This delivery can no longer be cancelled from the app');
        return;
      }
      if(!window.confirm('Are you sure you want to cancel this order?')) return;
      if(btn){btn.disabled=true;btn.dataset.oldText=btn.textContent;btn.textContent='Cancelling…';}
      const {error}=await window.sahreejSupabase.rpc('customer_cancel_order',{p_order_id:order.id,p_reason:'Customer cancelled'});
      if(error) throw error;

      // Update immediately instead of waiting on a terminal-order read that may be delayed.
      clearInterval(window.v8CustomerPoll);
      const cancelled={...order,status:'cancelled_customer',cancellation_reason:'Customer cancelled',cancelled_at:new Date().toISOString()};
      await S.renderCustomerState(cancelled);
      localStorage.removeItem('sahreejActiveServerOrderId');window.sahreejActiveServerOrderId=null;
      S.refreshCustomerActivity?.();
      if(typeof toast==='function') toast('Order cancelled');
    }catch(e){S.runtimeError('Could not cancel request',e.message||String(e));}
    finally{if(btn){btn.disabled=false;btn.textContent=btn.dataset.oldText||'Cancel request';delete btn.dataset.oldText;}}
  };

  let retryDispatchInFlight=false;
  window.sahreejRetryDispatch=async function(){
    if(retryDispatchInFlight)return;
    const id=localStorage.getItem('sahreejActiveServerOrderId');if(!id){if(typeof toast==='function')toast('No order to retry');return}
    retryDispatchInFlight=true;
    const btn=[...document.querySelectorAll('#tracking button')].find(b=>/search again/i.test(b.textContent||''));
    if(btn){btn.disabled=true;btn.dataset.oldText=btn.textContent;btn.textContent='Searching…';}
    try{
      const {error}=await window.sahreejSupabase.rpc('retry_my_dispatch',{p_order_id:id});if(error)throw error;
      const fresh=await S.fetchOrder(id);await S.renderCustomerState(fresh);S.startCustomerPoll(id);
      if(typeof toast==='function')toast('Searching again for a tanker…');
    }catch(e){S.runtimeError('Could not retry search',e.message||String(e))}
    finally{
      retryDispatchInFlight=false;
      if(btn&&btn.isConnected){btn.disabled=false;btn.textContent=btn.dataset.oldText||'Search again';delete btn.dataset.oldText;}
    }
  };
})();
