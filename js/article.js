// ========================================
// HYPERDRIVE LEAGUE
// Página individual de noticias
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    const loading =
        document.getElementById("article-loading");

    const container =
        document.getElementById("article-container");

    const category =
        document.getElementById("article-category");

    const title =
        document.getElementById("article-title");

    const date =
        document.getElementById("article-date");

    const image =
        document.getElementById("article-image");

    const body =
        document.getElementById("article-body");


    // ========================================
    // OBTENER ID DE LA URL
    // ========================================

    const params =
        new URLSearchParams(window.location.search);

    const articleId =
        params.get("id");


    // ========================================
    // MOSTRAR ERROR
    // ========================================

    function showError(message) {

        if (loading) {
            loading.textContent = message;
        }

        if (container) {
            container.hidden = true;
        }

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


        return articleDate
            .toLocaleDateString(
                "es-ES",
                {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                }
            )
            .toUpperCase();

    }


    // ========================================
    // TEXTO DE LA NOTICIA
    // ========================================

    function renderBody(text) {

        body.innerHTML = "";


        const content =
            String(text ?? "").trim();


        if (!content) {

            const paragraph =
                document.createElement("p");

            paragraph.textContent =
                "No hay contenido adicional para esta noticia.";

            body.appendChild(paragraph);

            return;
        }


        const blocks =
            content.split(/\n\s*\n/);


        blocks.forEach(block => {

            const cleanBlock =
                block.trim();


            if (!cleanBlock) {
                return;
            }


            const paragraph =
                document.createElement("p");

            paragraph.textContent =
                cleanBlock;

            body.appendChild(paragraph);

        });

    }


    // ========================================
    // MOSTRAR NOTICIA
    // ========================================

    function renderArticle(article) {

        category.textContent =
            article.category || "HYPERDRIVE";


        title.textContent =
            article.title || "Noticia";


        date.textContent =
            formatDate(article.date);


        document.title =
            `${article.title || "Noticia"} | HyperDrive League`;


        // IMAGEN

        const imagePath =
            String(article.image ?? "").trim();


        image.innerHTML = "";


        if (imagePath) {

            const img =
                document.createElement("img");

            img.src =
                imagePath;

            img.alt =
                article.title || "HyperDrive";

            img.loading =
                "eager";


            img.onerror = () => {
                image.style.display = "none";
            };


            image.appendChild(img);

        } else {

            image.style.display =
                "none";

        }


        // CUERPO

        renderBody(
            article.body ||
            article.summary ||
            ""
        );


        // MOSTRAR

        loading.style.display =
            "none";

        container.hidden =
            false;

    }


    // ========================================
    // CARGAR NEWS.JSON
    // ========================================

    async function loadArticle() {

        if (!articleId) {

            showError(
                "NO SE HA INDICADO NINGUNA NOTICIA"
            );

            return;

        }


        try {

            const response =
                await fetch(
                    "data/news.json",
                    {
                        cache: "no-store"
                    }
                );


            if (!response.ok) {

                throw new Error(
                    `Error ${response.status}`
                );

            }


            const data =
                await response.json();


            if (!Array.isArray(data.news)) {

                throw new Error(
                    "Formato de news.json incorrecto"
                );

            }


            const article =
                data.news.find(item => {

                    return String(item.id) ===
                        String(articleId);

                });


            if (!article) {

                showError(
                    "NOTICIA NO ENCONTRADA"
                );

                return;

            }


            renderArticle(article);


        } catch (error) {

            console.error(error);

            showError(
                "ERROR AL CARGAR LA NOTICIA"
            );

        }

    }


    loadArticle();

});
