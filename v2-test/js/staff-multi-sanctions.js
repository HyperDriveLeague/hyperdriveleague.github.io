(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('sportSanctionForm');
  const first = $('sanctionArticle');
  const extras = $('sanctionExtraArticles');
  const add = $('addSanctionArticle');
  if (!form || !extras) return;
  const config = window.HYPERDRIVE_CONFIG;
  const db = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true }
  });
  let catalog = new Map();
  let editing = null;
  let busy = false;
  const manual = code => ['MANUAL_NO_QUALY', 'MANUAL_RACE_BAN'].includes(code);
  const selectors = () => [first, ...extras.querySelectorAll('select')];
  const multi = () => selectors().length > 1 || !!editing?.article_details?.length;

  function selectedArticles() {
    return selectors().map(select => {
      const result = { code: select.value };
      if (result.code === 'PERSONALIZADO') {
        result.points = Number($('customSanctionPoints').value);
        result.description = $('customSanctionDescription').value.trim();
      }
      return result;
    });
  }

  function sumText(rows, field) {
    let sum = 0;
    const special = [];
    for (const row of rows) {
      const value = String(row?.[field] ?? '').trim();
      if (/^[0-9]+(?:\.[0-9]+)?$/.test(value)) sum += Number(value);
      else if (value && !['-', '—'].includes(value)) special.push(value);
    }
    return [sum || (special.length ? '' : '0'), ...special].filter(value => value !== '').join(' + ');
  }

  function preview() {
    add.hidden = manual(first.value);
    add.disabled = busy || !catalog.size;
    if (manual(first.value)) extras.replaceChildren();
    const noPov = selectors().some(select => select.value === 'NO_POV');
    $('beneficiaryTeam').disabled = noPov;
    if (noPov) $('beneficiaryTeam').value = '';
    $('sanctionMultiNote').textContent = noPov
      ? 'No aportar POV: 1 punto y multa única de 2 M, sin escudería beneficiada.'
      : 'Se suman los segundos y puntos. Traspaso total por reclamación con escudería beneficiada: 0,50 M.';
    if (!multi()) return;
    const rows = selectedArticles().map(item => {
      const row = catalog.get(item.code);
      if (item.code !== 'PERSONALIZADO') return row;
      return { ...row, points_text: String(item.points), description: item.description };
    }).filter(Boolean);
    $('articleSeconds').textContent = sumText(rows, 'seconds_text');
    $('articlePoints').textContent = sumText(rows, 'points_text');
    $('articleDescription').textContent = rows.map(row => row.article_code + ' · ' + row.description).join('\n');
  }

  function appendArticle(code = '') {
    const label = document.createElement('label');
    label.className = 'op-field full';
    const title = document.createElement('span');
    title.textContent = 'Artículo adicional';
    const select = document.createElement('select');
    select.className = 'op-select';
    select.required = true;
    select.append(new Option('Selecciona un artículo', ''));
    for (const row of catalog.values()) {
      if (manual(row.article_code) || row.article_code === 'PERSONALIZADO') continue;
      select.append(new Option(row.article_code + ' · ' + row.description, row.article_code));
    }
    select.value = code;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary-button';
    remove.textContent = 'Quitar artículo';
    remove.addEventListener('click', () => {
      label.remove();
      first.dispatchEvent(new Event('change'));
    });
    select.addEventListener('change', preview);
    label.append(title, select, remove);
    extras.append(label);
    preview();
  }

  add.addEventListener('click', () => appendArticle());
  form.addEventListener('change', () => queueMicrotask(preview));
  form.addEventListener('input', () => queueMicrotask(preview));
  form.addEventListener('reset', () => {
    editing = null;
    extras.replaceChildren();
    queueMicrotask(preview);
  });
  window.addEventListener('hyperdrive:edit-sanction', event => {
    editing = event.detail;
    extras.replaceChildren();
    const restore = () => {
      extras.replaceChildren();
      (editing?.article_details || []).slice(1).forEach(item => appendArticle(item.code));
      queueMicrotask(preview);
    };
    if (catalog.size) restore();
    else ready.then(restore);
  });

  const ready = db.from('sporting_sanction_articles')
    .select('article_code,description,seconds_text,points_text,sort_order')
    .eq('is_active', true).order('sort_order')
    .then(({data, error}) => {
      if (error) {
        $('sanctionMultiNote').textContent = 'No se pudieron cargar los artículos adicionales. Recarga para reintentar.';
        return;
      }
      catalog = new Map(data.map(row => [row.article_code, row]));
      preview();
    });
  add.disabled = true;

  form.addEventListener('submit', async event => {
    if (!multi() || manual(first.value)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (busy) return;
    const status = $('sanctionStatus');
    const fail = text => { status.textContent = text; status.className = 'operation-status error'; };
    if (!form.reportValidity()) return;
    const articles = selectedArticles();
    if (articles.some(item => !catalog.has(item.code))) return fail('Selecciona todos los artículos.');
    if (new Set(articles.map(item => item.code)).size !== articles.length) return fail('Cada artículo debe seleccionarse una sola vez.');
    const team = $('sanctionTeam').value;
    const beneficiary = $('beneficiaryTeam').value || null;
    if (team === beneficiary) return fail('La escudería beneficiada debe ser diferente.');
    const isEdit = !$('cancelSanctionEdit').classList.contains('is-hidden');
    if (isEdit && !editing?.id) return fail('Vuelve a abrir la sanción para editarla.');
    preview();
    const message = (isEdit ? '¿Guardar cambios?' : '¿Registrar sanción?') + '\n' +
      articles.map(item => item.code).join(' + ') + '\nSegundos: ' + $('articleSeconds').textContent +
      '\nPuntos: ' + $('articlePoints').textContent +
      (articles.some(item => item.code === 'NO_POV') ? '\nMulta a la escudería: 2 M, sin beneficiario.' : beneficiary ? '\nTraspaso total: 0,50 M.' : '');
    if (!window.confirm(message)) return;
    busy = true;
    $('sanctionSubmit').disabled = true;
    add.disabled = true;
    try {
      const {error} = await db.rpc('staff_apply_multi_sporting_sanction', {
        p_driver_id: $('sanctionDriver').value,
        p_articles: articles,
        p_team_id: team,
        p_beneficiary_team_id: beneficiary,
        p_round_number: Number($('sanctionRound').value) || null,
        p_sanction_date: $('sanctionDate').value,
        p_season_number: config.currentSeason,
        p_sanction_id: isEdit ? editing.id : null
      });
      if (error) throw error;
      status.textContent = 'Sanción registrada con sus puntos y movimiento económico.';
      status.className = 'operation-status success';
      window.setTimeout(() => window.location.reload(), 650);
    } catch (error) {
      fail(error.message || 'No se pudo guardar la sanción.');
      busy = false;
      $('sanctionSubmit').disabled = false;
      preview();
    }
  }, true);
})();
