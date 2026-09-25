// ========================================
// HYPERDRIVE LEAGUE
// Pilotos · Temporada 8
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


    let currentDivision =
        "hyperdrive";


    let officialDrivers =
        null;


    let driverProfiles =
        null;


    const raceData = {
        hyperdrive: [],
        academy: []
    };


    // ========================================
    // ELEMENTOS
    // ========================================

    const driversGrid =
        document.getElementById(
            "drivers-grid"
        );


    const driversCount =
        document.getElementById(
            "drivers-count"
        );


    const divisionTitle =
        document.getElementById(
            "drivers-division-title"
        );


    const divisionButtons =
        document.querySelectorAll(
            "[data-drivers-division]"
        );


    if (!driversGrid) {
        return;
    }


    // ========================================
    // UTILIDADES
    // ========================================

    function normalizeName(value) {

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


    function escapeHTML(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    }


    function toNumber(value) {

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : 0;

    }


    function clamp(
        value,
        min,
        max
    ) {

        return Math.min(
            Math.max(
                value,
                min
            ),
            max
        );

    }


    // ========================================
    // SLUG PARA IMÁGENES
    // ========================================

    function driverSlug(name) {

        return String(name ?? "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .replace(
                /[^a-z0-9]+/g,
                ""
            );

    }


    // ========================================
    // COLOR DE EQUIPO
    // ========================================

    const TEAM_COLORS = {

        "redbull":
            "#3671C6",

        "astonmartin":
            "#229971",

        "mercedes":
            "#27F4D2",

        "williams":
            "#64C4FF",

        "mclaren":
            "#FF8000",

        "ferrari":
            "#E8002D",

        "haas":
            "#B6BABD",

        "alpine":
            "#FF87BC",

        "audi":
            "#F50537",

        "racingbulls":
            "#6692FF",

        "cadillac":
            "#D8D8D8"

    };


    function cssTeamColor(color) {

        if (
            !color ||
            typeof color !== "string"
        ) {

            return null;

        }


        if (
            color.startsWith("#") &&
            color.length === 9
        ) {

            return `#${color.slice(3)}`;

        }


        if (
            color.startsWith("#") &&
            color.length === 7
        ) {

            return color;

        }


        return null;

    }


    function fallbackTeamColor(teamName) {

        const key =
            normalizeName(
                teamName
            );


        return TEAM_COLORS[key]
            || "#ffd500";

    }


    // ========================================
    // ESTADO DNF
    // ========================================

    function isDNF(driver) {

        const status =
            String(
                driver?.status ?? ""
            )
                .trim()
                .toLowerCase();


        if (!status) {
            return false;
        }


        return (
            status.includes("dnf") ||
            status.includes("retired") ||
            status.includes("retir") ||
            status.includes("did not finish") ||
            status.includes("disqualified") ||
            status.includes("dsq") ||
            status.includes("terminal")
        );

    }


    // ========================================
    // POSICIÓN FINAL
    // ========================================

    function getFinishPosition(driver) {

        const classification =
            Number(
                driver?.classificationPosition
            );


        if (
            Number.isFinite(classification) &&
            classification > 0
        ) {

            return classification;

        }


        const position =
            Number(
                driver?.position
            );


        if (
            Number.isFinite(position) &&
            position > 0
        ) {

            return position;

        }


        return null;

    }


    // ========================================
    // PUNTOS EFECTIVOS
    // ========================================

    function getEffectivePoints(
        driver,
        type
    ) {

        const base =
            toNumber(
                driver?.driverPoints
            );


        const poleBonus =
            type === "race" &&
            Number(
                driver?.gridPosition
            ) === 1
                ? 1
                : 0;


        return (
            base +
            poleBonus
        );

    }


    // ========================================
    // BUSCAR PILOTO EN SESIÓN
    // ========================================

    function findDriverInSession(
        sessionFile,
        driverName
    ) {

        const drivers =
            sessionFile?.data
                ?.session
                ?.drivers;


        if (
            !Array.isArray(drivers)
        ) {

            return null;

        }


        const target =
            normalizeName(
                driverName
            );


        return drivers.find(
            driver =>
                normalizeName(
                    driver.driverName
                ) === target
        ) || null;

    }


    // ========================================
    // VUELTA RÁPIDA
    // ========================================

    function hasFastestLap(
        sessionFile,
        driverName
    ) {

        const fastestDriver =
            sessionFile?.data
                ?.session
                ?.fastestLap
                ?.driverName;


        if (!fastestDriver) {
            return false;
        }


        return (
            normalizeName(
                fastestDriver
            ) ===
            normalizeName(
                driverName
            )
        );

    }


    // ========================================
    // DATOS DEL EQUIPO
    // ========================================

    function getDriverTeamData(
        driver,
        fallbackName
    ) {

        const team =
            driver?.team;


        const teamName =
            team?.name ||
            fallbackName ||
            "SIN EQUIPO";


        const color =
            cssTeamColor(
                team?.color
            ) ||
            cssTeamColor(
                team?.primaryColor
            ) ||
            fallbackTeamColor(
                teamName
            );


        return {
            name:
                teamName,

            color:
                color
        };

    }


    // ========================================
    // CARGAR JSON
    // ========================================

    async function loadJSON(path) {

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
                return null;
            }


            return await response.json();


        } catch (error) {

            return null;

        }

    }


    // ========================================
    // CARGAR ARCHIVOS DE CARRERA
    // ========================================

    async function loadDivisionRaces(
        division
    ) {

        const requests =
            [];


        for (
            let round = 1;
            round <= TOTAL_ROUNDS;
            round++
        ) {

            requests.push(

                loadJSON(
                    `data/${division}_r${round}_sprint.json`
                ).then(
                    data => ({
                        division:
                            division,

                        round:
                            round,

                        type:
                            "sprint",

                        data:
                            data
                    })
                )

            );


            requests.push(

                loadJSON(
                    `data/${division}_r${round}.json`
                ).then(
                    data => ({
                        division:
                            division,

                        round:
                            round,

                        type:
                            "race",

                        data:
                            data
                    })
                )

            );

        }


        const files =
            await Promise.all(
                requests
            );


        return files
            .filter(
                file =>
                    file.data
            )
            .sort(
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
    // PERFIL MANUAL
    // ========================================

    function getProfile(
        division,
        driverName
    ) {

        const profiles =
            driverProfiles?.[division];


        if (
            !Array.isArray(profiles)
        ) {

            return {};
        }


        const target =
            normalizeName(
                driverName
            );


        return (
            profiles.find(
                profile =>
                    normalizeName(
                        profile.driverName
                    ) === target
            ) || {}
        );

    }


    // ========================================
    // PARTICIPACIONES DEL PILOTO
    // ========================================

    function getDriverAppearances(
        division,
        driverName
    ) {

        const files =
            raceData[division] || [];


        const appearances =
            [];


        files.forEach(
            file => {

                const driver =
                    findDriverInSession(
                        file,
                        driverName
                    );


                if (!driver) {
                    return;
                }


                appearances.push({
                    ...file,
                    driver:
                        driver
                });

            }
        );


        return appearances;

    }


    // ========================================
    // ESTADÍSTICAS
    // ========================================

    function calculateDriverStats(
        division,
        officialDriver
    ) {

        const driverName =
            officialDriver.driverName;


        const appearances =
            getDriverAppearances(
                division,
                driverName
            );


        const mainRaces =
            appearances.filter(
                appearance =>
                    appearance.type ===
                    "race"
            );


        let points = 0;

        let wins = 0;

        let podiums = 0;

        let poles = 0;

        let fastestLaps = 0;

        let dnf = 0;

        let bestResult = null;

        let positionTotal = 0;

        let classifiedRaces = 0;

        let positionsGained = 0;

        let biggestComeback = null;


        // ========================================
        // PUNTOS
        // ========================================

        appearances.forEach(
            appearance => {

                points +=
                    getEffectivePoints(
                        appearance.driver,
                        appearance.type
                    );

            }
        );


        // ========================================
        // CARRERAS PRINCIPALES
        // ========================================

        mainRaces.forEach(
            appearance => {

                const driver =
                    appearance.driver;


                const finishPosition =
                    getFinishPosition(
                        driver
                    );


                const gridPosition =
                    Number(
                        driver.gridPosition
                    );


                // VICTORIAS

                if (
                    finishPosition === 1
                ) {

                    wins++;

                }


                // PODIOS

                if (
                    finishPosition !== null &&
                    finishPosition <= 3
                ) {

                    podiums++;

                }


                // POLES

                if (
                    gridPosition === 1
                ) {

                    poles++;

                }


                // VUELTAS RÁPIDAS

                if (
                    hasFastestLap(
                        appearance,
                        driverName
                    )
                ) {

                    fastestLaps++;

                }


                // DNF

                if (
                    isDNF(
                        driver
                    )
                ) {

                    dnf++;

                }


                // MEJOR RESULTADO

                if (
                    finishPosition !== null
                ) {

                    if (
                        bestResult === null ||
                        finishPosition <
                        bestResult
                    ) {

                        bestResult =
                            finishPosition;

                    }


                    positionTotal +=
                        finishPosition;


                    classifiedRaces++;

                }


                // REMONTADAS

                if (
                    Number.isFinite(
                        gridPosition
                    ) &&
                    gridPosition > 0 &&
                    finishPosition !== null
                ) {

                    const gain =
                        gridPosition -
                        finishPosition;


                    positionsGained +=
                        gain;


                    if (
                        biggestComeback === null ||
                        gain >
                        biggestComeback
                    ) {

                        biggestComeback =
                            gain;

                    }

                }

            }
        );


        const averageFinish =
            classifiedRaces > 0
                ? (
                    positionTotal /
                    classifiedRaces
                )
                : null;


        const finishRate =
            mainRaces.length > 0
                ? (
                    (
                        mainRaces.length -
                        dnf
                    ) /
                    mainRaces.length
                ) * 100
                : null;


        return {

            points:
                points,

            races:
                mainRaces.length,

            wins:
                wins,

            podiums:
                podiums,

            poles:
                poles,

            fastestLaps:
                fastestLaps,

            dnf:
                dnf,

            bestResult:
                bestResult,

            averageFinish:
                averageFinish,

            positionsGained:
                positionsGained,

            biggestComeback:
                biggestComeback,

            finishRate:
                finishRate,

            appearances:
                appearances,

            mainRaces:
                mainRaces

        };

    }


    // ========================================
    // EQUIPO ACTUAL
    // ========================================

    function getCurrentTeam(
        officialDriver,
        stats
    ) {

        const appearances =
            stats.appearances;


        for (
            let index =
                appearances.length - 1;

            index >= 0;

            index--
        ) {

            const appearance =
                appearances[index];


            if (
                appearance?.driver?.team
            ) {

                return getDriverTeamData(
                    appearance.driver,
                    officialDriver.teamName
                );

            }

        }


        return {

            name:
                officialDriver.teamName
                || "SIN EQUIPO",

            color:
                fallbackTeamColor(
                    officialDriver.teamName
                )

        };

    }


    // ========================================
    // POWER RANKING
    // ========================================

    function eventPerformanceScore(
        appearance
    ) {

        const driver =
            appearance.driver;


        const session =
            appearance?.data
                ?.session;


        const totalDrivers =
            Number(
                session?.sessionInfo
                    ?.driversCount
            ) ||
            session?.drivers?.length ||
            20;


        const finish =
            getFinishPosition(
                driver
            );


        const grid =
            Number(
                driver.gridPosition
            );


        const denominator =
            Math.max(
                totalDrivers - 1,
                1
            );


        // RESULTADO

        let finishScore =
            0.5;


        if (
            finish !== null
        ) {

            finishScore =
                1 -
                (
                    (
                        finish - 1
                    ) /
                    denominator
                );


            finishScore =
                clamp(
                    finishScore,
                    0,
                    1
                );

        }


        // CLASIFICACIÓN

        let qualifyingScore =
            0.5;


        if (
            Number.isFinite(grid) &&
            grid > 0
        ) {

            qualifyingScore =
                1 -
                (
                    (
                        grid - 1
                    ) /
                    denominator
                );


            qualifyingScore =
                clamp(
                    qualifyingScore,
                    0,
                    1
                );

        }


        // REMONTADA

        let gainScore =
            0.5;


        if (
            Number.isFinite(grid) &&
            grid > 0 &&
            finish !== null
        ) {

            const gain =
                grid -
                finish;


            gainScore =
                clamp(
                    0.5 +
                    (
                        gain /
                        20
                    ),
                    0,
                    1
                );

        }


        // FIABILIDAD

        const reliabilityScore =
            isDNF(driver)
                ? 0
                : 1;


        if (
            appearance.type ===
            "sprint"
        ) {

            return (
                finishScore * 0.75 +
                gainScore * 0.15 +
                reliabilityScore * 0.10
            );

        }


        return (
            finishScore * 0.60 +
            qualifyingScore * 0.15 +
            gainScore * 0.15 +
            reliabilityScore * 0.10
        );

    }


    function calculatePowerRanking(
        stats
    ) {

        const appearances =
            stats.appearances;


        if (
            appearances.length === 0
        ) {

            return 50;

        }


        const latestRound =
            Math.max(
                ...appearances.map(
                    appearance =>
                        appearance.round
                )
            );


        let weightedScore = 0;

        let totalWeight = 0;

        let experienceWeight = 0;


        appearances.forEach(
            appearance => {

                const performance =
                    eventPerformanceScore(
                        appearance
                    );


                const roundsAgo =
                    latestRound -
                    appearance.round;


                const recency =
                    Math.pow(
                        0.78,
                        roundsAgo
                    );


                const eventWeight =
                    appearance.type ===
                    "sprint"
                        ? 0.35
                        : 1;


                const finalWeight =
                    recency *
                    eventWeight;


                weightedScore +=
                    performance *
                    finalWeight;


                totalWeight +=
                    finalWeight;


                experienceWeight +=
                    eventWeight;

            }
        );


        if (
            totalWeight <= 0
        ) {

            return 50;

        }


        const performanceScore =
            (
                weightedScore /
                totalWeight
            ) * 100;


        const confidence =
            clamp(
                experienceWeight /
                4,
                0,
                1
            );


        const power =
            (
                50 *
                (
                    1 -
                    confidence
                )
            ) +
            (
                performanceScore *
                confidence
            );


        return Math.round(
            clamp(
                power,
                0,
                100
            )
        );

    }


    // ========================================
    // FORMATOS
    // ========================================

    function formatBestResult(value) {

        if (
            value === null ||
            value === undefined
        ) {

            return "—";

        }


        return `P${value}`;

    }


    function formatNumber(value) {

        const number =
            Number(value);


        if (
            !Number.isFinite(number)
        ) {

            return "—";

        }


        return String(
            Math.round(number)
        );

    }


    function formatAveragePosition(value) {

        const number =
            Number(value);


        if (
            !Number.isFinite(number)
        ) {

            return "—";

        }


        return number.toFixed(1);

    }


    function formatComeback(value) {

        const number =
            Number(value);


        if (
            !Number.isFinite(number)
        ) {

            return "—";

        }


        if (
            number > 0
        ) {

            return `+${number}`;

        }


        return String(number);

    }


    // ========================================
    // TARJETA
    // ========================================

    function renderDriverCard(
        division,
        officialDriver
    ) {

        const profile =
            getProfile(
                division,
                officialDriver.driverName
            );


        const stats =
            calculateDriverStats(
                division,
                officialDriver
            );


        const currentTeam =
            getCurrentTeam(
                officialDriver,
                stats
            );


        const power =
            calculatePowerRanking(
                stats
            );


        const number =
            profile.number !== null &&
            profile.number !== undefined &&
            profile.number !== ""
                ? profile.number
                : "—";


        const region =
            profile.region
                ? profile.region
                : "Comunidad por definir";


        const image =
            profile.image
                ? profile.image
                : (
                    "images/drivers/" +
                    driverSlug(
                        officialDriver.driverName
                    ) +
                    ".png"
                );


        const initials =
            String(
                officialDriver.driverName
            )
                .slice(0, 2)
                .toUpperCase();


        const divisionLabel =
            division ===
            "academy"
                ? "ACADEMY"
                : "HYPERDRIVE";


        return `
            <article
                class="driver-card"
                tabindex="0"
                role="button"
                aria-label="Ver estadísticas de ${escapeHTML(
                    officialDriver.driverName
                )}"
                style="--team-color: ${escapeHTML(
                    currentTeam.color
                )};"
            >

                <div class="driver-card-inner">


                    <!-- CARA DELANTERA -->

                    <div class="driver-card-front">


                        <div class="driver-card-top">


                            <div class="driver-power">

                                <span class="driver-power-label">
                                    POWER RANKING
                                </span>

                                <strong class="driver-power-value">
                                    ${escapeHTML(power)}
                                </strong>

                            </div>


                            <div class="driver-number">
                                #${escapeHTML(number)}
                            </div>


                        </div>


                        <div class="driver-photo-wrap">


                            <div class="driver-photo-fallback">
                                ${escapeHTML(initials)}
                            </div>


                            <img
                                class="driver-photo"
                                src="${escapeHTML(image)}"
                                alt="${escapeHTML(
                                    officialDriver.driverName
                                )}"
                                loading="lazy"
                                onerror="this.style.display='none'"
                            >


                        </div>


                        <div class="driver-card-info">


                            <h3 class="driver-name">
                                ${escapeHTML(
                                    officialDriver.driverName
                                )}
                            </h3>


                            <div class="driver-team">
                                ${escapeHTML(
                                    currentTeam.name
                                )}
                            </div>


                            <div class="driver-region">
                                ${escapeHTML(region)}
                            </div>


                            <div class="driver-flip-hint">

                                <span>
                                    VER ESTADÍSTICAS
                                </span>

                                <span>
                                    ↻
                                </span>

                            </div>


                        </div>


                    </div>



                    <!-- CARA TRASERA -->

                    <div class="driver-card-back">


                        <div class="driver-back-header">

                            <div>

                                <h3 class="driver-back-name">
                                    ${escapeHTML(
                                        officialDriver.driverName
                                    )}
                                </h3>

                                <span class="driver-back-team">
                                    ${escapeHTML(
                                        currentTeam.name
                                    )}
                                    ·
                                    ${divisionLabel}
                                </span>

                            </div>


                            <span class="driver-back-number">
                                #${escapeHTML(number)}
                            </span>

                        </div>



                        <div class="driver-stats-grid">


                            <div class="driver-stat highlight">

                                <span class="driver-stat-label">
                                    PUNTOS
                                </span>

                                <strong class="driver-stat-value">
                                    ${formatNumber(
                                        stats.points
                                    )}
                                </strong>

                            </div>


                            <div class="driver-stat">

                                <span class="driver-stat-label">
                                    CARRERAS
                                </span>

                                <strong class="driver-stat-value">
                                    ${formatNumber(
                                        stats.races
                                    )}
                                </strong>

                            </div>


                            <div class="driver-stat">

                                <span class="driver-stat-label">
                                    VICTORIAS
                                </span>

                                <strong class="driver-stat-value">
                                    ${formatNumber(
                                        stats.wins
                                    )}
                                </strong>

                            </div>


                            <div class="driver-stat">

                                <span class="driver-stat-label">
                                    PODIOS
                                </span>

                                <strong class="driver-stat-value">
                                    ${formatNumber(
                                        stats.podiums
                                    )}
                                </strong>

                            </div>


                            <div class="driver-stat">

                                <span class="driver-stat-label">
                                    POLES
                                </span>

                                <strong class="driver-stat-value">
                                    ${formatNumber(
                                        stats.poles
                                    )}
                                </strong>

                            </div>


                            <div class="driver-stat">

                                <span class="driver-stat-label">
                                    V. RÁPIDAS
                                </span>

                                <strong class="driver-stat-value">
                                    ${formatNumber(
                                        stats.fastestLaps
                                    )}
                                </strong>

                            </div>


                            <div class="driver-stat">

                                <span class="driver-stat-label">
                                    DNF
                                </span>

                                <strong class="driver-stat-value">
                                    ${formatNumber(
                                        stats.dnf
                                    )}
                                </strong>

                            </div>


                            <div class="driver-stat">

                                <span class="driver-stat-label">
                                    MEJOR RESULTADO
                                </span>

                                <strong class="driver-stat-value">
                                    ${formatBestResult(
                                        stats.bestResult
                                    )}
                                </strong>

                            </div>


                            <div class="driver-stat">

                                <span class="driver-stat-label">
                                    POS. MEDIA
                                </span>

                                <strong class="driver-stat-value">
                                    ${formatAveragePosition(
                                        stats.averageFinish
                                    )}
                                </strong>

                            </div>


                            <div class="driver-stat">

                                <span class="driver-stat-label">
                                    MAYOR REMONTADA
                                </span>

                                <strong class="driver-stat-value">
                                    ${formatComeback(
                                        stats.biggestComeback
                                    )}
                                </strong>

                            </div>


                        </div>



                        <div class="driver-back-footer">

                            <span>
                                SEASON 8 · ${divisionLabel}
                            </span>

                            <strong>
                                ↻
                            </strong>

                        </div>


                    </div>


                </div>

            </article>
        `;

    }


    // ========================================
    // RENDERIZAR DIVISIÓN
    // ========================================

    function renderDivision(
        division
    ) {

        const drivers =
            officialDrivers?.[division];


        if (
            !Array.isArray(drivers)
        ) {

            driversGrid.innerHTML = `
                <div class="drivers-loading">
                    NO SE HA PODIDO CARGAR LA PARRILLA
                </div>
            `;

            return;

        }


        const sortedDrivers =
            [...drivers]
                .sort(
                    (
                        a,
                        b
                    ) =>
                        String(
                            a.driverName
                        )
                            .localeCompare(
                                String(
                                    b.driverName
                                ),
                                "es",
                                {
                                    sensitivity:
                                        "base"
                                }
                            )
                );


        divisionTitle.textContent =
            division === "academy"
                ? "ACADEMY"
                : "HYPERDRIVE";


        driversCount.textContent =
            `${sortedDrivers.length} PILOTOS OFICIALES`;


        driversGrid.innerHTML =
            sortedDrivers
                .map(
                    driver =>
                        renderDriverCard(
                            division,
                            driver
                        )
                )
                .join("");


        activateCards();

    }


    // ========================================
    // GIRAR TARJETAS
    // ========================================

    function toggleCard(card) {

        card.classList.toggle(
            "flipped"
        );

    }


    function activateCards() {

        const cards =
            driversGrid.querySelectorAll(
                ".driver-card"
            );


        cards.forEach(
            card => {

                card.addEventListener(
                    "click",
                    () => {

                        toggleCard(
                            card
                        );

                    }
                );


                card.addEventListener(
                    "keydown",
                    event => {

                        if (
                            event.key ===
                                "Enter" ||
                            event.key ===
                                " "
                        ) {

                            event.preventDefault();


                            toggleCard(
                                card
                            );

                        }

                    }
                );

            }
        );

    }


    // ========================================
    // SELECTOR DE DIVISIÓN
    // ========================================

    divisionButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const division =
                        button.dataset
                            .driversDivision;


                    if (
                        !DIVISIONS.includes(
                            division
                        )
                    ) {

                        return;

                    }


                    currentDivision =
                        division;


                    divisionButtons.forEach(
                        item => {

                            item.classList.toggle(
                                "active",
                                item === button
                            );

                        }
                    );


                    renderDivision(
                        currentDivision
                    );

                }
            );

        }
    );


    // ========================================
    // INICIAR
    // ========================================

    async function init() {

        driversGrid.innerHTML = `
            <div class="drivers-loading">
                CARGANDO PARRILLA...
            </div>
        `;


        try {

            const [
                official,
                profiles,
                hyperdriveRaces,
                academyRaces
            ] =
                await Promise.all([

                    loadJSON(
                        "data/official-drivers.json"
                    ),

                    loadJSON(
                        "data/driver-profiles.json"
                    ),

                    loadDivisionRaces(
                        "hyperdrive"
                    ),

                    loadDivisionRaces(
                        "academy"
                    )

                ]);


            if (!official) {

                throw new Error(
                    "No se ha podido cargar official-drivers.json"
                );

            }


            officialDrivers =
                official;


            driverProfiles =
                profiles || {
                    hyperdrive: [],
                    academy: []
                };


            raceData.hyperdrive =
                hyperdriveRaces;


            raceData.academy =
                academyRaces;


            renderDivision(
                currentDivision
            );


        } catch (error) {

            console.error(
                "Error cargando pilotos:",
                error
            );


            driversGrid.innerHTML = `
                <div class="drivers-loading">
                    ERROR AL CARGAR LOS PILOTOS
                </div>
            `;


            if (driversCount) {

                driversCount.textContent =
                    "ERROR DE CARGA";

            }

        }

    }


    init();


});
