<template>
  <div class="fd">
    <!-- ─────────────────────────── 顶部：流程本身的信息 ─────────────────────────── -->
    <div class="fd-bar">
      <div class="fd-bar-left">
        <el-input v-model="flow.flowKey" class="fd-key" placeholder="流程标识，如 ncr_flow" :disabled="locked" />
        <el-input v-model="flow.name" class="fd-name" placeholder="流程名称，如 不符合项审批" />
        <el-select v-model="flow.formKey" class="fd-form" placeholder="绑定表单" @change="onFormChange">
          <el-option v-for="f in formList" :key="f.formKey" :label="formLabel(f)" :value="f.formKey" />
        </el-select>
      </div>
      <div class="fd-bar-right">
        <span v-if="version !== null" class="fd-version">已发布 v{{ version }}</span>
        <el-button @click="loadFlow" :disabled="!flow.flowKey">重新载入</el-button>
        <el-button type="primary" :loading="publishing" @click="publish">发布流程</el-button>
      </div>
    </div>

    <div class="fd-body">
      <!-- ─────────────────────────── 画布：流程图 ─────────────────────────── -->
      <div class="fd-scroll">
        <div class="fd-canvas" :style="{ width: CANVAS_W + 'px', height: canvasHeight + 'px' }">
          <!--
            连线画在节点下面。★ 位置全部是**算出来的**，不是拖出来的：
            模型是有序数组，纵向顺序就是流转顺序，所以几何完全由下标决定，
            不需要测量 DOM，也不会出现"连线和节点对不上"。
          -->
          <svg class="fd-svg" :width="CANVAS_W" :height="canvasHeight">
            <defs>
              <marker id="fd-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <path d="M0,0 L9,3 L0,6 z" fill="#a8abb2" />
              </marker>
              <marker id="fd-arrow-back" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <path d="M0,0 L9,3 L0,6 z" fill="#f56c6c" />
              </marker>
            </defs>

            <!-- 顺流：相邻节点之间 -->
            <g v-for="a in forwardArrows" :key="a.id">
              <line :x1="CARD_CX" :y1="a.y1" :x2="CARD_CX" :y2="a.y2" stroke="#c0c4cc" stroke-width="2" />
              <line
                :x1="CARD_CX"
                :y1="a.y2 - 10"
                :x2="CARD_CX"
                :y2="a.y2"
                stroke="#a8abb2"
                stroke-width="2"
                marker-end="url(#fd-arrow)"
              />
              <!-- 跳过条件的标签挂在入边上，因为它约束的是"要不要进入下一个节点" -->
              <g v-if="a.skipLabel">
                <rect :x="CARD_CX + 12" :y="a.y2 - 46" width="180" height="24" rx="12" fill="#fdf6ec" stroke="#e6a23c" />
                <text :x="CARD_CX + 24" :y="a.y2 - 29" font-size="12" fill="#b88230">{{ a.skipLabel }}</text>
              </g>
            </g>

            <!-- 退回：弧线绕到右侧 -->
            <g v-for="e in backEdges" :key="e.id">
              <path :d="e.d" fill="none" stroke="#f56c6c" stroke-width="2" stroke-dasharray="6 4" />
              <line
                :x1="e.ax + 11"
                :y1="e.ay"
                :x2="e.ax"
                :y2="e.ay"
                stroke="#f56c6c"
                stroke-width="2"
                marker-end="url(#fd-arrow-back)"
              />
              <text :x="e.labelX" :y="e.labelY" font-size="12" fill="#f56c6c">退回至 {{ e.targetName }}</text>
            </g>
          </svg>

          <!-- 节点 -->
          <div
            v-for="(node, i) in flow.nodes"
            :key="node.key + '@' + i"
            class="fd-node"
            :class="{ 'is-active': i === selected, 'is-drag': i === dragIndex, 'has-problem': problemsOf(node, i).length > 0 }"
            :style="nodeStyle(i)"
            draggable="true"
            @click="selected = i"
            @dragstart="onDragStart(i)"
            @dragover.prevent
            @drop="onDrop(i)"
            @dragend="dragIndex = -1"
          >
            <span class="fd-node-stripe" :style="{ background: typeMeta(node.type).color }" />
            <div class="fd-node-main">
              <div class="fd-node-head">
                <span class="fd-node-type" :style="{ color: typeMeta(node.type).color, borderColor: typeMeta(node.type).color }">
                  {{ typeMeta(node.type).label }}
                </span>
                <span class="fd-node-title">{{ node.name || '（未命名）' }}</span>
                <span class="fd-node-key">{{ node.key }}</span>
              </div>
              <div class="fd-node-meta">
                <template v-if="typeMeta(node.type).needsAssignee">
                  <span>{{ assigneeSummary(node) }}</span>
                  <span v-if="node.mode === 'ALL'" class="fd-tag">会签</span>
                  <span v-else class="fd-tag">或签</span>
                  <span v-if="node.dueDays" class="fd-tag">{{ node.dueDays }} 天</span>
                </template>
                <span v-else class="fd-dim">{{ typeMeta(node.type).hint }}</span>
              </div>
              <div v-if="problemsOf(node, i).length" class="fd-node-problems">
                {{ problemsOf(node, i).join(' · ') }}
              </div>
              <div v-if="(node.returnTo ?? []).length" class="fd-node-back">
                可退回：{{ (node.returnTo ?? []).join('、') }}
              </div>
            </div>
            <div class="fd-node-ops" @click.stop>
              <el-button size="small" text :disabled="i === 0" @click="move(i, -1)">↑</el-button>
              <el-button size="small" text :disabled="i === flow.nodes.length - 1" @click="move(i, 1)">↓</el-button>
              <el-button size="small" text type="danger" :disabled="flow.nodes.length <= 2" @click="remove(i)">✕</el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- ─────────────────────────── 右侧：属性面板 ─────────────────────────── -->
      <aside class="fd-panel">
        <template v-if="current">
          <h3 class="fd-panel-title">
            节点属性
            <span class="fd-panel-sub">{{ current.key }}</span>
          </h3>

          <el-form label-position="top" size="default">
            <el-form-item label="名称">
              <el-input v-model="current.name" placeholder="如 监理审核" />
            </el-form-item>

            <el-form-item label="标识 key">
              <el-input :model-value="current.key" @update:model-value="renameKey" />
              <div class="fd-hint">
                字段的「可写节点 / 必填节点 / 可见节点」按这个 key 引用它。改名会同步改写引用它的退回配置。
              </div>
            </el-form-item>

            <el-form-item label="类型">
              <el-select v-model="current.type" @change="onTypeChange">
                <el-option v-for="t in NODE_TYPES" :key="t.value" :label="t.label" :value="t.value" />
              </el-select>
              <div class="fd-hint">{{ typeMeta(current.type).hint }}</div>
            </el-form-item>

            <template v-if="typeMeta(current.type).needsAssignee">
              <el-divider content-position="left">审批人</el-divider>

              <el-form-item label="规则">
                <el-select v-model="currentAssignee.type" @change="onAssigneeTypeChange">
                  <el-option v-for="a in ASSIGNEE_TYPES" :key="a.value" :label="a.label" :value="a.value" />
                </el-select>
                <div class="fd-hint">{{ assigneeTypeMeta(currentAssignee.type).hint }}</div>
              </el-form-item>

              <el-form-item v-if="currentAssignee.type === ASSIGNEE_TYPE_ROLE" label="角色">
                <el-select v-model="currentAssignee.roles" multiple placeholder="选择角色">
                  <el-option v-for="r in roles" :key="r.code" :label="`${r.name}（${r.code}）`" :value="r.code" />
                </el-select>
              </el-form-item>

              <el-form-item v-if="currentAssignee.type === ASSIGNEE_TYPE_USER" label="人员">
                <el-select
                  v-model="currentAssignee.userIds"
                  multiple
                  filterable
                  remote
                  :remote-method="searchUsers"
                  placeholder="输入姓名或账号搜索"
                >
                  <el-option v-for="u in users" :key="u.id" :label="`${u.realName || u.username}（${u.username}）`" :value="u.id" />
                </el-select>
              </el-form-item>

              <el-form-item v-if="currentAssignee.type === ASSIGNEE_TYPE_FIELD" label="人员字段">
                <el-select v-model="currentAssignee.field" clearable placeholder="选择单据上的人员字段">
                  <el-option v-for="f in userFields" :key="f.key" :label="`${f.name}（${f.key}）`" :value="f.key" />
                </el-select>
              </el-form-item>

              <template v-if="currentAssignee.type === ASSIGNEE_TYPE_ORG_ROLE">
                <el-form-item label="组织字段">
                  <el-select v-model="currentAssignee.orgField" clearable placeholder="选择单据上的组织字段">
                    <el-option v-for="f in orgFields" :key="f.key" :label="`${f.name}（${f.key}）`" :value="f.key" />
                  </el-select>
                </el-form-item>
                <el-form-item label="该组织下的角色">
                  <el-select v-model="currentAssignee.role" clearable placeholder="选择角色">
                    <el-option v-for="r in roles" :key="r.code" :label="`${r.name}（${r.code}）`" :value="r.code" />
                  </el-select>
                </el-form-item>
              </template>

              <el-form-item label="签署方式">
                <el-radio-group v-model="current.mode">
                  <el-radio-button value="ANY">或签（一人同意即可）</el-radio-button>
                  <el-radio-button value="ALL">会签（全部同意才通过）</el-radio-button>
                </el-radio-group>
              </el-form-item>

              <el-form-item label="处理时限（天）">
                <el-input-number v-model="current.dueDays" :min="1" :max="365" />
              </el-form-item>

              <el-divider content-position="left">可用动作</el-divider>
              <el-form-item label="本节点允许">
                <el-checkbox-group v-model="currentActions">
                  <el-checkbox v-for="a in availableActions" :key="a.value" :value="a.value">{{ a.label }}</el-checkbox>
                </el-checkbox-group>
              </el-form-item>

              <el-divider content-position="left">退回</el-divider>
              <el-form-item label="允许退回到">
                <el-checkbox-group v-model="currentReturnTo">
                  <el-checkbox v-for="c in returnCandidates" :key="c.key" :value="c.key">
                    {{ c.name || c.key }}
                  </el-checkbox>
                </el-checkbox-group>
                <div class="fd-hint">只能退回到它前面的节点。这一条就是这个模型里"分支"的全部表达能力。</div>
              </el-form-item>
            </template>

            <el-divider content-position="left">跳过条件</el-divider>
            <el-form-item label="满足条件时整个节点跳过">
              <el-switch v-model="skipOn" :disabled="current.type === NODE_TYPE_START" />
              <div class="fd-hint">
                注意：条件按单据**已保存的值**判断，不是本次提交的值。
              </div>
            </el-form-item>
            <template v-if="skipOn">
              <el-form-item label="条件">
                <div class="fd-cond">
                  <el-select v-model="skip.field" clearable placeholder="字段" @change="syncSkip">
                    <el-option v-for="f in allFields" :key="f.key" :label="f.name" :value="f.key" />
                  </el-select>
                  <el-select v-model="skip.op" placeholder="运算符" @change="syncSkip">
                    <el-option v-for="o in OPS" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                  <el-input
                    v-if="skip.op !== 'notEmpty'"
                    v-model="skip.value"
                    placeholder="值"
                    @update:model-value="syncSkip"
                  />
                </div>
              </el-form-item>
            </template>
          </el-form>
        </template>

        <el-empty v-else description="点击左侧节点编辑属性" />

        <el-divider content-position="left">在下方插入</el-divider>
        <div class="fd-insert">
          <el-button v-for="t in insertableTypes" :key="t.value" size="small" @click="insertAfter(t.value)">
            ＋ {{ t.label }}
          </el-button>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ACTIONS,
  ASSIGNEE_TYPES,
  ASSIGNEE_TYPE_FIELD,
  ASSIGNEE_TYPE_INITIATOR,
  ASSIGNEE_TYPE_ORG_ROLE,
  ASSIGNEE_TYPE_ROLE,
  ASSIGNEE_TYPE_USER,
  MODE_ANY,
  NODE_TYPES,
  NODE_TYPE_APPROVAL,
  NODE_TYPE_END,
  NODE_TYPE_HANDLE,
  NODE_TYPE_START,
  assigneeSummary,
  assigneeTypeMeta,
  emptyFlow,
  isValidNodeKey,
  nextNodeKey,
  nodeProblems,
  nodeTypeMeta,
  type FlowAssignee,
  type FlowNode,
  type FlowSchema,
} from '@/flow/types'
import { getFlowDefinitionApi, listFormsApi, publishFlowApi, getPublishedFormApi, type FormSummary } from '@/api/meta'
import { getRoleListApi, type RoleVO } from '@/api/system/role'
import { getUserPageApi, type UserVO } from '@/api/system/user'

