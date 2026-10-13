(() => {
  'use strict';
  // LABORATORY ONLY — NO API, DATABASE, WALLET OR PERSISTENT RECORDS.
  // For production: authenticate on server and atomically debit/draw/credit.
  const RULES = [
    {mult:0,count:16,color:'#272b30',ink:'#aeb5bd'},
    {mult:0.5,count:15,color:'#5b626c',ink:'#fff'},
    {mult:1,count:10,color:'#366a74',ink:'#f0faff'},
    {mult:1.5,count:5,color:'#278d7c',ink:'#edfff9'},
    {mult:2,count:3,color:'#a66c32',ink:'#fff5e7'},
    {mult:5,count:1,color:'#ffda17',ink:'#171507'}
  ];
  const INITIAL = 5000, MAX_STAKE = 500, MIN_STAKE = 10; // hundredths of 1 M.
  const TOTAL=RULES.reduce((sum,r)=>sum+r.count,0);
  if(TOTAL!==50)throw Error('La rueda debe contener exactamente 50 sectores.');
  const EXPECTED=RULES.reduce((sum,r)=>sum+r.mult*r.count,0)/TOTAL;
  const $=id=>document.getElementById(id);
  const format=cents=>(cents/100).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2});
  const money=cents=>format(cents)+' M';
  const name=n=>'x'+String(n).replace('.',',');
  const SVG='http://www.w3.org/2000/svg';
  const state={balance:INITIAL,history:[],spinning:false,angle:0};
  const wheel=$('spinWheel');
  const stage=$('wheelSegments');
  let sectors=[];

  // Stable shuffle of sector appearances; equal angular sizes ensure listed
  // probability equals actual selection probability.
  function buildDistribution(){
    const bag=RULES.flatMap(r=>Array.from({length:r.count},()=>r.mult));
    let seed=0x1f87b53;
    for(let i=bag.length-1;i>0;i--){
      seed=(Math.imul(1664525,seed)+1013904223)>>>0;
      const j=seed%(i+1);
      [bag[i],bag[j]]=[bag[j],bag[i]];
    }
    return bag;
  }
  function unbiasedRandom(max){
    const SIZE=4294967296;
    const ceiling=SIZE-SIZE%max;
    let pick;
    do{
      const values=new Uint32Array(1);
      crypto.getRandomValues(values);
      pick=values[0];
    }while(pick>=ceiling);
    return pick%max;
  }
  function svg(tag,attr,txt){
    const node=document.createElementNS(SVG,tag);
    Object.entries(attr).forEach(([key,val])=>node.setAttribute(key,String(val)));
    if(txt!==undefined)node.textContent=txt;
    return node;
  }
  function polar(deg,r){
    const a=deg*Math.PI/180;
    return {x:300+Math.sin(a)*r,y:300-Math.cos(a)*r};
  }
  function arc(i,r=282){
    const a=i*360/TOTAL,b=(i+1)*360/TOTAL;
    const first=polar(a,r),second=polar(b,r);
    return 'M300 300 L'+first.x.toFixed(4)+' '+first.y.toFixed(4)+
      ' A'+r+' '+r+' 0 0 1 '+second.x.toFixed(4)+' '+second.y.toFixed(4)+' Z';
  }
  function renderWheel(){
    sectors=buildDistribution();
    const wedge=360/TOTAL;
    sectors.forEach((factor,i)=>{
      const rule=RULES.find(r=>r.mult===factor);
      stage.appendChild(svg('path',{
        d:arc(i),fill:rule.color,stroke:'#0d1013','stroke-width':'2.3',
        'data-sector':String(i),'data-multiplier':String(factor)
      }));
      // Legibility-first: the colors represent every actual segment; show
      // labels on rarer high multipliers and a sampled subset of other tiles.
      if(i%5===0||factor>=2){
        const center=(i+.5)*wedge;
        const p=polar(center,222);
        const group=svg('g',{transform:'rotate('+center+' '+p.x+' '+p.y+')'});
        group.appendChild(svg('text',{
          x:p.x,y:p.y,fill:rule.ink,'font-family':'Barlow Condensed, Impact, sans-serif',
          'font-size':factor>=2?'23':'19','font-weight':'900',
          'text-anchor':'middle','dominant-baseline':'middle'
        },name(factor)));
        stage.appendChild(group);
      }
    });
    $('rtpValue').innerHTML=(EXPECTED*100).toLocaleString('es-ES',{maximumFractionDigits:2})+' <small>%</small>';
  }
  function renderOdds(){
    const root=$('multiplierLegend');
    root.replaceChildren();
    RULES.forEach(rule=>{
      const tile=document.createElement('div');
      tile.className='odds-item';
      const swatch=document.createElement('i');
      swatch.className='odds-swatch';
      swatch.style.background=rule.color;
      const title=document.createElement('strong');
      title.textContent=name(rule.mult);
      const prob=document.createElement('small');
      prob.textContent=(rule.count/TOTAL*100).toLocaleString('es-ES')+' %';
      const tiny=document.createElement('span');
      tiny.className='odds-note';
      tiny.textContent=rule.count+' / '+TOTAL+' sectores';
      tile.append(swatch,title,prob,tiny);
      root.appendChild(tile);
    });
  }
  function stakeAmount(){
    const raw=$('stakeInput').value.replace(',','.').trim();
    if(raw==='')return null;
    const number=Number(raw);
    if(!Number.isFinite(number))return null;
    const cents=number*100;
    if(!Number.isInteger(Math.round(cents)) || Math.abs(Math.round(cents)-cents)>1e-7)return null;
    return Math.round(cents);
  }
  function checkStake(cents){
    if(cents===null || cents<MIN_STAKE || cents>MAX_STAKE)return false;
    if(cents%10!==0)return false;
    return cents<=state.balance;
  }
  function balancePaint(){
    $('demoBalance').innerHTML=format(state.balance)+' <small>M</small>';
    const net=state.balance-INITIAL,area=$('sessionNet');
    area.classList.remove('positive','negative','neutral');
    area.classList.add(net>0?'positive':net<0?'negative':'neutral');
    area.innerHTML=(net>0?'+':net<0?'−':'')+format(Math.abs(net))+' <small>M</small>';
    $('spinCount').textContent=String(state.history.length).padStart(2,'0');
  }
  function showMessage(message='',isError=false){
    const node=$('spinMessage');
    node.textContent=message;
    node.classList.toggle('error',isError);
  }
  function updateControls(){
    const cents=stakeAmount(),ready=checkStake(cents);
    $('betSummary').textContent=cents===null?'—':money(cents);
    $('maxReturn').textContent=cents===null?'—':money(cents*5);
    $('afterBet').textContent=cents===null?'—':money(state.balance-cents);
    $('spinButton').disabled=state.spinning||!ready;
    $('stakeInput').disabled=state.spinning;
    $('addStake').disabled=state.spinning;
    $('subtractStake').disabled=state.spinning;
    $('resetDemo').disabled=state.spinning;
    document.querySelectorAll('[data-stake]').forEach(button=>{
      button.disabled=state.spinning;
      button.classList.toggle('selected',cents!==null&&cents===Math.round(Number(button.dataset.stake)*100));
    });
    if(!state.spinning){
      if(cents!==null&&cents>state.balance)showMessage('Saldo de prueba insuficiente para esta apuesta.',true);
      else if(cents!==null&&(cents<MIN_STAKE||cents>MAX_STAKE||cents%10))showMessage('Apuesta permitida: de 0,10 M a 5 M, en pasos de 0,10 M.',true);
      else showMessage();
    }
    balancePaint();
  }
  function paintOutcome(mult,stake,payout){
    const net=payout-stake;
    const box=$('resultBox');
    box.classList.remove('positive','negative');
    box.classList.add(net>=0?'positive':'negative');
    box.querySelector('span').textContent=net>0?'PREMIO CONSEGUIDO':net<0?'RESULTADO DE LA TIRADA':'IMPORTE RECUPERADO';
    $('resultFactor').textContent=name(mult)+'  /  '+money(payout);
    $('resultDescription').textContent='Apostados '+money(stake)+' · '+(net>=0?'Balance +':'Balance −')+money(Math.abs(net));
  }
  function paintHistory(){
    const root=$('spinHistory');
    root.replaceChildren();
    if(!state.history.length){
      const message=document.createElement('p');
      message.className='empty-history';
      message.textContent='Todavía no has girado la ruleta.';
      root.appendChild(message);
      return;
    }
    state.history.slice(0,12).forEach(entry=>{
      const rule=RULES.find(r=>r.mult===entry.mult);
      const row=document.createElement('div');row.className='history-row';
      const factor=document.createElement('div');factor.className='history-factor';
      factor.textContent=name(entry.mult);
      factor.style.background=rule.color;factor.style.color=rule.ink;
      const desc=document.createElement('div');desc.className='history-desc';
      const first=document.createElement('strong');first.textContent='Apostado '+money(entry.stake)+' · Pagado '+money(entry.payout);
      const second=document.createElement('small');
      second.textContent=entry.time.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})+' · Simulación';
      desc.append(first,second);
      const net=document.createElement('strong');
      net.className='history-net '+(entry.net>=0?'positive':'negative');
      net.textContent=(entry.net>=0?'+':'−')+money(Math.abs(entry.net));
      row.append(factor,desc,net);
      root.appendChild(row);
    });
  }
  function endSpin(chosen,stake){
    const mult=sectors[chosen],payout=Math.round(stake*mult);
    state.balance+=payout;
    state.history.unshift({mult,payout,stake,net:payout-stake,time:new Date()});
    state.spinning=false;
    $('spinButtonLabel').textContent='GIRAR DE NUEVO';
    paintOutcome(mult,stake,payout);
    paintHistory();
    updateControls();
  }
  function spin(){
    const stake=stakeAmount();
    if(state.spinning || !checkStake(stake))return;
    state.spinning=true;
    state.balance-=stake;
    // Decide the outcome before the animation, using an unbiased crypto RNG.
    const chosen=unbiasedRandom(sectors.length);
    const anglePerSector=360/TOTAL;
    const target=(360-(chosen+.5)*anglePerSector)%360;
    const previous=((state.angle%360)+360)%360;
    const adjustment=((target-previous)+360)%360;
    const jitter=(unbiasedRandom(401)-200)/100; // within the selected sector.
    state.angle+=360*7+adjustment+jitter;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration=reduced?200:5600;
    wheel.style.transitionDuration=duration+'ms';
    wheel.style.transform='rotate('+state.angle+'deg)';
    const box=$('resultBox');
    box.classList.remove('positive','negative');
    box.querySelector('span').textContent='RUEDA EN MOVIMIENTO';
    $('resultFactor').textContent='GIRANDO…';
    $('resultDescription').textContent='La apuesta ya se ha descontado del saldo de prueba.';
    $('spinButtonLabel').textContent='GIRANDO…';
    showMessage('Resultado determinado. Esperando a que termine la animación.');
    updateControls();
    window.setTimeout(()=>endSpin(chosen,stake),duration+85);
  }
  function setStake(cents){
    if(state.spinning)return;
    $('stakeInput').value=(cents/100).toFixed(2);
    updateControls();
  }
  function nudgeStake(delta){
    const value=stakeAmount();
    const next=Math.max(MIN_STAKE,Math.min(MAX_STAKE,(value===null?100:value)+delta));
    setStake(next);
  }
  function reset(){
    if(state.spinning)return;
    if(state.history.length&&!window.confirm('¿Reiniciar los 50 M de prueba y borrar todas las tiradas?'))return;
    state.balance=INITIAL;
    state.history=[];
    $('stakeInput').value='1';
    $('spinButtonLabel').textContent='LANZAR HYPERSPIN';
    $('resultBox').classList.remove('positive','negative');
    $('resultBox').querySelector('span').textContent='RESULTADO DEL ÚLTIMO GIRO';
    $('resultFactor').textContent='—';
    $('resultDescription').textContent='Preparado para empezar.';
    paintHistory();
    updateControls();
  }
  renderWheel();
  renderOdds();
  paintHistory();
  updateControls();
  $('spinButton').addEventListener('click',spin);
  $('resetDemo').addEventListener('click',reset);
  $('stakeInput').addEventListener('input',updateControls);
  $('addStake').addEventListener('click',()=>nudgeStake(10));
  $('subtractStake').addEventListener('click',()=>nudgeStake(-10));
  document.querySelectorAll('[data-stake]').forEach(button=>button.addEventListener('click',()=>{
    setStake(Math.round(Number(button.dataset.stake)*100));
  }));
})();