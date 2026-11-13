(() => {
  const config=window.HYPERDRIVE_CONFIG;
  const client=window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const adminContent=document.getElementById('adminContent');
  const select=document.getElementById('adminBankDriverSelect');
  const empty=document.getElementById('adminBankEmpty');
  const content=document.getElementById('adminBankContent');
  if(!adminContent||!select||!empty||!content) return;

  const $=id=>document.getElementById(id);
  const money=v=>Number(v||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2});
  const dt=v=>v?new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'—';

  function renderHistory(items){
    const body=$('adminBankHistoryBody');
    body.innerHTML='';
    if(!items.length){
      const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=4;td.textContent='No hay movimientos registrados.';tr.appendChild(td);body.appendChild(tr);return;
    }
    items.forEach(item=>{
      const tr=document.createElement('tr');
      [dt(item.transaction_at),item.description||'Movimiento',item.category||'—'].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.appendChild(td);});
      const amount=document.createElement('td');
      const income=item.direction==='income';
      amount.className=income?'admin-bank-positive':'admin-bank-negative';
      amount.textContent=(income?'+':'−')+money(item.amount_m)+' M';
      tr.appendChild(amount);body.appendChild(tr);
    });
  }

  async function loadBank(driverId){
    empty.textContent='Cargando banco…';
    empty.classList.remove('is-hidden');
    content.classList.add('is-hidden');

    const [dashRes,historyRes]=await Promise.all([
      client.rpc('admin_driver_bank_dashboard',{p_driver_id:driverId}),
      client.rpc('admin_driver_bank_history',{p_driver_id:driverId,p_limit:120})
    ]);
    const bad=[dashRes,historyRes].find(r=>r.error);
    if(bad){
      console.error(bad.error);
      empty.textContent=bad.error?.message||'No se pudo cargar el banco del piloto.';
      return;
    }
    const data=Array.isArray(dashRes.data)?dashRes.data[0]:dashRes.data;
    if(!data){empty.textContent='No se encontró el banco del piloto.';return;}

    $('adminBankPilotName').textContent='#'+(data.race_number??'--')+' '+(data.nickname||'Piloto');
    $('adminBankPilotContext').textContent=(data.current_team_name||'Sin escudería')+' · '+(data.current_division==='academy'?'Academy':data.current_division==='hyperdrive'?'HyperDrive':'Sin división');
    $('adminBankAvailable').textContent=money(data.available_balance_m)+' M';
    $('adminBankCurrent').textContent=money(data.current_balance_m)+' M';
    $('adminBankReserved').textContent=money(data.reserved_balance_m)+' M';
    renderHistory(historyRes.data||[]);
    empty.classList.add('is-hidden');
    content.classList.remove('is-hidden');
  }

  async function init(){
    const {data:{session}}=await client.auth.getSession();if(!session)return;
    const [adminRes,driversRes]=await Promise.all([
      client.from('user_roles').select('role').eq('user_id',session.user.id).eq('role','admin').maybeSingle(),
      client.from('drivers').select('id,nickname,race_number,is_active').order('nickname')
    ]);
    if(!adminRes.data||driversRes.error)return;
    select.innerHTML='<option value="">Selecciona un piloto</option>';
    (driversRes.data||[]).forEach(d=>{
      const o=document.createElement('option');o.value=d.id;o.textContent='#'+(d.race_number??'--')+' · '+d.nickname+(d.is_active?'':' · INACTIVO');select.appendChild(o);
    });
  }

  select.addEventListener('change',()=>{
    if(!select.value){content.classList.add('is-hidden');empty.textContent='Selecciona un piloto para ver su Banco del Piloto.';empty.classList.remove('is-hidden');return;}
    loadBank(select.value);
  });

  if(!adminContent.classList.contains('is-hidden')) init();
  else{
    const observer=new MutationObserver(()=>{if(!adminContent.classList.contains('is-hidden')){observer.disconnect();init();}});
    observer.observe(adminContent,{attributes:true,attributeFilter:['class']});
  }
})();

