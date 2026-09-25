// ========================================
// HYPERDRIVE LEAGUE
// JavaScript principal
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    const standingsList = document.getElementById("standings-list");
    const standingsTabs = document.querySelectorAll(".standings-tab");

    let hyperdriveStandings = [];


    // Evita que nombres o textos del JSON puedan interpretarse como HTML
    function escapeHTML(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    }


    // Dibuja la clasificación en pantalla
    function renderStandings(division) {

        if (!standingsList) {
            return;
        }


        // Academy la conectaremos después con su propio JSON
        if (division === "academy") {

            standingsList.innerHTML = `
                <div class="standings-loading">
                    CLASIFICACIÓN ACADEMY PENDIENTE DE CONECTAR
                </div>
            `;

            return;
        }


        const topDrivers = hyperdriveStandings.slice(0, 5);


        if (topDrivers.length === 0) {

            standingsList.innerHTML = `
                <div class="standings-loading">
                    NO HAY DATOS DE CLASIFICACIÓN
                </div>
            `;

            return;
        }


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


    // Carga el JSON exportado desde Racing League Tools
    async function loadHyperDriveStandings() {

        try {

            const response = await fetch(
                "data/hyperdrive-standings.json",
                {
                    cache: "no-store"
                }
            );


            if (!response.ok) {
                throw new Error(
                    `Error al cargar clasificación: ${response.status}`
                );
            }


            const data = await response.json();

            const drivers =
                data?.seasonStatistics?.driverStandings;


            if (!Array.isArray(drivers)) {
                throw new Error(
                    "El archivo JSON no contiene driverStandings."
                );
            }


            hyperdriveStandings = drivers;

            renderStandings("hyperdrive");


        } catch (error) {

            console.error(error);

            if (standingsList) {

                standingsList.innerHTML = `
                    <div class="standings-loading">
                        ERROR AL CARGAR LA CLASIFICACIÓN
                    </div>
                `;

            }

        }

    }


    // Cambiar entre HyperDrive y Academy
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


    loadHyperDriveStandings();

});
