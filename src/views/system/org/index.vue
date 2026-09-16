<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  createOrgApi,
  deleteOrgApi,
  getOrgTreeApi,
  getOrgTypesApi,
  updateOrgApi,
  type DictOption,
  type OrgSaveParams,
  type OrgTreeNode,
} from '@/api/system/org'

const loading = ref(false)
const saving = ref(false)
const treeData = ref<OrgTreeNode[]>([])
const orgTypes = ref<DictOption[]>([])
const keyword = ref('')

const treeRef = ref<InstanceType<any>>()
const formRef = ref<FormInstance>()

/** 当前选中的节点；为 null 表示未选中 */
const selected = ref<OrgTreeNode | null>(null)
/** 新建模式：表单不与 selected 绑定 */
const isCreate = ref(false)

const form = reactive<OrgSaveParams>({
  parentId: 0,
  name: '',
  code: '',
  orgType: 'DEPARTMENT',
  leader: '',
  phone: '',
  sort: 0,
  status: 1,
  remark: '',
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入组织名称', trigger: 'blur' },
    { max: 128, message: '不能超过 128 个字符', trigger: 'blur' },
  ],
  orgType: [{ required: true, message: '请选择组织类型', trigger: 'change' }],
}

/** 统计整棵树的节点数，用于页头展示 */
const totalNodes = computed(() => countNodes(treeData.value))

/** 表单里显示的「上级组织」名称 */
const parentName = computed(() => {
  if (!form.parentId) return '—（根节点）'
  return findNode(treeData.value, form.parentId)?.name ?? '—'
})

/** 搜索时前端过滤：组织树规模很小，本地过滤比反复请求后端更跟手 */
const filteredTree = computed(() => filterTree(treeData.value, keyword.value.trim()))

function countNodes(nodes: OrgTreeNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children ?? []), 0)
}

function filterTree(nodes: OrgTreeNode[], kw: string): OrgTreeNode[] {
  if (!kw) return nodes
  const result: OrgTreeNode[] = []
  for (const node of nodes) {
    const children = filterTree(node.children ?? [], kw)
    const hit = node.name.includes(kw) || (node.code ?? '').toUpperCase().includes(kw.toUpperCase())
    // 自身命中，或子节点命中，都要保留（保留父级以维持树形结构）
    if (hit || children.length) {
      result.push({ ...node, children })
    }
  }
  return result
}

async function loadTree(keepSelection = false) {
  loading.value = true
  try {
    const previousId = selected.value?.id
    treeData.value = await getOrgTreeApi()
    if (keepSelection && previousId != null) {
      const found = findNode(treeData.value, previousId)
      if (found) {
        selected.value = found
        await treeRef.value?.setCurrentKey(found.id)
        return
      }
    }
    // 默认选中第一个根节点
    const first = treeData.value[0]
    if (first) {
      await selectNode(first)
      treeRef.value?.setCurrentKey(first.id)
    } else {
      selected.value = null
    }
  } finally {
    loading.value = false
  }
}

function findNode(nodes: OrgTreeNode[], id: number): OrgTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const hit = findNode(node.children ?? [], id)
    if (hit) return hit
  }
  return null
}

async function selectNode(node: OrgTreeNode) {
  isCreate.value = false
  selected.value = node
  Object.assign(form, {
    parentId: node.parentId,
    name: node.name,
    code: node.code ?? '',
    orgType: node.orgType,
    leader: node.leader ?? '',
    phone: node.phone ?? '',
    sort: node.sort ?? 0,
    status: node.status ?? 1,
    remark: node.remark ?? '',
  })
  await formRef.value?.clearValidate()
}

/** 新增根组织 */
async function handleCreateRoot() {
  isCreate.value = true
  selected.value = null
  treeRef.value?.setCurrentKey(undefined)
  Object.assign(form, {
    parentId: 0,
    name: '',
    code: '',
    orgType: 'COMPANY',
    leader: '',
    phone: '',
    sort: 0,
    status: 1,
    remark: '',
  })
  await formRef.value?.clearValidate()
}

/** 在选中节点下新增子组织 */
async function handleCreateChild() {
  if (!selected.value) {
    ElMessage.warning('请先选中一个上级组织')
    return
  }
  isCreate.value = true
  const parentId = selected.value.id
  Object.assign(form, {
    parentId,
    name: '',
    code: '',
    orgType: 'DEPARTMENT',
    leader: '',
    phone: '',
    sort: 0,
    status: 1,
    remark: '',
  })
  await formRef.value?.clearValidate()
}