// Ranking de bancos de escuderías. Usa las mismas vistas y criterios que el panel de Team Principal.
(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const root = document.getElementById('adminTeamRankingList');
  const status = document.getElementById('adminTeamRankingStatus');
  const refresh = document.getElementById('adminTeamRankingRefresh');
  const adminContent = document.getElementById('adminContent');
  if (!config || !root || !status || !adminContent || !window.supabase) return;

  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const fmt = value => Number(value || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPercent = value => value.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const number = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  function renderRanking(accounts, summaries, sponsors) {
    const financeById = new Map(summaries.map(row => [row.team_account_id, row]));
    const objectivesById = new Map();
    sponsors.forEach(item => {
      const key = item.team_account_id;
      if (!objectivesById.has(key)) objectivesById.set(key, {
        academy: { done: 0, total: 0 },
        hyperdrive: { done: 0, total: 0 }
      });
      const division = objectivesById.get(key)[item.division];
      if (!division || !item.is_active) return;
      division.total += 1;
      if (item.is_completed) division.done += 1;
    });

    const ranking = accounts
      .filter(account => account.teams?.is_active !== false)
      .map(account => ({
        account,
        finance: financeById.get(account.id),
        objectives: objectivesById.get(account.id) || {
          academy: { done: 0, total: 0 },
          hyperdrive: { done: 0, total: 0 }
        }
      }))
      .filter(item => item.finance)
      .sort((a, b) => number(b.finance.net_balance_m) - number(a.finance.net_balance_m));

    root.innerHTML = '';
    if (!ranking.length) {
      status.textContent = 'No hay bancos de escuderías con datos económicos para esta temporada.';
      return;
    }

    root.innerHTML = ranking.map(({account, finance, objectives}, index) => {
      const balance = number(finance.net_balance_m);
      const income = number(finance.total_income_m);
      const expense = number(finance.total_expense_m);
      const profit = number(finance.season_profit_m);
      const cap = number(finance.salary_cap_m);
      const capUsed = number(finance.active_contract_value_m);
      const capPercent = cap > 0 ? (capUsed / cap) * 100 : null;
      const percentWidth = capPercent === null ? 0 : Math.min(100, Math.max(0, capPercent));
      const positive = value => value >= 0 ? 'positive' : 'negative';
      const signed = value => (value > 0 ? '+' : value < 0 ? '−' : '') + fmt(Math.abs(value)) + ' M';
      return `
        <article class="admin-team-ranking-entry">
          <div class="admin-team-ranking-lead">
            <span class="admin-team-ranking-position">${index + 1}º</span>
            <div class="admin-team-ranking-identity">
              <strong>${esc(finance.team_name || account.teams?.name || 'Escudería')}</strong>
              <small>SALDO ACTUAL NETO</small>
              <span class="admin-team-ranking-balance ${positive(balance)}">${fmt(balance)} M</span>
            </div>
          </div>
          <div class="admin-team-ranking-details">
            <div class="admin-team-ranking-stat objectives">
              <span class="admin-team-ranking-label">OBJETIVOS CUMPLIDOS</span>
              <div class="admin-team-ranking-objective"><span>Academy</span><strong>${objectives.academy.done}/${objectives.academy.total}</strong></div>
              <div class="admin-team-ranking-objective"><span>HyperDrive</span><strong>${objectives.hyperdrive.done}/${objectives.hyperdrive.total}</strong></div>
            </div>
            <div class="admin-team-ranking-stat cap">
              <span class="admin-team-ranking-label">SALARY CAP UTILIZADO</span>
              <strong class="${capPercent !== null && capPercent > 100 ? 'negative' : ''}">${capPercent === null ? '—' : fmtPercent(capPercent) + '%'}</strong>
              <div class="admin-team-ranking-captrack"><span style="width:${percentWidth}%"></span></div>
              <small>${fmt(capUsed)} / ${fmt(cap)} M</small>
            </div>
            <div class="admin-team-ranking-stat">
              <span class="admin-team-ranking-label">INGRESOS</span>
              <strong class="positive">+${fmt(income)} M</strong>
            </div>
            <div class="admin-team-ranking-stat">
              <span class="admin-team-ranking-label">GASTOS</span>
              <strong class="negative">−${fmt(expense)} M</strong>
            </div>
            <div class="admin-team-ranking-stat">
              <span class="admin-team-ranking-label">BALANCE INGRESOS − GASTOS</span>
              <strong class="${positive(profit)}">${signed(profit)}</strong>
            </div>
          </div>
        </article>`;
    }).join('');
    status.textContent = `Temporada ${config.currentSeason} · ${ranking.length} escuderías · Ordenadas por saldo neto actual, de mayor a menor.`;
  }

  let loading = false;
  async function loadRanking() {
    if (loading) return;
    loading = true;
    if (refresh) refresh.disabled = true;
    status.textContent = 'Actualizando saldos y objetivos…';
    try {
      const [accountsResponse, summariesResponse] = await Promise.all([
        client.from('team_accounts')
          .select('id,team_id,teams:team_id(name,is_active)')
          .eq('season_number', config.currentSeason)
          .eq('is_active', true),
        client.from('team_financial_summary')
          .select('team_account_id,team_name,season_number,net_balance_m,total_income_m,total_expense_m,season_profit_m,salary_cap_m,active_contract_value_m')
          .eq('season_number', config.currentSeason)
      ]);
      if (accountsResponse.error || summariesResponse.error) throw (accountsResponse.error || summariesResponse.error);
      const accounts = accountsResponse.data || [];
      if (!accounts.length) {
        root.textContent = '';
        status.textContent = 'No hay bancos activos para esta temporada.';
        return;
      }
      const {data: sponsors, error: sponsorsError} = await client.from('team_sponsor_rewards')
        .select('team_account_id,division,is_completed,is_active')
        .in('team_account_id', accounts.map(item => item.id))
        .eq('is_active', true);
      if (sponsorsError) throw sponsorsError;
      renderRanking(accounts, summariesResponse.data || [], sponsors || []);
    } catch (error) {
      console.error('No se pudo cargar el ranking económico de escuderías:', error);
      root.textContent = '';
      status.textContent = 'No se pudieron cargar los saldos, contratos y objetivos. Vuelve a intentarlo.';
    } finally {
      loading = false;
      if (refresh) refresh.disabled = false;
    }
  }

  async function init() {
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) return;
    const { data: role, error: roleError } = await client.from('user_roles')
      .select('role').eq('user_id', session.user.id).eq('role', 'admin').maybeSingle();
    if (roleError || !role) {
      status.textContent = 'Solo los administradores pueden consultar este ranking.';
      return;
    }
    if (refresh) refresh.addEventListener('click', loadRanking);
    await loadRanking();
  }
  if (!adminContent.classList.contains('is-hidden')) init();
  else {
    const observer = new MutationObserver(() => {
      if (!adminContent.classList.contains('is-hidden')) {
        observer.disconnect();
        init();
      }
    });
    observer.observe(adminContent, { attributes: true, attributeFilter: ['class'] });
  }
})();
