// ========================================
// HYPERDRIVE LEAGUE
// JavaScript principal
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    const TOTAL_ROUNDS = 12;

    const DIVISIONS = [
        "hyperdrive",
        "academy"
    ];


    // ========================================
    // ELEMENTOS
    // ========================================

    const standingsList =
        document.getElementById("standings-list");

    const standingsTabs =
        document.querySelectorAll(".standings-tab");

    const resultsList =
        document.getElementById("latest-results-list");

    const resultsEvent =
        document.getElementById("latest-results-event");

    const resultsTabs =
        document.querySelectorAll(".results-tab");

    const newsGrid =
        document.getElementById("news-grid");

    const mobileMenuToggle =
        document.getElementById("mobile-menu-toggle");

    const mobileMenu =
        document.getElementById("mobile-menu");


    // ========================================
    // DATOS
    // ========================================

    const raceFiles = {
        hyperdrive: [],
        academy: []
    };

    const officialDrivers = {
        hyperdrive: new Map(),
        academy: new Map()
    };

    const standingsData = {
        hyperdrive: [],
        academy: []
    };

    let activeDivision =
        "hyperdrive";

    let activeResultsDivision =
        "hyperdrive";


    // ========================================
    // SEGURIDAD
    // ========================================

    function escapeHTML(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    }


    // ========================================
    // NORMALIZAR CLAVES
    // ========================================

    function normalizeKey(value) {

        return String(value ?? "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "");

    }


    // ========================================
    // SLUG NOTICIA
    // ========================================

    function createSlug(article) {

        return `${article.date || ""}-${article.title || ""}`
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

    }


    // ========================================
    // FOTO PILOTO
    // ========================================

    function getDriverImage(driverName) {

        const filename =
            String(driverName ?? "")
                .trim()
                .toLowerCase();

        return `images/drivers/${encodeURIComponent(filename)}.png`;

    }


    // ========================================
    // PUNTOS
    // ========================================

    function toPoints(value) {

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : 0;

    }


    function formatPoints(value) {

        const number =
            Number(value);

        if (!Number.isFinite(number)) {
            return "0";
        }

        if (Number.isInteger(number)) {
            return String(number);
        }

        return new Intl.NumberFormat(
            "es-ES",
            {
                maximumFractionDigits: 2
            }
        ).format(number);

    }


    // ========================================
    // NOMBRE GP
    // ========================================

    function formatGrandPrixName(name) {

        const normalized =
            String(name ?? "")
                .trim()
                .toLowerCase();

        const names = {

            shanghai: "CHINA",
            china: "CHINA",

            baku: "BAKÚ",

            imola: "IMOLA",

            silverstone: "SILVERSTONE",

            austria: "AUSTRIA",

            spain: "ESPAÑA",
            "españa": "ESPAÑA",

            monza: "MONZA",

            monaco: "MÓNACO",

            singapore: "SINGAPUR",

            suzuka: "JAPÓN",
            japan: "JAPÓN",

            miami: "MIAMI",

            zandvoort: "PAÍSES BAJOS",

            mexico: "MÉXICO",

            brazil: "BRASIL",
            interlagos: "BRASIL",

            qatar: "QATAR",

            abudhabi: "ABU DHABI",
            "abu dhabi": "ABU DHABI"

        };

        return names[normalized] ||
            String(name ?? "")
                .trim()
                .toUpperCase();

    }


    // ========================================
    // JSON OPCIONAL
    // ========================================

    async function fetchOptionalJSON(path) {

        try {

            const response =
                await fetch(
                    path,
                    {
                        cache: "no-store"
                    }
                );

            if (response.status === 404) {
                return null;
            }

            if (!response.ok) {

                console.warn(
                    `No se pudo cargar ${path}. Código ${response.status}`
                );

                return null;

            }

            return await response.json();

        } catch (error) {

            console.warn(
                `No se pudo cargar ${path}`,
                error
            );

            return null;

        }

    }


    // ========================================
    // PILOTOS OFICIALES
    // ========================================

    function parseOfficialDriver(
        division,
        driver
    ) {

        let driverName = "";
        let teamName = "";

        if (
            typeof driver ===
            "string"
        ) {

            driverName =
                driver.trim();

        } else if (
            driver &&
            typeof driver ===
            "object"
        ) {

            driverName =
                String(
                    driver.driverName ??
                    driver.name ??
                    ""
                ).trim();

            teamName =
                String(
                    driver.teamName ??
                    driver.team ??
                    ""
                ).trim();

        }

        if (!driverName) {
            return;
        }

        officialDrivers[
            division
        ].set(
            normalizeKey(driverName),
            {
                driverName:
                    driverName,

                teamName:
                    teamName
            }
        );

    }


    async function loadOfficialDrivers() {

        const response =
            await fetch(
                "data/official-drivers.json",
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {

            throw new Error(
                "No se pudo cargar data/official-drivers.json"
            );

        }

        const data =
            await response.json();

        DIVISIONS.forEach(
            division => {

                officialDrivers[
                    division
                ].clear();

                const list =
                    Array.isArray(
                        data?.[division]
                    )
                        ? data[division]
                        : [];

                list.forEach(
                    driver => {

                        parseOfficialDriver(
                            division,
                            driver
                        );

                    }
                );

            }
        );

    }


    // ========================================
    // ARCHIVOS DE CARRERA
    // ========================================

    function isValidRaceFile(data) {

        return Boolean(
            data?.session &&
            Array.isArray(
                data.session.drivers
            )
        );

    }


    async function loadRaceFile(
        division,
        round,
        type
    ) {

        const suffix =
            type === "sprint"
                ? "_sprint"
                : "";

        const path =
            `data/${division}_r${round}${suffix}.json`;

        const data =
            await fetchOptionalJSON(
                path
            );

        if (
            !data ||
            !isValidRaceFile(data)
        ) {

            return null;

        }

        return {

            division:
                division,

            round:
                round,

            type:
                type,

            path:
                path,

            data:
                data

        };

    }


    async function loadDivisionRaceFiles(
        division
    ) {

        const requests = [];

        for (
            let round = 1;
            round <= TOTAL_ROUNDS;
            round++
        ) {

            requests.push(
                loadRaceFile(
                    division,
                    round,
                    "race"
                )
            );

            requests.push(
                loadRaceFile(
                    division,
                    round,
                    "sprint"
                )
            );

        }

        const loaded =
            await Promise.all(
                requests
            );

        raceFiles[
            division
        ] =
            loaded
                .filter(Boolean)
                .sort(
                    (a, b) => {

                        if (
                            a.round !==
                            b.round
                        ) {

                            return (
                                a.round -
                                b.round
                            );

                        }

                        if (
                            a.type ===
                            b.type
                        ) {

                            return 0;

                        }

                        return (
                            a.type ===
                            "sprint"
                                ? -1
                                : 1
                        );

                    }
                );

    }


    // ========================================
    // PUNTOS SESIÓN
    // ========================================

    function getDriverSessionPoints(
        sessionFile,
        driver
    ) {

        /*
            driverPoints YA incluye
            el punto de vuelta rápida.

            Por tanto NO se suma nada
            manualmente por vuelta rápida.
        */

        const basePoints =
            toPoints(
                driver.driverPoints
            );

        /*
            La pole suma +1 solamente
            en la carrera principal.

            En Sprint no suma.
        */

        const poleBonus =
            (
                sessionFile.type ===
                    "race" &&
                Number(
                    driver.gridPosition
                ) === 1
            )
                ? 1
                : 0;

        return (
            basePoints +
            poleBonus
        );

    }


    // ========================================
    // CONSTRUIR CLASIFICACIÓN
    // ========================================

    function buildDriverStandings(
        division
    ) {

        const drivers =
            new Map();


        /*
            Primero añadimos todos
            los pilotos oficiales.
        */

        officialDrivers[
            division
        ].forEach(
            (
                officialDriver,
                key
            ) => {

                drivers.set(
                    key,
                    {

                        driverName:
                            officialDriver
                                .driverName,

                        teamName:
                            officialDriver
                                .teamName ||
                            "SIN EQUIPO",

                        points:
                            0,

                        lastRound:
                            0,

                        lastSessionOrder:
                            0

                    }
                );

            }
        );


        raceFiles[
            division
        ].forEach(
            sessionFile => {

                const sessionDrivers =
                    sessionFile
                        ?.data
                        ?.session
                        ?.drivers;

                if (
                    !Array.isArray(
                        sessionDrivers
                    )
                ) {

                    return;

                }

                sessionDrivers.forEach(
                    driver => {

                        const driverName =
                            String(
                                driver.driverName ??
                                ""
                            ).trim();

                        if (!driverName) {
                            return;
                        }

                        const key =
                            normalizeKey(
                                driverName
                            );


                        /*
                            Si no aparece en
                            official-drivers.json,
                            es reserva.

                            NO suma al campeonato
                            de pilotos.
                        */

                        if (
                            !officialDrivers[
                                division
                            ].has(key)
                        ) {

                            return;

                        }

                        const championshipDriver =
                            drivers.get(
                                key
                            );

                        if (
                            !championshipDriver
                        ) {

                            return;

                        }

                        championshipDriver.points +=
                            getDriverSessionPoints(
                                sessionFile,
                                driver
                            );


                        /*
                            Mostramos el equipo
                            de la participación
                            más reciente.
                        */

                        const teamName =
                            String(
                                driver
                                    ?.team
                                    ?.name ??
                                ""
                            ).trim();

                        const sessionOrder =
                            sessionFile.type ===
                                "race"
                                ? 2
                                : 1;

                        if (
                            teamName &&
                            (
                                sessionFile.round >
                                    championshipDriver
                                        .lastRound ||
                                (
                                    sessionFile.round ===
                                        championshipDriver
                                            .lastRound &&
                                    sessionOrder >=
                                        championshipDriver
                                            .lastSessionOrder
                                )
                            )
                        ) {

                            championshipDriver.teamName =
                                teamName;

                            championshipDriver.lastRound =
                                sessionFile.round;

                            championshipDriver.lastSessionOrder =
                                sessionOrder;

                        }

                    }
                );

            }
        );


        return Array.from(
            drivers.values()
        )
            .sort(
                (a, b) => {

                    if (
                        b.points !==
                        a.points
                    ) {

                        return (
                            b.points -
                            a.points
                        );

                    }

                    return String(
                        a.driverName
                    ).localeCompare(
                        String(
                            b.driverName
                        ),
                        "es"
                    );

                }
            )
            .map(
                (
                    driver,
                    index
                ) => ({

                    ...driver,

                    position:
                        index + 1

                })
            );

    }


    function calculateStandings() {

        DIVISIONS.forEach(
            division => {

                standingsData[
                    division
                ] =
                    buildDriverStandings(
                        division
                    );

            }
        );

    }


    // ========================================
    // MOSTRAR CLASIFICACIÓN
    // ========================================

    function renderStandings(
        division
    ) {

        if (!standingsList) {
            return;
        }

        activeDivision =
            division;

        const drivers =
            standingsData[
                division
            ];

        if (
            !Array.isArray(
                drivers
            ) ||
            drivers.length === 0
        ) {

            standingsList.innerHTML = `
                <div class="standings-loading">
                    NO HAY DATOS DISPONIBLES
                </div>
            `;

            return;

        }

        const topDrivers =
            drivers.slice(
                0,
                5
            );

        standingsList.innerHTML =
            topDrivers
                .map(
                    driver => {

                        const driverImage =
                            getDriverImage(
                                driver.driverName
                            );

                        return `
                            <div class="standings-row">

                                <span class="standings-position">
                                    ${escapeHTML(driver.position)}
                                </span>


                                <span class="standings-driver">

                                    <span class="driver-photo-wrapper">

                                        <img
                                            class="driver-photo"
                                            src="${driverImage}"
                                            alt="${escapeHTML(driver.driverName)}"
                                            width="68"
                                            height="68"
                                            loading="lazy"
                                            onerror="this.style.display='none'"
                                        >

                                    </span>


                                    <span class="driver-name">
                                        ${escapeHTML(driver.driverName)}
                                    </span>

                                </span>


                                <span class="standings-team">
                                    ${escapeHTML(driver.teamName)}
                                </span>


                                <span class="standings-points">
                                    ${escapeHTML(formatPoints(driver.points))}
                                </span>

                            </div>
                        `;

                    }
                )
                .join("");

    }


    // ========================================
    // ÚLTIMA SESIÓN
    // ========================================

    function getLatestSession(
        division
    ) {

        const sessions =
            raceFiles[
                division
            ];

        if (
            !Array.isArray(
                sessions
            ) ||
            sessions.length === 0
        ) {

            return null;

        }

        const latestRound =
            Math.max(
                ...sessions.map(
                    session =>
                        session.round
                )
            );

        const latestRoundSessions =
            sessions.filter(
                session =>
                    session.round ===
                    latestRound
            );


        /*
            Si ya existe la carrera
            principal, mostramos esa.

            Si todavía solo se ha subido
            el Sprint de la ronda nueva,
            mostramos el Sprint.
        */

        return (
            latestRoundSessions.find(
                session =>
                    session.type ===
                    "race"
            ) ||
            latestRoundSessions.find(
                session =>
                    session.type ===
                    "sprint"
            ) ||
            null
        );

    }


    // ========================================
    // ÚLTIMOS RESULTADOS
    // ========================================

    function renderLatestResults(
        division
    ) {

        if (
            !resultsList ||
            !resultsEvent
        ) {

            return;

        }

        activeResultsDivision =
            division;

        const sessionFile =
            getLatestSession(
                division
            );

        if (!sessionFile) {

            resultsEvent.textContent =
                "";

            resultsList.innerHTML = `
                <div class="results-loading">
                    NO HAY RESULTADOS DISPONIBLES
                </div>
            `;

            return;

        }

        const drivers =
            sessionFile
                ?.data
                ?.session
                ?.drivers;

        if (
            !Array.isArray(
                drivers
            )
        ) {

            return;

        }

        const raceResults =
            drivers
                .map(
                    driver => {

                        const position =
                            Number(
                                driver.classificationPosition ??
                                driver.position
                            );

                        if (
                            !Number.isFinite(
                                position
                            ) ||
                            position < 1
                        ) {

                            return null;

                        }

                        return {

                            position:
                                position,

                            driverName:
                                driver.driverName ||
                                "Piloto",

                            teamName:
                                driver
                                    ?.team
                                    ?.name ||
                                "Sin equipo",

                            points:
                                getDriverSessionPoints(
                                    sessionFile,
                                    driver
                                )

                        };

                    }
                )
                .filter(Boolean)
                .sort(
                    (a, b) =>
                        a.position -
                        b.position
                );

        const podium =
            raceResults.slice(
                0,
                3
            );

        const trackName =
            sessionFile
                ?.data
                ?.event
                ?.track
                ?.trackName ||
            sessionFile
                ?.data
                ?.event
                ?.eventName ||
            "";

        const sessionSuffix =
            sessionFile.type ===
                "sprint"
                ? " · SPRINT"
                : "";

        resultsEvent.textContent =
            `R${sessionFile.round} · GP ${formatGrandPrixName(trackName)}${sessionSuffix}`;

        if (
            podium.length === 0
        ) {

            resultsList.innerHTML = `
                <div class="results-loading">
                    NO HAY RESULTADOS DISPONIBLES
                </div>
            `;

            return;

        }

        resultsList.innerHTML =
            podium
                .map(
                    result => {

                        const driverImage =
                            getDriverImage(
                                result.driverName
                            );

                        return `
                            <div class="result-card">

                                <div class="result-position">
                                    P${escapeHTML(result.position)}
                                </div>


                                <div class="result-driver-image">

                                    <img
                                        src="${driverImage}"
                                        alt="${escapeHTML(result.driverName)}"
                                        loading="lazy"
                                        onerror="this.style.display='none'"
                                    >

                                </div>


                                <div class="result-driver-info">

                                    <strong>
                                        ${escapeHTML(result.driverName)}
                                    </strong>

                                    <span>
                                        ${escapeHTML(result.teamName)}
                                    </span>

                                </div>


                                <div class="result-points">
                                    ${escapeHTML(formatPoints(result.points))} PTS
                                </div>

                            </div>
                        `;

                    }
                )
                .join("");

    }


    // ========================================
    // NOTICIAS
    // ========================================

    function renderNews(news) {

        if (!newsGrid) {
            return;
        }

        if (
            !Array.isArray(
                news
            ) ||
            news.length === 0
        ) {

            newsGrid.innerHTML = `
                <div class="news-loading">
                    NO HAY NOTICIAS PUBLICADAS
                </div>
            `;

            return;

        }


        /*
            Respeta exactamente
            el orden de Pages CMS.
        */

        const latestNews =
            news.slice(
                0,
                3
            );

        newsGrid.innerHTML =
            latestNews
                .map(
                    (
                        article,
                        index
                    ) => {

                        const mainClass =
                            index === 0
                                ? " news-card-main"
                                : "";

                        const imagePath =
                            String(
                                article.image ??
                                ""
                            ).trim();

                        const slug =
                            createSlug(
                                article
                            );

                        const articleURL =
                            `noticia.html?slug=${encodeURIComponent(slug)}`;

                        const imageBlock =
                            imagePath
                                ? `
                                    <div
                                        class="news-image-placeholder"
                                        style="
                                            background-image:
                                                linear-gradient(
                                                    180deg,
                                                    rgba(0, 0, 0, 0.05),
                                                    rgba(0, 0, 0, 0.45)
                                                ),
                                                url('${escapeHTML(imagePath)}');
                                            background-size: cover;
                                            background-position: center;
                                            background-repeat: no-repeat;
                                        "
                                    ></div>
                                `
                                : `
                                    <div class="news-image-placeholder">

                                        <span>
                                            ${
                                                index === 0
                                                    ? "NOTICIA DESTACADA"
                                                    : "NOTICIA"
                                            }
                                        </span>

                                    </div>
                                `;

                        return `
                            <a
                                class="news-card${mainClass}"
                                href="${articleURL}"
                                style="
                                    text-decoration: none;
                                    color: inherit;
                                "
                            >

                                ${imageBlock}


                                <div class="news-content">

                                    <span class="news-category">
                                        ${escapeHTML(article.category)}
                                    </span>


                                    <h3>
                                        ${escapeHTML(article.title)}
                                    </h3>


                                    <p>
                                        ${escapeHTML(article.summary)}
                                    </p>

                                </div>

                            </a>
                        `;

                    }
                )
                .join("");

    }


    async function loadNews() {

        if (!newsGrid) {
            return;
        }

        try {

            const response =
                await fetch(
                    "data/news.json",
                    {
                        cache: "no-store"
                    }
                );

            if (!response.ok) {

                throw new Error(
                    `No se pudo cargar news.json. Código: ${response.status}`
                );

            }

            const data =
                await response.json();

            if (
                !Array.isArray(
                    data.news
                )
            ) {

                throw new Error(
                    "news.json no contiene el array news"
                );

            }

            renderNews(
                data.news
            );

        } catch (error) {

            console.error(
                error
            );

            newsGrid.innerHTML = `
                <div class="news-loading">
                    ERROR AL CARGAR LAS NOTICIAS
                </div>
            `;

        }

    }


    // ========================================
    // PESTAÑAS CLASIFICACIÓN
    // ========================================

    standingsTabs.forEach(
        tab => {

            tab.addEventListener(
                "click",
                () => {

                    standingsTabs.forEach(
                        button => {

                            button.classList.remove(
                                "active"
                            );

                        }
                    );

                    tab.classList.add(
                        "active"
                    );

                    renderStandings(
                        tab.dataset
                            .division
                    );

                }
            );

        }
    );


    // ========================================
    // PESTAÑAS RESULTADOS
    // ========================================

    resultsTabs.forEach(
        tab => {

            tab.addEventListener(
                "click",
                () => {

                    resultsTabs.forEach(
                        button => {

                            button.classList.remove(
                                "active"
                            );

                        }
                    );

                    tab.classList.add(
                        "active"
                    );

                    renderLatestResults(
                        tab.dataset
                            .resultsDivision
                    );

                }
            );

        }
    );


    // ========================================
    // MENÚ MÓVIL
    // ========================================

    function setMobileMenuState(
        isOpen
    ) {

        if (
            !mobileMenuToggle ||
            !mobileMenu
        ) {

            return;

        }

        mobileMenuToggle.classList.toggle(
            "open",
            isOpen
        );

        mobileMenu.classList.toggle(
            "open",
            isOpen
        );

        mobileMenuToggle.setAttribute(
            "aria-expanded",
            String(isOpen)
        );

        mobileMenuToggle.setAttribute(
            "aria-label",
            isOpen
                ? "Cerrar menú"
                : "Abrir menú"
        );

        document.body.style.overflow =
            isOpen
                ? "hidden"
                : "";

    }


    function closeMobileMenu() {

        setMobileMenuState(
            false
        );

    }


    if (
        mobileMenuToggle &&
        mobileMenu
    ) {

        mobileMenuToggle.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                setMobileMenuState(
                    !mobileMenu.classList
                        .contains("open")
                );

            }
        );


        mobileMenu.addEventListener(
            "click",
            event => {

                if (
                    event.target.closest(
                        "a"
                    )
                ) {

                    closeMobileMenu();

                }

            }
        );


        document.addEventListener(
            "click",
            event => {

                if (
                    !mobileMenu.classList
                        .contains("open")
                ) {

                    return;

                }

                if (
                    mobileMenu.contains(
                        event.target
                    ) ||
                    mobileMenuToggle.contains(
                        event.target
                    )
                ) {

                    return;

                }

                closeMobileMenu();

            }
        );


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                        "Escape" &&
                    mobileMenu.classList
                        .contains("open")
                ) {

                    closeMobileMenu();

                    mobileMenuToggle.focus();

                }

            }
        );


        window.addEventListener(
            "resize",
            () => {

                if (
                    window.innerWidth >
                        1024 &&
                    mobileMenu.classList
                        .contains("open")
                ) {

                    closeMobileMenu();

                }

            }
        );

    }


    // ========================================
    // DATOS DE PORTADA
    // ========================================

    async function loadHomeCompetitionData() {

        /*
            main.js también se carga
            en otras páginas.

            Si no estamos en la portada,
            no hacemos peticiones
            innecesarias.
        */

        if (
            !standingsList &&
            !resultsList &&
            !resultsEvent
        ) {

            return;

        }


        if (standingsList) {

            standingsList.innerHTML = `
                <div class="standings-loading">
                    CARGANDO CLASIFICACIÓN...
                </div>
            `;

        }


        if (resultsList) {

            resultsList.innerHTML = `
                <div class="results-loading">
                    CARGANDO RESULTADOS...
                </div>
            `;

        }


        try {

            await Promise.all([

                loadOfficialDrivers(),

                loadDivisionRaceFiles(
                    "hyperdrive"
                ),

                loadDivisionRaceFiles(
                    "academy"
                )

            ]);


            calculateStandings();


            if (standingsList) {

                renderStandings(
                    activeDivision
                );

            }


            if (
                resultsList &&
                resultsEvent
            ) {

                renderLatestResults(
                    activeResultsDivision
                );

            }


        } catch (error) {

            console.error(
                error
            );


            if (standingsList) {

                standingsList.innerHTML = `
                    <div class="standings-loading">
                        ERROR AL CARGAR LA CLASIFICACIÓN
                    </div>
                `;

            }


            if (resultsList) {

                resultsList.innerHTML = `
                    <div class="results-loading">
                        ERROR AL CARGAR LOS RESULTADOS
                    </div>
                `;

            }

        }

    }


    // ========================================
    // CARGA INICIAL
    // ========================================

    loadHomeCompetitionData();

    loadNews();


});
