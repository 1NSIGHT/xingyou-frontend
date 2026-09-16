import { request } from '@/api/request'

/** 项目下拉项，与后端 ProjectVO 对应 */
export interface ProjectVO {
  id: number
  code: string
  name: string
}

/** 当前用户可访问的项目 */
export function getMyProjectsApi() {
  return request<ProjectVO[]>({ url: '/project/my', method: 'get' })
}
