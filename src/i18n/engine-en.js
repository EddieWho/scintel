// English display catalogue for engine messages and scoring feedback.
// Runtime state and logs remain canonical Chinese; the translator uses this
// catalogue only at display boundaries.

export const TEXT = {
  案件开始: "Case started",
  提交决策: "Decision submitted",
  "调查：": "Investigation: ",
  "遏制：": "Containment: ",
  状态无效或与案件版本不兼容:
    "The state is invalid or incompatible with this case version",
  状态变更破坏了案件约束: "The state change violates the case constraints",
  请先开始案件: "Start the case first",
  结论提交后调查已锁定:
    "Investigation is locked after the conclusion is submitted",
  必须先选择遏制方案: "Select a containment option first",
  调查行动不存在: "Investigation action does not exist",
  调查行动不能重复: "Investigation actions cannot be repeated",
  预算不足: "Insufficient budget",
  时间不足: "Insufficient time",
  结论提交后遏制已锁定:
    "Containment is locked after the conclusion is submitted",
  遏制方案不存在: "Containment option does not exist",
  遏制方案只能升级: "Containment can only be upgraded",
  结论提交后证据阅读已锁定:
    "Evidence reading is locked after the conclusion is submitted",
  证据不存在: "Evidence does not exist",
  证据尚未解锁: "Evidence has not been unlocked",
  结论提交后证据链接已锁定:
    "Evidence links are locked after the conclusion is submitted",
  证据或假设不存在: "The evidence or hypothesis does not exist",
  证据关系不存在: "The evidence relationship does not exist",
  必须先阅读证据: "Read the evidence first",
  结论提交后假设已锁定:
    "The hypothesis is locked after the conclusion is submitted",
  假设不存在: "The hypothesis does not exist",
  结论提交后分析已锁定: "Analysis is locked after the conclusion is submitted",
  需要先完成批次追溯: "Complete batch tracing first",
  分析视图名称不能为空: "The analysis view name cannot be empty",
  文本字段不存在: "The text field does not exist",
  文本必须是字符串: "The text must be a string",
  提交后理由已锁定: "The rationale is locked after submission",
  案件尚未开始: "The case has not started",
  决策只能提交一次: "A decision can only be submitted once",
  必须选择遏制方案: "Select a containment option",
  必须选择一个假设: "Select a hypothesis",
  "理由至少需要 20 个字符": "The rationale must contain at least 20 characters",
  决策字段无效: "The decision fields are invalid",
  支持: "supports",
  反驳: "contradicts",
  供应商: "Supplier",
  工厂: "Factory",
  批次: "Batch",
  全部: "All",
  尚未阅读: "Unread",
  背景材料: "Background",
  "读过，未关联": "Read, not linked",
  关联正确: "Correctly linked",
  关系需复核: "Relationship needs review",
  高: "High",
  中: "Medium",
  低: "Low",
  风险已被及时压低: "Risk was reduced promptly",
  风险得到控制但仍需复核: "Risk is controlled but still needs review",
  仍有客户暴露风险: "Customers remain exposed to risk",
  定向范围已有批次追溯依据: "The targeted scope is supported by batch tracing",
  定向范围尚无完整批次追溯依据:
    "The targeted scope is not yet supported by complete batch tracing",
  全面范围覆盖未知批次: "The full scope includes unknown batches",
  未启动召回范围: "No recall scope was initiated",
  定向召回: "Targeted recall",
  全面召回: "Full recall",
  不启动召回: "No recall",
  暂停供应商: "Suspend the supplier",
  核查供应商: "Verify the supplier",
  维持供应商供货: "Keep the supplier supplying",
  加强检验: "Enhanced inspection",
  标准检验: "Standard inspection",
  先确认需要复核的关系实际支持还是反驳该假设:
    "First confirm whether relationships needing review actually support or contradict the hypothesis",
  可把已读的能帮助区分原因的材料与相关假设建立支持或反驳关系:
    "Link read materials that help distinguish causes to the relevant hypothesis as supporting or contradicting evidence",
  "按剩余疑点选择性补读即可，不需要读完所有记录":
    "Read selectively based on the remaining questions; you do not need to read every record",
  "E01、E02可保留为背景，不必强行链接到假设":
    "E01 and E02 can remain background context; they do not need to be forced into a hypothesis",
  可把已读证据的支持或反驳关系连到主假设:
    "Link read evidence to the main hypothesis as supporting or contradicting evidence",
  复核主假设下方向不一致的关系:
    "Review relationships under the main hypothesis whose direction is inconsistent",
  "这些证据在反驳你最终选择的假设，需要重新考虑结论":
    "These pieces of evidence contradict your final hypothesis; reconsider the conclusion",
  可用已读证据检查机器和设计等竞争解释:
    "Use read evidence to check competing explanations such as equipment and design",
  继续用相反方向的证据检查竞争解释:
    "Continue checking competing explanations with evidence pointing in the opposite direction",
  可在调查早期升级遏制以减少继续暴露:
    "Upgrade containment early in the investigation to reduce further exposure",
  "定向响应前补足 E03、E04 的批次范围证据，或选择更宽的响应范围":
    "Before a targeted response, complete the batch-scope evidence from E03 and E04, or choose a broader response scope",
  "供应商处置前补读 E06 或 E08 的来源证据":
    "Read source evidence E06 or E08 before taking supplier action",
  "目前没有阅读能帮助区分原因的调查材料，处置选择仍缺少记录依据":
    "No investigation material that helps distinguish causes has been read, so the action choice still lacks documentary support",
  "尚未启动召回范围，可在补足批次范围后重新确定响应":
    "No recall scope has been initiated; complete the batch scope and then reassess the response",
  "当前维持供应商供货，可先核查来源再决定是否暂停":
    "The supplier is currently continuing to supply; verify the source before deciding whether to suspend it",
  当前处置选择与已读范围证据保持对应:
    "The current action choice matches the scope of the evidence read",
  结论尚未提交: "The conclusion has not been submitted",
  "投诉趋势确认了过热现象在上升，但不能区分供应商、设备或设计根因。":
    "The complaint trend confirms that overheating is increasing but cannot distinguish a supplier, equipment, or design root cause.",
  "投诉趋势确认了过热现象在上升，但不能区分供应商、设备或设计根因":
    "The complaint trend confirms that overheating is increasing but cannot distinguish a supplier, equipment, or design root cause",
  "较早的绿色供应商分数只说明当时的记录状态，缺少二级来源更新，不能证明本次元件没有被替换，也不能单独证明元件为真或为假。":
    "The earlier green supplier score reflects only the records at that time; without tier-two source updates, it cannot prove that the component was not replaced or establish authenticity on its own.",
  "较早的绿色供应商分数只说明当时的记录状态，缺少二级来源更新，不能证明本次元件没有被替换，也不能单独证明元件为真或为假":
    "The earlier green supplier score reflects only the records at that time; without tier-two source updates, it cannot prove that the component was not replaced or establish authenticity on its own",
  "失效集中在 B2405 与 B2406，支持从供应商来源方向继续追查；抽样有限，不能单独推断全部成品。":
    "Failures are concentrated in B2405 and B2406, supporting further investigation of the supplier source; the sample is limited and cannot establish the condition of all finished products on its own.",
  "批号和箱号把异常连到两家工厂，支持从共同来源方向继续追查；它本身不能证明替换由谁安排。":
    "Batch and carton numbers connect the anomaly to two factories, supporting further investigation of a common source; they do not by themselves show who arranged the replacement.",
  "降价、临时二级供方和付款路径变化支持供应商来源假设；报价记录本身不能证明元件已经替换。":
    "The price reduction, temporary tier-two source, and payment-route change support the supplier-source hypothesis; the quotation record alone cannot prove that the component was replaced.",
  "包装差异和未经批准的临时分包商支持供应商来源假设；审核摘录尚未把每个箱号直接连到异常批次。":
    "Packaging differences and an unapproved temporary subcontractor support the supplier-source hypothesis; the audit excerpt has not directly linked every carton number to the anomalous batches.",
  "设备在校准期内且控制批次正常，反驳设备漂移是主要触发点；它不能证明元件本身一定合格。":
    "Equipment was within calibration and control batches were normal, contradicting equipment drift as the primary trigger; this does not prove that the components themselves were acceptable.",
  "送检样本的封装和电性不符批准来源，支持供应商来源假设；结论只覆盖送检样本和来源确认，不说明谁安排替换或全部成品比例。":
    "The submitted samples' packaging and electrical characteristics do not match the approved source, supporting the supplier-source hypothesis; the conclusion covers only the submitted samples and source match, not who arranged the replacement or the proportion of all finished products.",
  "异常前后的设计与物料清单没有变化，正常控制批次也使用同一版本，反驳设计版本是触发点；它不能排除供应商未按清单交付。":
    "The design and bill of materials did not change before or after the anomaly, and normal control batches used the same version, contradicting the design version as the trigger; this cannot rule out the supplier delivering against the bill of materials incorrectly.",
  "一名产线人员的证言较弱、权重较低，只支持调查设备这一方向，并需要设备日志或控制批次交叉验证。":
    "One production-line employee's testimony is weak and carries little weight; it only supports investigating equipment and requires cross-checking against equipment logs or control batches.",
  "证据链覆盖了主要异常来源，并能把记录连接起来。":
    "The evidence chain covers the main anomalous sources and connects the records.",
  "把实验室样品的真伪结果与供应商假设相连。":
    "Connected the laboratory sample authenticity result to the supplier hypothesis.",
  "用控制生产结果处理了设备假设，而不是只看一条证言。":
    "Used control-production results to assess the equipment hypothesis instead of relying on one testimony.",
  "用设计版本和控制批次检验了设计假设。":
    "Tested the design hypothesis with the design version and control batches.",
  "在调查早期就建立了遏制，降低了后续暴露。":
    "Established containment early in the investigation, reducing subsequent exposure.",
  "使用了分析视图整理证据关系。":
    "Used an analysis view to organize the evidence relationships.",
  "完成了一个可复核的调查决策。":
    "Completed a reviewable investigation decision.",
  "处置范围：选择了定向召回，但尚未读完 E03 与 E04 的批次范围证据；结局因此保留较高客户风险。":
    "Action scope: a targeted recall was selected, but the batch-scope evidence in E03 and E04 has not been fully read; the outcome therefore retains elevated customer risk.",
  该材料没有可登记的能帮助区分原因的关系:
    "This material has no recordable relationship that helps distinguish causes",
  "；该材料没有可登记的能帮助区分原因的关系":
    "; this material has no recordable relationship that helps distinguish causes",
  证据运用: "Evidence use",
  假设论证: "Hypothesis testing",
  决策质量: "Decision quality",
  "阅读可获得基础分；把能帮助区分原因的材料与假设建立“支持”或“反驳”关系，才体现证据运用。无需读完所有记录；E01、E02是背景，不必强行放进假设。":
    "Reading earns baseline points; evidence use is demonstrated by linking materials that help distinguish causes to a hypothesis as 'supporting' or 'contradicting'. You do not need to read every record; E01 and E02 are background and do not need to be forced into a hypothesis.",
  "比较供应商、设备和设计等竞争解释，用证据的支持与反驳关系说明主假设，并检查替代解释。":
    "Compare competing explanations involving the supplier, equipment, and design; use supporting and contradicting evidence relationships to explain the main hypothesis and check alternatives.",
  "按风险和证据选择及时、恰当的遏制、调查、供应商处置、响应范围与检验强度。":
    "Based on risk and evidence, choose timely and appropriate containment, investigation, supplier action, response scope, and inspection intensity.",
};

