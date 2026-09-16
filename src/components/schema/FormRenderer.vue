<script setup lang="ts">
/**
 * Schema 驱动的表单渲染器。
 *
 * ★ 它是**通用**的：不认识"不符合项"这个词，只认识 schema。
 *   这是低代码平台与定制系统的分界线 —— 加一个字段只需要改设计器里的定义，
 *   不需要碰这个文件。
 *
 * 职责边界（很重要）：
 *   · 前端只负责**体验**：按条件显隐、按权限置灰、格式提示
 *   · **安全全部在后端**：提交后会再跑一遍八步校验，且落库用的是后端产出的值
 *   所以这里的判定即使失效，也不会导致越权写入 —— 只会让界面难看。
 */
import { computed, ref, watch } from 'vue'
import type { FieldDef, FormSchema, I18nText } from '@/schema'
import { evaluateCondition, resolveI18n } from '@/schema'
import { isFieldVisible, isRequiredAtNode, isWritable } from '@/schema/permission'
import { getDictItemsApi, type DictItemVO } from '@/api/meta'

const props = defineProps<{
  schema: FormSchema
  modelValue: Record<string, unknown>
  /** 当前流程节点。不传表示不走流程，节点作用域属性一律不生效 */
  nodeKey?: string | null
  roles?: string[]
  readonly?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [Record<string, unknown>] }>()

const dicts = ref<Record<string, DictItemVO[]>>({})
const locale = 'zh-CN'

const data = computed(() => props.modelValue ?? {})
const roleList = computed(() => props.roles ?? [])
const node = computed(() => props.nodeKey ?? null)

function label(text: I18nText | undefined, fallback: string) {
  return resolveI18n(text, locale) || fallback
}

function setValue(key: string, value: unknown) {
  emit('update:modelValue', { ...data.value, [key]: value })
}

// ---------------------------------------------------------------- 字段展平
/** section 容器不取值，其子字段以顶层 key 参与提交（与后端 FieldDef.flatten 一致） */
function flatten(fields: FieldDef[] | undefined): FieldDef[] {
  const out: FieldDef[] = []
  const walk = (list?: FieldDef[]) => {
    for (const f of list ?? []) {
      if (f.type === 'section') {
        walk(f.children)
      } else if (f.type !== 'divider') {
        out.push(f)
      }
    }
  }
  walk(fields)
  return out
}

const allFields = computed(() => flatten(props.schema?.fields))

/**
 * 逐字段求可见性。
 *
 * 条件求值用的是**当前界面上已有的值** —— 与后端"只用本次提交的值"同源，
 * 这正是前端与后端能得出相同显隐结果的原因（见 condition-vectors.json）。
 */
const visibility = computed<Record<string, boolean>>(() => {
  const result: Record<string, boolean> = {}

  // 第一遍：角色 + 节点维度。先算完，条件求值才能引用到它们的结果
  for (const field of allFields.value) {
    result[field.key] = isFieldVisible(field, roleList.value, node.value)
  }

  // 条件求值的取值域：不可见的字段视为 null（规范 3.6），
  // 与后端 VisibilityResolver 的"引用不可见字段按 null 判断"一致
  const scope: Record<string, unknown> = { ...data.value }
  for (const [key, visible] of Object.entries(result)) {
    if (!visible) scope[key] = undefined
  }

  // 第二遍：条件显隐
  for (const field of allFields.value) {
    if (!result[field.key]) continue
    result[field.key] = evaluateCondition(field.visible, scope)
  }
  return result
})

function canWrite(field: FieldDef) {
  if (props.readonly) return false
  return isWritable(field, roleList.value, node.value)
}

function optionsOf(field: FieldDef): DictItemVO[] {
  const code = field.dataSource && 'dictCode' in field.dataSource
    ? (field.dataSource as { dictCode?: string }).dictCode
    : undefined
  return code ? dicts.value[code] ?? [] : []
}

