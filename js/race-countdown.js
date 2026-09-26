// ========================================
// HYPERDRIVE LEAGUE
// Próxima carrera + cuenta atrás
// Archivo aislado
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // CALENDARIO TEMPORADA 8
    // ========================================

    const schedule = [

        {
            round: 1,
            gp: "CHINA",
            format: "GRAN PREMIO",
            academy: "2026-09-09T22:00:00+02:00",
            hyperdrive: "2026-09-10T22:00:00+02:00"
        },

        {
            round: 2,
            gp: "BAKÚ",
            format: "GRAN PREMIO",
            academy: "2026-09-16T22:00:00+02:00",
            hyperdrive: "2026-09-17T22:00:00+02:00"
        },

        {
            round: 3,
            gp: "IMOLA",
            format: "GRAN PREMIO",
            academy: "2026-09-23T22:00:00+02:00",
            hyperdrive: "2026-09-24T22:00:00+02:00"
        },

        {
            round: 4,
            gp: "SILVERSTONE",
            format: "SPRINT",
            academy: "2026-09-30T22:00:00+02:00",
            hyperdrive: "2026-10-01T22:00:00+02:00"
        },

        {
            round: 5,
            gp: "MADRID",
            format: "RULETA DE PARADAS",
            academy: "2026-10-07T22:00:00+02:00",
            hyperdrive: "2026-10-08T22:00:00+02:00"
        },

        {
            round: 6,
            gp: "HUNGRÍA",
            format: "F2",
            academy: "2026-10-14T22:00:00+02:00",
            hyperdrive: "2026-10-15T22:00:00+02:00"
        },

        {
            round: 7,
            gp: "SINGAPUR",
            format: "SUPERPOLE",
            academy: "2026-10-28T22:00:00+01:00",
            hyperdrive: "2026-10-29T22:00:00+01:00"
        },

        {
            round: 8,
            gp: "CANADÁ",
            format: "PENALTY CHALLENGE",
            academy: "2026-11-04T22:00:00+01:00",
            hyperdrive: "2026-11-05T22:00:00+01:00"
        },

        {
            round: 9,
            gp: "JAPÓN",
            format: "PARRILLA ALEATORIA",
            academy: "2026-11-11T22:00:00+01:00",
            hyperdrive: "2026-11-12T22:00:00+01:00"
        },

        {
            round: 10,
            gp: "BRASIL",
            format: "CLIMATOLOGÍA CAMBIANTE",
            academy: "2026-11-18T22:00:00+01:00",
            hyperdrive: "2026-11-19T22:00:00+01:00"
        },

        {
            round: 11,
            gp: "LAS VEGAS",
            format: "USO DE LOS 3 COMPUESTOS",
            academy: "2026-11-25T22:00:00+01:00",
            hyperdrive: "2026-11-26T22:00:00+01:00"
        },

        {
            round: 12,
            gp: "ABU DHABI",
            format: "GRAN PREMIO",
            academy: "2026-12-02T22:00:00+01:00",
            hyperdrive: "2026-12-03T22:00:00+01:00"
        },

        {
            round: "POST",
            gp: "TEXAS 100%",
            format: "SUPERCONSTRUCTORES",
            special: "2026-12-10T22:00:00+01:00"
        }

    ];


    // ========================================
    // ELEMENTOS
    // ========================================

    const heroRound =
        document.getElementById("hero-next-round");

    const heroDivision =
        document.getElementById("hero-next-division");

    const heroCountdown =
        document.getElementById("hero-next-countdown");


    const sectionTitle =
        document.getElementById("next-race-title");

    const sectionDate =
        document.getElementById("next-race-date");

    const sectionRound =
        document.getElementById("next-race-round");

    const sectionGp =
        document.getElementById("next-race-gp");

    const sectionFormat =
        document.getElementById("next-race-format");

    const sectionDivision =
        document.getElementById("next-race-division");

    const sectionCountdown =
        document.getElementById("next-race-countdown");


    // ========================================
    // CREAR SESIONES
    // ========================================

    function buildSessions() {

        const sessions = [];

        schedule.forEach(event => {

            if (event.academy) {

                sessions.push({
                    round: event.round,
                    gp: event.gp,
                    format: event.format,
                    division: "ACADEMY",
                    date: new Date(event.academy)
                });

            }

            if (event.hyperdrive) {

                sessions.push({
                    round: event.round,
                    gp: event.gp,
                    format: event.format,
                    division: "HYPERDRIVE",
                    date: new Date(event.hyperdrive)
                });

            }

            if (event.special) {

                sessions.push({
                    round: event.round,
                    gp: event.gp,
                    format: event.format,
                    division: "EVENTO ESPECIAL",
                    date: new Date(event.special)
                });

            }

        });

        return sessions.sort(
            (a, b) =>
                a.date.getTime() -
                b.date.getTime()
        );

    }


    const sessions =
        buildSessions();


    // ========================================
    // PRÓXIMA SESIÓN
    // ========================================

    function getNextSession() {

        const now =
            Date.now();

        return sessions.find(
            session =>
                session.date.getTime() > now
        ) || null;

    }


    // ========================================
    // FORMATO FECHA
    // ========================================

    function formatDate(date) {

        const formatter =
            new Intl.DateTimeFormat(
                "es-ES",
                {
                    timeZone: "Europe/Madrid",
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );

        return formatter
            .format(date)
            .replace(",", " ·")
            .toUpperCase();

    }


    // ========================================
    // CONTADOR
    // ========================================

    function pad(value) {

        return String(value)
            .padStart(2, "0");

    }


    function getCountdown(targetDate) {

        const difference =
            Math.max(
                0,
                targetDate.getTime() -
                Date.now()
            );

        const totalSeconds =
            Math.floor(
                difference / 1000
            );

        return {

            days:
                Math.floor(
                    totalSeconds / 86400
                ),

            hours:
                Math.floor(
                    (totalSeconds % 86400) / 3600
                ),

            minutes:
                Math.floor(
                    (totalSeconds % 3600) / 60
                ),

            seconds:
                totalSeconds % 60

        };

    }


    function countdownHTML(date) {

        const time =
            getCountdown(date);

        return `
            <div class="countdown-box">
                <span class="countdown-number">
                    ${pad(time.days)}
                </span>

                <span class="countdown-text">
                    DÍAS
                </span>
            </div>

            <div class="countdown-box">
                <span class="countdown-number">
                    ${pad(time.hours)}
                </span>

                <span class="countdown-text">
                    HORAS
                </span>
            </div>

            <div class="countdown-box">
                <span class="countdown-number">
                    ${pad(time.minutes)}
                </span>

                <span class="countdown-text">
                    MIN
                </span>
            </div>

            <div class="countdown-box">
                <span class="countdown-number">
                    ${pad(time.seconds)}
                </span>

                <span class="countdown-text">
                    SEG
                </span>
            </div>
        `;

    }


    // ========================================
    // TEXTO DE RONDA
    // ========================================

    function roundLabel(round) {

        if (
            typeof round ===
            "number"
        ) {

            return `R${round}`;

        }

        return "POST-SEASON";

    }


    // ========================================
    // RENDER
    // ========================================

    function render() {

        const session =
            getNextSession();

        if (!session) {

            if (heroRound) {
                heroRound.textContent =
                    "TEMPORADA FINALIZADA";
            }

            if (heroDivision) {
                heroDivision.textContent =
                    "SEASON 8";
            }

            if (heroCountdown) {
                heroCountdown.innerHTML = "";
            }

            if (sectionTitle) {
                sectionTitle.textContent =
                    "TEMPORADA FINALIZADA";
            }

            if (sectionDate) {
                sectionDate.textContent =
                    "";
            }

            if (sectionRound) {
                sectionRound.textContent =
                    "--";
            }

            if (sectionGp) {
                sectionGp.textContent =
                    "SIN EVENTOS";
            }

            if (sectionFormat) {
                sectionFormat.textContent =
                    "";
            }

            if (sectionDivision) {
                sectionDivision.textContent =
                    "";
            }

            if (sectionCountdown) {
                sectionCountdown.innerHTML =
                    "";
            }

            return;

        }


        const round =
            roundLabel(
                session.round
            );


        // HERO

        if (heroRound) {

            heroRound.textContent =
                `${round} · GP ${session.gp}`;

        }

        if (heroDivision) {

            heroDivision.textContent =
                `${session.division} · ${formatDate(session.date)}`;

        }

        if (heroCountdown) {

            heroCountdown.innerHTML =
                countdownHTML(
                    session.date
                );

        }


        // SECCIÓN GRANDE

        if (sectionTitle) {

            sectionTitle.textContent =
                `${round} · GP ${session.gp}`;

        }

        if (sectionDate) {

            sectionDate.textContent =
                `${formatDate(session.date)} · SEASON 8`;

        }

        if (sectionRound) {

            sectionRound.textContent =
                typeof session.round === "number"
                    ? String(session.round)
                        .padStart(2, "0")
                    : "POST";

        }

        if (sectionGp) {

            sectionGp.textContent =
                session.gp;

        }

        if (sectionFormat) {

            sectionFormat.textContent =
                session.format;

        }

        if (sectionDivision) {

            sectionDivision.textContent =
                session.division;

        }

        if (sectionCountdown) {

            sectionCountdown.innerHTML =
                countdownHTML(
                    session.date
                );

        }

    }


    // ========================================
    // INICIO
    // ========================================

    render();

    setInterval(
        render,
        1000
    );

});
