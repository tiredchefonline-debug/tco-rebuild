
(function(){
  const FUNCTIONS_BASE = (document.querySelector('meta[name="functions-base"]')?.content || '').replace(/\/$/, '');
  async function callAudit(target){
    const first = '/.netlify/functions/audit?url=' + encodeURIComponent(target);
    const second = FUNCTIONS_BASE ? (FUNCTIONS_BASE + '/.netlify/functions/audit?url=' + encodeURIComponent(target)) : null;

    // try relative first
    let resp = await fetch(first).catch(()=>null);
    let text = '', ct = '';
    if(resp){
      ct = resp.headers.get('content-type') || '';
      text = await resp.text();
      if(!(resp.ok && ct.includes('application/json'))){
        // If HTML or not ok, fallback
        resp = null;
      }
    }
    if(!resp && second){
      const r2 = await fetch(second);
      const ct2 = r2.headers.get('content-type') || '';
      const t2 = await r2.text();
      if(!(r2.ok && ct2.includes('application/json'))){
        throw new Error((t2 && t2.slice(0,140)) || ('HTTP '+r2.status));
      }
      return JSON.parse(t2);
    }
    if(!resp) throw new Error('Function not reachable. Check DNS or FUNCTIONS_BASE meta.');
    return JSON.parse(text);
  }

  function $(sel){ return document.querySelector(sel); }
  function normalize(u){
    u = (u||'').trim().replace(/\s+/g,'');
    if(!u) return '';
    // Prepend protocol if missing
    if(!/^https?:\/\//i.test(u)) u = 'https://' + u.replace(/^\/+/,'');
    // If URL is still invalid, try appending .com when host has no dot
    try { new URL(u); }
    catch(e){
      const tmp = u.replace(/^https?:\/\//i,'');
      if(!tmp.includes('.')){
        u = 'https://' + tmp + '.com';
        try { new URL(u); } catch(e2){ return ''; }
      }else{
        return '';
      }
    }
    return u;
  }

  const input = $('#audit-url');
  const btn   = $('#audit-btn');
  const out   = $('#audit-result');
  if(!input || !btn || !out) return;

  async function run(){
    const target = normalize(input.value);
    if(!target){
      out.textContent = 'Please enter a valid URL like example.com or facebook.com';
      return;
    }
    out.textContent = 'Running audit…';
    btn.disabled = true;
    try{
      const data = await callAudit(target);
      if(!data.ok) throw new Error(data.error || 'Audit failed');
      const m = data.metrics || {};
      out.innerHTML = ''
        + '<div class="score">Performance score: <strong>' + (m.score ?? '-') + '</strong>/100</div>'
        + '<ul class="metrics">'
        +   '<li>FCP: ' + (m.fcp||'-') + '</li>'
        +   '<li>LCP: ' + (m.lcp||'-') + '</li>'
        +   '<li>CLS: ' + (m.cls||'-') + '</li>'
        +   '<li>TBT: ' + (m.tbt||'-') + '</li>'
        +   '<li>Speed Index: ' + (m.speedIndex||'-') + '</li>'
        + '</ul>';
    }catch(e){
      out.textContent = (e && e.message) ? e.message : "Couldn't reach that site. Please check the URL and try again.";
    }finally{
      btn.disabled = false;
    }
  }

  btn.addEventListener('click', run);
  input.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') run(); });
})();
