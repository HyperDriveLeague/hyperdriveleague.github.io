// ========================================
// HYPERDRIVE LEAGUE
// Página Resultados
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
    // CLAVE NORMALIZADA
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


    function getInitial(driverName) {

        const name =
            String(driverName ?? "")
                .trim();

        if (!name) {
            return "?";
        }

        return name
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(0, 2)
            .toUpperCase();

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
    // CLIMA
    // ========================================

    function formatWeather(weather) {

        const value =
            String(weather ?? "")
                .trim()
                .toLowerCase();


        const weatherNames = {

            clear: "DESPEJADO",

            lightcloud: "NUBES LIGERAS",

            overcast: "NUBLADO",

            lightrain: "LLUVIA LIGERA",

            heavyrain: "LLUVIA INTENSA",

            storm: "TORMENTA",

            rain: "LLUVIA"

        };


        return weatherNames[value] ||
            String(weather ?? "—")
                .toUpperCase();

    }


    // ========================================
    // NEUMÁTICOS
    // ========================================

    function formatTyre(compound) {

        const value =
            String(compound ?? "")
                .trim()
                .toLowerCase();


        const tyres = {

            soft: "BLANDO",

            medium: "MEDIO",

            hard: "DURO",

            intermediate: "INTERMEDIO",

            wet: "LLUVIA"

        };


        return tyres[value] ||
            String(compound ?? "—")
                .toUpperCase();

    }


    // ========================================
    // ESTADO
    // ========================================

    function getStatusCode(status) {

        const value =
            String(status ?? "")
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

        const code =
            getStatusCode(status);


        if (code) {
            return code;
        }


        const value =
            String(status ?? "")
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


    // ========================================
    // POSICIONES
    // ========================================

    function validPosition(value) {

        const number =
            Number(value);


        if (
            !Number.isFinite(number) ||
            number < 1
        ) {
            return null;
        }


        return number;

    }


    function formatFinalPosition(result) {

        const position =
            validPosition(result.position);


        if (position) {
            return `P${position}`;
        }


        const status =
            getStatusCode(result.status);


        return status || "—";

    }


    function formatGridPosition(value) {

        const position =
            validPosition(value);


        return position
            ? `P${position}`
            : "—";

    }


    function formatPositionChange(value) {

        const number =
            Number(value);


        if (!Number.isFinite(number)) {
            return "—";
        }


        if (number > 0) {
            return `+${number}`;
        }


        return String(number);

    }


    function getPositionChangeClass(value) {

        const number =
            Number(value);


        if (!Number.isFinite(number) || number === 0) {
            return "results-change-neutral";
        }


        if (number > 0) {
            return "results-change-positive";
        }


        return "results-change-negative";

    }


    // ========================================
    // CARRERA PRINCIPAL
    // ========================================

    function getMainRace(event) {

        const races =
            Array.isArray(event?.races)
                ? event.races
                : [];


        if (races.length === 0) {
            return null;
        }


        const exactRace =
            races.find(race => {

                const sessionName =
                    String(
                        race?.sessionName ?? ""
                    )
                        .trim()
                        .toLowerCase();


                return sessionName === "race";

            });


        if (exactRace) {
            return exactRace;
        }


        const nonSprint =
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


        return nonSprint || races[0];

    }


    // ========================================
    // CLAVE EVENTO
    // ========================================

    function getEventKey(event) {

        const date =
            String(
                event?.eventDate ?? ""
            )
                .slice(0, 10);


        const name =
            normalizeKey(
                event?.eventName ||
                event?.trackName ||
                ""
            );


        return `${date}|${name}`;

    }


    // ========================================
    // ORDEN RESULTADOS
    // ========================================

    function resultSort(a, b) {

        const positionA =
            validPosition(a.position);

        const positionB =
            validPosition(b.position);


        if (
            positionA !== null &&
            positionB !== null
        ) {

            return positionA -
                positionB;

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
            statusOrder[
                getStatusCode(a.status)
            ] ?? 9;


        const statusB =
            statusOrder[
                getStatusCode(b.status)
            ] ?? 9;


        return statusA - statusB;

    }


    // ========================================
    // CONSTRUIR RONDAS DESDE SEASON STATS
    // ========================================

    function buildRoundsFromSeason(data) {

        const drivers =
            data?.seasonStatistics
                ?.driverStandings;


        if (!Array.isArray(drivers)) {
            return [];
        }


        const roundsMap =
            new Map();


        drivers.forEach(driver => {

            const events =
                Array.isArray(driver.events)
                    ? driver.events
                    : [];


            events.forEach(event => {

                const race =
                    getMainRace(event);


                if (!race) {
                    return;
                }


                const key =
                    getEventKey(event);


                if (
                    !key ||
                    key === "|"
                ) {
                    return;
                }


                if (!roundsMap.has(key)) {

                    roundsMap.set(
                        key,
                        {

                            sourceRoundNumber:
                                Number(
                                    event.roundNumber
                                ) || 0,

                            roundNumber:
                                0,

                            eventName:
                                event.eventName ||
                                event.trackName ||
                                "Gran Premio",

                            trackName:
                                event.trackName ||
                                event.eventName ||
                                "",

                            eventDate:
                                event.eventDate ||
                                "",

                            results: [],

                            sessionAvailable:
                                false,

                            sessionSummary:
                                null

                        }
                    );

                }


                const round =
                    roundsMap.get(key);


                round.results.push({

                    driverName:
                        driver.driverName ||
                        "Piloto",

                    raceNumber:
                        driver?.driverInfo
                            ?.raceNumber ||
                        "",

                    teamName:
                        driver.teamName ||
                        "Sin equipo",

                    position:
                        validPosition(
                            race.position
                        ),

                    gridPosition:
                        validPosition(
                            race.gridPosition
                        ),

                    positionChange:
                        Number.isFinite(
                            Number(
                                race.positionChange
                            )
                        )
                            ? Number(
                                race.positionChange
                            )
                            : null,

                    points:
                        race.pointsEarned ??
                        event.pointsEarned ??
                        "0",

                    status:
                        race.status ||
                        "Ok",

                    isFinished:
                        race.isFinished ??
                        true,

                    isFastestLap:
                        Boolean(
                            race.isFastestLap
                        ),

                    lapsCompleted:
                        null,

                    totalTime:
                        null,

                    gap:
                        null,

                    interval:
                        null,

                    fastestLapTime:
                        null,

                    fastestLapNumber:
                        null,

                    fastestLapTyreCompound:
                        null,

                    maxSpeed:
                        null,

                    penalties:
                        null,

                    paceRating:
                        null,

                    consistencyRating:
                        null,

                    stints: []

                });

            });

        });


        const rounds =
            Array.from(
                roundsMap.values()
            );


        rounds.sort((a, b) => {

            const dateA =
                new Date(a.eventDate)
                    .getTime();

            const dateB =
                new Date(b.eventDate)
                    .getTime();


            if (
                Number.isFinite(dateA) &&
                Number.isFinite(dateB) &&
                dateA !== dateB
            ) {

                return dateA -
                    dateB;

            }


            return (
                a.sourceRoundNumber -
                b.sourceRoundNumber
            );

        });


        rounds.forEach(
            (round, index) => {

                round.roundNumber =
                    index + 1;


                const uniqueDrivers =
                    new Map();


                round.results
                    .forEach(result => {

                        const key =
                            normalizeKey(
                                result.driverName
                            );


                        if (!key) {
                            return;
                        }


                        const existing =
                            uniqueDrivers
                                .get(key);


                        if (!existing) {

                            uniqueDrivers.set(
                                key,
                                result
                            );

                            return;

                        }


                        const newPosition =
                            validPosition(
                                result.position
                            );


                        const oldPosition =
                            validPosition(
                                existing.position
                            );


                        if (
                            newPosition !== null &&
                            (
                                oldPosition === null ||
                                newPosition <
                                    oldPosition
                            )
                        ) {

                            uniqueDrivers.set(
                                key,
                                result
                            );

                        }

                    });


                round.results =
                    Array.from(
                        uniqueDrivers.values()
                    )
                        .sort(
                            resultSort
                        );

            }
        );


        return rounds
            .sort(
                (a, b) =>
                    b.roundNumber -
                    a.roundNumber
            );

    }


    // ========================================
    // PENALIZACIONES
    // ========================================

    function getPenaltyText(penalties) {

        if (!penalties) {
            return "0 s";
        }


        const seconds =
            Number(
                penalties
                    .inGamePenaltySeconds ??
                0
            ) +
            Number(
                penalties
                    .stewardPenaltySeconds ??
                0
            );


        const positions =
            Number(
                penalties
                    .inGamePenaltyPositions ??
                0
            ) +
            Number(
                penalties
                    .stewardPenaltyPositions ??
                0
            );


        if (seconds > 0) {

            return `${seconds} s`;

        }


        if (positions > 0) {

            return `${positions} pos.`;

        }


        return "0 s";

    }


    // ========================================
    // ESTRATEGIA
    // ========================================

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


    // ========================================
    // UNIR SESSION CON UNA RONDA
    // ========================================

    function mergeSessionIntoRound(
        round,
        sessionData
    ) {

        const session =
            sessionData?.session;


        const sessionDrivers =
            session?.drivers;


        if (
            !session ||
            !Array.isArray(sessionDrivers)
        ) {
            return;
        }


        const sessionInfo =
            session.sessionInfo ||
            {};


        const fastestLap =
            session.fastestLap ||
            null;


        round.sessionAvailable =
            true;


        round.eventName =
            sessionData?.event
                ?.track
                ?.trackName ||
            round.eventName;


        round.trackName =
            sessionData?.event
                ?.track
                ?.trackName ||
            round.trackName;


        round.eventDate =
            sessionData?.event
                ?.eventDate ||
            round.eventDate;


        round.sessionSummary = {

            totalLaps:
                sessionInfo.totalLaps ??
                null,

            driversCount:
                sessionInfo.driversCount ??
                sessionDrivers.length,

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

        };


        const oldResults =
            new Map();


        round.results
            .forEach(result => {

                oldResults.set(
                    normalizeKey(
                        result.driverName
                    ),
                    result
                );

            });


        const sessionResults =
            [];


        const sessionDriverKeys =
            new Set();


        sessionDrivers
            .forEach(driver => {

                const driverKey =
                    normalizeKey(
                        driver.driverName
                    );


                sessionDriverKeys
                    .add(driverKey);


                const fallback =
                    oldResults.get(
                        driverKey
                    ) || {};


                const classificationPosition =
                    validPosition(
                        driver
                            .classificationPosition
                    );


                const normalPosition =
                    validPosition(
                        driver.position
                    );


                const position =
                    classificationPosition ??
                    normalPosition ??
                    fallback.position ??
                    null;


                const fastestDriver =
                    normalizeKey(
                        fastestLap
                            ?.driverName
                    );


                const isFastestLap =
                    Boolean(
                        fastestDriver &&
                        fastestDriver ===
                            driverKey
                    );


                sessionResults.push({

                    driverName:
                        driver.driverName ||
                        fallback.driverName ||
                        "Piloto",

                    raceNumber:
                        driver?.driverInfo
                            ?.raceNumber ||
                        fallback.raceNumber ||
                        "",

                    teamName:
                        driver?.team?.name ||
                        fallback.teamName ||
                        "Sin equipo",

                    position:
                        position,

                    gridPosition:
                        validPosition(
                            driver.gridPosition
                        ) ??
                        fallback.gridPosition ??
                        null,

                    positionChange:
                        Number.isFinite(
                            Number(
                                driver
                                    .positionChange
                            )
                        )
                            ? Number(
                                driver
                                    .positionChange
                            )
                            : fallback
                                .positionChange ??
                              null,

                    points:
                        driver.driverPoints ??
                        fallback.points ??
                        "0",

                    status:
                        driver.status ||
                        fallback.status ||
                        "Finished",

                    isFinished:
                        String(
                            driver.status ?? ""
                        )
                            .toLowerCase() ===
                            "finished",

                    isFastestLap:
                        isFastestLap,

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
                        driver
                            .fastestLapTime ||
                        null,

                    fastestLapNumber:
                        driver
                            .fastestLapNumber ??
                        null,

                    fastestLapTyreCompound:
                        driver
                            .fastestLapTyreCompound ||
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

                });

            });


        round.results
            .forEach(result => {

                const key =
                    normalizeKey(
                        result.driverName
                    );


                if (
                    !sessionDriverKeys.has(
                        key
                    )
                ) {

                    sessionResults.push(
                        result
                    );

                }

            });


        round.results =
            sessionResults.sort(
                resultSort
            );

    }


    // ========================================
    // CARGAR SESSION OPCIONAL
    // ========================================

    async function loadOptionalSession(
        division,
        round
    ) {

        const path =
            `data/${division}-r${round.roundNumber}-race.json`;


        try {

            const response =
                await fetch(
                    path,
                    {
                        cache: "no-store"
                    }
                );


            /*
                Si no existe el Session,
                usamos SeasonStatistics sin
                mostrar error.
            */

            if (!response.ok) {
                return false;
            }


            const data =
                await response.json();


            if (
                data?.metadata
                    ?.exportType !==
                "Session"
            ) {

                return false;
            }


            mergeSessionIntoRound(
                round,
                data
            );


            return true;


        } catch (error) {

            return false;

        }

    }


    // ========================================
    // PODIO
    // ========================================

    function renderPodium(round) {

        const podium =
            round.results
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


        if (podium.length === 0) {

            return `
                <div class="results-page-loading">
                    NO HAY RESULTADOS DISPONIBLES
                </div>
            `;

        }


        return `
            <div class="results-podium-grid">

                ${podium.map(result => {

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


                    const fastest =
                        result.isFastestLap
                            ? `
                                <span class="results-podium-fastest">
                                    VUELTA RÁPIDA
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

                                <strong>
                                    ${escapeHTML(result.driverName)}
                                </strong>

                                <span>
                                    ${escapeHTML(result.teamName)}
                                </span>


                                <div class="results-podium-bottom">

                                    <span class="results-podium-points">
                                        ${escapeHTML(result.points)} PTS
                                    </span>

                                    ${fastest}

                                </div>

                            </div>

                        </article>
                    `;

                }).join("")}

            </div>
        `;

    }


    // ========================================
    // RESUMEN SESIÓN
    // ========================================

    function renderSessionSummary(round) {

        if (
            !round.sessionAvailable ||
            !round.sessionSummary
        ) {

            return "";

        }


        const summary =
            round.sessionSummary;


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
                        ${escapeHTML(summary.totalLaps ?? "—")}
                    </strong>

                </div>


                <div class="results-summary-item">

                    <span>
                        PILOTOS
                    </span>

                    <strong>
                        ${escapeHTML(summary.driversCount ?? "—")}
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
                        ${escapeHTML(temperatureText)}
                    </strong>

                </div>


                <div class="results-summary-item highlight">

                    <span>
                        VUELTA RÁPIDA
                    </span>

                    <strong>
                        ${escapeHTML(fastestText)}
                    </strong>

                </div>


                <div class="results-summary-item">

                    <span>
                        SAFETY CAR
                    </span>

                    <strong>
                        ${escapeHTML(summary.safetyCarCount ?? 0)} SC
                        ·
                        ${escapeHTML(summary.virtualSafetyCarCount ?? 0)} VSC
                    </strong>

                </div>


            </div>
        `;

    }


    // ========================================
    // TIEMPO / GAP
    // ========================================

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


        if (result.totalTime) {
            return result.totalTime;
        }


        const status =
            getStatusCode(
                result.status
            );


        return status || "—";

    }


    // ========================================
    // DETALLES DISPONIBLES
    // ========================================

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

            result.penalties

        );

    }


    // ========================================
    // DETALLES PILOTO
    // ========================================

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
                            ${escapeHTML(lapsText)}
                        </strong>

                    </div>


                    <div class="results-driver-stat">

                        <span>
                            VUELTA RÁPIDA
                        </span>

                        <strong>
                            ${escapeHTML(fastestLapText)}
                        </strong>

                    </div>


                    <div class="results-driver-stat">

                        <span>
                            NEUMÁTICO VR
                        </span>

                        <strong>
                            ${escapeHTML(tyreText)}
                        </strong>

                    </div>


                    <div class="results-driver-stat">

                        <span>
                            VELOCIDAD MÁX.
                        </span>

                        <strong>
                            ${escapeHTML(maxSpeedText)}
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
                            ${escapeHTML(paceText)}
                        </strong>

                    </div>


                    <div class="results-driver-stat">

                        <span>
                            CONSISTENCIA
                        </span>

                        <strong>
                            ${escapeHTML(consistencyText)}
                        </strong>

                    </div>


                    <div class="results-driver-stat strategy">

                        <span>
                            ESTRATEGIA
                        </span>

                        <strong>
                            ${escapeHTML(strategy)}
                        </strong>

                    </div>


                </div>

            </div>
        `;

    }


    // ========================================
    // TABLA COMPLETA
    // ========================================

    function renderFullTable(round) {

        const rows =
            round.results
                .map((result, index) => {

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


                    if (positionStatus === "DNF") {
                        positionClass =
                            " results-status-dnf";
                    }


                    if (positionStatus === "DSQ") {
                        positionClass =
                            " results-status-dsq";
                    }


                    if (positionStatus === "DNS") {
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


                    const fastestClass =
                        result.isFastestLap
                            ? " results-fastest-lap"
                            : "";


                    const hasDetails =
                        hasDriverDetails(
                            result
                        );


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


                    return `
                        <div class="results-full-driver-block">


                            <div class="results-full-row">


                                <span class="results-full-position${positionClass}">
                                    ${escapeHTML(finalPosition)}
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

                                        <strong>
                                            ${escapeHTML(result.driverName)}
                                        </strong>

                                        <small>
                                            ${result.raceNumber
                                                ? `#${escapeHTML(result.raceNumber)} · `
                                                : ""
                                            }
                                            ${escapeHTML(formatStatus(result.status))}
                                        </small>

                                    </div>

                                </div>


                                <span class="results-full-team">
                                    ${escapeHTML(result.teamName)}
                                </span>


                                <span class="results-full-center">
                                    ${escapeHTML(
                                        formatGridPosition(
                                            result.gridPosition
                                        )
                                    )}
                                </span>


                                <span class="results-full-center ${changeClass}">
                                    ${escapeHTML(change)}
                                </span>


                                <span class="results-full-center">
                                    ${escapeHTML(time)}
                                </span>


                                <span class="results-full-center${fastestClass}">
                                    ${escapeHTML(fastestLap)}
                                </span>


                                <span class="results-full-center results-points">
                                    ${escapeHTML(result.points)}
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
                        CLASIFICACIÓN COMPLETA
                    </h3>

                    <span>
                        ${escapeHTML(round.results.length)}
                        PILOTOS
                    </span>

                </div>


                <div class="results-full-table-scroll">

                    <div class="results-full-table">


                        <div class="results-full-header">

                            <span>POS</span>

                            <span>PILOTO</span>

                            <span>EQUIPO</span>

                            <span>SALIDA</span>

                            <span>+/-</span>

                            <span>TIEMPO / GAP</span>

                            <span>V. RÁPIDA</span>

                            <span>PTS</span>

                            <span>DATOS</span>

                        </div>


                        <div>
                            ${rows}
                        </div>


                    </div>

                </div>


            </div>
        `;

    }


    // ========================================
    // TARJETA RONDA
    // ========================================

    function renderRound(round) {

        const gpName =
            formatGrandPrixName(
                round.eventName
            );


        const date =
            formatDate(
                round.eventDate
            );


        const tag =
            round.sessionAvailable
                ? "DATOS COMPLETOS"
                : "COMPLETADA";


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


                ${renderPodium(round)}


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

                    ${renderSessionSummary(round)}

                    ${renderFullTable(round)}

                </div>


            </article>
        `;

    }


    // ========================================
    // MOSTRAR RESULTADOS
    // ========================================

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
                    CARGANDO RESULTADOS...
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


    // ========================================
    // CARGAR DIVISIÓN
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


            const rounds =
                buildRoundsFromSeason(
                    data
                );


            resultsData[
                division
            ] = rounds;


            /*
                Primero mostramos la información
                que ya tenemos en SeasonStatistics.
            */

            if (
                activeDivision ===
                division
            ) {

                renderResults(
                    division
                );

            }


            /*
                Después buscamos automáticamente
                un archivo Session para cada ronda:

                data/hyperdrive-r3-race.json
                data/academy-r3-race.json
                etc.
            */

            await Promise.all(

                rounds.map(
                    round =>
                        loadOptionalSession(
                            division,
                            round
                        )
                )

            );


            /*
                Si alguno existe,
                actualizamos la página con
                todos los datos avanzados.
            */

            if (
                activeDivision ===
                division
            ) {

                renderResults(
                    division
                );

            }


        } catch (error) {

            console.error(error);


            if (
                resultsList &&
                activeDivision ===
                    division
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
    // CAMBIO HYPERDRIVE / ACADEMY
    // ========================================

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


                    tab.classList
                        .add(
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


    // ========================================
    // DESPLEGABLES
    // ========================================

    if (resultsList) {

        resultsList.addEventListener(
            "click",
            event => {


                // ================================
                // ABRIR RONDA
                // ================================

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


                    roundButton
                        .setAttribute(
                            "aria-expanded",
                            String(!isOpen)
                        );


                    details.hidden =
                        isOpen;


                    card
                        .classList
                        .toggle(
                            "round-open",
                            !isOpen
                        );


                    const text =
                        roundButton
                            .querySelector(
                                "span:first-child"
                            );


                    const arrow =
                        roundButton
                            .querySelector(
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


                // ================================
                // ABRIR DATOS PILOTO
                // ================================

                const driverButton =
                    event.target.closest(
                        ".results-driver-toggle"
                    );


                if (driverButton) {

                    const block =
                        driverButton.closest(
                            ".results-full-driver-block"
                        );


                    const extra =
                        block?.querySelector(
                            ".results-driver-extra"
                        );


                    if (!extra) {
                        return;
                    }


                    const isOpen =
                        driverButton
                            .getAttribute(
                                "aria-expanded"
                            ) === "true";


                    driverButton
                        .setAttribute(
                            "aria-expanded",
                            String(!isOpen)
                        );


                    extra.hidden =
                        isOpen;


                    driverButton
                        .textContent =
                            isOpen
                                ? "DATOS"
                                : "CERRAR";

                }

            }
        );

    }


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
