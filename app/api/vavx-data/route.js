// app/api/vavx-data/route.js
// Fetches live VAVX ETF data from Yahoo Finance quoteSummary API
// Returns: NAV, price, AUM (net assets), shares outstanding, AVAX holdings estimate

export const revalidate = 300; // cache for 5 minutes

const YAHOO_BASE = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary/VAVX';
const MODULES = 'price,summaryDetail,defaultKeyStatistics';

export async function GET() {
  try {
    const res = await fetch(`${YAHOO_BASE}?modules=${MODULES}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance responded with ${res.status}`);
    }

    const data = await res.json();
    const result = data?.quoteSummary?.result?.[0];

    if (!result) {
      throw new Error('No data returned for VAVX');
    }

    const price = result.price || {};
    const summary = result.summaryDetail || {};
    const keyStats = result.defaultKeyStatistics || {};

    // Extract raw values (Yahoo wraps numbers in {raw, fmt} objects)
    const r = (obj) => obj?.raw ?? obj ?? null;
    const f = (obj) => obj?.fmt ?? null;

    // Market price
    const marketPrice = r(price.regularMarketPrice);

    // NAV per share (Yahoo reports this for ETFs)
    const navPrice = r(summary.navPrice) ?? r(price.regularMarketPrice);

    // Net assets = total AUM
    const totalAssets = r(summary.totalAssets) ?? r(keyStats.totalAssets);
    const totalAssetsFmt = f(summary.totalAssets) ?? f(keyStats.totalAssets);

    // Shares outstanding
    const sharesOutstanding = r(keyStats.sharesOutstanding) ?? r(price.sharesOutstanding);

    // Calculate estimated AVAX holdings
    // VAVX is a spot AVAX ETF, so AUM / AVAX price ≈ AVAX held
    // We'll also fetch AVAX price from CoinGecko for the calculation
    let avaxPrice = null;
    let avaxHoldings = null;
    try {
      const avaxRes = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2&vs_currencies=usd',
        { next: { revalidate: 60 } }
      );
      const avaxData = await avaxRes.json();
      avaxPrice = avaxData?.['avalanche-2']?.usd ?? null;

      if (totalAssets && avaxPrice) {
        avaxHoldings = Math.round(totalAssets / avaxPrice);
      }
    } catch (e) {
      console.error('Failed to fetch AVAX price for holdings calc:', e);
    }

    // Fee waiver logic
    const now = new Date();
    const waiverEnd = new Date('2026-02-28');
    const feeWaiverActive = now < waiverEnd;

    const response = {
      ticker: 'VAVX',
      name: 'VanEck Avalanche ETF',
      exchange: 'NASDAQ',
      marketPrice,
      navPrice,
      totalAssets,
      totalAssetsFmt,
      sharesOutstanding,
      avaxPrice,
      avaxHoldings,
      fee: feeWaiverActive ? 0 : 0.20,
      feeAfterWaiver: 0.20,
      feeWaiverActive,
      feeWaiverEnd: '2026-02-28',
      stakingEnabled: true,
      status: 'Live',
      lastUpdated: new Date().toISOString(),
      source: 'Yahoo Finance / CoinGecko',
    };

    return Response.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('VAVX data fetch error:', error);

    // Return fallback data so the dashboard doesn't break
    return Response.json(
      {
        ticker: 'VAVX',
        name: 'VanEck Avalanche ETF',
        exchange: 'NASDAQ',
        marketPrice: null,
        navPrice: null,
        totalAssets: 3130000,
        totalAssetsFmt: '$3.13M',
        sharesOutstanding: null,
        avaxPrice: null,
        avaxHoldings: null,
        fee: 0,
        feeAfterWaiver: 0.20,
        feeWaiverActive: true,
        feeWaiverEnd: '2026-02-28',
        stakingEnabled: true,
        status: 'Live',
        lastUpdated: new Date().toISOString(),
        source: 'fallback',
        error: error.message,
      },
      { status: 200 }
    );
  }
}
