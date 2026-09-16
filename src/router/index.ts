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
        // 表单设计器 —— 低代码平台的**定义入口**。
        // 没有它，用户只能在运行时填表、不能定义表，那就不是低代码平台。
        path: 'designer',
        meta: { title: '表单设计' },
        children: [
          {
            path: '',
            name: 'DesignerNew',
            component: () => import('@/views/meta/designer/index.vue'),
            meta: { title: '新建表单' },
          },
          {
            path: ':formKey',
            name: 'DesignerEdit',
            component: () => import('@/views/meta/designer/index.vue'),
            meta: { title: '编辑表单' },
          },
        ],
      },      {
        // 流程设计器 —— 低代码平台的**第二个定义入口**。
        // 表单定义回答"一张单据长什么样"，流程定义回答"它怎么流转"。
        // 同样没有写死任何流程标识，:formKey 只是带过去绑定用。
        path: 'flow',
        meta: { title: '流程设计' },
        children: [
          {
            path: '',
            name: 'FlowDesignerNew',
            component: () => import('@/views/meta/flow/designer.vue'),
            meta: { title: '新建流程' },
          },
          {
            path: ':formKey',
            name: 'FlowDesignerEdit',
            component: () => import('@/views/meta/flow/designer.vue'),
            meta: { title: '流程设计' },
          },
        ],
      },      {
        // 低代码填报。★ 这里**没有写死任何表单标识** ——
        // 清单从后端 meta_form 查，:formKey 由用户点击带入。
        // 在设计器里发布一张新表单，它会自动出现在清单里，不动这个文件。
        path: 'document',
        meta: { title: '单据填报' },
        children: [
          {
            path: '',
            name: 'DocumentList',
            component: () => import('@/views/meta/document/list.vue'),
            meta: { title: '单据填报' },
          },
          {
            path: ':formKey',
            name: 'DocumentFill',
            component: () => import('@/views/meta/document/index.vue'),
            meta: { title: '填写单据' },
          },
        ],
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
            path: 'user',
            name: 'SystemUser',
            component: () => import('@/views/system/user/index.vue'),
            meta: { title: '用户管理', requiresAdmin: true },
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
