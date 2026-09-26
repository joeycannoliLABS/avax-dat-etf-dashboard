// app/api/intl-etps/route.js
// International (non-US) Avalanche ETPs / ETNs.
//
// WHAT IS ACTUALLY AUTOMATIC HERE:
//   - Virtune publishes AVAX in custody via Chainlink Proof of Reserve, so that
//     figure is fetched live when the feed responds.
//   - Everything else: issuers do not publish AVAX token counts. We store AUM
//     and derive token counts client-side as AUM / live AVAX price, so the
//     numbers stay current as price moves without a manual edit.
//   - EUR-denominated AUM is converted using a live FX rate.
//
// Each product carries `holdingsSource` so the UI can label published figures
// separately from derived estimates. Never present a derived number as reported.

export const revalidate = 3600;

// Manually maintained baseline. Update AUM here on the weekly refresh.
const PRODUCTS = [
  {
    id: '21shares-avax',
    name: '21Shares Avalanche Staking ETP',
    ticker: 'AVAX',
    sponsor: '21Shares',
    isin: 'CH1135202088',
    exchange: 'SIX / Xetra / Euronext',
    domicile: 'Switzerland',
    inception: '2021-11-18',
    aum: 21400000,
    aumCurrency: 'USD',
    fee: 2.50,
    staking: true,
    stakingPct: null,        // stakes, but ratio is not disclosed
    navPerShare: null,
    status: 'Live',
    holdingsSource: 'derived',
    avaxHoldings: null,
    asOf: '2026-09-25',
    url: 'https://www.21shares.com/en-eu/product/avax',
  },
  {
    id: 'vaneck-vava',
    name: 'VanEck Avalanche ETN',
    ticker: 'VAVA',
    sponsor: 'VanEck',
    isin: 'DE000A3GV1T7',
    exchange: 'Xetra / Euronext',
    domicile: 'Liechtenstein',
    inception: '2021-12-08',
    aum: 11250000,           // EUR, per exchange data
    aumCurrency: 'EUR',
    fee: 1.50,
    staking: false,
    stakingPct: 0,
    navPerShare: 1.41,       // EUR; 11.25M AUM / 7.98M shares outstanding
    navCurrency: 'EUR',
    sharesOutstanding: 7980000,
    status: 'Live',
    holdingsSource: 'derived',
    avaxHoldings: null,
    asOf: '2026-09-01',
    url: 'https://www.vaneck.com/lu/en/investments/avalanche-etp/',
  },
  {
    id: 'virtune-viravax',
    name: 'Virtune Avalanche ETP',
    ticker: 'VIRAVAX',
    sponsor: 'Virtune',
    isin: 'SE0022050092',
    exchange: 'Nasdaq Stockholm / Helsinki',
    domicile: 'Sweden',
    inception: '2024-07-04',
    stakingPct: 0,
    navPerShare: null,
    status: 'Live',
    aum: 2070000,
    aumCurrency: 'USD',
    fee: 1.49,
    staking: false,
    holdingsSource: 'published',   // Chainlink Proof of Reserve
    avaxHoldings: 201310,
    backing: 100.29,
    asOf: '2026-09-25',
    url: 'https://www.virtune.com/en/product/avalanche',
  },
  {
    id: 'valour-avax',
    name: 'Valour Avalanche',
    ticker: 'VALOUR-AVAX',
    sponsor: 'Valour / DeFi Technologies',
    isin: 'CH1114178788',
    exchange: 'Nordic Growth Market',
    domicile: 'Switzerland',
    inception: '2021-09-01',
    stakingPct: 0,
    navPerShare: null,
    status: 'Live',
    aum: 86000,
    aumCurrency: 'USD',
    fee: 1.90,
    staking: false,
    holdingsSource: 'derived',
    avaxHoldings: null,
    asOf: '2026-09-25',
    url: 'https://valour.com/en/products/valour-avalanche-avax',
  },
];

// --- live lookups (each isolated; one failure never sinks the response) ---

async function getEurUsd() {
  try {
    const r = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD', {
      next: { revalidate: 3600 },
    });
    if (!r.ok) throw new Error('fx ' + r.status);
    const d = await r.json();
    const rate = d && d.rates && d.rates.USD;
    return typeof rate === 'number' && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

async function getVirtuneReserve() {
  // Chainlink Proof of Reserve feed for the Virtune Avalanche ETP.
  // Returns null if the feed is unavailable or not yet live for this product,
  // in which case the last published figure above is used.
  try {
    const r = await fetch(
      'https://api.virtune.com/v1/products/avalanche/reserves',
      { next: { revalidate: 3600 } }
    );
    if (!r.ok) throw new Error('virtune ' + r.status);
    const d = await r.json();
    const held = d && (d.reserveAmount ?? d.holdings ?? d.avax);
    const backing = d && (d.backingPercent ?? d.backing);
    if (typeof held !== 'number' || held <= 0) return null;
    return { avaxHoldings: held, backing: typeof backing === 'number' ? backing : null };
  } catch {
    return null;
  }
}

export async function GET() {
  const notes = [];

  const [eurUsd, virtune] = await Promise.all([getEurUsd(), getVirtuneReserve()]);

  const FX_FALLBACK = 1.08;
  const fxRate = eurUsd || FX_FALLBACK;
  if (!eurUsd) notes.push('FX unavailable; EUR converted at fallback ' + FX_FALLBACK);

  const products = PRODUCTS.map((p) => {
    const out = { ...p };

    // normalize AUM to USD
    out.aumUsd = p.aumCurrency === 'EUR' ? Math.round(p.aum * fxRate) : p.aum;
    out.fxRate = p.aumCurrency === 'EUR' ? fxRate : null;

    // Virtune: prefer the live on-chain reserve figure
    if (p.id === 'virtune-viravax' && virtune) {
      out.avaxHoldings = Math.round(virtune.avaxHoldings);
      if (virtune.backing != null) out.backing = virtune.backing;
      out.holdingsSource = 'published';
      out.asOf = new Date().toISOString().slice(0, 10);
    }

    return out;
  });

  if (!virtune) notes.push('Virtune reserve feed unavailable; using last published figure');

  return Response.json(
    {
      products,
      eurUsd: fxRate,
      eurUsdLive: !!eurUsd,
      lastUpdated: new Date().toISOString(),
      notes,
      // Derived holdings are computed client-side against the live AVAX price
      // so they track price without a server round-trip.
      derivedNote: 'Products with holdingsSource "derived" have no published token count; holdings are estimated as AUM / AVAX price.',
    },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } }
  );
}
