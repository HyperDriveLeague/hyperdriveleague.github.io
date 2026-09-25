// ========================================
// HYPERDRIVE LEAGUE
// Página general de noticias
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    const newsPageGrid =
        document.getElementById("news-page-grid");


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
    // CREAR SLUG
    // ========================================

    function createSlug(article) {

        const raw =
            `${article.date || ""}-${article.title || ""}`;

        return raw
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

    }


    // ========================================
    // FORMATEAR FECHA
    // ========================================

    function formatDate(value) {

        if (!value) {
            return "";
        }


        const parts =
            String(value).split("-");


        if (parts.length !== 3) {
            return value;
        }


        const year =
            Number(parts[0]);

        const month =
            Number(parts[1]) - 1;

        const day =
            Number(parts[2]);


        const articleDate =
            new Date(year, month, day);


        return articleDate.toLocaleDateString(
            "es-ES",
            {
                day: "numeric",
                month: "short",
                year: "numeric"
            }
        );

    }


    // ========================================
    // MOSTRAR NOTICIAS
    // ========================================

    function renderNews(news) {

        if (!newsPageGrid) {
            return;
        }


        if (!Array.isArray(news) || news.length === 0) {

            newsPageGrid.innerHTML = `
                <div class="news-loading">
                    NO HAY NOTICIAS PUBLICADAS
                </div>
            `;

            return;
        }


        // Respeta exactamente el orden de Pages CMS
        newsPageGrid.innerHTML = news.map(article => {

            const slug =
                createSlug(article);


            const articleURL =
                `noticia.html?slug=${encodeURIComponent(slug)}`;


            const imagePath =
                String(article.image ?? "").trim();


            const imageBlock = imagePath
                ? `
                    <div class="news-page-card-image">

                        <img
                            src="${escapeHTML(imagePath)}"
                            alt="${escapeHTML(article.title)}"
                            loading="lazy"
                            onerror="this.style.display='none'"
                        >

                    </div>
                `
                : `
                    <div class="news-page-card-image news-page-card-placeholder">

                        <span>
                            HYPERDRIVE
                        </span>

                    </div>
                `;


            return `
                <a
                    href="${articleURL}"
                    class="news-page-card"
                >

                    ${imageBlock}

                    <div class="news-page-card-content">

                        <div class="news-page-card-meta">

                            <span class="news-page-card-category">
                                ${escapeHTML(article.category)}
                            </span>

                            <span class="news-page-card-date">
                                ${escapeHTML(formatDate(article.date))}
                            </span>

                        </div>


                        <h2>
                            ${escapeHTML(article.title)}
                        </h2>


                        <p>
                            ${escapeHTML(article.summary)}
                        </p>


                        <span class="news-page-card-read">
                            LEER NOTICIA →
                        </span>

                    </div>

                </a>
            `;

        }).join("");

    }


    // ========================================
    // CARGAR NEWS.JSON
    // ========================================

    async function loadNews() {

        try {

            const response = await fetch(
                "data/news.json",
                {
                    cache: "no-store"
                }
            );


            if (!response.ok) {

                throw new Error(
                    `No se pudo cargar news.json. Código: ${response.status}`
                );

            }


            const data =
                await response.json();


            if (!Array.isArray(data.news)) {

                throw new Error(
                    "news.json no contiene el array news"
                );

            }


            renderNews(data.news);


        } catch (error) {

            console.error(error);


            if (newsPageGrid) {

                newsPageGrid.innerHTML = `
                    <div class="news-loading">
                        ERROR AL CARGAR LAS NOTICIAS
                    </div>
                `;

            }

        }

    }


    loadNews();

});
