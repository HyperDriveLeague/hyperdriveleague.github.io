// ========================================
// HYPERDRIVE STORE
// Catálogo y filtros
// ========================================

(() => {
    const grid = document.getElementById('store-grid');
    const filterContainer = document.getElementById('store-filters');

    if (!grid) return;

    let products = [];
    let activeFilter = 'all';

    const escapeHTML = value => String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    const renderProduct = product => {
        const name = escapeHTML(product.name);
        const description = escapeHTML(product.description);
        const category = escapeHTML(product.category);
        const badge = escapeHTML(product.badge || 'OFICIAL');
        const price = escapeHTML(product.price || 'Precio próximamente');
        const image = String(product.image || '').trim();
        const buyUrl = String(product.buyUrl || '').trim();
        const available = Boolean(product.available && buyUrl);

        const media = image
            ? '<img class="product-photo" src="' + escapeHTML(image) + '" alt="' + name + '" loading="lazy">'
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

    fetch('data/tienda.json?v=1', { cache: 'no-store' })
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
