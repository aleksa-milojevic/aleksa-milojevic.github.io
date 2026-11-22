/* A geometric preview of the later counting rule; the assignments are illustrative. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const V = {a:[0,0],b:[8,0],c:[4.1,6.4],d:[1.861,1.681],e:[2.085,.844],f:[2.834,1.483],g:[3.609,3.574],h:[4.113,4.366],i:[4.424,3.489],j:[5.22,1.441],l:[5.887,.938],m:[6.076,1.868]};
  const faceIds = ['abe','acd','ade','bcm','bel','blm','cdg','cgh','chm','dfg','efj','ejl','fgi','fij','him','ijm'];
  const holes = ['dfe','ghi','jml'];
  const edgeIds = ['ab','bc','ca','df','fe','ed','gh','hi','ig','jm','ml','lj','ad','ae','dg','dc','ej','el','eb','fg','fi','fj','gc','ch','cm','hm','ij','im','lb','mb'];
  const curveData = [
    {id:'A',points:[[2.34,1.32],[3.4,.55],[4.7,.6],[5.72,1.48]],destination:{type:'face',id:'efj'}},
    {id:'B',points:[[5.72,1.48],[6,2.6],[5.2,3.9],[4.07,3.89]],destination:{type:'face',id:'efj'}},
    {id:'C',points:[[4.07,3.89],[2.9,3.7],[2,2.6],[2.34,1.32]],destination:{type:'face',id:'him'}}
  ];
  const clamp = p => Math.max(0,Math.min(1,Number(p)||0));
  const ease = (p,a,b) => {const t=clamp((p-a)/(b-a));return t*t*(3-2*t);};
  const mix = (a,b,t) => a.map((p,i)=>p.map((n,j)=>n+(b[i][j]-n)*t));
  const centroid = points => points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length],[0,0]);
  const bounds = points => {
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    return {x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2,w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
  };
  const fit = (points,x,y,w,h) => {
    const box=bounds(points),s=Math.min(w/Math.max(box.w,.001),h/Math.max(box.h,.001));
    return points.map(p=>[x+(p[0]-box.x)*s,y-(p[1]-box.y)*s]);
  };
  const cubic = points => 'M'+points[0].join(',')+' C'+points.slice(1).map(p=>p.join(',')).join(' ');
  const at = (points,t) => [0,1].map(j=>(1-t)**3*points[0][j]+3*(1-t)**2*t*points[1][j]+3*(1-t)*t*t*points[2][j]+t**3*points[3][j]);

  function createGeometry() {
    return {
      vertices:Object.fromEntries(Object.entries(V).map(([key,p])=>[key,[...p]])),
      faces:faceIds.map(id=>({id,vertices:[...id],points:[...id].map(k=>[...V[k]])})),
      holes:holes.map(id=>[...id]), edges:edgeIds.map(id=>[...id]),
      curves:curveData.map(c=>({...c,points:c.points.map(p=>[...p]),destination:{...c.destination}}))
    };
  }

  function scene(progress,width=1000,height=560) {
    const p=clamp(progress),w=Math.max(280,Number(width)||1000),h=Math.max(180,Number(height)||560),mobile=w<600;
    const geometry=createGeometry(),s=Math.min(w*.72/8,(h-70)/6.4);
    const project=point=>[w/2+(point[0]-4)*s,h/2-(point[1]-3.2)*s];
    const selectedIds=['abe','acd','efj','fij','him','ijm'];
    const selection=ease(p,.04,.18),separate=ease(p,.18,.76),gallery=ease(p,.22,.8),reveal=ease(p,.8,1);
    const stackX=w*.24,rowH=(h-80)/6,triangleW=Math.min(mobile?94:140,w*.25,rowH*1.8),triangleH=Math.min(48,rowH*.66);
    const faces=geometry.faces.map(face=>{
      const index=selectedIds.indexOf(face.id),selected=index>=0,assembled=face.points.map(project);
      let target=assembled;
      if(selected){
        const y=45+rowH*(index+.5);
        target=[[stackX-triangleW/2,y+triangleH/2],[stackX+triangleW/2,y+triangleH/2],[stackX,y-triangleH/2]];
        const [a,b,c]=assembled;
        if((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0)target.reverse();
      }
      return {id:face.id,points:mix(assembled,target,separate),target,selected,
        opacity:selected?1:1-ease(p,.16,.6),highlight:selected&&selection>0};
    });
    const galleryX=w*.78,galleryW=mobile?w*.25:w*.2,galleryH=Math.min(105,(h-100)/3*.66);
    const curves=geometry.curves.map((curve,index)=>{
      const y=h*(.2+.32*index),target=fit(curve.points,galleryX,y,galleryW,galleryH);
      const points=mix(curve.points.map(project),target,gallery);
      return {id:curve.id,points,target,d:cubic(points),label:[Math.min(w-23,galleryX+galleryW/2+8),y+4],destination:curve.destination};
    });
    const arrows=curves.map(curve=>{
      const from=at(curve.target,.5),destination=faces.find(face=>face.id===curve.destination.id);
      const to=centroid(destination.target);to[1]+=curve.id==='A'?-5:curve.id==='B'?5:0;
      const gap=Math.max(35,(from[0]-to[0])*.45);
      return {curve:curve.id,from,to,opacity:reveal,
        d:'M'+from+' C'+(from[0]-gap)+','+from[1]+' '+(to[0]+gap*.6)+','+to[1]+' '+to};
    });
    return {width:w,height:h,progress:p,phase:p<.18?'select':p<.8?'separate':'assign',faces,curves,arrows,selectedIds,
      outer:['a','b','c'].map(k=>project(V[k])),holes:geometry.holes.map(ids=>ids.map(k=>project(V[k]))),
      outlineOpacity:1-ease(p,.12,.5),holeOpacity:1-ease(p,.16,.55),
      labelOpacity:ease(p,.6,.85),reveal,selection,
      headings:[{x:stackX,y:24,text:'The triangles'},{x:galleryX,y:24,text:'The curves'}]};
  }
  let mountCount=0;
  function mount(root,options={}) {
    if (!root || root.namespaceURI===NS) throw new TypeError('A container element is required.');
    const doc=root.ownerDocument,win=doc.defaultView,id='cmap-'+(++mountCount);
    const container=options.container||root.closest('#charging-overview')||root.closest('section')||root.parentElement;
    const reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)');
    const autoplay=options.autoplay!==false,duration=Math.max(100,Number(options.duration)||3000);
    const triggerDistance=Math.max(60,Math.min(120,Number(options.triggerDistance)||80));
    let progress=reduced?.matches?1:0,current,disposed=false,queued=false,checkFrame=null,animationFrame=null,playing=false,played=Boolean(reduced?.matches),armedY=null,lastScrollY=Number(win.scrollY)||0;
    const node = (tag,attrs={},parent) => {
      const element=doc.createElementNS(NS,tag);
      for (const [key,value] of Object.entries(attrs)) element.setAttribute(key,String(value));
      if (parent) parent.append(element);
      return element;
    };
    root.dataset.noEdit='';root.classList.add('cmap-drawing');
    const svg=node('svg',{role:'img','aria-labelledby':id+'-title '+id+'-desc',preserveAspectRatio:'xMidYMid meet'});
    node('title',{id:id+'-title'},svg).textContent='The triangles separate, and three original curves are assigned places.';
    node('desc',{id:id+'-desc'},svg).textContent='Six highlighted triangles separate from the mesh into a vertical stack. Three orange curves move to the right. Schematic teal arrows associate A and B with the same triangle and C with another. The assignment rule is explained later.';
    const defs=node('defs',{},svg);
    const marker=node('marker',{id:id+'-arrow',viewBox:'0 0 8 8',refX:7,refY:4,markerWidth:6,markerHeight:6,orient:'auto'},defs);
    node('path',{d:'M1 1 L7 4 L1 7',fill:'none',stroke:'#276b7c','stroke-width':1.2},marker);
    const facesGroup=node('g',{class:'cmap-faces'},svg);
    const faceNodes=faceIds.map(face=>node('polygon',{'data-cmap-face':face,class:'cmap-face'},facesGroup));
    const outer=node('polygon',{class:'cmap-outer'},svg);
    const arrowGroup=node('g',{class:'cmap-assignments'},svg);
    const arrowNodes=curveData.map(curve=>node('path',{'data-cmap-arrow':curve.id,class:'cmap-arrow','marker-end':`url(#${id}-arrow)`},arrowGroup));
    const curveGroup=node('g',{class:'cmap-curves'},svg);
    const curveNodes=curveData.map(curve=>node('path',{'data-cmap-curve':curve.id,class:'cmap-curve'},curveGroup));
    const holeGroup=node('g',{class:'cmap-holes'},svg);
    const holeNodes=holes.map(hole=>node('polygon',{'data-cmap-hole':hole,class:'cmap-hole'},holeGroup));
    const labelGroup=node('g',{class:'cmap-labels'},svg);
    const curveLabels=curveData.map(curve=>{
      const label=node('foreignObject',{width:24,height:36,class:'cmap-curve-label','aria-hidden':'true'},labelGroup);
      const html=doc.createElementNS('http://www.w3.org/1999/xhtml','div');
      if(win.katex)win.katex.render(curve.id,html,{output:'html',throwOnError:false,trust:false});else html.textContent=curve.id;
      label.append(html);return label;
    });
    const headings=[0,1].map(()=>node('text',{'text-anchor':'middle',class:'cmap-heading'},labelGroup));
    root.append(svg);

    function headerTop(){
      const declared=parseFloat(doc.documentElement.style.getPropertyValue('--section-sticky-top'));
      if(Number.isFinite(declared)&&declared>0)return declared;
      const header=doc.querySelector('.masthead')?.getBoundingClientRect();
      const nav=doc.querySelector('.section-nav-bar:not([hidden])')?.getBoundingClientRect();
      return Math.max(header?.bottom||0,nav?.bottom||0)+16;
    }

    function render() {
      const measured=options.width||root.getBoundingClientRect().width||root.clientWidth||Math.min(1000,win.innerWidth-40);
      const width=Math.max(280,measured),available=Math.max(180,win.innerHeight-headerTop()-100);
      const desired=options.height||(width<600?Math.max(320,Math.min(460,win.innerHeight*.55)):Math.max(360,Math.min(560,win.innerHeight-180)));
      const height=Math.min(desired,available);
      current=scene(progress,width,height);
      svg.setAttribute('viewBox',`0 0 ${current.width} ${current.height}`);
      svg.style.aspectRatio=`${current.width} / ${current.height}`;
      const points = list => list.map(point=>point.join(',')).join(' ');
      current.faces.forEach((face,index)=>{
        faceNodes[index].setAttribute('points',points(face.points));
        faceNodes[index].setAttribute('fill',face.highlight?'#e3ede8':'#eeeee5');
        faceNodes[index].setAttribute('stroke',face.highlight?'#276b7c':'#c9ccc1');
        faceNodes[index].setAttribute('opacity',face.opacity);
        faceNodes[index].dataset.cmapSelected=String(face.selected);
      });
      current.curves.forEach((curve,index)=>{
        curveNodes[index].setAttribute('d',curve.d);
        curveLabels[index].setAttribute('x',curve.label[0]-2);curveLabels[index].setAttribute('y',curve.label[1]-20);
      });
      outer.setAttribute('points',points(current.outer));outer.setAttribute('opacity',current.outlineOpacity);
      current.holes.forEach((hole,index)=>holeNodes[index].setAttribute('points',points(hole)));
      holeGroup.setAttribute('opacity',current.holeOpacity);
      current.arrows.forEach((arrow,index)=>{arrowNodes[index].setAttribute('d',arrow.d);arrowNodes[index].setAttribute('opacity',arrow.opacity);});
      current.headings.forEach((heading,index)=>{headings[index].textContent=heading.text;headings[index].setAttribute('x',heading.x);headings[index].setAttribute('y',heading.y);});
      labelGroup.setAttribute('opacity',current.labelOpacity);
      root.dataset.cmapPhase=current.phase;
    }
    function stop(){
      if(animationFrame!==null)win.cancelAnimationFrame?.(animationFrame);
      animationFrame=null;playing=false;
    }
    function paint(value){progress=reduced?.matches?1:clamp(value);render();}
    function setProgress(value){if(disposed)return;stop();played=true;paint(value);}
    function visible(){
      if(doc.documentElement.hasAttribute('data-route-pending'))return false;
      const route=doc.documentElement.dataset.route;
      for(let element=root;element;element=element.parentElement){
        if(element.hidden)return false;
        for(const scope of [element.dataset.for,element.dataset.navRoutes])if(scope&&route&&!scope.split(/\s+/).includes(route))return false;
      }
      return true;
    }
    function entirePictureVisible(){
      const r=svg.getBoundingClientRect();
      if(r.width<=0||r.height<=0)return false;
      const bottom=Number.isFinite(r.bottom)?r.bottom:r.top+r.height;
      const left=Number.isFinite(r.left)?r.left:0,right=Number.isFinite(r.right)?r.right:left+r.width;
      return r.top>=headerTop()-.5&&bottom<=win.innerHeight+.5&&left>=-.5&&right<=win.innerWidth+.5;
    }
    function play(){
      if(disposed)return;
      stop();played=true;
      if(reduced?.matches){paint(1);return;}
      playing=true;paint(0);let started=null;
      function frame(time){
        if(disposed)return;
        if(!visible()){stop();played=false;paint(0);return;}
        if(started===null)started=time;
        const value=clamp((time-started)/duration);
        if(value>=1){playing=false;animationFrame=null;}
        paint(value);
        if(playing)animationFrame=win.requestAnimationFrame(frame);
      }
      animationFrame=win.requestAnimationFrame(frame);
    }
    function check(){
      queued=false;checkFrame=null;
      if(disposed)return;
      const y=Number(win.scrollY)||0,down=y>lastScrollY,up=y<lastScrollY;lastScrollY=y;
      if(!autoplay||!visible())return;
      if(up&&container.getBoundingClientRect().top>=win.innerHeight){
        stop();played=Boolean(reduced?.matches);armedY=null;paint(0);return;
      }
      if(reduced?.matches||playing||played)return;
      if(current.height>win.innerHeight-headerTop()-80)render();
      if(armedY===null){if(entirePictureVisible())armedY=y;return;}
      if(down&&y-armedY>=triggerDistance)play();
    }
    function schedule(){if(!queued&&!disposed){queued=true;checkFrame=win.requestAnimationFrame(check);}}
    function resize(){if(!disposed){render();schedule();}}
    function reset(){if(disposed)return;stop();played=Boolean(reduced?.matches);armedY=null;lastScrollY=Number(win.scrollY)||0;paint(0);schedule();}
    function motionChange(){if(reduced.matches){stop();played=true;paint(1);}else reset();}
    // First show the whole picture, then wait for a short downward scroll.
    win.addEventListener('scroll',schedule,{passive:true});
    win.addEventListener('resize',resize);
    doc.addEventListener('quasiplanar-route-change',reset);
    const observer=win.ResizeObserver?new win.ResizeObserver(resize):null;observer?.observe(root);
    const intersection=win.IntersectionObserver?new win.IntersectionObserver(schedule,{threshold:[0,1]}):null;intersection?.observe(svg);
    reduced?.addEventListener?.('change',motionChange);
    render();schedule();
    return {setProgress,play,resize,reset,getState:()=>({progress,playing,played,armedY,triggerDistance,width:current.width,height:current.height,phase:current.phase,scene:current}),
      destroy(){
        if(disposed)return;stop();disposed=true;
        if(checkFrame!==null)win.cancelAnimationFrame?.(checkFrame);
        win.removeEventListener('scroll',schedule);win.removeEventListener('resize',resize);
        doc.removeEventListener('quasiplanar-route-change',reset);
        observer?.disconnect();intersection?.disconnect();
        reduced?.removeEventListener?.('change',motionChange);svg.remove();
      }};
  }
  window.QuasiplanarChargeMap={mount,createGeometry,scene};
})();
