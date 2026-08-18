// api/lists.js — Vercel Serverless Function
// Liefert fünf Runden für List Duell: Frage, korrekte Top 5 und fünf Ablenker.
// Der API-Key bleibt auf dem Server (Environment Variable ANTHROPIC_API_KEY).

const THEMEN = [
  "Geografie", "Deutschland", "Natur & Tiere", "Weltraum", "Wissenschaft", "Technik",
  "Geschichte", "Sport", "Musik", "Film & Fernsehen", "Essen & Trinken", "Wirtschaft",
  "Sprache & Literatur", "Bauwerke", "Alltag"
];

const STUFEN = {
  1: {
    name: "leicht",
    regel: "Allgemeinwissen, das praktisch jeder hat. Die Abstände zwischen den Plätzen sind groß, die Ablenker liegen offensichtlich außerhalb der Top 5.",
    beispiel: "Die einwohnerreichsten Städte Deutschlands"
  },
  2: {
    name: "normal",
    regel: "Solides Allgemeinwissen. Die richtigen fünf sind bekannt, ihre Reihenfolge aber nicht selbstverständlich.",
    beispiel: "Die größten Seen Deutschlands"
  },
  3: {
    name: "schwer",
    regel: "Man muss genauer Bescheid wissen. Die Ablenker sind knapp außerhalb der Top 5 und wirken plausibel.",
    beispiel: "Die höchsten Berge der Alpen"
  },
  4: {
    name: "brutal",
    regel: "Spezialwissen mit engen Abständen. Auch Kenner werden zwei Plätze vertauschen. Die Ablenker liegen dicht hinter Platz fünf.",
    beispiel: "Die auflagenstärksten Tageszeitungen Europas"
  }
};

const norm = s => String(s || "").toLowerCase().trim();

function baueAufgabe(count, thema, stufe, avoid) {
  const s = STUFEN[stufe] || STUFEN[2];
  const sperre = avoid.length
    ? `\n\nDiese Fragen wurden zuletzt schon gestellt und dürfen NICHT wieder vorkommen — auch keine Umformulierungen davon:\n- ${avoid.join("\n- ")}`
    : "";

  return `Erstelle ${count} Fragen für ein Quiz, bei dem zwei Spieler die richtige Reihenfolge einer Top-5-Liste herstellen müssen.

Themenvorgabe: ${thema}
Halte dich an diese Vorgabe. Ist sie eng gefasst, bleib streng dabei; ist sie weit, streue die Fragen darin.
Schwierigkeit: ${s.name}. ${s.regel}
Ein Beispiel für diese Stufe: „${s.beispiel}“

Für jede Frage brauchst du:
- "q": die Frage nach einer Rangfolge, auf Deutsch, ohne die Zahl 5 zu erwähnen. Zum Beispiel: „Die einwohnerreichsten Städte Deutschlands“.
- "unit": wonach sortiert wird, zwei bis fünf Wörter. Zum Beispiel „Einwohner“ oder „Höhe über dem Meer“.
- "top": genau fünf Einträge in der KORREKTEN Reihenfolge, Platz 1 zuerst.
- "decoys": genau fünf plausible Einträge, die sicher NICHT in die Top 5 gehören.
- "values": zu JEDEM der zehn Einträge der Zahlenwert, nach dem sortiert wird — auch zu den Ablenkern. Schlüssel ist der Eintrag, exakt so geschrieben wie in "top" bzw. "decoys".
- "note": ein kurzer deutscher Satz mit dem entscheidenden Detail. Keine bloße Wiederholung der Zahlen.

Zu den Zahlenwerten:
- Deutsche Schreibweise: Punkt als Tausendertrenner, Komma als Dezimalzeichen. Also „8.849 m“, „3,88 Mio.“, „17,4 %“.
- Kurz halten, mit Einheit, höchstens zwölf Zeichen. Große Zahlen runden: „1,43 Mrd.“ statt „1.428.627.663“.
- Alle zehn Werte in derselben Einheit und derselben Größenordnung, damit sie vergleichbar sind.
- Die Werte müssen die Reihenfolge in "top" tatsächlich belegen und für die Ablenker klar außerhalb liegen.

Unbedingt beachten:
- Die Reihenfolge muss objektiv feststehen und gut belegt sein. Keine Geschmacksfragen, keine Umfragen, keine "beliebtesten" oder "besten".
- Nimm nur Ranglisten, die sich nicht ständig ändern. Keine aktuellen Tabellen, Börsenkurse, Charts oder Bestenlisten der laufenden Saison.
- Wenn du dir bei einem Platz nicht sicher bist, nimm eine andere Frage. Lieber eine bekanntere Liste als eine falsche.
- Die Ablenker müssen zur selben Art Sache gehören wie die richtigen Einträge, aber eindeutig hinter Platz fünf liegen.
- Alle zehn Einträge einer Runde sind verschieden. Kurze Namen, keine Erklärungen in Klammern.
- Die ${count} Fragen unterscheiden sich deutlich voneinander.${sperre}

Antworte ausschließlich mit JSON, ohne Markdown, ohne Erklärung:
{"rounds":[{"q":"...","unit":"...","top":["...","...","...","...","..."],"decoys":["...","...","...","...","..."],"values":{"Eintrag":"Wert"},"note":"..."}]}`;
}

