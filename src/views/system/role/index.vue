<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  createRoleApi,
  deleteRoleApi,
  getDataScopesApi,
  getRolePageApi,
  updateRoleApi,
  type RoleSaveParams,
  type RoleVO,
} from '@/api/system/role'
import {
  getAllMenusApi,
  getRoleMenusApi,
  setRoleMenusApi,
  type MenuNode,
} from '@/api/system/menu'
import type { DictOption } from '@/api/system/org'

const loading = ref(false)
const saving = ref(false)
const list = ref<RoleVO[]>([])
const total = ref(0)
const dataScopes = ref<DictOption[]>([])

const query = reactive({
  keyword: '',
  current: 1,
  size: 10,
})

const dialogVisible = ref(false)
const dialogTitle = ref('新增角色')
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()

const form = reactive<RoleSaveParams>({
  code: '',
  name: '',
  sort: 0,
  dataScope: 'PROJECT',
  remark: '',
})

const rules: FormRules = {
  code: [
    { required: true, message: '请输入角色编码', trigger: 'blur' },
    {
      pattern: /^[A-Z][A-Z0-9_]{1,63}$/,
      message: '只能包含大写字母、数字和下划线，且以字母开头',
      trigger: 'blur',
    },
  ],
  name: [
    { required: true, message: '请输入角色名称', trigger: 'blur' },
    { max: 64, message: '不能超过 64 个字符', trigger: 'blur' },
  ],
  dataScope: [{ required: true, message: '请选择数据权限范围', trigger: 'change' }],
}

async function loadList() {
  loading.value = true
  try {
    const result = await getRolePageApi({ ...query })
    list.value = result.records
    total.value = result.total
    void loadMenuCounts(result.records)
  } finally {
    loading.value = false
  }
}

// ─────────────────────────────── 菜单权限 ───────────────────────────────

const menuDialogVisible = ref(false)
const menuRole = ref<RoleVO | null>(null)
const allMenus = ref<MenuNode[]>([])
const menuTreeRef = ref<{ getCheckedKeys: (leafOnly?: boolean) => unknown[] }>()
const menuSaving = ref(false)
/** roleId → 已授权菜单数。用于在列表上直接看出"这个角色什么都没授" */
const menuCounts = ref<Record<number, number>>({})

/**
 * 逐个角色拉菜单数。
 *
 * 后端没在 RoleVO 里带这个字段，所以这里是 N 次请求。角色数量是个位数
 * （管理员配置项，不会多），可以接受。
 *
 * ★ 值得多这几条请求：菜单数为 0 的角色，成员登录后看到的是一个**空侧边栏**。
 *   不在这里标出来，管理员根本不会发现 —— 他会以为用户"没登录成功"。
 */
async function loadMenuCounts(rows: RoleVO[]) {
  const entries = await Promise.all(
    rows.map(async (r) => {
      try {
        const keys = await getRoleMenusApi(r.id)
        return [r.id, keys.length] as const
      } catch {
        // 拉不到就标记成"未知"，不要显示成 0 —— 那会误导管理员去修一个没坏的东西
        return [r.id, -1] as const
      }
    }),
  )
  menuCounts.value = Object.fromEntries(entries)
}

async function openMenus(row: RoleVO) {
  menuRole.value = row
  menuDialogVisible.value = true
  try {
    if (!allMenus.value.length) {
      allMenus.value = await getAllMenusApi()
    }
    checkedKeys.value = await getRoleMenusApi(row.id)
  } catch (e) {
    ElMessage.error('加载菜单权限失败：' + (e as Error).message)
  }
}

const checkedKeys = ref<string[]>([])

async function saveMenus() {
  if (!menuRole.value) return
  // leafOnly = true：只取叶子。
  // 分组在树上是不可勾选的（下面 nodes 的 disabled），所以这里拿到的正好是可授权的那些
  const keys = (menuTreeRef.value?.getCheckedKeys(true) ?? []) as string[]
  menuSaving.value = true
  try {
    await setRoleMenusApi(menuRole.value.id, keys)
    ElMessage.success('已保存。该角色在线的用户刷新页面后生效')
    menuDialogVisible.value = false
    await loadList()
  } catch (e) {
    ElMessage.error('保存失败：' + (e as Error).message)
  } finally {
    menuSaving.value = false
  }
}

/** 管理员隐含拥有全部菜单，界面上如实显示为全选且不可改 */
const menuRoleIsAdmin = computed(() => menuRole.value?.code === 'ADMIN')

