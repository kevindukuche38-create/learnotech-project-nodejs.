(function(){
var root=document.getElementById('product-root');if(!root)return;
var WA='263783060943';
var img=new URLSearchParams(location.search).get('img')||'';
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=x;return e}
function link(href,text,c){var a=el('a',c,text);a.href=href;return a}
function url(p){return 'product.html?img='+encodeURIComponent(p.image_url)}
function money(p){var n=Number(p.price);return(p.price!==null&&p.price!==''&&p.price!==undefined&&isFinite(n))?((p.currency||'')+' '+n.toFixed(2)).trim():null}
function render(p,all){
document.title=(p.name||'Product')+' | LEARNOTECH SOLUTIONS';
var cr=el('div','pd-crumbs');cr.appendChild(link('accessories.html','Shop'));cr.appendChild(el('span','','/'));cr.appendChild(link('accessories.html',p.category||'Accessories'));cr.appendChild(el('span','','/'));cr.appendChild(document.createTextNode(p.name||''));root.appendChild(cr);
var grid=el('div','pd-grid');
var left=el('div','pd-card');var main=el('div','pd-main');
var th=el('div','pd-thumbs');var b=el('button','on');b.type='button';var ti=el('img');ti.src=p.image_url;ti.alt='';b.appendChild(ti);th.appendChild(b);
var ph=el('div','pd-photo');var pi=el('img');pi.src=p.image_url;pi.alt=p.name||'Product';ph.appendChild(pi);
main.appendChild(th);main.appendChild(ph);left.appendChild(main);
var info=el('div','pd-info');info.appendChild(el('h1','',p.name||'Product'));info.appendChild(link('accessories.html',p.category||'Accessories','pd-cat'));
if(p.description)info.appendChild(el('p','pd-desc',p.description));
info.appendChild(el('div','pd-line'));
var st=el('div','');st.appendChild(el('span','pd-stock','Ask availability'));st.appendChild(el('span','pd-tag','Chiredzi'));info.appendChild(st);
info.appendChild(el('div','pd-line'));
var ul=el('ul','pd-list');['Collect in store in Chiredzi','Message us on WhatsApp to confirm the model','We explain what fits your phone'].forEach(function(t){ul.appendChild(el('li','',t))});info.appendChild(ul);
left.appendChild(info);
var buy=el('div','pd-card pd-buy');var pr=money(p);buy.appendChild(el('p','pd-price',pr||'Ask for price'));
var msg='Hello, I want to ask about: '+(p.name||'a product')+' ('+location.href+')';
var wa=link('https://wa.me/'+WA+'?text='+encodeURIComponent(msg),'Order on WhatsApp','pd-btn pd-wa');wa.target='_blank';wa.rel='noopener noreferrer';buy.appendChild(wa);
buy.appendChild(link('accessories.html','Back to shop','pd-btn pd-back'));
grid.appendChild(left);grid.appendChild(buy);root.appendChild(grid);
var rel=all.filter(function(x){return x.image_url!==p.image_url&&x.category===p.category}).slice(0,12);
if(rel.length){var more=el('div','pd-more');more.appendChild(el('h2','','More in '+(p.category||'Accessories')));var row=el('div','pd-row');
rel.forEach(function(x){var a=link(url(x),'','pd-mini');var i=el('img');i.src=x.image_url;i.alt='';i.loading='lazy';a.appendChild(i);a.appendChild(el('div','',x.name||''));row.appendChild(a)});more.appendChild(row);root.appendChild(more)}
}
fetch('/api/accessories',{headers:{Accept:'application/json'}}).then(function(r){return r.json()}).then(function(items){
if(!Array.isArray(items))items=[];
var p=items.filter(function(i){return i.image_url===img})[0]||items[0];
if(!p){root.appendChild(el('p','pd-empty','Product not found.'));return}
render(p,items)}).catch(function(){root.appendChild(el('p','pd-empty','Could not load the product.'))});
})();