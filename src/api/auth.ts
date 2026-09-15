import { request } from './request'

/** 登录方式 */
export type LoginType = 'password' | 'sms'

export interface LoginParams {
  /** 登录方式 */
  type: LoginType
  /** 用户名（账号密码登录） */
  username?: string
  /** 密码（账号密码登录） */
  password?: string
  /** 手机号（验证码登录） */
  mobile?: string
  /** 短信验证码 */
  smsCode?: string
  /** 图形验证码 */
  captcha: string
  /** 图形验证码标识 */
  captchaKey: string
  /** 记住我 */
  rememberMe?: boolean
}

export interface LoginResult {
  accessToken: string
  refreshToken?: string
  expiresIn: number
}

export interface UserInfo {
  userId: number
  username: string
  realName: string
  /** 所属监理公司 / 租户名称 */
  tenantName: string
  /** 当前默认项目 */
  projectName: string
  roles: string[]
  avatar?: string
}

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

/** 模拟网络延迟 */
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 登录
 * 后端对应：POST /api/auth/login
 */
export async function loginApi(params: LoginParams): Promise<LoginResult> {
  if (USE_MOCK) {
    await delay(700)
    const account = params.type === 'password' ? (params.username ?? '') : (params.mobile ?? '')
    // 便于演示各类异常分支
    if (account === 'locked') {
      throw new Error('账号已被锁定，请联系系统管理员')
    }
    if (params.type === 'sms' && params.smsCode !== '123456') {
      throw new Error('短信验证码不正确')
    }
    return {
      accessToken: `mock-token-${Date.now()}`,
      refreshToken: `mock-refresh-${Date.now()}`,
      expiresIn: 7200,
    }
  }
  return request<LoginResult>({ url: '/auth/login', method: 'post', data: params })
}

/**
 * 获取当前登录用户信息
 * 后端对应：GET /api/auth/me
 */
export async function getUserInfoApi(): Promise<UserInfo> {
  if (USE_MOCK) {
    await delay(300)
    return {
      userId: 1001,
      username: 'zhangsup',
      realName: '张建国',
      tenantName: '兴油工程监理有限公司',
      projectName: '西气东输四线管道工程（二标段）',
      roles: ['总监理工程师'],
      avatar: '',
    }
  }
  return request<UserInfo>({ url: '/auth/me', method: 'get' })
}

/**
 * 登出
 * 后端对应：POST /api/auth/logout
 */
export async function logoutApi(): Promise<void> {
  if (USE_MOCK) {
    await delay(200)
    return
  }
  return request<void>({ url: '/auth/logout', method: 'post' })
}

/**
 * 获取图形验证码
 * 后端对应：GET /api/auth/captcha
 * 注意：当前前端在 Canvas 本地生成，接入后端后删除本地绘制逻辑
 */
export async function getCaptchaApi(): Promise<{ captchaKey: string; captchaImage: string }> {
  if (USE_MOCK) {
    await delay(120)
    return { captchaKey: `mock-captcha-${Date.now()}`, captchaImage: '' }
  }
  return request({ url: '/auth/captcha', method: 'get' })
}

/**
 * 发送短信验证码
 * 后端对应：POST /api/auth/sms-code
 */
export async function sendSmsCodeApi(mobile: string): Promise<void> {
  if (USE_MOCK) {
    await delay(500)
    console.info(`[mock] 短信验证码已发送至 ${mobile}，演示码：123456`)
    return
  }
  return request<void>({ url: '/auth/sms-code', method: 'post', data: { mobile } })
}
