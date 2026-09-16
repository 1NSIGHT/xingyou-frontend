<script setup lang="ts">
/**
 * 我的待办 / 我的申请 + 流程详情。
 *
 * ★ 详情里"我现在能做什么"由**服务端**算（myTaskIds / myReturnTargets），
 *   前端不重推。因为"这个节点能退回到哪些前序节点"依赖流程定义，
 *   在两端各实现一遍必然会不一致 —— 而不一致的表现是
 *   "界面给了按钮，点了报错"。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  approveTaskApi,
  getInstanceDetailApi,
  getMyApplicationsApi,
  getReturnTargetsApi,
  getTodoApi,
  rejectTaskApi,
  returnTaskApi,
  type InstanceDetailVO,
  type MyApplicationVO,
  type ReturnTargetVO,
  type TodoVO,
} from '@/api/flow'

const router = useRouter()

const tab = ref('todo')
const loading = ref(false)
const todos = ref<TodoVO[]>([])
const mine = ref<MyApplicationVO[]>([])

const detailVisible = ref(false)
const detail = ref<InstanceDetailVO | null>(null)
const detailLoading = ref(false)
const comment = ref('')
const acting = ref(false)
const returnTargets = ref<ReturnTargetVO[]>([])
const returnTarget = ref('')

/** 当前用户在这个实例上还能处理的任务（服务端算的） */
const myTaskId = computed(() => {
  const ids = detail.value?.myTaskIds ?? []
  return ids.length ? Number(ids[0]) : null
})
const canAct = computed(() => myTaskId.value !== null && detail.value?.status === 'RUNNING')

const INSTANCE_STATUS: Record<string, { label: string; type: 'success' | 'info' | 'warning' | 'danger' }> = {
  RUNNING: { label: '审批中', type: 'warning' },
  APPROVED: { label: '已归档', type: 'success' },
  TERMINATED: { label: '已终止', type: 'danger' },
  // ★ STUCK 单独一个状态，不是"卡住的审批中"：解析不出审批人时必须
  //   明确暴露，否则这条单子会静静地停在那里，谁都不知道
  STUCK: { label: '已暂停（审批人缺失）', type: 'danger' },
}

const LOG_ACTION: Record<string, string> = {
  SUBMIT: '发起',
  ARRIVE: '到达',
  APPROVE: '同意',
  REJECT: '不同意',
  RETURN: '退回',
  SKIP: '跳过',
  FINISH: '归档',
  STUCK: '暂停',
}

function statusMeta(s: string) {
  return INSTANCE_STATUS[s] ?? { label: s, type: 'info' as const }
}

function fmt(t: string | null) {
  if (!t) return '—'
  return t.replace('T', ' ').slice(0, 19)
}

async function loadTodo() {
  try {
    todos.value = await getTodoApi()
  } catch (e) {
    ElMessage.error('加载待办失败：' + (e as Error).message)
  }
}

async function loadMine() {
  try {
    mine.value = await getMyApplicationsApi()
  } catch (e) {
    ElMessage.error('加载我的申请失败：' + (e as Error).message)
  }
}

async function load() {
  loading.value = true
  try {
    await Promise.all([loadTodo(), loadMine()])
  } finally {
    loading.value = false
  }
}

async function openDetail(instanceId: number) {
  detailVisible.value = true
  detailLoading.value = true
  comment.value = ''
  returnTarget.value = ''
  returnTargets.value = []
  try {
    const d = await getInstanceDetailApi(instanceId)
    detail.value = d
    // 只有我确实有待办、且节点声明了可退回目标时才去拉这个
    if (d.myTaskIds.length && d.myReturnTargets.length) {
      const nodeKey = d.tasks.find((t) => String(t.id) === d.myTaskIds[0])?.nodeKey
      if (nodeKey) {
        returnTargets.value = await getReturnTargetsApi(instanceId, nodeKey)
      }
    }
  } catch (e) {
    ElMessage.error('加载流程详情失败：' + (e as Error).message)
  } finally {
    detailLoading.value = false
  }
}

/** 进单据页看内容。"我的待办"里点标题就是去看这张单子 */
function openDocument(row: { documentId: number; formKey: string; instanceId: number }) {
  router.push({ path: `/document/${row.formKey}`, query: { documentId: row.documentId } })
}

async function doApprove() {
  if (!myTaskId.value) return
  acting.value = true
  try {
    await approveTaskApi(myTaskId.value, comment.value)
    ElMessage.success('已同意')
    detailVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    acting.value = false
  }
}

