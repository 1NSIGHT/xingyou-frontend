<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { getOrgTreeApi, type OrgTreeNode } from '@/api/system/org'
import { getRoleListApi, type RoleVO } from '@/api/system/role'
import {
  changeUserStatusApi,
  createUserApi,
  deleteUserApi,
  getUserPageApi,
  resetPasswordApi,
  unlockUserApi,
  updateUserApi,
  type UserSaveParams,
  type UserVO,
} from '@/api/system/user'

const auth = useAuthStore()

const loading = ref(false)
const list = ref<UserVO[]>([])
const total = ref(0)
const orgTree = ref<OrgTreeNode[]>([])
const roles = ref<RoleVO[]>([])

const query = reactive({
  keyword: '',
  orgId: null as number | null,
  status: null as number | null,
  current: 1,
  size: 10,
})

const orgFilterId = ref<number | null>(null)

/** 当前登录用户 ID，用于禁用「删除自己 / 停用自己」这类操作 */
const currentUserId = computed(() => auth.userInfo?.userId)

// ==================== 列表 ====================

async function loadList() {
  loading.value = true
  try {
    const result = await getUserPageApi({ ...query, orgId: orgFilterId.value })
    list.value = result.records
    total.value = result.total
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  query.current = 1
  void loadList()
}

function handleReset() {
  query.keyword = ''
  query.status = null
  query.current = 1
  orgFilterId.value = null
  void loadList()
}

function handleOrgFilterClick(node: OrgTreeNode) {
  orgFilterId.value = orgFilterId.value === node.id ? null : node.id
  query.current = 1
  void loadList()
}

function clearOrgFilter() {
  orgFilterId.value = null
  query.current = 1
  void loadList()
}

// ==================== 新增 / 编辑 ====================

const dialogVisible = ref(false)
const saving = ref(false)
const dialogTitle = ref('新增用户')
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()

const form = reactive<UserSaveParams>({
  username: '',
  password: '',
  realName: '',
  mobile: '',
  email: '',
  orgId: null,
  roleIds: [],
  status: 1,
  remark: '',
})

const rules: FormRules = {
  username: [
    { required: true, message: '请输入登录名', trigger: 'blur' },
    { min: 3, max: 32, message: '长度为 3 ~ 32 个字符', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9_.-]{2,31}$/,
      message: '以字母开头，只能包含字母、数字、下划线、点、短横线',
      trigger: 'blur',
    },
  ],
  realName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  mobile: [{ pattern: /^$|^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }],
}

function openCreate() {
  editingId.value = null
  dialogTitle.value = '新增用户'
  Object.assign(form, {
    username: '',
    password: '',
    realName: '',
    mobile: '',
    email: '',
    orgId: orgFilterId.value,
    roleIds: [],
    status: 1,
    remark: '',
  })
  dialogVisible.value = true
  formRef.value?.clearValidate()
}

function openEdit(row: UserVO) {
  editingId.value = row.id
  dialogTitle.value = `编辑用户 · ${row.realName || row.username}`
  Object.assign(form, {
    username: row.username,
    password: '',
    realName: row.realName,
    mobile: row.mobile ?? '',
    email: row.email ?? '',
    orgId: row.orgId ?? null,
    roleIds: [...(row.roleIds ?? [])],
    status: row.status,
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
      await createUserApi({ ...form })
      ElMessage.success(
        form.password ? '用户创建成功' : '用户创建成功，已使用系统初始密码',
      )
    } else {
      await updateUserApi(editingId.value, { ...form })
      ElMessage.success('用户信息已保存')
    }
    dialogVisible.value = false
    await loadList()
  } finally {
    saving.value = false
  }
}

// ==================== 行操作 ====================

async function handleResetPassword(row: UserVO) {
  try {
    const { value } = await ElMessageBox.prompt(
      `重置「${row.realName || row.username}」的密码。留空表示重置为系统初始密码。`,
      '重置密码',
      {
        confirmButtonText: '重置',
        cancelButtonText: '取消',
        inputPlaceholder: '留空 = 系统初始密码',
        inputValue: '',
        inputValidator: (val: string) => {
          if (!val) return true
          if (val.length < 12) return '密码长度不能少于 12 位'
          const categories = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9\s]/].filter((re) =>
            re.test(val),
          ).length
          if (categories < 3) return '需包含大写字母、小写字母、数字、符号中的至少 3 类'
          if (/\s/.test(val)) return '不能包含空格'
          return true
        },
      },
    )
    await resetPasswordApi(row.id, value)
    ElMessage.success(value ? '密码已重置' : '密码已重置为系统初始密码')
  } catch {
    // 取消
  }
}

