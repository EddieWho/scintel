import { CASE } from "./case.js";
import {
  createState,
  startCase,
  takeAction,
  setContainment,
  markRead,
  linkEvidence,
  chooseHypothesis,
  recordAnalysis,
  setText,
  submitDecision,
  scoreCase,
  serializeState,
  restoreState,
} from "./engine.js?v=1.0.1";

const STORAGE = "scintel:counterfeit:1";
const routes = [
  ["overview", "案件概览", "grid"],
  ["investigate", "调查行动", "search"],
  ["evidence", "证据档案", "folder"],
  ["analytics", "分析工作台", "chart"],
  ["hypotheses", "假设检验", "nodes"],
  ["decision", "决策室", "scale"],
  ["report", "复盘报告", "file"],
];
const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  folder:
    '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11H3Z"/><path d="M3 10h18"/>',
  chart: '<path d="M4 3v17h17M8 16v-4m5 4V7m5 9V4"/>',
  nodes:
    '<circle cx="5" cy="12" r="3"/><circle cx="18" cy="5" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8 10 7-4m-7 8 7 4"/>',
  scale: '<path d="M12 3v18M7 21h10M3 7h18M6 7l-4 8h8L6 7Zm12 0-4 8h8l-4-8Z"/>',
  file: '<path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8M8 16h6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wallet:
    '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 8V4l14-2v3m0 8h4m-5 0h.1"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 4m0 3h.01"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 9M3 4v6h6"/>',
  alert: '<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3h.01"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
};
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (n) => Number(n).toLocaleString("zh-CN");
const byEvidence = (id) => CASE.evidence.find((e) => e.id === id);
const byHypothesis = (id) => CASE.hypotheses.find((h) => h.id === id);
const responseLabels = {
  targeted: "召回已识别的高风险批次",
  all: "召回全部 K2 产品",
  none: "暂不召回，持续监测",
};
const supplierLabels = {
  suspend: "暂停涉事来源并启用备选供应",
  verify: "限期核验来源，确认后恢复采购",
  keep: "维持现有采购安排",
};
const inspectionLabels = {
  enhanced: "增加真实性与温升检验",
  standard: "维持常规检验",
};
let storageWarning = "";
let state = createState();
try {
  const saved = localStorage.getItem(STORAGE);
  if (saved) {
    const restored = restoreState(saved);
    if (restored) state = restored;
    else storageWarning = "旧存档无法读取，已开始新案例。";
  }
} catch {
  storageWarning = "浏览器未允许保存进度。当前会话仍可正常进行。";
}
const ui = {
  route: getRoute(),
  menu: false,
  search: "",
  evidenceType: "all",
  evidenceAction: getEvidenceAction(),
  linkEvidenceId: null,
  linkHypothesisId: null,
  linkRelation: "supports",
  focusLink: false,
  groupBy: "supplier",
  supplier: "all",
  factory: "all",
  decision: {
    response: "targeted",
    supplier: "verify",
    inspection: "enhanced",
  },
};
try {
  const draft = JSON.parse(localStorage.getItem(`${STORAGE}:draft`) || "null");
  if (
    draft &&
    responseLabels[draft.response] &&
    supplierLabels[draft.supplier] &&
    inspectionLabels[draft.inspection]
  )
    ui.decision = draft;
} catch {
  /* A corrupt draft does not affect investigation progress. */
}
let pendingConfirm = null;
let toastTimer;

