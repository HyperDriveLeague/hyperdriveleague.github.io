// ========================================
// HYPERDRIVE LEAGUE
// JavaScript principal
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    const standingsList = document.getElementById("standings-list");
    const standingsTabs = document.querySelectorAll(".standings-tab");

    const standingsData = {
        hyperdrive: [],
        academy: []
    };

    let activeDivision = "hyperdrive";


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
    // MOSTRAR CLASIFICACIÓN
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

            return `
                <div class="standings-row">

                    <span class="standings-position">
                        ${escapeHTML(driver.position)}
                    </span>

                    <span class="standings-driver">
                        ${escapeHTML(driver.driverName)}
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
    // CARGAR JSON DE RACING LEAGUE TOOLS
    // ========================================

    async function loadStandingsFile(division, file) {

        try {

            const response = await fetch(
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


        } catch (error) {

            console.error(error);


            if (activeDivision === division && standingsList) {

                standingsList.innerHTML = `
                    <div class="standings-loading">
                        ERROR AL CARGAR LA CLASIFICACIÓN
                    </div>
                `;

            }

        }

    }


    // ========================================
    // PESTAÑAS HYPERDRIVE / ACADEMY
    // ========================================

    standingsTabs.forEach(tab => {

        tab.addEventListener("click", () => {

            standingsTabs.forEach(button => {
                button.classList.remove("active");
            });


            tab.classList.add("active");


            const division = tab.dataset.division;


            renderStandings(division);

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
