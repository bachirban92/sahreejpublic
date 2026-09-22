(function(){
  'use strict';
  const S=window.SahreejCore;
  if(!S||typeof S.roadRoute!=='function'||S.__routeCacheInstalled) return;
  S.__routeCacheInstalled=true;

  const original=S.roadRoute.bind(S);
  const cache=new Map();
  const TTL=6000;

  function key(a,b){
    const f=n=>Number(n).toFixed(4);
    return `${f(a?.lat)},${f(a?.lng)}>${f(b?.lat)},${f(b?.lng)}`;
  }

  S.roadRoute=async function(from,to){
    const k=key(from,to);
    const now=Date.now();
    const hit=cache.get(k);
    if(hit && now-hit.at<TTL) return hit.value;
    if(hit?.pending) return hit.pending;

    const pending=original(from,to).then(value=>{
      cache.set(k,{at:Date.now(),value});
      return value;
    }).catch(err=>{
      cache.delete(k);
      throw err;
    });
    cache.set(k,{at:now,pending});
    return pending;
  };
})();
