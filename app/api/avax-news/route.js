export async function GET() {
  var allArticles = [];

  // Search multiple queries via Google News RSS feeds (free, no API key needed)
  var queries = [
    "AVAX+One+treasury",
    "Avalanche+Treasury+AVAT",
    "Avalanche+AVAX+ETF",
    "AVAX+digital+asset+treasury"
  ];

  for (var q = 0; q < queries.length; q++) {
    try {
      var url = "https://news.google.com/rss/search?q=" + queries[q] + "+when:30d&hl=en-US&gl=US&ceid=US:en";
      var res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AvaxDashboard/1.0)"
        },
        next: { revalidate: 43200 }
      });
      if (res.ok) {
        var xml = await res.text();
        var items = parseRSS(xml);
        allArticles = allArticles.concat(items);
      }
    } catch (err) {
      console.error("News fetch error:", err.message);
    }
  }

  // Deduplicate by title similarity
  var seen = {};
  var unique = [];
  allArticles.forEach(function(a) {
    var key = a.title.toLowerCase().substring(0, 60);
    if (!seen[key]) {
      seen[key] = true;
      unique.push(a);
    }
  });

  // Sort by date descending
  unique.sort(function(a, b) {
    return new Date(b.rawDate || 0) - new Date(a.rawDate || 0);
  });

  return Response.json({
    articles: unique.slice(0, 10),
    updatedAt: new Date().toISOString()
  });
}

function parseRSS(xml) {
  var items = [];
  var regex = /<item>([\s\S]*?)<\/item>/g;
  var match;
  while ((match = regex.exec(xml)) !== null) {
    var block = match[1];
    var title = extractTag(block, "title");
    var link = extractTag(block, "link");
    var pubDate = extractTag(block, "pubDate");
    var source = extractTag(block, "source");

    if (title && link) {
      // Clean up Google News redirect URLs
      var cleanUrl = link;
      if (link.includes("news.google.com")) {
        // Keep as-is, it will redirect
        cleanUrl = link;
      }

      var dateObj = pubDate ? new Date(pubDate) : null;
      var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      var dateStr = "";
      if (dateObj && !isNaN(dateObj)) {
        dateStr = months[dateObj.getMonth()] + " " + dateObj.getDate() + ", " + dateObj.getFullYear();
      }

      items.push({
        title: cleanTitle(title),
        url: cleanUrl,
        source: source || "",
        date: dateStr,
        rawDate: pubDate || ""
      });
    }
  }
  return items;
}

function extractTag(xml, tag) {
  var regex = new RegExp("<" + tag + "[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/" + tag + ">");
  var match = xml.match(regex);
  if (match) return match[1].trim();
  return "";
}

function cleanTitle(title) {
  // Remove source suffix like " - CoinDesk"
  return title.replace(/\s*[-\u2013\u2014|]\s*[A-Za-z\s.]+$/, "").trim() || title;
}
