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
import { getPublishedFormApi, saveDocumentApi } from '@/api/meta'
import { useAuthStore } from '@/stores/auth'
import type { FormSchema } from '@/schema'

const auth = useAuthStore()

/** 当前演示的表单。正式形态由菜单/路由参数传入 */
const FORM_KEY = 'ncr'
/** 演示用的流程节点。正式形态由待办带入（"我现在处理的是哪个环节"） */
const NODE_KEY = 'start'

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

onMounted(async () => {
  loading.value = true
  try {
    const published = await getPublishedFormApi(FORM_KEY)
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
      formKey: FORM_KEY,
      projectId: projectId.value,
      documentId: documentId.value ?? undefined,
      nodeKey: NODE_KEY,
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
          <span>不符合项填报</span>
          <el-tag v-if="version" type="info" size="small">表单版本 v{{ version }}</el-tag>
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
