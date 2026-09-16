import { request } from '@/api/request'
import type { DictOption } from './org'

/** 角色视图对象，与后端 RoleVO 对应 */
export interface RoleVO {
  id: number
  code: string
  name: string
  sort: number
  dataScope: string
  dataScopeLabel: string
  remark?: string
  userCount: number
  createdAt?: string
}

export interface RoleSaveParams {
  code: string
  name: string
  sort?: number
  dataScope: string
  remark?: string
}

export interface RoleQuery {
  keyword?: string
  current?: number
  size?: number
}

export interface PageResult<T> {
  records: T[]
  total: number
  current: number
  size: number
}

export function getRolePageApi(params: RoleQuery) {
  return request<PageResult<RoleVO>>({ url: '/system/role/page', method: 'get', params })
}

export function getRoleListApi() {
  return request<RoleVO[]>({ url: '/system/role/list', method: 'get' })
}

export function getDataScopesApi() {
  return request<DictOption[]>({ url: '/system/role/data-scopes', method: 'get' })
}

export function createRoleApi(data: RoleSaveParams) {
  return request<number>({ url: '/system/role', method: 'post', data })
}

export function updateRoleApi(id: number, data: RoleSaveParams) {
  return request<void>({ url: `/system/role/${id}`, method: 'put', data })
}

export function deleteRoleApi(id: number) {
  return request<void>({ url: `/system/role/${id}`, method: 'delete' })
}