function getRoute() {
  const route = location.hash.slice(1).split("?")[0];
  return routes.some((r) => r[0] === route) ? route : "overview";
}
function getEvidenceAction() {
  if (getRoute() !== "evidence") return null;
  const id = new URLSearchParams(location.hash.split("?")[1] || "").get("from");
  return state.actions.includes(id) &&
    CASE.investigations.some((a) => a.id === id)
    ? id
    : null;
}
function actionEvidence(id) {
  const action = CASE.investigations.find((a) => a.id === id);
  if (!action || !state.actions.includes(id)) return;
  ui.search = "";
  ui.evidenceType = "all";
  go(`evidence?from=${encodeURIComponent(id)}`);
}
function focusRoute() {
  if (ui.route === "hypotheses" && ui.focusLink) {
    ui.focusLink = false;
    const form = document.querySelector("#link-form");
    form?.scrollIntoView({ block: "center" });
    form?.querySelector('[name="evidence"]')?.focus({ preventScroll: true });
  } else {
    document
      .querySelector(
        ui.route === "evidence" && ui.evidenceAction
          ? "#evidence-context"
          : "#main",
      )
      ?.focus({ preventScroll: true });
  }
}
function save() {
  try {
    localStorage.setItem(STORAGE, serializeState(state));
    localStorage.setItem(`${STORAGE}:draft`, JSON.stringify(ui.decision));
    storageWarning = "";
    return true;
  } catch {
    storageWarning = "本地存储不可用，刷新页面会丢失本次进度。";
    return false;
  }
}
function update(fn, message, rerender = true) {
  try {
    state = fn(state);
    save();
    if (rerender) render();
    if (message) toast(message);
    return true;
  } catch (error) {
    toast(error.message || "此操作暂时不可用。");
    return false;
  }
}
function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 4200);
}
function dismissToast() {
  clearTimeout(toastTimer);
  document.querySelector("#toast").classList.remove("visible");
}
function go(route) {
  ui.menu = false;
  dismissToast();
  window.scrollTo({ top: 0, behavior: "instant" });
  if (location.hash === `#${route}`) {
    ui.route = getRoute();
    ui.evidenceAction = getEvidenceAction();
    render();
    focusRoute();
  } else location.hash = route;
}
const button = (label, action, attrs = "", cls = "btn") =>
  `<button class="${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const navButton = (label, route, cls = "btn primary") =>
  `<button class="${cls}" data-route="${route}">${label} ${icon("arrow")}</button>`;
function heading(kicker, title, description, extra = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${description}</p></div>${extra}</div>`;
}
function blank(title, text, cta) {
  return `<div class="empty-state">${icon("lock")}<h2>${title}</h2><p>${text}</p>${cta}</div>`;
}
function resourceBar() {
  return `<div class="resource-pair"><div class="resource">${icon("wallet")}<span>调查预算<strong>${state.budget}<small> / ${CASE.initialBudget}</small></strong></span><div class="meter"><i style="width:${(state.budget / CASE.initialBudget) * 100}%"></i></div></div><div class="resource">${icon("clock")}<span>剩余时间<strong>${state.hoursLeft}<small> 小时</small></strong></span><div class="meter"><i style="width:${(state.hoursLeft / CASE.initialHours) * 100}%"></i></div></div></div>`;
}
function render() {
  document.title = `${routes.find((r) => r[0] === ui.route)?.[1]} · SCINTEL`;
  const completed = Boolean(state.decision);
  const unread = state.unlocked.filter((id) => !state.read.includes(id)).length;
  const content = {
    overview,
    investigate,
    evidence,
    analytics,
    hypotheses,
    decision,
    report,
  }[ui.route]();
  document.querySelector("#app").innerHTML = `
    <aside class="sidebar ${ui.menu ? "mobile-open" : ""}" aria-label="主导航">
      <a class="brand" href="#overview"><img src="./favicon.svg" alt="" width="34" height="34"><span>SCINTEL<span class="brand-sub">SUPPLY CHAIN INTELLIGENCE</span></span></a>
      <div class="workspace-label">调查工作区 <span>01</span></div>
      <nav>${routes.map(([id, label, glyph], index) => `<button data-route="${id}" aria-label="${label}" title="${label}" class="nav-item ${ui.route === id ? "active" : ""}" ${ui.route === id ? 'aria-current="page"' : ""}>${icon(glyph)}<span>${label}</span><small>${id === "evidence" ? `${unread} 未读` : id === "report" && !completed ? icon("lock") : String(index + 1).padStart(2, "0")}</small></button>`).join("")}</nav>
      <div class="sidebar-bottom"><div class="case-label"><span class="live-dot"></span> ${completed ? "调查已归档" : state.started ? "调查进行中" : "案件待启动"}</div><strong>CASE / 001</strong><p>假冒零部件危机</p><div class="sidebar-progress"><i style="width:${completed ? 100 : state.started ? 15 + state.actions.length * 12 : 0}%"></i></div><span class="sidebar-note">好的判断，始于好的证据。</span></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><div class="breadcrumb">${button(icon("menu"), "menu", 'aria-label="切换导航" aria-expanded="' + ui.menu + '"', "icon-btn mobile-toggle")}<span>调查工作区</span><span class="slash">/</span><strong>假冒零部件危机</strong></div><div class="topbar-actions"><span class="save-status"><span class="live-dot"></span>${storageWarning ? "仅当前会话" : "本地自动保存"}</span>${button(icon("help"), "help", 'aria-label="玩法说明"', "icon-btn")}${button(icon("reset"), "restart", 'aria-label="重新开始"', "icon-btn")}<span class="avatar" title="调查负责人">SC</span></div></header>
      <main id="main" tabindex="-1">${storageWarning ? `<div class="notice warning">${esc(storageWarning)}</div>` : ""}${content}<footer class="page-footer"><span>SCINTEL <b>·</b> INVESTIGATE WITH INTENT</span><span>教学模拟 · 全部企业与数据均为虚构</span></footer></main>
    </div>`;
}
function overview() {
  return `${heading("CASE FILE / 001", "警报背后的真相", "一次异常退货，可能只是更大问题的开端。你的任务是找到证据，作出判断。", '<span class="tag orange"><span class="live-dot"></span> 产品安全事件</span>')}
    <section class="hero"><div class="hero-copy"><div class="eyebrow">NORTHSTAR ELECTRONICS · 内部调查委托</div><h2>供应商一切正常。<br>产品却在持续过热。</h2><p>K2 系列的保修投诉较上一观察期增加了 22%。供应商评分仍为绿色，库存记录也没有异常。管理层需要一个有依据的解释，以及下一步行动。</p><div class="hero-meta"><span>${icon("clock")} 约 30 分钟</span><span>${icon("nodes")} 3 个竞争假设</span><span>${icon("folder")} 10 份证据</span></div>${!state.started ? button("接受委托，开始调查 " + icon("arrow"), "start", "", "btn light") : navButton(state.decision ? "查看调查复盘" : state.containment ? "继续调查" : "选择初步处置", state.decision ? "report" : state.containment ? "investigate" : "overview", "btn light")}</div><div class="hero-visual" aria-hidden="true"><div class="radar-orbit orbit-one"></div><div class="radar-orbit orbit-two"></div><div class="radar-orbit orbit-three"></div><svg viewBox="0 0 330 280"><path d="M45 90 158 52 275 100 246 218 110 226 45 90M158 52l-48 174m165-126L110 226M45 90l201 128" fill="none" stroke="#91b7a1" stroke-width="1" stroke-dasharray="4 5"/><circle cx="158" cy="52" r="7" fill="#bed8aa"/><circle cx="45" cy="90" r="7" fill="#bed8aa"/><circle cx="275" cy="100" r="7" fill="#bed8aa"/><circle cx="246" cy="218" r="7" fill="#bed8aa"/><circle cx="110" cy="226" r="7" fill="#bed8aa"/><circle cx="166" cy="143" r="43" fill="#214d42" stroke="#b8d3a2"/><path d="M149 130h34v29h-34zM157 130v-8h18v8m-9 9v10m-5-5h10" fill="none" stroke="#d4e3ba" stroke-width="2"/></svg><span class="network-label n1">SOURCE</span><span class="network-label n2">MAKE</span><span class="network-label n3">DELIVER</span><span class="signal-label"><i></i> 异常信号已识别</span></div></section>
    <div class="kpi-grid"><div class="kpi"><span>保修投诉变化 ${icon("chart")}</span><strong class="text-orange">+22<small>%</small></strong><p>50 → 61 例 · 同长度观察期</p></div><div class="kpi"><span>客户反馈 ${icon("alert")}</span><strong>异常过热</strong><p>尚未确认问题范围与根因</p></div><div class="kpi"><span>供应商评分 ${icon("check")}</span><strong class="text-green">绿色</strong><p>评分与现场信号存在差异</p></div><div class="kpi"><span>调查权限 ${icon("folder")}</span><strong>${state.unlocked.length}<small> / 10</small></strong><p>已获取证据 · ${state.read.length} 份已阅读</p></div></div>
    <div class="overview-columns"><section class="panel"><div class="section-heading"><h2>调查路线</h2><span class="muted">从信号到判断</span></div><ol class="journey"><li class="${state.started ? "done" : ""}"><span>01</span><div><h3>先控制风险</h3><p>根因尚未明确，也需要决定是否继续出货。</p></div></li><li class="${state.actions.length ? "done" : ""}"><span>02</span><div><h3>让证据回答问题</h3><p>分配时间与预算，分析数据，检验其他解释。</p></div></li><li class="${state.decision ? "done" : ""}"><span>03</span><div><h3>作出可辩护的决策</h3><p>提交处置方案，查看后果与推理复盘。</p></div></li></ol></section><section class="panel"><div class="section-heading"><h2>你的调查资源</h2><span class="tag neutral">有限资源</span></div>${resourceBar()}<p class="hint">时间按调查行动推进，阅读材料不会扣时。预算不足以完成所有调查，请先明确你想验证什么。</p>${navButton("查看初始证据", "evidence", "text-link")}</section></div>
    ${state.started && !state.decision ? containmentPanel() : ""}
    <section class="section-block"><div class="section-heading"><h2>已送达的线索 <span class="count">02</span></h2>${navButton("打开证据档案", "evidence", "text-link")}</div><div class="evidence-grid initial-evidence">${CASE.evidence
      .filter((e) => e.initial)
      .map(evidenceCard)
      .join("")}</div></section>`;
}
function containmentPanel() {
  const current = CASE.containmentOptions.find(
    (o) => o.id === state.containment,
  );
  return `<section class="panel containment"><div class="section-heading"><div><div class="eyebrow">FIRST RESPONSE</div><h2>${current ? "当前风险处置" : "调查前，先决定如何处置风险"}</h2></div><span class="tag ${current?.id === "monitor" ? "orange" : "neutral"}">${current ? esc(current.title) : "需要选择"}</span></div><p class="muted">调查期间，问题不会自动停止。你可以随后升级处置，但已经消耗的时间无法追回。</p><div class="containment-grid">${CASE.containmentOptions
    .map((o) => {
      const selected = current?.id === o.id;
      const disabled =
        Boolean(current && o.level <= current.level) ||
        state.budget < o.cost - (current?.cost || 0);
      return `<div class="containment-option ${selected ? "selected" : ""}"><h3>${esc(o.title)}</h3><p>${esc(o.description)}</p><div class="option-bottom"><span>${o.cost - (current?.cost || 0) > 0 ? o.cost - (current?.cost || 0) : 0} 预算</span>${button(selected ? "已执行 " + icon("check") : current && o.level < current.level ? "不可降级" : current ? "升级处置" : "执行处置", "contain", `data-id="${o.id}" ${disabled ? "disabled" : ""}`, "btn small " + (selected ? "selected-btn" : "secondary"))}</div></div>`;
    })
    .join("")}</div></section>`;
}
function recentInvestigation() {
  const id = state.actions.at(-1);
  if (!id) return "";
  const action = CASE.investigations.find((a) => a.id === id);
  const unread = action.evidenceIds.filter(
    (e) => !state.read.includes(e),
  ).length;
  return `<section class="investigation-result" aria-label="最近完成的调查"><div><span class="eyebrow">调查完成 · 材料已送达</span><h2>${esc(action.title)}</h2><p>${action.evidenceIds.join("、")} · ${action.evidenceIds.length} 份材料${unread ? `，还有 ${unread} 份未读` : "，已全部阅读"}。${unread ? "先看看这次调查带回了什么。" : "可以继续比较数据或检验假设。"}</p></div>${button("阅读本次材料 " + icon("arrow"), "action-evidence", `data-id="${id}"`, "btn primary")}</section>`;
}
function investigate() {
  if (!state.started)
    return (
      heading(
        "INVESTIGATION",
        "调查行动",
        "每次调查，都应该回答一个具体问题。",
      ) +
      blank(
        "先接受调查委托",
        "阅读案件简报，启动你的调查。",
        navButton("返回案件概览", "overview"),
      )
    );
  if (state.decision)
    return (
      heading("INVESTIGATION", "调查已结束", "本次行动记录已归档。") +
      actionLog() +
      navButton("查看复盘报告", "report")
    );
  return `${heading("INVESTIGATION", "下一步，查什么？", "选择能区分不同解释的调查。获取材料后，记得阅读并将它们连接到假设。")}${resourceBar()}${recentInvestigation()}${containmentPanel()}<div class="section-heading section-block"><h2>可用调查行动</h2><span class="muted">${state.actions.length} / ${CASE.investigations.length} 已完成</span></div><div class="action-grid">${CASE.investigations
    .map((a, i) => {
      const done = state.actions.includes(a.id);
      const unread = a.evidenceIds.filter(
        (id) => !state.read.includes(id),
      ).length;
      const reason = !state.containment
        ? "请先选择风险处置"
        : state.budget < a.cost
          ? "调查预算不足"
          : state.hoursLeft < a.hours
            ? "剩余时间不足"
            : "";
      return `<article class="action-card ${done ? "completed" : ""}"><div class="card-top"><span class="action-number">INV / 0${i + 1}</span>${done ? `<span class="tag ${unread ? "orange" : "green"}">${unread ? `${unread} 份材料未读` : icon("check") + " 已完成"}</span>` : icon(i === 0 ? "chart" : i === 2 ? "scale" : "search")}</div><h2>${esc(a.title)}</h2><p>${esc(a.description)}</p><div class="investigation-question"><span>验证问题</span>${esc(a.question)}</div><div class="action-cost"><span>${icon("wallet")} ${a.cost} 预算</span><span>${icon("clock")} ${a.hours} 小时</span><span>${a.evidenceIds.length} 份证据</span></div>${done ? button("阅读调查材料 " + icon("arrow"), "action-evidence", `data-id="${a.id}"`, "btn secondary full") : button(reason || "开展调查 " + icon("arrow"), "investigate", `data-id="${a.id}" ${reason ? "disabled" : ""}`, "btn primary full")}</article>`;
    })
    .join(
      "",
    )}</div><div class="notice">${icon("help")} 不必获取全部证据。材料足以支持判断时，可以前往决策室。${navButton("前往决策室", "decision", "text-link")}</div>`;
}
function evidenceCard(e) {
  const unlocked = state.unlocked.includes(e.id);
  const read = state.read.includes(e.id);
  const highlighted =
    ui.route === "evidence" &&
    CASE.investigations
      .find((a) => a.id === ui.evidenceAction)
      ?.evidenceIds.includes(e.id);
  return `<article class="evidence-card ${unlocked ? "" : "locked"} ${highlighted ? "is-highlighted" : ""}" data-evidence-id="${e.id}"><div class="card-top"><span class="document-icon">${icon(unlocked ? (e.type.includes("数据") ? "chart" : "file") : "lock")}</span><span class="tag ${read ? "neutral" : highlighted ? "orange" : unlocked ? "green" : "neutral"}">${highlighted && !read ? "本次新增 · 未读" : read ? "已阅读" : unlocked ? "待阅读" : "待调查"}</span></div><div class="evidence-id">${e.id} <span> / ${esc(e.type)}</span></div><h3>${esc(e.title)}</h3><p>${unlocked ? esc(e.summary) : "完成相关调查后，材料将送达证据档案。"}</p><div class="evidence-bottom"><span>${unlocked ? esc(e.source) : "需要获取权限"}</span>${unlocked ? button("查看 " + icon("arrow"), "open-evidence", `data-id="${e.id}" aria-label="查看 ${esc(e.title)}"`, "text-link") : icon("lock")}</div></article>`;
}
function filteredEvidence() {
  const action = CASE.investigations.find((a) => a.id === ui.evidenceAction);
  return CASE.evidence.filter(
    (e) =>
      (!action || action.evidenceIds.includes(e.id)) &&
      (ui.evidenceType === "all" ||
        (ui.evidenceType === "unlocked"
          ? state.unlocked.includes(e.id)
          : ui.evidenceType === "unread"
            ? state.unlocked.includes(e.id) && !state.read.includes(e.id)
            : !state.unlocked.includes(e.id))) &&
      `${e.id} ${e.title} ${e.type}`
        .toLowerCase()
        .includes(ui.search.toLowerCase()),
  );
}
function evidence() {
  const action = CASE.investigations.find((a) => a.id === ui.evidenceAction);
  const unread = action?.evidenceIds.filter(
    (id) => !state.read.includes(id),
  ).length;
  const context = action
    ? `<section class="evidence-context" id="evidence-context" tabindex="-1"><div><span class="eyebrow">当前显示这次调查带回的材料</span><h2>${esc(action.title)}</h2><p>${action.evidenceIds.length} 份材料 · ${unread ? `${unread} 份未读` : "已全部阅读"}。高亮卡片都来自这次调查。</p></div>${button("查看全部材料", "all-evidence", "", "btn secondary")}</section>`
    : "";
  return `${heading("EVIDENCE LIBRARY", "证据不会自己说话", "阅读来源、时间与局限性。看见一个线索，不等于已经证明一个解释。", '<span class="tag green">' + state.unlocked.length + " 份已获取</span>")}${context}<div class="filter-bar"><label class="search-field">${icon("search")}<input type="search" id="evidence-search" placeholder="搜索编号、标题或类型" aria-label="搜索证据" value="${esc(ui.search)}"></label><label class="select-label">显示<select id="evidence-filter"><option value="all" ${ui.evidenceType === "all" ? "selected" : ""}>${action ? "本次材料" : "全部材料"}</option><option value="unlocked" ${ui.evidenceType === "unlocked" ? "selected" : ""}>已获取</option><option value="unread" ${ui.evidenceType === "unread" ? "selected" : ""}>尚未阅读</option><option value="locked" ${ui.evidenceType === "locked" ? "selected" : ""}>尚未获取</option></select></label></div><div class="evidence-grid" id="evidence-grid">${filteredEvidence().map(evidenceCard).join("") || '<p class="muted">没有符合条件的材料。</p>'}</div>${state.started && !state.decision ? `<div class="notice">${icon("nodes")} 阅读之后，还需要说明证据怎样支持或反驳假设。背景材料不必强行连线。${navButton("检验假设", "hypotheses", "text-link")}</div>` : ""}`;
}
function openEvidence(id) {
  const evidence = byEvidence(id);
  if (!evidence || !state.unlocked.includes(id)) return;
  if (!state.decision && !update((s) => markRead(s, id))) return;
  const batch =
    CASE.investigations.find((a) => a.id === ui.evidenceAction)?.evidenceIds ||
    state.unlocked;
  const next = state.decision
    ? null
    : batch.find((e) => e !== id && !state.read.includes(e));
  const dialog = document.querySelector("#evidence-dialog");
  dialog.innerHTML = `<div class="dialog-top"><span class="eyebrow">EVIDENCE / ${id}</span>${button(icon("close"), "close-evidence", 'aria-label="关闭证据"', "icon-btn")}</div><span class="tag neutral">${esc(evidence.type)}</span><h2 id="evidence-title" tabindex="-1">${esc(evidence.title)}</h2><dl class="evidence-meta"><div><dt>来源</dt><dd>${esc(evidence.source)}</dd></div><div><dt>记录时间</dt><dd>${esc(evidence.date)}</dd></div><div class="wide"><dt>可靠性与局限</dt><dd>${esc(evidence.reliability)}</dd></div></dl><div class="document-body">${evidence.body.map((p) => `<p>${esc(p)}</p>`).join("")}${evidence.table ? renderTable(evidence.table.headers, evidence.table.rows) : ""}</div><p class="muted">${evidence.tags.map(esc).join(" · ")}</p><div class="dialog-bottom evidence-reading-actions">${next ? button(`阅读下一份 · ${next} ` + icon("arrow"), "next-evidence", `data-id="${next}"`, "btn secondary") : `<span class="muted">${state.decision ? "本次调查已归档" : ui.evidenceAction ? "本次调查材料已全部阅读" : "已获取材料已全部阅读"}</span>`}${state.started && !state.decision ? button("关联这份证据 " + icon("nodes"), "evidence-to-hypotheses", `data-id="${id}"`, "btn primary") : button("关闭材料", "close-evidence", "", "btn secondary")}</div>`;
  dialog.dataset.evidence = id;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  dialog.querySelector("#evidence-title").focus({ preventScroll: true });
}
function renderTable(headers, rows, caption = "") {
  return `<div class="table-scroll"><table>${caption ? `<caption>${esc(caption)}</caption>` : ""}<thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function analytics() {
  const title = heading(
    "ANALYTICS WORKSPACE",
    "从数据中寻找差异",
    "比较相同条件下的不同批次。相关性提供线索，真实性还需要其他证据。",
  );
  if (!state.actions.includes("trace"))
    return (
      title +
      blank(
        "批次数据尚未获取",
        "开展批次追踪调查，解锁按供应商、工厂和批次筛选的分析工作台。",
        navButton("前往调查行动", "investigate"),
      )
    );
  const rows = CASE.batches.filter(
    (b) =>
      (ui.supplier === "all" || b.supplier === ui.supplier) &&
      (ui.factory === "all" || b.factory === ui.factory),
  );
  const groups = Object.values(
    rows.reduce((acc, row) => {
      const name = row[ui.groupBy];
      acc[name] ||= { name, shipped: 0, returns: 0, tested: 0, failed: 0 };
      for (const key of ["shipped", "returns", "tested", "failed"])
        acc[name][key] += row[key];
      return acc;
    }, {}),
  );
  const shipped = rows.reduce((a, b) => a + b.shipped, 0),
    returns = rows.reduce((a, b) => a + b.returns, 0);
  const maxRate = Math.max(
    1,
    ...groups.map((g) => (g.returns / g.shipped) * 100),
  );
  const select = (id, label, values, value, all = true) =>
    `<label class="select-label">${label}<select id="${id}">${all ? '<option value="all">全部</option>' : ""}${values.map(([v, l]) => `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
  return `${title}<div class="filter-bar analytics-filters">${select(
    "analysis-group",
    "比较维度",
    [
      ["supplier", "供应商"],
      ["factory", "工厂"],
      ["id", "批次"],
    ],
    ui.groupBy,
    false,
  )}${select(
    "analysis-supplier",
    "供应商",
    [...new Set(CASE.batches.map((b) => b.supplier))].map((v) => [v, v]),
    ui.supplier,
  )}${select(
    "analysis-factory",
    "工厂",
    [...new Set(CASE.batches.map((b) => b.factory))].map((v) => [v, v]),
    ui.factory,
  )}</div><div class="analysis-layout"><section class="panel"><div class="section-heading"><h2>各组退货率</h2><span class="tag neutral">退货 / 已出货</span></div><div class="bar-chart" role="img" aria-label="${esc(groups.map((g) => `${g.name} 退货率 ${((g.returns / g.shipped) * 100).toFixed(2)}%`).join("，"))}">${groups.length ? groups.map((g) => `<div class="chart-row"><div class="bar-label"><span>${esc(g.name)}</span><strong>${((g.returns / g.shipped) * 100).toFixed(2)}%</strong></div><div class="chart-track"><div style="width:${(((g.returns / g.shipped) * 100) / maxRate) * 100}%"></div></div><small>${fmt(g.returns)} / ${fmt(g.shipped)} 件</small></div>`).join("") : '<p class="muted">此筛选组合没有记录。</p>'}</div><p class="hint">使用合并后的退货件数 ÷ 出货件数计算，不对批次百分比取简单平均。</p></section><section class="panel analysis-summary"><span class="eyebrow">CURRENT SELECTION</span><h2>${rows.length} 个批次</h2><strong class="big-number">${shipped ? ((returns / shipped) * 100).toFixed(2) : "—"}<small>%</small></strong><p>合并退货率 · ${fmt(shipped)} 件出货</p><hr><h3>值得验证的问题</h3><p>异常更集中于某个供应来源，还是某座工厂？相同设计的其他批次表现如何？</p>${button(state.decision ? "分析记录已归档" : "记录本次比较 " + icon("check"), "record-analysis", state.decision || !rows.length ? "disabled" : "", "btn secondary full")}<small class="muted">已记录 ${state.analysisViews.length} 次不同比较</small></section></div><section class="panel section-block"><div class="section-heading"><h2>批次明细</h2><span class="muted">来源 E03 · 同一观察窗口</span></div>${renderTable(
    ["批次", "供应商", "工厂", "出货", "退货", "退货率", "抽检 / 不合格"],
    rows.map((b) => [
      b.id,
      b.supplier,
      b.factory,
      fmt(b.shipped),
      b.returns,
      ((b.returns / b.shipped) * 100).toFixed(2) + "%",
      `${b.tested} / ${b.failed}`,
    ]),
  )}</section>`;
}
function hypotheses() {
  const title = heading(
    "HYPOTHESIS TESTING",
    "结论需要证据支撑",
    "保留竞争解释。把已阅读的材料标为支持或反驳，再选择当前最有依据的判断。",
  );
  if (!state.started)
    return (
      title +
      blank(
        "调查尚未开始",
        "先接受调查委托，再建立你的证据关系。",
        navButton("返回案件概览", "overview"),
      )
    );
  const read = CASE.evidence.filter((e) => state.read.includes(e.id));
  const selectedEvidence = read.some((e) => e.id === ui.linkEvidenceId)
    ? ui.linkEvidenceId
    : read[0]?.id;
  const selectedHypothesis =
    ui.linkHypothesisId || state.hypothesis || CASE.hypotheses[0].id;
  return `${title}${state.decision ? '<div class="notice">本次判断已提交，证据关系已锁定。</div>' : ""}<div class="hypothesis-grid">${CASE.hypotheses
    .map((h, i) => {
      const links = state.links.filter((l) => l.hypothesisId === h.id);
      return `<section class="hypothesis-card ${state.hypothesis === h.id ? "chosen" : ""}"><div class="card-top"><span class="eyebrow">HYPOTHESIS / 0${i + 1}</span>${state.hypothesis === h.id ? '<span class="tag green">当前判断</span>' : ""}</div><h2>${esc(h.title)}</h2><p>${esc(h.description)}</p><div class="linked-evidence">${links.length ? links.map((l) => `<div class="linked-item ${l.relation}"><span>${l.relation === "supports" ? "+" : "−"}</span><button class="inline-evidence" data-action="open-evidence" data-id="${l.evidenceId}">${l.evidenceId} · ${esc(byEvidence(l.evidenceId).title)}</button>${!state.decision ? button("×", "unlink", `data-evidence="${l.evidenceId}" data-hypothesis="${h.id}" aria-label="移除 ${l.evidenceId} 与 ${esc(h.title)} 的关联"`, "remove-link") : ""}</div>`).join("") : '<span class="muted">尚未关联证据</span>'}</div>${button(state.hypothesis === h.id ? "已选为当前判断 " + icon("check") : "选择这一假设", "choose-hypothesis", `data-id="${h.id}" ${state.decision ? "disabled" : ""}`, "btn " + (state.hypothesis === h.id ? "selected-btn" : "secondary") + " full")}</section>`;
    })
    .join(
      "",
    )}</div>${!state.decision ? `<section class="panel section-block"><div class="section-heading"><div><h2>建立证据关系</h2><p class="muted">这里记录你如何使用材料，计入「证据运用」40 分。阅读不会自动建立关系；背景材料可以不连线，无差别连线会扣分。</p></div>${icon("nodes")}</div>${read.length ? `<form id="link-form" class="link-form"><label>已阅读的证据<select name="evidence" required>${read.map((e) => `<option value="${e.id}" ${e.id === selectedEvidence ? "selected" : ""}>${e.id} · ${esc(e.title)}</option>`).join("")}</select></label><label>关系<select name="relation"><option value="supports" ${ui.linkRelation === "supports" ? "selected" : ""}>支持</option><option value="contradicts" ${ui.linkRelation === "contradicts" ? "selected" : ""}>反驳</option></select></label><label>对应假设<select name="hypothesis">${CASE.hypotheses.map((h) => `<option value="${h.id}" ${h.id === selectedHypothesis ? "selected" : ""}>${esc(h.title)}</option>`).join("")}</select></label><button class="btn primary" type="submit">关联证据 ${icon("nodes")}</button></form>` : `<p>阅读材料后才能关联证据。</p>${navButton("打开证据档案", "evidence")}`}</section>` : ""}<div class="notice">${icon("help")} 连接关系代表你的判断，系统不会提前揭示正确答案。${navButton("进入决策室", "decision", "text-link")}</div>`;
}
function decisionWarnings() {
  const warnings = [];
  const unread = state.unlocked.filter((id) => !state.read.includes(id));
  if (unread.length)
    warnings.push({
      text: `还有 ${unread.length} 份已获取材料未读（${unread.join("、")}）。`,
      route: "evidence",
    });
  if (!state.links.length)
    warnings.push({
      text: "尚未记录证据与假设的关系，系统还看不到你如何用材料支持判断。",
      route: "hypotheses",
    });
  if (state.actions.includes("trace") && !state.analysisViews.length)
    warnings.push({
      text: "已获取批次数据，但还没有记录任何数据比较。",
      route: "analytics",
    });
  return warnings;
}
function decisionChecklist(interactive = true) {
  const warnings = decisionWarnings();
  if (!warnings.length) return "";
  return `<section class="decision-checklist" aria-label="提交前检查"><h3>提交前，再看一眼</h3><ul>${warnings.map((w) => `<li><span>${esc(w.text)}</span>${interactive ? navButton("返回检查", w.route, "text-link") : ""}</li>`).join("")}</ul><p>这些提醒不会阻止提交。你可以在资源有限或证据不足时作出决定，但应说明仍有哪些不确定性。</p></section>`;
}
function decision() {
  const title = heading(
    "DECISION ROOM",
    "在不确定中作出决定",
    "选择处置范围、供应策略与检验措施，并说明你的证据与取舍。",
  );
  if (state.decision)
    return (
      title +
      blank(
        "决策已提交",
        "本次调查已归档。你可以在复盘报告中补充反思，或重新开始体验不同路径。",
        navButton("查看复盘报告", "report"),
      )
    );
  if (!state.started || !state.containment)
    return (
      title +
      blank(
        "先明确初步处置",
        "调查开始前，需要决定如何处理当前的产品风险。",
        navButton("前往案件概览", "overview"),
      )
    );
  const optionGroup = (name, title, labels, descriptions) =>
    `<fieldset><legend>${title}</legend><div class="decision-options">${Object.entries(
      labels,
    )
      .map(
        ([id, label]) =>
          `<label class="radio-option"><input type="radio" name="${name}" value="${id}" ${ui.decision[name] === id ? "checked" : ""}><span><strong>${label}</strong><small>${descriptions[id]}</small></span></label>`,
      )
      .join("")}</div></fieldset>`;
  return `${title}${decisionChecklist()}<div class="decision-layout"><form id="decision-form" class="panel">${optionGroup("response", "01 / 产品处置范围", responseLabels, { targeted: "需要有批次追踪依据，控制召回范围。", all: "覆盖范围更广，也会带来更高成本。", none: "短期直接成本低，风险可能继续累积。" })}${optionGroup("supplier", "02 / 供应来源措施", supplierLabels, { suspend: "降低涉事来源风险，但切换会影响交付。", verify: "核验前不恢复涉事来源采购，需等待调查。", keep: "保持供应连续性，来源风险仍需承担。" })}${optionGroup("inspection", "03 / 后续检验", inspectionLabels, { enhanced: "增加检测费用与交付时间，提高发现能力。", standard: "维持现有效率，也保留现有检测盲区。" })}<label class="textarea-label" for="rationale">04 / 决策依据与取舍 <span>至少 20 字</span></label><textarea id="rationale" name="rationale" rows="5" maxlength="5000" placeholder="引用具体证据，解释为什么选择这一方案，以及仍然存在的不确定性。">${esc(state.rationale)}</textarea><div class="form-bottom"><span id="rationale-count" class="muted">${state.rationale.trim().length} / 20 字起</span><button class="btn primary" type="submit">检查并提交决策 ${icon("arrow")}</button></div></form><aside class="decision-summary"><section class="panel"><div class="eyebrow">YOUR CASE SO FAR</div><h2>你的调查摘要</h2><dl><div><dt>当前判断</dt><dd>${state.hypothesis ? esc(byHypothesis(state.hypothesis).title) : "尚未选择假设"}</dd></div><div><dt>已阅读证据</dt><dd>${state.read.length} 份</dd></div><div><dt>证据关系</dt><dd>${state.links.length} 条</dd></div><div><dt>已记录分析</dt><dd>${state.analysisViews.length} 次</dd></div><div><dt>剩余资源</dt><dd>${state.budget} 预算 / ${CASE.initialBudget} · ${state.hoursLeft} 小时</dd></div></dl>${navButton("检查假设与证据", "hypotheses", "text-link")}</section><div class="note-card"><h3>${icon("help")} 提交前想一想</h3><p>你排除了哪些替代解释？如果判断有误，这个方案是否仍能保护客户？</p><p>证据运用 40 分、假设论证 30 分、决策质量 30 分。自由文字保留用于讨论，不自动评分。</p></div></aside></div>`;
}
function actionLog() {
  return `<ol class="activity-log">${state.log.map((l) => `<li><span>T+${l.time}h</span><p>${esc(l.message)}</p></li>`).join("") || "<li>尚无行动记录。</li>"}</ol>`;
}
function evidenceReviewSection(review) {
  return `<section class="panel section-block evidence-review" aria-labelledby="evidence-review-title"><div class="section-heading"><div><div class="eyebrow">UNDERSTAND YOUR EVIDENCE SCORE</div><h2 id="evidence-review-title">证据运用明细</h2></div><span class="tag neutral">满分 40 分</span></div><p class="review-intro">这 40 分评估你如何使用材料：阅读有基础分，把关键材料正确用于支持或反驳假设会获得更多分；过度推断或关系判断错误会扣分。不同材料的重要性不同，不必收集或关联全部材料。</p><div class="review-counts"><div><strong>${review.summary.readCount}</strong><span>份已阅读</span></div><div><strong>${review.summary.correctEvidenceCount}</strong><span>份有正确关联</span></div><div><strong>${review.summary.incorrectLinkCount}</strong><span>条关系需要复核</span></div></div><ul class="evidence-review-list">${review.items.map((item) => `<li class="review-evidence ${item.status}" data-review-evidence="${item.id}"><div class="review-evidence-heading"><h3>${button(`${item.id} · ${esc(item.title)}`, "open-evidence", `data-id="${item.id}"`, "review-evidence-link")}</h3><span class="review-status ${item.status}">${esc(item.statusLabel)}</span></div><p>${esc(item.explanation)}</p>${item.userLinks.length ? `<details class="review-relations" ${item.status === "needs_review" ? "open" : ""}><summary>你记录的关系（${item.userLinks.length}）</summary><ul>${item.userLinks.map((link) => `<li><strong>${link.correct ? "✓" : "需复核"} ${link.relation === "supports" ? "支持" : "反驳"} · ${esc(byHypothesis(link.hypothesisId).title)}</strong><p>${esc(link.explanation)}</p></li>`).join("")}</ul></details>` : ""}</li>`).join("")}</ul></section>`;
}
function report() {
  const title = heading(
    "AFTER-ACTION REVIEW",
    "每一次判断，都值得复盘",
    "回看证据、决策时机与后果。结果好坏和推理质量，需要分别理解。",
  );
  if (!state.decision)
    return (
      title +
      blank(
        "调查仍在进行",
        "提交决策后，你会获得评分解释、案例真相与完整调查报告。",
        navButton("前往决策室", "decision"),
      )
    );
  const r = scoreCase(state);
  return `${title}<section class="report-hero"><div><span class="eyebrow">INVESTIGATION COMPLETE</span><h2>${esc(r.outcome.headline)}</h2><p>你用了 ${CASE.initialHours - state.hoursLeft} 小时，完成 ${state.actions.length} 项调查，阅读 ${state.read.length} 份材料并记录 ${state.links.length} 条证据关系。下面分别回顾你的判断依据与处置后果。</p><div class="report-actions">${button(icon("download") + " 下载调查报告", "export-report", "", "btn light")}${button("导出行动记录", "export-json", "", "btn outline-light")}</div><small>报告为 HTML 文件，可在浏览器中打印为 PDF。</small></div><div class="score-ring" style="--score:${r.total * 3.6}deg"><div><strong>${r.total}<span>/100</span></strong><small>调查过程评分</small></div></div></section><div class="score-grid">${r.categories.map((c) => `<section class="panel score-card" data-score-category="${c.id}"><div class="section-heading"><h2>${esc(c.label)}</h2><strong>${c.score}<small> / ${c.max}</small></strong></div><p class="score-description">${esc(c.description)}</p><div class="meter"><i style="width:${(c.score / c.max) * 100}%"></i></div><p>${esc(c.feedback)}</p><details class="score-calculation"><summary>查看计算方式</summary><p>${esc(c.calculation)}</p></details></section>`).join("")}</div>${evidenceReviewSection(r.evidenceReview)}<section class="panel section-block decision-recap"><div class="section-heading"><h2>你的最终方案</h2><span class="tag neutral">已提交</span></div><dl><div><dt>当前判断</dt><dd>${esc(byHypothesis(state.hypothesis).title)}</dd></div><div><dt>产品处置</dt><dd>${responseLabels[state.decision.response]}</dd></div><div><dt>供应措施</dt><dd>${supplierLabels[state.decision.supplier]}</dd></div><div><dt>检验安排</dt><dd>${inspectionLabels[state.decision.inspection]}</dd></div></dl><h3>你给出的理由</h3><p class="submitted-rationale">${esc(state.rationale)}</p><p class="hint">自由文字保留供你和教师讨论，没有自动进行语义评分。</p></section><section class="panel section-block"><div class="section-heading"><h2>方案后果</h2><span class="tag neutral">教学模型估算</span></div><div class="outcome-grid"><div><span>处置成本</span><strong>¥${fmt(r.outcome.cost)}</strong></div><div><span>额外交付时间</span><strong>${r.outcome.leadTimeDays} 天</strong></div><div><span>客户风险</span><strong>${esc(r.outcome.customerRisk)}</strong></div></div><p class="hint">经营后果与上面的过程评分分开展示。较低成本不代表更好的判断；这里的结果来自固定教学模型。</p><details class="score-calculation"><summary>查看后果的计算依据</summary><p>${esc(r.outcome.summary)}</p></details></section><section class="panel section-block truth-panel"><div class="eyebrow">THE STORY BEHIND THE SIGNAL</div><h2>${esc(r.truth.title)}</h2>${r.truth.explanation.map((p) => `<p>${esc(p)}</p>`).join("")}</section><div class="review-columns"><section class="panel"><h2>有依据的做法</h2><ul class="review-list">${r.strengths.map((s) => `<li>${esc(s)}</li>`).join("") || "<li>本次尚未形成充分的证据链。</li>"}</ul></section><section class="panel"><h2>值得再追问的地方</h2><ul class="review-list">${r.missed.map((s) => `<li>${esc(s)}</li>`).join("") || "<li>关键调查要素已覆盖。尝试用更少资源完成下一次调查。</li>"}</ul></section></div><section class="panel section-block"><label class="textarea-label" for="reflection">调查反思 <span>保留在下载报告中，不自动评分</span></label><textarea id="reflection" rows="4" maxlength="5000" placeholder="哪条证据改变了你的判断？你可能忽略了什么？如果再来一次，会怎样分配调查资源？">${esc(state.reflection)}</textarea></section><section class="panel section-block"><div class="section-heading"><h2>完整行动时间线</h2><span class="muted">时间按行动推进</span></div>${actionLog()}</section>`;
}
function confirm(title, body, label, action, destructive = false) {
  const dialog = document.querySelector("#confirm-dialog");
  pendingConfirm = action;
  dialog.innerHTML = `<div class="dialog-top"><span class="eyebrow">SCINTEL / CONFIRM</span>${button(icon("close"), "cancel-confirm", 'aria-label="取消"', "icon-btn")}</div><h2 id="confirm-title">${title}</h2><div class="confirm-body">${body}</div><div class="dialog-bottom">${button("返回", "cancel-confirm", "", "btn secondary")}${button(label, "confirm", "", "btn " + (destructive ? "danger" : "primary"))}</div>`;
  dialog.showModal();
}
function help() {
  confirm(
    "调查员快速指南",
    '<ol class="help-list"><li><strong>接受委托并选择初步处置。</strong>可以在调查途中升级处置。</li><li><strong>花费资源开展调查。</strong>只有调查行动推进时间，阅读不会扣时。</li><li><strong>阅读证据并分析批次。</strong>留意材料来源和可靠性。</li><li><strong>连接证据与竞争假设。</strong>支持和反驳都重要，无差别连线不会获得高分。</li><li><strong>提交方案，查看复盘。</strong>自由文字用于讨论，系统只评估结构化操作。</li></ol><p class="muted">进度保存在当前浏览器。此案例适合练习，不提供跨设备同步或防作弊考试功能。</p>',
    "明白了",
    () => {},
  );
}
function reportHTML() {
  const r = scoreCase(state);
  const evidenceReview = renderTable(
    ["材料", "使用情况", "说明", "你记录的关系"],
    r.evidenceReview.items.map((item) => [
      `${item.id} · ${item.title}`,
      item.statusLabel,
      item.explanation,
      item.userLinks
        .map(
          (link) =>
            `${link.relation === "supports" ? "支持" : "反驳"} ${byHypothesis(link.hypothesisId).title}：${link.explanation}`,
        )
        .join("；") || "未关联",
    ]),
  );
  const analysisTable = state.actions.includes("trace")
    ? renderTable(
        ["批次", "供应商", "工厂", "出货", "退货", "退货率", "抽检 / 不合格"],
        CASE.batches.map((b) => [
          b.id,
          b.supplier,
          b.factory,
          b.shipped,
          b.returns,
          `${((b.returns / b.shipped) * 100).toFixed(2)}%`,
          `${b.tested} / ${b.failed}`,
        ]),
        "调查中可用的批次数据；退货率按件数加权计算。",
      )
    : "<p>本次未获取批次数据。</p>";
  const lines = state.links.map((l) => [
    l.evidenceId,
    byEvidence(l.evidenceId).title,
    l.relation === "supports" ? "支持" : "反驳",
    byHypothesis(l.hypothesisId).title,
  ]);
  return `<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>SCINTEL 调查报告</title><style>body{font-family:system-ui,sans-serif;max-width:900px;margin:48px auto;padding:0 24px;color:#24382f;line-height:1.8}h1,h2,h3{line-height:1.3}h2{margin-top:36px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #cdd5cf;text-align:left;padding:8px}th{background:#f0f3ee}.table-scroll{overflow:auto}p{white-space:pre-wrap}small{color:#526456}li{margin:8px 0}@media print{body{margin:0;max-width:none}.table-scroll{overflow:visible}tr{break-inside:avoid}h2{break-after:avoid}}</style><body><h1>SCINTEL 供应链调查报告</h1><p>案例：假冒零部件危机 / ${esc(CASE.id)} · 版本 ${CASE.version}</p><small>全部企业与数据为虚构。过程评分 ${r.total}/100；自由文字未自动评分。报告由浏览器生成，可打印为 PDF。</small><h2>决策与依据</h2><p>当前判断：${esc(byHypothesis(state.hypothesis).title)}<br>产品处置：${responseLabels[state.decision.response]}<br>供应措施：${supplierLabels[state.decision.supplier]}<br>检验措施：${inspectionLabels[state.decision.inspection]}</p><p>${esc(state.rationale)}</p><h2>过程评分</h2>${renderTable(
    ["维度", "得分", "解释"],
    r.categories.map((c) => [
      c.label,
      `${c.score}/${c.max}`,
      `${c.description} ${c.feedback}`,
    ]),
  )}<details><summary>查看评分计算方式</summary><ul>${r.categories.map((c) => `<li>${esc(c.label)}：${esc(c.calculation)}</li>`).join("")}</ul></details><h2>证据运用明细</h2><p>阅读有基础分，把关键材料正确用于支持或反驳假设会获得更多分；错误关系会扣分。不同材料的重要性不同，不必收集或关联全部材料。</p>${evidenceReview}<h2>模拟后果</h2><p>${esc(r.outcome.headline)}\n${esc(r.outcome.summary)}\n处置成本：¥${fmt(r.outcome.cost)}；额外交付：${r.outcome.leadTimeDays} 天；客户风险：${esc(r.outcome.customerRisk)}</p><small>固定教学模型，不代表真实业务预测。</small><h2>证据登记表</h2>${renderTable(
    ["编号", "标题", "来源", "日期", "局限", "已阅读"],
    CASE.evidence
      .filter((e) => state.unlocked.includes(e.id))
      .map((e) => [
        e.id,
        e.title,
        e.source,
        e.date,
        e.reliability,
        state.read.includes(e.id) ? "是" : "否",
      ]),
  )}<h2>假设矩阵</h2>${renderTable(["证据", "标题", "关系", "假设"], lines)}<h2>已记录的数据分析</h2><ul>${state.analysisViews.map((v) => `<li>${esc(v)}</li>`).join("") || "<li>未记录分析</li>"}</ul>${analysisTable}<h2>案例复盘</h2><h3>${esc(r.truth.title)}</h3>${r.truth.explanation.map((p) => `<p>${esc(p)}</p>`).join("")}<h3>有依据的做法</h3><ul>${r.strengths.map((p) => `<li>${esc(p)}</li>`).join("")}</ul><h3>改进方向</h3><ul>${r.missed.map((p) => `<li>${esc(p)}</li>`).join("")}</ul><h2>个人反思</h2><p>${esc(state.reflection || "尚未填写")}</p><h2>行动记录</h2>${renderTable(
    ["时刻", "行动"],
    state.log.map((l) => [`T+${l.time}h`, l.message]),
  )}<p>剩余预算 ${state.budget}/${CASE.initialBudget}；剩余时间 ${state.hoursLeft}/${CASE.initialHours} 小时。</p></body></html>`;
}
function download(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.addEventListener("click", (event) => {
  const route = event.target.closest("[data-route]");
  if (route) return go(route.dataset.route);
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const { action, id } = target.dataset;
  if (action === "start") {
    update(startCase, "委托已接受。请先选择初步风险处置。");
    document
      .querySelector(".containment")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  } else if (action === "menu") {
    ui.menu = !ui.menu;
    render();
  } else if (action === "help") help();
  else if (action === "restart")
    confirm(
      "重新开始本案例？",
      "<p>当前浏览器中的调查进度会被清除。已下载的报告不受影响。</p>",
      "重新开始",
      () => {
        state = createState();
        ui.decision = {
          response: "targeted",
          supplier: "verify",
          inspection: "enhanced",
        };
        ui.search = "";
        ui.evidenceType = "all";
        ui.evidenceAction = null;
        ui.linkEvidenceId = null;
        ui.linkHypothesisId = null;
        ui.linkRelation = "supports";
        ui.focusLink = false;
        save();
        go("overview");
        toast("已建立新调查。");
      },
      true,
    );
  else if (action === "contain")
    update((s) => setContainment(s, id), "风险处置已更新。");
  else if (action === "investigate") {
    const a = CASE.investigations.find((a) => a.id === id);
    confirm(
      `开展${esc(a.title)}？`,
      `<p>${esc(a.question)}</p><div class="notice">消耗 <strong>${a.cost} 预算</strong> 与 <strong>${a.hours} 小时</strong>，获得 ${a.evidenceIds.length} 份材料。调查期间会按当前处置累积风险。</div>`,
      "确认开展调查",
      () => {
        if (
          update(
            (s) => takeAction(s, id),
            `调查完成，${a.evidenceIds.length} 份新材料已送达证据档案。`,
          )
        )
          document
            .querySelector(".investigation-result")
            ?.scrollIntoView({ block: "center" });
      },
    );
  } else if (action === "action-evidence") actionEvidence(id);
  else if (action === "all-evidence") {
    ui.search = "";
    ui.evidenceType = "all";
    go("evidence");
  } else if (action === "open-evidence" || action === "next-evidence")
    openEvidence(id);
  else if (action === "close-evidence")
    document.querySelector("#evidence-dialog").close();
  else if (action === "evidence-to-hypotheses") {
    ui.linkEvidenceId = id;
    ui.focusLink = true;
    document.querySelector("#evidence-dialog").close();
    go("hypotheses");
  } else if (action === "choose-hypothesis") {
    ui.linkHypothesisId = id;
    update((s) => chooseHypothesis(s, id), "当前假设已更新。");
  } else if (action === "unlink")
    update(
      (s) =>
        linkEvidence(
          s,
          target.dataset.evidence,
          target.dataset.hypothesis,
          "none",
        ),
      "证据关系已移除。",
    );
  else if (action === "record-analysis") {
    const names = { supplier: "供应商", factory: "工厂", id: "批次" };
    update(
      (s) =>
        recordAnalysis(
          s,
          `按${names[ui.groupBy]}比较；供应商=${ui.supplier === "all" ? "全部" : ui.supplier}；工厂=${ui.factory === "all" ? "全部" : ui.factory}`,
        ),
      "本次比较已加入调查记录。",
    );
  } else if (action === "cancel-confirm") {
    pendingConfirm = null;
    document.querySelector("#confirm-dialog").close();
  } else if (action === "confirm") {
    const fn = pendingConfirm;
    pendingConfirm = null;
    document.querySelector("#confirm-dialog").close();
    fn?.();
  } else if (action === "export-report" && state.decision)
    download(reportHTML(), "text/html;charset=utf-8", "SCINTEL-调查报告.html");
  else if (action === "export-json" && state.decision)
    download(
      JSON.stringify(
        {
          caseId: CASE.id,
          version: CASE.version,
          state,
          assessment: scoreCase(state),
        },
        null,
        2,
      ),
      "application/json",
      "SCINTEL-investigation.json",
    );
});
document.addEventListener("submit", (event) => {
  if (event.target.id === "link-form") {
    event.preventDefault();
    const data = new FormData(event.target);
    ui.linkEvidenceId = data.get("evidence");
    ui.linkHypothesisId = data.get("hypothesis");
    ui.linkRelation = data.get("relation");
    update(
      (s) =>
        linkEvidence(
          s,
          data.get("evidence"),
          data.get("hypothesis"),
          data.get("relation"),
        ),
      "证据关系已记录。",
    );
  } else if (event.target.id === "decision-form") {
    event.preventDefault();
    if (!state.hypothesis) {
      toast("请先在假设检验中选择当前判断。");
      return;
    }
    if (state.rationale.trim().length < 20) {
      toast("请至少用 20 字说明决策依据与取舍。");
      document.querySelector("#rationale").focus();
      return;
    }
    const d = { ...ui.decision };
    confirm(
      "提交最终处置方案？",
      `<p>提交后将结束调查，锁定行动和证据关系，并揭示案例真相。</p><ul><li>${responseLabels[d.response]}</li><li>${supplierLabels[d.supplier]}</li><li>${inspectionLabels[d.inspection]}</li></ul>${decisionChecklist(false)}`,
      "提交并查看复盘",
      () => {
        if (update((s) => submitDecision(s, d), "决策已提交。")) go("report");
      },
    );
  }
});
document.addEventListener("input", (event) => {
  const el = event.target;
  if (el.id === "evidence-search") {
    ui.search = el.value;
    document.querySelector("#evidence-grid").innerHTML =
      filteredEvidence().map(evidenceCard).join("") ||
      '<p class="muted">没有符合条件的材料。</p>';
  }
  if (el.id === "rationale" || el.id === "reflection") {
    update((s) => setText(s, el.id, el.value), null, false);
    if (el.id === "rationale")
      document.querySelector("#rationale-count").textContent =
        `${el.value.trim().length} / 20 字起`;
  }
});
document.addEventListener("change", (event) => {
  const el = event.target;
  if (el.matches("#link-form select")) {
    const fields = {
      evidence: "linkEvidenceId",
      hypothesis: "linkHypothesisId",
      relation: "linkRelation",
    };
    ui[fields[el.name]] = el.value;
  }
  if (el.id === "evidence-filter") {
    ui.evidenceType = el.value;
    render();
  }
  const map = {
    "analysis-group": "groupBy",
    "analysis-supplier": "supplier",
    "analysis-factory": "factory",
  };
  if (map[el.id]) {
    ui[map[el.id]] = el.value;
    render();
  }
  if (el.matches('#decision-form input[type="radio"]')) {
    ui.decision[el.name] = el.value;
    save();
  }
});
window.addEventListener("hashchange", () => {
  dismissToast();
  ui.route = getRoute();
  const nextAction = getEvidenceAction();
  if (nextAction !== ui.evidenceAction) {
    ui.search = "";
    ui.evidenceType = "all";
  }
  ui.evidenceAction = nextAction;
  render();
  focusRoute();
});
document
  .querySelector("#evidence-dialog")
  .addEventListener("close", (event) => {
    document
      .querySelector(
        `[data-action="open-evidence"][data-id="${event.target.dataset.evidence}"]`,
      )
      ?.focus({ preventScroll: true });
  });
for (const dialog of document.querySelectorAll("dialog"))
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      )
        dialog.close();
    }
  });
render();
if (storageWarning) toast(storageWarning);
