/* Route-aware section overview. Reuses the article's existing navigation. */
(() => {
  'use strict';
  const root=document.documentElement;
  const nav=document.querySelector('.chapter-nav');
  if(!nav)return;
  const plans={
    curious:['question','planar-graphs','what-we-knew','orders','sequences','stability','charging'],
    mathematician:['question','triangulate','charging-overview','orders','sequences','stability','charging'],
    expert:['question','triangulate','charging-overview','orders','sequences','assignment','triangle-count','successor-changes']
  };
  const labels={
    question:'The question','planar-graphs':'Planar graphs','what-we-knew':'What we knew',
    'charging-overview':'Charging scheme',
    triangulate:'The playing field',orders:'Two orders',sequences:'Increasing chains',
    stability:'Changing heads',charging:'The count',
    assignment:'Assigning curves','triangle-count':'The count','successor-changes':'Changing successors'
  };
  const spacer=document.createElement('div');
  spacer.className='section-nav-spacer';
  spacer.setAttribute('aria-hidden','true');
  nav.before(spacer);
  nav.classList.add('section-nav-bar');
  nav.setAttribute('aria-label','Sections in this reading route');
  const caption=document.createElement('span');
  caption.className='section-nav-label';
  caption.textContent='Sections';
  caption.setAttribute('aria-hidden','true');
  const links=document.createElement('div');
  links.className='section-nav-links';
  nav.replaceChildren(caption,links);
  let sections=[],signature='',queued=false,current=null;

  function heading(section){return section.querySelector('.section-number');}
  function cleanLabel(section){
    if(section.dataset.sectionLabel)return section.dataset.sectionLabel;
    const h=heading(section);
    if(!h)return labels[section.id]||section.id;
    const copy=h.cloneNode(true);
    copy.querySelectorAll('.katex-mathml,annotation').forEach(node=>node.remove());
    copy.querySelectorAll('[data-for],[data-nav-routes]').forEach(node=>{
      for(const scope of [node.dataset.for,node.dataset.navRoutes])if(scope&&!scope.split(/\s+/).includes(root.dataset.route)){node.remove();break;}
    });
    return copy.textContent.replace(/^\s*\d+\s*\/\s*/,'').replace(/\s+/g,' ').trim()||labels[section.id]||section.id;
  }
  // The generated prefix is separate from editable prose. Later route changes
  // alter its attribute only, preserving all authored heading markup.
  for(const id of new Set(Object.values(plans).flat())){
    const section=document.getElementById(id),h=section&&heading(section);
    if(!h)continue;
    const walker=document.createTreeWalker(h,NodeFilter.SHOW_TEXT);
    let text;
    while((text=walker.nextNode())){
      if(!text.nodeValue.trim())continue;
      text.nodeValue=text.nodeValue.replace(/^\s*\d+\s*\/\s*/,'');
      break;
    }
    h.classList.add('section-nav-heading');
  }
  function scopeAllows(section,route){
    if(section.hidden)return false;
    const scope=section.dataset.navRoutes;
    return !scope||scope.split(/\s+/).includes(route);
  }
  function measure(){
    const header=document.querySelector('.masthead');
    const headerHeight=header?header.getBoundingClientRect().height:0;
    const navHeight=nav.hidden?0:nav.getBoundingClientRect().height;
    root.style.setProperty('--section-header-height',headerHeight+'px');
    root.style.setProperty('--section-nav-height',navHeight+'px');
    root.style.setProperty('--section-sticky-top',(headerHeight+navHeight+16)+'px');
  }
  function mark(id){
    current=id;
    for(const link of links.querySelectorAll('a')){
      if(link.dataset.section===id)link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    }
  }
  function track(){
    queued=false;
    if(nav.hidden)return;
    const threshold=parseFloat(root.style.getPropertyValue('--section-sticky-top'))||130;
    let active=null;
    for(const section of sections){
      if(section.getBoundingClientRect().top<=threshold+20)active=section.id;
      else break;
    }
    if(active!==current)mark(active);
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(track);}}
  function refresh(){
    const route=root.dataset.route;
    const pending=root.hasAttribute('data-route-pending')||!plans[route];
    nav.hidden=spacer.hidden=pending;
    root.classList.toggle('section-nav-enabled',!pending);
    if(pending){sections=[];mark(null);return;}
    sections=plans[route].map(id=>document.getElementById(id)).filter(section=>section&&scopeAllows(section,route));
    const entries=sections.map((section,index)=>({section,number:String(index+1).padStart(2,'0'),label:cleanLabel(section)}));
    for(const entry of entries){
      const h=heading(entry.section);
      if(h){
        h.dataset.sectionNumber=entry.number;
        h.setAttribute('aria-label',entry.number+' / '+entry.label);
      }
    }
    const next=route+'|'+entries.map(entry=>entry.section.id+':'+entry.label).join('|');
    if(next!==signature){
      signature=next;
      const fragment=document.createDocumentFragment();
      for(const entry of entries){
        const link=document.createElement('a'),number=document.createElement('span');
        link.href='#'+entry.section.id;link.dataset.section=entry.section.id;
        link.setAttribute('aria-label','Section '+entry.number+': '+entry.label);
        number.className='section-nav-number';number.textContent=entry.number;
        number.setAttribute('aria-hidden','true');
        link.append(number,document.createTextNode(entry.label));fragment.append(link);
      }
      links.replaceChildren(fragment);mark(null);
    }
    measure();schedule();
  }
  nav.addEventListener('click',event=>{
    const link=event.target.closest('a[data-section]');
    if(!link)return;
    if(root.hasAttribute('data-route-pending')||document.querySelector('#text-edit-dialog[open],#draft-reset-dialog[open]')){
      event.preventDefault();return;
    }
    // Native anchor navigation keeps keyboard activation and history intact.
    mark(link.dataset.section);
  });
  document.addEventListener('quasiplanar-route-change',refresh);
  document.addEventListener('quasiplanar-text-change',refresh);
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',()=>{measure();schedule();},{passive:true});
  if(typeof ResizeObserver==='function'){
    const observer=new ResizeObserver(()=>{measure();schedule();});
    observer.observe(nav);
    const header=document.querySelector('.masthead');if(header)observer.observe(header);
  }
  new MutationObserver(refresh).observe(root,{attributes:true,attributeFilter:['data-route','data-route-pending']});
  refresh();
  window.QuasiplanarSectionNav={
    refresh,
    sections:()=>sections.map(section=>section.id),
    current:()=>current
  };
})();
