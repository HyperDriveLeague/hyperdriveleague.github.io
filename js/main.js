// ========================================
// HYPERDRIVE LEAGUE
// JavaScript principal
// ========================================

document.addEventListener("DOMContentLoaded", () => {

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


    // ========================================
    // DATOS
    // ========================================

    const standingsData = {
        hyperdrive: [],
        academy: []
    };

    let activeDivision = "hyperdrive";
    let activeResultsDivision = "hyperdrive";


    // ========================================
    // SEGURIDAD DE TEXTO
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

        const filename = String(driverName ?? "")
            .trim()
            .toLowerCase();

        return `images/drivers/${encodeURIComponent(filename)}.png`;

    }


    // ========================================
    // CLASIFICACIÓN
    // ========================================

    function renderStandings(division) {

        if (!standingsList) {
            return;
        }

        activeDivision = division;

        const drivers = standingsData[division];


        if (!Array.isArray(drivers) || drivers.length === 0) {

            standingsList.innerHTML = `
                <div class="standings-loading">
                    CARGANDO CLASIFICACIÓN...
                </div>
            `;

            return;
        }


        const topDrivers = drivers.slice(0, 5);


        standingsList.innerHTML = topDrivers.map(driver => {

            const driverImage =
                getDriverImage(driver.driverName);

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
                        ${escapeHTML(driver.points)}
                    </span>

                </div>
            `;

        }).join("");

    }


    // ========================================
    // ÚLTIMOS RESULTADOS
    // ========================================

    function renderLatestResults(division) {

        if (!resultsList || !resultsEvent) {
            return;
        }

        activeResultsDivision = division;

        const drivers = standingsData[division];


        if (!Array.isArray(drivers) || drivers.length === 0) {

            resultsList.innerHTML = `
                <div class="results-loading">
                    CARGANDO RESULTADOS...
                </div>
            `;

            return;
        }


        // Buscar la ronda más reciente presente en los datos
        let latestRound = 0;
        let latestEventName = "";


        drivers.forEach(driver => {

            const events = Array.isArray(driver.events)
                ? driver.events
                : [];


            events.forEach(event => {

                const round =
                    Number(event.roundNumber ?? 0);


                if (round > latestRound) {

                    latestRound = round;

                    latestEventName =
                        event.eventName ||
                        event.trackName ||
                        "";

                }

            });

        });


        if (latestRound === 0) {

            resultsList.innerHTML = `
                <div class="results-loading">
                    NO HAY RESULTADOS DISPONIBLES
                </div>
            `;

            return;
        }


        // Construir clasificación de la última carrera
        const raceResults = [];


        drivers.forEach(driver => {

            const events = Array.isArray(driver.events)
                ? driver.events
                : [];


            const latestEvent = events.find(event => {
                return Number(event.roundNumber) === latestRound;
            });


            if (!latestEvent) {
                return;
            }


            const races = Array.isArray(latestEvent.races)
                ? latestEvent.races
                : [];


            const race = races[0];


            if (!race || race.position == null) {
                return;
            }


            raceResults.push({

                position: Number(race.position),

                driverName: driver.driverName,

                teamName: driver.teamName,

                points:
                    latestEvent.pointsEarned ??
                    race.pointsEarned ??
                    "0"

            });

        });


        raceResults.sort((a, b) => {
            return a.position - b.position;
        });


        const podium = raceResults.slice(0, 3);


        resultsEvent.textContent =
            `R${latestRound} · GP ${String(latestEventName).toUpperCase()}`;


        if (podium.length === 0) {

            resultsList.innerHTML = `
                <div class="results-loading">
                    NO HAY RESULTADOS DISPONIBLES
                </div>
            `;

            return;
        }


        resultsList.innerHTML = podium.map(result => {

            const driverImage =
                getDriverImage(result.driverName);


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
                        ${escapeHTML(result.points)} PTS
                    </div>

                </div>
            `;

        }).join("");

    }


    // ========================================
    // CARGAR JSON DE RACING LEAGUE TOOLS
    // ========================================

    async function loadStandingsFile(division, file) {

        try {

            const response = await fetch(file, {
                cache: "no-store"
            });


            if (!response.ok) {

                throw new Error(
                    `No se pudo cargar ${file}. Código: ${response.status}`
                );

            }


            const data = await response.json();


            const drivers =
                data?.seasonStatistics?.driverStandings;


            if (!Array.isArray(drivers)) {

                throw new Error(
                    `${file} no contiene seasonStatistics.driverStandings`
                );

            }


            standingsData[division] = drivers;


            if (activeDivision === division) {
                renderStandings(division);
            }


            if (activeResultsDivision === division) {
                renderLatestResults(division);
            }


        } catch (error) {

            console.error(error);


            if (
                activeDivision === division &&
                standingsList
            ) {

                standingsList.innerHTML = `
                    <div class="standings-loading">
                        ERROR AL CARGAR LA CLASIFICACIÓN
                    </div>
                `;

            }


            if (
                activeResultsDivision === division &&
                resultsList
            ) {

                resultsList.innerHTML = `
                    <div class="results-loading">
                        ERROR AL CARGAR LOS RESULTADOS
                    </div>
                `;

            }

        }

    }


    // ========================================
    // PESTAÑAS DE CLASIFICACIÓN
    // ========================================

    standingsTabs.forEach(tab => {

        tab.addEventListener("click", () => {

            standingsTabs.forEach(button => {
                button.classList.remove("active");
            });


            tab.classList.add("active");


            renderStandings(
                tab.dataset.division
            );

        });

    });


    // ========================================
    // PESTAÑAS DE RESULTADOS
    // ========================================

    resultsTabs.forEach(tab => {

        tab.addEventListener("click", () => {

            resultsTabs.forEach(button => {
                button.classList.remove("active");
            });


            tab.classList.add("active");


            renderLatestResults(
                tab.dataset.resultsDivision
            );

        });

    });


    // ========================================
    // CARGAR LAS DOS DIVISIONES
    // ========================================

    loadStandingsFile(
        "hyperdrive",
        "data/hyperdrive-standings.json"
    );


    loadStandingsFile(
        "academy",
        "data/academy-standings.json"
    );

});
