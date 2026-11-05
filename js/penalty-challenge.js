// T8 · R8 — Penalty Challenge. Source of truth: raw RLT JSON + Race Control RPC.
// Points are calculated at display time; never rewrite RLT's driverPoints/teamPoints.
(() => {
    "use strict";
    const sanctioned = { academy: new Set(), hyperdrive: new Set() };
    let loaded = false;
    const normalize = value => String(value ?? "").trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

    // Fail closed: an unavailable sanctions check must not award unverified double points.
    const ready = fetch("https://knyxattsjimsjefydcad.supabase.co/rest/v1/rpc/penalty_challenge_r8_fia_sanctions", {
        method: "POST",
        headers: {
            apikey: "sb_publishable_hLAzZZF6kki1xZ0Kyx6lfA_97kzSAmf",
            "Content-Type": "application/json"
        },
        body: "{}",
        cache: "no-store"
    }).then(async response => {
        if (!response.ok) throw new Error("Race Control RPC: " + response.status);
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error("Invalid Race Control response");
        for (const row of rows) {
            if (sanctioned[row?.division] && row?.alias) {
                sanctioned[row.division].add(normalize(row.alias));
            }
        }
        loaded = true;
        return true;
    }).catch(error => {
        console.warn("Penalty Challenge: no se ha podido verificar Race Control; no se otorgarán bonus.", error);
        return false;
    });

    function hasRltPenalty(driver) {
        const penalties = driver?.penalties;
        if (!penalties || typeof penalties !== "object") return false;
        return Object.entries(penalties).some(([name, value]) => {
            if (/^totalPenaltyPoints$/i.test(name)) return Number(value) !== 0;
            if (typeof value === "number") return value !== 0;
            if (typeof value === "string") {
                const trimmed = value.trim();
                return trimmed !== "" && trimmed !== "0" && trimmed !== "0.0";
            }
            if (Array.isArray(value)) return value.length > 0;
            return Boolean(value);
        });
    }

    function multiplier(division, round, type, driver) {
        if (Number(round) !== 8 || type !== "race") return 1;
        if (!loaded || !sanctioned[division]) return 1;
        if (hasRltPenalty(driver)) return 1;
        if (sanctioned[division].has(normalize(driver?.driverName))) return 1;
        return 2;
    }

    window.HyperDrivePenaltyChallenge = { ready, multiplier, hasRltPenalty };
})();
