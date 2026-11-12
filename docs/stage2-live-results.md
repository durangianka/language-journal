# Stage 2 live results

Run: 2026-11-12T09:19:22.454Z. Database: journal_test only.
Credentials were loaded by dotenv without printing or inspecting .env contents.

Jev: POST https://api.typesafe.ai/v1/systemone, Bearer authentication, model jev-latest.
Request: { model, state, questions }; choice criteria is an object; score criteria is an array.
Docs checked: https://jev-ai.org/docs/ and https://api.typesafe.ai/redoc (OpenAPI schema and authenticated GET /v1/models).
The docs demonstrate support routing, not a journal example. Instructions follow the example question wording, adapted to language issues.

## Jev

Entry (en): Yesterday I went to the market and bought fresh fruit for dinner.
Answer: {"severity":{"type":"score","score":0.02,"legend":{"0":"minor","1":"moderate","2":"major"},"confidence":0.98,"probabilities":{"0":0.99,"1":0.01,"2":0}},"main_issue":{"type":"choice","choice":"none","confidence":0.8,"probabilities":{"none":0.84,"style":0.1,"grammar":0.01,"spelling":0,"vocabulary":0.05}}}
Confidence: 0.8. Duration: 286 ms. UI note: null.

Entry (en): Yesterday I goed to the market and buyed fresh fruit for dinner.
Answer: {"severity":{"type":"score","score":0.72,"legend":{"0":"minor","1":"moderate","2":"major"},"confidence":0.34,"probabilities":{"0":0.36,"1":0.56,"2":0.08}},"main_issue":{"type":"choice","choice":"grammar","confidence":1,"probabilities":{"none":0,"style":0,"grammar":1,"spelling":0,"vocabulary":0}}}
Confidence: 1. Duration: 146 ms. UI note: {"issue":"grammar","confidence":1}.

Entry (es): Ayer fui al mercado y compré fruta fresca para preparar la cena.
Answer: {"severity":{"type":"score","score":0.01,"legend":{"0":"minor","1":"moderate","2":"major"},"confidence":0.98,"probabilities":{"0":0.99,"1":0.01,"2":0}},"main_issue":{"type":"choice","choice":"none","confidence":0.85,"probabilities":{"none":0.88,"style":0.05,"grammar":0.01,"spelling":0.03,"vocabulary":0.03}}}
Confidence: 0.85. Duration: 170 ms. UI note: {"issue":"none","confidence":0.85}.

Entry (es): Ayer yo ir al mercado y comprar frutas para mi familia.
Answer: {"severity":{"type":"score","score":0.87,"legend":{"0":"minor","1":"moderate","2":"major"},"confidence":0.3,"probabilities":{"0":0.3,"1":0.53,"2":0.17}},"main_issue":{"type":"choice","choice":"grammar","confidence":0.95,"probabilities":{"none":0.01,"style":0,"grammar":0.96,"spelling":0.01,"vocabulary":0.02}}}
Confidence: 0.95. Duration: 132 ms. UI note: {"issue":"grammar","confidence":0.95}.

Entry (it): Ieri sono andato al mercato e ho comprato della frutta fresca.
Answer: {"severity":{"type":"score","score":0.02,"legend":{"0":"minor","1":"moderate","2":"major"},"confidence":0.96,"probabilities":{"0":0.98,"1":0.01,"2":0.01}},"main_issue":{"type":"choice","choice":"none","confidence":0.91,"probabilities":{"none":0.93,"style":0.03,"grammar":0.01,"spelling":0.01,"vocabulary":0.02}}}
Confidence: 0.91. Duration: 135 ms. UI note: {"issue":"none","confidence":0.91}.

Entry (it): Ieri io andare al mercato e comprare della frutta fresca.
Answer: {"severity":{"type":"score","score":1.27,"legend":{"0":"minor","1":"moderate","2":"major"},"confidence":0.33,"probabilities":{"0":0.09,"1":0.55,"2":0.36}},"main_issue":{"type":"choice","choice":"grammar","confidence":1,"probabilities":{"none":0,"style":0,"grammar":1,"spelling":0,"vocabulary":0}}}
Confidence: 1. Duration: 150 ms. UI note: {"issue":"grammar","confidence":1}.

## LLM journal summaries

Model: gpt-6-luna. One call per test journal; three separate journals respect the daily per-journal limit.

Locale: en. Entries: ["I wants to practise writing every day.","Today I read a book and learned five new words.","Yesterday I goed to the shop."]
Output: You’re building a useful daily reading and vocabulary habit. Practise verb forms: write “I want” and “I went.” Next, write three sentences about your day and check each verb.
Model calls: 1. Outcome: ready. Input tokens: 92. Output tokens: 101.

Locale: es. Entries: ["I wants to practise writing every day.","Today I read a book and learned five new words.","Yesterday I goed to the shop."]
Output: Practicas la escritura y amplías tu vocabulario leyendo. Conviene repasar la concordancia verbal en presente y los verbos irregulares en pasado. Como siguiente paso, escribe tres frases usando ambos tiempos.
Model calls: 1. Outcome: ready. Input tokens: 92. Output tokens: 115.

Locale: it. Entries: ["I wants to practise writing every day.","Today I read a book and learned five new words.","Yesterday I goed to the shop."]
Output: Stai esercitando la scrittura quotidiana e ampliando il vocabolario; fai attenzione alla concordanza («I want») e al passato irregolare («went»). Come prossimo passo, prova a scrivere tre frasi usando verbi irregolari al passato.
Model calls: 1. Outcome: ready. Input tokens: 92. Output tokens: 157.

Observed successful Jev decisions: 6/6. Observed successful LLM summaries: 3/3.
