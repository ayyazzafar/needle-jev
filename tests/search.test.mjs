// Modified by Ayyaz Zafar, 2026-09-25: added direct TypeSafe API support (TYPESAFE_API_KEY).
// Original: https://github.com/Shubhamsaboo/awesome-llm-apps (Apache-2.0).
import test from "node:test";
import assert from "node:assert/strict";
import {
  validate,
  makePayload,
  parseAnswers,
  search,
  MODEL,
  DIRECT_MODEL,
  getProvider,
} from "../server/search.mjs";
import { splitDocument } from "../src/search.js";
const blocks = [
  { id: "b0", text: "A $25 service charge is deducted from refunds." },
  { id: "b1", text: "Breakfast is served at 8." },
];
test("validates passage boundaries and duplicate IDs", () => {
  assert.deepEqual(validate({ query: " fees ", blocks }), {
    query: "fees",
    blocks,
  });
  for (const bad of [
    [],
    [blocks[0], blocks[0]],
    [{ id: "bad", text: "abc" }],
    [{ id: "b0", text: "x".repeat(2201) }],
  ])
    assert.throws(() => validate({ query: "fees", blocks: bad }));
  assert.throws(() => validate({ query: "x".repeat(401), blocks }));
});
test("binds each relevance question to a specific passage", () => {
  const p = makePayload({ query: "fees", blocks });
  assert.equal(p.model, MODEL);
  assert.equal(p.state.passages, blocks);
  assert.match(p.questions.b1.instructions, /ONLY passage b1/);
  assert.equal(p.questions.b0.type, "boolean");
});
test("rejects incomplete, out-of-range and nonnumeric scores", () => {
  for (const p of [undefined, -1, 1.1, NaN, "0.9"])
    assert.throws(() =>
      parseAnswers(
        { answers: { b0: { probability: p }, b1: { probability: 0.1 } } },
        blocks,
      ),
    );
  assert.deepEqual(
    parseAnswers(
      {
        answers: {
          b0: { probability: 0.6 },
          b1: { probability: 0.9 },
          alien: { probability: 1 },
        },
      },
      blocks,
    ).map((x) => x.id),
    ["b1", "b0"],
  );
});
test("uses evaluation endpoint, keeps key server-side, returns ranked matching source IDs", async () => {
  const result = await search(
    { query: "fees", blocks },
    {
      key: "test-only",
      fetchImpl: async (url, options) => {
        assert.equal(url, "https://ai-gateway.vercel.sh/v1/evaluate");
        assert.equal(options.headers.Authorization, "Bearer test-only");
        return {
          ok: true,
          json: async () => ({
            answers: {
              b0: { type: "boolean", probability: 0.95 },
              b1: { type: "boolean", probability: 0.05 },
            },
          }),
        };
      },
    },
  );
  assert.deepEqual(result.matches, [
    {
      id: "b0",
      probability: 0.95,
      focus: { start: 0, end: blocks[0].text.length, text: blocks[0].text },
    },
  ]);
  assert.equal(result.model, MODEL);
  assert.ok(!JSON.stringify(result).includes("test-only"));
});
test("missing keys and upstream failures never fabricate matches", async () => {
  await assert.rejects(
    search({ query: "fees", blocks }, { key: "" }),
    /needs a TypeSafe or AI Gateway key/,
  );
  await assert.rejects(
    search(
      { query: "fees", blocks },
      { key: "test", fetchImpl: async () => ({ ok: false, status: 429 }) },
    ),
    /Too many searches/,
  );
  await assert.rejects(
    search(
      { query: "fees", blocks },
      {
        key: "test",
        fetchImpl: async () => {
          throw new Error("secret upstream detail");
        },
      },
    ),
    /Could not reach/,
  );
});
test("splits long pasted documents into valid bounded passages", () => {
  const input =
    "A paragraph.\n\n" +
    "Long text with words. ".repeat(200) +
    "\n\n" +
    "x".repeat(5000);
  const result = splitDocument(input);
  assert.ok(result.length > 3);
  assert.ok(result.every((b) => b.text.length <= 2200));
  assert.equal(new Set(result.map((b) => b.id)).size, result.length);
  assert.doesNotThrow(() => validate({ query: "words", blocks: result }));
});
test("splitting preserves punctuation, URLs and numbers in original passages", () => {
  const text =
    "Visit https://example.com/a.b?x=3.14. " +
    "A long sentence with punctuation! ".repeat(100);
  assert.equal(
    splitDocument(text)
      .map((b) => b.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
    text.replace(/\s+/g, " ").trim(),
  );
});
test("asks Jev to select a sentence, and maps it to exact source offsets", () => {
  const blocks = [
    {
      id: "b0",
      text: "Breakfast is included. A service charge applies. Dogs are welcome.",
    },
  ];
  const payload = makePayload({ query: "hidden fees", blocks });
  assert.equal(payload.questions.focus_b0.type, "choice");
  assert.equal(
    payload.questions.focus_b0.criteria.s1,
    "A service charge applies.",
  );
  const [result] = parseAnswers(
    { answers: { b0: { probability: 0.95 }, focus_b0: { choice: "s1" } } },
    blocks,
  );
  assert.equal(result.focus.text, "A service charge applies.");
  assert.equal(
    blocks[0].text.slice(result.focus.start, result.focus.end),
    result.focus.text,
  );
  for (const choice of [undefined, "s99", "s-1", "invented text"])
    assert.throws(
      () =>
        parseAnswers(
          { answers: { b0: { probability: 0.95 }, focus_b0: { choice } } },
          blocks,
        ),
      /incomplete sentence/,
    );
});

test("TYPESAFE_API_KEY calls Jev directly and takes priority", async () => {
  const provider = getProvider({
    TYPESAFE_API_KEY: " ts-key ",
    AI_GATEWAY_API_KEY: "gw-key",
  });
  assert.deepEqual(provider, {
    direct: true,
    key: "ts-key",
    model: DIRECT_MODEL,
  });
  assert.equal(getProvider({ AI_GATEWAY_API_KEY: "gw-key" }).direct, false);
  const p = makePayload({ query: "fees", blocks }, true);
  assert.equal(p.model, "jev-latest");
  assert.equal(p.questions.b0.type, "noul");
  let seen;
  const result = await search(
    { query: "fees", blocks },
    {
      key: "ts-key",
      direct: true,
      fetchImpl: async (url, init) => {
        seen = { url, init };
        return new Response(
          JSON.stringify({
            answers: {
              b0: { type: "noul", noul: 0.9 },
              b1: { type: "noul", noul: 0.1 },
            },
          }),
        );
      },
    },
  );
  assert.equal(seen.url, "https://api.typesafe.ai/v1/systemone");
  assert.equal(seen.init.headers.Authorization, "Bearer ts-key");
  assert.equal(result.model, DIRECT_MODEL);
  assert.deepEqual(
    result.matches.map((m) => m.id),
    ["b0"],
  );
});
