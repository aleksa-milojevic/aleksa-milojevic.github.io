/* The Explorer's planar example and persistent growth chart. */
(() => {
  'use strict';
  const NS='http://www.w3.org/2000/svg',clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
  const lerp=(a,b,t)=>a.map((v,j)=>v+(b[j]-v)*t);
  const planarPoints=[[300,55],[70,420],[530,420],[300,275],[215,245],[300,365],[385,245],[275,165],[215,355],[385,355]];
  const insertions=[[3,[0,1,2]],[4,[0,1,3]],[5,[1,2,3]],[6,[2,0,3]],[7,[3,0,4]],[8,[3,1,5]],[9,[2,3,5]]];
  function geometry(){
    let faces=[[0,1,2]];
    for(const [vertex,target] of insertions){
      const index=faces.findIndex(face=>target.every(v=>face.includes(v))),[a,b,c]=faces[index];
      faces.splice(index,1,[a,b,vertex],[b,c,vertex],[c,a,vertex]);
    }
    const edges=new Map();
    for(const face of faces)for(let i=0;i<3;i++){const pair=[face[i],face[(i+1)%3]].sort((a,b)=>a-b);edges.set(pair.join('-'),pair);}
    const pairs=[...edges.values()],points=planarPoints.map(p=>[...p]);
    const curves=pairs.map(([u,v])=>{const controls=[points[u],lerp(points[u],points[v],1/3),lerp(points[u],points[v],2/3),points[v]];return {u,v,points:controls,d:'M'+points[u]+' L'+points[v]};});
    return {points,pairs,curves,faces};
  }
  function mountPlanar(root,options={}){
    const doc=root.ownerDocument,svg=doc.createElementNS(NS,'svg');root.dataset.noEdit='';root.classList.add('pgraph-drawing');
    svg.setAttribute('viewBox','0 0 600 470');svg.setAttribute('role','img');svg.setAttribute('aria-label','A planar graph with ten vertices and twenty-four edges.');
    const title=doc.createElementNS(NS,'title');title.textContent='Ten vertices and twenty-four edges, with no crossings.';svg.append(title);
    const desc=doc.createElementNS(NS,'desc');desc.textContent='Seven vertices are spread inside a large triangle. All fifteen bounded faces are triangles. Edges meet only at their endpoints.';svg.append(desc);
    const current=geometry();
    current.curves.forEach((curve,i)=>{const path=doc.createElementNS(NS,'path');path.setAttribute('class','pgraph-edge');path.dataset.pgraphEdge=String(i);path.dataset.endpoints=curve.u+'-'+curve.v;path.setAttribute('d',curve.d);svg.append(path);});
    current.points.forEach((p,i)=>{const circle=doc.createElementNS(NS,'circle');circle.setAttribute('r','5.2');circle.setAttribute('class','pgraph-vertex');circle.dataset.pgraphVertex=String(i);circle.setAttribute('cx',p[0]);circle.setAttribute('cy',p[1]);svg.append(circle);});
    root.append(svg);root.dataset.pgraphStage='planar';
    return {getState:()=>current,destroy(){svg.remove();}};
  }
  function plotGeometry(width=650,height=240,history=false,n=10,comparison=history?1:0,takeaway=0){
    const blend=clamp(comparison),end=30+170*blend,maxY=90+6910*blend;
    const niceStep=value=>{const power=10**Math.floor(Math.log10(value));return [1,2,5,10].find(factor=>factor*power>=value)*power;};
    const xStep=niceStep(end/4),yStep=niceStep(maxY/4);
    const xValues=blend<.001?[3,10,20]:[3,...Array.from({length:Math.ceil(end/xStep)},(_,i)=>(i+1)*xStep).filter(value=>value<end)];
    const yValues=blend<.001?[0,30,60]:Array.from({length:Math.ceil(maxY/yStep)},(_,i)=>i*yStep).filter(value=>value<maxY);
    const x=n=>40+(n-3)/(end-3)*(width-62),y=value=>height-36-value/maxY*(height-58);
    const values=Array.from({length:81},(_,i)=>3+(end-3)*i/80);
    return {width,height,history:blend>0,comparison:blend,takeaway:clamp(takeaway),maxN:end,maxY,axes:{left:40,right:width-22,top:22,bottom:height-36},
      line:values.map(n=>[x(n),y(3*n-6)]),
      upper:blend>0?values.map(n=>[x(n),y(n*Math.log(n)**2)]):null,
      illustrative:takeaway>0?values.map(n=>[x(n),y(10*n)]):null,
      point:blend<.001?[x(n),y(3*n-6)]:null,n,bound:3*n-6,
      xTicks:xValues.map(value=>({value,x:x(value)})),
      yTicks:yValues.map(value=>({value,y:y(value)}))};
  }
  let plotCount=0;
  function mountPlot(root,options={},history=false){
    const doc=root.ownerDocument,win=doc.defaultView,svg=doc.createElementNS(NS,'svg');
    const arrowId='pgraph-axis-arrow-'+(++plotCount);
    root.dataset.noEdit='';svg.setAttribute('role','img');svg.setAttribute('aria-label',history?'Linear growth compared with n times the square of log n.':'The upper bound three n minus six as the number of vertices changes.');
    root.append(svg);let current,n=10,input=null,readout=null,comparison=history?1:0,takeaway=0;
    const context=doc.createElement('div');context.className='pgraph-chart-context';root.prepend(context);
    const controls=history?null:doc.createElement('div');
    if(controls){
      controls.className='pgraph-plot-controls';
      const label=doc.createElement('label');label.textContent='Number of vertices';
      input=doc.createElement('input');input.type='range';input.min='3';input.max='30';input.step='1';input.value='10';input.setAttribute('aria-label','Number of vertices n');
      readout=doc.createElement('output');readout.setAttribute('aria-live','polite');
      label.append(input);controls.append(label,readout);root.append(controls);
    }
    function render(){
      const width=Math.max(280,options.width||root.getBoundingClientRect().width||root.clientWidth||Math.min(650,win.innerWidth-44));
      current=plotGeometry(width,options.height||(width<=450?220:Math.min(420,Math.max(300,width*.62),win.innerHeight*.58)),history,n,comparison,takeaway);
      svg.setAttribute('viewBox','0 0 '+current.width+' '+current.height);svg.replaceChildren();
      svg.setAttribute('aria-label',takeaway>0?'Growth comparison: three n minus six, ten n, and n times the square of log n.':comparison>0?'The planar bound three n minus six compared with n times the square of log n.':'The upper bound three n minus six as the number of vertices changes.');
      const node=(tag,attrs,text,parent=svg)=>{const el=doc.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,value);if(text!==undefined)el.textContent=text;parent.append(el);return el;};
      const path=points=>'M'+points.join(' L'),a=current.axes,p=current.point;
      const math=(tex,x,y,align='left',kind='')=>{
        const width=150,fo=node('foreignObject',{x:align==='right'?x-width:align==='center'?x-width/2:x,y:y-14,width,height:30,class:'pgraph-math-object'});
        const div=doc.createElementNS('http://www.w3.org/1999/xhtml','div');div.className='pgraph-math '+kind;div.style.textAlign=align;
        if(win.katex)win.katex.render(tex,div,{output:'html',throwOnError:false,trust:false,strict:'ignore'});else div.textContent=tex;
        fo.append(div);return fo;
      };
      const defs=node('defs',{}),marker=node('marker',{id:arrowId,viewBox:'0 0 8 8',refX:7,refY:4,markerWidth:6,markerHeight:6,orient:'auto'},undefined,defs);
      node('path',{d:'M1 1 L7 4 L1 7 Z',fill:'#8c928c'},undefined,marker);
      const clip=node('clipPath',{id:arrowId+'-clip'},undefined,defs);node('rect',{x:a.left,y:a.top,width:a.right-a.left,height:a.bottom-a.top},undefined,clip);
      const curves=node('g',{'clip-path':'url(#'+arrowId+'-clip)'});
      if(current.upper){const gap=node('g',{opacity:comparison},undefined,curves);node('path',{d:path(current.upper)+' L'+[...current.line].reverse().join(' L')+' Z',class:'pgraph-plot-gap'},undefined,gap);}
      node('path',{d:'M'+a.left+','+a.bottom+' V'+a.top,class:'pgraph-plot-axis','marker-end':'url(#'+arrowId+')'});
      node('path',{d:'M'+a.left+','+a.bottom+' H'+a.right,class:'pgraph-plot-axis','marker-end':'url(#'+arrowId+')'});
      for(const tick of current.xTicks){node('path',{d:'M'+tick.x+','+a.bottom+' v4',class:'pgraph-plot-axis'});math(String(tick.value),tick.x,a.bottom+21,'center');}
      for(const tick of current.yTicks){node('path',{d:'M'+(a.left-4)+','+tick.y+' h4',class:'pgraph-plot-axis'});math(String(tick.value),a.left-9,tick.y+7,'right');}
      if(p)node('path',{d:'M'+a.left+','+p[1]+' H'+p[0]+' V'+a.bottom,class:'pgraph-plot-guide'});
      node('path',{d:path(current.line),class:'pgraph-plot-line'},undefined,curves);
      if(current.upper){node('path',{d:path(current.upper),class:'pgraph-plot-upper',opacity:comparison},undefined,curves);math('n(\\log n)^2',a.right-4,Math.max(a.top+14,current.upper.at(-1)[1]-22),'right','pgraph-math-upper').setAttribute('opacity',comparison);}
      if(current.illustrative){node('path',{d:path(current.illustrative),class:'pgraph-plot-illustrative',opacity:takeaway},undefined,curves);math('10n',a.right-4,current.illustrative.at(-1)[1]+16,'right','pgraph-math-illustrative').setAttribute('opacity',takeaway);}
      if(p)node('circle',{cx:p[0],cy:p[1],r:3.8,class:'pgraph-plot-point','data-planar-point':n+','+current.bound});
      math('3n-6',a.right-4,current.line.at(-1)[1]-10,'right','pgraph-math-line');
      math('n',a.right+7,a.bottom+34,'right','pgraph-math-axis');math('m',a.left,12,'left','pgraph-math-axis');
      context.textContent=comparison<.001?'Planar graphs':'Growth comparison';
      if(controls){const inactive=comparison>=.001;controls.classList.toggle('is-inactive',inactive);controls.setAttribute('aria-hidden',String(inactive));input.disabled=inactive;}
      if(readout){
        readout.replaceChildren();readout.setAttribute('aria-label','n = '+n+'; at most '+current.bound+' edges');
        const first=doc.createElement('span'),second=doc.createElement('span');
        if(win.katex){win.katex.render('n='+n,first,{output:'html',throwOnError:false});win.katex.render('3\\cdot'+n+'-6='+current.bound,second,{output:'html',throwOnError:false});}else{first.textContent='n='+n;second.textContent=String(current.bound);}
        readout.append(first,doc.createTextNode('; at most '),second,doc.createTextNode(' edges'));
      }
      root.dataset.growthComparison=String(comparison);
      root.dataset.growthTakeaway=String(takeaway);
    }
    if(input)input.addEventListener('input',()=>{n=Math.max(3,Math.min(30,Number(input.value)));render();});
    render();win.addEventListener('resize',render);doc.addEventListener('quasiplanar-route-change',render);
    const observer=win.ResizeObserver?new win.ResizeObserver(render):null;observer?.observe(root);
    return {getState:()=>current,setComparison(value){comparison=clamp(value);render();},setTakeaway(value){takeaway=clamp(value);render();},destroy(){win.removeEventListener('resize',render);doc.removeEventListener('quasiplanar-route-change',render);observer?.disconnect();svg.remove();controls?.remove();context.remove();}};
  }
  function mountBoundPlot(root,options={}){return mountPlot(root,options,false);}
  function mountHistoryPlot(root,options={}){return mountPlot(root,options,true);}
  function mountSharedPlot(root,options={}){
    const chart=mountPlot(root,options,false),doc=root.ownerDocument,win=doc.defaultView;
    const container=options.container||root.closest('.growth-story'),step=container?.querySelector('[data-growth-stage="comparison"]'),takeawayStep=container?.querySelector('[data-growth-stage="takeaway"]');
    let queued=false,dead=false;
    function update(){queued=false;if(dead||options.autoScroll===false||doc.documentElement.hasAttribute('data-route-pending')||doc.documentElement.dataset.route!=='curious'||!step)return;
      const rect=step.getBoundingClientRect();let p=clamp((win.innerHeight-rect.top)/Math.max(1,rect.height));
      if(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches)p=p>=.5?1:0;
      chart.setComparison(p*p*(3-2*p));
      if(takeawayStep){const last=takeawayStep.getBoundingClientRect();let t=clamp((win.innerHeight-last.top)/Math.max(1,last.height));if(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches)t=t>=.5?1:0;chart.setTakeaway(t*t*(3-2*t));}
    }
    function schedule(){if(!queued&&!dead){queued=true;win.requestAnimationFrame(update);}}
    function reset(){chart.setTakeaway(0);chart.setComparison(0);schedule();}
    win.addEventListener('scroll',schedule,{passive:true});win.addEventListener('resize',schedule);doc.addEventListener('quasiplanar-route-change',reset);schedule();
    return {...chart,destroy(){dead=true;win.removeEventListener('scroll',schedule);win.removeEventListener('resize',schedule);doc.removeEventListener('quasiplanar-route-change',reset);chart.destroy();}};
  }
  window.QuasiplanarExplorerScenes={geometry,mountPlanar,plotGeometry,mountBoundPlot,mountHistoryPlot,mountSharedPlot};
})();
