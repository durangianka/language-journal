# Jev language gate live results

Run: 2026-11-12T11:49:59.487Z. Database: journal_test only. Target language per input.
Credentials loaded by dotenv without inspecting or printing .env contents.
Six calls through the existing Jev client, timeout, reservation and call log. No feedback model imported or invoked.
Request shape unchanged: POST /v1/systemone with { model, state, questions }; choice criteria is an object.
Shorthand examples use only verified items from origin/research/shorthand:out/report.md. Register by level is app policy inferred from the research, not a CEFR rule.

Input (es): Ayer fui al mercado y compré fruta fresca para preparar la cena.
Expected: standard_language. Allowed: true.
Answer: {"severity":{"type":"score","score":0.01,"legend":{"0":"minor","1":"moderate","2":"major"},"confidence":0.98,"probabilities":{"0":0.99,"1":0.01,"2":0}},"text_kind":{"type":"choice","choice":"standard_language","confidence":1,"probabilities":{"mixed":0,"random":0,"encoded":0,"other_language":0,"informal_language":0,"standard_language":1,"formula_or_numbers":0}},"main_issue":{"type":"choice","choice":"none","confidence":0.86,"probabilities":{"none":0.89,"style":0.04,"grammar":0.01,"spelling":0.04,"vocabulary":0.02}}}
Duration: 202 ms.

Input (it): Oggi resto a casa xké sono stanco e voglio riposare.
Expected: informal_language. Allowed: true.
Answer: {"severity":{"type":"score","score":0.19,"legend":{"0":"minor","1":"moderate","2":"major"},"confidence":0.7,"probabilities":{"0":0.82,"1":0.16,"2":0.02}},"text_kind":{"type":"choice","choice":"informal_language","confidence":1,"probabilities":{"mixed":0,"random":0,"encoded":0,"other_language":0,"informal_language":1,"standard_language":0,"formula_or_numbers":0}},"main_issue":{"type":"choice","choice":"spelling","confidence":0.31,"probabilities":{"none":0.3,"style":0.14,"grammar":0.09,"spelling":0.45,"vocabulary":0.02}}}
Duration: 163 ms.

Input (en): tbh I really enjoyed the lesson today and want to learn more.
Expected: informal_language. Allowed: true.
Answer: {"severity":{"type":"score","score":0.03,"legend":{"0":"minor","1":"moderate","2":"major"},"confidence":0.97,"probabilities":{"0":0.98,"1":0.02,"2":0}},"text_kind":{"type":"choice","choice":"informal_language","confidence":1,"probabilities":{"mixed":0,"random":0,"encoded":0,"other_language":0,"informal_language":1,"standard_language":0,"formula_or_numbers":0}},"main_issue":{"type":"choice","choice":"none","confidence":0.61,"probabilities":{"none":0.69,"style":0.27,"grammar":0.01,"spelling":0.02,"vocabulary":0.01}}}
Duration: 154 ms.

Input (en): Today I studied that A equals 2 plus B equals 75.
Expected: mixed. Allowed: true.
Answer: {"severity":{"type":"score","score":0.9,"legend":{"0":"minor","1":"moderate","2":"major"},"confidence":0.22,"probabilities":{"0":0.31,"1":0.48,"2":0.21}},"text_kind":{"type":"choice","choice":"mixed","confidence":1,"probabilities":{"mixed":1,"random":0,"encoded":0,"other_language":0,"informal_language":0,"standard_language":0,"formula_or_numbers":0}},"main_issue":{"type":"choice","choice":"grammar","confidence":0.52,"probabilities":{"none":0.03,"style":0.33,"grammar":0.62,"spelling":0,"vocabulary":0.02}}}
Duration: 137 ms.

Input (es): 0x4F 0x2A 0xFF
Expected: encoded. Allowed: false.
Answer: {"severity":{"type":"score","score":1.36,"legend":{"0":"minor","1":"moderate","2":"major"},"confidence":0.04,"probabilities":{"0":0.31,"1":0.02,"2":0.67}},"text_kind":{"type":"choice","choice":"encoded","confidence":0.98,"probabilities":{"mixed":0,"random":0.01,"encoded":0.98,"other_language":0,"informal_language":0,"standard_language":0,"formula_or_numbers":0.01}},"main_issue":{"type":"choice","choice":"none","confidence":0.95,"probabilities":{"none":0.96,"style":0.01,"grammar":0,"spelling":0,"vocabulary":0.03}}}
Duration: 144 ms.

Input (es): asdf qwer zxcv
Expected: random. Allowed: false.
Answer: {"severity":{"type":"score","score":1.72,"legend":{"0":"minor","1":"moderate","2":"major"},"confidence":0.58,"probabilities":{"0":0.13,"1":0.02,"2":0.85}},"text_kind":{"type":"choice","choice":"random","confidence":0.99,"probabilities":{"mixed":0,"random":0.99,"encoded":0,"other_language":0,"informal_language":0.01,"standard_language":0,"formula_or_numbers":0}},"main_issue":{"type":"choice","choice":"none","confidence":0.56,"probabilities":{"none":0.65,"style":0.05,"grammar":0.01,"spelling":0.12,"vocabulary":0.17}}}
Duration: 133 ms.

Matching classifications and gate outcomes: 6/6. Model call rows before: 0; after: 0.
