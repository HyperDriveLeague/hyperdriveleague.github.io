// ========================================
// HYPERDRIVE LEAGUE
// Campeonato
// ========================================

document.addEventListener("DOMContentLoaded", () => {


    // ========================================
    // CONFIGURACIÓN
    // ========================================

    const TOTAL_ROUNDS = 12;

    const DIVISIONS = [
        "hyperdrive",
        "academy"
    ];


    // ========================================
    // ELEMENTOS
    // ========================================

    const championshipList =
        document.getElementById("championship-list");

    const championshipTabs =
        document.querySelectorAll(".championship-tab");

    const championshipTableHeader =
        document.querySelector(".championship-table-header");


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


    const championshipData = {

        hyperdrive: {
            drivers: [],
            constructors: []
        },

        academy: {
            drivers: [],
            constructors: []
        },

        superconstructors: []

    };


    let activeChampionship =
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
    // NORMALIZAR NOMBRES
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

        if (!Number.isFinite(number)) {
            return 0;
        }

        return number;

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
    // COLOR ESCUDERÍA
    // ========================================

    function getTeamColor(teamInfo) {

        const color =
            teamInfo?.primaryColor;


        if (!color) {
            return "#ffd500";
        }


        /*
            Racing League Tools puede usar:

            #FFFF8000

            AARRGGBB

            CSS necesita:

            #FF8000
        */

        if (
            typeof color === "string" &&
            /^#[0-9A-Fa-f]{8}$/.test(color)
        ) {

            return `#${color.slice(3)}`;

        }


        if (
            typeof color === "string" &&
            /^#[0-9A-Fa-f]{6}$/.test(color)
        ) {

            return color;

        }


        return "#ffd500";

    }


    // ========================================
    // CABECERA PILOTOS
    // ========================================

    function setDriverHeader() {

        if (!championshipTableHeader) {
            return;
        }


        championshipTableHeader.innerHTML = `
            <span>POS</span>
            <span>PILOTO</span>
            <span>EQUIPO</span>
            <span>PUNTOS</span>
        `;

    }


    // ========================================
    // CABECERA CONSTRUCTORES
    // ========================================

    function setConstructorsHeader() {

        if (!championshipTableHeader) {
            return;
        }


        championshipTableHeader.innerHTML = `
            <span>POS</span>
            <span>ESCUDERÍA</span>
            <span>PILOTOS</span>
            <span>PUNTOS</span>
        `;

    }


    // ========================================
    // CABECERA SUPERCONSTRUCTORES
    // ========================================

    function setSuperconstructorsHeader() {

        if (!championshipTableHeader) {
            return;
        }


        championshipTableHeader.innerHTML = `
            <span>POS</span>
            <span>ESCUDERÍA</span>
            <span>HYPERDRIVE · ACADEMY</span>
            <span>PUNTOS</span>
        `;

    }


    // ========================================
    // ARCHIVO JSON OPCIONAL
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


        if (typeof driver === "string") {

            driverName =
                driver.trim();

        } else if (
            driver &&
            typeof driver === "object"
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


        const key =
            normalizeKey(driverName);


        officialDrivers[
            division
        ].set(
            key,
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
    // VALIDAR SESSION
    // ========================================

    function isValidRaceFile(data) {

        return Boolean(
            data &&
            data.session &&
            Array.isArray(
                data.session.drivers
            )
        );

    }


    // ========================================
    // CARGAR CARRERAS
    // ========================================

    async function loadDivisionRaceFiles(
        division
    ) {

        const requests =
            [];


        /*
            Buscamos siempre las 12 rondas.

            Cada ronda puede tener:

            data/hyperdrive_r1.json
            data/hyperdrive_r1_sprint.json

            o su equivalente de Academy.

            Si falta una ronda intermedia,
            NO dejamos de buscar las siguientes.
        */

        for (
            let round = 1;
            round <= TOTAL_ROUNDS;
            round++
        ) {

            const mainPath =
                `data/${division}_r${round}.json`;

            const sprintPath =
                `data/${division}_r${round}_sprint.json`;


            requests.push(
                (async () => {

                    const mainData =
                        await fetchOptionalJSON(
                            mainPath
                        );

                    if (
                        !mainData ||
                        !isValidRaceFile(
                            mainData
                        )
                    ) {

                        return null;

                    }

                    return {

                        division:
                            division,

                        round:
                            round,

                        type:
                            "race",

                        path:
                            mainPath,

                        data:
                            mainData

                    };

                })()
            );


            requests.push(
                (async () => {

                    const sprintData =
                        await fetchOptionalJSON(
                            sprintPath
                        );

                    if (
                        !sprintData ||
                        !isValidRaceFile(
                            sprintData
                        )
                    ) {

                        return null;

                    }

                    return {

                        division:
                            division,

                        round:
                            round,

                        type:
                            "sprint",

                        path:
                            sprintPath,

                        data:
                            sprintData

                    };

                })()
            );

        }


        const loaded =
            (
                await Promise.all(
                    requests
                )
            )
                .filter(Boolean);


        /*
            Orden cronológico:

            Sprint primero.
            Carrera principal después.
        */

        loaded.sort(
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


        raceFiles[
            division
        ] = loaded;

    }


    // ========================================
    // INFORMACIÓN DE UN PILOTO
    // ========================================

    function getRaceDriverInfo(
        sessionFile,
        driver
    ) {

        const isMainRace =
            sessionFile.type ===
            "race";


        /*
            RLT ya incluye en driverPoints
            los puntos de la carrera y,
            cuando corresponde, el punto
            de vuelta rápida.

            NO añadimos nada extra por
            vuelta rápida.
        */

        const driverPoints =
            toPoints(
                driver.driverPoints
            );


        /*
            POLE:

            Solo en carrera principal.

            gridPosition === 1
            suma +1 punto.

            En Sprint NUNCA se aplica.

            Como trabajamos directamente
            con los archivos Session,
            este +1 debemos añadirlo aquí.
        */

        const poleBonus =
            (
                isMainRace &&
                Number(
                    driver.gridPosition
                ) === 1
            )
                ? 1
                : 0;


        /*
            Para Pilotos y Constructores
            usamos exactamente la misma
            puntuación efectiva del piloto.

            NO usamos teamPoints.

            Así los puntos de reservas
            también se asignan correctamente
            al equipo con el que corrieron.
        */

        const total =
            driverPoints +
            poleBonus;


        return {

            driverPoints:
                driverPoints,

            poleBonus:
                poleBonus,

            driverTotal:
                total,

            teamTotal:
                total

        };

    }


    // ========================================
    // CREAR MUNDIAL DE PILOTOS
    // ========================================

    function buildDriverStandings(
        division
    ) {

        const drivers =
            new Map();


        /*
            Primero añadimos todos los
            pilotos oficiales.

            Así incluso un piloto con 0 puntos
            puede aparecer en el campeonato.
        */

        officialDrivers[
            division
        ].forEach(
            (officialDriver, key) => {

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


        const sessions =
            raceFiles[
                division
            ];


        sessions.forEach(
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
                            RESERVAS:

                            Si el piloto no está en
                            official-drivers.json
                            para esta división,
                            NO suma al Mundial
                            de Pilotos.
                        */

                        if (
                            !officialDrivers[
                                division
                            ].has(key)
                        ) {

                            return;

                        }


                        const championshipDriver =
                            drivers.get(key);


                        if (!championshipDriver) {
                            return;
                        }


                        const points =
                            getRaceDriverInfo(
                                sessionFile,
                                driver
                            );


                        championshipDriver.points +=
                            points.driverTotal;


                        /*
                            El equipo mostrado será
                            el de su participación
                            más reciente.

                            Esto permite cambios
                            de equipo durante la
                            temporada sin editar
                            el código.
                        */

                        const teamName =
                            String(
                                driver?.team?.name ??
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
                (driver, index) => {

                    return {

                        ...driver,

                        position:
                            index + 1

                    };

                }
            );

    }


    // ========================================
    // CONSTRUCTORES DE UNA DIVISIÓN
    // ========================================

    function buildConstructorsStandings(
        division
    ) {

        const teams =
            new Map();


        const sessions =
            raceFiles[
                division
            ];


        sessions.forEach(
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

                        const teamName =
                            String(
                                driver?.team?.name ??
                                ""
                            ).trim();


                        if (!teamName) {
                            return;
                        }


                        const teamInfo =
                            driver.team ||
                            null;


                        /*
                            Usamos uniqueId de RLT
                            siempre que exista.

                            Así "Red Bull", "Mercedes",
                            etc. se identifican como
                            la misma escudería aunque
                            cambie ligeramente el texto
                            del nombre.
                        */

                        const uniqueId =
                            String(
                                teamInfo?.uniqueId ??
                                ""
                            ).trim();


                        const teamKey =
                            uniqueId
                                ? `id:${normalizeKey(uniqueId)}`
                                : `name:${normalizeKey(teamName)}`;


                        if (
                            !teams.has(
                                teamKey
                            )
                        ) {

                            teams.set(
                                teamKey,
                                {

                                    teamKey:
                                        teamKey,

                                    teamName:
                                        teamName,

                                    points:
                                        0,

                                    driverNames:
                                        new Set(),

                                    teamInfo:
                                        teamInfo

                                }
                            );

                        }


                        const team =
                            teams.get(
                                teamKey
                            );


                        const points =
                            getRaceDriverInfo(
                                sessionFile,
                                driver
                            );


                        /*
                            IMPORTANTE:

                            Aquí suman TODOS.

                            Titulares + reservas.

                            Un reserva no aparece
                            en Pilotos, pero sus
                            puntos pertenecen a
                            la escudería con la
                            que disputó esa sesión.
                        */

                        team.points +=
                            points.teamTotal;


                        const driverName =
                            String(
                                driver.driverName ??
                                ""
                            ).trim();


                        if (driverName) {

                            team.driverNames.add(
                                driverName
                            );

                        }


                        if (driver.team) {

                            team.teamInfo =
                                driver.team;

                        }

                    }
                );

            }
        );


        return Array.from(
            teams.values()
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
                        a.teamName
                    ).localeCompare(
                        String(
                            b.teamName
                        ),
                        "es"
                    );

                }
            )
            .map(
                (team, index) => {

                    return {

                        ...team,

                        position:
                            index + 1,

                        driverNames:
                            Array.from(
                                team.driverNames
                            )

                    };

                }
            );

    }


    // ========================================
    // SUPERCONSTRUCTORES
    // ========================================

    function buildSuperconstructors() {

        const combined =
            new Map();


        DIVISIONS.forEach(
            division => {

                const constructors =
                    championshipData[
                        division
                    ].constructors;


                constructors.forEach(
                    team => {

                        const uniqueId =
                            String(
                                team
                                    ?.teamInfo
                                    ?.uniqueId ??
                                ""
                            ).trim();


                        const key =
                            uniqueId
                                ? `id:${normalizeKey(uniqueId)}`
                                : `name:${normalizeKey(team.teamName)}`;


                        if (
                            !combined.has(
                                key
                            )
                        ) {

                            combined.set(
                                key,
                                {

                                    teamName:
                                        team.teamName,

                                    points:
                                        0,

                                    hyperdrivePoints:
                                        0,

                                    academyPoints:
                                        0,

                                    teamInfo:
                                        team.teamInfo ||
                                        null

                                }
                            );

                        }


                        const combinedTeam =
                            combined.get(
                                key
                            );


                        combinedTeam.points +=
                            team.points;


                        if (
                            division ===
                            "hyperdrive"
                        ) {

                            combinedTeam
                                .hyperdrivePoints +=
                                team.points;

                        }


                        if (
                            division ===
                            "academy"
                        ) {

                            combinedTeam
                                .academyPoints +=
                                team.points;

                        }


                        if (
                            team.teamInfo
                        ) {

                            combinedTeam.teamInfo =
                                team.teamInfo;

                        }

                    }
                );

            }
        );


        return Array.from(
            combined.values()
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
                        a.teamName
                    ).localeCompare(
                        String(
                            b.teamName
                        ),
                        "es"
                    );

                }
            )
            .map(
                (team, index) => {

                    return {

                        ...team,

                        position:
                            index + 1

                    };

                }
            );

    }


    // ========================================
    // CALCULAR TODOS LOS CAMPEONATOS
    // ========================================

    function calculateChampionships() {

        DIVISIONS.forEach(
            division => {

                championshipData[
                    division
                ].drivers =
                    buildDriverStandings(
                        division
                    );


                championshipData[
                    division
                ].constructors =
                    buildConstructorsStandings(
                        division
                    );

            }
        );


        championshipData
            .superconstructors =
                buildSuperconstructors();

    }


    // ========================================
    // MOSTRAR PILOTOS
    // ========================================

    function renderDrivers(
        division
    ) {

        if (!championshipList) {
            return;
        }


        setDriverHeader();


        const drivers =
            championshipData[
                division
            ].drivers;


        if (
            !Array.isArray(
                drivers
            ) ||
            drivers.length === 0
        ) {

            championshipList.innerHTML = `
                <div class="championship-loading">
                    NO HAY DATOS DISPONIBLES
                </div>
            `;

            return;

        }


        championshipList.innerHTML =
            drivers
                .map(
                    driver => {

                        const driverImage =
                            getDriverImage(
                                driver.driverName
                            );


                        return `
                            <div class="championship-row">

                                <span class="championship-position">
                                    ${escapeHTML(driver.position)}
                                </span>


                                <div class="championship-driver">

                                    <div class="championship-driver-photo">

                                        <img
                                            src="${driverImage}"
                                            alt="${escapeHTML(driver.driverName)}"
                                            loading="lazy"
                                            onerror="this.style.display='none'"
                                        >

                                    </div>


                                    <span>
                                        ${escapeHTML(driver.driverName)}
                                    </span>

                                </div>


                                <span class="championship-team">
                                    ${escapeHTML(driver.teamName || "SIN EQUIPO")}
                                </span>


                                <span class="championship-points">
                                    ${escapeHTML(formatPoints(driver.points))}
                                </span>

                            </div>
                        `;

                    }
                )
                .join("");

    }


    // ========================================
    // MOSTRAR CONSTRUCTORES
    // ========================================

    function renderConstructors(
        division
    ) {

        if (!championshipList) {
            return;
        }


        setConstructorsHeader();


        const constructors =
            championshipData[
                division
            ].constructors;


        if (
            !Array.isArray(
                constructors
            ) ||
            constructors.length === 0
        ) {

            championshipList.innerHTML = `
                <div class="championship-loading">
                    NO HAY DATOS DE CONSTRUCTORES
                </div>
            `;

            return;

        }


        championshipList.innerHTML =
            constructors
                .map(
                    team => {

                        const teamColor =
                            getTeamColor(
                                team.teamInfo
                            );


                        const driversText =
                            team.driverNames.length
                                ? team.driverNames
                                    .join(" · ")
                                : "—";


                        return `
                            <div class="championship-row constructor-row">

                                <span class="championship-position">
                                    ${escapeHTML(team.position)}
                                </span>


                                <div class="constructor-team-name">

                                    <span
                                        class="constructor-marker"
                                        style="
                                            background:
                                            ${escapeHTML(teamColor)};
                                        "
                                    ></span>


                                    <span>
                                        ${escapeHTML(team.teamName)}
                                    </span>

                                </div>


                                <span class="championship-team">
                                    ${escapeHTML(driversText)}
                                </span>


                                <span class="championship-points">
                                    ${escapeHTML(formatPoints(team.points))}
                                </span>

                            </div>
                        `;

                    }
                )
                .join("");

    }


    // ========================================
    // MOSTRAR SUPERCONSTRUCTORES
    // ========================================

    function renderSuperconstructors() {

        if (!championshipList) {
            return;
        }


        setSuperconstructorsHeader();


        const teams =
            championshipData
                .superconstructors;


        if (
            !Array.isArray(
                teams
            ) ||
            teams.length === 0
        ) {

            championshipList.innerHTML = `
                <div class="championship-loading">
                    NO HAY DATOS DE SUPERCONSTRUCTORES
                </div>
            `;

            return;

        }


        championshipList.innerHTML =
            teams
                .map(
                    team => {

                        const teamColor =
                            getTeamColor(
                                team.teamInfo
                            );


                        const breakdown =
                            `HYP ${formatPoints(team.hyperdrivePoints)} · ACA ${formatPoints(team.academyPoints)}`;


                        return `
                            <div class="
                                championship-row
                                constructor-row
                                superconstructor-row
                            ">

                                <span class="championship-position">
                                    ${escapeHTML(team.position)}
                                </span>


                                <div class="constructor-team-name">

                                    <span
                                        class="constructor-marker"
                                        style="
                                            background:
                                            ${escapeHTML(teamColor)};
                                        "
                                    ></span>


                                    <span>
                                        ${escapeHTML(team.teamName)}
                                    </span>

                                </div>


                                <span class="championship-team">
                                    ${escapeHTML(breakdown)}
                                </span>


                                <span class="championship-points">
                                    ${escapeHTML(formatPoints(team.points))}
                                </span>

                            </div>
                        `;

                    }
                )
                .join("");

    }


    // ========================================
    // MOSTRAR CAMPEONATO
    // ========================================

    function renderChampionship(
        type
    ) {

        activeChampionship =
            type;


        if (
            type ===
            "hyperdrive"
        ) {

            renderDrivers(
                "hyperdrive"
            );

            return;

        }


        if (
            type ===
            "academy"
        ) {

            renderDrivers(
                "academy"
            );

            return;

        }


        if (
            type ===
            "constructors-hyperdrive"
        ) {

            renderConstructors(
                "hyperdrive"
            );

            return;

        }


        if (
            type ===
            "constructors-academy"
        ) {

            renderConstructors(
                "academy"
            );

            return;

        }


        if (
            type ===
            "superconstructors"
        ) {

            renderSuperconstructors();

        }

    }


    // ========================================
    // BOTONES
    // ========================================

    championshipTabs.forEach(
        tab => {

            tab.addEventListener(
                "click",
                () => {

                    championshipTabs.forEach(
                        button => {

                            button.classList.remove(
                                "active"
                            );

                        }
                    );


                    tab.classList.add(
                        "active"
                    );


                    renderChampionship(
                        tab.dataset
                            .championship
                    );

                }
            );

        }
    );


    // ========================================
    // INICIALIZACIÓN
    // ========================================

    async function initChampionship() {

        if (championshipList) {

            championshipList.innerHTML = `
                <div class="championship-loading">
                    CARGANDO CAMPEONATO...
                </div>
            `;

        }


        try {

            /*
                Cargamos primero la lista fija
                de pilotos oficiales.

                Esta lista es la que permite
                distinguir titulares de reservas.
            */

            await loadOfficialDrivers();


            /*
                Después buscamos automáticamente
                las carreras de ambas divisiones.
            */

            await Promise.all([

                loadDivisionRaceFiles(
                    "hyperdrive"
                ),

                loadDivisionRaceFiles(
                    "academy"
                )

            ]);


            /*
                Calculamos:

                - Pilotos HyperDrive
                - Pilotos Academy
                - Constructores HyperDrive
                - Constructores Academy
                - Superconstructores
            */

            calculateChampionships();


            renderChampionship(
                activeChampionship
            );


        } catch (error) {

            console.error(error);


            if (championshipList) {

                championshipList.innerHTML = `
                    <div class="championship-loading">
                        ERROR AL CARGAR EL CAMPEONATO
                    </div>
                `;

            }

        }

    }


    initChampionship();


});
