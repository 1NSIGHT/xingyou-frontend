/**
 * 表单 Schema 的 TypeScript 类型定义。
 *
 * 与后端 `com.xingyou.modules.meta.enums` 及
 * `docs/表单-Schema-规范.md` 一一对应。
 *
 * ★ 改这个文件前先读规范。类型定义是契约的可执行形式，
 *   前后端不一致的后果是数据静默变形（前端按 number 提交、后端按 string 存）。
 */

// ============================================================ 多语言文本

/**
 * 多语言文本。所有**面向用户展示**的文本都用它，而不是裸字符串。
 *
 * 两种写法都合法：
 * ```ts
 * "焊口编号"                                  // 简写：单语言
 * { 'zh-CN': '焊口编号', en: 'Weld No.' }     // 完整：多语言
 * ```
 *
 * 解析回退链：请求语言 → zh-CN → 对象中的第一个值 → 空字符串。
 * 因此**裸字符串天然兼容**，历史 schema 无需修改。
 *
 * 不适用：key / formKey / type / dictCode / 角色编码等**标识符**——它们不翻译。
 */
export type I18nText = string | Record<string, string>

/** 基线语言。缺失任何翻译时回退到它 */
export const DEFAULT_LOCALE = 'zh-CN'

/**
 * 按语言解析 I18nText。
 *
 * 前端渲染器与后端响应裁剪**必须使用同一套回退规则**，
 * 否则会出现「前端显示中文、导出 PDF 是空白」这类不一致。
 */
export function resolveI18n(text: I18nText | undefined | null, locale = DEFAULT_LOCALE): string {
  if (!text) return ''
  if (typeof text === 'string') return text

  if (text[locale]) return text[locale]
  if (text[DEFAULT_LOCALE]) return text[DEFAULT_LOCALE]

  const first = Object.values(text)[0]
  return first ?? ''
}

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
  /** 自定义提示语；不填则用默认文案。多语言，见 I18nText */
  message?: I18nText

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

/**
 * 数据源 —— 字段的选项来源。
 *
 * `kind` **不是封闭枚举**（规范 3.4.2）：
 * - 内核种类：`dict` / `ledger` / `form` / `user` / `cascade`（无前缀）
 * - 扩展种类：**必须带命名空间**，如 `industry:device`、`power:meter`
 *
 * 未注册的 kind 在发布时被拒绝（后端侧由 DataSourceResolver SPI 判定）。
 */
export type KernelDataSourceKind = 'dict' | 'ledger' | 'form' | 'user' | 'cascade'

/** 静态字典 */
export interface DictDataSource {
  kind: 'dict'
  dictCode: string
}

/**
 * 关联业务台账。
 *
 * 台账标识由后端解析，可能是两种形态（规范 3.4.2 b）：
 * - **物理表台账**：高频核心实体（焊口、管线），独立表 + 索引，查询性能最好
 * - **元数据台账**：长尾台账，由 meta_ledger 描述字段，不写代码
 * schema 无需区分，取值完全相同。
 */
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

/**
 * 引用**另一张表单**的数据。
 *
 * 解决「整改通知单引用质量检查单」这类表单间引用 —— v1.1 不支持，
 * 导致整改闭环类业务做不顺。
 *
 * ★ 三条安全约束（后端必须实现）：
 *   1. 继承被引用表单的权限：用户无权查看的单据不出现在候选列表里
 *   2. 受数据权限约束：跨项目数据不可见
 *   3. 状态过滤：默认只列 APPROVED，是否允许引用草稿由 props.allowDraft 控制
 */
export interface FormDataSource {
  kind: 'form'
  /** 被引用的表单标识 */
  formKey: string
  valueField: string
  labelField: string
  displayFields?: string[]
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
    label: I18nText
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

/**
 * 行业扩展的数据源。
 *
 * kind 形如 `<namespace>:<name>`，由行业模块通过 DataSourceResolver SPI 注册。
 * 前端渲染器按 kind 查找已注册的选择器组件；找不到时**渲染成禁用状态并显示原因**，
 * 而不是留一个点了没反应的输入框。
 */
export interface ExtensionDataSource {
  kind: `${string}:${string}`
  /** 扩展数据源的参数由各行业模块自行约定 */
  [key: string]: unknown
}

export type DataSource =
  | DictDataSource
  | LedgerDataSource
  | FormDataSource
  | UserDataSource
  | CascadeDataSource
  | ExtensionDataSource

/** 数据源候选选项，与后端 DataSourceOption 对应 */
export interface DataSourceOption {
  value: unknown
  /** 展示文本。台账/表单的 label 由数据本身决定，不需翻译 */
  label: string
  /** 额外字段，用于选中后回填其它字段 */
  extra?: Record<string, unknown>
}

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
  /** 展示文本。多语言，见 I18nText */
  label: I18nText
  type: FieldType
  /** 存储类型；多数情况由 type 推导，行业物料可显式指定 */
  valueType?: ValueType

  required?: boolean
  /** 栅格占宽（24 栅格制） */
  span?: number
  /** 是否生成数据库生成列与索引。unique 为 true 时强制为 true */
  indexable?: boolean
  unique?: boolean

  placeholder?: I18nText
  tip?: I18nText
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
  label: I18nText
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
  label: I18nText
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
  /** 展示名称。多语言，见 I18nText */
  name: I18nText
  /** 取自字典 form_category */
  category?: string
  layout: LayoutDef
  fields: FieldDef[]
  subForms?: SubFormDef[]
  settings?: FormSettings
}
