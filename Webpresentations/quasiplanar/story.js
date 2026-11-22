/* Dependency-free diagrams and progressive enhancement for the proof article. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const P = {paper:'#f7f5ee',ink:'#252b2b',muted:'#686c65',line:'#d8d9ce',orange:'#bb4b2e',teal:'#276b7c',blue:'#6c647d',wash:'#eeeee5'};
  const integers = [4,2,1,7,5,3,9,8,6,10];
  const layerColors = [P.teal,P.teal,P.teal];
  const svg = (w,h,title,description,body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}"><title>${title}</title><desc>${description}</desc>${body}</svg>`;
  const text = (x,y,t,attrs='') => `<text x="${x}" y="${y}" ${attrs}>${t}</text>`;
  const mathText = (x,y,tex,attrs='',fallback=tex) => {
    const helper=window.QuasiplanarDiagramMath;
    if(helper?.svgLabel&&window.katex?.renderToString){
      const label=helper.svgLabel(x,y,String(tex),attrs);
      if(label.startsWith('<foreignObject'))return label;
    }
    return text(x,y,String(fallback),attrs);
  };
  const path = (d,stroke=P.ink,width=1.5,attrs='') => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${attrs}/>`;
  const circle = (x,y,r,fill=P.ink,attrs='') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${attrs}/>`;
  const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));

  // Reader routes alter explanatory depth while preserving the shared argument.
  const routeNames = {curious:'The Explorer',mathematician:'The Mathematician',expert:'The Expert'};
  const routeKeys = new Set(Object.keys(routeNames));
  const routeDialog = $('#route-dialog');
  const skipLink = $('.skip-link');
  if (skipLink) {
    skipLink.href = '#choose';
    skipLink.textContent = 'Skip to route choices';
  }
  let selectedRoute = null;
  function updateRouteStatus() {
    if (!selectedRoute) return;
    const title = $('#choose [data-route-choice="'+selectedRoute+'"] > strong');
    const name = title?.textContent.trim() || routeNames[selectedRoute];
    $('.route-status').textContent = `Your route: ${name}.`;
  }
  function chooseRoute(route,close=false) {
    if (!routeKeys.has(route)) return;
    document.documentElement.dataset.route = route;
    document.documentElement.removeAttribute('data-route-pending');
    selectedRoute = route;
    if (skipLink) {
      skipLink.href = '#story';
      skipLink.textContent = 'Skip to the argument';
    }
    $$('[data-route-choice]').forEach(b => {
      const on = b.dataset.routeChoice === route;
      b.setAttribute('aria-pressed',String(on));
    });
    updateRouteStatus();
    $('#proof-cleaning summary').firstChild.textContent=route==='mathematician'?'I want more details ':'I want to see a proof ';
    document.dispatchEvent(new CustomEvent('quasiplanar-route-change',{detail:{route}}));
    if (close && routeDialog.open) routeDialog.close();
    const trail=$('#route-trail');
    const beforeTrail=window.scrollY+trail.getBoundingClientRect().top-window.innerHeight;
    window.scrollTo({top:Math.max(0,beforeTrail),behavior:'instant'});
    requestAnimationFrame(updateScroll);
  }
  document.addEventListener('quasiplanar-text-change', updateRouteStatus);
  $$('[data-route-choice]').forEach(b=>b.addEventListener('click',()=>chooseRoute(b.dataset.routeChoice,true)));
  $$('.route-toggle').forEach(b=>b.addEventListener('click',()=>routeDialog.showModal()));
  routeDialog.addEventListener('click',e=>{if(e.target===routeDialog){const r=routeDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)routeDialog.close();}});
  $$('[data-branch]').forEach(button=>button.addEventListener('click',()=>{
    const branch = button.closest('.branch');
    $$('[data-branch]',branch).forEach(b=>{
      const active=b===button;
      b.setAttribute('aria-pressed',String(active));
      $('#'+b.getAttribute('aria-controls')).hidden=!active;
    });
    requestAnimationFrame(updateScroll);
  }));

  // Alternating endpoints give a crossing family, drawn as gently curved edges.
  function crossingFamilyGeometry(k=4) {
    const n=k*2;
    const angles=Array.from({length:n},(_,i)=>-Math.PI/2+i*2*Math.PI/n+.04*Math.sin(i*1.7));
    const points=angles.map(a=>[285+205*Math.cos(a),225+205*Math.sin(a)]);
    const curves=Array.from({length:k},(_,i)=>{
      const a=points[i],b=points[i+k],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
      const nx=-dy/length,ny=dx/length,amplitude=[51,-64,63,60][i%4];
      return {a,b,c1:[a[0]+dx*.32+nx*amplitude,a[1]+dy*.32+ny*amplitude],c2:[a[0]+dx*.68+nx*amplitude*.4,a[1]+dy*.68+ny*amplitude*.4]};
    });
    return {points,curves};
  }
  function renderCrossingFamily(k=4) {
    const {points,curves}=crossingFamilyGeometry(k);
    let body='';
    curves.forEach(c=>body+=path('M'+c.a+' C'+c.c1+' '+c.c2+' '+c.b,P.orange,2.1));
    points.forEach(([x,y])=>body+=circle(x,y,3.5));
    $('#crossing-scene').innerHTML=svg(570,445,'The forbidden family for k = '+k,k+' curved edges join alternating endpoints. Every pair crosses.',body);
  }
  renderCrossingFamily();

  // A small graph for the Explorer: the last three edges are left unhighlighted.
  const networkPoints=[[280,55],[460,100],[540,245],[430,385],[245,405],[70,320],[55,165],[150,70],[370,77.5],[157.5,362.5]];
  const networkPairs=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],[0,2],[1,3],[3,6],[5,7],[0,4],[1,5],[2,6]];
  const networkCurves=networkPairs.flatMap(([u,v],i)=>{
    const a=networkPoints[u],b=networkPoints[v],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
    const amplitude=i<12?[-42,-14,14,42][i%4]:[30,-45,34][i-12];
    const nx=-dy/length,ny=dx/length;
    const curve={u,v,a,b,c1:[a[0]+dx/3+nx*amplitude,a[1]+dy/3+ny*amplitude],c2:[a[0]+2*dx/3-nx*amplitude,a[1]+2*dy/3-ny*amplitude]};
    if(i!==0&&i!==4)return [curve];
    // Split two uncrossed outer curves exactly, keeping the approved geometry.
    const mid=(p,q)=>[(p[0]+q[0])/2,(p[1]+q[1])/2];
    const a1=mid(a,curve.c1),a2=mid(curve.c1,curve.c2),b2=mid(curve.c2,b);
    const left=mid(a1,a2),right=mid(a2,b2),vertex=i===0?8:9,point=networkPoints[vertex];
    return [{u,v:vertex,a,b:point,c1:a1,c2:left},{u:vertex,v,a:point,b,c1:right,c2:b2}];
  });
  function renderNetwork(){
    let body='';
    networkCurves.forEach((c,i)=>body+=path('M'+c.a+' C'+c.c1+' '+c.c2+' '+c.b,P.teal,1.8,'class="network-edge" pathLength="1" data-network-edge="'+i+'"'));
    networkPoints.forEach(([x,y])=>body+=circle(x,y,5.2));
    $('#network-scene').innerHTML=svg(600,460,'A network appears one edge at a time',networkCurves.length+' curved edges gradually join '+networkPoints.length+' fixed vertices while you read. All edges use the same color.',body);
  }
  renderNetwork();
  function updateNetwork(){
    if(selectedRoute!=='curious')return;
    const steps=$$('.network-step'),target=window.innerHeight*.6;
    let nearest=0,distance=Infinity;
    steps.forEach((step,i)=>{const r=step.getBoundingClientRect(),d=Math.abs(r.top+r.height/2-target);if(d<distance){nearest=i;distance=d;}});
    steps.forEach((step,i)=>step.classList.toggle('active',i===nearest));
    const drawing=steps[1].getBoundingClientRect();
    // Finish the complete graph while the second text block is still on screen.
    const progress=drawing.height>0?clamp((window.innerHeight-drawing.top)/drawing.height):0;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $$('.network-edge').forEach((edge,i)=>{
      const amount=reduced?1:clamp(progress*networkCurves.length-i);
      edge.style.strokeDashoffset=String(1-amount);
    });
  }

  // Coordinates follow the three-hole triangulation in the supplied manuscript.
  function renderSetup() {
    const coordinates={a:[0,0],b:[8,0],c:[4.1,6.4],d:[1.861,1.681],e:[2.085,.844],f:[2.834,1.483],g:[3.609,3.574],h:[4.113,4.366],i:[4.424,3.489],j:[5.22,1.441],l:[5.887,.938],m:[6.076,1.868]};
    const xy=key=>{const p=coordinates[key];return [45+p[0]*66,465-p[1]*61];};
    const segments=['ad','ae','dg','dc','ej','el','eb','fg','fi','fj','gc','ch','cm','hm','ij','im','lb','mb'];
    const poly=keys=>keys.split('').map(k=>xy(k).join(',')).join(' ');
    const graphVertices=[[2.34,1.32],[5.72,1.48],[4.07,3.89]].map(([x,y])=>[45+x*66,465-y*61]);
    let body=`<polygon points="${poly('abc')}" fill="none" stroke="${P.ink}" stroke-width="1.3"/>`;
    body+='<g class="setup-mesh">';
    segments.forEach(s=>body+=path(`M${xy(s[0])} L${xy(s[1])}`,P.line,1.2));
    body+='</g>';
    body+='<g class="setup-curves">';
    const tr=(x,y)=>`${45+x*66},${465-y*61}`;
    body+=path(`M${tr(2.34,1.32)} C${tr(3.4,.55)} ${tr(4.7,.6)} ${tr(5.72,1.48)} C${tr(6,2.6)} ${tr(5.2,3.9)} ${tr(4.07,3.89)} C${tr(2.9,3.7)} ${tr(2,2.6)} ${tr(2.34,1.32)}`,P.orange,2.7);
    body+='</g><g class="setup-holes">';
    ['dfe','ghi','jml'].forEach(s=>body+=`<polygon points="${poly(s)}" fill="${P.paper}" stroke="${P.ink}" stroke-width="1.2"/>`);
    body+='</g><g class="setup-vertices">';
    graphVertices.forEach(([x,y])=>body+=circle(x,y,4.2));
    body+='</g>';
    body+=`<g class="setup-cleaning"><rect x="0" y="70" width="620" height="435" fill="${P.paper}"/>`;
    body+=text(155,105,'Enter and exit<tspan x="155" dy="22">through the same side</tspan>','text-anchor="middle" style="font-size:16px"');
    body+=text(465,105,'After moving the curve<tspan x="465" dy="22">across the side</tspan>','text-anchor="middle" style="font-size:16px"');
    [0,310].forEach(offset=>{
      body+=path(`M${35+offset} 370 L${155+offset} 160 L${275+offset} 370 Z`,P.line,1.5);
      body+=path(`M${35+offset} 370 L${155+offset} 485 L${275+offset} 370`,P.line,1.2);
    });
    body+=`<path d="M95 370 C100 270 210 270 215 370Z" fill="${P.orange}" opacity=".09"/>`;
    body+=path('M75 420 C90 400 90 390 95 370 C100 270 210 270 215 370 C220 390 220 400 235 420',P.orange,2.5);
    body+=path('M385 420 C400 400 400 390 405 380 C435 374 495 374 525 380 C530 390 530 400 545 420',P.teal,2.5);
    body+=path('M405 370 C410 270 520 270 525 370',P.line,1.2,'stroke-dasharray="4 5"');
    body+='</g>';
    $('#setup-scene').innerHTML=svg(620,535,'A drawing becomes curves among triangular holes','A three-vertex drawing is enclosed by a large triangle. Small triangular neighborhoods are cut out around the vertices, and grey sides triangulate the remaining region. Orange graph curves remain separate from the grey auxiliary sides.',body);
    $('#setup-scene').dataset.stage='0';
  }
  renderSetup();

  function renderWords(){
    let b='';
    const vertices={t0:[1,4.05],t1:[2.6,3.9],t2:[3.9,4.35],y:[6.15,3.65],z:[2.25,1.65],w:[3.9,2],x:[5.9,0],d:[0,1.15]};
    const pos=([x,y])=>[40+x*85,420-y*85];
    const get=k=>pos(vertices[k]);
    b+=`<polygon points="${['t0','d','z'].map(k=>get(k).join(',')).join(' ')}" fill="${P.wash}" stroke="${P.ink}" stroke-width="1.2"/>`;
    [['x','y'],['x','w'],['w','y'],['w','t2'],['t2','y'],['w','t1'],['t1','t2'],['w','z'],['z','t1'],['z','t0'],['t0','t1']].forEach(([a,c])=>{
      const u=get(a),v=get(c),dx=v[0]-u[0],dy=v[1]-u[1];
      b+=path(`M${u} L${v}`,P.line,1.4);
      const mx=u[0]+dx*.52,my=u[1]+dy*.52,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len;
      b+=path(`M${mx-ux*6-uy*3} ${my-uy*6+ux*3} L${mx} ${my} L${mx-ux*6+uy*3} ${my-uy*6-ux*3}`,P.muted,1);
    });
    const pp=[5.995,1.387],qq=[1.9,2.322];
    const route=[pp,[5,2.81],[3.9,3.17],[3.05,3.26],[2.46,3.02],qq,[1.08,1.8]].map(pos);
    b+=path('M'+route.map(p=>p.join(',')).join(' L'),P.orange,2.7);
    [route[0],route.at(-2)].forEach(([x,y])=>b+=circle(x,y,3.5,P.orange));
    if(window.innerWidth>760){[['x',10,15],['y',10,-5],['z',-15,20]].forEach(([k,dx,dy])=>{const [x,y]=get(k);b+=mathText(x+dx,y+dy,k,'class="math-label"');});}
    b+=mathText(315,475,String.raw`1\,0\,0\,1\,0\quad\textsf{· endpoint position}`,'text-anchor="middle" style="font-family:var(--mono);font-size:19px;fill:'+P.orange+'"','1   0   0   1   0   ·   endpoint position');
    $('#word-scene').innerHTML=svg(630,500,'An itinerary word through triangles','The orange path follows the five exits from Figure 4 of the paper, starting at the rightmost side and moving to a hole boundary. It records 1, 0, 0, 1, 0, then the endpoint position. The binary word constructs the orders; it is not the distinct-integer sequence used for Erdős–Szekeres.',b);
  }
  renderWords();
  function renderCover(){
    let b='';
    const a=[380,230],c=[260,430],d=[500,430],left=[140,230],right=[620,230],bottom=[380,630],farLeft=[20,430],farRight=[740,430],top=[260,30];
    const triangles=[[a,d,c],[a,c,left],[a,right,d],[c,d,bottom],[left,c,farLeft],[d,right,farRight],[left,a,top]];
    triangles.forEach((t,i)=>b+=`<polygon points="${t.map(p=>p.join(',')).join(' ')}" fill="${i===0?'#e7ebe0':'none'}" stroke="${P.line}" stroke-width="1.2"/>`);
    const centers=triangles.map(t=>[t.reduce((a,p)=>a+p[0],0)/3,t.reduce((a,p)=>a+p[1],0)/3]);
    [[0,1],[0,2],[0,3],[1,4],[2,5],[1,6]].forEach(([i,j])=>b+=path(`M${centers[i]} L${centers[j]}`,P.teal,1.1,'stroke-dasharray="3 5" opacity=".7"'));
    b+=path('M80 330 C240 320 520 320 680 330',P.orange,2.5);
    b+=path('M302 100 Q350 270 380 400 T344 570',P.blue,2.2);
    [[20,430],[380,630],[740,430],[260,30]].forEach(([x,y])=>b+=mathText(x,y+26,String.raw`\ldots`,'text-anchor="middle" style="font-size:21px;fill:'+P.muted+'"','…'));
    $('#cover-scene').innerHTML=svg(760,680,'A finite schematic patch of the universal cover','Seven triangles form a disk, with no triangle overlap or triple incidence at a side. Dotted blue connections join adjacent triangle centers and form a tree. The unfolding continues beyond this finite patch.',b);
  }
  renderCover();

  function renderFormalOrder() {
    const cases = [
      {name: 'Boundary edge', boundary: true,
        alpha: 'M145 90C152 94 158 118 170 116Q183 114 195 111T247 107',
        beta: 'M145 90C152 86 158 61 170 62Q183 63 195 65T247 70'},
      {name: 'Different exits',
        alpha: 'M89 131C98 127 107 122 118 120S151 119 170 116Q183 114 195 111',
        beta: 'M87 49C97 53 108 59 118 60S152 61 170 62Q183 63 195 65',
        exits: [[118,120,111,138], [118,60,109,53]]},
      {name: 'Shared lower side',
        alpha: 'M130 147Q137 140 144 135C154 128 159 119 170 116Q183 114 195 111',
        beta: 'M81 118Q86 110 92 105C112 85 145 63 170 62Q183 63 195 65',
        exits: [[144,135,149,151], [92,105,95,125]],
        arrow: 'M127 121L120 121.15 123.6 127.5'},
      {name: 'Shared upper side',
        alpha: 'M81 62Q86 70 92 75C112 95 145 118 170 116Q183 114 195 111',
        beta: 'M130 33Q137 40 144 45C154 52 159 61 170 62Q183 63 195 65',
        exits: [[92,75,85,64], [144,45,149,37]],
        arrow: 'M114.8 58L122 57.7 118.5 64'}
    ];
    const label = (x, y, tex, color = P.ink, fallback = tex) =>
      mathText(x,y,tex,`font-size="14" fill="${color}" text-anchor="middle"`,fallback);
    const panels = cases.map((item, index) => {
      const heading = text(126,15,item.name,'class="case-name" text-anchor="middle"');
      let body = '';
      if (item.boundary) {
        body += '<path d="M170 150 132 90 170 30Z" fill="' + P.wash + '" stroke="' + P.muted + '" stroke-width="1.5"/>';
        body += path('M170 150 258 90 170 30',P.line);
      } else {
        body += path('M170 150 66 90 170 30',P.muted);
      }
      body += path('M170 150V30M166 94 170 86 174 94');
      if (item.arrow) body += path(item.arrow);
      body += path(item.alpha,P.orange,2.5) + path(item.beta,P.ink,2.5);
      body += circle(170,150,2.7) + circle(170,30,2.7) + label(182,157,'x') + label(182,34,'y');
      body += circle(170,116,3,P.orange) + circle(170,62,3) + label(181,131,'p') + label(181,56,'q');
      const curveLabelX = item.boundary ? 255 : 205;
      body += label(curveLabelX,115,'\\alpha',P.orange,'α') + label(curveLabelX,68,'\\beta',P.ink,'β');
      if (item.boundary) {
        body += circle(145,90,2.7) + label(136,106,'v') + label(160,95,'T_v',P.muted,'Tᵥ');
      } else {
        body += circle(66,90,2.7) + label(54,94,'z');
        item.exits.forEach(([x,y,labelX,labelY], i) => {
          body += circle(x,y,3,i === 0 ? P.orange : P.ink);
          body += label(labelX,labelY,i === 0 ? "p'" : "q'");
        });
      }
      if (item.boundary) body = `<g transform="translate(-65 0)">${body}</g>`;
      return `<g transform="translate(${index % 2 * 220},${Math.floor(index / 2) * 180})">${heading}${body}</g>`;
    });
    $('#formal-order-figure').innerHTML = svg(450,350,'The four cases for the left order',
      'In each drawing xy points up. At the boundary, p is closer to x and comes first. With different exits, alpha takes xz and comes first. When both curves exit through xz or both through zy, compare their exit points p prime and q prime on the side in the direction of its arrow.',
      panels.join(''));
  }
  renderFormalOrder();

  if(window.QuasiplanarDiagramMath?.html&&window.katex?.renderToString){
    $$('.sequence-display > span').forEach(label=>{
      label.innerHTML=window.QuasiplanarDiagramMath.html(label.textContent.trim());
    });
  }

  // This is the same rank decomposition used in the manuscript, shown as integers.
  function greedy(sequence){
    const chains=[];
    const layers=[];
    for(const v of sequence){
      let j=chains.findIndex(c=>c[c.length-1]<v);
      if(j<0){j=chains.length;chains.push([]);}
      chains[j].push(v);layers.push(j);
    }
    return {chains,layers};
  }
  function renderChains(n=10){
    const mobile=window.innerWidth<=760;
    const width=mobile?360:800;
    const {chains,layers}=greedy(integers.slice(0,n));
    const x=i=>(mobile?57:100)+i*(mobile?30:69);
    let b=mobile?'':text(18,26,'POSITION','style="font-size:9px;fill:'+P.muted+';letter-spacing:1px"');
    integers.forEach((v,i)=>{
      b+=mathText(x(i),26,String(i+1),'text-anchor="middle" style="font-size:10px;fill:'+P.muted+'"');
      b+=mathText(x(i),64,String(v),`text-anchor="middle" style="font-family:var(--mono);font-size:${mobile?17:21}px;opacity:${i<n?1:.2}"`);
      if(i===n-1)b+=path(`M${x(i)-13} 78 H${x(i)+13}`,layerColors[layers[i]],2);
    });
    for(let j=0;j<3;j++){
      const yy=137+j*77;
      b+=mathText(18,yy+5,'L_{'+(j+1)+'}','style="font-size:12px;fill:'+layerColors[j]+'"','L'+(j+1));
      b+=path(`M${mobile?44:65} ${yy} H${width-20}`,P.line,1);
      const chain=chains[j]||[];
      for(let i=0;i<chain.length;i++){
        const v=chain[i],xx=x(integers.indexOf(v));
        const radius=mobile?12:18;
        if(i>0){const prev=x(integers.indexOf(chain[i-1]));b+=path(`M${prev+radius} ${yy} H${xx-radius-1}`,layerColors[j],1.5);b+=path(`M${xx-radius-6} ${yy-3} L${xx-radius-1} ${yy} L${xx-radius-6} ${yy+3}`,layerColors[j],1.5);}
        b+=circle(xx,yy,radius,P.wash,`stroke="${layerColors[j]}" stroke-width="${i===chain.length-1?2:0}"`);
        b+=mathText(xx,yy+6,String(v),`text-anchor="middle" style="font-family:var(--mono);font-size:${mobile?17:18}px;fill:${layerColors[j]}"`);
        if(i===chain.length-1)b+=text(xx,yy+33,'head','text-anchor="middle" style="font-size:11px;fill:'+P.muted+'"');
      }
    }
    const heads=n?String.raw`\textsf{Heads: }`+chains.map(c=>c.at(-1)).join(String.raw`,\,`)+'.':String.raw`\textsf{Read the first integer, }4\textsf{.}`;
    b+=mathText(width/2,367,heads,'text-anchor="middle" style="font-size:13px;fill:'+P.muted+'"',n?`Heads: ${chains.map(c=>c.at(-1)).join(', ')}.`:'Read the first integer, 4.');
    $('#chain-scene').innerHTML=svg(width,390,'Greedy increasing chains of a distinct-integer sequence','The original sequence is shown across the top. Each processed integer enters the first chain whose current head is smaller. Chains are displayed as horizontal rows; outlined last integers are the heads.',b);
    $('#chain-output').textContent=`${n} / 10`;
    $('#chain-caption').textContent=n===10?'Three increasing chains cover the sequence. The outlined integer at the end of each chain is its current head.':n===0?'Slide forward to read the sequence one integer at a time.':`The first ${n} integer${n===1?' has':'s have'} been processed. The next integer goes after the largest head smaller than it, or starts a new chain.`;
  }
  $('#chain-step').addEventListener('input',e=>renderChains(Number(e.target.value)));
  $('#chain-replay').addEventListener('click',()=>{$('#chain-step').value='0';renderChains(0);$('#chain-step').focus();});
  renderChains();

  let chargeStage=0;
  let chargeManual=false;
  const chargeDescriptions=[String.raw`Follow \(\alpha\) from one vertex neighborhood toward the other.`,String.raw`At the first side, \(\beta\) is the successor of \(\alpha\).`,String.raw`At the next side, \(\gamma\) has replaced \(\beta\). Charge \(\alpha\) to the intervening triangle.`,String.raw`If the same \(\beta\) remained the successor all the way, it would join both of \(\alpha\)’s endpoint vertices. Simplicity rules this out.`];
  function renderCharge(){
    let b='';
    if(chargeStage===3){
      const mobile=window.innerWidth<=760,w=mobile?360:980,h=mobile?280:415;
      const l=mobile?40:75,r=w-l,cy=mobile?125:200,rx=mobile?27:50;
      b+=path(`M${l} ${cy} C${w*.3} ${cy+110} ${w*.7} ${cy+110} ${r} ${cy}`,P.orange,2.7);
      b+=path(`M${l} ${cy} C${w*.3} ${cy-110} ${w*.7} ${cy-110} ${r} ${cy}`,P.teal,2.5);
      [l,r].forEach(x=>{
        b+=`<polygon points="${x-rx},${cy-35} ${x+rx},${cy-35} ${x},${cy+55}" fill="${P.paper}" stroke="${P.ink}" stroke-width="1.3"/>`;
      });
      b+=mathText(w/2,cy+105,String.raw`\alpha`,'text-anchor="middle" class="math-label" style="fill:'+P.orange+'"','α');
      b+=mathText(w/2,cy-95,String.raw`\beta`,'text-anchor="middle" class="math-label" style="fill:'+P.teal+'"','β');
      b+=mathText(l,cy+85,'u','text-anchor="middle" class="math-label"');
      b+=mathText(r,cy+85,'v','text-anchor="middle" class="math-label"');
      if(!mobile)b+=mathText(w/2,370,String.raw`\textsf{This would give two original edges joining }u\textsf{ and }v\textsf{.}`,'text-anchor="middle" style="font-size:16px;fill:'+P.muted+'"','This would give two original edges joining u and v.');
      $('#charge-scene').innerHTML=svg(w,h,'An unchanged successor would give a parallel edge','Hypothetically alpha and beta both join the same two triangular vertex neighborhoods u and v. This is impossible in a simple graph, which has at most one edge between each pair of vertices.',b);
      $('#charge-description').textContent=chargeDescriptions[chargeStage];
      $('#charge-next').innerHTML='Start the journey again <span aria-hidden="true">↶</span>';
      return;
    }
    if(window.innerWidth<=760){
      b+=`<rect x="30" y="50" width="300" height="145" fill="none" stroke="${P.line}"/>`;
      for(let i=0;i<3;i++){
        const a=30+i*100;
        b+=path(`M${a} 50 L${a+100} 195`,P.line,1.1);
        if(i<2)b+=path(`M${a+100} 50 V195`,P.line,1.1);
      }
      if(chargeStage>=2)b+=`<polygon points="130,50 130,195 230,195" fill="${P.orange}" opacity=".09"/>`;
      b+=path('M12 150 C70 140 105 137 130 137 L190 137 C250 138 310 147 348 150',P.orange,2.6);
      b+=mathText(15,175,String.raw`\alpha`,'class="math-label" style="fill:'+P.orange+'"','α');
      b+=path('M12 100 C120 85 230 90 348 86',P.teal,2,`opacity="${chargeStage>=1?1:.2}"`);
      if(chargeStage>=1)b+=mathText(15,82,String.raw`\beta`,'class="math-label" style="fill:'+P.teal+'"','β');
      b+=path('M175 210 C175 145 255 115 348 116',P.blue,2,`opacity="${chargeStage>=2?1:.12}"`);
      if(chargeStage>=2)b+=mathText(310,108,String.raw`\gamma`,'class="math-label" style="fill:'+P.blue+'"','γ');
      b+=text(50,247,'successor','style="font-size:12px;fill:'+P.muted+'"');
      b+=mathText(155,247,chargeStage>=1?String.raw`\beta`:String.raw`\text{—}`,'text-anchor="middle" class="math-label" style="fill:'+P.teal+'"',chargeStage>=1?'β':'—');
      b+=mathText(220,247,String.raw`\to`,'text-anchor="middle" style="font-size:17px;fill:'+P.muted+'"','→');
      b+=mathText(285,247,chargeStage>=2?String.raw`\gamma`:String.raw`\text{—}`,'text-anchor="middle" class="math-label" style="fill:'+P.blue+'"',chargeStage>=2?'γ':'—');
      $('#charge-scene').innerHTML=svg(360,280,'A change of successor gives a triangle a charge','Follow orange alpha through three triangles. Its successor changes from beta to gamma. The highlighted triangle receives a charge. The names below the picture track the successor.',b);
      $('#charge-description').textContent=chargeDescriptions[chargeStage];
      $('#charge-next').innerHTML='Next frame <span aria-hidden="true">→</span>';
      return;
    }
    const pts=[[80,85],[80,305],[285,85],[285,305],[490,85],[490,305],[695,85],[695,305],[900,85],[900,305]];
    b+=`<rect x="80" y="85" width="820" height="220" fill="none" stroke="${P.line}"/>`;
    for(let i=0;i<4;i++){const a=80+i*205;b+=path(`M${a} 85 L${a+205} 305`,P.line,1.2);if(i<3)b+=path(`M${a+205} 85 V305`,P.line,1.2);}
    if(chargeStage>=2)b+=`<polygon points="285,85 285,305 490,305" fill="${P.orange}" opacity=".08"/>`;
    b+=path('M35 228 C150 226 230 214 285 214 S370 211 402 210.56 S730 224 945 228',P.orange,3);
    b+=mathText(44,252,String.raw`\alpha`,'class="math-label" style="fill:'+P.orange+'"','α');
    b+=path('M35 171 C215 165 320 151 430 148 S670 137 945 134',P.teal,2.2,`opacity="${chargeStage>=1?1:.23}"`);
    b+=mathText(44,155,String.raw`\beta`,'class="math-label" style="fill:'+P.teal+';opacity:'+(chargeStage>=1?1:.3)+'"','β');
    b+=path('M340 330 C365 275 370 187 470 177 S745 179 945 179',P.blue,2.2,`opacity="${chargeStage>=2?1:.15}"`);
    if(chargeStage>=2)b+=mathText(572,161,String.raw`\gamma`,'class="math-label" style="fill:'+P.blue+'"','γ');
    if(chargeStage>=1){b+=circle(285,214,6,P.paper,`stroke="${P.orange}" stroke-width="2"`);b+=mathText(232,357,String.raw`\textsf{successor }\beta`,'style="font-size:13px;fill:'+P.teal+'"','successor β');}
    if(chargeStage>=2){b+=circle(402,210.56,6,P.paper,`stroke="${P.orange}" stroke-width="2"`);b+=mathText(385,357,String.raw`\textsf{successor }\gamma`,'style="font-size:13px;fill:'+P.blue+'"','successor γ');b+=text(401,54,'A change receives a charge.','text-anchor="middle" style="font-size:13px;fill:'+P.orange+'"');}
    if(chargeStage===3){b+=path('M35 88 V275 M945 88 V275',P.ink,1.7,'stroke-dasharray="4 4"');b+=text(55,390,'first endpoint neighborhood','style="font-size:11px;fill:'+P.muted+'"');b+=text(710,390,'second endpoint neighborhood','style="font-size:11px;fill:'+P.muted+'"');}
    $('#charge-scene').innerHTML=svg(980,415,'A curve is charged when its successor changes','Orange curve alpha follows a route through triangles. A teal curve beta is its successor at one side; a blue curve gamma is its successor at the next side. The intervening triangle receives a charge. This picture illustrates a prescribed change; successor relations require the full order data.',b);
    $('#charge-description').textContent=chargeDescriptions[chargeStage];
    $('#charge-next').innerHTML='Next frame <span aria-hidden="true">→</span>';
  }
  $('#charge-next').addEventListener('click',()=>{chargeManual=true;chargeStage=(chargeStage+1)%4;renderCharge();});
  renderCharge();

  // Scroll is never captured; the illustration follows ordinary document scrolling.
  const localOrders = $('.local-orders');
  const orderQuiz = $('.local-orders-quiz', localOrders);
  const visitChoices = $$('button', orderQuiz);
  visitChoices.forEach(choice => choice.addEventListener('click', () => {
    visitChoices.forEach(button => {
      const selected = button === choice;
      button.setAttribute('aria-pressed', String(selected));
      document.getElementById(button.getAttribute('aria-controls')).setAttribute('aria-hidden', String(!selected));
    });
    orderQuiz.dataset.orderStep = 'next-exits';
    if (localOrders.dataset.stage === 'quiz') localOrders.dataset.stage = 'next-exits';
  }));
  const localOrderSteps = $$('[data-order-step]', localOrders);
  const localOrdersLayout = window.matchMedia('screen and (min-width:761px) and (min-height:460px) and (prefers-reduced-motion:no-preference)');
  function updateLocalOrders() {
    if (selectedRoute !== 'expert' || !localOrdersLayout.matches) {
      localOrders.removeAttribute('data-stage');
      return;
    }
    // Enable the sticky layout before measuring the scrolling paragraphs.
    if (!localOrders.hasAttribute('data-stage')) localOrders.dataset.stage = 'full';
    let stage = 'full';
    const threshold = window.innerHeight * .84;
    const exitThreshold = window.innerHeight * .18;
    for (const step of localOrderSteps) {
      const bounds = step.getBoundingClientRect();
      if (bounds.top > threshold) break;
      stage = bounds.bottom < exitThreshold ? 'full' : step.dataset.orderStep;
    }
    localOrders.toggleAttribute('data-orders-complete', localOrderSteps.at(-1).getBoundingClientRect().bottom < exitThreshold);
    if (localOrders.dataset.stage !== stage) localOrders.dataset.stage = stage;
  }
  localOrdersLayout.addEventListener('change', () => requestAnimationFrame(updateScroll));
  let scrollQueued=false;
  let headsController=null,headsManual=false;
  function updateScroll(){
    scrollQueued=false;
    const max=document.documentElement.scrollHeight-window.innerHeight;
    $('.reading-progress span').style.transform=`scaleX(${max>0?clamp(window.scrollY/max):0})`;
    if(document.documentElement.hasAttribute('data-route-pending'))return;
    // The path is revealed by ordinary scrolling, with a small hand-drawn bend.
    const trail=$('#route-trail'),trailPath=$('#route-trail-path');
    const tr=trail.getBoundingClientRect();
    const chosen=$('#choose [data-route-choice="'+selectedRoute+'"]').getBoundingClientRect();
    const width=tr.width>0?tr.width:1000,height=tr.height>0?tr.height:window.innerHeight;
    const start=clamp(chosen.left+chosen.width/2-tr.left,18,width-18),center=width/2,bottom=Math.max(32,height-26),wave=Math.min(34,Math.max(25,width*.04));
    $('svg',trail).setAttribute('viewBox','0 0 '+width+' '+height);
    trailPath.setAttribute('d','M'+start+' 16 C'+start+' '+height*.2+' '+(center+wave)+' '+height*.2+' '+(center+wave)+' '+height*.43+' C'+(center+wave)+' '+height*.59+' '+(center-wave)+' '+height*.59+' '+(center-wave)+' '+height*.76+' C'+(center-wave)+' '+height*.87+' '+center+' '+height*.87+' '+center+' '+bottom);
    // Pixel-sized coordinates keep the short dashes close together as the clip reveals them.
    // It finishes before the question below the full-screen trail enters view.
    const progress=window.matchMedia('(prefers-reduced-motion: reduce)').matches?1:tr.height>0?clamp((window.innerHeight-tr.top)/tr.height):0;
    const clip=$('#route-trail-clip-rect');
    clip.setAttribute('width',String(width));
    clip.setAttribute('height',String(height*progress));
    $('.trail-tip',trail).setAttribute('d','M'+(center-9)+' '+(bottom-12)+' L'+center+' '+bottom+' L'+(center+9)+' '+(bottom-12));
    $('.trail-tip',trail).style.opacity=progress>=1?'1':'0';
    updateNetwork();
    updateLocalOrders();
    if(selectedRoute!=='curious'){
      const steps=$$('.scroll-steps .step', $('#triangulate'));
      const target=window.innerHeight*(window.innerWidth<=760?.72:.54);
      let index=0,best=Infinity;
      steps.forEach((step,i)=>{
        const r=step.getBoundingClientRect();
        const center=window.innerWidth<=760?r.top+Math.min(r.height*.72,window.innerHeight*.7):r.top+r.height/2;
        const distance=Math.abs(center-target);
        if(distance<best){best=distance;index=i;}
      });
      steps.forEach((step,i)=>step.classList.toggle('active',i===index));
      $('#setup-scene').dataset.stage=String(index);
      const cuttingParagraph=steps[0].querySelector('p[data-for="'+selectedRoute+'"]:not(.small-label)');
      const cuttingText=cuttingParagraph.textContent.trim()?cuttingParagraph:steps[0].querySelector('h3[data-for="'+selectedRoute+'"]');
      const cutting=cuttingText.getBoundingClientRect();
      const threshold=window.innerHeight*.7;
      const holeProgress=index>0?1:window.matchMedia('(prefers-reduced-motion: reduce)').matches?Number(cutting.top<threshold):clamp((threshold-cutting.top)/Math.max(cutting.height,window.innerHeight*.12));
      $('#setup-scene').style.setProperty('--setup-holes',String(holeProgress));
      $('#setup-caption').textContent=[
        holeProgress>.5?'Small triangular neighborhoods around the vertices become holes.':'Orange curves join the graph vertices. The enclosing triangle is an auxiliary frame.',
        'Small vertex neighborhoods become holes. Fine grey sides triangulate the remaining region.',
        ''
      ][index];
      $('#setup-caption').hidden=index===2;
      $$('.scene-dots i').forEach((dot,i)=>dot.classList.toggle('active',i===index));
    }
    const chargeSteps=$$('.charge-step');
    let chargeIndex=0,chargeBest=Infinity;
    chargeSteps.forEach((step,i)=>{const r=step.getBoundingClientRect(),d=Math.abs(r.top+r.height/2-window.innerHeight*.55);if(d<chargeBest){chargeBest=d;chargeIndex=i;}});
    chargeSteps.forEach((step,i)=>step.classList.toggle('active',i===chargeIndex));
    if(window.innerWidth>760&&!chargeManual&&chargeStage!==chargeIndex){chargeStage=chargeIndex;renderCharge();}
    if(headsController&&selectedRoute==='mathematician'&&window.innerWidth>=1100&&!$('#branch-heads').hidden){
      let nearest=0,distance=Infinity;
      const hSteps=$$('.head-step');
      hSteps.forEach((step,i)=>{const r=step.getBoundingClientRect(),d=Math.abs(r.top+r.height/2-window.innerHeight*.55);if(d<distance){distance=d;nearest=i;}});
      hSteps.forEach((step,i)=>step.classList.toggle('active',i===nearest));
      if(!headsManual)headsController.go(Number(hSteps[nearest].dataset.headStep));
    }
  }
  window.addEventListener('scroll',()=>{if(!scrollQueued){scrollQueued=true;requestAnimationFrame(updateScroll);}},{passive:true});
  let diagramBreakpoint=window.innerWidth<=760;
  window.addEventListener('resize',()=>{
    const mobile=window.innerWidth<=760;
    if(mobile!==diagramBreakpoint){diagramBreakpoint=mobile;renderChains(Number($('#chain-step').value));renderCharge();}
    requestAnimationFrame(updateScroll);
  });
  $$('details').forEach(d=>d.addEventListener('toggle',()=>requestAnimationFrame(updateScroll)));
  $('#expand-proofs').addEventListener('click',()=>{
    const all=$$('details.proof');const open=all.some(d=>!d.open);
    all.forEach(d=>d.open=open);
    $('#expand-proofs').textContent=open?'Close all proofs':'Open all proofs';
  });
  if(window.QuasiplanarStability)window.QuasiplanarStability.mount($('#stability-lab'),{showTitle:false,retained:6,lemmaName:'Lemma 2.5'});
  if(window.QuasiplanarHeads){
    headsController=window.QuasiplanarHeads.mount($('#heads-lab'),{compact:true});
    $('#heads-lab').addEventListener('click',e=>{if(e.target.closest('[data-act]'))headsManual=true;});
  }
  const chargeMapRoot=$('#charge-map-preview');
  const chargeMap=window.QuasiplanarChargeMap&&chargeMapRoot?window.QuasiplanarChargeMap.mount(chargeMapRoot,{container:$('#charging-overview'),autoplay:true}):null;
  const planarRoot=$('#planar-scene');
  const planar=window.QuasiplanarExplorerScenes&&planarRoot?window.QuasiplanarExplorerScenes.mountPlanar(planarRoot,{container:$('#planar-graphs')}):null;
  const growthRoot=$('#planar-bound-plot');
  const growthPlot=window.QuasiplanarExplorerScenes?.mountSharedPlot&&growthRoot?window.QuasiplanarExplorerScenes.mountSharedPlot(growthRoot,{container:$('#explorer-growth-story')}):null;
  updateScroll();
  window.QuasiplanarStory={greedy,integers,renderChains,renderCrossingFamily,crossingFamilyGeometry,explorerNetwork:{points:networkPoints,curves:networkCurves},chargeMap,planar,growthPlot};
})();
