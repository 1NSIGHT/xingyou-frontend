import { request } from '@/api/request'

/** 组织树节点，与后端 OrgTreeNode 对应 */
export interface OrgTreeNode {
  id: number
  parentId: number
  name: string
  code?: string
  orgType: string
  orgTypeLabel: string
  leader?: string
  phone?: string
  sort: number
  status: number
  remark?: string
  userCount: number
  children: OrgTreeNode[]
}

export interface OrgSaveParams {
  parentId?: number | null
  name: string
  code?: string
  orgType: string
  leader?: string
  phone?: string
  sort?: number
  status?: number
  remark?: string
}

export interface DictOption {
  value: string
  label: string
}

export function getOrgTreeApi() {
  return request<OrgTreeNode[]>({ url: '/system/org/tree', method: 'get' })
}

export function getOrgTypesApi() {
  return request<DictOption[]>({ url: '/system/org/types', method: 'get' })
}

export function createOrgApi(data: OrgSaveParams) {
  return request<number>({ url: '/system/org', method: 'post', data })
}

export function updateOrgApi(id: number, data: OrgSaveParams) {
  return request<void>({ url: `/system/org/${id}`, method: 'put', data })
}

export function deleteOrgApi(id: number) {
  return request<void>({ url: `/system/org/${id}`, method: 'delete' })
}