async function handleToggleStatus(row: UserVO) {
  const next = row.status === 1 ? 0 : 1
  const action = next === 1 ? '启用' : '停用'
  try {
    await ElMessageBox.confirm(
      next === 0
        ? `停用后「${row.realName || row.username}」已登录的会话会立即失效，确定停用吗？`
        : `确定启用「${row.realName || row.username}」吗？`,
      `${action}确认`,
      { confirmButtonText: action, cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  await changeUserStatusApi(row.id, next)
  ElMessage.success(`已${action}`)
  await loadList()
}

async function handleUnlock(row: UserVO) {
  await unlockUserApi(row.id)
  ElMessage.success('已解除锁定')
  await loadList()
}

async function handleDelete(row: UserVO) {
  try {
    await ElMessageBox.confirm(
      `确定删除用户「${row.realName || row.username}」吗？删除后该账号无法登录。`,
      '删除确认',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  await deleteUserApi(row.id)
  ElMessage.success('已删除')
  await loadList()
}

/** 是否禁止对自己操作（删除 / 停用 / 改角色） */
function isSelf(row: UserVO) {
  return row.id === currentUserId.value
}

onMounted(async () => {
  const [tree, roleList] = await Promise.all([getOrgTreeApi(), getRoleListApi()])
  orgTree.value = tree
  roles.value = roleList
  await loadList()
})
</script>

<template>
  <div class="user-page">
    <!-- ==================== 左：组织筛选 ==================== -->
    <el-card shadow="never" class="org-card">
      <template #header>
        <div class="card-head">
          <span class="card-title">按组织筛选</span>
          <el-button v-if="orgFilterId" link type="primary" size="small" @click="clearOrgFilter">
            清除
          </el-button>
        </div>
      </template>

      <el-scrollbar class="org-scroll">
        <el-tree
          :data="orgTree"
          node-key="id"
          :props="{ children: 'children', label: 'name' }"
          highlight-current
          default-expand-all
          :expand-on-click-node="false"
          @node-click="handleOrgFilterClick"
        >
          <template #default="{ data }">
            <span class="tree-node" :class="{ active: orgFilterId === data.id }">
              <span class="node-name">{{ data.name }}</span>
              <span v-if="data.userCount > 0" class="node-count">{{ data.userCount }}</span>
            </span>
          </template>
        </el-tree>
        <el-empty v-if="!orgTree.length" description="暂无组织" :image-size="60" />
      </el-scrollbar>
    </el-card>

    <!-- ==================== 右：用户列表 ==================== -->
    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="card-head">
          <div class="head-left">
            <span class="card-title">用户管理</span>
            <el-tag size="small" type="info" effect="plain">{{ total }} 人</el-tag>
          </div>
          <el-button type="primary" :icon="'Plus'" @click="openCreate">新增用户</el-button>
        </div>
      </template>

      <div class="toolbar">
        <el-input
          v-model.trim="query.keyword"
          placeholder="搜索登录名 / 姓名 / 手机号"
          :prefix-icon="'Search'"
          clearable
          class="search-input"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <el-select v-model="query.status" placeholder="全部状态" clearable class="status-select">
          <el-option label="启用" :value="1" />
          <el-option label="停用" :value="0" />
        </el-select>
        <el-button type="primary" plain :icon="'Search'" @click="handleSearch">查询</el-button>
        <el-button :icon="'Refresh'" @click="handleReset">重置</el-button>
      </div>

      <el-table v-loading="loading" :data="list" border stripe class="user-table">
        <el-table-column label="姓名 / 登录名" min-width="150">
          <template #default="{ row }">
            <div class="user-cell">
              <strong>{{ row.realName || '—' }}</strong>
              <small>{{ row.username }}</small>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="所属组织" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.orgName || '—' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="角色" min-width="180">
          <template #default="{ row }">
            <el-tag
              v-for="(role, i) in row.roles"
              :key="role"
              size="small"
              effect="light"
              :type="row.roleCodes?.[i] === 'ADMIN' ? 'danger' : 'primary'"
              class="role-tag"
            >
              {{ role }}
            </el-tag>
            <span v-if="!row.roles?.length" class="muted">未分配</span>
          </template>
        </el-table-column>

        <el-table-column prop="mobile" label="手机号" width="130">
          <template #default="{ row }">
            <span>{{ row.mobile || '—' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="92" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.locked" type="warning" size="small" effect="light">锁定中</el-tag>
            <el-tag v-else-if="row.status === 1" type="success" size="small" effect="light">
              启用
            </el-tag>
            <el-tag v-else type="info" size="small" effect="light">停用</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="最后登录" width="160">
          <template #default="{ row }">
            <span class="muted">{{ row.lastLoginAt || '从未登录' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="primary" size="small" @click="handleResetPassword(row)">
              重置密码
            </el-button>
            <el-button v-if="row.locked" link type="warning" size="small" @click="handleUnlock(row)">
              解锁
            </el-button>
            <el-button
              link
              :type="row.status === 1 ? 'warning' : 'success'"
              size="small"
              :disabled="isSelf(row)"
              @click="handleToggleStatus(row)"
            >
              {{ row.status === 1 ? '停用' : '启用' }}
            </el-button>
            <el-button
              link
              type="danger"
              size="small"
              :disabled="isSelf(row)"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty description="没有符合条件的用户" :image-size="80" />
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
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="104px">
        <el-form-item label="登录名" prop="username">
          <el-input
            v-model.trim="form.username"
            placeholder="如 lijun"
            :disabled="editingId !== null"
            maxlength="32"
          />
          <div v-if="editingId !== null" class="field-tip">登录名创建后不可修改</div>
        </el-form-item>

        <el-form-item v-if="editingId === null" label="初始密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="留空则使用系统初始密码"
            maxlength="64"
          />
          <div class="field-tip">
            要求：不少于 12 位，且大写字母 / 小写字母 / 数字 / 符号至少包含 3 类
          </div>
        </el-form-item>

        <el-form-item label="姓名" prop="realName">
          <el-input v-model.trim="form.realName" placeholder="如 李军" maxlength="64" />
        </el-form-item>

        <el-form-item label="所属组织">
          <el-tree-select
            v-model="form.orgId"
            :data="orgTree"
            :props="{ label: 'name', children: 'children' }"
            node-key="id"
            check-strictly
            clearable
            placeholder="请选择所属组织"
            class="full-width"
          />
        </el-form-item>

        <el-form-item label="角色">
          <el-select
            v-model="form.roleIds"
            multiple
            clearable
            placeholder="可分配多个角色"
            class="full-width"
          >
            <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id">
              <span>{{ r.name }}</span>
              <span class="option-code">{{ r.code }}</span>
            </el-option>
          </el-select>
          <div v-if="editingId === currentUserId" class="field-tip warn">
            不能修改自己的角色（防止把自己锁在系统外），请让其他管理员操作
          </div>
        </el-form-item>

        <el-form-item label="手机号" prop="mobile">
          <el-input v-model.trim="form.mobile" placeholder="选填" maxlength="11" />
        </el-form-item>

        <el-form-item label="邮箱" prop="email">
          <el-input v-model.trim="form.email" placeholder="选填" maxlength="128" />
        </el-form-item>

        <el-form-item label="状态">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
          <span class="form-hint">{{ form.status === 1 ? '启用' : '停用' }}</span>
        </el-form-item>

        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="255" show-word-limit />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.user-page {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
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

/* ==================== 左：组织树 ==================== */
.org-card :deep(.el-card__body) {
  padding: 8px;
}

.org-scroll {
  height: calc(100vh - 200px);
  min-height: 280px;
}

:deep(.el-tree-node__content) {
  height: 32px;
  border-radius: 6px;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;

  &.active .node-name {
    font-weight: 600;
    color: var(--xy-navy-500);
  }

  .node-name {
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .node-count {
    flex-shrink: 0;
    font-size: 11.5px;
    color: var(--xy-text-3);
  }
}

/* ==================== 右：表格 ==================== */
.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;

  .search-input {
    width: 260px;
  }

  .status-select {
    width: 130px;
  }
}

.user-cell {
  display: flex;
  flex-direction: column;
  line-height: 1.35;

  strong {
    font-size: 13.5px;
    color: var(--xy-text-1);
  }

  small {
    font-size: 12px;
    color: var(--xy-text-3);
  }
}

.role-tag + .role-tag {
  margin-left: 4px;
}

.muted {
  color: var(--xy-text-3);
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

/* ==================== 弹窗 ==================== */
.full-width {
  width: 100%;
}

.option-code {
  float: right;
  font-size: 12px;
  color: var(--xy-text-3);
}

.field-tip {
  margin-top: 5px;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--xy-text-3);

  &.warn {
    color: var(--xy-warning);
  }
}

.form-hint {
  margin-left: 10px;
  font-size: 12.5px;
  color: var(--xy-text-3);
}

@media (max-width: 1100px) {
  .user-page {
    grid-template-columns: minmax(0, 1fr);
  }

  .org-scroll {
    height: 260px;
  }

  .toolbar {
    flex-wrap: wrap;

    .search-input {
      width: 100%;
    }
  }
}
</style>