// ───────────────────────────────── 几何 ─────────────────────────────────
//
// ★ 全部是常量，节点位置由下标算出 —— 因为这模型是**有序数组**，不是图。
//   位置没有自由度，也就不需要测量 DOM。ROW 固定高度还顺带让卡片看起来整齐，
//   像一张真正的流程图而不是一堆高低不齐的卡片。
const CANVAS_W = 780
const CARD_X = 32
const CARD_W = 420
const CARD_H = 104
const GAP = 58
const PITCH = CARD_H + GAP
const CARD_CX = CARD_X + CARD_W / 2
const BACK_X0 = CARD_X + CARD_W + 46

const OPS = [
  { value: 'eq', label: '等于' },
  { value: 'ne', label: '不等于' },
  { value: 'gt', label: '大于' },
  { value: 'gte', label: '大于等于' },
  { value: 'lt', label: '小于' },
  { value: 'lte', label: '小于等于' },
  { value: 'notEmpty', label: '已填写' },
]

interface FieldRef {
  key: string
  name: string
  type: string
}

const route = useRoute()

const flow = reactive<FlowSchema>(emptyFlow())
const version = ref<number | null>(null)
const selected = ref(0)
const dragIndex = ref(-1)
const publishing = ref(false)
const locked = ref(false)

