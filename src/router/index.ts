import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const APP_TITLE = import.meta.env.VITE_APP_TITLE || '石油工程监理数字化平台'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('@/views/home/index.vue'),
        meta: { title: '工作台' },
      },
      {
        // 无 component 的分组路由：面包屑走这一层，页面渲染到 AppLayout 的 router-view
        // 标记 requiresAdmin —— 入口在右上角头像菜单里，不在侧边栏
        path: 'system',
        meta: { title: '系统管理', requiresAdmin: true },
        children: [
          {
            path: 'org',
            name: 'SystemOrg',
            component: () => import('@/views/system/org/index.vue'),
            meta: { title: '组织架构', requiresAdmin: true },
          },
          {
            path: 'role',
            name: 'SystemRole',
            component: () => import('@/views/system/role/index.vue'),
            meta: { title: '角色管理', requiresAdmin: true },
          },
        ],
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (to.meta.public) {
    // 已登录用户访问登录页时直接回工作台
    if (auth.isLoggedIn && to.name === 'Login') {
      return { path: '/' }
    }
    return true
  }

  if (!auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // 仅系统管理员可进的页面（如系统管理下的组织架构 / 角色管理）
  if (to.meta.requiresAdmin) {
    // 旧版本登录留下的缓存里可能没有 roleCodes，这里补拉一次再判断
    if (!auth.userInfo?.roleCodes) {
      try {
        await auth.fetchUserInfo()
      } catch {
        // 拉取失败时不放行，走下面的拒绝分支
      }
    }
    if (!auth.isAdmin) {
      ElMessage.warning('该功能仅系统管理员可用')
      return { path: '/' }
    }
  }

  return true
})

router.afterEach((to) => {
  const pageTitle = to.meta.title as string | undefined
  document.title = pageTitle ? `${pageTitle} - ${APP_TITLE}` : APP_TITLE
})

export default router
