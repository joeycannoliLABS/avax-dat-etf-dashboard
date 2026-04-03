// app/api/avax-rwa/route.js
// Fetches Avalanche RWA count and holders from RWA.xyz API v4
// Distributed/Represented/Stablecoin values are hardcoded until
// RWA.xyz supports All Chains aggregate queries

export const revalidate = 1800;

const BASE = 'https://api.rwa.xyz/v4';
const API_KEY = process.env.RWA_API_KEY;
const STABLECOIN_CLASS_ID = 28;

function numVal(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.val != null) return v.val;
  return 0;
}

async function rwaFetch(endpoint, query) {
  var qs = query ? '?query=' + encodeURIComponent(JSON.stringify(query)) : '';
  var res = await fetch(BASE + endpoint + qs, {
    headers: { 'Authorization': 'Bearer ' + API_KEY },
    next: { revalidate: 1800 },
  });
  var text = await res.text();
  if (!res.ok) throw new Error(res.status + ': ' + text.slice(0, 300));
  return JSON.parse(text);
}

export async function GET() {
  if (!API_KEY) return Response.json({ error: 'RWA_API_KEY not set' }, { status: 500 });

  try {
    // Fetch all Avalanche C-Chain tokens for count + holders
    var allTokens = [];
    var pg = 1, more = true;
    while (more && pg <= 30) {
      var d = await rwaFetch('/tokens', {
        filter: { operator: 'equals', field: 'network_slug', value: 'avalanche-c-chain' },
        pagination: { page: pg, perPage: 100 }
      });
      var toks = d.results || [];
      if (toks.length === 0) { more = false; break; }
      allTokens = allTokens.concat(toks);
      if (allTokens.length >= (d.pagination ? d.pagination.resultCount : Infinity)) more = false;
      pg++;
    }

    // Count RWAs (exclude stablecoins) and sum holders
    var rwaCount = 0, holders = 0;
    allTokens.forEach(function(t) {
      var classId = t.asset_class_id || (t.asset_class ? t.asset_class.id : 0);
      if (classId === STABLECOIN_CLASS_ID) return;
      rwaCount++;
      holders += numVal(t.holding_addresses_count);
    });

    return Response.json({
      rwaCount: rwaCount,
      holders: holders,
      lastUpdated: new Date().toISOString(),
      source: 'RWA.xyz API v4'
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' }
    });

  } catch (error) {
    return Response.json({
      rwaCount: 56, holders: 7910,
      lastUpdated: new Date().toISOString(), source: 'fallback', error: error.message
    }, { status: 200 });
  }
}