const roles = ref<RoleVO[]>([])
const users = ref<UserVO[]>([])
const formList = ref<FormSummary[]>([])
const allFields = ref<FieldRef[]>([])

const userFields = computed(() => allFields.value.filter((f) => f.type === 'userPicker'))
const orgFields = computed(() => allFields.value.filter((f) => f.type === 'orgPicker'))

/** 可插入的类型：起止节点由结构约束决定，不能手动插 */
const insertableTypes = NODE_TYPES.filter(
  (t) => t.value !== NODE_TYPE_START && t.value !== NODE_TYPE_END,
)

const canvasHeight = computed(() => Math.max(1, flow.nodes.length - 1) * PITCH + CARD_H + 40)

const current = computed<FlowNode | undefined>(() => flow.nodes[selected.value])

const typeMeta = nodeTypeMeta

/** 节点上可用的动作：END 不能退回 */
const availableActions = computed(() => {
  if (current.value?.type === NODE_TYPE_END) {
    return ACTIONS.filter((a) => a.value !== 'RETURN')
  }
  return ACTIONS
})

/** 能作为退回目标的：本节点**之前**的非 START 节点 */
const returnCandidates = computed<FlowNode[]>(() =>
  flow.nodes.slice(0, selected.value).filter((n) => n.type !== NODE_TYPE_START),
)

