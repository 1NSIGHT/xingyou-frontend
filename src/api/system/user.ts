import { request } from '@/api/request'
import type { PageResult } from './role'

/** 用户视图对象，与后端 UserVO 对应。注意：不含任何密码字段 */
export interface UserVO {
  id: number
  username: string
  realName: string
  mobile?: string
  email?: string
  orgId?: number
  orgName?: string
  /** 1=启用 0=停用 */
  status: number
  /** 是否处于登录失败锁定中 */
  locked: boolean
  lockedUntil?: string
  lastLoginAt?: string
  /** 角色名称，用于展示 */
  roles: string[]
  /** 角色编码，用于权限判断 */
  roleCodes: string[]
  /** 角色 ID，编辑时回显 */
  roleIds: number[]
  remark?: string
  createdAt?: string
}

export interface UserSaveParams {
  /** 登录名，仅新增时使用 */
  username: string
  /** 初始密码。留空表示使用系统初始密码 */
  password?: string
  realName: string
  mobile?: string
  email?: string
  orgId?: number | null
  roleIds?: number[]
  status?: number
  remark?: string
}

export interface UserQuery {
  keyword?: string
  orgId?: number | null
  /** 是否含下级组织，默认 true */
  includeSubOrg?: boolean
  status?: number | null
  current?: number
  size?: number
}

export function getUserPageApi(params: UserQuery) {
  return request<PageResult<UserVO>>({ url: '/system/user/page', method: 'get', params })
}

export function getUserDetailApi(id: number) {
  return request<UserVO>({ url: `/system/user/${id}`, method: 'get' })
}

export function createUserApi(data: UserSaveParams) {
  return request<number>({ url: '/system/user', method: 'post', data })
}

export function updateUserApi(id: number, data: UserSaveParams) {
  return request<void>({ url: `/system/user/${id}`, method: 'put', data })
}

export function deleteUserApi(id: number) {
  return request<void>({ url: `/system/user/${id}`, method: 'delete' })
}

/** 重置密码；不传 newPassword 表示重置为系统初始密码 */
export function resetPasswordApi(id: number, newPassword?: string) {
  return request<void>({
    url: `/system/user/${id}/password`,
    method: 'put',
    data: { newPassword: newPassword ?? '' },
  })
}

export function changeUserStatusApi(id: number, status: number) {
  return request<void>({
    url: `/system/user/${id}/status`,
    method: 'put',
    params: { status },
  })
}

export function unlockUserApi(id: number) {
  return request<void>({ url: `/system/user/${id}/unlock`, method: 'put' })
}
