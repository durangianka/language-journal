# Jev language gate live results

Run: 2026-11-12T11:46:15.408Z. Database: journal_test only. Target language per input.
Credentials loaded by dotenv without inspecting or printing .env contents.
Six calls through the existing Jev client, timeout, reservation and call log. No feedback model imported or invoked.
Request shape unchanged: POST /v1/systemone with { model, state, questions }; choice criteria is an object.

Input (es): Ayer fui al mercado y compré fruta fresca para preparar la cena.
Expected: standard_language. Allowed: true.
Answer: {"severity":{"type":"score","score":0.02,"legend":{"0":"minor","1":"moderate","2":"major"},"confidence":0.96,"probabilities":{"0":0.98,"1":0.01,"2":0.01}},"text_kind":{"type":"choice","choice":"standard_language","confidence":1,"probabilities":{"mixed":0,"random":0,"encoded":0,"other_language":0,"informal_language":0,"standard_language":1,"formula_or_numbers":0}},"main_issue":{"type":"choice","choice":"none","confidence":0.86,"probabilities":{"none":0.89,"style":0.03,"grammar":0.01,"spelling":0.05,"vocabulary":0.02}}}
Duration: 223 ms.

Input (it): Oggi resto a casa xké sono stanco e voglio riposare.
Expected: informal_language. Allowed: true.
Answer: {"severity":{"type":"score","score":0.19,"legend":{"0":"minor","1":"moderate","2":"major"},"confidence":0.7,"probabilities":{"0":0.82,"1":0.16,"2":0.02}},"text_kind":{"type":"choice","choice":"informal_language","confidence":1,"probabilities":{"mixed":0,"random":0,"encoded":0,"other_language":0,"informal_language":1,"standard_language":0,"formula_or_numbers":0}},"main_issue":{"type":"choice","choice":"spelling","confidence":0.31,"probabilities":{"none":0.34,"style":0.1,"grammar":0.09,"spelling":0.45,"vocabulary":0.02}}}
Duration: 133 ms.

Input (en): tbh I really enjoyed the lesson today and want to learn more.
Expected: informal_language. Allowed: true.
Answer: {"severity":{"type":"score","score":0.02,"legend":{"0":"minor","1":"moderate","2":"major"},"confidence":0.97,"probabilities":{"0":0.98,"1":0.02,"2":0}},"text_kind":{"type":"choice","choice":"informal_language","confidence":1,"probabilities":{"mixed":0,"random":0,"encoded":0,"other_language":0,"informal_language":1,"standard_language":0,"formula_or_numbers":0}},"main_issue":{"type":"choice","choice":"none","confidence":0.66,"probabilities":{"none":0.73,"style":0.24,"grammar":0.01,"spelling":0.01,"vocabulary":0.01}}}
Duration: 166 ms.

Input (en): Today I studied that A equals 2 plus B equals 75.
Expected: mixed. Allowed: true.
Answer: {"severity":{"type":"score","score":0.93,"legend":{"0":"minor","1":"moderate","2":"major"},"confidence":0.2,"probabilities":{"0":0.3,"1":0.47,"2":0.23}},"text_kind":{"type":"choice","choice":"mixed","confidence":1,"probabilities":{"mixed":1,"random":0,"encoded":0,"other_language":0,"informal_language":0,"standard_language":0,"formula_or_numbers":0}},"main_issue":{"type":"choice","choice":"grammar","confidence":0.51,"probabilities":{"none":0.03,"style":0.34,"grammar":0.61,"spelling":0,"vocabulary":0.02}}}
Duration: 141 ms.

Input (es): 0x4F 0x2A 0xFF
Expected: encoded. Allowed: false.
Answer: {"severity":{"type":"score","score":1.4,"legend":{"0":"minor","1":"moderate","2":"major"},"confidence":0.1,"probabilities":{"0":0.29,"1":0.02,"2":0.69}},"text_kind":{"type":"choice","choice":"encoded","confidence":0.98,"probabilities":{"mixed":0,"random":0.01,"encoded":0.98,"other_language":0,"informal_language":0,"standard_language":0,"formula_or_numbers":0.01}},"main_issue":{"type":"choice","choice":"none","confidence":0.94,"probabilities":{"none":0.95,"style":0.01,"grammar":0,"spelling":0,"vocabulary":0.04}}}
Duration: 130 ms.

Input (es): asdf qwer zxcv
Expected: random. Allowed: false.
Answer: {"severity":{"type":"score","score":1.74,"legend":{"0":"minor","1":"moderate","2":"major"},"confidence":0.61,"probabilities":{"0":0.12,"1":0.02,"2":0.86}},"text_kind":{"type":"choice","choice":"random","confidence":0.99,"probabilities":{"mixed":0,"random":0.99,"encoded":0,"other_language":0.01,"informal_language":0,"standard_language":0,"formula_or_numbers":0}},"main_issue":{"type":"choice","choice":"none","confidence":0.6,"probabilities":{"none":0.68,"style":0.04,"grammar":0.01,"spelling":0.13,"vocabulary":0.14}}}
Duration: 157 ms.

Matching classifications and gate outcomes: 6/6. Model call rows before: 0; after: 0.