function pruefe(r) {
  if (!r || typeof r.q !== "string" || !r.q.trim()) return null;
  const top = (r.top || []).map(x => String(x).trim()).filter(Boolean);
  const decoys = (r.decoys || []).map(x => String(x).trim()).filter(Boolean);
  if (top.length !== 5 || decoys.length !== 5) return null;
  const alle = [...top, ...decoys].map(norm);
  if (new Set(alle).size !== 10) return null;

  // Zahlenwerte einsammeln. Fehlt einer, bleibt das Feld leer — deswegen
  // ist die Runde nicht unbrauchbar, sie zeigt dann nur einen Strich.
  const roh = (r.values && typeof r.values === "object") ? r.values : {};
  const suche = new Map(Object.keys(roh).map(k => [norm(k), roh[k]]));
  const values = {};
  for (const name of [...top, ...decoys]) {
    const v = suche.get(norm(name));
    if (v != null && String(v).trim()) values[name] = String(v).trim().slice(0, 24);
  }

  return {
    q: r.q.trim(),
    unit: String(r.unit || "").trim(),
    top,
    decoys,
    values,
    note: String(r.note || "").trim()
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Nur POST." });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY ist nicht gesetzt." });
  }

  const body = req.body || {};
  const count = Math.min(12, Math.max(1, Number(body.count) || 5));
  const stufe = [1, 2, 3, 4].includes(Number(body.difficulty)) ? Number(body.difficulty) : 2;
  const wunsch = typeof body.category === "string" && body.category.trim() ? body.category.trim() : null;
  // Freie Themenvorgabe aus dem Adminfenster. Sie sticht den Bereich aus.
  const topic = typeof body.topic === "string" && body.topic.trim()
    ? body.topic.trim().slice(0, 400) : null;
  const avoid = (Array.isArray(body.avoid) ? body.avoid : []).map(String).filter(Boolean).slice(-200);
  const blocked = new Set(avoid.map(norm));

  // Ohne Vorgabe ein paar Bereiche auslosen, damit die Fragen auseinanderliegen.
  const thema = topic
    || wunsch
    || ("gemischt — verteile die Fragen auf verschiedene Bereiche wie " +
        [...THEMEN].sort(() => Math.random() - 0.5).slice(0, 5).join(", "));

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        // Für die Richtigkeit der Listen lohnt sich das stärkere Modell.
        model: "claude-sonnet-4-6",
        max_tokens: Math.min(16000, 700 * (count + 2) + 800),
        temperature: 1,
        messages: [{ role: "user", content: baueAufgabe(count + 2, thema, stufe, avoid) }]
      })
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: "Anthropic API: " + r.status, detail });
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    const parsed = JSON.parse(text);
    const rounds = (parsed.rounds || [])
      .map(pruefe)
      .filter(Boolean)
      .filter(x => !blocked.has(norm(x.q)));

    if (!rounds.length) throw new Error("Keine brauchbare Runde erhalten.");

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      rounds: rounds.slice(0, count),
      category: wunsch,
      topic,
      difficulty: stufe
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
