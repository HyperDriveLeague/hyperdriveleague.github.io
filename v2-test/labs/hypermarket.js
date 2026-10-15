/* HYPERMARKET LAB · Standalone client-side simulator. No database reads/writes.
   Rules mirrored from T8 team_financial_summary and admin_contract_apply:
   immediate full contract payment, periods allocated to T8 salary cap,
   luxury tax charged on TOTAL excess (non-progressive bands), marginal FFP tax. */
(() => {
  'use strict';
  const SNAPSHOT=Object.freeze({
    balance:278.75,
    capUsed:367,
    capLimit:500,
    reserved:0,
    profit:-513.90,
    marketHalf:1
  });
  const DEFAULT_ROW=()=>({id:++sequence,name:'',division:'hyperdrive',salary:80,halves:2,payClause:false,buyout:0});
  let sequence=0;

  const round2=value=>Math.round((Number(value)||0)*100)/100;
  const money=value=>round2(value).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2});
  const sane=(n,allowNegative=false)=>{
    const x=Number(n);
    return Number.isFinite(x)?Math.max(allowNegative?-1000000:0,Math.min(x,1000000)):0;
  };
  function splitPeriods(salary,halves,marketHalf){
    const count=Math.max(1,Math.min(4,Math.floor(Number(halves)||1)));
    const total=Math.max(0,Math.round(sane(salary)*100));
    const centsPerHalf=Math.floor(total/count);
    const start=16+(Number(marketHalf)===0?0:1); // T8 opening=16, mid-season=17
    const result=[];
    for(let i=0;i<count;i++){
      const cents=centsPerHalf+(i===count-1?total-centsPerHalf*count:0);
      result.push({half:start+i,amount:cents/100});
    }
    return result;
  }
  function capAllocation(salary,halves,marketHalf){
    const allocated=splitPeriods(salary,halves,marketHalf);
    return round2(allocated.filter(p=>p.half===16||p.half===17).reduce((sum,p)=>sum+p.amount,0));
  }
  function luxuryTax(capUsed,limit){
    const excess=Math.max(0,round2(sane(capUsed)-Math.max(1,sane(limit))));
    const rate=excess<25?.25:excess<50?.5:excess<75?.75:1;
    return round2(excess*rate);
  }
  function fairPlayTax(profit){
    const p=Number(profit)||0;
    return round2(
      Math.max(0,Math.min(p,100)-50)*.10+
      Math.max(0,Math.min(p,200)-100)*.20+
      Math.max(0,Math.min(p,300)-200)*.30+
      Math.max(0,p-300)*.40
    );
  }
  const clause=row=>row.payClause?sane(row.buyout):0;
  function calculate(rows,base){
    const salaries=round2(rows.reduce((sum,r)=>sum+sane(r.salary),0));
    const buyouts=round2(rows.reduce((sum,r)=>sum+clause(r),0));
    const immediate=round2(salaries+buyouts);
    const capImpact=round2(rows.reduce((sum,r)=>sum+capAllocation(r.salary,r.halves,base.marketHalf),0));
    const capNew=round2(sane(base.capUsed)+capImpact);
    const oldLuxury=luxuryTax(base.capUsed,base.capLimit);
    const newLuxury=luxuryTax(capNew,base.capLimit);
    const luxuryChange=round2(newLuxury-oldLuxury);
    const oldFfp=fairPlayTax(base.profit);
    const newFfp=fairPlayTax((Number(base.profit)||0)-immediate);
    const ffpChange=round2(newFfp-oldFfp);
    const available=round2(sane(base.balance,true)-sane(base.reserved));
    const remaining=round2(available-immediate-luxuryChange-ffpChange);
    return {salaries,buyouts,immediate,capImpact,capNew,oldLuxury,newLuxury,luxuryChange,
      oldFfp,newFfp,ffpChange,available,remaining,over:round2(Math.max(0,capNew-base.capLimit))};
  }
  function maxSalary(rows,base,id){
    const trial=rows.map(row=>row.id===id?{...row,salary:0}:row);
    if(calculate(trial,base).remaining<0)return 0;
    let lo=0,hi=10000000;
    while(lo<hi){
      const middle=Math.ceil((lo+hi)/2);
      const scenario=trial.map(row=>row.id===id?{...row,salary:middle/100}:row);
      if(calculate(scenario,base).remaining>=0)lo=middle;
      else hi=middle-1;
    }
    return round2(lo/100);
  }

  // Pure calculator API for regression testing; no financial operations.
  window.HyperMarketMath=Object.freeze({splitPeriods,capAllocation,luxuryTax,fairPlayTax,calculate,maxSalary});

  const list=document.getElementById('signingList');
  if(!list)return;
  const $=id=>document.getElementById(id);
  const state={base:{...SNAPSHOT},rows:[DEFAULT_ROW()]};
  const template=$('signingTemplate');
  const inputFor=(card,key)=>card.querySelector('[data-key="'+key+'"]');
  function updateBaseFromFields(){
    const b=state.base;
    b.balance=sane($('baseBalance').value,true);
    b.capUsed=sane($('baseCapUsed').value);
    b.capLimit=Math.max(1,sane($('salaryCap').value));
    b.reserved=sane($('reservedMoney').value);
    b.profit=sane($('baseProfit').value,true);
    b.marketHalf=Number($('marketHalf').value)===0?0:1;
    updateAll();
  }
  function renderBaseFields(){
    $('baseBalance').value=state.base.balance;
    $('baseCapUsed').value=state.base.capUsed;
    $('salaryCap').value=state.base.capLimit;
    $('reservedMoney').value=state.base.reserved;
    $('baseProfit').value=state.base.profit;
    $('marketHalf').value=String(state.base.marketHalf);
  }
  function renderCards(){
    list.replaceChildren();
    state.rows.forEach((row,index)=>{
      const card=template.content.firstElementChild.cloneNode(true);
      card.dataset.id=String(row.id);
      card.querySelector('.slot-number').textContent=String(index+1).padStart(2,'0');
      for(const key of ['name','division','salary','halves','buyout'])inputFor(card,key).value=row[key];
      inputFor(card,'payClause').checked=Boolean(row.payClause);
      const syncClause=()=>{
        card.querySelector('.buyout-field').hidden=!row.payClause;
        card.querySelector('.clause-toggle').classList.toggle('enabled',Boolean(row.payClause));
        card.querySelector('.slot-title').textContent=row.payClause?'FICHAJE CON CLÁUSULA':'NUEVO FICHAJE';
      };
      syncClause();
      card.querySelectorAll('[data-key]').forEach(input=>{
        const key=input.dataset.key;
        const update=()=>{
          row[key]=key==='payClause'?input.checked
            :['salary','buyout','halves'].includes(key)?sane(input.value):input.value;
          if(key==='halves')row.halves=Math.max(1,Math.min(4,Math.floor(row.halves)));
          if(key==='payClause')syncClause();
          updateAll();
        };
        if(key==='payClause'||input.tagName==='SELECT')input.addEventListener('change',update);
        else input.addEventListener('input',update);
      });
      card.querySelector('.remove-signing').addEventListener('click',()=>{
        state.rows=state.rows.filter(x=>x.id!==row.id);
        renderCards();
        updateAll();
      });
      card.querySelector('.use-max').addEventListener('click',()=>{
        row.salary=maxSalary(state.rows,state.base,row.id);
        inputFor(card,'salary').value=row.salary;
        updateAll();
      });
      list.appendChild(card);
    });
  }
  function renderCardFigures(){
    for(const row of state.rows){
      const card=list.querySelector('[data-id="'+row.id+'"]');
      if(!card)continue;
      const immediate=round2(sane(row.salary)+clause(row));
      const cap=capAllocation(row.salary,row.halves,state.base.marketHalf);
      const max=maxSalary(state.rows,state.base,row.id);
      card.querySelector('.row-cost').textContent=money(immediate)+' M';
      card.querySelector('.row-cap').textContent=money(cap)+' M';
      card.querySelector('.row-max').textContent=money(max)+' M';
      const warnings=[];
      const recommendedMinimum=row.division==='academy'?20:40;
      if(sane(row.salary)<recommendedMinimum)warnings.push('Por debajo del mínimo orientativo de '+recommendedMinimum+' M para nuevos pilotos de esta división.');
      if(row.payClause && !sane(row.buyout))warnings.push('Has marcado la cláusula, pero su importe está a 0 M.');
      if(max<recommendedMinimum)warnings.push('Con el resto de operaciones y la cláusula indicada, no queda margen para una oferta mínima de esta división.');
      const warn=card.querySelector('.signing-warning');
      warn.textContent=warnings.join(' ');
      warn.hidden=!warnings.length;
    }
  }
  const fmtDelta=n=>(n<0?'+':'−')+money(Math.abs(n))+' M';
  function updateAll(){
    const b=state.base;
    const res=calculate(state.rows,b);
    $('baseAvailable').innerHTML=money(res.available)+' <small>M</small>';
    $('baseUsedCap').innerHTML=money(b.capUsed)+' <small>M</small>';
    $('baseHeadroom').innerHTML=money(Math.max(0,b.capLimit-b.capUsed))+' <small>M</small>';
    $('baseTax').innerHTML=money(res.oldLuxury)+' <small>M</small>';
    $('moneyLeft').innerHTML=money(res.remaining)+' <span>M</span>';
    $('moneyLeft').classList.toggle('bad',res.remaining<0);
    const st=$('resultStatus');
    st.className='status-label'+(res.remaining<0?' bad':res.over>0?' warn':'');
    st.textContent=res.remaining<0?'NO VIABLE':res.over>0?'VIABLE · CON IMPUESTO':'VIABLE';
    $('resultText').textContent=res.remaining<0
      ?'El presupuesto terminaría en negativo. Reduce el importe, la cláusula o elimina operaciones.'
      :res.over>0
      ?'Puedes pagarlo, pero superar el salary cap genera un impuesto adicional.'
      :'Las operaciones son asumibles con el saldo actual, sin exceder el cap.';
    $('capProgressText').textContent=money(res.capNew)+' / '+money(b.capLimit)+' M';
    const fill=$('capFill');
    fill.style.width=Math.min(100,Math.max(0,res.capNew/b.capLimit*100))+'%';
    fill.classList.toggle('over',res.over>0);
    $('capFreeLabel').textContent=money(Math.max(0,b.capLimit-res.capNew))+' M libres de cap';
    $('capOverLabel').textContent='+'+money(res.over)+' M exceso';
    $('factImmediate').textContent=money(res.immediate)+' M';
    $('factCap').textContent=money(res.capImpact)+' M';
    $('factLuxury').textContent=money(res.newLuxury)+' M';
    $('breakStart').textContent=money(res.available)+' M';
    $('breakSalaries').textContent='−'+money(res.salaries)+' M';
    $('breakBuyouts').textContent='−'+money(res.buyouts)+' M';
    $('breakLuxury').textContent=fmtDelta(res.luxuryChange);
    $('breakFairPlay').textContent=fmtDelta(res.ffpChange);
    $('breakEnd').textContent=money(res.remaining)+' M';
    $('breakEnd').style.color=res.remaining<0?'var(--red)':'var(--yellow)';
    renderCardFigures();
  }
  function addSigning(){
    state.rows.push({...DEFAULT_ROW(),salary:0,halves:2});
    renderCards();
    updateAll();
    const last=list.lastElementChild;
    if(last)last.scrollIntoView({behavior:'smooth',block:'nearest'});
    const input=last?.querySelector('[data-key="name"]');
    if(input)input.focus({preventScroll:true});
  }
  $('addSigning').addEventListener('click',addSigning);
  $('addSigningBottom').addEventListener('click',addSigning);
  $('toggleBase').addEventListener('click',()=>{
    const panel=$('baseEditor');
    panel.hidden=!panel.hidden;
    $('toggleBase').setAttribute('aria-expanded',String(!panel.hidden));
    $('toggleBase').querySelector('span').textContent=panel.hidden?'⌄':'⌃';
  });
  $('resetBase').addEventListener('click',()=>{
    state.base={...SNAPSHOT};
    renderBaseFields();
    updateAll();
  });
  ['baseBalance','baseCapUsed','salaryCap','reservedMoney','baseProfit','marketHalf'].forEach(id=>{
    $(id).addEventListener('input',updateBaseFromFields);
    $(id).addEventListener('change',updateBaseFromFields);
  });
  renderBaseFields();
  renderCards();
  updateAll();
})();
