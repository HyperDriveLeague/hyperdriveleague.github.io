(() => {
    'use strict';

    const divisions = { hyperdrive: 'HyperDrive · Primera', academy: 'Academy · Segunda' };
    const season = { rounds: 12, noQualifying: [9] };
    // Official awards are credited once, in the division in which the driver earned them.
    // Team award entries list the credited drivers, including for the shared superconstructors title.
    const awards = [
        { division: 'hyperdrive', category: 'world', drivers: ['Iker'] }
    ];
    const normalize = name => String(name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]/g, '');
    const counters = () => ({ wins: 0, podiums: 0, fastest: 0, poles: 0, points: 0, laps: 0, dnf: 0 });

    function getDriver(records, name) {
        const key = normalize(name);
        if (!records.has(key)) {
            records.set(key, { name, race: counters(), sprint: counters(), world: 0, constructors: 0, superconstructors: 0 });
        }
        return records.get(key);
    }

    function addSession(records, division, round, type, data) {
        const qualifying = type === 'qualy' || type === 'sprintQualy';
        const format = type === 'sprint' || type === 'sprintQualy' ? 'sprint' : 'race';
        const normalized = window.HyperDriveRoundSix.normalizeFile(data, division, round, qualifying ? 'qualy' : format);
        const session = normalized.session;
        for (const driver of session.drivers) {
            let name = driver.driverName?.trim();
            if (!name) continue;
            if (division === 'hyperdrive' && round === 3 && type === 'qualy' && name === 'Kol') name = 'Raul';
            const stats = getDriver(records, name)[format];
            const position = Number(driver.classificationPosition ?? driver.position);
            stats.points += Number(driver.driverPoints) || 0;
            if (qualifying) {
                if (position === 1) stats.poles++;
                continue;
            }
            if (position > 0 && position <= 3) {
                stats.podiums++;
                if (position === 1) stats.wins++;
            }
            if (normalize(name) === normalize(session.fastestLap?.driverName)) stats.fastest++;
            stats.laps += Number(driver.lapsCompleted) || 0;
            if (String(driver.status).toUpperCase() === 'DNF') stats.dnf++;
        }
    }

    async function loadDivision(division) {
        const records = new Map();
        let races = 0;
        let sprints = 0;
        async function loadSession(round, type, suffix) {
            const url = 'data/' + division + '_' + suffix + '.json';
            const response = await fetch(url, { cache: 'no-cache' });
            if (response.status === 404) return;
            if (!response.ok) throw new Error(url + ' (' + response.status + ')');
            const data = await response.json();
            if (!Array.isArray(data.session?.drivers)) throw new Error(url);
            if (!data.session.drivers.length || data.session.sessionInfo?.completedStatus !== 'Completed') return;
            addSession(records, division, round, type, data);
            if (type === 'race') races++;
            if (type === 'sprint') sprints++;
        }
        // Load sessions round by round to avoid downloading all the telemetry at once.
        for (let round = 1; round <= season.rounds; round++) {
            const files = [['race', 'r' + round], ['sprint', 'r' + round + '_sprint']];
            if (!season.noQualifying.includes(round)) {
                files.push(['qualy', 'qr' + round], ['sprintQualy', 'qr' + round + '_sprint']);
            }
            await Promise.all(files.map(([type, suffix]) => loadSession(round, type, suffix)));
        }
        for (const award of awards.filter(entry => entry.division === division)) {
            for (const name of award.drivers) getDriver(records, name)[award.category]++;
        }
        return { drivers: [...records.values()], races, sprints };
    }

    const sessionColumns = [
        ['Victorias', 'wins'], ['Podios', 'podiums'], ['Vueltas rápidas', 'fastest'], ['Poles', 'poles'],
        ['Puntos', 'points'], ['Vueltas completadas', 'laps'], ['DNF', 'dnf']
    ];
    const titleColumns = [['Mundiales de pilotos', 'world'], ['Constructores', 'constructors'], ['Superconstructores', 'superconstructors']];
    const points = driver => driver.race.points + driver.sprint.points;
    const summaryColumns = [
        ['Puntos', points], ['Victorias GP', d => d.race.wins], ['Podios GP', d => d.race.podiums],
        ['Victorias sprint', d => d.sprint.wins], ['Podios sprint', d => d.sprint.podiums],
        ['Vueltas rápidas', d => d.race.fastest + d.sprint.fastest], ['Poles', d => d.race.poles + d.sprint.poles],
        ['Vueltas completadas', d => d.race.laps + d.sprint.laps], ['DNF', d => d.race.dnf + d.sprint.dnf]
    ];

    const table = document.querySelector('#records-table');
    const status = document.querySelector('#records-status');
    const view = document.querySelector('#records-view');
    const search = document.querySelector('#records-search');
    const note = document.querySelector('#records-note');
    const loaded = new Map();
    let division = 'hyperdrive';
    let current = null;

    function cell(row, tag, value, scope) {
        const element = document.createElement(tag);
        element.textContent = value;
        if (scope) element.scope = scope;
        row.append(element);
    }

    function render() {
        if (!current) return;
        const mode = view.value;
        let columns = summaryColumns;
        if (mode === 'titles') columns = titleColumns.map(([label, key]) => [label, d => d[key]]);
        if (mode === 'race' || mode === 'sprint') columns = sessionColumns.map(([label, key]) => [label, d => d[mode][key]]);
        const query = normalize(search.value);
        const score = d => mode === 'titles' ? d.world + d.constructors + d.superconstructors :
            mode === 'summary' ? points(d) : d[mode].points;
        const drivers = current.drivers.filter(d => normalize(d.name).includes(query))
            .sort((a, b) => score(b) - score(a) || points(b) - points(a) || a.name.localeCompare(b.name, 'es'));
        status.textContent = current.races + ' carreras · ' + current.sprints + ' sprints · ' + drivers.length + ' pilotos';
        table.caption.textContent = divisions[division] + ' · ' + view.selectedOptions[0].textContent;
        table.tHead.replaceChildren();
        const header = table.tHead.insertRow();
        cell(header, 'th', 'Piloto', 'col');
        for (const [label] of columns) cell(header, 'th', label, 'col');
        const body = table.tBodies[0];
        body.replaceChildren();
        for (const driver of drivers) {
            const row = body.insertRow();
            cell(row, 'th', driver.name, 'row');
            for (const [, value] of columns) cell(row, 'td', value(driver));
        }
        if (!drivers.length) status.textContent += ' · Sin coincidencias';
        note.textContent = mode === 'titles' ?
            'Títulos confirmados de la T8. Los campeonatos de equipos se acreditan a los pilotos reconocidos por la liga.' :
            'Los podios incluyen victorias. Los puntos son los obtenidos en las sesiones, incluida la clasificación correspondiente, también para reservas. Las vueltas y los abandonos corresponden a carreras y sprints.';
        table.hidden = false;
    }

    async function selectDivision(next) {
        division = next;
        current = null;
        table.hidden = true;
        note.textContent = '';
        status.textContent = 'Cargando resultados de ' + divisions[next] + '…';
        document.querySelectorAll('[data-division]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.division === next));
        });
        if (!loaded.has(next)) loaded.set(next, loadDivision(next).catch(error => { loaded.delete(next); throw error; }));
        try {
            const result = await loaded.get(next);
            if (division !== next) return;
            current = result;
            render();
        } catch (error) {
            if (division === next) status.textContent = 'No se pudieron cargar todos los resultados. Pulsa la división para reintentar.';
            console.error(error);
        }
    }

    document.querySelectorAll('[data-division]').forEach(button => {
        button.addEventListener('click', () => selectDivision(button.dataset.division));
    });
    view.addEventListener('change', render);
    search.addEventListener('input', render);
    selectDivision(division);
})();