/** 审批人对象。没有就补一个 —— 面板永远操作一个真实对象，避免"改了没生效" */
const currentAssignee = computed<FlowAssignee>(() => {
  const n = current.value
  if (!n) return { type: ASSIGNEE_TYPE_INITIATOR }
  if (!n.assignee) n.assignee = { type: ASSIGNEE_TYPE_INITIATOR }
  return n.assignee
})

/** v-model 需要成员表达式，所以这三个走 computed 代理 */
const currentActions = computed<string[]>({
  get: () => current.value?.actions ?? [],
  set: (v) => {
    if (current.value) current.value.actions = v
  },
})

const currentReturnTo = computed<string[]>({
  get: () => current.value?.returnTo ?? [],
  set: (v) => {
    if (current.value) current.value.returnTo = v
  },
})

/** 跳过条件的编辑态。存储上仍是一个标准 Condition 对象 */
const skip = reactive<{ field: string; op: string; value: string }>({ field: '', op: 'eq', value: '' })

const skipOn = computed<boolean>({
  get: () => {
    const c = current.value?.skipWhen
    return !!c && typeof c === 'object' && 'field' in c
  },
  set: (on) => {
    if (!current.value) return
    if (on) {
      current.value.skipWhen = { field: skip.field || '', op: skip.op, value: skip.value || undefined }
    } else {
      delete current.value.skipWhen
    }
  },
})

