/**
 * Smoke audit for:
 * - fee-sheet-categories endpoints
 * - seed-defaults idempotency
 * - add-to-superbill
 * - superbill optimistic locking (409)
 *
 * Usage:
 *   TOKEN=... BASE_URL=https://pagemdemr.com node scripts/audit-superbill-openemr-features.js
 */
const BASE_URL = process.env.BASE_URL || 'https://pagemdemr.com';
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
    console.error("Missing TOKEN env var.");
    process.exit(1);
}

async function req(path, { method = "GET", body } = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { }
    return { res, text, json };
}

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

(async () => {
    console.log("1) GET /api/fee-sheet-categories");
    const cat1 = await req("/api/fee-sheet-categories");
    assert(cat1.res.ok, `Categories GET failed: ${cat1.res.status} ${cat1.text}`);
    console.log(`   -> ${Array.isArray(cat1.json) ? cat1.json.length : "?"} categories`);

    console.log("2) POST /api/fee-sheet-categories/seed-defaults (run twice)");
    const seedA = await req("/api/fee-sheet-categories/seed-defaults", { method: "POST" });
    assert(seedA.res.ok, `Seed defaults failed: ${seedA.res.status} ${seedA.text}`);
    const seedB = await req("/api/fee-sheet-categories/seed-defaults", { method: "POST" });
    assert(seedB.res.ok, `Seed defaults 2nd run failed: ${seedB.res.status} ${seedB.text}`);
    console.log("   -> seed-defaults ok (twice)");

    console.log("3) Re-check categories exist after seeding");
    const cat2 = await req("/api/fee-sheet-categories");
    assert(cat2.res.ok, `Categories GET after seed failed: ${cat2.res.status} ${cat2.text}`);
    const categories = cat2.json || [];
    assert(categories.length > 0, "No categories found after seed-defaults.");
    const firstCat = categories[0];
    console.log(`   -> using category: ${firstCat.name || firstCat.id}`);

    console.log("4) Need a DRAFT superbill id for add-to-superbill + version audit");
    console.log("   -> If you have an endpoint to list superbills, update this script to fetch one.");
    console.log("   -> For now, set SUPERBILL_ID env var.");
    const SUPERBILL_ID = process.env.SUPERBILL_ID;
    if (!SUPERBILL_ID) {
        console.log("   -> SUPERBILL_ID not set, skipping add-to-superbill and optimistic lock tests");
        console.log("\n✅ PARTIAL AUDIT PASSED: categories + seed");
        return;
    }

    console.log("5) POST add-to-superbill");
    const add = await req(`/api/fee-sheet-categories/${firstCat.id}/add-to-superbill`, {
        method: "POST",
        body: { superbill_id: SUPERBILL_ID },
    });
    assert(add.res.ok, `add-to-superbill failed: ${add.res.status} ${add.text}`);
    console.log("   -> add-to-superbill ok");

    console.log("6) Optimistic locking audit");
    const sbGet = await req(`/api/superbills/${SUPERBILL_ID}`);
    assert(sbGet.res.ok, `GET superbill failed: ${sbGet.res.status} ${sbGet.text}`);
    const v = sbGet.json?.version;
    assert(Number.isInteger(v), `Superbill version missing/invalid: ${v}`);

    const okPut = await req(`/api/superbills/${SUPERBILL_ID}`, {
        method: "PUT",
        body: { expected_version: v, status: sbGet.json.status || "DRAFT" },
    });
    assert(okPut.res.ok, `PUT w/ expected_version failed: ${okPut.res.status} ${okPut.text}`);

    const stalePut = await req(`/api/superbills/${SUPERBILL_ID}`, {
        method: "PUT",
        body: { expected_version: v, status: "READY" },
    });

    assert(stalePut.res.status === 409, `Expected 409 on stale version, got ${stalePut.res.status}: ${stalePut.text}`);
    console.log("   -> optimistic locking OK (409 on stale update)");

    console.log("\n✅ AUDIT PASSED: categories + seed + add-to-superbill + optimistic locking");
})().catch((e) => {
    console.error("\n❌ AUDIT FAILED:", e.message);
    process.exit(1);
});
