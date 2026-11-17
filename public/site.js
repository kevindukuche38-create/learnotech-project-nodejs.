(function(){
var h='';
try{var x=new XMLHttpRequest();x.open('GET','header.html',false);x.send();if(x.status===200)h=x.responseText}catch(e){}
if(!h)return;
document.write(h);
var p=location.pathname.split('/').pop()||'index.html';
var s=document.createElement('style');
s.textContent='#site-header .nav>a[aria-current="page"]{color:#0057b8;border-bottom-color:#0057b8}';
document.head.appendChild(s);
document.addEventListener('DOMContentLoaded',function(){
document.querySelectorAll('#site-header .nav > a').forEach(function(a){
if((a.getAttribute('href')||'').split('#')[0]===p)a.setAttribute('aria-current','page')})});
})();