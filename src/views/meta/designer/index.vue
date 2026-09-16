<script setup lang="ts">
/**
 * 表单设计器（最小可用）—— 低代码平台的**定义入口**。
 *
 * ★ 在此之前，本平台的"低代码"只体现在运行时是 schema 驱动的；
 *   而用户**没有任何办法在界面上定义一张表单** —— 只能由开发写 JSON
 *   再调发布接口。那不是低代码平台，是"底层用 schema 的定制系统"。
 *   这个页面的存在与否，就是那个分界线。
 *
 * 刻意不做的事（够用即止）：
 *   · 不做拖拽 —— 点物料加入、列表里调序，同样能配出真实表单
 *   · 不做自由栅格 —— 用"宽度"下拉（整行/半行）
 *   · 不做节点选择器 —— 流程设计器还不存在，先用逗号分隔的文本填节点 key
 *
 * 复用的东西（都是前面已经建好并验证过的）：
 *   · 物料面板从 FIELD_TYPES 派生，加字段类型不需要改这个文件
 *   · 预览直接复用 FormRenderer —— 它本来就是 schema 驱动的
 *   · 发布调已有的 /api/meta/form/publish（发布协议与 DDL 生成器已完成）
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import FormRenderer from '@/components/schema/FormRenderer.vue'
import { FIELD_CATEGORIES, FIELD_TYPES } from '@/schema'
import { resolveI18n, type FieldDef, type FormSchema } from '@/schema'
import { getPublishedFormApi, publishFormApi } from '@/api/meta'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const formKey = ref(String(route.params.formKey ?? ''))
const formName = ref('')
const category = ref('')
const fields = ref<FieldDef[]>([])
const selected = ref<number>(-1)
const preview = ref(false)
const publishing = ref(false)
const isNew = computed(() => !route.params.formKey)

/** 已发布过的 key 不允许改 —— 铁律 1，发布后 key 不可修改 */
const keyLocked = computed(() => !isNew.value)

const materialsByCategory = computed(() =>
  FIELD_CATEGORIES.map((c) => ({
    ...c,
    items: FIELD_TYPES.filter((t) => t.category === c.code),
  })).filter((g) => g.items.length > 0),
)

const current = computed<FieldDef | undefined>(() => fields.value[selected.value])

const previewSchema = computed<FormSchema>(() => ({
  $schema: 'xy-form/v1',
  formKey: formKey.value || 'draft',
  name: formName.value ? { 'zh-CN': formName.value } : { 'zh-CN': '未命名表单' },
  category: category.value || undefined,
  layout: {},
  fields: fields.value,
}))

onMounted(async () => {
  if (isNew.value) return
  try {
    const published = await getPublishedFormApi(formKey.value)
    const schema = published.schema
    fields.value = JSON.parse(JSON.stringify(schema.fields ?? []))
    formName.value = resolveI18n(schema.name, 'zh-CN')
    category.value = schema.category ?? ''
  } catch (e) {
    ElMessage.error('加载表单定义失败：' + (e as Error).message)
  }
})

/** 加入一个字段。key 自动生成 —— 让用户手填 key 是最容易出错的一步 */
function insertField(type: (typeof FIELD_TYPES)[number], at: number) {
  const base = type.code.replace(/[A-Z]/g, (m) => m.toLowerCase())
  let index = fields.value.length + 1
  let key = `${base}${index}`
  const taken = new Set(fields.value.map((f) => f.key))
  while (taken.has(key)) key = `${base}${++index}`

  const field = {
    key,
    label: { 'zh-CN': type.label },
    type: type.code,
    span: 24,
    required: false,
    ...(type.dataSourceRequired
      ? { dataSource: { kind: 'dict', dictCode: '' } as never }
      : {}),
    ...(type.multipleValueType ? { props: { multiple: false } } : {}),
  } as FieldDef

  const list = [...fields.value]
  list.splice(at < 0 || at > list.length ? list.length : at, 0, field)
  fields.value = list
  selected.value = list.indexOf(field)
}

function addField(type: (typeof FIELD_TYPES)[number]) {
  insertField(type, fields.value.length)
}

