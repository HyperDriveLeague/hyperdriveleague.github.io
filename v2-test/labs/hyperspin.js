(() => {
  'use strict';
  // HYPERSPIN LAB ONLY: no API requests, no persistence and no real transactions.
  // 20 equally likely sectors -> preliminary RTP = 90%. Production must use
  // an authenticated server-side atomic debit/draw/credit transaction.
  const sectors = [
    0, .5, 1, 0, 1.5, 0, .5, 2, 0, 1,
    0, 5, .5, 0, 1.5, 0, 3, 1, .5, 0
  ];
  const scheme = [
    {mult:0,color:'#282c33',text:'#bdc1c8'},
    {mult:.5,color:'#53606d',text:'#ffffff'},
    {mult:1,color:'#3c7e7c',text:'#f2fffb'},
    {mult:1.5,color:'#347dc0',text:'#ffffff'},
    {mult:2,color:'#8062ba',text:'#ffffff'},
    {mult:3,color:'#b97928',text:'#fff0d3'},
    {mult:5,color:'#f0ce3a',text:'#17130a'}
  ];
  const $ = id => document.getElementById(id);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SEGMENT = 360 / sectors.length;
  const money = cents => (cents/100).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2});
  const label = factor => factor === 0 ? 'x0' : 'x' + factor.toLocaleString('es-ES',{maximumFractionDigits:1});
  const currency = cents => money(cents) + ' M';
  let balance = 5000; // 50 million demo only, expressed in hundredths of 1M.
  let turns = [];
  let spinning = false;
  let cumulativeRotation = 0;
  const wheel = $('spinWheel');
  const container = $('wheelSegments');

  function secureInt(limit) {
    const space=4294967296;
    const max=Math.floor(space/limit)*limit;
    let v;
    do {
      const buffer = new Uint32Array(1);
      window.crypto.getRandomValues(buffer);
      v=buffer[0];
    } while(v>=max);
    return v % limit;
  }
  function svg(name,attrs,content) {
    const el=document.createElementNS(SVG_NS,name);
    Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));
    if(content!==undefined)el.textContent=String(content);
    return el;
  }
  function point(angle,r) {
    const rad=angle*Math.PI/180;
    return {x:300+Math.sin(rad)*r,y:300-Math.cos(rad)*r};
  }
  function drawWheel() {
    sectors.forEach((mult,i)=>{
      const a=i*SEGMENT,b=(i+1)*SEGMENT,mid=(a+b)/2;
      const p1=point(a,284),p2=point(b,284);
      const palette=scheme.find(x=>x.mult===mult);
      const path='M 300 300 L '+p1.x.toFixed(3)+' '+p1.y.toFixed(3)+
        ' A 284 284 0 0 1 '+p2.x.toFixed(3)+' '+p2.y.toFixed(3)+' Z';
      container.appendChild(svg('path',{
        d:path,fill:palette.color,stroke:'#131518','stroke-width':2
      }));
      const p=point(mid,216);
      const group=svg('g',{transform:'rotate('+mid+' '+p.x+' '+p.y+')'});
      const text=svg('text',{
        x:p.x,y:p.y,fill:palette.text,
        'font-size':mult===1.5?25:30,'font-weight':'900',
        'text-anchor':'middle','dominant-baseline':'central',
        'font-family':'Inter,Arial,sans-serif','letter-spacing':'-1.5'
      },label(mult));
      group.appendChild(text);
      container.appendChild(group);
    });
  }
  function setMessage(message='',error=false) {
    const el=$('spinMessage');
    el.textContent=message;
    el.classList.toggle('error',error);
  }
  function currentStake() {
    const raw=$('stakeInput').value.replace(',','.');
    if(raw.trim()==='')return null;
    const value=Number(raw);
    if(!Number.isFinite(value))return null;
    return Math.round(value*100);
  }
  function showBalance() {
    $('demoBalance').innerHTML=money(balance)+' <small>M</small>';
  }
  function updateControls() {
    const stake=currentStake();
    const valid=stake!==null && stake>=10 && stake<=500
      && stake===Math.round(stake) && stake<=balance;
    $('betSummary').textContent=stake===null?'—':currency(stake);
    $('maxReturn').textContent=stake===null?'—':currency(stake*5);
    $('afterBet').textContent=stake===null?'—':currency(balance-stake);
    $('spinButton').disabled=!valid||spinning;
    $('stakeInput').disabled=spinning;
    $('resetDemo').disabled=spinning;
    document.querySelectorAll('[data-stake]').forEach(button=>{
      button.disabled=spinning;
      button.classList.toggle('selected',stake!==null &&
        Math.round(Number(button.dataset.stake)*100)===stake);
    });
    if(!spinning && stake!==null && stake>balance) {
      setMessage('No tienes saldo de prueba suficiente para esa tirada.',true);
    } else if(!spinning && stake!==null && (stake<10 || stake>500)) {
      setMessage('El importe de prueba debe estar entre 0,10 M y 5 M.',true);
    } else if(!spinning) {
      setMessage('');
    }
    showBalance();
    return valid;
  }
  function paintResult(factor,stake,payout) {
    const panel=$('spinResult');
    panel.classList.remove('win','loss');
    panel.classList.add(payout>stake?'win':payout<stake?'loss':'win');
    panel.querySelector('.result-label').textContent=payout>stake?'PREMIO CONSEGUIDO':
      payout<stake?'RESULTADO DEL GIRO':'APUESTA RECUPERADA';
    panel.querySelector('strong').textContent=label(factor)+' · '+currency(payout);
    const net=payout-stake;
    panel.querySelector('small').textContent=
      'Apostado '+currency(stake)+' · '+(net>=0?'Beneficio ':'Pérdida ')+
      (net>=0?'+':'−')+currency(Math.abs(net));
  }
  function paintLegend() {
    const list=$('multiplierLegend');
    const rtp=sectors.reduce((sum,v)=>sum+v,0)/sectors.length*100;
    $('rtpValue').textContent=rtp.toLocaleString('es-ES',{maximumFractionDigits:2})+'%';
    scheme.forEach(item=>{
      const count=sectors.filter(x=>x===item.mult).length;
      const tile=document.createElement('div');
      tile.className='legend-item';
      const circle=document.createElement('i');
      circle.style.background=item.color;
      const title=document.createElement('strong');
      title.textContent=label(item.mult);
      const small=document.createElement('small');
      small.textContent=(count*100/sectors.length)+'%';
      tile.append(circle,title,small);
      list.appendChild(tile);
    });
  }
  function paintHistory() {
    $('spinCount').textContent=turns.length+(turns.length===1?' TIRADA':' TIRADAS');
    const root=$('spinHistory');
    root.replaceChildren();
    if(!turns.length) {
      const empty=document.createElement('div');
      empty.className='empty-history';
      empty.textContent='Aún no has girado la ruleta. Tu actividad de prueba aparecerá aquí.';
      root.appendChild(empty);
      return;
    }
    turns.forEach(turn=>{
      const row=document.createElement('div');
      row.className='history-row';
      const value=document.createElement('div');
      const item=scheme.find(x=>x.mult===turn.factor);
      value.className='history-x';
      value.style.background=item.color;
      value.style.color=item.text;
      value.textContent=label(turn.factor);
      const detail=document.createElement('div');
      detail.className='history-detail';
      const name=document.createElement('strong');
      name.textContent='Apostado '+currency(turn.stake)+' · Retorno '+currency(turn.payout);
      const sub=document.createElement('small');
      sub.textContent=turn.time.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})+' · Tirada de prueba';
      detail.append(name,sub);
      const difference=document.createElement('strong');
      const net=turn.payout-turn.stake;
      difference.className='history-profit '+(net>=0?'positive':'negative');
      difference.textContent=(net>=0?'+':'−')+currency(Math.abs(net));
      row.append(value,detail,difference);
      root.appendChild(row);
    });
  }
  function finishSpin(factor,stake) {
    const payout=Math.round(stake*factor);
    balance+=payout;
    turns.unshift({factor,stake,payout,time:new Date()});
    turns=turns.slice(0,20);
    spinning=false;
    $('spinButton').querySelector('span').textContent='VOLVER A GIRAR';
    $('spinResult').setAttribute('aria-busy','false');
    paintResult(factor,stake,payout);
    paintHistory();
    updateControls();
  }
  function spin() {
    if(spinning || !updateControls())return;
    const stake=currentStake();
    if(stake===null || stake>balance)return;
    spinning=true;
    balance-=stake;
    const index=secureInt(sectors.length);
    const factor=sectors[index];
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration=reduced?200:4800;
    const desired=(360-((index+.5)*SEGMENT)%360)%360;
    const current=((cumulativeRotation%360)+360)%360;
    const delta=(desired-current+360)%360;
    const jitter=(secureInt(801)/100)-4;
    cumulativeRotation+=6*360+delta+jitter;
    wheel.style.transitionDuration=duration+'ms';
    wheel.style.transform='rotate('+cumulativeRotation+'deg)';
    $('spinResult').classList.remove('win','loss');
    $('spinResult').setAttribute('aria-busy','true');
    $('spinResult').querySelector('.result-label').textContent='GIRANDO RULETA';
    $('spinResult').querySelector('strong').textContent='···';
    $('spinResult').querySelector('small').textContent='El resultado se decide al iniciar el giro.';
    $('spinButton').querySelector('span').textContent='GIRANDO…';
    setMessage('Apuesta de '+currency(stake)+' descontada del saldo de prueba.');
    updateControls();
    window.setTimeout(()=>finishSpin(factor,stake),duration+75);
  }
  function reset() {
    if(spinning)return;
    if(turns.length && !window.confirm('¿Reiniciar el saldo y borrar las tiradas de prueba?'))return;
    balance=5000;
    turns=[];
    $('stakeInput').value='1';
    $('spinButton').querySelector('span').textContent='GIRAR RULETA';
    $('spinResult').classList.remove('win','loss');
    $('spinResult').querySelector('.result-label').textContent='ESPERANDO TU APUESTA';
    $('spinResult').querySelector('strong').textContent='—';
    $('spinResult').querySelector('small').textContent='Selecciona un importe y pulsa GIRAR.';
    paintHistory();
    updateControls();
  }
  drawWheel();
  paintLegend();
  paintHistory();
  updateControls();
  $('stakeInput').addEventListener('input',updateControls);
  document.querySelectorAll('[data-stake]').forEach(button=>button.addEventListener('click',()=>{
    if(spinning)return;
    $('stakeInput').value=button.dataset.stake;
    updateControls();
  }));
  $('spinButton').addEventListener('click',spin);
  $('resetDemo').addEventListener('click',reset);
})();