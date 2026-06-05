// /api/pronos.js
// Génère une ANALYSE d'avant-match via Claude (ta clé Anthropic reste côté serveur).
// Cache mémoire simple par match pour éviter de payer plusieurs fois la même analyse.
// IMPORTANT : le prompt interdit toute promesse de gain (protection juridique).

const cache = new Map();

const LANGS = {
  fr: "français",
  en: "English",
  es: "español",
  pt: "português",
  ar: "Arabic (العربية)",
  de: "Deutsch",
  it: "italiano",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Méthode non autorisée." });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ ok: false, error: "Variable ANTHROPIC_API_KEY manquante sur Vercel." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { id, home, away, league, date, lang } = body || {};
  if (!home || !away) {
    return res.status(400).json({ ok: false, error: "Données du match incomplètes." });
  }

  const langName = LANGS[lang] || LANGS.fr;
  const cacheKey = `${lang || "fr"}:${id || `${home}-${away}-${date}`}`;
  if (cache.has(cacheKey)) {
    return res.status(200).json({ ok: true, cached: true, prono: cache.get(cacheKey) });
  }

  const system = [
    "Tu es analyste football pour un média de pronostics.",
    `Rédige TOUTE ta réponse en ${langName}.`,
    "Tu produis une ANALYSE éditoriale d'avant-match, factuelle et nuancée.",
    "",
    "RÈGLES STRICTES (obligation juridique, à respecter absolument) :",
    "- Ne JAMAIS garantir un gain.",
    "- Ne JAMAIS affirmer ou suggérer que suivre l'analyse augmente les chances de gagner.",
    "- Ne JAMAIS écrire « pari sûr », « gain assuré », « coup sûr », « banco » ou équivalent.",
    "- Rester sur le registre de l'analyse sportive et de la probabilité, jamais de la promesse.",
    "",
    "FORMAT (environ 110 mots) :",
    "1) 2 à 3 phrases d'analyse (forme récente, contexte, enjeux, joueurs clés si pertinent).",
    "2) Une ligne exprimant une orientation prudente (ex : double chance, tendance sur le nombre",
    "   de buts), introduite par l'équivalent de « Tendance : » dans la langue de sortie,",
    "   formulée comme une opinion d'analyste.",
    "3) Termine par une phrase, rédigée dans la langue de sortie, signifiant exactement :",
    "   « Analyse à titre informatif. 18+. Les paris comportent des risques. »",
  ].join("\n");

  const user =
`Match à analyser :
- Équipe à domicile : ${home}
- Équipe à l'extérieur : ${away}
- Compétition : ${league || "non précisée"}
- Date : ${date || "à venir"}

Rédige l'analyse en respectant strictement le format et les règles ci-dessus.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", // modèle économique, suffisant pour des analyses courtes
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    const data = await r.json();
    if (data.error) {
      return res.status(502).json({ ok: false, error: data.error.message || "Erreur Anthropic." });
    }
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    cache.set(cacheKey, text);
    return res.status(200).json({ ok: true, prono: text });
  } catch (e) {
    return res.status(502).json({ ok: false, error: "Erreur lors de la génération de l'analyse.", detail: String(e) });
  }
}