function syncSkip() {
  if (!current.value || !skipOn.value) return
  current.value.skipWhen = {
    field: skip.field,
    op: skip.op,
    value: skip.op === 'notEmpty' ? undefined : skip.value,
  }
}

/** 选中节点变化时，把它的条件回填到编辑态 */
function pullSkip() {
  const c = current.value?.skipWhen as Record<string, unknown> | undefined
  if (c && typeof c === 'object' && typeof c.field === 'string') {
    skip.field = c.field
    skip.op = typeof c.op === 'string' ? c.op : 'eq'
    skip.value = c.value == null ? '' : String(c.value)
  } else {
    skip.field = ''
    skip.op = 'eq'
    skip.value = ''
  }
}

// ───────────────────────────────── 连线几何 ─────────────────────────────────

interface FwdArrow {
  id: string
  y1: number
  y2: number
  skipLabel: string
}

const forwardArrows = computed<FwdArrow[]>(() =>
  flow.nodes.slice(0, -1).map((_, i) => {
    const next = flow.nodes[i + 1]
    const c = next?.skipWhen as Record<string, unknown> | undefined
    const hasSkip = !!c && typeof c === 'object' && typeof c.field === 'string'
    return {
      id: `f${i}`,
      y1: i * PITCH + CARD_H,
      y2: (i + 1) * PITCH,
      skipLabel: hasSkip ? `${String(c?.field)} ${String(c?.op)} 时跳过` : '',
    }
  }),
)

interface BackEdge {
  id: string
  d: string
  ax: number
  ay: number
  labelX: number
  labelY: number
  targetName: string
}

/**
 * 退回弧线。多条同时存在时逐条向外让开，避免叠在一起看不清有几条。
 *
 * 全部由 |下标差| 算出，不需要测量任何元素。
 */
const backEdges = computed<BackEdge[]>(() => {
  const list: BackEdge[] = []
  let k = 0
  flow.nodes.forEach((n, i) => {
    for (const target of n.returnTo ?? []) {
      const j = flow.nodes.findIndex((x) => x.key === target)
      if (j < 0 || j >= i) continue
      const bx = BACK_X0 + k * 28
      const r = 16
      const y1 = i * PITCH + CARD_H / 2
      const y2 = j * PITCH + CARD_H / 2
      const s = y2 < y1 ? -1 : 1
      const x0 = CARD_X + CARD_W
      const d =
        `M ${x0} ${y1} H ${bx - r} Q ${bx} ${y1} ${bx} ${y1 + s * r} ` +
        `V ${y2 - s * r} Q ${bx} ${y2} ${bx - r} ${y2} H ${x0}`
      list.push({
        id: `${n.key}->${target}@${k}`,
        d,
        ax: x0,
        ay: y2,
        labelX: bx - 74,
        labelY: (y1 + y2) / 2,
        targetName: flow.nodes[j]?.name || target,
      })
      k++
    }
  })
  return list
})

function nodeStyle(i: number) {
  return {
    left: `${CARD_X}px`,
    top: `${i * PITCH}px`,
    width: `${CARD_W}px`,
    height: `${CARD_H}px`,
  }
}

function problemsOf(node: FlowNode, i: number): string[] {
  return nodeProblems(node, i, flow.nodes.length, flow.nodes)
}

// ───────────────────────────────── 编辑动作 ─────────────────────────────────

