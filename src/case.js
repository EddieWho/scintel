/*
 * The case file is deliberately data only.  The game engine treats it as a
 * read-only source of facts, so keeping the fictional records here makes the
 * investigation reproducible in the browser and in tests.
 */

const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
};

export const CASE = freeze({
  id: "counterfeit-001",
  version: 1,
  title: "K2 温控芯片异常调查",
  subtitle: "一场关于供应链、批次与证据权重的桌面调查",
  company: "北辰电子（NORTHSTAR ELECTRONICS）",
  product: "K2 系列便携式储能控制板",
  initialBudget: 100,
  initialHours: 12,

  hypotheses: [
    {
      id: "supplier",
      title: "供应商或其二级供方发生了元件替换",
      description:
        "问题集中在特定批次，可能来自供应商的上游来源或未经批准的替代料。",
    },
    {
      id: "machine",
      title: "工厂生产设备或维护导致失效",
      description:
        "温控失效可能由贴装、回流或测试设备漂移造成，并在某个工厂集中出现。",
    },
    {
      id: "design",
      title: "K2 设计或物料清单本身存在缺陷",
      description:
        "设计参数、物料清单或新版本控制变更可能让所有工厂都生产出同类问题。",
    },
  ],

  containmentOptions: [
    {
      id: "monitor",
      title: "继续发运并加密监测",
      description:
        "维持发运，增加抽检和客户回访；短期成本最低，但异常会继续暴露。",
      cost: 0,
      level: 0,
    },
    {
      id: "hold",
      title: "暂停 K2 出货",
      description: "在完成批次追溯前暂停 K2 出货，降低继续暴露的风险。",
      cost: 8,
      level: 1,
    },
    {
      id: "all",
      title: "暂停全部型号出货",
      description:
        "暂停北辰电子全部型号出货并开展全量复核，保护客户但会增加交付压力。",
      cost: 20,
      level: 2,
    },
  ],

  investigations: [
    {
      id: "trace",
      title: "追溯批次与物流",
      description:
        "把客户回报、批次、工厂和出货箱号接起来，寻找异常是否跨越工厂。",
      question: "异常是否只属于某两个批次，还是所有 K2 都有同一问题？",
      cost: 20,
      hours: 2,
      evidenceIds: ["E03", "E04"],
    },
    {
      id: "audit",
      title: "核查采购与二级供应商",
      description:
        "检查付款、报价和供应商的上游审核记录，确认是否出现未经批准的来源。",
      question: "价格变化和上游来源审核是否能解释批次异常？",
      cost: 20,
      hours: 2,
      evidenceIds: ["E05", "E06"],
    },
    {
      id: "machine",
      title: "比对设备维护与控制批次",
      description:
        "将设备维护、参数和同线控制批次进行比对，检查工厂设备是否漂移。",
      question: "生产设备的状态是否足以解释两批异常？",
      cost: 15,
      hours: 2,
      evidenceIds: ["E07"],
    },
    {
      id: "lab",
      title: "送实验室做真伪与电性复核",
      description:
        "对异常样品和留样做标识、外观与电性复核，判断元件是否为原批准来源。",
      question: "样品本身是否显示出非批准来源的特征？",
      cost: 25,
      hours: 3,
      evidenceIds: ["E08"],
    },
    {
      id: "design",
      title: "复核设计与物料清单",
      description:
        "检查 K2 的设计版本、物料清单和变更记录，并与一批正常控制样品对照。",
      question: "同一设计是否会在正常批次中也稳定地产生过热？",
      cost: 15,
      hours: 1,
      evidenceIds: ["E09"],
    },
    {
      id: "interview",
      title: "访谈产线与仓库人员",
      description:
        "听取现场人员对来料包装、换料和设备状态的回忆，并标注证言偏差。",
      question: "现场证言能否补足批次记录，还是需要其他证据交叉验证？",
      cost: 15,
      hours: 2,
      evidenceIds: ["E10"],
    },
  ],

  evidence: [
    {
      id: "E01",
      title: "客户投诉趋势",
      type: "客户数据",
      source: "客户服务台",
      date: "2026-05-18",
      reliability: "记录完整，能确认现象；暂时不能单独定位根因。",
      summary:
        "前一连续四周窗口关于 K2 过热的投诉为 50 起，当前连续四周窗口升至 61 起，增加约 22%。",
      body: [
        "前一连续四周观察窗口记录 50 起，当前连续四周观察窗口记录 61 起，增幅约 22%。",
        "多数客户描述为“长时间运行后外壳明显发热”，少数报告保护动作提前触发。",
        "工单中的批次照片不完整，客服尚未能把每一单都连到出货箱号。",
        "该投诉统计来自客户工单；批次表中的退货数量是已连到箱号的一部分，不能与 61 起直接相加或替换。",
      ],
      tags: ["过热", "趋势", "客户"],
      initial: true,
    },
    {
      id: "E02",
      title: "供应商健康分数快照",
      type: "供应商记录",
      source: "采购门户",
      date: "2026-02-28",
      reliability: "系统快照可核验，但距异常窗口较早，且只覆盖一级供应商。",
      summary: "一级供应商的绿色评分停留在上季度，二级供应商资料没有随之更新。",
      body: [
        "采购门户在 2 月底生成的供应商评分为绿色，之后没有新的完整评分快照。",
        "该评分主要检查交付与退货，不包括每个二级来源的元件真伪复核。",
        "评分记录显示“按期交付”权重高于“上游来源变更”字段。",
      ],
      tags: ["供应商", "审核", "时效"],
      initial: true,
    },
    {
      id: "E03",
      title: "批次质量抽样表",
      type: "质量数据",
      source: "质量实验室留样台账",
      date: "2026-05-19",
      reliability: "抽样和留样编号可复核；样本量有限，不能直接推算全部成品。",
      summary: "B2405 与 B2406 的失效集中度明显高于同规格的前四个批次。",
      body: [
        "前四个批次的抽样失效为零或个位数，B2405 与 B2406 的抽样失效显著偏高。",
        "两批均标为 K2 同一物料号，且分别进入东一厂与南二厂。",
        "台账可把样品连到来料批号，但尚未说明元件的最终来源。",
      ],
      tags: ["批次", "抽样", "K2"],
      initial: false,
      table: {
        headers: [
          "批次",
          "供应商",
          "工厂",
          "发运数量",
          "退货数量",
          "抽测数量",
          "失效数量",
        ],
        rows: [
          ["B2401", "恒川组件", "东一厂", 1000, 3, 20, 0],
          ["B2402", "恒川组件", "南二厂", 1000, 4, 20, 1],
          ["B2403", "启源电子", "东一厂", 1000, 2, 20, 0],
          ["B2404", "启源电子", "南二厂", 1000, 3, 20, 0],
          ["B2405", "启源电子", "东一厂", 1000, 18, 30, 17],
          ["B2406", "启源电子", "南二厂", 1000, 21, 30, 18],
        ],
      },
    },
    {
      id: "E04",
      title: "出货与来料批号交叉表",
      type: "追溯记录",
      source: "物流与仓库系统",
      date: "2026-05-19",
      reliability: "箱号和时间戳完整；跨系统手工合并的一行仍需复核。",
      summary: "B2405、B2406 分别流入两家工厂，异常并未沿着单一工厂聚集。",
      body: [
        "B2405 的箱号覆盖东一厂第 20 周的两条装配线，B2406 覆盖南二厂第 20 周的一条装配线。",
        "两个批次的上游物料描述都指向 K2 温控芯片的同一批准料号。",
        "前四个批次使用同一设计版本和相同设备参数，退货没有同样的集中峰值。",
      ],
      tags: ["追溯", "跨工厂", "批号"],
      initial: false,
      table: {
        headers: ["批次", "工厂", "主要出货周", "物料号", "上游箱号"],
        rows: [
          ["B2401", "东一厂", "第 17 周", "K2-TC-11", "A1701"],
          ["B2402", "南二厂", "第 17 周", "K2-TC-11", "A1702"],
          ["B2403", "东一厂", "第 18 周", "K2-TC-11", "A1803"],
          ["B2404", "南二厂", "第 18 周", "K2-TC-11", "A1804"],
          ["B2405", "东一厂", "第 20 周", "K2-TC-11", "K2-2405"],
          ["B2406", "南二厂", "第 20 周", "K2-TC-11", "K2-2406"],
        ],
      },
    },
    {
      id: "E05",
      title: "采购发票与报价变更",
      type: "采购记录",
      source: "财务共享中心",
      date: "2026-05-20",
      reliability: "发票金额和付款日期可核验；报价单的备注由人工填写。",
      summary: "异常批次前出现一次明显的降价和付款路径变化。",
      body: [
        "第 19 周，一家二级供方通过一级供应商提交的 K2 报价比历史中位数低 18%。",
        "降价备注写着“短期成本调整”，没有附上新的来源批准记录。",
        "B2405、B2406 的付款指向同一批中转订单；其他批次沿用原有订单路径。",
      ],
      tags: ["价格", "二级供应商", "订单"],
      initial: false,
    },
    {
      id: "E06",
      title: "二级供应商现场审核摘录",
      type: "审核记录",
      source: "供应商质量团队",
      date: "2026-05-21",
      reliability: "审核员笔记有照片索引；部分仓库标签在复查时已被替换。",
      summary: "上游仓库的来料标签与批准来源的包装规则不完全一致。",
      body: [
        "现场抽查发现一批 K2 外包装标签的字体、封签和批准样本有细小差异。",
        "上游仓库人员称成本调整期间曾临时更换分包商，但变更没有进入北辰电子的批准清单。",
        "审核记录没有把每个箱号直接连到 B2405 或 B2406，因此仍需结合追溯表判断范围。",
      ],
      tags: ["审核", "替代料", "包装"],
      initial: false,
    },
    {
      id: "E07",
      title: "设备维护与控制批次对照",
      type: "设备记录",
      source: "制造执行系统与设备工程组",
      date: "2026-05-21",
      reliability: "自动日志连续，控制批次与异常批次使用同一套设备参数。",
      summary: "两家工厂的关键设备均在校准期内，控制批次未出现相同过热模式。",
      body: [
        "东一厂与南二厂的贴装、回流和终检设备在第 20 周都有连续维护记录。",
        "异常批次前后各取一批控制生产，焊点外观与电性分布保持在历史范围内。",
        "设备记录不能证明元件一定合格，但不支持设备漂移是主要原因。",
      ],
      tags: ["设备", "控制批次", "排除"],
      initial: false,
    },
    {
      id: "E08",
      title: "元件真伪与电性复核报告",
      type: "实验室报告",
      source: "第三方电子材料实验室",
      date: "2026-05-22",
      reliability:
        "盲样编号和仪器记录完整；报告结论针对送检样本，不能自动覆盖其他批次。",
      summary:
        "送检样本的封装标记与电性特征不符合批准来源，强烈指向非批准元件。",
      body: [
        "来自 B2405、B2406 的盲样在封装激光标记、引脚镀层和静态电性曲线三处与批准样本不同。",
        "实验室认为样本与批准来源不一致的可能性很高，建议复核同一上游箱号的留样。",
        "该报告没有判断谁安排了替换，也没有估算全部成品的失效比例。",
      ],
      tags: ["真伪", "电性", "强证据"],
      initial: false,
    },
    {
      id: "E09",
      title: "设计与物料清单复核",
      type: "工程记录",
      source: "研发变更管理系统",
      date: "2026-05-22",
      reliability: "版本签名完整；只能覆盖已登记的设计变更。",
      summary: "K2 设计和物料清单在异常前后未变化，正常控制批次使用同一版本。",
      body: [
        "第 15 至 20 周没有 K2 温控阈值、封装规格或物料清单变更。",
        "B2401 至 B2404 的正常控制样品与异常批次使用同一设计版本，却没有同样的失效集中度。",
        "设计记录不能排除供应商未按清单交付，但不支持设计版本是触发点。",
      ],
      tags: ["设计", "物料清单", "控制批次"],
      initial: false,
    },
    {
      id: "E10",
      title: "产线证言摘录",
      type: "访谈记录",
      source: "质量经理访谈纪要",
      date: "2026-05-22",
      reliability:
        "证言来自一名知情人，时间距离事件较近但存在岗位偏差，需交叉验证。",
      summary:
        "受访者提到异常周设备曾短暂停机，但也承认没有看过完整的来料箱号。",
      body: [
        "一名产线领班回忆第 20 周有一次短暂停机，认为设备温度可能影响了焊接。",
        "他没有直接观察到元件替换，且希望避免把责任归到产线，因此证言可能存在偏差。",
        "设备自动日志和控制批次只能验证部分说法，单独采用这条证言会放大不确定性。",
      ],
      tags: ["证言", "偏差", "设备"],
      initial: false,
    },
  ],

  batches: [
    {
      id: "B2401",
      supplier: "恒川组件",
      factory: "东一厂",
      shipped: 1000,
      returns: 3,
      tested: 20,
      failed: 0,
    },
    {
      id: "B2402",
      supplier: "恒川组件",
      factory: "南二厂",
      shipped: 1000,
      returns: 4,
      tested: 20,
      failed: 1,
    },
    {
      id: "B2403",
      supplier: "启源电子",
      factory: "东一厂",
      shipped: 1000,
      returns: 2,
      tested: 20,
      failed: 0,
    },
    {
      id: "B2404",
      supplier: "启源电子",
      factory: "南二厂",
      shipped: 1000,
      returns: 3,
      tested: 20,
      failed: 0,
    },
    {
      id: "B2405",
      supplier: "启源电子",
      factory: "东一厂",
      shipped: 1000,
      returns: 18,
      tested: 30,
      failed: 17,
    },
    {
      id: "B2406",
      supplier: "启源电子",
      factory: "南二厂",
      shipped: 1000,
      returns: 21,
      tested: 30,
      failed: 18,
    },
  ],

  truth: {
    title: "二级供应链在成本冲击后替换了 K2 元件",
    explanation: [
      "B2405 与 B2406 在第 20 周分别进入东一厂和南二厂，异常因此跨越两家工厂而集中在两个批次。",
      "第 19 周出现的成本冲击伴随临时二级供方和未经批准的包装变化，时间上与异常窗口相连。",
      "实验室盲样与批准来源在封装和电性上都不一致，支持非批准元件进入这两个批次。",
      "两家工厂的设备和控制生产保持正常，设计与物料清单也未变化，因此机器和设计不是主要触发点。",
    ],
    missed: ["E04", "E05", "E06", "E08"],
  },

  correctLinks: [
    { evidenceId: "E03", hypothesisId: "supplier", relation: "supports" },
    { evidenceId: "E04", hypothesisId: "supplier", relation: "supports" },
    { evidenceId: "E05", hypothesisId: "supplier", relation: "supports" },
    { evidenceId: "E06", hypothesisId: "supplier", relation: "supports" },
    { evidenceId: "E07", hypothesisId: "machine", relation: "contradicts" },
    { evidenceId: "E08", hypothesisId: "supplier", relation: "supports" },
    { evidenceId: "E09", hypothesisId: "design", relation: "contradicts" },
    { evidenceId: "E10", hypothesisId: "machine", relation: "supports" },
  ],
});
