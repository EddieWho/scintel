import {
  TEXT as interfaceText,
  PATTERNS as interfacePatterns,
} from "./interface-en.js?v=1.1.0";
import {
  TEXT as caseText,
  PATTERNS as casePatterns,
} from "./case-en.js?v=1.1.0";
import {
  TEXT as engineText,
  PATTERNS as enginePatterns,
} from "./engine-en.js?v=1.1.0";

export const LANGUAGE_KEY = "scintel:language";
export const isLanguage = (value) => value === "zh-CN" || value === "en";

const text = { ...caseText, ...engineText, ...interfaceText };
const literals = Object.entries(text)
  .filter(([source]) => /\p{Script=Han}/u.test(source))
  .sort(([a], [b]) => b.length - a.length);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const compilePattern = ([source, target]) => {
  const placeholders = [];
  let cursor = 0;
  let expression = "";
  for (const match of source.matchAll(/\{(\d+)\}/g)) {
    expression += escapeRegex(source.slice(cursor, match.index));
    expression += "([\\s\\S]*?)";
    placeholders.push(match[1]);
    cursor = match.index + match[0].length;
  }
  expression += escapeRegex(source.slice(cursor));
  return {
    source,
    target,
    placeholders,
    exact: new RegExp(`^${expression}$`, "u"),
    // Only bounded patterns may match inside a paragraph. Open-ended captures
    // are reserved for whole text nodes so they cannot swallow adjacent prose.
    partial:
      source.match(/^\{\d+\}/) || source.match(/\{\d+\}$/)
        ? null
        : new RegExp(expression, "gu"),
  };
};
const patterns = [...casePatterns, ...enginePatterns, ...interfacePatterns]
  .sort(
    ([a], [b]) =>
      b.replace(/\{\d+\}/g, "").length - a.replace(/\{\d+\}/g, "").length,
  )
  .map(compilePattern);
const cache = new Map();

function translateCore(source, depth) {
  if (!/\p{Script=Han}/u.test(source) || depth > 8) return source;
  if (Object.hasOwn(text, source)) return text[source];
  const substitute = (pattern, captures) => {
    const values = Object.fromEntries(
      pattern.placeholders.map((id, index) => [
        id,
        translateCore(captures[index], depth + 1),
      ]),
    );
    return pattern.target.replace(/\{(\d+)\}/g, (_, id) => values[id] ?? "");
  };
  for (const pattern of patterns) {
    const match = source.match(pattern.exact);
    if (match) return substitute(pattern, match.slice(1));
  }
  let result = source;
  for (const pattern of patterns) {
    if (!pattern.partial) continue;
    result = result.replace(pattern.partial, (...args) =>
      substitute(pattern, args.slice(1, 1 + pattern.placeholders.length)),
    );
  }
  for (const [original, translated] of literals) {
    if (result.includes(original))
      result = result.split(original).join(translated);
  }
  return result
    .replace(/，/g, ", ")
    .replace(/；/g, "; ")
    .replace(/。/g, ". ")
    .replace(/：/g, ": ")
    .replace(/？/g, "?")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/“|”/g, '"')
    .replace(/「|」/g, '"')
    .replace(/、/g, ", ")
    .trimEnd();
}

/** Product copy only. User-authored writing must never be passed here. */
export function translateText(value, language = "zh-CN") {
  const source = String(value ?? "");
  if (language !== "en") return source;
  if (cache.has(source)) return cache.get(source);
  const leading = source.match(/^\s*/)[0];
  const trailing = source.match(/\s*$/)[0];
  const result = source.trim()
    ? leading + translateCore(source.trim(), 0) + trailing
    : source;
  if (cache.size > 4000) cache.clear();
  cache.set(source, result);
  return result;
}

const excluded = (element) =>
  element?.closest("[data-user-content], [data-no-i18n]");
function localizeTree(root, language) {
  for (const element of root.querySelectorAll("*")) {
    if (excluded(element)) continue;
    for (const attribute of ["aria-label", "title", "placeholder", "alt"]) {
      if (element.hasAttribute(attribute))
        element.setAttribute(
          attribute,
          translateText(element.getAttribute(attribute), language),
        );
    }
  }
  const document = root.ownerDocument || root;
  const walker = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (
      !parent ||
      excluded(parent) ||
      parent.closest("textarea, script, style")
    )
      continue;
    node.textContent = translateText(node.textContent, language);
  }
}

export function localizeElement(element, language) {
  if (language === "en") localizeTree(element, language);
}

export function localizeReport(html, language) {
  const report = new DOMParser().parseFromString(html, "text/html");
  report.documentElement.lang = language;
  if (language === "en") localizeTree(report, language);
  return "<!doctype html>\n" + report.documentElement.outerHTML;
}

/** Use only for system-generated assessment data, never the saved game state. */
export function localizeAssessment(value, language) {
  if (typeof value === "string") return translateText(value, language);
  if (Array.isArray(value))
    return value.map((item) => localizeAssessment(item, language));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        localizeAssessment(item, language),
      ]),
    );
  return value;
}