function insertAfter(type: string) {
  const key = nextNodeKey(flow.nodes, type)
  const node: FlowNode = {
    key,
    type,
    name: nodeTypeMeta(type).label,
  }
  if (nodeTypeMeta(type).needsAssignee) {
    node.assignee = { type: ASSIGNEE_TYPE_ROLE, roles: [] }
    node.mode = MODE_ANY
    node.dueDays = 3
    node.actions = ['APPROVE', 'REJECT', 'RETURN']
  } else {
    node.actions = []
  }
  // 插到当前节点之后、且不允许越到 END 之后
  const at = Math.min(selected.value + 1, flow.nodes.length - 1)
  flow.nodes.splice(at, 0, node)
  selected.value = at
  pullSkip()
}

function remove(i: number) {
  if (flow.nodes.length <= 2) return
  const [gone] = flow.nodes.splice(i, 1)
  // ★ 别人还指着它退回呢。删掉节点必须同时清掉悬空引用，
  //   否则发布时会被后端的交叉校验拦下，而用户看不出是谁引用了它。
  const orphans: string[] = []
  for (const n of flow.nodes) {
    if (n.returnTo?.includes(gone.key)) {
      n.returnTo = n.returnTo.filter((t) => t !== gone.key)
      orphans.push(n.key)
    }
  }
  selected.value = Math.min(selected.value, flow.nodes.length - 1)
  if (orphans.length) {
    ElMessage.info(`已同时清除 ${orphans.join('、')} 上对该节点的退回配置`)
  }
  pullSkip()
}

function move(i: number, delta: number) {
  const j = i + delta
  if (j < 0 || j >= flow.nodes.length) return
  const [n] = flow.nodes.splice(i, 1)
  flow.nodes.splice(j, 0, n)
  selected.value = j
}

function onDragStart(i: number) {
  dragIndex.value = i
}

function onDrop(i: number) {
  const from = dragIndex.value
  dragIndex.value = -1
  if (from < 0 || from === i) return
  const [n] = flow.nodes.splice(from, 1)
  flow.nodes.splice(i, 0, n)
  selected.value = i
}

/**
 * 改节点 key。
 *
 * ★ 必须同步改写其它节点的 returnTo —— 否则改名会把别人的退回配置变成悬空引用，
 *   而且用户完全看不出来（他改的是 A 的名字，坏掉的是 B 的配置）。
 */
function renameKey(next: string) {
  const node = current.value
  if (!node) return
  const prev = node.key
  node.key = next
  if (!isValidNodeKey(next)) return
  for (const n of flow.nodes) {
    if (n.returnTo?.includes(prev)) {
      n.returnTo = n.returnTo.map((t) => (t === prev ? next : t))
    }
  }
}

function onTypeChange() {
  const node = current.value
  if (!node) return
  if (nodeTypeMeta(node.type).needsAssignee) {
    if (!node.assignee) node.assignee = { type: ASSIGNEE_TYPE_ROLE, roles: [] }
    if (!node.mode) node.mode = MODE_ANY
    if (!node.dueDays) node.dueDays = 3
    if (!node.actions?.length) node.actions = ['APPROVE', 'REJECT', 'RETURN']
  } else {
    // 起止节点不该带审批人，留着会被后端校验拒掉
    delete node.assignee
    delete node.mode
    delete node.dueDays
    node.actions = []
    node.returnTo = []
  }
  pullSkip()
}

function onAssigneeTypeChange() {
  const a = currentAssignee.value
  // 换规则时清掉上一种规则的参数，避免留下互相矛盾的残留
  delete a.roles
  delete a.userIds
  delete a.field
  delete a.orgField
  delete a.role
  if (a.type === ASSIGNEE_TYPE_ROLE) a.roles = []
  if (a.type === ASSIGNEE_TYPE_USER) a.userIds = []
}

async function searchUsers(keyword: string) {
  try {
    const page = await getUserPageApi({ keyword, current: 1, size: 30 })
    users.value = page.records
  } catch {
    users.value = []
  }
}

// ───────────────────────────────── 表单字段 ─────────────────────────────────

