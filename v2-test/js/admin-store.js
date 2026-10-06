(() => {
  const config = window.HYPERDRIVE_CONFIG;
  if (!config || !window.supabase) return;

  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const tabs = [...document.querySelectorAll('[data-admin-tab]')];
  const storeSection = document.getElementById('adminStoreSection');
  const form = document.getElementById('storeProductForm');
  const idInput = document.getElementById('storeProductId');
  const nameInput = document.getElementById('storeProductName');
  const priceInput = document.getElementById('storeProductPrice');
  const descriptionInput = document.getElementById('storeProductDescription');
  const categoryInput = document.getElementById('storeProductCategory');
  const urlInput = document.getElementById('storeProductUrl');
  const fileInput = document.getElementById('storeProductImages');
  const preview = document.getElementById('storeImagePreview');
  const list = document.getElementById('storeAdminList');
  const submitButton = document.getElementById('storeSubmitButton');
  const cancelButton = document.getElementById('storeCancelEdit');
  const status = document.getElementById('storeFormStatus');
  const formTitle = document.getElementById('storeFormTitle');

  if (!form || !list || !storeSection) return;

  let products = [];
  let currentImages = [];
  let pendingFiles = [];
  let draggedId = null;
  let isAdmin = false;

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(16).slice(2);

  function setStatus(message, type = '') {
    status.textContent = message || '';
    status.className = 'admin-store-status' + (type ? ' ' + type : '');
  }

  function switchTab(tab) {
    const store = tab === 'store';
    document.body.classList.toggle('admin-store-active', store);
    tabs.forEach(button => button.classList.toggle('is-active', button.dataset.adminTab === tab));
    storeSection.hidden = !store;
    if (store) {
      history.replaceState(null, '', '#tienda');
      if (isAdmin) loadProducts();
    } else if (location.hash === '#tienda') {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  tabs.forEach(button => button.addEventListener('click', () => switchTab(button.dataset.adminTab)));

  function renderPreview() {
    const existing = currentImages.map((url, index) => ({
      type: 'existing',
      key: 'e-' + index,
      url,
      label: 'SUBIDA'
    }));
    const pending = pendingFiles.map((file, index) => ({
      type: 'pending',
      key: 'p-' + index,
      url: URL.createObjectURL(file),
      label: 'NUEVA'
    }));
    const all = [...existing, ...pending];

    preview.innerHTML = all.map(item =>
      '<div class="admin-store-image-chip">' +
        '<img src="' + esc(item.url) + '" alt="">' +
        '<button type="button" data-remove-image="' + esc(item.key) + '" aria-label="Eliminar foto">×</button>' +
        '<small>' + item.label + '</small>' +
      '</div>'
    ).join('');
  }

  preview.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-image]');
    if (!button) return;
    const [type, indexText] = button.dataset.removeImage.split('-');
    const index = Number(indexText);
    if (type === 'e') currentImages.splice(index, 1);
    if (type === 'p') pendingFiles.splice(index, 1);
    renderPreview();
  });

  fileInput.addEventListener('change', () => {
    const files = [...fileInput.files].filter(file => file.type.startsWith('image/'));
    pendingFiles.push(...files);
    fileInput.value = '';
    renderPreview();
  });

  function resetForm() {
    form.reset();
    idInput.value = '';
    currentImages = [];
    pendingFiles = [];
    renderPreview();
    formTitle.textContent = 'Crear producto';
    submitButton.textContent = 'SUBIR PRODUCTO';
    cancelButton.classList.add('is-hidden');
    setStatus('');
  }

  cancelButton.addEventListener('click', resetForm);

  async function ensureAdmin() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return false;
    const { data, error } = await client.from('user_roles').select('role').eq('user_id', session.user.id).eq('role', 'admin').maybeSingle();
    return !error && !!data;
  }

  async function loadProducts() {
    list.innerHTML = '<div class="empty-line">Cargando productos…</div>';
    const { data, error } = await client
      .from('store_products')
      .select('id,name,price,description,buy_url,image_urls,category,sort_order,is_active,created_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error(error);
      list.innerHTML = '<div class="empty-line">No se pudieron cargar los productos.</div>';
      return;
    }

    products = data || [];
    renderList();
  }

  function renderList() {
    if (!products.length) {
      list.innerHTML = '<div class="empty-line">Todavía no hay productos.</div>';
      return;
    }

    list.innerHTML = products.map((product, index) => {
      const image = Array.isArray(product.image_urls) ? product.image_urls[0] : '';
      return '<article class="admin-store-item" draggable="true" data-product-id="' + esc(product.id) + '">' +
        '<div class="admin-store-drag" title="Arrastrar">⋮⋮</div>' +
        '<div class="admin-store-thumb">' + (image ? '<img src="' + esc(image) + '" alt="">' : '') + '</div>' +
        '<div class="admin-store-info">' +
          '<strong>' + esc(product.name) + '</strong>' +
          '<p>' + esc(product.description) + '</p>' +
          '<div class="admin-store-meta"><span>' + esc(product.price) + '</span><span>' + esc(product.category) + '</span><span>' + (product.image_urls?.length || 0) + ' fotos</span></div>' +
        '</div>' +
        '<div class="admin-store-actions">' +
          '<div class="admin-store-order-buttons">' +
            '<button type="button" data-move="up" ' + (index === 0 ? 'disabled' : '') + '>↑</button>' +
            '<button type="button" data-move="down" ' + (index === products.length - 1 ? 'disabled' : '') + '>↓</button>' +
          '</div>' +
          '<button type="button" data-edit-product>EDITAR</button>' +
          '<button type="button" class="danger" data-delete-product>ELIMINAR</button>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function productFromRow(row) {
    return products.find(item => item.id === row?.dataset.productId);
  }

  list.addEventListener('click', async event => {
    const row = event.target.closest('.admin-store-item');
    const product = productFromRow(row);
    if (!product) return;

    if (event.target.closest('[data-edit-product]')) {
      idInput.value = product.id;
      nameInput.value = product.name || '';
      priceInput.value = product.price || '';
      descriptionInput.value = product.description || '';
      categoryInput.value = product.category || 'ropa';
      urlInput.value = product.buy_url || '';
      currentImages = Array.isArray(product.image_urls) ? [...product.image_urls] : [];
      pendingFiles = [];
      renderPreview();
      formTitle.textContent = 'Editar producto';
      submitButton.textContent = 'GUARDAR CAMBIOS';
      cancelButton.classList.remove('is-hidden');
      setStatus('');
      window.scrollTo({ top: storeSection.offsetTop, behavior: 'smooth' });
      return;
    }

    if (event.target.closest('[data-delete-product]')) {
      if (!confirm('¿Eliminar "' + product.name + '" de la tienda?')) return;
      await deleteProduct(product);
      return;
    }

    const move = event.target.closest('[data-move]')?.dataset.move;
    if (move) {
      const from = products.findIndex(item => item.id === product.id);
      const to = move === 'up' ? from - 1 : from + 1;
      if (to < 0 || to >= products.length) return;
      [products[from], products[to]] = [products[to], products[from]];
      renderList();
      await persistOrder();
    }
  });

  list.addEventListener('dragstart', event => {
    const row = event.target.closest('.admin-store-item');
    if (!row) return;
    draggedId = row.dataset.productId;
    row.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
  });

  list.addEventListener('dragend', event => {
    event.target.closest('.admin-store-item')?.classList.remove('is-dragging');
    draggedId = null;
  });

  list.addEventListener('dragover', event => {
    event.preventDefault();
    const targetRow = event.target.closest('.admin-store-item');
    if (!targetRow || !draggedId || targetRow.dataset.productId === draggedId) return;
    const from = products.findIndex(item => item.id === draggedId);
    const to = products.findIndex(item => item.id === targetRow.dataset.productId);
    if (from < 0 || to < 0) return;
    const [moved] = products.splice(from, 1);
    products.splice(to, 0, moved);
    renderList();
  });

  list.addEventListener('drop', async event => {
    event.preventDefault();
    if (!draggedId) return;
    await persistOrder();
    draggedId = null;
  });

  async function persistOrder() {
    const updates = products.map((product, index) =>
      client.from('store_products').update({ sort_order: index, updated_at: new Date().toISOString() }).eq('id', product.id)
    );
    const results = await Promise.all(updates);
    const failed = results.find(result => result.error);
    if (failed) {
      console.error(failed.error);
      setStatus('No se pudo guardar el orden.', 'error');
    } else {
      products.forEach((product, index) => product.sort_order = index);
      setStatus('Orden actualizado.', 'ok');
    }
  }

  function storagePathFromUrl(url) {
    const marker = '/storage/v1/object/public/store-products/';
    const pos = String(url).indexOf(marker);
    return pos >= 0 ? decodeURIComponent(String(url).slice(pos + marker.length)) : null;
  }

  async function deleteProduct(product) {
    setStatus('Eliminando producto…');
    const paths = (product.image_urls || []).map(storagePathFromUrl).filter(Boolean);
    if (paths.length) {
      const { error: storageError } = await client.storage.from('store-products').remove(paths);
      if (storageError) console.warn(storageError);
    }

    const { error } = await client.from('store_products').delete().eq('id', product.id);
    if (error) {
      console.error(error);
      setStatus('No se pudo eliminar el producto.', 'error');
      return;
    }

    products = products.filter(item => item.id !== product.id);
    await persistOrder();
    renderList();
    if (idInput.value === product.id) resetForm();
    setStatus('Producto eliminado.', 'ok');
  }

  async function uploadPendingFiles(productId) {
    const urls = [];
    for (const file of pendingFiles) {
      if (file.size > 10 * 1024 * 1024) throw new Error('Una de las imágenes supera los 10 MB.');
      const ext = (file.name.split('.').pop() || 'webp').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = productId + '/' + uid() + '.' + ext;
      const { error } = await client.storage.from('store-products').upload(path, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      const { data } = client.storage.from('store-products').getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!isAdmin) return;

    const name = nameInput.value.trim();
    const price = priceInput.value.trim();
    const description = descriptionInput.value.trim();
    const buyUrl = urlInput.value.trim();
    const category = categoryInput.value;
    const editingId = idInput.value || null;

    if (!name || !price || !description || !buyUrl) {
      setStatus('Completa todos los campos obligatorios.', 'error');
      return;
    }
    if (!editingId && !currentImages.length && !pendingFiles.length) {
      setStatus('Añade al menos una foto.', 'error');
      return;
    }

    submitButton.disabled = true;
    cancelButton.disabled = true;
    setStatus(editingId ? 'Guardando cambios…' : 'Subiendo producto…');

    try {
      const productId = editingId || uid();
      const uploadedUrls = await uploadPendingFiles(productId);
      const imageUrls = [...currentImages, ...uploadedUrls];

      if (!imageUrls.length) throw new Error('El producto necesita al menos una foto.');

      const payload = {
        name,
        price,
        description,
        buy_url: buyUrl,
        image_urls: imageUrls,
        category,
        updated_at: new Date().toISOString()
      };

      if (editingId) {
        const original = products.find(item => item.id === editingId);
        const removedUrls = (original?.image_urls || []).filter(url => !currentImages.includes(url));
        const removedPaths = removedUrls.map(storagePathFromUrl).filter(Boolean);

        const { error } = await client.from('store_products').update(payload).eq('id', editingId);
        if (error) throw error;

        if (removedPaths.length) {
          const { error: removeError } = await client.storage.from('store-products').remove(removedPaths);
          if (removeError) console.warn(removeError);
        }
      } else {
        payload.id = productId;
        payload.sort_order = products.length;
        payload.created_by = (await client.auth.getUser()).data.user?.id || null;
        const { error } = await client.from('store_products').insert(payload);
        if (error) throw error;
      }

      resetForm();
      await loadProducts();
      setStatus(editingId ? 'Producto actualizado.' : 'Producto publicado.', 'ok');
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'No se pudo guardar el producto.', 'error');
    } finally {
      submitButton.disabled = false;
      cancelButton.disabled = false;
    }
  });

  (async () => {
    isAdmin = await ensureAdmin();
    if (!isAdmin) return;
    if (location.hash === '#tienda') switchTab('store');
  })();
})();