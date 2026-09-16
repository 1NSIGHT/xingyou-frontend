import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  loginApi,
  logoutApi,
  getUserInfoApi,
  type LoginParams,
  type UserInfo,
} from '@/api/auth'
import { TOKEN_KEY } from '@/api/request'

const USER_INFO_KEY = 'xy_user_info'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem(TOKEN_KEY) || '')
  const userInfo = ref<UserInfo | null>(readCachedUserInfo())

  const isLoggedIn = computed(() => Boolean(token.value))
  const displayName = computed(() => userInfo.value?.realName || userInfo.value?.username || '')

  /** 角色编码列表 */
  const roleCodes = computed<string[]>(() => userInfo.value?.roleCodes ?? [])

  /**
   * 是否系统管理员。
   *
   * <p>只用于「要不要显示入口、要不要放行路由」这类体验判断。
   * <b>真正的权限边界在后端</b>（{@code @PreAuthorize}），前端判断绕过了也调不通接口。
   */
  const isAdmin = computed(() => roleCodes.value.includes('ADMIN'))

  function readCachedUserInfo(): UserInfo | null {
    try {
      const raw = localStorage.getItem(USER_INFO_KEY)
      return raw ? (JSON.parse(raw) as UserInfo) : null
    } catch {
      return null
    }
  }

  function setToken(value: string) {
    token.value = value
    if (value) {
      localStorage.setItem(TOKEN_KEY, value)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  }

  function setUserInfo(value: UserInfo | null) {
    userInfo.value = value
    if (value) {
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(value))
    } else {
      localStorage.removeItem(USER_INFO_KEY)
    }
  }

  async function login(params: LoginParams) {
    const result = await loginApi(params)
    setToken(result.accessToken)
    const info = await getUserInfoApi()
    setUserInfo(info)
    return result
  }

  async function fetchUserInfo() {
    const info = await getUserInfoApi()
    setUserInfo(info)
    return info
  }

  function reset() {
    setToken('')
    setUserInfo(null)
  }

  async function logout() {
    try {
      await logoutApi()
    } finally {
      reset()
    }
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    displayName,
    roleCodes,
    isAdmin,
    login,
    logout,
    fetchUserInfo,
    reset,
  }
})
