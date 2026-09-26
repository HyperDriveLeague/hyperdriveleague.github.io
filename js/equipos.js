// ========================================
// HYPERDRIVE LEAGUE
// EQUIPOS
// ========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {


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

        const teamsGrid =
            document.getElementById(
                "teams-grid"
            );


        if (!teamsGrid) {
            return;
        }



        // ========================================
        // DATOS
        // ========================================

        const officialDrivers = {

            hyperdrive: [],

            academy: []

        };


        const driverProfiles =
            new Map();


        const raceDriverInfo =
            new Map();


        const raceTeamInfo =
            new Map();


        const raceSessions = [];



        // ========================================
        // SEGURIDAD
        // ========================================

        function escapeHTML(value) {

            return String(value ?? "")
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll('"', "&quot;")
                .replaceAll(
                    "'",
                    "&#039;"
                );

        }



        // ========================================
        // NORMALIZAR
        // ========================================

        function normalizeKey(value) {

            return String(value ?? "")
                .trim()
                .toLowerCase()
                .normalize("NFD")
                .replace(
                    /[\u0300-\u036f]/g,
                    ""
                )
                .replace(
                    /[^a-z0-9]/g,
                    ""
                );

        }



        // ========================================
        // JSON
        // ========================================

        async function fetchJSON(
            path,
            required = false
        ) {

            try {

                const response =
                    await fetch(
                        path,
                        {
                            cache:
                                "no-store"
                        }
                    );


                if (!response.ok) {

                    if (required) {

                        throw new Error(
                            `No se pudo cargar ${path}`
                        );

                    }


                    return null;

                }


                return await response.json();

            }
            catch (error) {

                if (required) {
                    throw error;
                }


                return null;

            }

        }



        // ========================================
        // FOTO PILOTO
        // ========================================

        function getDefaultDriverImage(
            driverName
        ) {

            const filename =
                String(
                    driverName ?? ""
                )
                    .trim()
                    .toLowerCase();


            return (
                "images/drivers/" +
                encodeURIComponent(
                    filename
                ) +
                ".png"
            );

        }



        function getDriverImage(
            driverName
        ) {

            const profile =
                driverProfiles.get(
                    normalizeKey(
                        driverName
                    )
                );


            const profileImage =
                String(
                    profile?.image ??
                    profile?.photo ??
                    ""
                ).trim();


            if (profileImage) {
                return profileImage;
            }


            return getDefaultDriverImage(
                driverName
            );

        }



        // ========================================
        // PERFILES DE PILOTOS
        // ========================================

        function profileLooksValid(
            object
        ) {

            if (
                !object ||
                typeof object !==
                    "object" ||
                Array.isArray(object)
            ) {

                return false;

            }


            return Boolean(

                object.number !==
                    undefined ||

                object.dorsal !==
                    undefined ||

                object.raceNumber !==
                    undefined ||

                object.driverNumber !==
                    undefined ||

                object.region !==
                    undefined ||

                object.community !==
                    undefined ||

                object.comunidad !==
                    undefined ||

                object.image !==
                    undefined ||

                object.photo !==
                    undefined

            );

        }



        function registerDriverProfile(
            name,
            profile
        ) {

            const driverName =
                String(
                    name ?? ""
                ).trim();


            if (!driverName) {
                return;
            }


            const key =
                normalizeKey(
                    driverName
                );


            if (!key) {
                return;
            }


            driverProfiles.set(
                key,
                {
                    ...profile,

                    driverName:
                        driverName,

                    number:
                        String(
                            profile?.number ??
                            profile?.dorsal ??
                            profile?.raceNumber ??
                            profile?.driverNumber ??
                            ""
                        ).trim(),

                    image:
                        String(
                            profile?.image ??
                            profile?.photo ??
                            ""
                        ).trim()
                }
            );

        }



        function parseDriverProfiles(
            node,
            keyHint = ""
        ) {

            if (!node) {
                return;
            }


            if (Array.isArray(node)) {

                node.forEach(
                    item => {

                        parseDriverProfiles(
                            item
                        );

                    }
                );


                return;

            }


            if (
                typeof node !==
                "object"
            ) {

                return;

            }


            const explicitName =
                String(
                    node.driverName ??
                    node.name ??
                    node.nick ??
                    node.nickname ??
                    node.displayName ??
                    ""
                ).trim();


            let inferredName = "";


            if (
                !explicitName &&
                keyHint &&
                profileLooksValid(node)
            ) {

                const normalizedHint =
                    normalizeKey(
                        keyHint
                    );


                const reservedKeys = [
                    "hyperdrive",
                    "academy",
                    "drivers",
                    "profiles",
                    "pilotos"
                ];


                if (
                    !reservedKeys.includes(
                        normalizedHint
                    )
                ) {

                    inferredName =
                        keyHint;

                }

            }


            const driverName =
                explicitName ||
                inferredName;


            if (
                driverName &&
                profileLooksValid(node)
            ) {

                registerDriverProfile(
                    driverName,
                    node
                );

            }


            Object.entries(node)
                .forEach(
                    (
                        [
                            key,
                            value
                        ]
                    ) => {

                        if (
                            value &&
                            typeof value ===
                                "object"
                        ) {

                            parseDriverProfiles(
                                value,
                                key
                            );

                        }

                    }
                );

        }



        // ========================================
        // PILOTOS OFICIALES
        // ========================================

        function parseOfficialDriver(
            driver
        ) {

            if (
                typeof driver ===
                "string"
            ) {

                return {

                    driverName:
                        driver.trim(),

                    teamName:
                        ""

                };

            }


            if (
                !driver ||
                typeof driver !==
                    "object"
            ) {

                return null;

            }


            const driverName =
                String(
                    driver.driverName ??
                    driver.name ??
                    ""
                ).trim();


            let teamName = "";


            if (
                typeof driver.team ===
                    "object" &&
                driver.team
            ) {

                teamName =
                    String(
                        driver.team.name ??
                        ""
                    ).trim();

            }
            else {

                teamName =
                    String(
                        driver.teamName ??
                        driver.team ??
                        ""
                    ).trim();

            }


            if (!driverName) {
                return null;
            }


            return {

                driverName:
                    driverName,

                teamName:
                    teamName

            };

        }



        function loadOfficialRoster(
            data
        ) {

            DIVISIONS.forEach(
                division => {

                    const list =
                        Array.isArray(
                            data?.[
                                division
                            ]
                        )
                            ? data[
                                division
                            ]
                            : [];


                    officialDrivers[
                        division
                    ] =
                        list
                            .map(
                                parseOfficialDriver
                            )
                            .filter(Boolean);

                }
            );

        }



        // ========================================
        // VALIDAR SESSION
        // ========================================

        function isValidRaceFile(
            data
        ) {

            return Boolean(

                data &&
                data.session &&
                Array.isArray(
                    data.session.drivers
                )

            );

        }



        // ========================================
        // CARGAR R1 - R12
        // ========================================

        async function loadRaceFiles() {

            const requests = [];


            DIVISIONS.forEach(
                division => {

                    for (
                        let round = 1;
                        round <=
                            TOTAL_ROUNDS;
                        round++
                    ) {

                        requests.push(

                            fetchJSON(
                                `data/${division}_r${round}.json`
                            ).then(
                                data => {

                                    if (
                                        data &&
                                        isValidRaceFile(
                                            data
                                        )
                                    ) {

                                        raceSessions.push({

                                            division:
                                                division,

                                            round:
                                                round,

                                            type:
                                                "race",

                                            data:
                                                data

                                        });

                                    }

                                }
                            )

                        );


                        requests.push(

                            fetchJSON(
                                `data/${division}_r${round}_sprint.json`
                            ).then(
                                data => {

                                    if (
                                        data &&
                                        isValidRaceFile(
                                            data
                                        )
                                    ) {

                                        raceSessions.push({

                                            division:
                                                division,

                                            round:
                                                round,

                                            type:
                                                "sprint",

                                            data:
                                                data

                                        });

                                    }

                                }
                            )

                        );

                    }

                }
            );


            await Promise.all(
                requests
            );


            raceSessions.sort(
                (
                    a,
                    b
                ) => {

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
        // COLOR RLT
        // ========================================

        function normalizeTeamColor(
            color
        ) {

            const value =
                String(
                    color ?? ""
                ).trim();


            // #AARRGGBB

            if (
                /^#[0-9a-fA-F]{8}$/
                    .test(value)
            ) {

                return (
                    "#" +
                    value.slice(3)
                );

            }


            if (
                /^#[0-9a-fA-F]{6}$/
                    .test(value)
            ) {

                return value;

            }


            return "";

        }



        // ========================================
        // INFORMACIÓN DE CARRERAS
        // ========================================

        function extractRaceInfo(
            data
        ) {

            const drivers =
                data?.session?.drivers;


            if (
                !Array.isArray(
                    drivers
                )
            ) {

                return;

            }


            drivers.forEach(
                driver => {

                    const driverName =
                        String(
                            driver.driverName ??
                            ""
                        ).trim();


                    const driverKey =
                        normalizeKey(
                            driverName
                        );


                    const raceNumber =
                        String(
                            driver
                                ?.driverInfo
                                ?.raceNumber ??
                            ""
                        ).trim();


                    if (
                        driverKey &&
                        raceNumber
                    ) {

                        raceDriverInfo.set(
                            driverKey,
                            {
                                raceNumber:
                                    raceNumber
                            }
                        );

                    }


                    const teamName =
                        String(
                            driver
                                ?.team
                                ?.name ??
                            ""
                        ).trim();


                    if (!teamName) {
                        return;
                    }


                    const teamKey =
                        normalizeKey(
                            teamName
                        );


                    const color =
                        normalizeTeamColor(
                            driver
                                ?.team
                                ?.primaryColor
                        );


                    if (teamKey) {

                        raceTeamInfo.set(
                            teamKey,
                            {
                                name:
                                    teamName,

                                color:
                                    color
                            }
                        );

                    }

                }
            );

        }



        // ========================================
        // DORSAL
        // ========================================

        function getDriverNumber(
            driverName
        ) {

            const key =
                normalizeKey(
                    driverName
                );


            const profile =
                driverProfiles.get(
                    key
                );


            const profileNumber =
                String(
                    profile?.number ??
                    ""
                ).trim();


            if (profileNumber) {
                return profileNumber;
            }


            const raceInfo =
                raceDriverInfo.get(
                    key
                );


            return String(
                raceInfo?.raceNumber ??
                ""
            ).trim();

        }



        // ========================================
        // DIVISIÓN DEL PILOTO
        // ========================================

        function getDriverDivision(
            driverName
        ) {

            const key =
                normalizeKey(
                    driverName
                );


            const hyperdriveDriver =
                officialDrivers
                    .hyperdrive
                    .find(
                        driver =>
                            normalizeKey(
                                driver.driverName
                            ) === key
                    );


            if (hyperdriveDriver) {
                return "hyperdrive";
            }


            const academyDriver =
                officialDrivers
                    .academy
                    .find(
                        driver =>
                            normalizeKey(
                                driver.driverName
                            ) === key
                    );


            if (academyDriver) {
                return "academy";
            }


            return "";

        }



        // ========================================
        // COLORES DE EQUIPO
        // ========================================

        const fallbackTeamColors = {

            alpine:
                "#0093CC",

            astonmartin:
                "#229971",

            audi:
                "#F50537",

            mercedes:
                "#27F4D2",

            racingbulls:
                "#6692FF",

            cadillac:
                "#B7B7B7",

            haas:
                "#B6BABD",

            mclaren:
                "#FF8000",

            williams:
                "#64C4FF",

            redbull:
                "#3671C6",

            ferrari:
                "#E80020"

        };



        function getTeamColor(
            teamName
        ) {

            const key =
                normalizeKey(
                    teamName
                );


            const raceInfo =
                raceTeamInfo.get(
                    key
                );


            if (
                raceInfo?.color
            ) {

                return raceInfo.color;

            }


            return (
                fallbackTeamColors[
                    key
                ] ||
                "#ffd600"
            );

        }



        // ========================================
        // PILOTOS DE UN EQUIPO
        // ========================================

        function getTeamDrivers(
            teamName,
            division
        ) {

            const teamKey =
                normalizeKey(
                    teamName
                );


            return officialDrivers[
                division
            ]
                .filter(
                    driver => {

                        return (
                            normalizeKey(
                                driver.teamName
                            ) ===
                            teamKey
                        );

                    }
                )
                .slice(
                    0,
                    2
                );

        }



        // ========================================
        // PUNTOS
        // ========================================

        function toNumber(value) {

            const number =
                Number(value);


            return Number.isFinite(
                number
            )
                ? number
                : 0;

        }



        function formatPoints(value) {

            const number =
                toNumber(value);


            if (
                Number.isInteger(
                    number
                )
            ) {

                return String(
                    number
                );

            }


            return new Intl.NumberFormat(
                "es-ES",
                {
                    maximumFractionDigits:
                        2
                }
            ).format(
                number
            );

        }



        // ========================================
        // POSICIÓN DE CARRERA
        // ========================================

        function getRacePosition(
            driver
        ) {

            const classification =
                Number(
                    driver
                        ?.classificationPosition
                );


            if (
                Number.isFinite(
                    classification
                ) &&
                classification > 0
            ) {

                return classification;

            }


            const position =
                Number(
                    driver?.position
                );


            if (
                Number.isFinite(
                    position
                ) &&
                position > 0
            ) {

                return position;

            }


            return null;

        }



        // ========================================
        // ESTADÍSTICAS DE EQUIPOS
        // ========================================

        function createTeamStats(
            teamName
        ) {

            return {

                teamName:
                    teamName,

                points:
                    0,

                position:
                    null,

                wins:
                    0,

                podiums:
                    0,

                poles:
                    0,

                fastestLaps:
                    0,

                bestPosition:
                    null,

                bestDriver:
                    ""

            };

        }



        function ensureTeamStats(
            map,
            teamName
        ) {

            const key =
                normalizeKey(
                    teamName
                );


            if (!key) {
                return null;
            }


            if (!map.has(key)) {

                map.set(
                    key,
                    createTeamStats(
                        teamName
                    )
                );

            }


            return map.get(
                key
            );

        }



        function calculateTeamStats(
            teams
        ) {

            const stats =
                new Map();


            teams.forEach(
                team => {

                    ensureTeamStats(
                        stats,
                        team.name
                    );

                }
            );


            raceSessions.forEach(
                sessionFile => {

                    const session =
                        sessionFile
                            ?.data
                            ?.session;


                    const drivers =
                        session?.drivers;


                    if (
                        !Array.isArray(
                            drivers
                        )
                    ) {

                        return;

                    }


                    const isMainRace =
                        sessionFile.type ===
                        "race";


                    const fastestLapDriverKey =
                        normalizeKey(
                            session
                                ?.fastestLap
                                ?.driverName
                        );


                    drivers.forEach(
                        driver => {

                            const teamName =
                                String(
                                    driver
                                        ?.team
                                        ?.name ??
                                    ""
                                ).trim();


                            if (!teamName) {
                                return;
                            }


                            const team =
                                ensureTeamStats(
                                    stats,
                                    teamName
                                );


                            if (!team) {
                                return;
                            }


                            // ============================
                            // SUPERCONSTRUCTORES
                            // ============================

                            const basePoints =
                                toNumber(
                                    driver
                                        .driverPoints
                                );


                            const poleBonus =
                                (
                                    isMainRace &&
                                    Number(
                                        driver
                                            .gridPosition
                                    ) === 1
                                )
                                    ? 1
                                    : 0;


                            team.points +=
                                basePoints +
                                poleBonus;



                            // ============================
                            // EL RESTO SOLO CARRERA PRINCIPAL
                            // ============================

                            if (!isMainRace) {
                                return;
                            }


                            const position =
                                getRacePosition(
                                    driver
                                );


                            if (
                                position === 1
                            ) {

                                team.wins++;

                            }


                            if (
                                position !==
                                    null &&
                                position <= 3
                            ) {

                                team.podiums++;

                            }


                            if (
                                Number(
                                    driver.gridPosition
                                ) === 1
                            ) {

                                team.poles++;

                            }



                            // ============================
                            // MEJOR RESULTADO
                            // ============================

                            if (
                                position !==
                                null
                            ) {

                                if (
                                    team
                                        .bestPosition ===
                                        null ||
                                    position <
                                        team
                                            .bestPosition
                                ) {

                                    team.bestPosition =
                                        position;


                                    team.bestDriver =
                                        String(
                                            driver
                                                .driverName ??
                                            ""
                                        ).trim();

                                }

                            }



                            // ============================
                            // VUELTA RÁPIDA
                            // ============================

                            const driverKey =
                                normalizeKey(
                                    driver
                                        .driverName
                                );


                            if (
                                fastestLapDriverKey &&
                                driverKey ===
                                    fastestLapDriverKey
                            ) {

                                team.fastestLaps++;

                            }

                        }
                    );

                }
            );



            // ========================================
            // CLASIFICACIÓN SUPERCONSTRUCTORES
            // ========================================

            const ordered =
                Array.from(
                    stats.values()
                )
                    .sort(
                        (
                            a,
                            b
                        ) => {

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
                    );


            ordered.forEach(
                (
                    team,
                    index
                ) => {

                    team.position =
                        index + 1;

                }
            );


            return stats;

        }



        // ========================================
        // ASIENTO DISPONIBLE
        // ========================================

        function renderEmptySeat() {

            return `

                <article
                    class="
                        team-driver
                        empty
                    "
                >

                    <div
                        class="
                            team-driver-empty-content
                        "
                    >

                        <span
                            class="
                                team-driver-empty-icon
                            "
                        >
                            +
                        </span>

                        <span
                            class="
                                team-driver-empty-label
                            "
                        >
                            ASIENTO DISPONIBLE
                        </span>

                    </div>

                </article>

            `;

        }



        // ========================================
        // PILOTO
        // ========================================

        function renderDriver(
            driver
        ) {

            if (!driver) {
                return renderEmptySeat();
            }


            const driverName =
                driver.driverName;


            const driverNumber =
                getDriverNumber(
                    driverName
                );


            const driverImage =
                getDriverImage(
                    driverName
                );


            return `

                <article
                    class="team-driver"
                >

                    <div
                        class="
                            team-driver-photo
                        "
                    >

                        <img
                            src="${escapeHTML(
                                driverImage
                            )}"
                            alt="${escapeHTML(
                                driverName
                            )}"
                            loading="lazy"
                            onerror="
                                this.style.display='none'
                            "
                        >

                    </div>


                    <div
                        class="
                            team-driver-info
                        "
                    >

                        <span
                            class="
                                team-driver-number
                            "
                        >
                            ${
                                driverNumber
                                    ? `#${escapeHTML(
                                        driverNumber
                                    )}`
                                    : "PILOTO"
                            }
                        </span>


                        <h4
                            class="
                                team-driver-name
                            "
                        >
                            ${escapeHTML(
                                driverName
                            )}
                        </h4>

                    </div>

                </article>

            `;

        }



        // ========================================
        // DIVISIÓN
        // ========================================

        function renderDivision(
            title,
            drivers
        ) {

            const slots = [
                drivers[0] || null,
                drivers[1] || null
            ];


            const count =
                drivers.length;


            return `

                <section
                    class="team-division"
                >

                    <div
                        class="
                            team-division-heading
                        "
                    >

                        <span
                            class="
                                team-division-label
                            "
                        >
                            ${escapeHTML(
                                title
                            )}
                        </span>


                        <span
                            class="
                                team-division-count
                            "
                        >
                            ${
                                count === 2
                                    ? "2 PILOTOS"
                                    : `${count}/2 PILOTOS`
                            }
                        </span>

                    </div>


                    <div
                        class="
                            team-drivers
                        "
                    >

                        ${
                            slots
                                .map(
                                    renderDriver
                                )
                                .join("")
                        }

                    </div>

                </section>

            `;

        }



        // ========================================
        // TEAM PRINCIPAL
        // ========================================

        function renderTeamPrincipal(
            principalName
        ) {

            const image =
                getDriverImage(
                    principalName
                );


            const division =
                getDriverDivision(
                    principalName
                );


            const number =
                getDriverNumber(
                    principalName
                );


            let subtitle =
                "TEAM PRINCIPAL";


            if (division) {

                subtitle =
                    `PILOTO ${
                        division ===
                            "hyperdrive"
                            ? "HYPERDRIVE"
                            : "ACADEMY"
                    }`;

            }


            if (number) {

                subtitle +=
                    ` · #${number}`;

            }


            return `

                <div
                    class="team-principal"
                >

                    <div
                        class="
                            team-principal-photo
                        "
                    >

                        <img
                            src="${escapeHTML(
                                image
                            )}"
                            alt="${escapeHTML(
                                principalName
                            )}"
                            loading="lazy"
                            onerror="
                                this.style.display='none'
                            "
                        >

                    </div>


                    <div
                        class="
                            team-principal-info
                        "
                    >

                        <span
                            class="
                                team-principal-role
                            "
                        >
                            TEAM PRINCIPAL
                        </span>


                        <h3
                            class="
                                team-principal-name
                            "
                        >
                            ${escapeHTML(
                                principalName
                            )}
                        </h3>


                        <span
                            class="
                                team-principal-subtitle
                            "
                        >
                            ${escapeHTML(
                                subtitle
                            )}
                        </span>

                    </div>

                </div>

            `;

        }



        // ========================================
        // ESTADÍSTICAS VISUALES
        // ========================================

        function renderTeamStats(
            stats
        ) {

            if (!stats) {

                return "";

            }


            const bestResult =
                stats.bestPosition !==
                    null
                    ? `P${stats.bestPosition}`
                    : "—";


            const bestDriver =
                stats.bestDriver ||
                "SIN RESULTADOS";


            return `

                <section
                    class="
                        team-performance
                    "
                >

                    <div
                        class="
                            team-superconstructor
                        "
                    >

                        <span
                            class="
                                team-performance-label
                            "
                        >
                            SUPERCONSTRUCTORES
                        </span>


                        <div
                            class="
                                team-superconstructor-data
                            "
                        >

                            <strong>
                                P${escapeHTML(
                                    stats.position
                                )}
                            </strong>

                            <span>
                                ${escapeHTML(
                                    formatPoints(
                                        stats.points
                                    )
                                )}
                                PTS
                            </span>

                        </div>

                    </div>


                    <div
                        class="
                            team-performance-grid
                        "
                    >

                        <div
                            class="
                                team-performance-stat
                            "
                        >

                            <strong>
                                ${escapeHTML(
                                    stats.wins
                                )}
                            </strong>

                            <span>
                                VICTORIAS
                            </span>

                        </div>


                        <div
                            class="
                                team-performance-stat
                            "
                        >

                            <strong>
                                ${escapeHTML(
                                    stats.podiums
                                )}
                            </strong>

                            <span>
                                PODIOS
                            </span>

                        </div>


                        <div
                            class="
                                team-performance-stat
                            "
                        >

                            <strong>
                                ${escapeHTML(
                                    stats.poles
                                )}
                            </strong>

                            <span>
                                POLES
                            </span>

                        </div>


                        <div
                            class="
                                team-performance-stat
                            "
                        >

                            <strong>
                                ${escapeHTML(
                                    stats.fastestLaps
                                )}
                            </strong>

                            <span>
                                VUELTAS RÁPIDAS
                            </span>

                        </div>

                    </div>


                    <div
                        class="
                            team-best-result
                        "
                    >

                        <span
                            class="
                                team-performance-label
                            "
                        >
                            MEJOR RESULTADO
                        </span>


                        <strong>
                            ${escapeHTML(
                                bestResult
                            )}
                        </strong>


                        <span
                            class="
                                team-best-driver
                            "
                        >
                            ${escapeHTML(
                                bestDriver
                            )}
                        </span>

                    </div>

                </section>

            `;

        }



        // ========================================
        // EQUIPO
        // ========================================

        function renderTeam(
            team,
            teamStats
        ) {

            const teamName =
                String(
                    team.name ??
                    ""
                ).trim();


            const logo =
                String(
                    team.logo ??
                    ""
                ).trim();


            const principal =
                String(
                    team.teamPrincipal ??
                    ""
                ).trim();


            const teamColor =
                getTeamColor(
                    teamName
                );


            const hyperdriveDrivers =
                getTeamDrivers(
                    teamName,
                    "hyperdrive"
                );


            const academyDrivers =
                getTeamDrivers(
                    teamName,
                    "academy"
                );


            const stats =
                teamStats.get(
                    normalizeKey(
                        teamName
                    )
                );


            return `

                <article
                    class="team-card"
                    style="
                        --team-color:
                        ${escapeHTML(
                            teamColor
                        )};
                    "
                >


                    <!-- CABECERA -->

                    <div
                        class="
                            team-card-header
                        "
                    >

                        <div
                            class="
                                team-card-title
                            "
                        >

                            <span
                                class="
                                    team-card-label
                                "
                            >
                                ESCUDERÍA
                            </span>


                            <h2
                                class="
                                    team-card-name
                                "
                            >
                                ${escapeHTML(
                                    teamName
                                )}
                            </h2>

                        </div>


                        <div
                            class="
                                team-card-logo
                            "
                        >

                            <img
                                src="${escapeHTML(
                                    logo
                                )}"
                                alt="Logo ${escapeHTML(
                                    teamName
                                )}"
                                loading="lazy"
                            >

                        </div>

                    </div>


                    <!-- TEAM PRINCIPAL -->

                    ${
                        renderTeamPrincipal(
                            principal
                        )
                    }


                    <!-- ALINEACIONES -->

                    <div
                        class="
                            team-lineups
                        "
                    >

                        ${
                            renderDivision(
                                "HYPERDRIVE",
                                hyperdriveDrivers
                            )
                        }


                        ${
                            renderDivision(
                                "ACADEMY",
                                academyDrivers
                            )
                        }

                    </div>


                    <!-- ESTADÍSTICAS -->

                    ${
                        renderTeamStats(
                            stats
                        )
                    }


                </article>

            `;

        }



        // ========================================
        // RENDER GENERAL
        // ========================================

        function renderTeams(
            teams,
            teamStats
        ) {

            if (
                !Array.isArray(teams) ||
                teams.length === 0
            ) {

                teamsGrid.innerHTML = `

                    <div
                        class="teams-error"
                    >
                        NO HAY EQUIPOS DISPONIBLES
                    </div>

                `;


                return;

            }


            teamsGrid.innerHTML =
                teams
                    .map(
                        team =>
                            renderTeam(
                                team,
                                teamStats
                            )
                    )
                    .join("");

        }



        // ========================================
        // INICIALIZACIÓN
        // ========================================

        async function initTeams() {

            teamsGrid.innerHTML = `

                <div
                    class="teams-loading"
                >
                    CARGANDO EQUIPOS...
                </div>

            `;


            try {

                const [
                    teamProfilesData,
                    officialDriversData,
                    driverProfilesData
                ] =
                    await Promise.all([

                        fetchJSON(
                            "data/team-profiles.json",
                            true
                        ),

                        fetchJSON(
                            "data/official-drivers.json",
                            true
                        ),

                        fetchJSON(
                            "data/driver-profiles.json",
                            false
                        )

                    ]);



                // ========================================
                // PERFILES
                // ========================================

                if (
                    driverProfilesData
                ) {

                    parseDriverProfiles(
                        driverProfilesData
                    );

                }



                // ========================================
                // PARRILLA OFICIAL
                // ========================================

                loadOfficialRoster(
                    officialDriversData
                );



                // ========================================
                // TODAS LAS CARRERAS
                // ========================================

                await loadRaceFiles();



                // ========================================
                // DATOS RLT
                // ========================================

                raceSessions.forEach(
                    session => {

                        extractRaceInfo(
                            session.data
                        );

                    }
                );



                // ========================================
                // EQUIPOS
                // ========================================

                const teams =
                    Array.isArray(
                        teamProfilesData
                            ?.teams
                    )
                        ? teamProfilesData
                            .teams
                        : [];



                // ========================================
                // ESTADÍSTICAS
                // ========================================

                const teamStats =
                    calculateTeamStats(
                        teams
                    );



                // ========================================
                // MOSTRAR
                // ========================================

                renderTeams(
                    teams,
                    teamStats
                );

            }
            catch (error) {

                console.error(
                    "HyperDrive Equipos:",
                    error
                );


                teamsGrid.innerHTML = `

                    <div
                        class="teams-error"
                    >
                        ERROR AL CARGAR LOS EQUIPOS
                    </div>

                `;

            }

        }



        initTeams();


    }
);
