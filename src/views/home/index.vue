<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getOrgTreeApi, type OrgTreeNode } from '@/api/system/org'
import { getRoleListApi } from '@/api/system/role'

const router = useRouter()
const auth = useAuthStore()

const orgTree = ref<OrgTreeNode[]>([])
const roleCount = ref(0)
const loading = ref(true)

const orgCount = computed(() => countNodes(orgTree.value))
const memberCount = computed(() => sumMembers(orgTree.value))

/** 按当前时间给出问候语 */
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '凌晨好'
  if (hour < 12) return '上午好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

function countNodes(nodes: OrgTreeNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children ?? []), 0)
}

function sumMembers(nodes: OrgTreeNode[]): number {
  return nodes.reduce((sum, n) => sum + (n.userCount ?? 0) + sumMembers(n.children ?? []), 0)
}

const entries = [
  {
    title: '组织架构',
    desc: '维护监理公司、项目部与专业组的层级结构',
    icon: 'OfficeBuilding',
    path: '/system/org',
  },
  {
    title: '角色管理',
    desc: '维护岗位角色与各自的数据权限范围',
    icon: 'UserFilled',
    path: '/system/role',
  },
]

onMounted(async () => {
  try {
    // 组织 / 角色接口限系统管理员。非管理员不请求，避免刷出一堆 403
    if (auth.isAdmin) {
      const [tree, roles] = await Promise.all([getOrgTreeApi(), getRoleListApi()])
      orgTree.value = tree
      roleCount.value = roles.length
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="dashboard">
    <!-- ==================== 欢迎横幅 ==================== -->
    <section class="hero">
      <div class="hero-main">
        <h2>{{ greeting }}，{{ auth.displayName }}</h2>
        <p class="hero-sub">
          <span>{{ auth.userInfo?.tenantName }}</span>
          <em>·</em>
          <span>{{ auth.userInfo?.projectName || '暂未分配项目' }}</span>
        </p>
      </div>
      <div class="hero-roles">
        <el-tag v-for="role in auth.userInfo?.roles" :key="role" effect="dark" class="role-tag">
          {{ role }}
        </el-tag>
      </div>
    </section>

    <!-- ==================== 指标卡（仅系统管理员）==================== -->
    <section v-if="auth.isAdmin" v-loading="loading" class="stats">
      <div class="stat-card">
        <div class="stat-icon" style="--c: #1b5299; --c-bg: rgba(27, 82, 153, 0.12)">
          <el-icon><OfficeBuilding /></el-icon>
        </div>
        <div class="stat-body">
          <span class="stat-value">{{ orgCount }}</span>
          <span class="stat-label">组织节点</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="--c: #00b42a; --c-bg: rgba(0, 180, 42, 0.12)">
          <el-icon><User /></el-icon>
        </div>
        <div class="stat-body">
          <span class="stat-value">{{ memberCount }}</span>
          <span class="stat-label">组织内成员</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="--c: #e08200; --c-bg: rgba(255, 159, 28, 0.15)">
          <el-icon><UserFilled /></el-icon>
        </div>
        <div class="stat-body">
          <span class="stat-value">{{ roleCount }}</span>
          <span class="stat-label">角色数量</span>
        </div>
      </div>
    </section>

    <!-- ==================== 主体 ==================== -->
    <section class="panels">
      <el-card shadow="never" class="panel">
        <template #header>
          <span class="panel-title">当前登录信息</span>
        </template>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="姓名">{{ auth.userInfo?.realName }}</el-descriptions-item>
          <el-descriptions-item label="账号">{{ auth.userInfo?.username }}</el-descriptions-item>
          <el-descriptions-item label="所属单位">{{ auth.userInfo?.tenantName }}</el-descriptions-item>
          <el-descriptions-item label="当前项目">
            {{ auth.userInfo?.projectName || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="岗位角色">
            <el-tag
              v-for="role in auth.userInfo?.roles"
              :key="role"
              size="small"
              effect="light"
              class="inline-tag"
            >
              {{ role }}
            </el-tag>
            <span v-if="!auth.userInfo?.roles?.length">—</span>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <div class="right-col">
        <el-card v-if="auth.isAdmin" shadow="never" class="panel">
          <template #header>
            <span class="panel-title">系统管理</span>
          </template>
          <div class="entries">
            <button
              v-for="entry in entries"
              :key="entry.path"
              type="button"
              class="entry"
              @click="router.push(entry.path)"
            >
              <span class="entry-icon">
                <el-icon><component :is="entry.icon" /></el-icon>
              </span>
              <span class="entry-text">
                <strong>{{ entry.title }}</strong>
                <small>{{ entry.desc }}</small>
              </span>
              <el-icon class="entry-arrow"><ArrowRight /></el-icon>
            </button>
          </div>
        </el-card>

        <el-alert
          v-if="!auth.isAdmin"
          type="success"
          :closable="false"
          show-icon
          class="roadmap"
        >
          <template #title>欢迎使用</template>
          <div class="roadmap-body">
            你的角色是 <b>{{ auth.userInfo?.roles?.join('、') || '—' }}</b>。
            低代码表单引擎、待办中心与项目台账正在建设中，
            上线后这里会展示你的待办与项目概览。
          </div>
        </el-alert>

        <el-alert v-else type="info" :closable="false" show-icon class="roadmap">
          <template #title>下一步：功能权限</template>
          <div class="roadmap-body">
            「系统管理」已收进右上角头像菜单并限系统管理员。
            后续将接入 <b>功能权限</b>（菜单 / 按钮 / 接口级）与
            <b>数据权限</b>（角色上的范围已可配置），再进入低代码表单引擎。
          </div>
        </el-alert>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ==================== 欢迎横幅 ==================== */
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  padding: 22px 26px;
  border-radius: var(--xy-radius-lg);
  color: #fff;
  background:
    radial-gradient(circle at 88% 20%, rgba(255, 159, 28, 0.22), transparent 46%),
    linear-gradient(120deg, #0a2540 0%, #123a63 55%, #1b5299 100%);
  box-shadow: 0 10px 30px rgba(10, 37, 64, 0.18);

  h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .hero-sub {
    margin: 10px 0 0;
    font-size: 13.5px;
    color: rgba(255, 255, 255, 0.68);

    em {
      margin: 0 8px;
      font-style: normal;
      color: rgba(255, 255, 255, 0.35);
    }
  }

  .hero-roles {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .role-tag {
    border: none;
    background: rgba(255, 255, 255, 0.16);
    backdrop-filter: blur(2px);
  }
}

/* ==================== 指标卡 ==================== */
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  min-height: 90px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border-radius: var(--xy-radius);
  background: #fff;
  border: 1px solid var(--xy-border);
  transition:
    transform 0.2s,
    box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 22px rgba(7, 28, 51, 0.08);
  }

  .stat-icon {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    flex-shrink: 0;
    border-radius: 12px;
    font-size: 21px;
    color: var(--c);
    /* 用预先算好的 rgba 而不是 color-mix，兼容老内核的国产浏览器 */
    background: var(--c-bg);
  }

  .stat-body {
    display: flex;
    flex-direction: column;
    line-height: 1.3;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 600;
    color: var(--xy-text-1);
  }

  .stat-label {
    margin-top: 2px;
    font-size: 12.5px;
    color: var(--xy-text-3);
  }
}

/* ==================== 面板 ==================== */
.panels {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.right-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--xy-text-1);
}

.inline-tag + .inline-tag {
  margin-left: 6px;
}

.entries {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.entry {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 13px 14px;
  border: 1px solid var(--xy-border);
  border-radius: var(--xy-radius);
  background: #fff;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background 0.2s,
    transform 0.2s;

  &:hover {
    border-color: var(--xy-navy-300);
    background: var(--xy-navy-100);
    transform: translateX(2px);

    .entry-arrow {
      color: var(--xy-navy-500);
      transform: translateX(2px);
    }
  }

  .entry-icon {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: 9px;
    font-size: 17px;
    color: var(--xy-navy-500);
    background: rgba(27, 82, 153, 0.1);
  }

  .entry-text {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;

    strong {
      font-size: 14px;
      font-weight: 600;
      color: var(--xy-text-1);
    }

    small {
      margin-top: 3px;
      font-size: 12.5px;
      color: var(--xy-text-3);
    }
  }

  .entry-arrow {
    flex-shrink: 0;
    font-size: 14px;
    color: var(--xy-text-4);
    transition:
      color 0.2s,
      transform 0.2s;
  }
}

.roadmap {
  :deep(.el-alert__title) {
    font-size: 13.5px;
    font-weight: 600;
  }

  .roadmap-body {
    margin-top: 6px;
    font-size: 12.5px;
    line-height: 1.8;

    b {
      color: var(--xy-navy-500);
    }
  }
}

/* ==================== 响应式 ==================== */
@media (max-width: 1080px) {
  .panels {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .stats {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
