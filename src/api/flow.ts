import { request } from '@/api/request'

/** 待办列表项，与后端 FlowQueryService.TodoVO 对应 */
export interface TodoVO {
  taskId: number
  instanceId: number
  flowKey: string
  flowName: string
  nodeKey: string
  nodeName: string | null
  /** ANY 或签 / ALL 会签 */
  nodeMode: string
  documentId: number
  documentTitle: string | null
  formKey: string
  initiatorId: number | null
  initiatorName: string | null
  createdAt: string
  dueAt: string | null
  overdue: boolean
}

/** 我的申请列表项 */
export interface MyApplicationVO {
  instanceId: number
  flowKey: string
  flowName: string
  status: string
  currentNodeKey: string | null
  currentNodeName: string | null
  documentId: number
  documentTitle: string | null
  startedAt: string
  endedAt: string | null
}

export interface FlowTaskVO {
  id: number
  nodeKey: string
  nodeName: string | null
  assigneeId: number
  nodeMode: string
  status: string
  action: string | null
  comment: string | null
  createdAt: string
  handledAt: string | null
}

export interface FlowLogVO {
  id: number
  nodeKey: string | null
  nodeName: string | null
  operatorId: number | null
  action: string
  comment: string | null
  createdAt: string
}

export interface InstanceDetailVO {
  instanceId: number
  flowKey: string
  flowName: string
  status: string
  currentNodeKey: string | null
  currentNodeName: string | null
  documentId: number
  documentTitle: string | null
  documentStatus: string | null
  formKey: string
  flowDefVersion: number
  tasks: FlowTaskVO[]
  logs: FlowLogVO[]
  /** 当前登录用户在这个实例上还能处理的任务。由服务端算，前端不重推 */
  myTaskIds: string[]
  /** 我的任务允许退回到哪些节点 */
  myReturnTargets: string[]
}

export interface ReturnTargetVO {
  nodeKey: string
  nodeName: string
}

/**
 * 发起流程。单据必须**已经保存过** —— 审批人可能按单据字段来定。
 *
 * 重复调用是幂等的：同一张单据只会有一条在跑的流程。
 */
export function startFlowApi(flowKey: string, documentId: number) {
  return request<number>({
    url: '/flow/start',
    method: 'post',
    data: { flowKey, documentId },
  })
}

export function approveTaskApi(taskId: number, comment: string) {
  return request<void>({
    url: `/flow/task/${taskId}/approve`,
    method: 'post',
    data: { comment },
  })
}

/** 不同意 —— 流程终止。区别于「退回」：不同意是到此为止，退回是改完再来 */
export function rejectTaskApi(taskId: number, comment: string) {
  return request<void>({
    url: `/flow/task/${taskId}/reject`,
    method: 'post',
    data: { comment },
  })
}

export function returnTaskApi(taskId: number, targetNodeKey: string, comment: string) {
  return request<void>({
    url: `/flow/task/${taskId}/return`,
    method: 'post',
    data: { targetNodeKey, comment },
  })
}

export function getTodoApi() {
  return request<TodoVO[]>({ url: '/flow/todo', method: 'get' })
}

export function getMyApplicationsApi() {
  return request<MyApplicationVO[]>({ url: '/flow/mine', method: 'get' })
}

export function getInstanceDetailApi(instanceId: number) {
  return request<InstanceDetailVO>({ url: `/flow/instance/${instanceId}`, method: 'get' })
}

export function getReturnTargetsApi(instanceId: number, nodeKey: string) {
  return request<ReturnTargetVO[]>({
    url: `/flow/instance/${instanceId}/return-targets`,
    method: 'get',
    params: { nodeKey },
  })
}