/**
 * 从已发布的表单定义里提取字段清单。
 *
 * ★ 递归遍历整棵 JSON，而不是按已知的层级去取：schema 是低代码的，
 *   层级随时会变（新增布局容器等），写死路径会在下次改结构时静默少字段。
 */
function collectFields(node: unknown, out: FieldRef[]) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    node.forEach((c) => collectFields(c, out))
    return
  }
  const obj = node as Record<string, unknown>
  if (typeof obj.key === 'string' && typeof obj.type === 'string' && typeof obj.name === 'string') {
    out.push({ key: obj.key, name: obj.name, type: obj.type })
  }
  Object.values(obj).forEach((v) => collectFields(v, out))
}

async function onFormChange(formKey: string) {
  allFields.value = []
  if (!formKey) return
  try {
    const published = await getPublishedFormApi(formKey)
    const out: FieldRef[] = []
    collectFields(published.schema, out)
    allFields.value = out
  } catch {
    ElMessage.warning('该表单尚未发布，无法读取字段清单')
  }
}

function formLabel(f: FormSummary) {
  let name = f.formKey
  try {
    const parsed = JSON.parse(f.name ?? '{}') as Record<string, string>
    name = parsed['zh-CN'] || f.formKey
  } catch {
    name = f.formKey
  }
  return `${name}（${f.formKey}）`
}

// ───────────────────────────────── 载入与发布 ─────────────────────────────────

async function loadFlow() {
  if (!flow.flowKey) {
    ElMessage.warning('请先填写流程标识')
    return
  }
  try {
    const raw = await getFlowDefinitionApi(flow.flowKey)
    if (!raw) {
      ElMessage.info('该流程还没有已发布版本，当前是新流程')
      return
    }
    const def = JSON.parse(raw) as FlowSchema
    flow.$schema = def.$schema
    flow.flowKey = def.flowKey
    flow.name = typeof def.name === 'string' ? def.name : ''
    flow.formKey = def.formKey
    flow.settings = def.settings ?? flow.settings
    flow.nodes = (def.nodes ?? []).map((n) => ({
      ...n,
      name: typeof n.name === 'string' ? n.name : String((n.name as unknown as Record<string, string>)?.['zh-CN'] ?? ''),
    }))
    selected.value = 0
    locked.value = true
    pullSkip()
    await onFormChange(flow.formKey)
    ElMessage.success('已载入已发布的流程定义')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '载入失败')
  }
}

async function publish() {
  // 先在本地把能查的都查出来，别让用户提交一次才知道少填了什么
  const local: string[] = []
  if (!isValidNodeKey(flow.flowKey)) local.push('流程标识不合法（小写字母开头，仅小写字母/数字/下划线）')
  if (!flow.name?.trim()) local.push('流程名称不能为空')
  if (!flow.formKey) local.push('必须绑定一张已发布的表单')
  if (!flow.nodes.some((n) => n.type === NODE_TYPE_APPROVAL || n.type === NODE_TYPE_HANDLE)) {
    local.push('至少要有一个审批或办理节点，否则单据提交即归档')
  }
  flow.nodes.forEach((n, i) => {
    problemsOf(n, i).forEach((p) => local.push(`节点「${n.name || n.key}」：${p}`))
  })
  // 重复 key
  const seen = new Set<string>()
  for (const n of flow.nodes) {
    if (seen.has(n.key)) local.push(`节点标识重复：${n.key}`)
    seen.add(n.key)
  }
  if (local.length) {
    await ElMessageBox.alert(local.map((s) => `· ${s}`).join('\n'), '发布前请先修正', { type: 'warning' })
    return
  }

  publishing.value = true
  try {
    const payload = {
      $schema: flow.$schema,
      flowKey: flow.flowKey,
      name: flow.name,
      formKey: flow.formKey,
      settings: flow.settings,
      nodes: flow.nodes,
    }
    const res = await publishFlowApi(payload)
    version.value = res.version
    locked.value = true
    ElMessage.success(`发布成功，版本 v${res.version}`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '发布失败')
  } finally {
    publishing.value = false
  }
}

