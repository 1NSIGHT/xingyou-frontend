/**
 * 流程定义的前端类型与常量。
 *
 * ★ 与后端 FlowSchemaDef 一一对应，但**存储形态永远是原始 JSON 文本**
 *   （见 api/meta.ts 的 publishFlowApi 注释）。这里定义的类型只用于
 *   在设计器里读写，不参与持久化往返。
 *
 * ★ 最重要的约束：nodes 是**有序数组**，不是图。没有 transitions。
 *   从上到下即流转顺序，"分支"只由 skipWhen（整节点跳过）与
 *   returnTo（退回某个前序节点）表达。
 *
 *   这个约束直接决定了设计器的形态：节点可以上下调序，但**不能任意摆位**。
 *   一旦允许随意摆放，用户必然会以为能拖出分支 —— 而模型造不出来，
 *   于是变成一个"界面允许、保存后没效果"的坑。
 */

export const FLOW_STRUCTURE_V1 = 'xy-flow/v1'

/** 节点类型 */
export const NODE_TYPE_START = 'START'
export const NODE_TYPE_APPROVAL = 'APPROVAL'
export const NODE_TYPE_HANDLE = 'HANDLE'
export const NODE_TYPE_END = 'END'

export interface NodeTypeMeta {
  value: string
  label: string
  /** 一句话说明它和相邻类型的区别 —— 类型选错是这里最常见的错误 */
  hint: string
  color: string
  /** 是否需要一个审批人。START / END 不需要 */
  needsAssignee: boolean
  /** 是否允许配置退回目标 */
  returnable: boolean
}

export const NODE_TYPES: NodeTypeMeta[] = [
  {
    value: NODE_TYPE_START,
    label: '发起',
    hint: '单据提交，流程开始。全流程有且只有一个，固定在首位',
    color: '#909399',
    needsAssignee: false,
    returnable: false,
  },
  {
    value: NODE_TYPE_APPROVAL,
    label: '审批',
    hint: '审批人看到单据并给出同意 / 不同意 / 退回',
    color: '#409eff',
    needsAssignee: true,
    returnable: true,
  },
  {
    value: NODE_TYPE_HANDLE,
    label: '办理',
    hint: '被指派方补充内容或上传材料后提交，不是"同意与否"',
    color: '#e6a23c',
    needsAssignee: true,
    returnable: true,
  },
  {
    value: NODE_TYPE_END,
    label: '归档',
    hint: '流程结束，单据转为已关闭。全流程有且只有一个，固定在末位',
    color: '#67c23a',
    needsAssignee: false,
    returnable: false,
  },
]

export function nodeTypeMeta(type: string): NodeTypeMeta {
  return NODE_TYPES.find((t) => t.value === type) ?? NODE_TYPES[0]
}

/** 审批人规则类型 */
export const ASSIGNEE_TYPE_INITIATOR = 'INITIATOR'
export const ASSIGNEE_TYPE_ROLE = 'ROLE'
export const ASSIGNEE_TYPE_USER = 'USER'
export const ASSIGNEE_TYPE_FIELD = 'FIELD'
export const ASSIGNEE_TYPE_ORG_ROLE = 'ORG_ROLE'

export interface AssigneeTypeMeta {
  value: string
  label: string
  hint: string
}

export const ASSIGNEE_TYPES: AssigneeTypeMeta[] = [
  {
    value: ASSIGNEE_TYPE_INITIATOR,
    label: '发起人本人',
    hint: '回到提交单据的那个人。常用于"发起人补充材料"',
  },
  {
    value: ASSIGNEE_TYPE_ROLE,
    label: '按角色',
    hint: '该租户下所有持有此角色的人。角色是数据，改动用户角色即改变审批人',
  },
  {
    value: ASSIGNEE_TYPE_USER,
    label: '按指定人员',
    hint: '写死到具体的人。人员变动时需要回来改流程，尽量少用',
  },
  {
    value: ASSIGNEE_TYPE_FIELD,
    label: '按单据字段',
    hint: '取单据上某个人员字段的值。★ 这是让流程"跟着单据走"的方式',
  },
  {
    value: ASSIGNEE_TYPE_ORG_ROLE,
    label: '按组织 + 角色',
    hint: '取单据上某个组织字段所指的单位中、持有该角色的人',
  },
]

export function assigneeTypeMeta(type: string): AssigneeTypeMeta {
  return ASSIGNEE_TYPES.find((t) => t.value === type) ?? ASSIGNEE_TYPES[0]
}

export const MODE_ANY = 'ANY'
export const MODE_ALL = 'ALL'

/** 节点上可配置的动作白名单，与后端 FlowValidator.KNOWN_ACTIONS 一致 */
export interface ActionMeta {
  value: string
  label: string
}

export const ACTIONS: ActionMeta[] = [
  { value: 'APPROVE', label: '同意' },
  { value: 'REJECT', label: '不同意' },
  { value: 'RETURN', label: '退回' },
  { value: 'TRANSFER', label: '转办' },
  { value: 'ADD_SIGN', label: '加签' },
  { value: 'CC', label: '抄送' },
]

export const DEFAULT_ACTIONS = ['APPROVE', 'REJECT', 'RETURN']

export interface FlowAssignee {
  type: string
  roles?: string[]
  userIds?: number[]
  field?: string
  orgField?: string
  role?: string
}

export interface FlowNode {
  key: string
  type: string
  /** I18nText 的裸字符串形态，发布时后端会规范化为对象 */
  name: string
  assignee?: FlowAssignee
  mode?: string
  /** 满足则整节点跳过。这里先用简化的"字段 + 运算符 + 值"，与表单条件的存储形态一致 */
  skipWhen?: Record<string, unknown>
  dueDays?: number
  actions?: string[]
  /** 允许退回的前序节点 key */
  returnTo?: string[]
}

