<script setup lang="ts">
/**
 * 不符合项填报页 —— 第 1 步竖切的可走通入口。
 *
 * ★ 这个页面里**没有任何"NCR"的业务逻辑**：它不知道"不符合项"是什么，
 *   只是"取一份已发布的 schema，画出来，提交回去"。
 *   换一张表单只需要改下面那个 formKey 常量（将来由路由参数或菜单带入）。
 *   这就是低代码平台与定制系统的区别 —— 加一张表单不需要写新页面。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import FormRenderer from '@/components/schema/FormRenderer.vue'
import { getFlowDefinitionApi, getPublishedFormApi, saveDocumentApi } from '@/api/meta'
import { useAuthStore } from '@/stores/auth'
import { useRoute } from 'vue-router'
import { resolveI18n, type FormSchema } from '@/schema'

const auth = useAuthStore()

const route = useRoute()
/** ★ 表单标识来自**路由参数**，不再是代码里的常量。
 *   加一张表单只需要在设计器里发布它 —— 列表里会出现，点进来就是这里。 */
const FORM_KEY = ref(String(route.params.formKey ?? ''))

/**
 * 当前流程节点。
 *
 * ★ 从流程定义里取 START 节点的 key，而不是写死 'start'。
 *   ncr 表单把归档节点叫 archived，别的流程完全可以把发起节点叫 submit ——
 *   写死 'start' 会让那些表单的节点作用域**静默失效**：权限不生效，
 *   但页面看起来一切正常，也不报错。
 */
const NODE_KEY = ref('start')

/** 发起来源的流程。从「提交申请」进来时带上 */
const flowKey = ref(String(route.query.flowKey ?? ''))
const flowLabel = ref('')

const schema = ref<FormSchema | null>(null)
const version = ref(0)
const values = ref<Record<string, unknown>>({})
const documentId = ref<number | null>(null)
const loading = ref(false)
const saving = ref(false)
const lastErrors = ref<string[]>([])

const roles = computed(() => auth.roleCodes ?? [])
const projectId = computed(() => {
  const raw = localStorage.getItem('xy_current_project')
  return raw ? Number(raw) : undefined
})

/** 先按流程把 formKey 与节点定下来，再加载表单 */
async function resolveFlow() {
  if (!flowKey.value) return
  try {
    const raw = await getFlowDefinitionApi(flowKey.value)
    if (!raw) {
      ElMessage.warning('该流程还没有已发布版本，按无流程方式填报')
      return
    }
    const def = JSON.parse(raw) as {
      formKey?: string
      name?: unknown
      nodes?: Array<{ key: string; type: string }>
    }
    // 以流程里绑定的表单为准：它才是"这条流程办的是哪种单子"的权威答案
    if (def.formKey) FORM_KEY.value = def.formKey
    const start = (def.nodes ?? []).find((n) => n.type === 'START')
    if (start?.key) NODE_KEY.value = start.key
    flowLabel.value =
      typeof def.name === 'string'
        ? def.name
        : String((def.name as Record<string, string> | undefined)?.['zh-CN'] ?? '')
  } catch {
    // 读不到流程不该把填报整个堵死 —— 退化成"无流程填报"，并在页头上体现出来
    ElMessage.warning('流程定义读取失败，已按无流程方式填报')
    flowKey.value = ''
  }
}

onMounted(async () => {
  await resolveFlow()
  if (!FORM_KEY.value) {
    ElMessage.error('缺少表单标识')
    return
  }
  loading.value = true
  try {
    const published = await getPublishedFormApi(FORM_KEY.value)
    schema.value = published.schema
    version.value = published.version
    // ★ 以 schema 里的字段为骨架先铺一遍空值。
    //   不铺的话，未填的字段在提交时会**整个缺失**，
    //   而后端的结构校验虽然允许缺失（视为 null），显式给出更贴近表单语义。
    const seed: Record<string, unknown> = {}
    for (const field of published.schema.fields ?? []) {
      if (field.type !== 'section' && field.type !== 'divider') seed[field.key] = null
      for (const child of field.children ?? []) seed[child.key] = null
    }
    for (const sub of published.schema.subForms ?? []) seed[sub.key] = []
    values.value = seed
  } catch (e) {
    ElMessage.error('无法加载表单定义：' + (e as Error).message)
  } finally {
    loading.value = false
  }
})

async function submit() {
  if (!schema.value) return
  saving.value = true
  lastErrors.value = []
  try {
    const data: Record<string, unknown> = {}
    const subForms: Record<string, Array<Record<string, unknown>>> = {}
    const subKeys = new Set((schema.value.subForms ?? []).map((s) => s.key))
    for (const [k, v] of Object.entries(values.value)) {
      if (subKeys.has(k)) subForms[k] = v as Array<Record<string, unknown>>
      else data[k] = v
    }

    const saved = await saveDocumentApi({
      formKey: FORM_KEY.value,
      projectId: projectId.value,
      documentId: documentId.value ?? undefined,
      nodeKey: NODE_KEY.value,
      data,
      subForms,
    })
    documentId.value = saved.id
    ElMessage.success(`已保存，单据号 ${saved.id}，表单版本 v${saved.formDefVersion}`)
  } catch (e) {
    // 后端返回的是逐条问题的多行文本（不是第一条）。
    // 原样展示 —— 一次性看到全部问题，比改一条试一次快得多。
    const message = (e as Error).message ?? ''
    lastErrors.value = message.split('\n').filter(Boolean)
    ElMessage.error('校验未通过，请查看下方问题列表')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-loading="loading" class="xy-page">
    <el-card shadow="never">
      <template #header>
        <div class="xy-header">
          <span>{{ schema?.name ? resolveI18n(schema.name, "zh-CN") : FORM_KEY }}</span>
          <el-tag v-if="version" type="info" size="small">表单版本 v{{ version }}</el-tag>
          <el-tag v-if="flowLabel" size="small" type="success">申请：{{ flowLabel }}</el-tag>
          <el-tag type="warning" size="small">当前节点：{{ NODE_KEY }}</el-tag>
        </div>
      </template>

      <FormRenderer
        v-if="schema"
        v-model="values"
        :schema="schema"
        :node-key="NODE_KEY"
        :roles="roles"
      />

      <el-alert
        v-if="lastErrors.length"
        class="xy-errors"
        type="error"
        :closable="false"
        title="校验未通过"
      >
        <ul>
          <li v-for="(err, i) in lastErrors" :key="i">{{ err }}</li>
        </ul>
      </el-alert>

      <div class="xy-actions">
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.xy-page {
  padding: 16px;
}
.xy-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.xy-errors {
  margin-top: 8px;
}
.xy-errors ul {
  margin: 0;
  padding-left: 18px;
}
.xy-actions {
  margin-top: 16px;
  text-align: right;
}
</style>
