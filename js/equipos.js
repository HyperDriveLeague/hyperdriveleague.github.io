// ========================================
// HYPERDRIVE LEAGUE
// EQUIPOS
// ========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {


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


                console.warn(
                    `Archivo opcional no disponible: ${path}`,
                    error
                );


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

            [
                "hyperdrive",
                "academy"
            ].forEach(
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
        // INFORMACIÓN DE CARRERA
        // ========================================

        function normalizeTeamColor(
            color
        ) {

            const value =
                String(
                    color ?? ""
                ).trim();


            // RLT:
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
                        raceNumber &&
                        !raceDriverInfo.has(
                            driverKey
                        )
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


                    if (
                        teamKey &&
                        !raceTeamInfo.has(
                            teamKey
                        )
                    ) {

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
                        driver => {

                            return (
                                normalizeKey(
                                    driver
                                        .driverName
                                ) ===
                                key
                            );

                        }
                    );


            if (hyperdriveDriver) {

                return "hyperdrive";

            }



            const academyDriver =
                officialDrivers
                    .academy
                    .find(
                        driver => {

                            return (
                                normalizeKey(
                                    driver
                                        .driverName
                                ) ===
                                key
                            );

                        }
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
                                driver
                                    .teamName
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
        // PILOTO VACANTE
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
        // TARJETA PILOTO
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
        // EQUIPO
        // ========================================

        function renderTeam(
            team
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


                </article>

            `;

        }



        // ========================================
        // RENDER GENERAL
        // ========================================

        function renderTeams(
            teams
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
                        renderTeam
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
                    driverProfilesData,
                    hyperdriveRace,
                    academyRace
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
                        ),

                        fetchJSON(
                            "data/hyperdrive_r1.json",
                            false
                        ),

                        fetchJSON(
                            "data/academy_r1.json",
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
                // COLORES / DORSALES DE RESPALDO
                // ========================================

                extractRaceInfo(
                    hyperdriveRace
                );


                extractRaceInfo(
                    academyRace
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


                renderTeams(
                    teams
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
