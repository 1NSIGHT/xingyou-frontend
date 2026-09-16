<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'
import BrandLogo from '@/components/BrandLogo.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const projectStore = useProjectStore()

const collapsed = ref(false)

interface MenuItem {
  path: string
  title: string
  icon: string
  children?: MenuItem[]
}

/**
 * 侧边栏菜单。
 *
 * <p>「系统管理」刻意不放在这里——它属于低频的管理员配置项，
 * 放在右上角头像菜单里，且仅系统管理员可见。
 */
const menus: MenuItem[] = [{ path: '/', title: '工作台', icon: 'HomeFilled' }]

/** 面包屑：从当前路由的 matched 里取有 title 的层级 */
const breadcrumbs = computed(() =>
  route.matched
    .filter((r) => r.meta?.title)
    .map((r) => ({ title: r.meta.title as string, path: r.path })),
)

const activeMenu = computed(() => route.path)

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '退出确认', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  await auth.logout()
  // 切换账号后当前项目必然失效，必须清掉，否则新账号会带着上一个账号的项目 ID
  projectStore.reset()
  ElMessage.success('已安全退出')
  await router.replace('/login')
}

/** 切换当前项目 */
function handleProjectChange(id: number) {
  projectStore.setCurrent(id)
  ElMessage.success(`已切换到「${projectStore.current?.name ?? ''}」`)
}

function handleCommand(command: string) {
  switch (command) {
    case 'logout':
      void handleLogout()
      break
    case 'system-org':
      void router.push('/system/org')
      break
    case 'system-user':
      void router.push('/system/user')
      break
    case 'system-role':
      void router.push('/system/role')
      break
    default:
      break
  }
}

onMounted(async () => {
  // 兼容旧缓存：早期版本登录时存下的 userInfo 里没有 roleCodes，
  // 不补拉的话 isAdmin 恒为 false，头像菜单里就看不到「系统管理」
  if (auth.isLoggedIn && !auth.userInfo?.roleCodes) {
    try {
      await auth.fetchUserInfo()
    } catch {
      // 拉取失败不阻断页面，路由守卫还会再兜一层
    }
  }

  // 项目上下文：所有业务单据都要挂在项目下
  try {
    await projectStore.load()
  } catch {
    // 加载失败不阻断页面，选择器会显示「未分配项目」
  }
})
</script>

<template>
  <div class="app-layout" :class="{ 'is-collapsed': collapsed }">
    <!-- ==================== 侧边栏 ==================== -->
    <aside class="app-aside">
      <div class="aside-brand">
        <BrandLogo :size="30" light />
        <transition name="fade">
          <span v-show="!collapsed" class="brand-text">石油工程监理平台</span>
        </transition>
      </div>

      <el-scrollbar class="aside-scroll">
        <el-menu
          :default-active="activeMenu"
          :collapse="collapsed"
          :collapse-transition="false"
          router
          class="aside-menu"
          background-color="transparent"
          text-color="rgba(255,255,255,0.72)"
          active-text-color="#ffffff"
        >
          <template v-for="menu in menus" :key="menu.path">
            <el-sub-menu v-if="menu.children?.length" :index="menu.path">
              <template #title>
                <el-icon><component :is="menu.icon" /></el-icon>
                <span>{{ menu.title }}</span>
              </template>
              <el-menu-item v-for="child in menu.children" :key="child.path" :index="child.path">
                <el-icon><component :is="child.icon" /></el-icon>
                <template #title>{{ child.title }}</template>
              </el-menu-item>
            </el-sub-menu>

            <el-menu-item v-else :index="menu.path">
              <el-icon><component :is="menu.icon" /></el-icon>
              <template #title>{{ menu.title }}</template>
            </el-menu-item>
          </template>
        </el-menu>
      </el-scrollbar>

      <div v-show="!collapsed" class="aside-foot">
        <span class="dot" />
        <span>v0.1.0 · 开发环境</span>
      </div>
    </aside>

    <!-- ==================== 主区域 ==================== -->
    <div class="app-main">
      <header class="app-header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="collapsed = !collapsed">
            <component :is="collapsed ? 'Expand' : 'Fold'" />
          </el-icon>

          <el-breadcrumb separator="/">
            <el-breadcrumb-item v-for="(item, index) in breadcrumbs" :key="index">
              {{ item.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="header-right">
          <!-- 当前项目：所有业务单据都挂在项目下，所以做成全局一等公民 -->
          <div class="project-picker">
            <el-icon class="picker-icon"><Folder /></el-icon>
            <el-select
              v-if="projectStore.hasProject"
              :model-value="projectStore.currentId"
              placeholder="选择项目"
              class="project-select"
              @change="handleProjectChange"
            >
              <el-option v-for="p in projectStore.projects" :key="p.id" :label="p.name" :value="p.id">
                <span class="opt-name">{{ p.name }}</span>
                <span class="opt-code">{{ p.code }}</span>
              </el-option>
            </el-select>
            <el-tooltip
              v-else
              content="你还没有被分配到任何项目，请联系系统管理员"
              placement="bottom"
            >
              <el-tag type="warning" effect="light">未分配项目</el-tag>
            </el-tooltip>
          </div>

          <el-dropdown @command="handleCommand">
            <span class="user-trigger">
              <el-avatar :size="28" class="user-avatar">
                {{ auth.displayName.charAt(0) || 'U' }}
              </el-avatar>
              <span class="user-meta">
                <strong>{{ auth.displayName }}</strong>
                <small>{{ auth.userInfo?.roles?.[0] || '—' }}</small>
              </span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled class="dropdown-account">
                  <span class="account-name">{{ auth.displayName }}</span>
                  <span class="account-org">{{ auth.userInfo?.tenantName }}</span>
                </el-dropdown-item>

                <!-- 系统管理：仅系统管理员可见。
                     注意这只是「不显示入口」，真正的权限边界在后端 @PreAuthorize -->
                <template v-if="auth.isAdmin">
                  <el-dropdown-item divided disabled class="dropdown-group">系统管理</el-dropdown-item>
                  <el-dropdown-item command="system-org">
                    <el-icon><OfficeBuilding /></el-icon>
                    组织架构
                  </el-dropdown-item>
                  <el-dropdown-item command="system-user">
                    <el-icon><User /></el-icon>
                    用户管理
                  </el-dropdown-item>
                  <el-dropdown-item command="system-role">
                    <el-icon><UserFilled /></el-icon>
                    角色管理
                  </el-dropdown-item>
                </template>

                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="app-content">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--xy-fill-1);
}

