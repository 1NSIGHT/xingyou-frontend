/**
 * 表单 Schema 的 TypeScript 类型定义。
 *
 * 与后端 `com.xingyou.modules.meta.enums` 及
 * `docs/表单-Schema-规范.md` 一一对应。
 *
 * ★ 改这个文件前先读规范。类型定义是契约的可执行形式，
 *   前后端不一致的后果是数据静默变形（前端按 number 提交、后端按 string 存）。
 */

// ============================================================ 基础枚举

/**
 * 字段值的存储类型。
 *
 * 决定值在 `biz_document.data_json`（JSONB）里以什么形态存放，
 * 进而决定**能否生成数据库生成列**：string / number / boolean 可以，
 * array / object 不可以。
 */
export type ValueType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'none'

/** 字段类型分组，用于设计器左侧物料面板分类 */
export type FieldCategory =
  | 'BASIC'
  | 'NUMBER'
  | 'DATE'
  | 'CHOICE'
  | 'ATTACHMENT'
  | 'PERSON'
  | 'LAYOUT'
  | 'INDUSTRY'

/** 首批字段类型。完整清单见 @/schema/constants 的 FIELD_TYPES */
export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'amount'
  | 'date'
  | 'datetime'
  | 'dateRange'
  | 'select'
  | 'radio'
  | 'multiSelect'
  | 'checkbox'
  | 'switch'
  | 'file'
  | 'image'
  | 'signature'
  | 'userPicker'
  | 'divider'
  | 'section'
  | 'weldJoint'
  | 'stakeNo'
  | 'qcPoint'
  | 'dictTree'
  | 'coordinate'

// ============================================================ 条件表达式

/**
 * 条件表达式，用于 `visible` / `disabled`。
 *
 * 刻意保持简单（规范 3.6）：**不支持任意表达式树、函数调用、跨表单引用**。
 * 一旦放开，前端需要一个表达式引擎、后端需要另一个且必须行为一致，复杂度失控。
 */