onMounted(async () => {
  try {
    roles.value = await getRoleListApi()
  } catch {
    roles.value = []
  }
  try {
    formList.value = await listFormsApi()
  } catch {
    formList.value = []
  }

  const key = route.params.formKey as string | undefined
  if (key) {
    // 从表单设计器跳过来时带上 formKey
    flow.formKey = key
    await onFormChange(key)
  }
  const flowKey = route.query.flowKey as string | undefined
  if (flowKey) {
    flow.flowKey = flowKey
    await loadFlow()
  }
  pullSkip()
})
</script>

<style scoped>
.fd {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);
  background: #fff;
}

/* ─────────────────────────── 顶部 ─────────────────────────── */
.fd-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  flex: 0 0 auto;
}
.fd-bar-left {
  display: flex;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.fd-key {
  width: 220px;
}
.fd-name {
  width: 260px;
}
.fd-form {
  width: 280px;
}
.fd-bar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.fd-version {
  font-size: 12px;
  color: #67c23a;
  background: #f0f9eb;
  border-radius: 3px;
  padding: 2px 8px;
}

/* ─────────────────────────── 主体 ─────────────────────────── */
.fd-body {
  display: flex;
  flex: 1;
  min-height: 0;
}
.fd-scroll {
  flex: 1;
  overflow: auto;
  /* 网格底纹：让"这是一块画布"一眼可见，而不是一片空白 */
  background-color: #fafbfc;
  background-image:
    linear-gradient(#eef1f5 1px, transparent 1px),
    linear-gradient(90deg, #eef1f5 1px, transparent 1px);
  background-size: 24px 24px;
}
.fd-canvas {
  position: relative;
  margin: 24px auto;
}
.fd-svg {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 0;
  /* 连线不吃点击，否则节点边缘的点击会被 SVG 截走 */
  pointer-events: none;
}

/* ─────────────────────────── 节点 ─────────────────────────── */
.fd-node {
  position: absolute;
  z-index: 1;
  display: flex;
  align-items: stretch;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgb(0 0 0 / 6%);
  cursor: grab;
  overflow: hidden;
  transition: box-shadow 0.15s, border-color 0.15s;
}
.fd-node:hover {
  border-color: #c0c4cc;
  box-shadow: 0 2px 10px rgb(0 0 0 / 10%);
}
.fd-node.is-active {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgb(64 158 255 / 18%);
}
.fd-node.has-problem {
  border-color: #f56c6c;
}
.fd-node.is-drag {
  opacity: 0.5;
}
.fd-node-stripe {
  flex: 0 0 6px;
}
.fd-node-main {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}
.fd-node-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fd-node-type {
  flex: 0 0 auto;
  font-size: 12px;
  line-height: 18px;
  padding: 0 6px;
  border: 1px solid;
  border-radius: 3px;
}
.fd-node-title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fd-node-key {
  margin-left: auto;
  flex: 0 0 auto;
  font-family: Consolas, monospace;
  font-size: 12px;
  color: #a8abb2;
}
.fd-node-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #606266;
}
.fd-tag {
  background: #f0f2f5;
  border-radius: 3px;
  padding: 0 6px;
  font-size: 12px;
  color: #606266;
}
.fd-dim {
  color: #a8abb2;
}
.fd-node-problems {
  font-size: 12px;
  color: #f56c6c;
}
.fd-node-back {
  font-size: 12px;
  color: #e6a23c;
}
.fd-node-ops {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 6px;
  border-left: 1px solid #f2f3f5;
}

/* ─────────────────────────── 属性面板 ─────────────────────────── */
.fd-panel {
  flex: 0 0 348px;
  border-left: 1px solid #ebeef5;
  padding: 16px;
  overflow: auto;
  background: #fff;
}
.fd-panel-title {
  margin: 0 0 12px;
  font-size: 15px;
  color: #303133;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.fd-panel-sub {
  font-family: Consolas, monospace;
  font-size: 12px;
  font-weight: 400;
  color: #a8abb2;
}
.fd-hint {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
  margin-top: 4px;
}
.fd-cond {
  display: flex;
  gap: 6px;
  width: 100%;
}
.fd-cond > * {
  flex: 1;
  min-width: 0;
}
.fd-insert {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
