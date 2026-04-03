export async function GET() {
  var results = {
    avaxOne: null,
    avat: null,
    deft: null,
    updatedAt: new Date().toISOString()
  };

  // Fetch AVAX One holdings from Blueprint dashboard (works!)
  try {
    var res = await fetch("https://analytics-avaxone.theblueprint.xyz/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AvaxDashboard/1.0)"
      },
      next: { revalidate: 3600 }
    });
    if (res.ok) {
      var html = await res.text();
      var match = html.match(/AVAX\s*Held[\s\S]*?([\d,.]+)\s*M\s*AVAX/i);
      if (match) {
        results.avaxOne = parseFloat(match[1].replace(/,/g, "")) * 1000000;
      }
      if (!results.avaxOne) {
        match = html.match(/([\d,.]+)\s*M\s*AVAX/i);
        if (match) {
          var num = parseFloat(match[1].replace(/,/g, ""));
          if (num > 1 && num < 100) {
            results.avaxOne = num * 1000000;
          }
        }
      }
    }
  } catch (err) {
    console.error("Blueprint fetch error:", err.message);
  }

  // AVAT and DEFT: DefiLlama DAT API requires Pro key ($300/mo)
  // These fall back to hardcoded values in page.js
  // To enable live data, add your DefiLlama Pro API key below:
  var DEFILLAMA_API_KEY = process.env.DEFILLAMA_API_KEY || null;

  if (DEFILLAMA_API_KEY) {
    try {
      var res2 = await fetch(
        "https://pro-api.llama.fi/" + DEFILLAMA_API_KEY + "/dat/institutions",
        { next: { revalidate: 3600 } }
      );
      if (res2.ok) {
        var data = await res2.json();
        if (data && data.assets && data.assets.avalanche) {
          data.assets.avalanche.forEach(function(inst) {
            if (inst.institutionId) {
              // Map institutions to our companies
              // You may need to adjust these IDs after checking the API response
              results.avatOrDeft = inst;
            }
          });
        }
      }
    } catch (err) {
      console.error("DefiLlama DAT API error:", err.message);
    }
  }

  return Response.json(results);
}
