// ========================================
// HYPERDRIVE LEAGUE
// Campeonato
// ========================================

document.addEventListener("DOMContentLoaded", () => {

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

    const championshipData = {

        hyperdrive: {
            drivers: [],
            teams: []
        },

        academy: {
            drivers: [],
            teams: []
        }

    };


    let activeChampionship = "hyperdrive";


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
    // FOTO DEL PILOTO
    // ========================================

    function getDriverImage(driverName) {

        const filename =
            String(driverName ?? "")
                .trim()
                .toLowerCase();

        return `images/drivers/${encodeURIComponent(filename)}.png`;

    }


    // ========================================
    // POSICIÓN
    // ========================================

    function formatPosition(position) {

        const number = Number(position);

        if (!number || number < 1) {
            return "—";
        }

        return number;

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
    // ORDENAR PILOTOS
    // ========================================

    function sortDrivers(drivers) {

        return [...drivers].sort((a, b) => {

            const positionA =
                Number(a.position ?? 0);

            const positionB =
                Number(b.position ?? 0);


            if (positionA === 0 && positionB === 0) {

                return String(a.driverName)
                    .localeCompare(
                        String(b.driverName),
                        "es"
                    );

            }


            if (positionA === 0) {
                return 1;
            }


            if (positionB === 0) {
                return -1;
            }


            return positionA - positionB;

        });

    }


    // ========================================
    // MOSTRAR PILOTOS
    // ========================================

    function renderDrivers(division) {

        if (!championshipList) {
            return;
        }


        setDriverHeader();


        const drivers =
            championshipData[division]?.drivers ?? [];


        if (!Array.isArray(drivers) || drivers.length === 0) {

            championshipList.innerHTML = `
                <div class="championship-loading">
                    NO HAY DATOS DISPONIBLES
                </div>
            `;

            return;
        }


        const sortedDrivers =
            sortDrivers(drivers);


        championshipList.innerHTML =
            sortedDrivers.map(driver => {

                const driverImage =
                    getDriverImage(
                        driver.driverName
                    );


                return `
                    <div class="championship-row">

                        <span class="championship-position">
                            ${escapeHTML(
                                formatPosition(
                                    driver.position
                                )
                            )}
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
                            ${escapeHTML(
                                driver.teamName || "SIN EQUIPO"
                            )}
                        </span>


                        <span class="championship-points">
                            ${escapeHTML(driver.points || "0")}
                        </span>

                    </div>
                `;

            }).join("");

    }


    // ========================================
    // CONSTRUIR CLASIFICACIÓN CONSTRUCTORES
    // ========================================

    function buildConstructorsStandings() {

        const teams = new Map();


        const divisions = [
            "hyperdrive",
            "academy"
        ];


        divisions.forEach(division => {

            const divisionTeams =
                championshipData[division]?.teams ?? [];


            divisionTeams.forEach(team => {

                const teamName =
                    String(team.teamName ?? "")
                        .trim();


                if (!teamName) {
                    return;
                }


                const key =
                    teamName.toLowerCase();


                if (!teams.has(key)) {

                    teams.set(key, {

                        teamName: teamName,

                        points: 0,

                        driverNames: new Set(),

                        teamInfo:
                            team.teamInfo ?? null

                    });

                }


                const combinedTeam =
                    teams.get(key);


                combinedTeam.points +=
                    Number(team.points ?? 0);


                const drivers =
                    Array.isArray(team.driverNames)
                        ? team.driverNames
                        : [];


                drivers.forEach(driverName => {

                    if (driverName) {

                        combinedTeam.driverNames.add(
                            driverName
                        );

                    }

                });

            });

        });


        return Array.from(
            teams.values()
        )
            .sort((a, b) => {

                if (b.points !== a.points) {
                    return b.points - a.points;
                }

                return a.teamName.localeCompare(
                    b.teamName,
                    "es"
                );

            })
            .map((team, index) => {

                return {

                    ...team,

                    position: index + 1,

                    driverNames:
                        Array.from(
                            team.driverNames
                        )

                };

            });

    }


    // ========================================
    // COLOR ESCUDERÍA
    // ========================================

    function getTeamColor(team) {

        const color =
            team?.teamInfo?.primaryColor;


        if (!color) {
            return "#ffd500";
        }


        /*
            Racing League Tools puede devolver
            colores ARGB:

            #FFFF8000

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
    // MOSTRAR CONSTRUCTORES
    // ========================================

    function renderConstructors() {

        if (!championshipList) {
            return;
        }


        setConstructorsHeader();


        const constructors =
            buildConstructorsStandings();


        if (constructors.length === 0) {

            championshipList.innerHTML = `
                <div class="championship-loading">
                    NO HAY DATOS DE CONSTRUCTORES
                </div>
            `;

            return;
        }


        championshipList.innerHTML =
            constructors.map(team => {

                const teamColor =
                    getTeamColor(team);


                const driversText =
                    team.driverNames.length > 0
                        ? team.driverNames.join(" · ")
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
                            ${escapeHTML(team.points)}
                        </span>

                    </div>
                `;

            }).join("");

    }


    // ========================================
    // MOSTRAR CAMPEONATO
    // ========================================

    function renderChampionship(type) {

        activeChampionship = type;


        if (type === "constructors") {

            renderConstructors();

            return;
        }


        renderDrivers(type);

    }


    // ========================================
    // CARGAR ARCHIVOS
    // ========================================

    async function loadChampionshipFile(
        division,
        file
    ) {

        try {

            const response =
                await fetch(
                    file,
                    {
                        cache: "no-store"
                    }
                );


            if (!response.ok) {

                throw new Error(
                    `No se pudo cargar ${file}. Código: ${response.status}`
                );

            }


            const data =
                await response.json();


            const drivers =
                data?.seasonStatistics?.driverStandings;


            const teams =
                data?.seasonStatistics?.teamStandings;


            if (!Array.isArray(drivers)) {

                throw new Error(
                    `${file} no contiene driverStandings`
                );

            }


            championshipData[division].drivers =
                drivers;


            championshipData[division].teams =
                Array.isArray(teams)
                    ? teams
                    : [];


            if (
                activeChampionship === division
            ) {

                renderChampionship(
                    division
                );

            }


            if (
                activeChampionship ===
                "constructors"
            ) {

                renderConstructors();

            }


        } catch (error) {

            console.error(error);


            if (
                championshipList &&
                activeChampionship === division
            ) {

                championshipList.innerHTML = `
                    <div class="championship-loading">
                        ERROR AL CARGAR EL CAMPEONATO
                    </div>
                `;

            }

        }

    }


    // ========================================
    // BOTONES
    // ========================================

    championshipTabs.forEach(tab => {

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
                    tab.dataset.championship
                );

            }
        );

    });


    // ========================================
    // CARGA INICIAL
    // ========================================

    loadChampionshipFile(
        "hyperdrive",
        "data/hyperdrive-standings.json"
    );


    loadChampionshipFile(
        "academy",
        "data/academy-standings.json"
    );

});
