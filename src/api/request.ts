import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'

/** 后端统一响应体（与架构方案中的 xy-common 保持一致） */
export interface ApiResult<T = unknown> {
  code: number
  message: string
  data: T
}

/** 业务成功码 */
const CODE_SUCCESS = 0
/** 未认证 / 令牌失效 */
const CODE_UNAUTHORIZED = 401

export const TOKEN_KEY = 'xy_access_token'

const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json;charset=utf-8' },
})

service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

/**
 * 响应拦截器在此处解包业务数据，因此调用方拿到的直接是 data 而不是 AxiosResponse。
 * axios 的类型定义不支持这种用法，故显式放宽为 any。
 */
service.interceptors.response.use(
  (response): any => {
    const res = response.data as ApiResult
    if (res.code === CODE_SUCCESS) {
      return res.data
    }
    if (res.code === CODE_UNAUTHORIZED) {
      // 仅清理令牌，跳转交由路由守卫处理，避免此处依赖 router 造成循环引用
      localStorage.removeItem(TOKEN_KEY)
    }
    ElMessage.error(res.message || '请求失败')
    return Promise.reject(new Error(res.message || '请求失败'))
  },
  (error): any => {
    const status = error?.response?.status
    const message =
      status === CODE_UNAUTHORIZED
        ? '登录状态已失效，请重新登录'
        : status === 403
          ? '没有访问权限'
          : status === 500
            ? '服务器内部错误'
            : error?.message?.includes('timeout')
              ? '请求超时，请检查网络'
              : '网络异常，请稍后重试'
    ElMessage.error(message)
    return Promise.reject(error)
  },
)

/** 泛型化请求方法：返回类型直接是业务 data */
export function request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
  return service.request(config) as unknown as Promise<T>
}

export default service