// ---------------------------------------------------------------- 字典预取
watch(
  () => props.schema?.formKey,
  async () => {
    const codes = new Set<string>()
    for (const field of allFields.value) {
      const ds = field.dataSource as { dictCode?: string } | undefined
      if (ds?.dictCode) codes.add(ds.dictCode)
    }
    if (codes.size > 0) {
      try {
        dicts.value = await getDictItemsApi([...codes])
      } catch {
        // 字典取不到不该让整个填报页白屏 —— 选择框会是空的，但其它字段仍可填
        dicts.value = {}
      }
    }
  },
  { immediate: true },
)

const subForms = computed(() => props.schema?.subForms ?? [])

function rowsOf(key: string): Array<Record<string, unknown>> {
  const rows = data.value[key]
  return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : []
}

function setRows(key: string, rows: Array<Record<string, unknown>>) {
  setValue(key, rows)
}

function addRow(subKey: string, columns: FieldDef[]) {
  const row: Record<string, unknown> = {}
  for (const column of columns) row[column.key] = null
  setRows(subKey, [...rowsOf(subKey), row])
}

function removeRow(subKey: string, index: number) {
  setRows(subKey, rowsOf(subKey).filter((_, i) => i !== index))
}

function setCell(subKey: string, index: number, columnKey: string, value: unknown) {
  const rows = rowsOf(subKey).map((r) => ({ ...r }))
  rows[index][columnKey] = value
  setRows(subKey, rows)
}

defineExpose({ allFields })
</script>

