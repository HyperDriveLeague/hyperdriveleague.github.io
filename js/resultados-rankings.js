(() => {
    const list = document.getElementById('results-page-list');
    if (!list) return;

    const cache = new Map();
    let timer = null;

    function normalize(value) {
        return String(value ?? '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    function activeDivision() {
        return document
            .querySelector('.results-page-tab.active[data-results-page-division]')
            ?.dataset.resultsPageDivision || 'hyperdrive';
    }

    async function loadSession(division, round, type) {
        const suffix = type === 'sprint' ? '_sprint' : '';
        const path = `data/${division}_r${round}${suffix}.json`;

        if (!cache.has(path)) {
            cache.set(
                path,
                fetch(path, { cache: 'no-store' })
                    .then(response => response.ok ? response.json() : null)
                    .catch(() => null)
            );
        }

        return cache.get(path);
    }

    async function patchRankings() {
        const division = activeDivision();
        const groups = [...document.querySelectorAll('.results-session-details[data-session-type]')];

        await Promise.all(groups.map(async group => {
            const round = Number(group.closest('.results-round-card[data-round]')?.dataset.round);
            const type = group.dataset.sessionType;
            if (!round || !type) return;

            const data = await loadSession(division, round, type);
            const drivers = Array.isArray(data?.session?.drivers) ? data.session.drivers : [];
            const byName = new Map(drivers.map(driver => [normalize(driver.driverName), driver]));

            group.querySelectorAll('.results-full-driver-block').forEach(block => {
                const driverName = block.querySelector('.results-full-driver-text strong')?.textContent?.trim();
                const raw = byName.get(normalize(driverName));
                if (!raw) return;

                block.querySelectorAll('.results-driver-stat').forEach(stat => {
                    const label = stat.querySelector('span')?.textContent?.trim().toUpperCase();
                    const value = stat.querySelector('strong');
                    if (!value) return;

                    let rank = null;
                    if (label === 'RITMO RLT') rank = Number(raw?.ratings?.pace?.position);
                    if (label === 'CONSISTENCIA') rank = Number(raw?.ratings?.consistency?.position);
                    if (!Number.isFinite(rank) || rank < 1) return;

                    const base = value.textContent.replace(/\s*·\s*P\d+\s*$/, '').trim();
                    if (!base || base === '—') return;
                    value.textContent = `${base} · P${rank}`;
                });
            });
        }));
    }

    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(patchRankings, 50);
    }

    new MutationObserver(schedule).observe(list, { childList: true, subtree: true });
    document.querySelectorAll('.results-page-tab').forEach(button => {
        button.addEventListener('click', () => setTimeout(schedule, 80));
    });

    schedule();
})();