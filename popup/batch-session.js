import {cleanSummaryText} from "./summary-format.js";
export const SESSION_FORMAT = "chatgpt-beast-mode-batch";
export const RESULTS_KEY = "bm_batch_results";
export const ACTIVE_KEY = "bm_batch_active";
export const REQUESTS_KEY = "bm_batch_requests";
export const MAX_SESSION_BYTES = 30 * 1024 * 1024;
const states = new Set(["queued", "loading", "complete", "error", "paused"]);
const string = (value, limit) => typeof value === "string" ? value.slice(0, limit) : "";

export function safeUrl(value) {
  try {const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : "";} catch {return "";}
}
export function normalizeResult(value, index = 0) {
  if (!value || typeof value !== "object" || !safeUrl(value.url)) throw new Error(`Page ${index + 1} has an invalid web address.`);
  const summary = string(value.summary, 150000);
  const error = typeof value.error === "string" ? value.error.slice(0, 2000) : value.error ? "This page needs another attempt." : "";
  const status = summary && !error && value.status !== "loading" && value.status !== "paused" ? "complete"
    : states.has(value.status) ? value.status : error ? "error" : "queued";
  const image = string(value.thumbnailData, 1500000);
  return {
    id: string(value.id, 100) || `legacy-${index}-${value.tabId ?? "page"}-${Number(value.startedAt) || 0}`,
    tabId: Number.isInteger(value.tabId) ? value.tabId : null,
    windowId: Number.isInteger(value.windowId) ? value.windowId : null,
    url: safeUrl(value.url), title: string(value.title, 1000) || new URL(value.url).hostname,
    summary, error, status, progress: Math.max(0, Math.min(100, Number(value.progress) || 0)),
    startedAt: Number(value.startedAt) || 0, completedAt: Number(value.completedAt) || 0,
    updatedAt: Number(value.updatedAt) || Number(value.completedAt) || Number(value.startedAt) || 0,
    accessCount: Math.max(0, Number(value.accessCount) || 0),
    thumbnailData: /^data:image\/(?:jpeg|png|webp);base64,[a-z\d+/=]+$/i.test(image) ? image : "",
    imageKind: ["screenshot", "preview"].includes(value.imageKind) ? value.imageKind : "",
    imageNote: string(value.imageNote, 200),
    queueOrder: Number.isSafeInteger(value.queueOrder)&&value.queueOrder>=0?value.queueOrder:index,
  };
}
export function readStoredResults(values) {
  return (Array.isArray(values) ? values : []).flatMap((value, index) => {
    try {return [normalizeResult(value, index)];} catch {return [];}
  });
}
export function exportSession(results) {
  return JSON.stringify({format: SESSION_FORMAT, version: 1, exportedAt: new Date().toISOString(), results: results.map(normalizeResult)}, null, 2);
}
export function importSession(text) {
  if (new TextEncoder().encode(text).length > MAX_SESSION_BYTES) throw new Error("Choose a session file smaller than 30 MB.");
  let session;
  try {session = JSON.parse(text);} catch {throw new Error("This file is not valid JSON. Choose an exported SmryX session.");}
  if (session?.format !== SESSION_FORMAT || session.version !== 1 || !Array.isArray(session.results)) throw new Error("This is not a supported SmryX batch session.");
  if (session.results.length > 1000) throw new Error("A session can contain up to 1,000 pages.");
  const ids = new Set();
  return session.results.map((value, index) => {
    const result = normalizeResult(value, index);
    if (ids.has(result.id)) throw new Error("The session contains duplicate page identifiers.");
    ids.add(result.id);
    result.tabId = null; result.windowId = null;
    if (result.status === "loading") result.status = "paused";
    return result;
  });
}
export function mergeResults(current, incoming) {
  const merged = new Map(current.map(result => [result.id, result]));
  for (const result of incoming) {
    const existing = merged.get(result.id);
    if (!existing || (existing.status !== "complete" && result.updatedAt > existing.updatedAt)) merged.set(result.id, result);
  }
  return [...merged.values()];
}
export function summaryParagraphs(value) {
  let summary = cleanSummaryText(value).trim();
  const section = summary.match(/(?:^|\n)(?:#{1,6}\s*|\d+[.)]\s*)?\*{0,2}TL\s*;?\s*DR[^\n]*\n+([\s\S]*?)(?=\n(?:#{1,6}\s|\d+[.)]\s*\*\*)|$)/i);
  if (section) summary = section[1].trim();
  let paragraphs = summary.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
  if (paragraphs.length > 2) paragraphs = [paragraphs[0], paragraphs.slice(1).join("\n\n")];
  if (paragraphs.length === 1) {
    const sentences = [...new Intl.Segmenter(undefined, {granularity: "sentence"}).segment(paragraphs[0])];
    if (sentences.length > 1) {
      const middle = sentences[Math.ceil(sentences.length / 2)].index;
      paragraphs = [paragraphs[0].slice(0, middle).trim(), paragraphs[0].slice(middle).trim()];
    }
  }
  return paragraphs;
}
export function splitSource(source, limit = 12000) {
  const chunks = [];
  let rest = String(source).trim();
  while (rest.length > limit) {
    let end = rest.lastIndexOf(" ", limit);
    if (end < limit / 2) end = limit;
    if (/[\uD800-\uDBFF]/.test(rest[end - 1])) end--;
    chunks.push(rest.slice(0, end)); rest = rest.slice(end).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}
export function exportCSV(results) {
  const cell = value => {
    let text = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return [["Title", "URL", "Status", "TL;DR", "Error"], ...results.map(result => [result.title, result.url, result.status, summaryParagraphs(result.summary).join("\n\n"), result.error])].map(row => row.map(cell).join(",")).join("\r\n");
}
