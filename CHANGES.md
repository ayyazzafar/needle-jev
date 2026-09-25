# Changes from the original

Original: [Needle](https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/advanced_llm_apps/needle) in [awesome-llm-apps](https://github.com/Shubhamsaboo/awesome-llm-apps), copied at commit `f12ecedf337e4732bd5ec628a1ee5b666f0d1262` (2026-09-24), Apache-2.0.

## 2026-09-25 (Ayyaz Zafar)

- `server/search.mjs`: new `TYPESAFE_API_KEY` option that calls `https://api.typesafe.ai/v1/systemone` with model `jev-latest` (yes/no questions use TypeSafe's `noul` type). It takes priority over `AI_GATEWAY_API_KEY`, which still works. Error messages name whichever service is in use.
- `api/health.js`: reports the model for the active provider.
- `tests/search.test.mjs`: test for the direct TypeSafe path.
- `.env.example`, `README.md`: document the new key; this notice and `CHANGES.md` added; paths updated for a standalone repo.
- `LICENSE`: copy of the original repository's Apache-2.0 licence.