export const PATTERNS = [
  ["调查：{0}", "Investigation: {0}"],
  ["遏制：{0}", "Containment: {0}"],
  [
    "按{0}比较；供应商={1}；工厂={2}",
    "Compare by {0}; Supplier={1}; Factory={2}",
  ],
  ["支持“{0}”", "supports “{0}”"],
  ["反驳“{0}”", "contradicts “{0}”"],
  [
    "这条记录可{0}“{1}”。{2}",
    "This record can establish the relationship “{0}” with “{1}”. {2}",
  ],
  [
    "这条记录实际可{0}“{1}”，不能按“{2}”使用。{3}",
    "This record actually establishes the relationship “{0}” with “{1}”, and cannot be used as “{2}”. {3}",
  ],
  [
    "本案例评分记录的有效关系是{0}；不能据此{1}“{2}”。{3}",
    "The valid scoring relationships for this case are {0}; this record cannot establish the relationship “{1}” with “{2}”. {3}",
  ],
  [
    "这条记录只能说明{0}，不能据此{1}“{2}”。",
    "This record only indicates: {0}; it cannot establish the relationship “{1}” with “{2}”.",
  ],
  [
    "尚未阅读，暂不评价这条记录的使用。{0}",
    "Unread; its use is not evaluated yet. {0}",
  ],
  ["已阅读，作为背景记录保留。{0}", "Read and retained as background. {0}"],
  [
    "已阅读，但还没有把它与假设建立支持或反驳关系。{0}",
    "Read, but not linked to a hypothesis as supporting or contradicting evidence. {0}",
  ],
  [
    "已把这条记录用于至少一条与文档相符的关系。{0}",
    "This record has been used in at least one relationship consistent with the case record. {0}",
  ],
  [
    "已建立关系，但有 {0} 条关系与文档能证明的方向或范围不符，请复核。{1}",
    "Relationships have been created, but {0} do not match the direction or scope supported by the case record; please review. {1}",
  ],
  [
    "示意成本指数 = 已用预算 {0} + 暴露 {1} + 响应 {2} + 供应商处置 {3} + 检验 {4} = {5}，按每点 ¥1,000 计为 ¥{6}；{7}；供应商处置与检验另计交付影响，预计 {8} 天。",
    "Illustrative cost index = budget spent {0} + exposure {1} + response {2} + supplier action {3} + inspection {4} = {5}; at ¥1,000 per point, that is ¥{6}. {7}. Supplier action and inspection also affect delivery; estimated lead time: {8} days.",
  ],
  [
    "已阅读 {0} 条解锁证据，其中 {1} 条建立了正确关系；{2} 条能帮助区分原因的材料尚未链接，{3} 条关系需要复核，{4} 条尚未阅读。",
    "Read {0} unlocked evidence items; {1} have correct relationships. {2} materials that help distinguish causes are not linked, {3} relationships need review, and {4} items remain unread. ",
  ],
  [
    "你选择“{0}”作为主假设，已读 {1} 条证据并建立 {2} 条主假设关系，其中 {3} 条支持关系、{4} 条正确反驳关系，另有 {5} 条方向需要复核；另有 {6} 条关系用于其他假设，分析视图 {7} 个。",
    "You selected “{0}” as the main hypothesis, read {1} evidence items, and created {2} relationships for it: {3} supporting and {4} correctly contradicting; {5} relationships need review. Another {6} relationships concern other hypotheses, and there are {7} analysis views. ",
  ],
  [
    "调查期间未升级遏制，最终措施为“{0}”",
    "Containment was not upgraded during the investigation; the final measure was “{0}”",
  ],
  [
    "调查开始后 {0} 小时开始暂停出货，最终措施为“{1}”",
    "Shipments were suspended {0} hours after the investigation began; the final measure was “{1}”",
  ],
  [
    "调查在 {0} 小时后提交；选择{1}、{2}和{3}。",
    "The investigation was submitted after {0} hours; selected {1}, {2}, and {3}. ",
  ],
  [
    "{0} {1}：补充这条记录可缩小剩余不确定性。",
    "{0} {1}: Adding this record could narrow the remaining uncertainty.",
  ],
  ["；该证据登记为“{0}”", "; the evidence is recorded as “{0}”"],
  ["你标为“{0}”", "you marked it “{0}”"],
  ["（你标为“{0}”", " (you marked it “{0}”"],
  ["{0} {1} → {2}（你标为“{3}”{4}）", "{0} {1} → {2} (you marked it “{3}”{4})"],
  [
    "；{0} {1} → {2}（你标为“{3}”{4}）",
    "; {0} {1} → {2} (you marked it “{3}”{4})",
  ],
  [
    "链接复核：{0}。这些关系已从过程分数扣除。",
    "Link review: {0}. These relationships were deducted from the process score.",
  ],
  [
    "原始权重 {0} / 目标 24；已覆盖权重 {1}，关系扣分 {2}；归一化、取整并限于 0–40 后：{3}/40。",
    "Raw weight {0} / target 24; covered weight {1}, relationship penalty {2}; after normalization, rounding, and limiting to 0–40: {3}/40.",
  ],
  [
    "基础 {0} + 支持 {1} + 替代解释 {2} + 分析 {3} − 矛盾与错误链接 {4}；取整并限于 0–30 后：{5}/30。",
    "Base {0} + support {1} + alternative explanations {2} + analysis {3} − contradictions and incorrect links {4}; after rounding and limiting to 0–30: {5}/30.",
  ],
  [
    "遏制 {0} + 时点 {1} + 供应措施 {2} + 产品处置 {3} + 检验 {4}；取整并限于 0–30 后：{5}/30。",
    "Containment {0} + timing {1} + supplier action {2} + product disposition {3} + inspection {4}; after rounding and limiting to 0–30: {5}/30.",
  ],
];
