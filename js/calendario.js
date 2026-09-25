// ========================================
// HYPERDRIVE LEAGUE
// Calendario · Temporada 8
// ========================================

document.addEventListener("DOMContentLoaded", () => {


    // ========================================
    // ELEMENTOS
    // ========================================

    const calendarList =
        document.getElementById("calendar-list");


    if (!calendarList) {
        return;
    }


    // ========================================
    // CALENDARIO TEMPORADA 8
    // ========================================

    const calendar = [

        {
            round: 1,
            grandPrix: "CHINA",

            academy: {
                day: "MIÉRCOLES",
                date: "9 SEPTIEMBRE"
            },

            hyperdrive: {
                day: "JUEVES",
                date: "10 SEPTIEMBRE"
            },

            special: null,
            sprint: false
        },


        {
            round: 2,
            grandPrix: "BAKÚ",

            academy: {
                day: "MIÉRCOLES",
                date: "16 SEPTIEMBRE"
            },

            hyperdrive: {
                day: "JUEVES",
                date: "17 SEPTIEMBRE"
            },

            special: null,
            sprint: false
        },


        {
            round: 3,
            grandPrix: "IMOLA",

            academy: {
                day: "MIÉRCOLES",
                date: "23 SEPTIEMBRE"
            },

            hyperdrive: {
                day: "JUEVES",
                date: "24 SEPTIEMBRE"
            },

            special: null,
            sprint: false
        },


        {
            round: 4,
            grandPrix: "SILVERSTONE",

            academy: {
                day: "MIÉRCOLES",
                date: "30 SEPTIEMBRE"
            },

            hyperdrive: {
                day: "JUEVES",
                date: "1 OCTUBRE"
            },

            special: "SPRINT",
            sprint: true
        },


        {
            round: 5,
            grandPrix: "MADRID",

            academy: {
                day: "MIÉRCOLES",
                date: "7 OCTUBRE"
            },

            hyperdrive: {
                day: "JUEVES",
                date: "8 OCTUBRE"
            },

            special: "RULETA DE PARADAS",
            sprint: false
        },


        {
            round: 6,
            grandPrix: "HUNGRÍA",

            academy: {
                day: "MIÉRCOLES",
                date: "14 OCTUBRE"
            },

            hyperdrive: {
                day: "JUEVES",
                date: "15 OCTUBRE"
            },

            special: "F2",
            sprint: false
        },


        {
            round: 7,
            grandPrix: "SINGAPUR",

            academy: {
                day: "MIÉRCOLES",
                date: "28 OCTUBRE"
            },

            hyperdrive: {
                day: "JUEVES",
                date: "29 OCTUBRE"
            },

            special: "SUPERPOLE",
            sprint: false
        },


        {
            round: 8,
            grandPrix: "CANADÁ",

            academy: {
                day: "MIÉRCOLES",
                date: "4 NOVIEMBRE"
            },

            hyperdrive: {
                day: "JUEVES",
                date: "5 NOVIEMBRE"
            },

            special: "PENALTY CHALLENGE",
            sprint: false
        },


        {
            round: 9,
            grandPrix: "JAPÓN",

            academy: {
                day: "MIÉRCOLES",
                date: "11 NOVIEMBRE"
            },

            hyperdrive: {
                day: "JUEVES",
                date: "12 NOVIEMBRE"
            },

            special: "PARRILLA ALEATORIA",
            sprint: false
        },


        {
            round: 10,
            grandPrix: "BRASIL",

            academy: {
                day: "MIÉRCOLES",
                date: "18 NOVIEMBRE"
            },

            hyperdrive: {
                day: "JUEVES",
                date: "19 NOVIEMBRE"
            },

            special: "CLIMATOLOGÍA CAMBIANTE",
            sprint: false
        },


        {
            round: 11,
            grandPrix: "LAS VEGAS",

            academy: {
                day: "MIÉRCOLES",
                date: "25 NOVIEMBRE"
            },

            hyperdrive: {
                day: "JUEVES",
                date: "26 NOVIEMBRE"
            },

            special: "USO DE LOS 3 COMPUESTOS",
            sprint: false
        },


        {
            round: 12,
            grandPrix: "ABU DHABI",

            academy: {
                day: "MIÉRCOLES",
                date: "2 DICIEMBRE"
            },

            hyperdrive: {
                day: "JUEVES",
                date: "3 DICIEMBRE"
            },

            special: null,
            sprint: false
        }

    ];


    // ========================================
    // EVENTOS ESPECIALES
    // ========================================

    const marketEvent = {

        type:
            "market",

        label:
            "PARÓN · MITAD DE TEMPORADA",

        title:
            "MERCADO DE PILOTOS",

        date:
            "17 — 25 OCTUBRE",

        description:
            "Parón de una semana para celebrar el mercado de pilotos de mitad de temporada. Los equipos podrán reorganizar sus alineaciones antes de la segunda mitad del campeonato."

    };


    const texasEvent = {

        type:
            "texas",

        label:
            "EVENTO ESPECIAL · 100%",

        title:
            "GP TEXAS",

        date:
            "10 DICIEMBRE",

        description:
            "Cada equipo enviará a sus dos mejores pilotos para disputar una carrera al 100% de distancia.",

        note:
            "PUNTUACIÓN EXCLUSIVA PARA SUPERCONSTRUCTORES"

    };


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
    // NÚMERO DE RONDA
    // ========================================

    function formatRound(round) {

        return String(round)
            .padStart(
                2,
                "0"
            );

    }


    // ========================================
    // COMPROBAR ARCHIVO
    // ========================================

    async function fileExists(path) {

        try {

            const response =
                await fetch(
                    path,
                    {
                        method: "HEAD",
                        cache: "no-store"
                    }
                );


            if (response.ok) {
                return true;
            }


            /*
                Si el servidor no admite HEAD,
                probamos mediante GET.
            */

            if (
                response.status === 405 ||
                response.status === 501
            ) {

                const fallback =
                    await fetch(
                        path,
                        {
                            cache: "no-store"
                        }
                    );

                return fallback.ok;

            }


            return false;


        } catch (error) {

            return false;

        }

    }


    // ========================================
    // COMPROBAR RONDA
    // ========================================

    async function checkRound(round) {

        const [
            academy,
            hyperdrive
        ] =
            await Promise.all([

                fileExists(
                    `data/academy_r${round}.json`
                ),

                fileExists(
                    `data/hyperdrive_r${round}.json`
                )

            ]);


        return {

            academy:
                academy,

            hyperdrive:
                hyperdrive,

            completed:
                academy &&
                hyperdrive

        };

    }


    // ========================================
    // ESTADOS DE LAS RONDAS
    // ========================================

    async function getRoundStatuses() {

        const checks =
            await Promise.all(

                calendar.map(
                    item =>
                        checkRound(
                            item.round
                        )
                )

            );


        /*
            La primera ronda que todavía
            no tenga los dos resultados
            será la próxima ronda.
        */

        const nextIndex =
            checks.findIndex(
                round =>
                    !round.completed
            );


        return checks.map(
            (
                round,
                index
            ) => {

                if (
                    round.completed
                ) {

                    return {

                        ...round,

                        status:
                            "completed",

                        statusLabel:
                            "COMPLETADA"

                    };

                }


                if (
                    index ===
                    nextIndex
                ) {

                    return {

                        ...round,

                        status:
                            "next",

                        statusLabel:
                            "PRÓXIMA"

                    };

                }


                return {

                    ...round,

                    status:
                        "pending",

                    statusLabel:
                        "PENDIENTE"

                };

            }
        );

    }


    // ========================================
    // FORMATO ESPECIAL DE RONDA
    // ========================================

    function renderSpecial(round) {

        /*
            Sprint ya tiene su propio
            tratamiento visual.
        */

        if (
            !round.special ||
            round.sprint
        ) {

            return "";

        }


        return `
            <span class="calendar-sprint-badge">
                ${escapeHTML(round.special)}
            </span>
        `;

    }


    // ========================================
    // BOTÓN DE RONDA
    // ========================================

    function renderAction(status) {

        if (
            status ===
            "completed"
        ) {

            return `
                <a
                    href="resultados.html"
                    class="calendar-round-button"
                >
                    VER RESULTADOS
                </a>
            `;

        }


        if (
            status ===
            "next"
        ) {

            return `
                <span
                    class="
                        calendar-round-button
                        disabled
                    "
                >
                    PRÓXIMA RONDA
                </span>
            `;

        }


        return `
            <span
                class="
                    calendar-round-button
                    disabled
                "
            >
                PENDIENTE
            </span>
        `;

    }


    // ========================================
    // RENDERIZAR RONDA
    // ========================================

    function renderRound(
        round,
        status
    ) {

        const sprintClass =
            round.sprint
                ? " is-sprint"
                : "";


        return `
            <article
                class="
                    calendar-round
                    ${escapeHTML(status.status)}
                    ${sprintClass}
                "
            >


                <!-- RONDA -->

                <div class="calendar-round-number">

                    <span>
                        ROUND
                    </span>

                    <strong>
                        ${escapeHTML(
                            formatRound(
                                round.round
                            )
                        )}
                    </strong>

                </div>



                <!-- GP -->

                <div class="calendar-race-info">

                    <div class="calendar-race-topline">

                        <span class="calendar-race-country">
                            GRAN PREMIO
                        </span>

                        ${renderSpecial(round)}

                    </div>


                    <h3>
                        ${escapeHTML(round.grandPrix)}
                    </h3>


                    <p>
                        SEASON 8 · 2026
                    </p>


                    <span class="calendar-status">
                        ${escapeHTML(status.statusLabel)}
                    </span>

                </div>



                <!-- ACADEMY -->

                <div class="calendar-division">

                    <span class="calendar-division-label">
                        ACADEMY
                    </span>


                    <strong>
                        ${escapeHTML(
                            round.academy.day
                        )}
                    </strong>


                    <span class="calendar-division-date">
                        ${escapeHTML(
                            round.academy.date
                        )}
                    </span>


                    <span class="calendar-division-time">
                        22:00
                    </span>

                </div>



                <!-- HYPERDRIVE -->

                <div class="calendar-division">

                    <span class="calendar-division-label">
                        HYPERDRIVE
                    </span>


                    <strong>
                        ${escapeHTML(
                            round.hyperdrive.day
                        )}
                    </strong>


                    <span class="calendar-division-date">
                        ${escapeHTML(
                            round.hyperdrive.date
                        )}
                    </span>


                    <span class="calendar-division-time">
                        22:00
                    </span>

                </div>



                <!-- ACCIÓN -->

                <div class="calendar-round-action">

                    ${renderAction(
                        status.status
                    )}

                </div>


            </article>
        `;

    }


    // ========================================
    // EVENTO ESPECIAL
    // ========================================

    function renderSpecialEvent(event) {

        const isMarket =
            event.type ===
            "market";


        const icon =
            isMarket
                ? "MKT"
                : "100%";


        const note =
            event.note
                ? `
                    <span class="calendar-special-note">
                        ${escapeHTML(event.note)}
                    </span>
                `
                : "";


        return `
            <article
                class="
                    calendar-special-event
                    ${escapeHTML(event.type)}
                "
            >

                <div class="calendar-special-icon">
                    ${escapeHTML(icon)}
                </div>


                <div class="calendar-special-content">

                    <span class="calendar-special-label">
                        ${escapeHTML(event.label)}
                    </span>


                    <h3>
                        ${escapeHTML(event.title)}
                    </h3>


                    <p>
                        ${escapeHTML(event.description)}
                    </p>


                    ${note}

                </div>


                <div class="calendar-special-date">

                    <span>
                        FECHA
                    </span>


                    <strong>
                        ${escapeHTML(event.date)}
                    </strong>

                </div>

            </article>
        `;

    }


    // ========================================
    // CONSTRUIR CALENDARIO COMPLETO
    // ========================================

    function buildCalendarHTML(
        statuses
    ) {

        const blocks =
            [];


        calendar.forEach(
            (
                round,
                index
            ) => {

                /*
                    Añadimos la ronda normal.
                */

                blocks.push(
                    renderRound(
                        round,
                        statuses[index]
                    )
                );


                /*
                    Después de Hungría,
                    Round 6, insertamos el
                    mercado de mitad de temporada.
                */

                if (
                    round.round === 6
                ) {

                    blocks.push(
                        renderSpecialEvent(
                            marketEvent
                        )
                    );

                }


                /*
                    Después de Abu Dhabi,
                    Round 12, añadimos Texas.
                */

                if (
                    round.round === 12
                ) {

                    blocks.push(
                        renderSpecialEvent(
                            texasEvent
                        )
                    );

                }

            }
        );


        return blocks.join("");

    }


    // ========================================
    // RENDERIZAR CALENDARIO
    // ========================================

    async function renderCalendar() {

        calendarList.innerHTML = `
            <div class="calendar-loading">
                CARGANDO CALENDARIO...
            </div>
        `;


        try {

            const statuses =
                await getRoundStatuses();


            calendarList.innerHTML =
                buildCalendarHTML(
                    statuses
                );


        } catch (error) {

            console.error(
                error
            );


            calendarList.innerHTML = `
                <div class="calendar-loading">
                    ERROR AL CARGAR EL CALENDARIO
                </div>
            `;

        }

    }


    // ========================================
    // INICIAR
    // ========================================

    renderCalendar();


});