interface MenuTreeNode {
  key: string
  label: string
  disabled: boolean
  children?: MenuTreeNode[]
}

/**
 * el-tree 的数据。
 *
 * ★ 分组（grantable = false）**置灰不可勾选**。
 *   这不是美观问题：如果允许勾分组，就会出现"我勾了分组、但子项一个都没勾，
 *   于是什么也看不到"。让分组纯粹当容器，规则就只有一条 —— 看子项。
 */
const menuTreeData = computed<MenuTreeNode[]>(() =>
  allMenus.value.map((n) => ({
    key: n.key,
    label: n.title,
    disabled: !n.grantable,
    children: n.children?.map((c) => ({
      key: c.key,
      label: c.title,
      disabled: !c.grantable,
    })),
  })),
)

function handleSearch() {
  query.current = 1
  void loadList()
}

function handleReset() {
  query.keyword = ''
  query.current = 1
  void loadList()
}

function openCreate() {
  editingId.value = null
  dialogTitle.value = '新增角色'
  Object.assign(form, { code: '', name: '', sort: 0, dataScope: 'PROJECT', remark: '' })
  dialogVisible.value = true
  formRef.value?.clearValidate()
}

function openEdit(row: RoleVO) {
  editingId.value = row.id
  dialogTitle.value = `编辑角色 · ${row.name}`
  Object.assign(form, {
    code: row.code,
    name: row.name,
    sort: row.sort ?? 0,
    dataScope: row.dataScope,
    remark: row.remark ?? '',
  })
  dialogVisible.value = true
  formRef.value?.clearValidate()
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  saving.value = true
  try {
    if (editingId.value == null) {
      await createRoleApi({ ...form })
      ElMessage.success('角色创建成功')
    } else {
      await updateRoleApi(editingId.value, { ...form })
      ElMessage.success('角色已保存')
    }
    dialogVisible.value = false
    await loadList()
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: RoleVO) {
  if (row.userCount > 0) {
    ElMessage.warning(`该角色下还有 ${row.userCount} 名用户，请先解除关联`)
    return
  }
  try {
    await ElMessageBox.confirm(`确定删除角色「${row.name}」吗？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  await deleteRoleApi(row.id)
  ElMessage.success('已删除')
  await loadList()
}

function scopeTagType(scope: string) {
  switch (scope) {
    case 'ALL':
      return 'danger'
    case 'TENANT':
      return 'warning'
    case 'DEPT':
      return 'primary'
    case 'PROJECT':
      return 'success'
    default:
      return 'info'
  }
}

onMounted(async () => {
  dataScopes.value = await getDataScopesApi()
  await loadList()
})
</script>

<template>
  <div class="role-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-head">
          <div class="head-left">
            <span class="card-title">角色管理</span>
            <el-tag size="small" type="info" effect="plain">{{ total }} 个角色</el-tag>
          </div>
          <el-button type="primary" :icon="'Plus'" @click="openCreate">新增角色</el-button>
        </div>
      </template>

      <div class="toolbar">
        <el-input
          v-model.trim="query.keyword"
          placeholder="搜索角色名称或编码"
          :prefix-icon="'Search'"
          clearable
          class="search-input"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <el-button type="primary" plain :icon="'Search'" @click="handleSearch">查询</el-button>
        <el-button :icon="'Refresh'" @click="handleReset">重置</el-button>
      </div>

      <el-table v-loading="loading" :data="list" border stripe class="role-table">
        <el-table-column prop="name" label="角色名称" min-width="150">
          <template #default="{ row }">
            <strong>{{ row.name }}</strong>
          </template>
        </el-table-column>

        <el-table-column prop="code" label="角色编码" min-width="160">
          <template #default="{ row }">
            <code class="code-cell">{{ row.code }}</code>
          </template>
        </el-table-column>

        <el-table-column label="数据权限范围" width="150" align="center">
          <template #default="{ row }">
            <el-tag :type="scopeTagType(row.dataScope)" effect="light" size="small">
              {{ row.dataScopeLabel }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="成员数" width="90" align="center">
          <template #default="{ row }">
            <span :class="{ 'zero-count': row.userCount === 0 }">{{ row.userCount }}</span>
          </template>
        </el-table-column>

        <el-table-column label="菜单" width="110" align="center">
          <template #default="{ row }">
            <!--
              菜单数为 0 的角色，成员登录后看到的是一个空侧边栏。
              这里必须显式标出来 —— 否则管理员会以为用户"没登录成功"，
              而不会想到是权限没配。
            -->
            <el-tag v-if="menuCounts[row.id] === undefined" size="small" type="info">—</el-tag>
            <el-tooltip
              v-else-if="menuCounts[row.id] === 0"
              content="该角色未分配任何菜单，成员登录后看不到任何功能入口"
            >
              <el-tag size="small" type="danger">未授权</el-tag>
            </el-tooltip>
            <el-tag v-else-if="menuCounts[row.id] === -1" size="small" type="info">未知</el-tag>
            <el-tag v-else size="small" type="success">{{ menuCounts[row.id] }} 项</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="sort" label="排序" width="80" align="center" />

        <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="muted">{{ row.remark || '—' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="220" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openMenus(row)">菜单权限</el-button>
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty description="暂无角色数据" :image-size="80" />
        </template>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="query.current"
          v-model:page-size="query.size"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="handleSearch"
          @current-change="loadList"
        />
      </div>
    </el-card>

    <!-- ==================== 新增 / 编辑弹窗 ==================== -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="520px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="角色编码" prop="code">
          <el-input
            v-model.trim="form.code"
            placeholder="如：CHIEF_SUPERVISOR"
            :disabled="editingId !== null"
            maxlength="64"
          />
        </el-form-item>
        <el-form-item label="角色名称" prop="name">
          <el-input v-model.trim="form.name" placeholder="如：总监理工程师" maxlength="64" />
        </el-form-item>
        <el-form-item label="数据权限" prop="dataScope">
          <el-select v-model="form.dataScope" placeholder="请选择" class="full-width">
            <el-option v-for="s in dataScopes" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
          <div class="field-tip">
            决定该角色能看到哪些数据。左侧菜单能看到什么，在列表的「菜单权限」里配。
          </div>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="255" show-word-limit />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- ==================== 菜单权限 ==================== -->
    <el-dialog
      v-model="menuDialogVisible"
      :title="`菜单权限 · ${menuRole?.name ?? ''}`"
      width="460px"
      destroy-on-close
    >
      <el-alert
        v-if="menuRoleIsAdmin"
        type="info"
        :closable="false"
        show-icon
        title="系统管理员隐含拥有全部菜单"
        description="这是刻意的：否则一次配错就能把管理员锁在系统外面，而那是唯一无法从界面上恢复的错误。"
      />
      <el-alert
        v-else
        type="warning"
        :closable="false"
        show-icon
        title="一个都不勾 = 该角色登录后看不到任何菜单"
        description="分组本身不可勾选，它只在下面有子项被勾选时才出现。"
      />

      <!--
        destroy-on-close 是必需的：el-tree 的 default-checked-keys 只在初始化时生效，
        不销毁的话第二次打开会沿用上一次的勾选状态 —— 看起来像"改了没保存"。
      -->
      <el-tree
        ref="menuTreeRef"
        class="menu-tree"
        node-key="key"
        show-checkbox
        :data="menuTreeData"
        :props="{ label: 'label', children: 'children', disabled: 'disabled' }"
        :default-checked-keys="checkedKeys"
        :default-expand-all="true"
      />

      <el-alert
        v-if="!menuRoleIsAdmin"
        class="menu-hint"
        type="info"
        :closable="false"
        title="平台配置（表单设计 / 流程设计）目前仍限系统管理员"
        description="后端的发布接口对管理员限权。授给其他角色虽然能看到入口，但发布时会被拒绝 —— 与其给一个点了就失败的按钮，不如先说清楚。"
      />

      <template #footer>
        <el-button @click="menuDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="menuSaving"
          :disabled="menuRoleIsAdmin"
          @click="saveMenus"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.menu-tree {
  margin-top: 14px;
}

.menu-hint {
  margin-top: 14px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .head-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .card-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--xy-text-1);
  }
}

.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;

  .search-input {
    width: 280px;
  }
}

.role-table {
  width: 100%;
}

.code-cell {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12.5px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: var(--xy-navy-500);
  background: var(--xy-navy-100);
}

.zero-count {
  color: var(--xy-text-3);
}

.muted {
  color: var(--xy-text-3);
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.full-width {
  width: 100%;
}

.field-tip {
  margin-top: 6px;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--xy-text-3);
}

@media (max-width: 900px) {
  .toolbar {
    flex-wrap: wrap;

    .search-input {
      width: 100%;
    }
  }
}
</style>
