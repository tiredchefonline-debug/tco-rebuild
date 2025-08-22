<!-- /assets/js/head-include.js -->
(function(){
  fetch('/partials/head-core.html', {cache:'no-cache'})
    .then(r => r.text())
    .then(html => {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      // Insert at the top of <head> so page-specific tags placed after this win
      const head = document.head;
      [...tmp.childNodes].forEach(n => head.insertBefore(n, head.firstChild));
    })
    .catch(()=>{});
})();