export type Condition =
  | { field: string; op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'; value: unknown }
  | { field: string; op: 'in' | 'notIn'; value: unknown[] }
  | { field: string; op: 'notEmpty' }
  | { and: Condition[] }
  | { or: Condition[] }

// ============================================================ 校验规则

/** 规则名。执行方见规范 3.5 的规则清单 */
export type RuleName =
  | 'required'
  | 'length'
  | 'pattern'
  | 'range'
  | 'dateRange'
  | 'compareField'
  | 'countRange'
  | 'unique'
  | 'dictExists'
  | 'custom'

export interface ValidationRule {
  rule: RuleName
  /** 自定义提示语；不填则用默认文案 */
  message?: string

  // length / countRange
  min?: number
  max?: number

  // pattern
  value?: unknown

  // dateRange：支持 "today" 关键字
  // compareField
  op?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
  refField?: string

  // unique（v1.1：从数组改为枚举）
  scope?: 'tenant' | 'project' | 'form'

  // dictExists
  dictCode?: string

  // custom（行业 SPI）
  name?: string
  params?: Record<string, unknown>
}

// ============================================================ 数据源

/** 静态字典 */
export interface DictDataSource {
  kind: 'dict'
  dictCode: string
}

/** 关联业务台账（如焊口台账） */
export interface LedgerDataSource {
  kind: 'ledger'
  ledger: string
  valueField: string
  labelField: string
  displayFields?: string[]
  /** 与其它字段联动过滤 */
  filters?: Array<{ field: string; sourceField: string }>
  multiple?: boolean
  pageSize?: number
}

/** 选人 */
export interface UserDataSource {
  kind: 'user'
  orgScope: 'CURRENT_PROJECT' | 'CURRENT_DEPT' | 'TENANT'
  roleFilter?: string[]
  multiple?: boolean
}

/** GB 四级工程划分（项目级树，非租户级字典） */
export interface GbDivisionSource {
  kind: 'gbDivision'
  level: 1 | 2 | 3 | 4
}

/** 级联 */
export interface CascadeDataSource {
  kind: 'cascade'
  levels: Array<{
    key: string
    label: string
    source: DictDataSource | GbDivisionSource
  }>
  valueMode?: 'ALL_LEVELS' | 'LEAF_ONLY'
  /**
   * ★ v1.1 新增：把指定层级编码**同时写入**一个可索引标量字段的 key。
   *
   * 为什么需要：级联值默认存数组，数组无法生成数据库索引，
   * 而「单位工程」是监理报表最高频的筛选与统计维度 —— 不落标量就只能全表扫。
   */
  storageKey?: string
  storageLevel?: 1 | 2 | 3 | 4
}

export type DataSource = DictDataSource | LedgerDataSource | UserDataSource | CascadeDataSource

// ============================================================ 字段

export interface FieldPermission {
  /** 可读的角色编码；未列出的角色默认**不可读**（v1.1 改为默认拒绝） */
  read?: string[]
  /** 可写的角色编码 */
  write?: string[]
  /** 完全不可见（字段不出现在响应里） */
  hidden?: string[]
}

/** 动态默认值令牌。刻意只支持固定枚举，不支持任意表达式 */
export type DefaultValueToken =
  | '$today'
  | '$currentUser'
  | '$currentUserName'
  | '$currentProject'
  | '$currentOrg'

export interface FieldDef {
  /** ★ 稳定标识，发布后不可修改（铁律 1） */
  key: string
  label: string
  type: FieldType
  /** 存储类型；多数情况由 type 推导，行业物料可显式指定 */
  valueType?: ValueType

  required?: boolean
  /** 栅格占宽（24 栅格制） */
  span?: number
  /** 是否生成数据库生成列与索引。unique 为 true 时强制为 true */
  indexable?: boolean
  unique?: boolean

  placeholder?: string
  tip?: string
  defaultValue?: unknown | DefaultValueToken
  /** 已下线字段：不渲染、不可查，但保留 key 以解析历史数据（规范 8.5） */
  archived?: boolean
  archivedAt?: string

  props?: Record<string, unknown>
  dataSource?: DataSource
  rules?: ValidationRule[]
  visible?: Condition
  disabled?: Condition
  permission?: FieldPermission

  /** 仅 section 使用 */
  children?: FieldDef[]
  collapsible?: boolean
  defaultCollapsed?: boolean
}

// ============================================================ 子表

export interface SubFormColumn {
  key: string
  label: string
  type: FieldType
  valueType?: ValueType
  required?: boolean
  width?: number
  props?: Record<string, unknown>
  dataSource?: DataSource
  /** 列与主表字段同构（规范 4.1），除不支持 indexable */
  rules?: ValidationRule[]
  visible?: Condition
  disabled?: Condition
  permission?: FieldPermission
  defaultValue?: unknown | DefaultValueToken
}

export interface SubFormDef {
  key: string
  label: string
  /** 桌面端呈现：表格内联编辑 / 卡片列表 */
  mode: 'TABLE' | 'LIST'
  /** 移动端呈现，默认 LIST —— 表格在手机上放不下 */
  mobileMode?: 'TABLE' | 'LIST'
  minRows?: number
  maxRows?: number
  allowAdd?: boolean
  allowDelete?: boolean
  allowSort?: boolean
  /** 需要显示合计的数值列 key */
  summaryFields?: string[]
  columns: SubFormColumn[]
}

// ============================================================ 布局与配置

export interface LayoutDef {
  /** 桌面端默认列数 */
  columns?: number
  labelWidth?: string
  labelPosition?: 'right' | 'top'
  /** 移动端强制列数，通常为 1 */
  mobileColumns?: number
}

export interface FormSettings {
  codeRule?: {
    pattern: string
    scope: 'NEVER' | 'YEAR' | 'MONTH' | 'PROJECT'
    start?: number
  }
  allowDraft?: boolean
  allowWithdraw?: boolean
  attachmentRequired?: boolean
  defaultSort?: string
}

// ============================================================ 顶层

/**
 * 表单 Schema。
 *
 * ★ v1.1：**不含 version 字段**。版本号是 `meta_form_version` 表的列，
 *   不属于 schema —— 否则「设计器保存的」和「发布的」不是同一份数据。
 */
export interface FormSchema {
  $schema: 'xy-form/v1'
  /** ★ 稳定标识，发布后不可修改 */
  formKey: string
  name: string
  /** 取自字典 form_category */
  category?: string
  layout: LayoutDef
  fields: FieldDef[]
  subForms?: SubFormDef[]
  settings?: FormSettings
}
