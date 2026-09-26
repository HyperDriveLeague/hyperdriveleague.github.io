// ========================================
// HYPERDRIVE LEAGUE
// Layout global
// Header + Footer
// ========================================

(function () {


    // ========================================
    // PÁGINA ACTUAL
    // ========================================

    function getCurrentPage() {

        const path =
            window.location.pathname
                .split("/")
                .pop()
                .toLowerCase();


        if (
            !path ||
            path === "/"
        ) {

            return "index.html";

        }


        return path;

    }


    const currentPage =
        getCurrentPage();


    // ========================================
    // CLASE ACTIVA
    // ========================================

    function activeClass(page) {

        return currentPage === page
            ? " active"
            : "";

    }


    // ========================================
    // HEADER
    // ========================================

    const headerHTML = `

        <header class="main-header">

            <a
                href="index.html"
                class="logo"
            >

                <img
                    src="images/logo/hyperdrive-logo.png"
                    alt="HyperDrive League"
                >

            </a>


            <!-- ========================================
                 MENÚ ESCRITORIO
            ======================================== -->

            <nav class="main-nav">

                <a
                    href="index.html"
                    class="${activeClass("index.html")}"
                >
                    INICIO
                </a>

                <a
                    href="noticias.html"
                    class="${activeClass("noticias.html")}${activeClass("noticia.html")}"
                >
                    NOTICIAS
                </a>

                <a
                    href="campeonato.html"
                    class="${activeClass("campeonato.html")}"
                >
                    CAMPEONATO
                </a>

                <a
                    href="directos.html"
                    class="${activeClass("directos.html")}"
                >
                    DIRECTOS
                </a>

                <a
                    href="resultados.html"
                    class="${activeClass("resultados.html")}"
                >
                    RESULTADOS
                </a>

                <a
                    href="calendario.html"
                    class="${activeClass("calendario.html")}"
                >
                    CALENDARIO
                </a>

                <a
                    href="pilotos.html"
                    class="${activeClass("pilotos.html")}"
                >
                    PILOTOS
                </a>

                <a
                    href="equipos.html"
                    class="${activeClass("equipos.html")}"
                >
                    EQUIPOS
                </a>


                <div class="more-menu">

                    <span>
                        MÁS ▾
                    </span>

                </div>

            </nav>


            <!-- ========================================
                 DISCORD
            ======================================== -->

            <a
                href="https://discord.gg/SvKXMBRDgu"
                class="discord-button"
                target="_blank"
                rel="noopener noreferrer"
            >
                ÚNETE AL DISCORD
            </a>


            <!-- ========================================
                 BOTÓN MENÚ MÓVIL
            ======================================== -->

            <button
                class="mobile-menu-toggle"
                id="mobile-menu-toggle"
                type="button"
                aria-label="Abrir menú"
                aria-expanded="false"
                aria-controls="mobile-menu"
            >

                <span></span>
                <span></span>
                <span></span>

            </button>


            <!-- ========================================
                 MENÚ MÓVIL
            ======================================== -->

            <div
                class="mobile-menu"
                id="mobile-menu"
            >

                <nav class="mobile-menu-nav">

                    <a
                        href="index.html"
                        class="${activeClass("index.html")}"
                    >
                        INICIO
                    </a>

                    <a
                        href="noticias.html"
                        class="${activeClass("noticias.html")}${activeClass("noticia.html")}"
                    >
                        NOTICIAS
                    </a>

                    <a
                        href="campeonato.html"
                        class="${activeClass("campeonato.html")}"
                    >
                        CAMPEONATO
                    </a>

                    <a
                        href="directos.html"
                        class="${activeClass("directos.html")}"
                    >
                        DIRECTOS
                    </a>

                    <a
                        href="resultados.html"
                        class="${activeClass("resultados.html")}"
                    >
                        RESULTADOS
                    </a>

                    <a
                        href="calendario.html"
                        class="${activeClass("calendario.html")}"
                    >
                        CALENDARIO
                    </a>

                    <a
                        href="pilotos.html"
                        class="${activeClass("pilotos.html")}"
                    >
                        PILOTOS
                    </a>

                    <a
                        href="equipos.html"
                        class="${activeClass("equipos.html")}"
                    >
                        EQUIPOS
                    </a>

                    <a
                        href="hall-of-fame.html"
                        class="${activeClass("hall-of-fame.html")}"
                    >
                        HALL OF FAME
                    </a>

                    <a href="#">
                        HISTORIA
                    </a>

                    <a href="#">
                        REGLAMENTO
                    </a>

                    <a href="#">
                        INSCRIPCIONES
                    </a>

                </nav>


                <div class="mobile-menu-social">

                    <a
                        href="https://discord.gg/SvKXMBRDgu"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        DISCORD
                    </a>

                    <a
                        href="https://www.twitch.tv/hyperdriveleague"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        TWITCH
                    </a>

                    <a
                        href="https://www.instagram.com/hyperdriveleague/"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        INSTAGRAM
                    </a>

                </div>

            </div>

        </header>

    `;


    // ========================================
    // FOOTER
    // ========================================

    const footerHTML = `

        <footer class="site-footer">

            <div class="footer-container">


                <!-- ========================================
                     MARCA
                ======================================== -->

                <div class="footer-brand">

                    <img
                        src="images/logo/hyperdrive-logo.png"
                        alt="HyperDrive League"
                    >

                    <p>
                        Competición, estrategia y comunidad.
                        Simracing construido para ir más allá de la pista.
                    </p>

                </div>


                <!-- ========================================
                     ENLACES
                ======================================== -->

                <div class="footer-links">


                    <!-- COMPETICIÓN -->

                    <div class="footer-column">

                        <span>
                            COMPETICIÓN
                        </span>

                        <a href="campeonato.html">
                            Campeonato
                        </a>

                        <a href="directos.html">
                            Directos
                        </a>

                        <a href="resultados.html">
                            Resultados
                        </a>

                        <a href="calendario.html">
                            Calendario
                        </a>

                    </div>


                    <!-- HYPERDRIVE -->

                    <div class="footer-column">

                        <span>
                            HYPERDRIVE
                        </span>

                        <a href="noticias.html">
                            Noticias
                        </a>

                        <a href="pilotos.html">
                            Pilotos
                        </a>

                        <a href="equipos.html">
                            Equipos
                        </a>

                        <a href="hall-of-fame.html">
                            Hall of Fame
                        </a>

                    </div>


                    <!-- COMUNIDAD -->

                    <div class="footer-column">

                        <span>
                            COMUNIDAD
                        </span>

                        <a
                            href="https://discord.gg/SvKXMBRDgu"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Discord
                        </a>

                        <a
                            href="https://www.twitch.tv/hyperdriveleague"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Twitch
                        </a>

                        <a
                            href="https://www.instagram.com/hyperdriveleague/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Instagram
                        </a>

                        <a href="#">
                            Inscripciones
                        </a>

                        <a href="#">
                            Reglamento
                        </a>

                    </div>


                </div>

            </div>


            <!-- ========================================
                 PIE INFERIOR
            ======================================== -->

            <div class="footer-bottom">

                <span>
                    © 2026 HYPERDRIVE LEAGUE
                </span>

                <span>
                    SEASON 8
                </span>

            </div>

        </footer>

    `;


    // ========================================
    // INSERTAR HEADER
    // ========================================

    const headerTarget =
        document.getElementById(
            "site-header"
        );


    if (headerTarget) {

        headerTarget.innerHTML =
            headerHTML;

    }


    // ========================================
    // INSERTAR FOOTER
    // ========================================

    const footerTarget =
        document.getElementById(
            "site-footer"
        );


    if (footerTarget) {

        footerTarget.innerHTML =
            footerHTML;

    }


})();
