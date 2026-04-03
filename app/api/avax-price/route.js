export async function GET() {
  try {
    var res = await fetch(
      "https://api.coingecko.com/api/v3/coins/avalanche-2?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false",
      {
        headers: {
          "Accept": "application/json"
        },
        next: { revalidate: 60 }
      }
    );

    if (!res.ok) {
      throw new Error("CoinGecko returned " + res.status);
    }

    var data = await res.json();
    var md = data.market_data;

    return Response.json({
      price: md.current_price.usd,
      priceChange: md.price_change_percentage_24h,
      marketCap: md.market_cap.usd,
      volume24h: md.total_volume.usd,
      circulatingSupply: md.circulating_supply,
      updatedAt: new Date().toISOString()
    });

  } catch (err) {
    return Response.json({
      price: null,
      error: err.message
    }, { status: 500 });
  }
}
