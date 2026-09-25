// ========================================
// HYPERDRIVE LEAGUE
// Página Resultados
// ========================================

document.addEventListener("DOMContentLoaded", () => {
    const TOTAL_ROUNDS = 12;
    const DIVISIONS = ["hyperdrive", "academy"];

    const resultsList = document.getElementById("results-page-list");
    const resultsTabs = document.querySelectorAll(".results-page-tab");

    const resultsData = {
        hyperdrive: [],
        academy: []
    };

    let activeDivision = "hyperdrive";

    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function normalizeKey(value) {
        return String(value ?? "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "");
    }

    function getDriverImage(driverName) {
        const filename = String(driverName ?? "").trim().toLowerCase();
        return `images/drivers/${encodeURIComponent(filename)}.png`;
    }

    function getInitial(driverName) {
        const name = String(driverName ?? "").trim();

        if (!name) {
            return "?";
        }

        return name
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(0, 2)
            .toUpperCase();
    }

    function formatGrandPrixName(name) {
        const normalized = String(name ?? "").trim().toLowerCase();

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
            abudhabi: "ABU DHABI",
            "abu dhabi": "ABU DHABI"
        };

        return names[normalized] ||
            String(name ?? "")
                .trim()
                .toUpperCase();
    }

    function formatDate(dateValue) {
        if (!dateValue) {
            return "";
        }

        const date = new Date(dateValue);

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

    function formatWeather(weather) {
        const value = String(weather ?? "")
            .trim()
            .toLowerCase();

        const names = {
            clear: "DESPEJADO",
            lightcloud: "NUBES LIGERAS",
            overcast: "NUBLADO",
            lightrain: "LLUVIA LIGERA",
            heavyrain: "LLUVIA INTENSA",
            storm: "TORMENTA",
            rain: "LLUVIA"
        };

        return names[value] ||
            String(weather ?? "—")
                .toUpperCase();
    }

    function formatTyre(compound) {
        const value = String(compound ?? "")
            .trim()
            .toLowerCase();

        const names = {
            soft: "BLANDO",
            medium: "MEDIO",
            hard: "DURO",
            intermediate: "INTERMEDIO",
            wet: "LLUVIA"
        };

        return names[value] ||
            String(compound ?? "—")
                .toUpperCase();
    }

    function getStatusCode(status) {
        const value = String(status ?? "")
            .trim()
            .toLowerCase();

        if (
            value === "dnf" ||
            value.includes("didnotfinish")
        ) {
            return "DNF";
        }

        if (
            value === "dns" ||
            value.includes("didnotstart")
        ) {
            return "DNS";
        }

        if (
            value === "dsq" ||
            value.includes("disqual")
        ) {
            return "DSQ";
        }

        return "";
    }

    function formatStatus(status) {
        const code = getStatusCode(status);

        if (code) {
            return code;
        }

        const value = String(status ?? "")
            .trim()
            .toLowerCase();

        if (
            value === "finished" ||
            value === "ok"
        ) {
            return "FINALIZADO";
        }

        return String(status ?? "—")
            .toUpperCase();
    }

    function validPosition(value) {
        const number = Number(value);

        if (
            !Number.isFinite(number) ||
            number < 1
        ) {
            return null;
        }

        return number;
    }

    function formatFinalPosition(result) {
        const position = validPosition(result.position);

        if (position) {
            return `P${position}`;
        }

        return getStatusCode(result.status) || "—";
    }

    function formatGridPosition(value) {
        const position = validPosition(value);

        return position
            ? `P${position}`
            : "—";
    }

    function formatPositionChange(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "—";
        }

        if (number > 0) {
            return `+${number}`;
        }

        return String(number);
    }

    function getPositionChangeClass(value) {
        const number = Number(value);

        if (
            !Number.isFinite(number) ||
            number === 0
        ) {
            return "results-change-neutral";
        }

        return number > 0
            ? "results-change-positive"
            : "results-change-negative";
    }

    function toPoints(value) {
        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : 0;
    }

    function formatPoints(value) {
        const number = Number(value);

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

    function resultSort(a, b) {
        const positionA = validPosition(a.position);
        const positionB = validPosition(b.position);

        if (
            positionA !== null &&
            positionB !== null
        ) {
            return positionA - positionB;
        }

        if (positionA !== null) {
            return -1;
        }

        if (positionB !== null) {
            return 1;
        }

        const statusOrder = {
            DNF: 1,
            DNS: 2,
            DSQ: 3
        };

        const statusA =
            statusOrder[getStatusCode(a.status)] ?? 9;

        const statusB =
            statusOrder[getStatusCode(b.status)] ?? 9;

        return statusA - statusB;
    }

    function getPenaltyText(penalties) {
        if (!penalties) {
            return "0 s";
        }

        const seconds =
            Number(
                penalties.inGamePenaltySeconds ?? 0
            ) +
            Number(
                penalties.stewardPenaltySeconds ?? 0
            );

        const positions =
            Number(
                penalties.inGamePenaltyPositions ?? 0
            ) +
            Number(
                penalties.stewardPenaltyPositions ?? 0
            );

        if (seconds > 0) {
            return `${seconds} s`;
        }

        if (positions > 0) {
            return `${positions} pos.`;
        }

        return "0 s";
    }

    function formatStrategy(stints) {
        if (
            !Array.isArray(stints) ||
            stints.length === 0
        ) {
            return "—";
        }

        return stints
            .map(stint => {
                const compound =
                    formatTyre(
                        stint.tyreCompound
                    );

                const laps =
                    Number(
                        stint.lapsCount
                    );

                if (
                    Number.isFinite(laps) &&
                    laps > 0
                ) {
                    return `${compound} · ${laps}V`;
                }

                return compound;
            })
            .join(" → ");
    }

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

    function isValidSessionFile(data) {
        return Boolean(
            data?.session &&
            Array.isArray(
                data.session.drivers
            )
        );
    }

    function buildSessionFromFile(
        data,
        type,
        roundNumber
    ) {
        if (!isValidSessionFile(data)) {
            return null;
        }

        const session =
            data.session;

        const sessionInfo =
            session.sessionInfo || {};

        const fastestLap =
            session.fastestLap || null;

        const fastestDriverKey =
            normalizeKey(
                fastestLap?.driverName
            );

        const results =
            session.drivers
                .map(driver => {
                    const driverName =
                        String(
                            driver.driverName ??
                            "Piloto"
                        ).trim();

                    const driverKey =
                        normalizeKey(
                            driverName
                        );

                    const classificationPosition =
                        validPosition(
                            driver.classificationPosition
                        );

                    const normalPosition =
                        validPosition(
                            driver.position
                        );

                    const gridPosition =
                        validPosition(
                            driver.gridPosition
                        );

                    const isPole =
                        type === "race" &&
                        gridPosition === 1;

                    /*
                        driverPoints YA incluye
                        el punto de vuelta rápida
                        que haya concedido RLT.

                        Solo añadimos +1 por pole
                        en la carrera principal.
                    */

                    const basePoints =
                        toPoints(
                            driver.driverPoints
                        );

                    const poleBonus =
                        isPole
                            ? 1
                            : 0;

                    return {
                        driverName:
                            driverName,

                        raceNumber:
                            driver?.driverInfo
                                ?.raceNumber ||
                            "",

                        teamName:
                            driver?.team?.name ||
                            "Sin equipo",

                        position:
                            classificationPosition ??
                            normalPosition ??
                            null,

                        gridPosition:
                            gridPosition,

                        positionChange:
                            Number.isFinite(
                                Number(
                                    driver.positionChange
                                )
                            )
                                ? Number(
                                    driver.positionChange
                                )
                                : null,

                        rawPoints:
                            basePoints,

                        poleBonus:
                            poleBonus,

                        points:
                            basePoints +
                            poleBonus,

                        isPole:
                            isPole,

                        status:
                            driver.status ||
                            "Finished",

                        isFinished:
                            String(
                                driver.status ?? ""
                            )
                                .toLowerCase() ===
                            "finished",

                        isFastestLap:
                            Boolean(
                                fastestDriverKey &&
                                fastestDriverKey ===
                                    driverKey
                            ),

                        lapsCompleted:
                            driver.lapsCompleted ??
                            null,

                        totalTime:
                            driver.totalTime ||
                            null,

                        gap:
                            driver.gap ||
                            null,

                        interval:
                            driver.interval ||
                            null,

                        fastestLapTime:
                            driver.fastestLapTime ||
                            null,

                        fastestLapNumber:
                            driver.fastestLapNumber ??
                            null,

                        fastestLapTyreCompound:
                            driver.fastestLapTyreCompound ||
                            null,

                        maxSpeed:
                            driver
                                ?.raceDetails
                                ?.maxSpeed ??
                            null,

                        penalties:
                            driver.penalties ||
                            null,

                        paceRating:
                            driver
                                ?.ratings
                                ?.pace
                                ?.rating ??
                            null,

                        consistencyRating:
                            driver
                                ?.ratings
                                ?.consistency
                                ?.rating ??
                            null,

                        stints:
                            Array.isArray(
                                driver.stints
                            )
                                ? driver.stints
                                : []
                    };
                })
                .sort(
                    resultSort
                );

        return {
            type:
                type,

            label:
                type === "sprint"
                    ? "SPRINT"
                    : "CARRERA",

            roundNumber:
                roundNumber,

            results:
                results,

            summary: {
                totalLaps:
                    sessionInfo.totalLaps ??
                    null,

                driversCount:
                    sessionInfo.driversCount ??
                    results.length,

                weatherType:
                    sessionInfo.weatherType ??
                    null,

                airTemperature:
                    sessionInfo.airTemperature ??
                    null,

                trackTemperature:
                    sessionInfo.trackTemperature ??
                    null,

                safetyCarCount:
                    sessionInfo.safetyCarCount ??
                    0,

                virtualSafetyCarCount:
                    sessionInfo
                        .virtualSafetyCarCount ??
                    0,

                fastestLap:
                    fastestLap
            }
        };
    }

    async function loadRound(
        division,
        roundNumber
    ) {
        const mainPath =
            `data/${division}_r${roundNumber}.json`;

        const sprintPath =
            `data/${division}_r${roundNumber}_sprint.json`;

        const [
            mainData,
            sprintData
        ] =
            await Promise.all([
                fetchOptionalJSON(
                    mainPath
                ),
                fetchOptionalJSON(
                    sprintPath
                )
            ]);

        const sessions = [];

        if (
            sprintData &&
            isValidSessionFile(
                sprintData
            )
        ) {
            const sprint =
                buildSessionFromFile(
                    sprintData,
                    "sprint",
                    roundNumber
                );

            if (sprint) {
                sessions.push(
                    sprint
                );
            }
        }

        if (
            mainData &&
            isValidSessionFile(
                mainData
            )
        ) {
            const race =
                buildSessionFromFile(
                    mainData,
                    "race",
                    roundNumber
                );

            if (race) {
                sessions.push(
                    race
                );
            }
        }

        if (
            sessions.length === 0
        ) {
            return null;
        }

        const eventSource =
            mainData ||
            sprintData;

        const trackName =
            eventSource
                ?.event
                ?.track
                ?.trackName ||
            `Ronda ${roundNumber}`;

        const eventDate =
            eventSource
                ?.event
                ?.eventDate ||
            "";

        return {
            roundNumber:
                roundNumber,

            eventName:
                trackName,

            trackName:
                trackName,

            eventDate:
                eventDate,

            sessions:
                sessions
        };
    }

    async function loadDivision(
        division
    ) {
        const promises = [];

        for (
            let round = 1;
            round <= TOTAL_ROUNDS;
            round++
        ) {
            promises.push(
                loadRound(
                    division,
                    round
                )
            );
        }

        const loaded =
            await Promise.all(
                promises
            );

        resultsData[
            division
        ] =
            loaded
                .filter(Boolean)
                .sort(
                    (a, b) =>
                        b.roundNumber -
                        a.roundNumber
                );

        if (
            activeDivision ===
            division
        ) {
            renderResults(
                division
            );
        }
    }

    function renderPodium(session) {
        const podium =
            session.results
                .filter(result => {
                    const position =
                        validPosition(
                            result.position
                        );

                    return (
                        position !== null &&
                        position <= 3
                    );
                })
                .sort(
                    (a, b) =>
                        a.position -
                        b.position
                );

        if (
            podium.length === 0
        ) {
            return `
                <div class="results-page-loading">
                    NO HAY RESULTADOS DISPONIBLES
                </div>
            `;
        }

        return `
            <div class="results-podium-grid">

                ${podium
                    .map(result => {
                        const image =
                            getDriverImage(
                                result.driverName
                            );

                        const initial =
                            getInitial(
                                result.driverName
                            );

                        const winnerClass =
                            Number(
                                result.position
                            ) === 1
                                ? " is-winner"
                                : "";

                        const fastestNameClass =
                            result.isFastestLap
                                ? " results-fastest-driver-name"
                                : "";

                        const poleText =
                            result.isPole
                                ? `
                                    <span class="results-podium-fastest">
                                        POLE +1
                                    </span>
                                `
                                : "";

                        return `
                            <article class="results-podium-card${winnerClass}">

                                <span class="results-podium-position">
                                    P${escapeHTML(result.position)}
                                </span>


                                <div
                                    class="results-podium-photo"
                                    data-initial="${escapeHTML(initial)}"
                                >

                                    <img
                                        src="${image}"
                                        alt="${escapeHTML(result.driverName)}"
                                        loading="lazy"
                                        onerror="
                                            this.style.display='none';
                                            this.parentElement.classList.add('no-photo');
                                        "
                                    >

                                </div>


                                <div class="results-podium-content">

                                    <strong class="${fastestNameClass.trim()}">
                                        ${escapeHTML(result.driverName)}
                                    </strong>

                                    <span>
                                        ${escapeHTML(result.teamName)}
                                    </span>


                                    <div class="results-podium-bottom">

                                        <span class="results-podium-points">
                                            ${escapeHTML(
                                                formatPoints(
                                                    result.points
                                                )
                                            )} PTS
                                        </span>

                                        ${poleText}

                                    </div>

                                </div>

                            </article>
                        `;
                    })
                    .join("")
                }

            </div>
        `;
    }

    function renderSessionSummary(session) {
        const summary =
            session.summary;

        if (!summary) {
            return "";
        }

        const fastest =
            summary.fastestLap;

        const fastestText =
            fastest
                ? `${fastest.driverName} · ${fastest.lapTime}`
                : "—";

        const temperatureText =
            (
                summary.airTemperature !==
                    null &&
                summary.trackTemperature !==
                    null
            )
                ? `${summary.airTemperature}° AIRE · ${summary.trackTemperature}° PISTA`
                : "—";

        return `
            <div class="results-session-summary">

                <div class="results-summary-item">
                    <span>
                        VUELTAS
                    </span>

                    <strong>
                        ${escapeHTML(
                            summary.totalLaps ??
                            "—"
                        )}
                    </strong>
                </div>


                <div class="results-summary-item">
                    <span>
                        PILOTOS
                    </span>

                    <strong>
                        ${escapeHTML(
                            summary.driversCount ??
                            "—"
                        )}
                    </strong>
                </div>


                <div class="results-summary-item">
                    <span>
                        CLIMA
                    </span>

                    <strong>
                        ${escapeHTML(
                            formatWeather(
                                summary.weatherType
                            )
                        )}
                    </strong>
                </div>


                <div class="results-summary-item">
                    <span>
                        TEMPERATURA
                    </span>

                    <strong>
                        ${escapeHTML(
                            temperatureText
                        )}
                    </strong>
                </div>


                <div class="results-summary-item highlight">
                    <span>
                        VUELTA RÁPIDA
                    </span>

                    <strong class="results-fastest-driver-name">
                        ${escapeHTML(
                            fastestText
                        )}
                    </strong>
                </div>


                <div class="results-summary-item">
                    <span>
                        SAFETY CAR
                    </span>

                    <strong>
                        ${escapeHTML(
                            summary.safetyCarCount ??
                            0
                        )} SC ·
                        ${escapeHTML(
                            summary.virtualSafetyCarCount ??
                            0
                        )} VSC
                    </strong>
                </div>

            </div>
        `;
    }

    function getRaceTimeText(result) {
        const position =
            validPosition(
                result.position
            );

        if (
            position === 1 &&
            result.totalTime
        ) {
            return result.totalTime;
        }

        if (
            result.gap &&
            result.gap !== "0"
        ) {
            return result.gap;
        }

        if (
            result.totalTime
        ) {
            return result.totalTime;
        }

        return (
            getStatusCode(
                result.status
            ) ||
            "—"
        );
    }

    function hasDriverDetails(result) {
        return Boolean(
            result.lapsCompleted !== null ||
            result.maxSpeed !== null ||
            result.fastestLapTime ||
            result.paceRating !== null ||
            result.consistencyRating !== null ||
            (
                Array.isArray(
                    result.stints
                ) &&
                result.stints.length > 0
            ) ||
            result.penalties ||
            result.isPole
        );
    }

    function renderDriverExtra(result) {
        const fastestLapText =
            result.fastestLapTime
                ? `${result.fastestLapTime}${
                    result.fastestLapNumber
                        ? ` · V${result.fastestLapNumber}`
                        : ""
                }`
                : "—";

        const tyreText =
            result.fastestLapTyreCompound
                ? formatTyre(
                    result.fastestLapTyreCompound
                )
                : "—";

        const maxSpeedText =
            result.maxSpeed !== null
                ? `${result.maxSpeed} km/h`
                : "—";

        const paceText =
            result.paceRating !== null
                ? `${result.paceRating}/10`
                : "—";

        const consistencyText =
            result.consistencyRating !== null
                ? `${result.consistencyRating}/10`
                : "—";

        const lapsText =
            result.lapsCompleted !== null
                ? result.lapsCompleted
                : "—";

        const strategy =
            formatStrategy(
                result.stints
            );

        const poleText =
            result.isPole
                ? "+1 PUNTO"
                : "—";

        return `
            <div
                class="results-driver-extra"
                hidden
            >

                <div class="results-driver-extra-grid">

                    <div class="results-driver-stat">
                        <span>
                            ESTADO
                        </span>

                        <strong>
                            ${escapeHTML(
                                formatStatus(
                                    result.status
                                )
                            )}
                        </strong>
                    </div>


                    <div class="results-driver-stat">
                        <span>
                            VUELTAS
                        </span>

                        <strong>
                            ${escapeHTML(
                                lapsText
                            )}
                        </strong>
                    </div>


                    <div class="results-driver-stat">
                        <span>
                            VUELTA RÁPIDA
                        </span>

                        <strong>
                            ${escapeHTML(
                                fastestLapText
                            )}
                        </strong>
                    </div>


                    <div class="results-driver-stat">
                        <span>
                            NEUMÁTICO VR
                        </span>

                        <strong>
                            ${escapeHTML(
                                tyreText
                            )}
                        </strong>
                    </div>


                    <div class="results-driver-stat">
                        <span>
                            VELOCIDAD MÁX.
                        </span>

                        <strong>
                            ${escapeHTML(
                                maxSpeedText
                            )}
                        </strong>
                    </div>


                    <div class="results-driver-stat">
                        <span>
                            SANCIÓN
                        </span>

                        <strong>
                            ${escapeHTML(
                                getPenaltyText(
                                    result.penalties
                                )
                            )}
                        </strong>
                    </div>


                    <div class="results-driver-stat">
                        <span>
                            RITMO RLT
                        </span>

                        <strong>
                            ${escapeHTML(
                                paceText
                            )}
                        </strong>
                    </div>


                    <div class="results-driver-stat">
                        <span>
                            CONSISTENCIA
                        </span>

                        <strong>
                            ${escapeHTML(
                                consistencyText
                            )}
                        </strong>
                    </div>


                    <div class="results-driver-stat">
                        <span>
                            BONUS POLE
                        </span>

                        <strong>
                            ${escapeHTML(
                                poleText
                            )}
                        </strong>
                    </div>


                    <div class="results-driver-stat strategy">
                        <span>
                            ESTRATEGIA
                        </span>

                        <strong>
                            ${escapeHTML(
                                strategy
                            )}
                        </strong>
                    </div>

                </div>

            </div>
        `;
    }

    function renderFullTable(session) {
        const rows =
            session.results
                .map(result => {
                    const image =
                        getDriverImage(
                            result.driverName
                        );

                    const initial =
                        getInitial(
                            result.driverName
                        );

                    const finalPosition =
                        formatFinalPosition(
                            result
                        );

                    const positionStatus =
                        getStatusCode(
                            result.status
                        );

                    let positionClass = "";

                    if (
                        positionStatus ===
                        "DNF"
                    ) {
                        positionClass =
                            " results-status-dnf";
                    }

                    if (
                        positionStatus ===
                        "DSQ"
                    ) {
                        positionClass =
                            " results-status-dsq";
                    }

                    if (
                        positionStatus ===
                        "DNS"
                    ) {
                        positionClass =
                            " results-status-dns";
                    }

                    const change =
                        formatPositionChange(
                            result.positionChange
                        );

                    const changeClass =
                        getPositionChangeClass(
                            result.positionChange
                        );

                    const time =
                        getRaceTimeText(
                            result
                        );

                    const fastestLap =
                        result.fastestLapTime ||
                        "—";

                    const hasDetails =
                        hasDriverDetails(
                            result
                        );

                    const fastestNameClass =
                        result.isFastestLap
                            ? " results-fastest-driver-name"
                            : "";

                    const detailControl =
                        hasDetails
                            ? `
                                <button
                                    class="results-driver-toggle"
                                    type="button"
                                    aria-expanded="false"
                                >
                                    DATOS
                                </button>
                            `
                            : `
                                <span class="results-driver-no-details">
                                    —
                                </span>
                            `;

                    const extra =
                        hasDetails
                            ? renderDriverExtra(
                                result
                            )
                            : "";

                    const blockClass =
                        hasDetails
                            ? " has-details"
                            : "";

                    const blockAttributes =
                        hasDetails
                            ? 'role="button" tabindex="0" aria-expanded="false"'
                            : "";

                    return `
                        <div
                            class="results-full-driver-block${blockClass}"
                            ${blockAttributes}
                        >

                            <div class="results-full-row">

                                <span class="results-full-position${positionClass}">
                                    ${escapeHTML(
                                        finalPosition
                                    )}
                                </span>


                                <div class="results-full-driver">

                                    <div
                                        class="results-full-photo"
                                        data-initial="${escapeHTML(initial)}"
                                    >

                                        <img
                                            src="${image}"
                                            alt="${escapeHTML(result.driverName)}"
                                            loading="lazy"
                                            onerror="
                                                this.style.display='none';
                                                this.parentElement.classList.add('no-photo');
                                            "
                                        >

                                    </div>


                                    <div class="results-full-driver-text">

                                        <strong class="${fastestNameClass.trim()}">
                                            ${escapeHTML(
                                                result.driverName
                                            )}
                                        </strong>

                                        <small>
                                            ${
                                                result.raceNumber
                                                    ? `#${escapeHTML(result.raceNumber)} · `
                                                    : ""
                                            }

                                            ${escapeHTML(
                                                formatStatus(
                                                    result.status
                                                )
                                            )}

                                            ${
                                                result.isPole
                                                    ? " · POLE"
                                                    : ""
                                            }
                                        </small>

                                    </div>

                                </div>


                                <span class="results-full-team">
                                    ${escapeHTML(
                                        result.teamName
                                    )}
                                </span>


                                <span class="results-full-center">
                                    ${escapeHTML(
                                        formatGridPosition(
                                            result.gridPosition
                                        )
                                    )}
                                </span>


                                <span class="results-full-center ${changeClass}">
                                    ${escapeHTML(
                                        change
                                    )}
                                </span>


                                <span class="results-full-center">
                                    ${escapeHTML(
                                        time
                                    )}
                                </span>


                                <span class="results-full-center">
                                    ${escapeHTML(
                                        fastestLap
                                    )}
                                </span>


                                <span class="results-full-center results-points">
                                    ${escapeHTML(
                                        formatPoints(
                                            result.points
                                        )
                                    )}
                                </span>


                                <div class="results-full-center">
                                    ${detailControl}
                                </div>

                            </div>


                            ${extra}

                        </div>
                    `;
                })
                .join("");

        return `
            <div class="results-full-section">

                <div class="results-full-title">

                    <h3>
                        CLASIFICACIÓN ${escapeHTML(session.label)}
                    </h3>

                    <span>
                        ${escapeHTML(session.results.length)}
                        PILOTOS
                    </span>

                </div>


                <div class="results-full-table-scroll">

                    <div class="results-full-table">

                        <div class="results-full-header">

                            <span>
                                POS
                            </span>

                            <span>
                                PILOTO
                            </span>

                            <span>
                                EQUIPO
                            </span>

                            <span>
                                SALIDA
                            </span>

                            <span>
                                +/-
                            </span>

                            <span>
                                TIEMPO / GAP
                            </span>

                            <span>
                                V. RÁPIDA
                            </span>

                            <span>
                                PTS
                            </span>

                            <span>
                                DATOS
                            </span>

                        </div>


                        <div>
                            ${rows}
                        </div>

                    </div>

                </div>

            </div>
        `;
    }

    function renderSessionPreview(session) {
        return `
            <section
                class="results-session-block"
                data-session-type="${escapeHTML(session.type)}"
            >

                <div class="results-session-heading">

                    <span class="results-session-label">
                        ${escapeHTML(
                            session.label
                        )}
                    </span>

                </div>


                ${renderPodium(session)}

            </section>
        `;
    }

    function renderSessionDetails(session) {
        return `
            <section
                class="results-session-details"
                data-session-type="${escapeHTML(session.type)}"
            >

                <div class="results-full-title">

                    <h3>
                        ${escapeHTML(
                            session.label
                        )}
                    </h3>

                </div>


                ${renderSessionSummary(session)}

                ${renderFullTable(session)}

            </section>
        `;
    }

    function renderRound(round) {
        const gpName =
            formatGrandPrixName(
                round.eventName
            );

        const date =
            formatDate(
                round.eventDate
            );

        const hasSprint =
            round.sessions
                .some(
                    session =>
                        session.type ===
                        "sprint"
                );

        const tag =
            hasSprint
                ? "SPRINT + CARRERA"
                : "DATOS COMPLETOS";

        return `
            <article
                class="results-round-card"
                data-round="${escapeHTML(round.roundNumber)}"
            >

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
                        ${escapeHTML(tag)}
                    </span>

                </div>


                ${
                    round.sessions
                        .map(
                            renderSessionPreview
                        )
                        .join("")
                }


                <div class="results-round-footer">

                    <button
                        class="results-round-expand"
                        type="button"
                        aria-expanded="false"
                    >

                        <span>
                            VER CLASIFICACIÓN COMPLETA
                        </span>

                        <span class="results-expand-arrow">
                            ↓
                        </span>

                    </button>

                </div>


                <div
                    class="results-round-details"
                    hidden
                >

                    ${
                        round.sessions
                            .map(
                                renderSessionDetails
                            )
                            .join("")
                    }

                </div>

            </article>
        `;
    }

    function renderResults(division) {
        if (!resultsList) {
            return;
        }

        activeDivision =
            division;

        const rounds =
            resultsData[
                division
            ];

        if (
            !Array.isArray(rounds) ||
            rounds.length === 0
        ) {
            resultsList.innerHTML = `
                <div class="results-page-loading">
                    NO HAY RESULTADOS DISPONIBLES
                </div>
            `;

            return;
        }

        resultsList.innerHTML =
            rounds
                .map(
                    renderRound
                )
                .join("");
    }

    resultsTabs.forEach(
        tab => {
            tab.addEventListener(
                "click",
                () => {
                    resultsTabs
                        .forEach(
                            button => {
                                button
                                    .classList
                                    .remove(
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
        }
    );

    function toggleDriverBlock(block) {
        if (!block) {
            return;
        }

        const extra =
            block.querySelector(
                ".results-driver-extra"
            );

        if (!extra) {
            return;
        }

        const driverButton =
            block.querySelector(
                ".results-driver-toggle"
            );

        const isOpen =
            block.getAttribute(
                "aria-expanded"
            ) === "true";

        block.setAttribute(
            "aria-expanded",
            String(!isOpen)
        );

        extra.hidden =
            isOpen;

        if (driverButton) {
            driverButton.setAttribute(
                "aria-expanded",
                String(!isOpen)
            );

            driverButton.textContent =
                isOpen
                    ? "DATOS"
                    : "CERRAR";
        }
    }

    if (resultsList) {
        resultsList.addEventListener(
            "click",
            event => {
                const roundButton =
                    event.target.closest(
                        ".results-round-expand"
                    );

                if (roundButton) {
                    const card =
                        roundButton.closest(
                            ".results-round-card"
                        );

                    const details =
                        card?.querySelector(
                            ".results-round-details"
                        );

                    if (!details) {
                        return;
                    }

                    const isOpen =
                        roundButton
                            .getAttribute(
                                "aria-expanded"
                            ) === "true";

                    roundButton.setAttribute(
                        "aria-expanded",
                        String(!isOpen)
                    );

                    details.hidden =
                        isOpen;

                    card.classList.toggle(
                        "round-open",
                        !isOpen
                    );

                    const text =
                        roundButton.querySelector(
                            "span:first-child"
                        );

                    const arrow =
                        roundButton.querySelector(
                            ".results-expand-arrow"
                        );

                    if (text) {
                        text.textContent =
                            isOpen
                                ? "VER CLASIFICACIÓN COMPLETA"
                                : "OCULTAR CLASIFICACIÓN";
                    }

                    if (arrow) {
                        arrow.textContent =
                            isOpen
                                ? "↓"
                                : "↑";
                    }

                    return;
                }


                /*
                    DATOS DEL PILOTO

                    Se abre tanto pulsando
                    el botón DATOS como
                    pinchando en toda la fila.
                */

                const driverBlock =
                    event.target.closest(
                        ".results-full-driver-block.has-details"
                    );

                if (driverBlock) {
                    toggleDriverBlock(
                        driverBlock
                    );
                }
            }
        );


        /*
            ACCESIBILIDAD

            Enter o espacio también
            abre/cierra los datos.
        */

        resultsList.addEventListener(
            "keydown",
            event => {
                if (
                    event.key !== "Enter" &&
                    event.key !== " "
                ) {
                    return;
                }

                const driverBlock =
                    event.target.closest(
                        ".results-full-driver-block.has-details"
                    );

                if (!driverBlock) {
                    return;
                }

                event.preventDefault();

                toggleDriverBlock(
                    driverBlock
                );
            }
        );
    }

    async function initResults() {
        if (resultsList) {
            resultsList.innerHTML = `
                <div class="results-page-loading">
                    CARGANDO RESULTADOS...
                </div>
            `;
        }

        await Promise.all(
            DIVISIONS.map(
                division =>
                    loadDivision(
                        division
                    )
            )
        );

        renderResults(
            activeDivision
        );
    }

    initResults();
});
