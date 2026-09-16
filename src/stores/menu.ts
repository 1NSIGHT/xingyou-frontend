import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getMyMenusApi, type MenuNode } from '@/api/system/menu'

/**
 * 当前用户可访问的菜单。
 *
 * ★ 为什么放进 store 而不是在 AppLayout 里拉一次：
 *   路由守卫也要用（拦住手敲 URL 的人）。两处各自拉一次会不一致，
 *   而且会在每次导航时多打一次接口。
 *
 * ★ 这是**界面层**的权限，不是安全边界。
 *   隐藏一个菜单不会阻止任何人直接调那个接口 —— 真正的门是后端的 @PreAuthorize。
 *   它的作用是让界面不撒谎：不显示用户点了会吃 403 的入口。
 */
export const useMenuStore = defineStore('menu', () => {
  const menus = ref<MenuNode[]>([])
  const keys = ref<string[]>([])
  const loaded = ref(false)

  /**
   * 拉取菜单。并发调用只会真正请求一次 ——
   * 路由守卫和 AppLayout 会在同一次导航里几乎同时触发它。
   */
  let inflight: Promise<void> | null = null

  async function load(): Promise<void> {
    if (loaded.value) return
    if (inflight) return inflight
    inflight = (async () => {
      try {
        const res = await getMyMenusApi()
        menus.value = res.menus ?? []
        keys.value = res.keys ?? []
        loaded.value = true
      } finally {
        inflight = null
      }
    })()
    return inflight
  }

  /** 登录态变化时必须清 —— 否则切换账号会带着上一个账号的菜单 */
  function reset() {
    menus.value = []
    keys.value = []
    loaded.value = false
    inflight = null
  }

  /** 是否拥有某个菜单 key */
  function has(key: string | undefined): boolean {
    if (!key) return true
    return keys.value.includes(key)
  }

  return { menus, keys, loaded, load, reset, has }
})
