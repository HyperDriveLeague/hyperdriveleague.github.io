// ========================================
// HYPERDRIVE STORE
// Catálogo, filtros y galería
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
        const category = escapeHTML(product.category);
        const badge = escapeHTML(product.badge || 'OFICIAL');
        const price = escapeHTML(product.price || 'Precio próximamente');
        const image = String(product.image || '').trim();
        const hoverImage = String(product.hoverImage || '').trim();
        const buyUrl = String(product.buyUrl || '').trim();
        const gallery = Array.isArray(product.gallery) ? product.gallery.filter(Boolean) : [];
        const available = Boolean(product.available && buyUrl);

        const media = image
            ? '<button class="store-product-gallery-trigger" type="button" data-product-id="' + escapeHTML(product.id) + '" aria-label="Ver galería de ' + name + '">' +
                '<div class="store-product-image-stack ' + (hoverImage ? 'has-hover-image' : '') + '">' +
                    '<img class="product-photo primary-photo" src="' + escapeHTML(image) + '" alt="' + name + '" loading="lazy">' +
                    (hoverImage ? '<img class="product-photo hover-photo" src="' + escapeHTML(hoverImage) + '" alt="Parte trasera de ' + name + '" loading="lazy">' : '') +
                '</div>' +
                (gallery.length > 1 ? '<span class="store-gallery-hint">VER ' + gallery.length + ' FOTOS</span>' : '') +
              '</button>'
            : '<div class="store-placeholder"><img src="images/logo/hyperdrive-logo.png" alt="" aria-hidden="true"><span>PRODUCTO EN PREPARACIÓN</span></div>';

        const action = available
            ? '<a class="store-buy" href="' + escapeHTML(buyUrl) + '" target="_blank" rel="noopener noreferrer">COMPRAR →</a>'
            : '<span class="store-buy-disabled" aria-disabled="true">PRÓXIMAMENTE</span>';

        return '<article class="store-product" data-category="' + category + '">' +
            '<div class="store-product-media">' +
                '<span class="store-product-badge">' + badge + '</span>' +
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
        if (!product) return;

        const images = Array.isArray(product.gallery) && product.gallery.length
            ? product.gallery
            : [product.image];

        openGallery(images);
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

    fetch('data/tienda.json?v=2', { cache: 'no-store' })
        .then(response => {
            if (!response.ok) throw new Error('No se pudo cargar el catálogo');
            return response.json();
        })
        .then(data => {
            products = Array.isArray(data.products) ? data.products : [];
            render();
        })
        .catch(error => {
            console.error(error);
            grid.innerHTML = '<div class="store-empty">NO SE HA PODIDO CARGAR EL CATÁLOGO.</div>';
        });
})();
