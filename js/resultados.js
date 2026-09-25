// ========================================
// HYPERDRIVE LEAGUE
// Página de Resultados
// ========================================

document.addEventListener("DOMContentLoaded", () => {


    // ========================================
    // ELEMENTOS
    // ========================================

    const resultsList =
        document.getElementById("results-page-list");

    const resultsTabs =
        document.querySelectorAll(".results-page-tab");


    // ========================================
    // DATOS
    // ========================================

    const resultsData = {

        hyperdrive: [],

        academy: []

    };


    let activeDivision = "hyperdrive";


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
    // NOMBRE DEL GP
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

            españa: "ESPAÑA",

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

            abu_dhabi: "ABU DHABI"

        };


        return names[normalized] ||
            String(name ?? "")
                .trim()
                .toUpperCase();

    }


    // ========================================
    // FECHA
    // ========================================

    function formatDate(dateValue) {

        if (!dateValue) {
            return "";
        }


        const date =
            new Date(dateValue);


        if (Number.isNaN(date.getTime())) {
            return "";
        }


        return new Intl.DateTimeFormat(
            "es-ES",
            {
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        )
            .format(date)
            .toUpperCase();

    }


    // ========================================
    // BUSCAR CARRERA PRINCIPAL
    // ========================================

    function getMainRace(event) {

        const races =
            Array.isArray(event?.races)
                ? event.races
                : [];


        if (races.length === 0) {
            return null;
        }


        /*
            En rondas Sprint puede haber más
            de una carrera.

            Preferimos la sesión principal
            llamada "Race".
        */

        const featureRace =
            races.find(race => {

                const sessionName =
                    String(
                        race?.sessionName ?? ""
                    )
                        .trim()
                        .toLowerCase();


                return sessionName === "race";

            });


        if (featureRace) {
            return featureRace;
        }


        /*
            Si RLT usa otro nombre,
            descartamos primero los Sprint.
        */

        const nonSprintRace =
            races.find(race => {

                const sessionName =
                    String(
                        race?.sessionName ?? ""
                    )
                        .trim()
                        .toLowerCase();


                return !sessionName.includes(
                    "sprint"
                );

            });


        return nonSprintRace || races[0];

    }


    // ========================================
    // CONSTRUIR RONDAS
    // ========================================

    function buildRounds(data) {

        const drivers =
            data?.seasonStatistics?.driverStandings;


        if (!Array.isArray(drivers)) {
            return [];
        }


        const rounds = new Map();


        drivers.forEach(driver => {

            const events =
                Array.isArray(driver.events)
                    ? driver.events
                    : [];


            events.forEach(event => {

                const roundNumber =
                    Number(event.roundNumber);


                if (!roundNumber) {
                    return;
                }


                if (!rounds.has(roundNumber)) {

                    rounds.set(
                        roundNumber,
                        {
                            roundNumber:
                                roundNumber,

                            eventName:
                                event.eventName ||
                                event.trackName ||
                                `Ronda ${roundNumber}`,

                            trackName:
                                event.trackName ||
                                event.eventName ||
                                "",

                            eventDate:
                                event.eventDate ||
                                "",

                            results: []
                        }
                    );

                }


                const round =
                    rounds.get(roundNumber);


                const race =
                    getMainRace(event);


                if (!race) {
                    return;
                }


                const position =
                    Number(race.position);


                /*
                    Para construir el podio
                    necesitamos una posición
                    final válida.
                */

                if (
                    !Number.isFinite(position) ||
                    position < 1
                ) {

                    return;

                }


                round.results.push({

                    driverName:
                        driver.driverName ||
                        "Piloto",

                    teamName:
                        driver.teamName ||
                        "Sin equipo",

                    position:
                        position,

                    points:
                        race.pointsEarned ??
                        event.pointsEarned ??
                        "0",

                    status:
                        race.status ||
                        "Ok"

                });

            });

        });


        return Array.from(
            rounds.values()
        )
            .map(round => {

                /*
                    Evitamos posibles duplicados
                    de pilotos dentro de una ronda.
                */

                const driversSeen =
                    new Map();


                round.results.forEach(result => {

                    const key =
                        String(
                            result.driverName
                        )
                            .trim()
                            .toLowerCase();


                    const existing =
                        driversSeen.get(key);


                    if (
                        !existing ||
                        result.position <
                            existing.position
                    ) {

                        driversSeen.set(
                            key,
                            result
                        );

                    }

                });


                round.results =
                    Array.from(
                        driversSeen.values()
                    )
                        .sort(
                            (a, b) =>
                                a.position -
                                b.position
                        );


                return round;

            })
            .sort(
                (a, b) =>
                    b.roundNumber -
                    a.roundNumber
            );

    }


    // ========================================
    // PODIO
    // ========================================

    function renderPodium(round) {

        const podium =
            round.results
                .filter(result =>
                    result.position <= 3
                )
                .sort(
                    (a, b) =>
                        a.position -
                        b.position
                );


        if (podium.length === 0) {

            return `
                <div class="results-page-loading">
                    NO HAY RESULTADOS DISPONIBLES
                </div>
            `;

        }


        return `
            <div class="results-round-podium">

                ${podium.map(result => {

                    return `
                        <div class="results-round-driver">

                            <span class="results-round-position">
                                P${escapeHTML(result.position)}
                            </span>


                            <div class="results-round-driver-info">

                                <strong>
                                    ${escapeHTML(result.driverName)}
                                </strong>

                                <span>
                                    ${escapeHTML(result.teamName)}
                                </span>

                            </div>


                            <span class="results-round-points">
                                ${escapeHTML(result.points)} PTS
                            </span>

                        </div>
                    `;

                }).join("")}

            </div>
        `;

    }


    // ========================================
    // MOSTRAR RESULTADOS
    // ========================================

    function renderResults(division) {

        if (!resultsList) {
            return;
        }


        activeDivision = division;


        const rounds =
            resultsData[division];


        if (
            !Array.isArray(rounds) ||
            rounds.length === 0
        ) {

            resultsList.innerHTML = `
                <div class="results-page-loading">
                    CARGANDO RESULTADOS...
                </div>
            `;

            return;

        }


        resultsList.innerHTML =
            rounds.map(round => {

                const gpName =
                    formatGrandPrixName(
                        round.eventName
                    );


                const date =
                    formatDate(
                        round.eventDate
                    );


                return `
                    <article class="results-round-card">


                        <div class="results-round-header">


                            <span class="results-round-number">
                                RONDA ${escapeHTML(round.roundNumber)}
                            </span>


                            <div class="results-round-info">

                                <h2>
                                    GP ${escapeHTML(gpName)}
                                </h2>

                                <span>
                                    ${escapeHTML(date)}
                                </span>

                            </div>


                            <span class="results-round-tag">
                                COMPLETADA
                            </span>


                        </div>


                        ${renderPodium(round)}


                    </article>
                `;

            }).join("");

    }


    // ========================================
    // CARGAR ARCHIVO
    // ========================================

    async function loadResultsFile(
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


            resultsData[division] =
                buildRounds(data);


            if (
                activeDivision === division
            ) {

                renderResults(
                    division
                );

            }


        } catch (error) {

            console.error(error);


            if (
                resultsList &&
                activeDivision === division
            ) {

                resultsList.innerHTML = `
                    <div class="results-page-loading">
                        ERROR AL CARGAR LOS RESULTADOS
                    </div>
                `;

            }

        }

    }


    // ========================================
    // PESTAÑAS
    // ========================================

    resultsTabs.forEach(tab => {

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


                renderResults(
                    tab.dataset
                        .resultsPageDivision
                );

            }
        );

    });


    // ========================================
    // CARGA INICIAL
    // ========================================

    loadResultsFile(
        "hyperdrive",
        "data/hyperdrive-standings.json"
    );


    loadResultsFile(
        "academy",
        "data/academy-standings.json"
    );


});
