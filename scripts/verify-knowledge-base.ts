[verify-knowledge-base.ts#4D7F]
1:import assert from "node:assert/strict";
…
13:import type { KnowledgeBaseArticle } from "../src/lib/knowledge-base/publication-types";
14:
15:const AS_OF = new Date("2026-09-01T00:00:00.000Z");
16:const SOURCE = {
…
20:} as const;
21:
22-34:const BASE_ARTICLE: KnowledgeBaseArticle = { … };
35:
36:function article(
37:  overrides: Partial<KnowledgeBaseArticle> = {},
38:): KnowledgeBaseArticle {
39:  return { ...BASE_ARTICLE, ...overrides };
40:}
41:
42:const valid = validateKnowledgeBaseArticles([BASE_ARTICLE], { asOf: AS_OF });
43:assert.equal(valid.valid, true, valid.errors.join(" | "));
44:assert.deepEqual(valid.staleReport.staleArticles, []);
45:assert.equal(
46:  getKnowledgeBasePublicationDecision(BASE_ARTICLE, { asOf: AS_OF }).public,
47:  true,
48:);
49:const publicBaseArticle = findPublicKnowledgeBaseArticle(
50:  [BASE_ARTICLE],
51:  BASE_ARTICLE.slug,
52:  { asOf: AS_OF },
53:);
54:if (!publicBaseArticle)
55:  throw new Error("Expected the base fixture to be public");
56:assert.equal(publicBaseArticle.slug, "hemoglobin");
57:
58-76:for (const state of ["draft", "review"] as const) { … }
77:
78:const missingEvidence = validateKnowledgeBaseArticles(
79:  [article({ reviewedBy: null, reviewedAt: null, sources: [] })],
80:  { asOf: AS_OF },
81:);
82:assert.equal(missingEvidence.valid, false);
83:assert.ok(
84:  missingEvidence.errors.some((message) =>
85:    message.includes("requires reviewedBy"),
86:  ),
87:);
88:assert.ok(
89:  missingEvidence.errors.some((message) =>
90:    message.includes("requires reviewedAt"),
91:  ),
92:);
93:assert.ok(
94:  missingEvidence.errors.some((message) =>
95:    message.includes("requires at least one source"),
96:  ),
97:);
98:
99:const invalidSource = validateKnowledgeBaseArticles(
100-104:  [ … ],
105:  { asOf: AS_OF },
106:);
107:assert.equal(invalidSource.valid, false);
108:assert.ok(
109:  invalidSource.errors.some((message) => message.includes("valid HTTPS URL")),
110:);
111:const invalidIdentity = article({ slug: "Not Valid" });
112:assert.equal(
113:  getKnowledgeBasePublicationDecision(invalidIdentity, { asOf: AS_OF }).public,
114:  false,
115:);
116:assert.equal(
117:  findPublicKnowledgeBaseArticle([invalidIdentity], invalidIdentity.slug, {
118:    asOf: AS_OF,
119:  }),
120:  null,
121:);
122:assert.equal(isValidKnowledgeBaseTimestamp("2026-02-31T00:00:00.000Z"), false);
123:assert.equal(
124:  findPublicKnowledgeBaseArticle(
125:    [BASE_ARTICLE, article({ slug: "Invalid Slug" })],
126:    BASE_ARTICLE.slug,
127:    { asOf: AS_OF },
128:  ),
129:  null,
130:);
131:
132-135:const stale = article({ … });
136:const staleReport = buildKnowledgeBaseStaleReport([stale], { asOf: AS_OF });
137:assert.equal(staleReport.staleArticles.length, 1);
138:assert.equal(staleReport.staleArticles[0]?.slug, "stale-article");
139:assert.equal(
140:  getKnowledgeBasePublicationDecision(stale, { asOf: AS_OF }).reason,
141:  "stale",
142:);
143:assert.equal(
144:  findPublicKnowledgeBaseArticle([stale], stale.slug, { asOf: AS_OF }),
145:  null,
146:);
147:assert.ok(
148:  validateKnowledgeBaseArticles([stale], { asOf: AS_OF }).errors.some(
149:    (message) => message.includes("review is stale"),
150:  ),
151:);
152:
153-156:const boundary = article({ … });
157:assert.deepEqual(
158:  buildKnowledgeBaseStaleReport([boundary], { asOf: AS_OF }).staleArticles,
159:  [],
160:);
161:assert.equal(
162:  getKnowledgeBasePublicationDecision(boundary, { asOf: AS_OF }).public,
163:  true,
164:);
165:
166-175:const deprecated = article({ … });
176:assert.equal(
177:  validateKnowledgeBaseArticles([deprecated, BASE_ARTICLE], { asOf: AS_OF })
178:    .valid,
179:  true,
180:);
181:assert.equal(
182:  resolveKnowledgeBaseDeprecatedRedirect(
183:    deprecated,
184:    [deprecated, BASE_ARTICLE],
185:    { asOf: AS_OF },
186:  ),
187:  "/knowledge-base/hemoglobin",
188:);
189:assert.equal(
190:  resolveKnowledgeBaseDeprecatedRedirect(
191:    deprecated,
192-200:    [ … ],
201:    { asOf: AS_OF },
202:  ),
203:  "/knowledge-base",
204:);
205:assert.equal(
206:  resolveKnowledgeBaseDeprecatedRedirect(
207-211:    article({ … }),
212:    [],
213:    { asOf: AS_OF },
214:  ),
215:  "/knowledge-base",
216:);
217:
218:const selfRedirect = validateKnowledgeBaseArticles(
219-228:  [ … ],
229:  { asOf: AS_OF },
230:);
231:assert.equal(selfRedirect.valid, false);
232:assert.ok(
233:  selfRedirect.errors.some((message) => message.includes("must not equal")),
234:);
235:
236:const duplicateSlug = validateKnowledgeBaseArticles(
237:  [BASE_ARTICLE, article({ title: "Duplicate" })],
238:  { asOf: AS_OF },
239:);
240:assert.equal(duplicateSlug.valid, false);
241:assert.ok(
242:  duplicateSlug.errors.some((message) => message.includes("duplicate slug")),
243:);
244:
245:const markup = renderToStaticMarkup(
246:  createElement(KnowledgeBaseArticlePage, { article: publicBaseArticle }),
247:);
248:assert.match(markup, /Last reviewed by Synthetic reviewer/);
249:assert.match(markup, /dateTime="2026-08-01T00:00:00\.000Z"/);
250:assert.match(markup, /Synthetic source for governance verification/);
251:assert.match(markup, /https:\/\/example\.test\/knowledge-base-source/);
252:assert.match(markup, /This is not medical advice/);
253:
254:console.log("verify-knowledge-base: all checks passed");

[…75ln elided; re-read needed ranges, e.g. C:\Users\leo\orca\workspaces\EasyHealth\eh-139-publication-review-checks\scripts\verify-knowledge-base.ts:2-12,17-19]