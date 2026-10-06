// ========================================
// HYPERDRIVE STORE
// Catálogo conectado a Supabase
// ========================================

(() => {
    const grid = document.getElementById('store-grid');
    const filterContainer = document.getElementById('store-filters');
    const modal = document.getElementById('store-gallery-modal');
    const modalImage = document.getElementById('store-gallery-image');
    const modalThumbs = document.getElementById('store-gallery-thumbs');
    const prevBtn = document.getElementById('store-gallery-prev');
    const nextBtn = document.getElementById('store-gallery-next');

    if (!grid) return;

    const SUPABASE_URL = 'https://knyxattsjimsjefydcad.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_hLAzZZF6kki1xZ0Kyx6lfA_97kzSAmf';
    const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);

    let products = [];
    let activeFilter = 'all';
    let activeGallery = [];
    let activeGalleryIndex = 0;

    const escapeHTML = value => String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    const renderGallery = () => {
        if (!activeGallery.length || !modalImage || !modalThumbs) return;
        modalImage.src = activeGallery[activeGalleryIndex];
        modalThumbs.innerHTML = activeGallery.map((src, index) =>
            '<button type="button" class="store-gallery-thumb ' + (index === activeGalleryIndex ? 'active' : '') +
            '" data-gallery-index="' + index + '" aria-label="Ver imagen ' + (index + 1) + '">' +
            '<img src="' + escapeHTML(src) + '" alt="">' +
            '</button>'
        ).join('');
    };

    const openGallery = images => {
        if (!modal || !Array.isArray(images) || !images.length) return;
        activeGallery = images.filter(Boolean);
        activeGalleryIndex = 0;
        renderGallery();
        modal.hidden = false;
        document.body.classList.add('gallery-open');
    };

    const closeGallery = () => {
        if (!modal) return;
        modal.hidden = true;
        document.body.classList.remove('gallery-open');
        activeGallery = [];
        activeGalleryIndex = 0;
    };

    const showPrev = () => {
        if (!activeGallery.length) return;
        activeGalleryIndex = (activeGalleryIndex - 1 + activeGallery.length) % activeGallery.length;
        renderGallery();
    };

    const showNext = () => {
        if (!activeGallery.length) return;
        activeGalleryIndex = (activeGalleryIndex + 1) % activeGallery.length;
        renderGallery();
    };

    const renderProduct = product => {
        const name = escapeHTML(product.name);
        const description = escapeHTML(product.description);
        const category = escapeHTML(product.category || 'ropa');
        const price = escapeHTML(product.price || 'VER PRECIO');
        const gallery = Array.isArray(product.gallery) ? product.gallery.filter(Boolean) : [];
        const image = gallery[0] || '';
        const hoverImage = gallery[1] || '';
        const buyUrl = String(product.buyUrl || '').trim();

        const media = image
            ? '<button class="store-product-gallery-trigger" type="button" data-product-id="' + escapeHTML(product.id) + '" aria-label="Ver galería de ' + name + '">' +
                '<div class="store-product-image-stack ' + (hoverImage ? 'has-hover-image' : '') + '">' +
                    '<img class="product-photo primary-photo" src="' + escapeHTML(image) + '" alt="' + name + '" loading="lazy">' +
                    (hoverImage ? '<img class="product-photo hover-photo" src="' + escapeHTML(hoverImage) + '" alt="Segunda vista de ' + name + '" loading="lazy">' : '') +
                '</div>' +
                (gallery.length > 1 ? '<span class="store-gallery-hint">VER ' + gallery.length + ' FOTOS</span>' : '') +
              '</button>'
            : '<div class="store-placeholder"><img src="images/logo/hyperdrive-logo.png" alt="" aria-hidden="true"><span>SIN FOTO</span></div>';

        const action = buyUrl
            ? '<a class="store-buy" href="' + escapeHTML(buyUrl) + '" target="_blank" rel="noopener noreferrer">COMPRAR →</a>'
            : '<span class="store-buy-disabled" aria-disabled="true">NO DISPONIBLE</span>';

        return '<article class="store-product" data-category="' + category + '">' +
            '<div class="store-product-media">' +
                '<span class="store-product-badge">OFICIAL</span>' +
                media +
            '</div>' +
            '<div class="store-product-body">' +
                '<span class="store-product-category">' + category + '</span>' +
                '<h3>' + name + '</h3>' +
                '<p class="store-product-description">' + description + '</p>' +
                '<div class="store-product-footer">' +
                    '<strong class="store-price">' + price + '</strong>' +
                    action +
                '</div>' +
            '</div>' +
        '</article>';
    };

    const render = () => {
        const visibleProducts = activeFilter === 'all'
            ? products
            : products.filter(product => product.category === activeFilter);

        if (!visibleProducts.length) {
            grid.innerHTML = '<div class="store-empty">NO HAY PRODUCTOS EN ESTA CATEGORÍA.</div>';
            return;
        }
        grid.innerHTML = visibleProducts.map(renderProduct).join('');
    };

    const setFilter = filter => {
        activeFilter = filter;
        document.querySelectorAll('.store-filter').forEach(button => {
            button.classList.toggle('active', button.dataset.filter === filter);
        });
        render();
    };

    if (filterContainer) {
        filterContainer.addEventListener('click', event => {
            const button = event.target.closest('.store-filter');
            if (!button) return;
            setFilter(button.dataset.filter || 'all');
        });
    }

    grid.addEventListener('click', event => {
        const trigger = event.target.closest('.store-product-gallery-trigger');
        if (!trigger) return;
        const product = products.find(item => String(item.id) === String(trigger.dataset.productId));
        if (product) openGallery(product.gallery || []);
    });

    if (modal) {
        modal.addEventListener('click', event => {
            if (event.target.closest('[data-close-gallery]')) {
                closeGallery();
                return;
            }
            const thumb = event.target.closest('.store-gallery-thumb');
            if (thumb) {
                activeGalleryIndex = Number(thumb.dataset.galleryIndex || 0);
                renderGallery();
            }
        });
    }

    if (prevBtn) prevBtn.addEventListener('click', showPrev);
    if (nextBtn) nextBtn.addEventListener('click', showNext);

    document.addEventListener('keydown', event => {
        if (!modal || modal.hidden) return;
        if (event.key === 'Escape') closeGallery();
        if (event.key === 'ArrowLeft') showPrev();
        if (event.key === 'ArrowRight') showNext();
    });

    async function loadFromSupabase() {
        if (!client) throw new Error('Supabase no disponible');
        const { data, error } = await client
            .from('store_products')
            .select('id,name,price,description,buy_url,image_urls,category,sort_order')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) throw error;

        products = (data || []).map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            description: item.description,
            category: item.category || 'ropa',
            buyUrl: item.buy_url,
            gallery: Array.isArray(item.image_urls) ? item.image_urls : []
        }));
        render();
    }

    loadFromSupabase().catch(async error => {
        console.error('Store database error:', error);
        try {
            const response = await fetch('data/tienda.json?v=2', { cache: 'no-store' });
            if (!response.ok) throw new Error('Fallback no disponible');
            const data = await response.json();
            products = (data.products || []).filter(item => item.available).map(item => ({
                ...item,
                gallery: item.gallery || [item.image, item.hoverImage].filter(Boolean)
            }));
            render();
        } catch (fallbackError) {
            console.error(fallbackError);
            grid.innerHTML = '<div class="store-empty">NO SE HA PODIDO CARGAR EL CATÁLOGO.</div>';
        }
    });
})();