// ---------------------------------------------------------------- 拖拽
//
// 用原生 HTML5 拖放，不引第三方库：需要的只有"从物料拖到画布"与
// "画布内调序"两件事，原生事件足够，少一个依赖就少一处升级风险。
//
// 拖拽状态只有一个对象，两种来源：
//   { kind: 'new',  type }  —— 从左侧物料面板拖入
//   { kind: 'move', index } —— 在画布内拖动已有字段
type DragPayload =
  | { kind: 'new'; type: (typeof FIELD_TYPES)[number] }
  | { kind: 'move'; index: number }

const dragPayload = ref<DragPayload | null>(null)
/** 手风琴展开的分组。默认全展开 —— 物料面板折叠起来对新手最不友好 */
const openGroups = ref<string[]>(FIELD_CATEGORIES.map((g) => g.code))

/** 落点位置，用于画插入指示线 —— 没有指示线的话用户不知道会插到哪 */
const dropIndex = ref<number>(-1)

function onDragStartNew(type: (typeof FIELD_TYPES)[number], e: Event) {
  const dt = (e as DragEvent).dataTransfer
  dragPayload.value = { kind: 'new', type }
  // Firefox 必须 setData 才会真正开始拖拽
  dt?.setData('text/plain', type.code)
  if (dt) dt.effectAllowed = 'copy'
}

function onDragStartMove(index: number, e: Event) {
  const dt = (e as DragEvent).dataTransfer
  dragPayload.value = { kind: 'move', index }
  dt?.setData('text/plain', String(index))
  if (dt) dt.effectAllowed = 'move'
  selected.value = index
}

/** 拖到某一行上方 → 插到它前面 */
function onDragOverRow(index: number, e: Event) {
  const dt = (e as DragEvent).dataTransfer
  if (!dragPayload.value) return
  e.preventDefault()
  if (dt) dt.dropEffect = dragPayload.value.kind === 'new' ? 'copy' : 'move'
  dropIndex.value = index
}

/** 拖到列表末尾的空白区 → 追加 */
function onDragOverTail(e: Event) {
  if (!dragPayload.value) return
  e.preventDefault()
  dropIndex.value = fields.value.length
}

function onDrop() {
  const payload = dragPayload.value
  const at = dropIndex.value
  dragPayload.value = null
  dropIndex.value = -1
  if (!payload || at < 0) return

  if (payload.kind === 'new') {
    insertField(payload.type, at)
    return
  }

  // 画布内调序：先摘出来，再按目标位插入。
  // ★ 目标位在被摘元素之后时要减一，否则会差一位 ——
  //   这类 bug 的表现是"往右拖一格却跑了两格"，很容易被误判成拖拽本身坏了。
  const list = [...fields.value]
  const [moved] = list.splice(payload.index, 1)
  list.splice(at > payload.index ? at - 1 : at, 0, moved)
  fields.value = list
  selected.value = list.indexOf(moved)
}

function onDragEnd() {
  dragPayload.value = null
  dropIndex.value = -1
}

function move(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= fields.value.length) return
  const list = [...fields.value]
  ;[list[index], list[target]] = [list[target], list[index]]
  fields.value = list
  selected.value = target
}

function remove(index: number) {
  fields.value = fields.value.filter((_, i) => i !== index)
  selected.value = -1
}

/** 逗号分隔文本 ↔ 字符串数组。空 → undefined（不写这个属性，语义是"不限节点"） */
function nodesToText(nodes?: string[]) {
  return nodes && nodes.length ? nodes.join(',') : ''
}
function textToNodes(text: string) {
  const list = text.split(',').map((s) => s.trim()).filter(Boolean)
  return list.length ? list : undefined
}

function setProp(key: keyof FieldDef, value: unknown) {
  if (!current.value) return
  const next = { ...current.value, [key]: value } as FieldDef
  fields.value = fields.value.map((f, i) => (i === selected.value ? next : f))
}

function setDictCode(code: string) {
  setProp('dataSource', { kind: 'dict', dictCode: code } as unknown as FieldDef['dataSource'])
}

/** 模板里不能写 as 断言，取值一律走方法 */
function labelOf(field: FieldDef): string {
  return resolveI18n(field.label, 'zh-CN')
}