<template>
  <el-form label-width="120px" label-position="right">
    <!-- 主表字段。section 用分组标题呈现，不参与取值 -->
    <template v-for="group in schema?.fields ?? []" :key="group.key">
      <template v-if="group.type === 'section'">
        <el-divider content-position="left">{{ label(group.label, group.key) }}</el-divider>
        <el-row :gutter="16">
          <el-col
            v-for="field in (group.children ?? []).filter((c) => c.type !== 'section' && c.type !== 'divider')"
            :key="field.key"
            :span="field.span ?? 24"
          >
            <el-form-item
              v-if="visibility[field.key]"
              :label="label(field.label, field.key)"
              :required="isRequiredAtNode(field, node)"
            >
              <!-- 选择类 -->
              <el-select
                v-if="field.type === 'select' || field.type === 'radio'"
                :model-value="(data[field.key] as string) ?? ''"
                :disabled="!canWrite(field)"
                :placeholder="label(field.placeholder, '请选择')"
                clearable
                style="width: 100%"
                @update:model-value="(v: string) => setValue(field.key, v)"
              >
                <el-option
                  v-for="opt in optionsOf(field)"
                  :key="opt.itemValue"
                  :label="opt.itemLabel"
                  :value="opt.itemValue"
                />
              </el-select>

              <!-- 多行文本 -->
              <el-input
                v-else-if="field.type === 'textarea'"
                type="textarea"
                :rows="3"
                :model-value="(data[field.key] as string) ?? ''"
                :disabled="!canWrite(field)"
                :placeholder="label(field.placeholder, '')"
                @update:model-value="(v: string) => setValue(field.key, v)"
              />

              <!-- 日期 -->
              <el-date-picker
                v-else-if="field.type === 'date'"
                type="date"
                value-format="YYYY-MM-DD"
                :model-value="(data[field.key] as string) ?? ''"
                :disabled="!canWrite(field)"
                style="width: 100%"
                @update:model-value="(v: string) => setValue(field.key, v)"
              />

              <!-- 开关 -->
              <el-switch
                v-else-if="field.type === 'switch'"
                :model-value="Boolean(data[field.key])"
                :disabled="!canWrite(field)"
                @update:model-value="(v: boolean) => setValue(field.key, v)"
              />

              <!-- 附件 / 图片：文件服务尚未建设（M4），明确置灰并说明原因，
                   而不是给一个点了没反应的按钮 -->
              <el-tooltip
                v-else-if="field.type === 'image' || field.type === 'file'"
                content="文件服务尚未上线，当前无法上传"
                placement="top"
              >
                <el-input disabled :model-value="'（暂不支持上传）'" />
              </el-tooltip>

              <!-- 人员 / 组织 / 其它：先以文本占位，选择器组件属后续项 -->
              <el-input
                v-else-if="field.type === 'userPicker' || field.type === 'orgPicker'"
                :model-value="String(data[field.key] ?? '')"
                :disabled="!canWrite(field)"
                :placeholder="'（选择器组件待实现，可先手填 id）'"
                @update:model-value="(v: string) => setValue(field.key, v === '' ? null : v)"
              />

              <!-- 默认：文本 -->
              <el-input
                v-else
                :model-value="(data[field.key] as string) ?? ''"
                :disabled="!canWrite(field)"
                :placeholder="label(field.placeholder, '')"
                @update:model-value="(v: string) => setValue(field.key, v)"
              />

              <div v-if="field.tip" class="xy-tip">{{ label(field.tip, '') }}</div>
            </el-form-item>
          </el-col>
        </el-row>
      </template>

      <!-- 顶层非 section 字段 -->
      <el-row v-else-if="group.type !== 'divider'" :gutter="16">
        <el-col :span="group.span ?? 24">
          <el-form-item
            v-if="visibility[group.key]"
            :label="label(group.label, group.key)"
            :required="isRequiredAtNode(group, node)"
          >
            <el-select
              v-if="group.type === 'select'"
              :model-value="(data[group.key] as string) ?? ''"
              :disabled="!canWrite(group)"
              clearable
              style="width: 100%"
              @update:model-value="(v: string) => setValue(group.key, v)"
            >
              <el-option
                v-for="opt in optionsOf(group)"
                :key="opt.itemValue"
                :label="opt.itemLabel"
                :value="opt.itemValue"
              />
            </el-select>
            <el-date-picker
              v-else-if="group.type === 'date'"
              type="date"
              value-format="YYYY-MM-DD"
              :model-value="(data[group.key] as string) ?? ''"
              :disabled="!canWrite(group)"
              style="width: 100%"
              @update:model-value="(v: string) => setValue(group.key, v)"
            />
            <el-input
              v-else
              :model-value="(data[group.key] as string) ?? ''"
              :disabled="!canWrite(group)"
              @update:model-value="(v: string) => setValue(group.key, v)"
            />
          </el-form-item>
        </el-col>
      </el-row>
    </template>

    <!-- 明细子表：以表格内联编辑 -->
    <template v-for="sub in subForms" :key="sub.key">
      <el-divider content-position="left">{{ label(sub.label, sub.key) }}</el-divider>
      <el-table :data="rowsOf(sub.key)" border size="small">
        <el-table-column
          v-for="(col, ci) in sub.columns"
          :key="col.key"
          :label="label(col.label, col.key)"
          :width="col.width"
        >
          <template #default="{ row, $index }">
            <el-select
              v-if="col.type === 'select'"
              :model-value="(row[col.key] as string) ?? ''"
              :disabled="props.readonly || !canWrite(col)"
              clearable
              @update:model-value="(v: string) => setCell(sub.key, $index, col.key, v)"
            >
              <el-option
                v-for="opt in optionsOf(col)"
                :key="opt.itemValue"
                :label="opt.itemLabel"
                :value="opt.itemValue"
              />
            </el-select>
            <el-input
              v-else
              :model-value="row[col.key] === null || row[col.key] === undefined ? '' : String(row[col.key])"
              :disabled="props.readonly || !canWrite(col)"
              @update:model-value="(v: string) => setCell(sub.key, $index, col.key, v)"
            />
            <span v-if="ci === 0" />
          </template>
        </el-table-column>
        <el-table-column v-if="!props.readonly" label="操作" width="80">
          <template #default="{ $index }">
            <el-button link type="danger" @click="removeRow(sub.key, $index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-button
        v-if="!props.readonly && sub.allowAdd !== false"
        class="xy-add-row"
        @click="addRow(sub.key, sub.columns)"
      >
        新增一行
      </el-button>
    </template>
  </el-form>
</template>

<style scoped>
.xy-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  margin-top: 4px;
}
.xy-add-row {
  margin-top: 8px;
}
</style>
