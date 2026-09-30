(() => {
    const circuitSelect = document.getElementById('qualy-circuit-select');
    const driverSelect = document.getElementById('qualy-driver-select');
    const rankingList = document.getElementById('qualy-ranking-list');
    const rankingTitle = document.getElementById('qualy-ranking-title');
    const rankingMeta = document.getElementById('qualy-ranking-meta');
    const recordContent = document.getElementById('qualy-record-content');
    const driverContent = document.getElementById('qualy-driver-content');
    const circuitCount = document.getElementById('qualy-circuit-count');
    const driverCount = document.getElementById('qualy-driver-count');
    const recordCount = document.getElementById('qualy-record-count');

    const state = {
        circuits: [],
        records: [],
        selectedCircuitId: '',
        selectedDriverKey: ''
    };

    const esc = value => String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    const slug = value => String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const driverKey = record => String(
        record.driverId ||
        record.driverSlug ||
        record.driverKey ||
        record.driver ||
        record.driverName ||
        ''
    ).trim().toLowerCase();

    const trackId = record => String(
        record.trackId ||
        record.circuitId ||
        slug(record.trackName || record.track || record.circuit || '')
    ).trim().toLowerCase();

    const parseTimeMs = record => {
        const direct = Number(record.timeMs ?? record.lapTimeMs ?? record.bestLapTimeMs);
        if (Number.isFinite(direct) && direct > 0) return direct;

        const text = String(record.time || record.lapTime || record.bestLapTime || '').trim();
        if (!text) return NaN;

        const parts = text.split(':');
        if (parts.length === 2) {
            const minutes = Number(parts[0]);
            const seconds = Number(parts[1]);
            if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
                return Math.round((minutes * 60 + seconds) * 1000);
            }
        }

        const seconds = Number(text);
        return Number.isFinite(seconds) ? Math.round(seconds * 1000) : NaN;
    };

    const formatLap = ms => {
        if (!Number.isFinite(ms) || ms <= 0) return '--';
        const minutes = Math.floor(ms / 60000);
        const seconds = (ms - minutes * 60000) / 1000;
        return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
    };

    const formatGap = ms => {
        if (!Number.isFinite(ms) || ms <= 0) return '—';
        return `+${(ms / 1000).toFixed(3)}`;
    };

    const formatDate = value => {
        if (!value) return '';
        const date = new Date(`${value}T12:00:00`);
        if (Number.isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(date).replace('.', '');
    };

    const divisionLabel = value => {
        const v = String(value || '').toLowerCase();
        if (v.includes('academy')) return 'Academy';
        if (v.includes('hyper')) return 'HyperDrive';
        return value || '';
    };

    function normaliseRecord(raw) {
        const timeMs = parseTimeMs(raw);
        return {
            ...raw,
            trackId: trackId(raw),
            driverKey: driverKey(raw),
            driverName: raw.driverName || raw.driver || raw.displayName || 'Piloto',
            timeMs,
            time: raw.time || raw.lapTime || raw.bestLapTime || formatLap(timeMs),
            season: Number(raw.season ?? raw.seasonNumber) || null,
            round: Number(raw.round ?? raw.roundNumber) || null,
            division: divisionLabel(raw.division || raw.league || ''),
            date: raw.date || raw.eventDate || null
        };
    }

    function getCircuit(id) {
        return state.circuits.find(c => c.id === id) || null;
    }

    function getRanking(circuitId) {
        const bestByDriver = new Map();

        for (const rawRecord of state.records) {
            const record = normaliseRecord(rawRecord);
            if (record.trackId !== circuitId) continue;
            if (!record.driverKey || !Number.isFinite(record.timeMs) || record.timeMs <= 0) continue;

            const previous = bestByDriver.get(record.driverKey);
            if (!previous || record.timeMs < previous.timeMs) {
                bestByDriver.set(record.driverKey, record);
            }
        }

        return [...bestByDriver.values()]
            .sort((a, b) => a.timeMs - b.timeMs)
            .map((record, index) => ({ ...record, historicalPosition: index + 1 }));
    }

    function recordMeta(record) {
        const bits = [];
        if (record.season) bits.push(`Season ${record.season}`);
        if (record.division) bits.push(record.division);
        if (record.round) bits.push(`R${record.round}`);
        if (record.date) bits.push(formatDate(record.date));
        return bits.join(' · ');
    }

    function renderStats() {
        const driverKeys = new Set(
            state.records
                .map(normaliseRecord)
                .filter(r => Number.isFinite(r.timeMs) && r.timeMs > 0 && r.driverKey)
                .map(r => r.driverKey)
        );

        circuitCount.textContent = String(state.circuits.length);
        driverCount.textContent = String(driverKeys.size);
        recordCount.textContent = String(state.records.length);
    }

    function renderCircuitSelect() {
        circuitSelect.innerHTML = state.circuits.length
            ? state.circuits.map(circuit => `
                <option value="${esc(circuit.id)}">${esc(circuit.name)}${circuit.country ? ` · ${esc(circuit.country)}` : ''}</option>
            `).join('')
            : '<option value="">Sin circuitos disponibles</option>';

        circuitSelect.disabled = state.circuits.length === 0;

        if (!state.selectedCircuitId && state.circuits.length) {
            state.selectedCircuitId = state.circuits[state.circuits.length - 1].id;
        }

        if (state.selectedCircuitId) circuitSelect.value = state.selectedCircuitId;
    }

    function renderDriverSelect(ranking) {
        const previous = state.selectedDriverKey;
        const options = ranking
            .slice()
            .sort((a, b) => a.driverName.localeCompare(b.driverName, 'es', { sensitivity: 'base' }))
            .map(record => `<option value="${esc(record.driverKey)}">${esc(record.driverName)}</option>`)
            .join('');

        driverSelect.innerHTML = `<option value="">Todos los pilotos</option>${options}`;
        driverSelect.disabled = ranking.length === 0;

        const exists = ranking.some(record => record.driverKey === previous);
        state.selectedDriverKey = exists ? previous : '';
        driverSelect.value = state.selectedDriverKey;
    }

    function renderRecordCard(ranking) {
        if (!ranking.length) {
            recordContent.innerHTML = `
                <span class="qualy-muted">Aún no se han importado tiempos de clasificación de este circuito.</span>
            `;
            return;
        }

        const record = ranking[0];
        recordContent.innerHTML = `
            <div class="qualy-record-main">
                <div>
                    <div class="qualy-record-driver">${esc(record.driverName)}</div>
                    <div class="qualy-record-meta">${esc(recordMeta(record) || 'Registro histórico')}</div>
                </div>
                <div class="qualy-record-time">${esc(formatLap(record.timeMs))}</div>
            </div>
            <span class="qualy-record-tag">RÉCORD DE LA LIGA</span>
        `;
    }

    function renderDriverCard(ranking) {
        if (!ranking.length) {
            driverContent.innerHTML = `
                <span class="qualy-muted">Cuando se carguen los tiempos de qualy podrás consultar aquí el mejor registro histórico de cada piloto.</span>
            `;
            return;
        }

        if (!state.selectedDriverKey) {
            driverContent.innerHTML = `
                <span class="qualy-muted">Selecciona un piloto para ver su mejor vuelta y su posición histórica en este circuito.</span>
            `;
            return;
        }

        const selected = ranking.find(record => record.driverKey === state.selectedDriverKey);
        if (!selected) return;
        const leader = ranking[0];
        const gap = selected.timeMs - leader.timeMs;

        driverContent.innerHTML = `
            <div class="qualy-driver-main">
                <div>
                    <div class="qualy-selected-driver">${esc(selected.driverName)}</div>
                    <div class="qualy-driver-meta">${esc(recordMeta(selected) || 'Mejor registro histórico')}</div>
                </div>
                <div class="qualy-driver-position">P${selected.historicalPosition}</div>
            </div>
            <div class="qualy-divider"></div>
            <div class="qualy-record-main">
                <div>
                    <span class="qualy-muted">MEJOR TIEMPO</span>
                    <div class="qualy-selected-time">${esc(formatLap(selected.timeMs))}</div>
                </div>
                <div class="qualy-gap">${gap > 0 ? esc(formatGap(gap)) : 'RÉCORD'}</div>
            </div>
        `;
    }

    function renderRankingRows(ranking) {
        if (!ranking.length) {
            rankingList.innerHTML = `
                <div class="qualy-empty">
                    TODAVÍA NO HAY TIEMPOS DE QUALY ARCHIVADOS PARA ESTE CIRCUITO
                </div>
            `;
            return;
        }

        const leaderTime = ranking[0].timeMs;
        rankingList.innerHTML = ranking.map(record => {
            const selectedClass = state.selectedDriverKey === record.driverKey ? ' is-selected' : '';
            return `
                <div class="qualy-row${selectedClass}" data-driver-key="${esc(record.driverKey)}" role="button" tabindex="0">
                    <span class="qualy-pos">P${record.historicalPosition}</span>
                    <span class="qualy-driver-name">${esc(record.driverName)}</span>
                    <span class="qualy-time">${esc(formatLap(record.timeMs))}</span>
                    <span class="qualy-gap">${record.historicalPosition === 1 ? 'RÉCORD' : esc(formatGap(record.timeMs - leaderTime))}</span>
                    <span class="qualy-entry-meta">${esc(recordMeta(record) || 'Histórico HyperDrive')}</span>
                </div>
            `;
        }).join('');

        rankingList.querySelectorAll('.qualy-row').forEach(row => {
            const selectRow = () => {
                state.selectedDriverKey = row.dataset.driverKey || '';
                driverSelect.value = state.selectedDriverKey;
                renderCurrentCircuit();
            };
            row.addEventListener('click', selectRow);
            row.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectRow();
                }
            });
        });
    }

    function renderCurrentCircuit() {
        const circuit = getCircuit(state.selectedCircuitId);
        const ranking = getRanking(state.selectedCircuitId);

        rankingTitle.textContent = circuit ? `RANKING · ${circuit.name.toUpperCase()}` : 'RANKING GLOBAL';
        rankingMeta.textContent = ranking.length
            ? `${ranking.length} ${ranking.length === 1 ? 'piloto' : 'pilotos'} · mejor tiempo histórico de cada uno`
            : 'Pendiente de importar tiempos de clasificación';

        renderDriverSelect(ranking);
        renderRecordCard(ranking);
        renderDriverCard(ranking);
        renderRankingRows(ranking);
    }

    async function loadHistory() {
        try {
            const response = await fetch(`data/qualy-history.json?v=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            const circuitMap = new Map();
            for (const circuit of Array.isArray(data.circuits) ? data.circuits : []) {
                const id = String(circuit.id || slug(circuit.name)).toLowerCase();
                if (!id) continue;
                circuitMap.set(id, { ...circuit, id });
            }

            state.records = Array.isArray(data.records) ? data.records : [];
            for (const rawRecord of state.records) {
                const record = normaliseRecord(rawRecord);
                if (!record.trackId || circuitMap.has(record.trackId)) continue;
                circuitMap.set(record.trackId, {
                    id: record.trackId,
                    name: rawRecord.trackName || rawRecord.track || rawRecord.circuit || record.trackId,
                    country: rawRecord.country || ''
                });
            }

            state.circuits = [...circuitMap.values()];

            renderStats();
            renderCircuitSelect();
            renderCurrentCircuit();
        } catch (error) {
            console.error('Qualy history load error:', error);
            circuitSelect.innerHTML = '<option>Error al cargar</option>';
            circuitSelect.disabled = true;
            driverSelect.disabled = true;
            rankingList.innerHTML = '<div class="qualy-empty qualy-error">NO SE PUDO CARGAR EL HISTÓRICO DE QUALY</div>';
            recordContent.innerHTML = '<span class="qualy-muted qualy-error">Error al cargar los datos.</span>';
            driverContent.innerHTML = '<span class="qualy-muted qualy-error">Error al cargar los datos.</span>';
        }
    }

    circuitSelect.addEventListener('change', () => {
        state.selectedCircuitId = circuitSelect.value;
        state.selectedDriverKey = '';
        renderCurrentCircuit();
    });

    driverSelect.addEventListener('change', () => {
        state.selectedDriverKey = driverSelect.value;
        const ranking = getRanking(state.selectedCircuitId);
        renderDriverCard(ranking);
        renderRankingRows(ranking);
    });

    loadHistory();
})();