async function handleSave() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  saving.value = true
  try {
    if (isCreate.value) {
      await createOrgApi({ ...form })
      ElMessage.success('组织创建成功')
    } else if (selected.value) {
      await updateOrgApi(selected.value.id, { ...form })
      ElMessage.success('组织信息已保存')
    }
    await loadTree(true)
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!selected.value) return
  const node = selected.value

  if ((node.children?.length ?? 0) > 0) {
    ElMessage.warning('该组织下还有子组织，请先删除子组织')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定删除组织「${node.name}」吗？此操作不可恢复。`,
      '删除确认',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }

  await deleteOrgApi(node.id)
  ElMessage.success('已删除')
  selected.value = null
  await loadTree()
}

onMounted(async () => {
  orgTypes.value = await getOrgTypesApi()
  await loadTree()
})
</script>

<template>
  <div class="org-page">
    <!-- ==================== 左：组织树 ==================== -->
    <el-card shadow="never" class="tree-card">
      <template #header>
        <div class="card-head">
          <span class="card-title">组织架构</span>
          <el-tag size="small" type="info" effect="plain">{{ totalNodes }} 个节点</el-tag>
        </div>
      </template>

      <el-input
        v-model="keyword"
        placeholder="搜索组织名称或编码"
        :prefix-icon="'Search'"
        clearable
        size="default"
        class="tree-search"
      />

      <div class="tree-actions">
        <el-button size="small" :icon="'Plus'" @click="handleCreateRoot">新增根组织</el-button>
        <el-button size="small" type="primary" plain :icon="'Plus'" @click="handleCreateChild">
          新增下级
        </el-button>
      </div>

      <el-scrollbar v-loading="loading" class="tree-scroll">
        <el-tree
          ref="treeRef"
          :data="filteredTree"
          node-key="id"
          :props="{ children: 'children', label: 'name' }"
          highlight-current
          default-expand-all
          :expand-on-click-node="false"
          @node-click="selectNode"
        >
          <template #default="{ data }">
            <span class="tree-node">
              <span class="node-name">{{ data.name }}</span>
              <el-tag size="small" effect="plain" class="node-type">{{ data.orgTypeLabel }}</el-tag>
              <span v-if="data.userCount > 0" class="node-count">{{ data.userCount }}人</span>
            </span>
          </template>
        </el-tree>

        <el-empty v-if="!loading && !treeData.length" description="暂无组织，请先新增根组织" :image-size="72" />
      </el-scrollbar>
    </el-card>

    <!-- ==================== 右：详情表单 ==================== -->
    <el-card shadow="never" class="detail-card">
      <template #header>
        <div class="card-head">
          <span class="card-title">
            {{ isCreate ? (form.parentId ? '新增下级组织' : '新增根组织') : selected ? '组织详情' : '组织详情' }}
          </span>
          <div v-if="!isCreate && selected" class="head-actions">
            <el-button size="small" type="danger" plain :icon="'Delete'" @click="handleDelete">
              删除
            </el-button>
          </div>
        </div>
      </template>

      <el-empty
        v-if="!selected && !isCreate"
        description="从左侧选择一个组织查看详情"
        :image-size="90"
      />

      <el-form v-else ref="formRef" :model="form" :rules="rules" label-width="96px" class="detail-form">
        <el-form-item label="上级组织">
          <el-input :model-value="parentName" disabled />
        </el-form-item>

        <el-form-item label="组织名称" prop="name">
          <el-input v-model.trim="form.name" placeholder="如：西气东输四线项目部" maxlength="128" />
        </el-form-item>

        <el-form-item label="组织类型" prop="orgType">
          <el-select v-model="form.orgType" placeholder="请选择" class="full-width">
            <el-option v-for="t in orgTypes" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>

        <el-form-item label="组织编码">
          <el-input v-model.trim="form.code" placeholder="如：XY-PL4，租户内唯一，可留空" maxlength="64" />
        </el-form-item>

        <el-form-item label="负责人">
          <el-input v-model.trim="form.leader" placeholder="如：张建国" maxlength="64" />
        </el-form-item>

        <el-form-item label="联系电话">
          <el-input v-model.trim="form.phone" placeholder="选填" maxlength="32" />
        </el-form-item>

        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="9999" controls-position="right" />
          <span class="form-hint">数值越小越靠前</span>
        </el-form-item>

        <el-form-item label="状态">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
          <span class="form-hint">{{ form.status === 1 ? '启用' : '停用' }}</span>
        </el-form-item>

        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="255" show-word-limit />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
          <el-button v-if="isCreate" @click="loadTree(true)">取消</el-button>
        </el-form-item>

        <el-alert
          v-if="!isCreate && selected"
          class="meta-tip"
          type="info"
          :closable="false"
          show-icon
          :title="`该组织下有 ${selected.userCount} 名成员`"
          description="删除组织前需要先移出其下全部成员与子组织。"
        />
      </el-form>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.org-page {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 16px;
  height: 100%;
  align-items: start;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  .card-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--xy-text-1);
  }
}

/* ==================== 左：树 ==================== */
.tree-card {
  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    padding: 12px;
  }
}

.tree-search {
  margin-bottom: 10px;
}

.tree-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;

  .el-button {
    flex: 1;
  }
}

.tree-scroll {
  height: calc(100vh - 300px);
  min-height: 260px;
}

:deep(.el-tree-node__content) {
  height: 34px;
  border-radius: 6px;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding-right: 6px;

  .node-name {
    font-size: 13.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .node-type {
    flex-shrink: 0;
    transform: scale(0.86);
  }

  .node-count {
    flex-shrink: 0;
    font-size: 11.5px;
    color: var(--xy-text-3);
  }
}

/* ==================== 右：详情 ==================== */
.detail-card {
  min-height: 420px;
}

.detail-form {
  max-width: 620px;
}

.full-width {
  width: 100%;
}

.form-hint {
  margin-left: 10px;
  font-size: 12.5px;
  color: var(--xy-text-3);
}

.meta-tip {
  margin-top: 8px;
}

@media (max-width: 1100px) {
  .org-page {
    grid-template-columns: minmax(0, 1fr);
  }

  .tree-scroll {
    height: 320px;
  }
}
</style>