/* ==================== 侧边栏 ==================== */
.app-aside {
  display: flex;
  flex-direction: column;
  width: 220px;
  flex-shrink: 0;
  color: #fff;
  background:
    radial-gradient(circle at 12% 8%, rgba(255, 159, 28, 0.14), transparent 42%),
    linear-gradient(170deg, #071c33 0%, #0f3358 55%, #123a63 100%);
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  .is-collapsed & {
    width: 64px;
  }
}

.aside-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 17px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  overflow: hidden;

  .brand-text {
    font-size: 14.5px;
    font-weight: 600;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }
}

.aside-scroll {
  flex: 1;
  min-height: 0;
}

.aside-menu {
  border-right: none;
  padding: 8px;

  :deep(.el-menu-item),
  :deep(.el-sub-menu__title) {
    height: 42px;
    line-height: 42px;
    margin-bottom: 4px;
    border-radius: 8px;
    font-size: 14px;

    &:hover {
      background: rgba(255, 255, 255, 0.08) !important;
      color: #fff !important;
    }
  }

  :deep(.el-menu-item.is-active) {
    background: linear-gradient(90deg, rgba(42, 111, 191, 0.9), rgba(27, 82, 153, 0.65)) !important;
    font-weight: 600;
    box-shadow: inset 2px 0 0 var(--xy-amber-500);
  }

  :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
    color: #fff !important;
  }

  :deep(.el-menu--inline) {
    background: transparent;
  }
}

.aside-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 18px;
  flex-shrink: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  white-space: nowrap;

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--xy-success);
    box-shadow: 0 0 0 3px rgba(0, 180, 42, 0.16);
  }
}

/* ==================== 主区域 ==================== */
.app-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 20px;
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid var(--xy-border);

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }

  .collapse-btn {
    font-size: 18px;
    color: var(--xy-text-2);
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: var(--xy-navy-500);
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-shrink: 0;
  }
}

.user-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 8px;
  cursor: pointer;
  outline: none;
  transition: background 0.2s;

  &:hover {
    background: var(--xy-fill-2);
  }

  .user-avatar {
    background: linear-gradient(135deg, var(--xy-navy-500), var(--xy-navy-400));
    color: #fff;
    font-size: 13px;
  }

  .user-meta {
    display: flex;
    flex-direction: column;
    line-height: 1.25;

    strong {
      font-size: 13.5px;
      font-weight: 600;
      color: var(--xy-text-1);
    }

    small {
      font-size: 11.5px;
      color: var(--xy-text-3);
    }
  }

  .el-icon {
    font-size: 12px;
    color: var(--xy-text-3);
  }
}

.app-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px;
}

/* ==================== 项目选择器 ==================== */
.project-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-right: 14px;
  border-right: 1px solid var(--xy-border);

  .picker-icon {
    font-size: 15px;
    color: var(--xy-navy-500);
  }

  .project-select {
    width: 240px;

    :deep(.el-select__wrapper) {
      box-shadow: none;
      background: transparent;
      font-size: 13.5px;

      &:hover {
        box-shadow: none;
        background: var(--xy-fill-2);
      }
    }
  }
}

.opt-name {
  margin-right: 12px;
}

.opt-code {
  float: right;
  font-size: 12px;
  color: var(--xy-text-3);
}

/* ==================== 头像下拉 ==================== */
:deep(.el-dropdown-menu__item.dropdown-account) {
  height: auto;
  padding: 8px 16px;
  line-height: 1.4;

  .account-name {
    display: block;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--xy-text-1);
  }

  .account-org {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    color: var(--xy-text-3);
  }
}

:deep(.el-dropdown-menu__item.dropdown-group) {
  padding: 4px 16px;
  font-size: 11.5px;
  letter-spacing: 0.5px;
  color: var(--xy-text-3);
}

:deep(.el-dropdown-menu__item .el-icon) {
  margin-right: 6px;
  font-size: 14px;
}

/* ==================== 过渡 ==================== */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.page-enter-active,
.page-leave-active {
  transition:
    opacity 0.18s,
    transform 0.18s;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-leave-to {
  opacity: 0;
}

/* 折叠时隐藏文字 */
:deep(.el-menu--collapse) {
  .el-sub-menu__title span,
  .el-menu-item span {
    display: none;
  }
}
</style>