function dictCodeOf(field: FieldDef): string {
  const ds = field.dataSource as { dictCode?: string } | undefined
  return ds?.dictCode ?? ''
}

function setLabel(text: string) {
  if (!current.value) return
  setProp('label', { 'zh-CN': text })
}

async function publish() {
  if (!formKey.value) {
    ElMessage.warning('请先填写表单标识（formKey）')
    return
  }
  if (fields.value.length === 0) {
    ElMessage.warning('至少需要一个字段')
    return
  }
  publishing.value = true
  try {
    const outcome = await publishFormApi(previewSchema.value)
    await ElMessageBox.alert(
      `已发布：${outcome.formKey} 第 ${outcome.version} 版，执行 ${outcome.statementCount} 条 DDL。\n` +
        `现在到「单据填报」里就能看到并填写它。`,
      '发布成功',
      { confirmButtonText: '去看' },
    )
    router.push('/document')
  } catch (e) {
    // 后端返回逐条问题（不是第一条），原样展示
    ElMessage.error('发布失败：' + ((e as Error).message ?? ''))
  } finally {
    publishing.value = false
  }
}
</script>

<template>
  <div class="xy-designer">
    <!-- 左：物料面板。从 FIELD_TYPES 派生，加字段类型不用改这里 -->
    <el-card class="xy-pane xy-palette" shadow="never">
      <template #header>物料</template>
      <el-collapse v-model="openGroups">
        <el-collapse-item
          v-for="group in materialsByCategory"
          :key="group.code"
          :title="group.label"
          :name="group.code"
        >
          <div class="xy-materials">
            <el-button
              v-for="mat in group.items"
              :key="mat.code"
              size="small"
              class="xy-material"
              draggable="true"
              @click="addField(mat)"
              @dragstart="onDragStartNew(mat, $event)"
              @dragend="onDragEnd"
            >
              {{ mat.label }}
            </el-button>
          </div>
        </el-collapse-item>
      </el-collapse>
    </el-card>

    <!-- 中：字段列表 -->
    <el-card class="xy-pane xy-canvas" shadow="never">
      <template #header>
        <div class="xy-bar">
          <span>字段</span>
          <el-radio-group v-model="preview" size="small">
            <el-radio-button :value="false">设计</el-radio-button>
            <el-radio-button :value="true">预览</el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <FormRenderer
        v-if="preview"
        :schema="previewSchema"
        :model-value="{}"
        :roles="auth.roleCodes"
      />

      <template v-else>
        <el-empty v-if="fields.length === 0" description="把左侧的物料拖到这里（也可以直接点击加入）" />

        <div
          v-for="(field, index) in fields"
          :key="field.key"
          class="xy-field-row"
          :class="{
            'is-active': index === selected,
            'is-drop-target': dropIndex === index && dragPayload,
          }"
          draggable="true"
          @click="selected = index"
          @dragstart="onDragStartMove(index, $event)"
          @dragend="onDragEnd"
          @dragover="onDragOverRow(index, $event)"
          @drop.prevent="onDrop"
        >
          <span class="xy-field-key">{{ field.key }}</span>
          <span class="xy-field-label">
            {{ labelOf(field) }}
          </span>
          <el-tag size="small" type="info">{{ field.type }}</el-tag>
          <span class="xy-spacer" />
          <el-button link size="small" :disabled="index === 0" @click.stop="move(index, -1)">↑</el-button>
          <el-button
            link
            size="small"
            :disabled="index === fields.length - 1"
            @click.stop="move(index, 1)"
          >↓</el-button>
          <el-button link type="danger" size="small" @click.stop="remove(index)">✕</el-button>
        </div>
        <div
          class="xy-canvas-drop"
          :class="{ 'is-drop-target': dropIndex === fields.length && dragPayload }"
          @dragover="onDragOverTail"
          @drop.prevent="onDrop"
        >
          <el-empty
            v-if="fields.length === 0"
            description="把左侧的物料拖到这里（也可以直接点击加入）"
          />
          <div v-else class="xy-canvas-tail">拖到此处追加到末尾</div>
        </div>
      </template>
    </el-card>

    <!-- 右：属性面板 -->
    <el-card class="xy-pane xy-props" shadow="never">
      <template #header>属性</template>

      <el-form label-width="88px" label-position="left" size="small">
        <el-divider content-position="left">表单</el-divider>
        <el-form-item label="标识">
          <el-input v-model="formKey" :disabled="keyLocked" placeholder="如 ncr" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="formName" placeholder="如 不符合项" />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="category" placeholder="可选，如 QUALITY" />
        </el-form-item>
        <div class="xy-hint">标识发布后不可修改（铁律 1）</div>

        <template v-if="current">
          <el-divider content-position="left">字段 · {{ current.key }}</el-divider>
          <el-form-item label="标题">
            <el-input
              :model-value="labelOf(current)"
              @update:model-value="setLabel"
            />
          </el-form-item>
          <el-form-item label="宽度">
            <el-select
              :model-value="current.span ?? 24"
              @update:model-value="(v: number) => setProp('span', v)"
            >
              <el-option label="整行" :value="24" />
              <el-option label="半行" :value="12" />
              <el-option label="三分之一" :value="8" />
            </el-select>
          </el-form-item>
          <el-form-item label="必填">
            <el-switch
              :model-value="Boolean(current.required)"
              @update:model-value="(v: boolean) => setProp('required', v)"
            />
          </el-form-item>
          <el-form-item label="可筛选">
            <el-switch
              :model-value="Boolean(current.indexable)"
              @update:model-value="(v: boolean) => setProp('indexable', v)"
            />
          </el-form-item>
          <el-form-item v-if="current.dataSource?.kind === 'dict'" label="字典">
            <el-input
              :model-value="dictCodeOf(current)"
              placeholder="如 quality_level"
              @update:model-value="setDictCode"
            />
          </el-form-item>

          <el-divider content-position="left">节点作用域</el-divider>
          <el-form-item label="可写节点">
            <el-input
              :model-value="nodesToText(current.writeNodes)"
              placeholder="如 start（留空=不限节点）"
              @update:model-value="(v: string) => setProp('writeNodes', textToNodes(v))"
            />
          </el-form-item>
          <el-form-item label="必填节点">
            <el-input
              :model-value="nodesToText(current.requiredNodes)"
              placeholder="如 rectify（留空=沿用必填开关）"
              @update:model-value="(v: string) => setProp('requiredNodes', textToNodes(v))"
            />
          </el-form-item>
          <el-form-item label="可见节点">
            <el-input
              :model-value="nodesToText(current.visibleNodes)"
              placeholder="留空=不限节点"
              @update:model-value="(v: string) => setProp('visibleNodes', textToNodes(v))"
            />
          </el-form-item>
          <div class="xy-hint">
            声明了「必填节点」后，必填开关会被它**覆盖**；留空则沿用必填开关。
          </div>
        </template>
        <el-empty v-else description="选中一个字段以编辑其属性" :image-size="60" />
      </el-form>

      <div class="xy-actions">
        <el-button type="primary" :loading="publishing" @click="publish">发布</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.xy-designer {
  display: flex;
  gap: 12px;
  padding: 12px;
  align-items: flex-start;
}
.xy-pane {
  max-height: calc(100vh - 120px);
  overflow: auto;
}
.xy-palette {
  width: 220px;
  flex: none;
}
.xy-canvas {
  flex: 1;
  min-width: 0;
}
.xy-props {
  width: 340px;
  flex: none;
}
.xy-materials {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.xy-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.xy-field-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  margin-bottom: 6px;
  cursor: pointer;
}
.xy-field-row.is-active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.xy-field-key {
  font-family: monospace;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.xy-field-label {
  font-size: 13px;
}
.xy-material { cursor: grab; }
.xy-material:active { cursor: grabbing; }
.xy-canvas-drop { min-height: 60px; border-radius: 4px; }
.xy-canvas-tail {
  text-align: center;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  padding: 8px;
  border: 1px dashed var(--el-border-color-lighter);
  border-radius: 4px;
}
.is-drop-target { box-shadow: inset 0 2px 0 0 var(--el-color-primary); }
.xy-spacer {
  flex: 1;
}
.xy-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  margin-bottom: 8px;
}
.xy-actions {
  margin-top: 12px;
  text-align: right;
}
</style>