async function doReject() {
  if (!myTaskId.value) return
  try {
    await ElMessageBox.confirm(
      '「不同意」会立即终止整条流程，且不可撤销。确定吗？',
      '不同意',
      { type: 'warning', confirmButtonText: '确定终止', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  acting.value = true
  try {
    await rejectTaskApi(myTaskId.value, comment.value)
    ElMessage.success('已终止')
    detailVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    acting.value = false
  }
}

async function doReturn() {
  if (!myTaskId.value) return
  if (!returnTarget.value) {
    ElMessage.warning('请选择退回到哪个节点')
    return
  }
  acting.value = true
  try {
    await returnTaskApi(myTaskId.value, returnTarget.value, comment.value)
    ElMessage.success('已退回')
    detailVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    acting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="todo">
    <el-tabs v-model="tab">
      <!-- ==================== 我的待办 ==================== -->
      <el-tab-pane name="todo">
        <template #label>
          我的待办
          <el-badge v-if="todos.length" :value="todos.length" class="tab-badge" />
        </template>

        <el-table :data="todos" border>
          <el-table-column prop="flowName" label="事项" min-width="160" show-overflow-tooltip />
          <el-table-column label="当前节点" width="140">
            <template #default="{ row }">
              <el-tag size="small">{{ row.nodeName || row.nodeKey }}</el-tag>
              <el-tag v-if="row.nodeMode === 'ALL'" size="small" type="warning" class="ml4">会签</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="单据" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">
              <el-link type="primary" @click="openDocument(row)">
                {{ row.documentTitle || `#${row.documentId}` }}
              </el-link>
            </template>
          </el-table-column>
          <el-table-column prop="initiatorName" label="发起人" width="110" />
          <el-table-column label="到达时间" width="170">
            <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="时限" width="150">
            <template #default="{ row }">
              <el-tag v-if="!row.dueAt" size="small" type="info">无</el-tag>
              <el-tag v-else-if="row.overdue" size="small" type="danger">已超期</el-tag>
              <span v-else class="dim">{{ fmt(row.dueAt) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" align="center" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openDetail(row.instanceId)">
                处理
              </el-button>
            </template>
          </el-table-column>

          <template #empty>
            <el-empty description="没有待办事项" :image-size="80" />
          </template>
        </el-table>
      </el-tab-pane>

      <!-- ==================== 我的申请 ==================== -->
      <el-tab-pane label="我的申请" name="mine">
        <el-table :data="mine" border>
          <el-table-column prop="flowName" label="事项" min-width="160" show-overflow-tooltip />
          <el-table-column label="状态" width="160">
            <template #default="{ row }">
              <el-tag size="small" :type="statusMeta(row.status).type">
                {{ statusMeta(row.status).label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="当前节点" width="140">
            <template #default="{ row }">
              {{ row.currentNodeName || row.currentNodeKey || '—' }}
            </template>
          </el-table-column>
          <el-table-column label="单据" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">
              <el-link type="primary" @click="openDocument(row)">
                {{ row.documentTitle || `#${row.documentId}` }}
              </el-link>
            </template>
          </el-table-column>
          <el-table-column label="发起时间" width="170">
            <template #default="{ row }">{{ fmt(row.startedAt) }}</template>
          </el-table-column>
          <el-table-column label="结束时间" width="170">
            <template #default="{ row }">{{ fmt(row.endedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="100" align="center" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openDetail(row.instanceId)">
                轨迹
              </el-button>
            </template>
          </el-table-column>

          <template #empty>
            <el-empty description="还没有发起过申请" :image-size="80" />
          </template>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- ==================== 流程详情 ==================== -->
    <el-dialog v-model="detailVisible" title="流程详情" width="720px" destroy-on-close>
      <div v-loading="detailLoading">
        <template v-if="detail">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="事项">{{ detail.flowName }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag size="small" :type="statusMeta(detail.status).type">
                {{ statusMeta(detail.status).label }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="当前节点">
              {{ detail.currentNodeName || detail.currentNodeKey || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="使用版本">
              v{{ detail.flowDefVersion }}
            </el-descriptions-item>
            <el-descriptions-item label="单据" :span="2">
              <el-link type="primary" @click="openDocument({ ...detail, instanceId: detail.instanceId })">
                {{ detail.documentTitle || `#${detail.documentId}` }}
              </el-link>
            </el-descriptions-item>
          </el-descriptions>

          <h4 class="sec">处理记录</h4>
          <el-timeline>
            <el-timeline-item
              v-for="log in detail.logs"
              :key="log.id"
              :timestamp="fmt(log.createdAt)"
              placement="top"
            >
              <strong>{{ LOG_ACTION[log.action] || log.action }}</strong>
              <span v-if="log.nodeName" class="dim"> · {{ log.nodeName }}</span>
              <div v-if="log.comment" class="dim">{{ log.comment }}</div>
            </el-timeline-item>
          </el-timeline>

          <template v-if="canAct">
            <h4 class="sec">我的处理</h4>
            <el-input
              v-model="comment"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
              placeholder="处理意见（可选，退回时建议写清原因）"
            />
            <div v-if="returnTargets.length" class="ret">
              <span class="dim">退回到：</span>
              <el-select v-model="returnTarget" placeholder="选择节点" clearable class="ret-sel">
                <el-option
                  v-for="t in returnTargets"
                  :key="t.nodeKey"
                  :label="t.nodeName"
                  :value="t.nodeKey"
                />
              </el-select>
            </div>
          </template>
        </template>
      </div>

      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <template v-if="canAct">
          <el-button :loading="acting" @click="doReturn">退回</el-button>
          <el-button type="danger" :loading="acting" @click="doReject">不同意</el-button>
          <el-button type="primary" :loading="acting" @click="doApprove">同意</el-button>
        </template>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.todo {
  padding: 16px;
}
.tab-badge {
  margin-left: 6px;
}
.ml4 {
  margin-left: 4px;
}
.dim {
  color: #909399;
  font-size: 12px;
}
.sec {
  margin: 18px 0 10px;
  font-size: 14px;
  color: #303133;
}
.ret {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.ret-sel {
  width: 220px;
}
</style>
