(() => {
 const $=id=>document.getElementById(id),form=$('sportSanctionForm'),article=$('sanctionArticle');
 if(!form||!window.supabase)return;
 const points=$('customSanctionPoints'),reason=$('customSanctionDescription');
 const c=window.HYPERDRIVE_CONFIG;
 const db=window.supabase.createClient(c.supabaseUrl,c.supabasePublishableKey,{auth:{persistSession:true}});
 let editId=null;
 function sync(){
   const on=article.value==='PERSONALIZADO';
   $('customSanctionPointsWrap').classList.toggle('is-hidden',!on);
   $('customSanctionDescriptionWrap').classList.toggle('is-hidden',!on);
   points.required=reason.required=on;
   if(on){
     $('articleSeconds').textContent='—';
     $('articlePoints').textContent=points.value||'Por indicar';
     $('articleDescription').textContent=reason.value||'Escribe una descripción personalizada.';
   }
 }
 const obs=new MutationObserver(()=>{
   const opt=[...article.options].find(x=>x.value==='PERSONALIZADO');
   if(!opt)return;
   opt.remove();
   const item=new Option('PERSONALIZADO · Introducir puntos y descripción','PERSONALIZADO');
   article.insertBefore(item,article.options[1]||null);
   obs.disconnect();
 });
 obs.observe(article,{childList:true,subtree:true});
 article.addEventListener('change',sync);
 points.addEventListener('input',sync);reason.addEventListener('input',sync);
 window.addEventListener('hyperdrive:edit-sanction',e=>{
   editId=e.detail?.id||null;
   if(e.detail?.article_code==='PERSONALIZADO'){
     points.value=e.detail.points_text||'';
     reason.value=e.detail.description||'';
   }else{points.value='';reason.value='';}
   sync();
 });
 $('cancelSanctionEdit')?.addEventListener('click',()=>{editId=null;points.value='';reason.value='';sync();});
 form.addEventListener('submit',async e=>{
   if(article.value!=='PERSONALIZADO')return;
   e.preventDefault();e.stopImmediatePropagation();
   const status=$('sanctionStatus'),report=(msg,error=true)=>{
     status.textContent=msg;status.className='operation-status '+(error?'error':'success');
   };
   const number=Number(points.value),desc=reason.value.trim();
   if(points.value.trim()===''||!Number.isInteger(number)||number<0||number>99)return report('Indica de 0 a 99 puntos enteros.');
   if(desc.length<3||desc.length>500)return report('Escribe una descripción de 3 a 500 caracteres.');
   const driver=$('sanctionDriver').value,team=$('sanctionTeam').value,benefit=$('beneficiaryTeam').value||null,date=$('sanctionDate').value;
   if(!driver||!team||!date)return report('Selecciona piloto, escudería y fecha.');
   if(team===benefit)return report('La escudería beneficiada debe ser diferente.');
   const editing=!$('cancelSanctionEdit').classList.contains('is-hidden');
   if(editing&&!editId)return report('No se encuentra la sanción original.');
   if(!confirm((editing?'¿Modificar':'¿Registrar')+' sanción PERSONALIZADA?\\nPuntos: -'+number+'\\nMotivo: '+desc))return;
   const submit=$('sanctionSubmit');submit.disabled=true;
   const args={p_driver_id:driver,p_article_code:'PERSONALIZADO',p_team_id:team,p_beneficiary_team_id:benefit,p_round_number:Number($('sanctionRound').value)||null,p_sanction_date:date,p_season_number:c.currentSeason,p_custom_points:number,p_custom_description:desc};
   if(editing)args.p_sanction_id=editId;
   let error;
   try{({error}=await db.rpc(editing?'staff_edit_custom_sporting_sanction':'staff_apply_custom_sporting_sanction',args))}
   catch(err){error=err}
   submit.disabled=false;
   if(error)return report(error.message||'Error al guardar.');
   report('Sanción registrada; superlicencia actualizada.',false);
   setTimeout(()=>location.reload(),650);
 },true);
})();