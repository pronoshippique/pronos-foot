// /api/matches.js
// Récupère les matchs depuis API-Football SANS exposer ta clé (elle reste côté serveur).
// Le cache CDN (Cache-Control s-maxage) fait que l'API n'est appelée qu'une fois toutes les 3h
// quel que soit le nombre de visiteurs -> tu restes largement dans le plan gratuit (100 req/jour).

const COMPETITIONS = {
  wc:     { league: 1,   season: 2026 }, // Coupe du Monde 2026
  l1:     { league: 61 },                // Ligue 1
  pl:     { league: 39 },                // Premier League
  liga:   { league: 140 },               // La Liga
  seriea: { league: 135 },               // Serie A
  bundes: { league: 78 },                // Bundesliga
};

export default async function handler(req, res) {
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) {
    return res.status(500).json({ ok: false, error: "Variable APIFOOTBALL_KEY manquante sur Vercel." });
  }

  const comp = String(req.query.comp || "wc");
  const conf = COMPETITIONS[comp] || COMPETITIONS.wc;

  const params = new URLSearchParams();
  params.set("league", String(conf.league));
  if (conf.season) {
    params.set("season", String(conf.season)); // Coupe du Monde : tous les matchs
  } else {
    params.set("next", "20"); // Championnats : les 20 prochains matchs
  }

  try {
    const r = await fetch(`https://v3.football.api-sports.io/fixtures?${params.toString()}`, {
      headers: { "x-apisports-key": key },
    });
    const data = await r.json();
    const fixtures = Array.isArray(data.response) ? data.response : [];

    // Cache CDN : 3h de cache + service en arrière-plan pendant 24h
    res.setHeader("Cache-Control", "s-maxage=10800, stale-while-revalidate=86400");
    return res.status(200).json({ ok: true, comp, count: fixtures.length, fixtures });
  } catch (e) {
    return res.status(502).json({ ok: false, error: "Impossible de récupérer les matchs.", detail: String(e) });
  }
}