export interface FlowSettings {
  allowWithdraw?: boolean
  allowAddSign?: boolean
  allowTransfer?: boolean
  defaultHandleDays?: number
  overdueRemindDays?: number
}

export interface FlowSchema {
  $schema: string
  flowKey: string
  name: string
  formKey: string
  settings?: FlowSettings
  nodes: FlowNode[]
}

/**
 * 一份可以直接发布的空白流程。
 *
 * ★ 默认给的不是"只有起止"的空流程 —— 那种流程提交即归档，
 *   后端的 FlowValidator 会直接拒掉。默认给一条最小可用的真实链路，
 *   用户改比用户从零想更省事。
 */
export function emptyFlow(formKey = ''): FlowSchema {
  return {
    $schema: FLOW_STRUCTURE_V1,
    flowKey: '',
    name: '',
    formKey,
    settings: {
      allowWithdraw: true,
      allowAddSign: true,
      allowTransfer: true,
      defaultHandleDays: 7,
      overdueRemindDays: 2,
    },
    nodes: [
      { key: 'start', type: NODE_TYPE_START, name: '发起', actions: [] },
      {
        key: 'supervisor_review',
        type: NODE_TYPE_APPROVAL,
        name: '监理审核',
        assignee: { type: ASSIGNEE_TYPE_ROLE, roles: [] },
        mode: MODE_ANY,
        dueDays: 3,
        actions: [...DEFAULT_ACTIONS],
      },
      { key: 'end', type: NODE_TYPE_END, name: '归档', actions: [] },
    ],
  }
}

/**
 * 生成一个不与现有节点冲突的 key。
 *
 * 前缀按节点类型给：审批节点用 approve_ 而不是 node_，
 * 因为字段的节点作用域要靠人读这个 key 才知道自己配了什么。
 */
export function nextNodeKey(nodes: FlowNode[], type: string): string {
  const prefix =
    type === NODE_TYPE_APPROVAL
      ? 'approve'
      : type === NODE_TYPE_HANDLE
        ? 'handle'
        : type === NODE_TYPE_START
          ? 'start'
          : 'end'
  const used = new Set(nodes.map((n) => n.key))
  if (!used.has(prefix)) return prefix
  let i = 2
  while (used.has(`${prefix}_${i}`)) i++
  return `${prefix}_${i}`
}

/** key 的合法性，与后端 FlowValidator.KEY 同一条规则 */
export function isValidNodeKey(key: string): boolean {
  return /^[a-z][a-z0-9_]{0,62}$/.test(key)
}

/** 节点在第 index 位是否已经"结构上合法"—— 用来给未配完的节点打标 */
export function nodeProblems(node: FlowNode, index: number, total: number, all: FlowNode[]): string[] {
  const problems: string[] = []
  if (!node.name || !node.name.trim()) problems.push('缺少名称')
  if (!isValidNodeKey(node.key)) problems.push('key 不合法（小写字母开头，仅小写字母/数字/下划线）')
  if (index === 0 && node.type !== NODE_TYPE_START) problems.push('第一个节点必须是发起')
  if (index === total - 1 && node.type !== NODE_TYPE_END) problems.push('最后一个节点必须是归档')
  if (index > 0 && node.type === NODE_TYPE_START) problems.push('发起只能出现在首位')
  if (index < total - 1 && node.type === NODE_TYPE_END) problems.push('归档只能出现在末位')

  const meta = nodeTypeMeta(node.type)
  if (meta.needsAssignee) {
    const a = node.assignee
    if (!a || !a.type) {
      problems.push('缺少审批人配置')
    } else if (a.type === ASSIGNEE_TYPE_ROLE && !(a.roles ?? []).length) {
      problems.push('未选择角色')
    } else if (a.type === ASSIGNEE_TYPE_USER && !(a.userIds ?? []).length) {
      problems.push('未选择人员')
    } else if (a.type === ASSIGNEE_TYPE_FIELD && !a.field) {
      problems.push('未选择字段')
    } else if (a.type === ASSIGNEE_TYPE_ORG_ROLE && (!a.orgField || !a.role)) {
      problems.push('组织或角色未选全')
    }
  }

  const keys = new Set(all.map((n) => n.key))
  for (const target of node.returnTo ?? []) {
    const at = all.findIndex((n) => n.key === target)
    if (!keys.has(target)) problems.push(`退回目标 ${target} 不存在`)
    else if (at >= index) problems.push(`只能退回到前面的节点：${target}`)
    else if (all[at].type === NODE_TYPE_START) problems.push('不能退回到发起')
  }
  return problems
}

/** 审批人的一句话摘要，节点卡片上显示 */
export function assigneeSummary(node: FlowNode): string {
  const a = node.assignee
  if (!a || !a.type) return '未配置'
  switch (a.type) {
    case ASSIGNEE_TYPE_INITIATOR:
      return '发起人本人'
    case ASSIGNEE_TYPE_ROLE:
      return (a.roles ?? []).length ? `角色：${(a.roles ?? []).join('、')}` : '角色：未选择'
    case ASSIGNEE_TYPE_USER:
      return (a.userIds ?? []).length ? `指定 ${(a.userIds ?? []).length} 人` : '人员：未选择'
    case ASSIGNEE_TYPE_FIELD:
      return a.field ? `字段：${a.field}` : '字段：未选择'
    case ASSIGNEE_TYPE_ORG_ROLE:
      return a.orgField && a.role ? `组织字段 ${a.orgField} 中的 ${a.role}` : '组织角色：未选全'
    default:
      return '未配置'
  }
}
