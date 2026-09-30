// ========================================
// HYPERDRIVE LEAGUE
// Layout global · Header + Footer
// ========================================

(() => {
    const currentPage = (() => {
        const path = window.location.pathname.split('/').pop().toLowerCase();
        return path || 'index.html';
    })();

    const primaryLinks = [
        ['index.html', 'INICIO'],
        ['noticias.html', 'NOTICIAS'],
        ['campeonato.html', 'CAMPEONATO'],
        ['directos.html', 'DIRECTOS'],
        ['resultados.html', 'RESULTADOS'],
        ['calendario.html', 'CALENDARIO'],
        ['pilotos.html', 'PILOTOS'],
        ['equipos.html', 'EQUIPOS']
    ];

    const moreLinks = [
        ['qualy-historico.html', 'HISTÓRICO DE QUALY'],
        ['hall-of-fame.html', 'HALL OF FAME'],
        ['quienes-somos.html', 'QUIÉNES SOMOS'],
        ['reglamento.html', 'REGLAMENTO'],
        ['inscripciones.html', 'INSCRIPCIONES']
    ];

    const isActive = page => {
        if (page === 'noticias.html') return currentPage === 'noticias.html' || currentPage === 'noticia.html';
        return currentPage === page;
    };

    const moreActive = moreLinks.some(([page]) => isActive(page));

    const desktopPrimary = primaryLinks.map(([page, label]) =>
        `<a href="${page}" class="${isActive(page) ? 'active' : ''}">${label}</a>`
    ).join('');

    const desktopMore = moreLinks.map(([page, label]) => `
        <a href="${page}" class="${isActive(page) ? 'active' : ''}" style="display:block;padding:14px 15px;border-radius:5px;white-space:nowrap;">${label}</a>
    `).join('');

    const mobileLinks = [...primaryLinks, ...moreLinks].map(([page, label]) =>
        `<a href="${page}" class="${isActive(page) ? 'active' : ''}">${label}</a>`
    ).join('');

    const headerHTML = `
        <header class="main-header">
            <a href="index.html" class="logo">
                <img src="images/logo/hyperdrive-logo.png" alt="HyperDrive League">
            </a>

            <nav class="main-nav">
                ${desktopPrimary}
                <div class="more-menu${moreActive ? ' active' : ''}" id="more-menu" style="position:relative;">
                    <button id="more-menu-button" type="button" aria-expanded="false" aria-controls="more-dropdown" style="all:unset;cursor:pointer;display:block;${moreActive ? 'color:var(--yellow);' : ''}">MÁS ▾</button>
                    <div id="more-dropdown" style="display:none;position:absolute;top:calc(100% + 18px);right:0;z-index:9999;width:245px;padding:8px;border:1px solid rgba(255,255,255,.10);border-radius:8px;background:#101010;box-shadow:0 20px 50px rgba(0,0,0,.45);">
                        ${desktopMore}
                    </div>
                </div>
            </nav>

            <a href="https://discord.gg/SvKXMBRDgu" class="discord-button" target="_blank" rel="noopener noreferrer">ÚNETE AL DISCORD</a>

            <button class="mobile-menu-toggle" id="mobile-menu-toggle" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="mobile-menu">
                <span></span><span></span><span></span>
            </button>

            <div class="mobile-menu" id="mobile-menu">
                <nav class="mobile-menu-nav">${mobileLinks}</nav>
                <div class="mobile-menu-social">
                    <a href="https://discord.gg/SvKXMBRDgu" target="_blank" rel="noopener noreferrer">DISCORD</a>
                    <a href="https://www.twitch.tv/hyperdriveleague" target="_blank" rel="noopener noreferrer">TWITCH</a>
                    <a href="https://www.instagram.com/hyperdriveleague/" target="_blank" rel="noopener noreferrer">INSTAGRAM</a>
                </div>
            </div>
        </header>
    `;

    const footerHTML = `
        <footer class="site-footer">
            <div class="footer-container">
                <div class="footer-brand">
                    <img src="images/logo/hyperdrive-logo.png" alt="HyperDrive League">
                    <p>Competición, estrategia y comunidad. Simracing construido para ir más allá de la pista.</p>
                </div>

                <div class="footer-links">
                    <div class="footer-column">
                        <span>COMPETICIÓN</span>
                        <a href="campeonato.html">Campeonato</a>
                        <a href="directos.html">Directos</a>
                        <a href="resultados.html">Resultados</a>
                        <a href="calendario.html">Calendario</a>
                        <a href="qualy-historico.html">Histórico de Qualy</a>
                    </div>

                    <div class="footer-column">
                        <span>HYPERDRIVE</span>
                        <a href="noticias.html">Noticias</a>
                        <a href="pilotos.html">Pilotos</a>
                        <a href="equipos.html">Equipos</a>
                        <a href="hall-of-fame.html">Hall of Fame</a>
                        <a href="quienes-somos.html">Quiénes Somos</a>
                    </div>

                    <div class="footer-column">
                        <span>COMUNIDAD</span>
                        <a href="https://discord.gg/SvKXMBRDgu" target="_blank" rel="noopener noreferrer">Discord</a>
                        <a href="https://www.twitch.tv/hyperdriveleague" target="_blank" rel="noopener noreferrer">Twitch</a>
                        <a href="https://www.instagram.com/hyperdriveleague/" target="_blank" rel="noopener noreferrer">Instagram</a>
                        <a href="inscripciones.html">Inscripciones</a>
                        <a href="reglamento.html">Reglamento</a>
                    </div>
                </div>
            </div>

            <div class="footer-bottom">
                <span>© 2026 HYPERDRIVE LEAGUE</span>
                <span>SEASON 8</span>
            </div>
        </footer>
    `;

    const headerTarget = document.getElementById('site-header');
    const footerTarget = document.getElementById('site-footer');
    if (headerTarget) headerTarget.innerHTML = headerHTML;
    if (footerTarget) footerTarget.innerHTML = footerHTML;

    const moreMenu = document.getElementById('more-menu');
    const moreButton = document.getElementById('more-menu-button');
    const moreDropdown = document.getElementById('more-dropdown');

    const closeMore = () => {
        if (!moreButton || !moreDropdown) return;
        moreDropdown.style.display = 'none';
        moreButton.setAttribute('aria-expanded', 'false');
    };

    const openMore = () => {
        if (!moreButton || !moreDropdown) return;
        moreDropdown.style.display = 'block';
        moreButton.setAttribute('aria-expanded', 'true');
    };

    if (moreButton && moreDropdown) {
        moreButton.addEventListener('click', event => {
            event.stopPropagation();
            moreButton.getAttribute('aria-expanded') === 'true' ? closeMore() : openMore();
        });
        moreDropdown.addEventListener('click', event => event.stopPropagation());
        document.addEventListener('click', event => {
            if (moreMenu && !moreMenu.contains(event.target)) closeMore();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeMore();
        });
    }

    const mobileToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileToggle && mobileMenu) {
        const closeMobile = () => {
            mobileToggle.classList.remove('open');
            mobileMenu.classList.remove('open');
            mobileToggle.setAttribute('aria-expanded', 'false');
        };

        mobileToggle.addEventListener('click', () => {
            const open = !mobileMenu.classList.contains('open');
            mobileToggle.classList.toggle('open', open);
            mobileMenu.classList.toggle('open', open);
            mobileToggle.setAttribute('aria-expanded', String(open));
            if (open) closeMore();
        });

        mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMobile));
        window.addEventListener('resize', () => {
            if (window.innerWidth > 1024) closeMobile();
        });
    }
})();
