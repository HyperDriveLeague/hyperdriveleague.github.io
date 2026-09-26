// ========================================
// HYPERDRIVE LEAGUE
// DIRECTOS / VIDEOS DE YOUTUBE
// ========================================

(function () {

    "use strict";


    // ========================================
    // CONFIGURACIÓN
    // ========================================

    const config =
        window.HYPERDRIVE_YOUTUBE;


    const API_BASE =
        "https://www.googleapis.com/youtube/v3";


    // ========================================
    // ELEMENTOS
    // ========================================

    const grid =
        document.getElementById(
            "videos-grid"
        );


    const moreButton =
        document.getElementById(
            "videos-more-button"
        );


    const errorBox =
        document.getElementById(
            "videos-error"
        );


    // ========================================
    // ESTADO
    // ========================================

    let uploadsPlaylistId = null;

    let nextPlaylistToken = null;

    let playlistFinished = false;

    let loading = false;


    // Vídeos válidos ya descargados
    // pero todavía no mostrados.

    const videoBuffer = [];


    // Evita duplicados.

    const renderedVideoIds =
        new Set();



    // ========================================
    // INICIO
    // ========================================

    async function init() {

        if (
            !grid ||
            !moreButton ||
            !errorBox
        ) {

            return;

        }


        if (
            !config ||
            !config.apiKey ||
            config.apiKey ===
                "PEGA_AQUI_TU_CLAVE"
        ) {

            showError(
                "Falta configurar la clave de YouTube."
            );

            return;

        }


        moreButton.addEventListener(
            "click",
            loadMoreVideos
        );


        try {

            uploadsPlaylistId =
                await getUploadsPlaylist();


            await loadMoreVideos();

        }
        catch (error) {

            handleError(error);

        }

    }



    // ========================================
    // PETICIÓN API
    // ========================================

    async function apiRequest(
        endpoint,
        parameters = {}
    ) {

        const url =
            new URL(
                `${API_BASE}/${endpoint}`
            );


        const params =
            new URLSearchParams();


        Object.entries(parameters)
            .forEach(
                ([key, value]) => {

                    if (
                        value !== null &&
                        value !== undefined &&
                        value !== ""
                    ) {

                        params.set(
                            key,
                            value
                        );

                    }

                }
            );


        params.set(
            "key",
            config.apiKey
        );


        url.search =
            params.toString();


        const response =
            await fetch(url);


        if (!response.ok) {

            let message =
                `Error ${response.status}`;


            try {

                const data =
                    await response.json();


                message =
                    data?.error?.message ||
                    message;

            }
            catch (error) {

                // No hacemos nada.

            }


            throw new Error(message);

        }


        return response.json();

    }



    // ========================================
    // OBTENER PLAYLIST DE SUBIDAS
    // ========================================

    async function getUploadsPlaylist() {

        const data =
            await apiRequest(
                "channels",
                {
                    part:
                        "contentDetails",

                    forHandle:
                        config.channelHandle
                }
            );


        const channel =
            data.items?.[0];


        const playlistId =
            channel
                ?.contentDetails
                ?.relatedPlaylists
                ?.uploads;


        if (!playlistId) {

            throw new Error(
                "No se ha podido localizar el canal de YouTube."
            );

        }


        return playlistId;

    }



    // ========================================
    // CARGAR 10 MÁS
    // ========================================

    async function loadMoreVideos() {

        if (loading) {

            return;

        }


        loading = true;


        hideError();


        moreButton.disabled = true;

        moreButton.textContent =
            "CARGANDO...";


        try {

            const videosToShow = [];


            const pageSize =
                Number(
                    config.pageSize
                ) || 10;



            // ========================================
            // CONSEGUIR SUFICIENTES VÍDEOS VÁLIDOS
            // ========================================

            while (
                videosToShow.length <
                pageSize
            ) {


                // Primero usamos los vídeos
                // que ya estaban descargados.

                while (
                    videoBuffer.length > 0 &&
                    videosToShow.length <
                    pageSize
                ) {

                    const video =
                        videoBuffer.shift();


                    if (
                        !renderedVideoIds.has(
                            video.id
                        )
                    ) {

                        videosToShow.push(
                            video
                        );

                    }

                }



                if (
                    videosToShow.length >=
                    pageSize
                ) {

                    break;

                }



                if (playlistFinished) {

                    break;

                }



                // Si no quedan suficientes,
                // pedimos otro bloque a YouTube.

                await fetchNextPlaylistBatch();

            }



            // ========================================
            // QUITAR CARGANDO INICIAL
            // ========================================

            const loadingElement =
                grid.querySelector(
                    ".videos-loading"
                );


            if (loadingElement) {

                loadingElement.remove();

            }



            // ========================================
            // MOSTRAR VÍDEOS
            // ========================================

            videosToShow
                .forEach(
                    video => {

                        renderVideo(
                            video
                        );

                    }
                );



            // ========================================
            // SIN VÍDEOS
            // ========================================

            if (
                renderedVideoIds.size === 0
            ) {

                grid.innerHTML = `

                    <div class="videos-loading">
                        NO HAY VÍDEOS DISPONIBLES.
                    </div>

                `;

            }



            // ========================================
            // BOTÓN + MÁS
            // ========================================

            updateMoreButton();

        }
        catch (error) {

            handleError(error);

        }
        finally {

            loading = false;


            moreButton.disabled =
                false;


            moreButton.textContent =
                "+ MÁS";

        }

    }



    // ========================================
    // OBTENER SIGUIENTE BLOQUE
    // ========================================

    async function fetchNextPlaylistBatch() {

        const playlistData =
            await apiRequest(
                "playlistItems",
                {
                    part:
                        "contentDetails,snippet",

                    playlistId:
                        uploadsPlaylistId,

                    maxResults:
                        50,

                    pageToken:
                        nextPlaylistToken
                }
            );


        nextPlaylistToken =
            playlistData.nextPageToken ||
            null;


        if (!nextPlaylistToken) {

            playlistFinished = true;

        }



        const ids =
            (playlistData.items || [])

                .map(
                    item =>
                        item
                            ?.contentDetails
                            ?.videoId
                )

                .filter(Boolean);



        if (ids.length === 0) {

            return;

        }



        // ========================================
        // INFORMACIÓN COMPLETA DE LOS VÍDEOS
        // ========================================

        const videosData =
            await apiRequest(
                "videos",
                {
                    part:
                        "snippet,contentDetails,liveStreamingDetails",

                    id:
                        ids.join(",")
                }
            );



        const videosById =
            new Map();


        (videosData.items || [])
            .forEach(
                video => {

                    videosById.set(
                        video.id,
                        video
                    );

                }
            );



        // ========================================
        // RESPETAR EL ORDEN DEL CANAL
        // ========================================

        ids.forEach(
            id => {

                const video =
                    videosById.get(id);


                if (!video) {

                    return;

                }


                if (
                    isValidVideo(video)
                ) {

                    videoBuffer.push(
                        video
                    );

                }

            }
        );

    }



    // ========================================
    // FILTROS
    // ========================================

    function isValidVideo(video) {


        // ========================================
        // EXCLUIR DIRECTOS
        // ========================================

        // liveStreamingDetails solo existe
        // si el vídeo es, fue o será
        // una emisión en directo.

        if (
            video.liveStreamingDetails
        ) {

            return false;

        }



        // ========================================
        // EXCLUIR SHORTS
        // ========================================

        const duration =
            parseDuration(
                video
                    ?.contentDetails
                    ?.duration
            );


        const minimumDuration =
            Number(
                config.minVideoSeconds
            ) || 181;


        if (
            duration <
            minimumDuration
        ) {

            return false;

        }



        return true;

    }



    // ========================================
    // DURACIÓN ISO 8601 → SEGUNDOS
    // ========================================

    function parseDuration(
        duration
    ) {

        if (!duration) {

            return 0;

        }


        const match =
            duration.match(
                /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
            );


        if (!match) {

            return 0;

        }


        const hours =
            Number(match[1] || 0);


        const minutes =
            Number(match[2] || 0);


        const seconds =
            Number(match[3] || 0);


        return (
            hours * 3600 +
            minutes * 60 +
            seconds
        );

    }



    // ========================================
    // FORMATO DURACIÓN
    // ========================================

    function formatDuration(
        totalSeconds
    ) {

        const hours =
            Math.floor(
                totalSeconds / 3600
            );


        const minutes =
            Math.floor(
                (
                    totalSeconds % 3600
                ) / 60
            );


        const seconds =
            totalSeconds % 60;



        if (hours > 0) {

            return (
                `${hours}:` +
                `${String(minutes).padStart(2, "0")}:` +
                `${String(seconds).padStart(2, "0")}`
            );

        }


        return (
            `${minutes}:` +
            `${String(seconds).padStart(2, "0")}`
        );

    }



    // ========================================
    // FECHA
    // ========================================

    function formatDate(
        dateString
    ) {

        if (!dateString) {

            return "";

        }


        const date =
            new Date(dateString);


        return new Intl.DateTimeFormat(
            "es-ES",
            {
                day:
                    "numeric",

                month:
                    "long",

                year:
                    "numeric"
            }
        )
        .format(date)
        .toUpperCase();

    }



    // ========================================
    // MINIATURA
    // ========================================

    function getThumbnail(
        video
    ) {

        const thumbnails =
            video
                ?.snippet
                ?.thumbnails ||
            {};


        return (
            thumbnails.maxres?.url ||
            thumbnails.standard?.url ||
            thumbnails.high?.url ||
            thumbnails.medium?.url ||
            thumbnails.default?.url ||
            ""
        );

    }



    // ========================================
    // CREAR TARJETA
    // ========================================

    function renderVideo(
        video
    ) {

        if (
            renderedVideoIds.has(
                video.id
            )
        ) {

            return;

        }


        renderedVideoIds.add(
            video.id
        );


        const durationSeconds =
            parseDuration(
                video
                    ?.contentDetails
                    ?.duration
            );


        const card =
            document.createElement(
                "article"
            );


        card.className =
            "video-card";



        // ========================================
        // ENLACE
        // ========================================

        const link =
            document.createElement(
                "a"
            );


        link.className =
            "video-link";


        link.href =
            `https://www.youtube.com/watch?v=${video.id}`;


        link.target =
            "_blank";


        link.rel =
            "noopener noreferrer";


        link.setAttribute(
            "aria-label",
            `Ver ${video.snippet?.title || "vídeo"} en YouTube`
        );



        // ========================================
        // MINIATURA
        // ========================================

        const thumbnail =
            document.createElement(
                "div"
            );


        thumbnail.className =
            "video-thumbnail";



        const image =
            document.createElement(
                "img"
            );


        image.src =
            getThumbnail(video);


        image.alt =
            video.snippet?.title ||
            "Vídeo HyperDrive";


        image.loading =
            "lazy";


        thumbnail.appendChild(
            image
        );



        // ========================================
        // PLAY
        // ========================================

        const play =
            document.createElement(
                "span"
            );


        play.className =
            "video-play";


        play.textContent =
            "▶";


        thumbnail.appendChild(
            play
        );



        // ========================================
        // DURACIÓN
        // ========================================

        const duration =
            document.createElement(
                "span"
            );


        duration.className =
            "video-duration";


        duration.textContent =
            formatDuration(
                durationSeconds
            );


        thumbnail.appendChild(
            duration
        );



        // ========================================
        // INFORMACIÓN
        // ========================================

        const info =
            document.createElement(
                "div"
            );


        info.className =
            "video-info";



        const date =
            document.createElement(
                "span"
            );


        date.className =
            "video-date";


        date.textContent =
            formatDate(
                video
                    ?.snippet
                    ?.publishedAt
            );



        const title =
            document.createElement(
                "h3"
            );


        title.className =
            "video-title";


        title.textContent =
            video
                ?.snippet
                ?.title ||
            "HyperDrive League";



        info.appendChild(
            date
        );


        info.appendChild(
            title
        );



        // ========================================
        // ENSAMBLAR
        // ========================================

        link.appendChild(
            thumbnail
        );


        link.appendChild(
            info
        );


        card.appendChild(
            link
        );


        grid.appendChild(
            card
        );

    }



    // ========================================
    // BOTÓN + MÁS
    // ========================================

    function updateMoreButton() {

        const hasMore =
            videoBuffer.length > 0 ||
            !playlistFinished;


        moreButton.hidden =
            !hasMore;

    }



    // ========================================
    // ERROR
    // ========================================

    function showError(
        message
    ) {

        const loadingElement =
            grid?.querySelector(
                ".videos-loading"
            );


        if (loadingElement) {

            loadingElement.remove();

        }


        errorBox.textContent =
            message;


        errorBox.hidden =
            false;


        moreButton.hidden =
            true;

    }



    function hideError() {

        errorBox.hidden =
            true;


        errorBox.textContent =
            "";

    }



    function handleError(
        error
    ) {

        console.error(
            "HyperDrive YouTube:",
            error
        );


        showError(
            "No se han podido cargar los vídeos de YouTube. Revisa la configuración de la API."
        );

    }



    // ========================================
    // ARRANCAR
    // ========================================

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init
        );

    }
    else {

        init();

    }


})();
