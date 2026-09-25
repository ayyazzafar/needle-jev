// Modified by Ayyaz Zafar, 2026-09-25: added direct TypeSafe API support (TYPESAFE_API_KEY).
// Original: https://github.com/Shubhamsaboo/awesome-llm-apps (Apache-2.0).
import { getProvider } from "../server/search.mjs";
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const { key, model } = getProvider();
  res.status(200).json({ configured: Boolean(key), model });
}
