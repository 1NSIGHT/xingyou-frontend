import { request } from '@/api/request'
import type { FormSchema } from '@/schema'

/** 已发布的表单定义，与后端 PublishedForm 对应 */
export interface PublishedForm {
  formKey: string
  version: number
  schema: FormSchema
}

/** 取当前生效的已发布定义（渲染器的数据来源） */
export function getPublishedFormApi(formKey: string) {
  return request<PublishedForm>({ url: `/meta/form/${formKey}/published`, method: 'get' })
}

/** 保存单据的载荷，与后端 SaveDocumentRequest 对应 */
export interface SaveDocumentPayload {
  formKey: string
  projectId?: number
  documentId?: number
  /** 当前流程节点。不传表示不走流程，此时节点作用域属性一律不生效 */
  nodeKey?: string
  data: Record<string, unknown>
  subForms?: Record<string, Array<Record<string, unknown>>>
}

export interface DocumentVO {
  id: number
  formKey: string
  formDefVersion: number
  docNo: string | null
  status: string
  data: Record<string, unknown>
  subForms: Record<string, Array<Record<string, unknown>>>
}

export function saveDocumentApi(payload: SaveDocumentPayload) {
  return request<DocumentVO>({ url: '/meta/document', method: 'post', data: payload })
}

export function getDocumentApi(id: number) {
  return request<DocumentVO>({ url: `/meta/document/${id}`, method: 'get' })
}

export interface DictItemVO {
  itemValue: string
  itemLabel: string
}

/**
 * 批量取字典项。
 *
 * 用批量接口而不是每个字段各发一次：一张表单可能有十几个选择字段，
 * 逐个请求会让填报页产生几十个并发请求。
 */
export function getDictItemsApi(codes: string[]) {
  if (codes.length === 0) return Promise.resolve({} as Record<string, DictItemVO[]>)
  return request<Record<string, DictItemVO[]>>({
    url: '/dict/items',
    method: 'get',
    // 后端是 @RequestParam List<String> codes，axios 默认序列化成 codes[]=a，
    // 用 repeat 才能得到 codes=a&codes=b
    params: { codes },
    paramsSerializer: { indexes: null },
  })
}

/** 已发布表单清单，与后端 FormSummary 对应 */
export interface FormSummary {
  formKey: string
  name: string | null
  version: number
  category: string | null
}

/**
 * 已发布表单清单 —— **填报入口的数据来源**。
 *
 * ★ 它是"平台"与"定制页面"的分界线：没有它，前端只能把 formKey 写死在代码里，
 *   于是"加一张表单"变成"改一次代码 + 发一次版"，而那正是低代码要消灭的东西。
 */
export function listFormsApi() {
  return request<FormSummary[]>({ url: '/meta/form', method: 'get' })
}
export interface PublishOutcome {
  formKey: string
  version: number
  status: string
  statementCount: number
}

/**
 * 发布表单定义。
 *
 * ★ 请求体是**原始 schema 文本**，刻意不先用 JSON.stringify 包一层对象。
 *   后端用 @RequestBody String 直接收原始 body，一步都不经过 FormSchemaDef ——
 *   一旦某个环节把 schema 解析成后端模型再写回，设计器不认识的属性会被静默删掉
 *   （用户看到的现象是"保存一次少一个配置"）。
 *   axios 传字符串时不会再加引号，正好符合这个约定。
 */
export function publishFormApi(schema: unknown) {
  return request<PublishOutcome>({
    url: '/meta/form/publish',
    method: 'post',
    data: typeof schema === 'string' ? schema : JSON.stringify(schema, null, 2),
    headers: { 'Content-Type': 'application/json' },
  })
}