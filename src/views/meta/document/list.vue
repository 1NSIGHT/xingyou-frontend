<script setup lang="ts">
/**
 * 单据填报入口 —— 已发布表单清单。
 *
 * ★ 这一页是"低代码平台"与"定制页面"的分界线。
 *
 * 之前的做法是路由里写死 `/document/ncr`、页面里写死 `FORM_KEY = 'ncr'`，
 * 于是"加一张表单"= 改代码 + 发版。而低代码要消灭的恰恰是这件事。
 *
 * 现在：清单从后端 `meta_form` 查，点进去就是动态路由 `/document/:formKey`。
 * **在设计器里新建并发布一张表单，它会自动出现在这里，全程不碰代码。**
 */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { listFormsApi, type FormSummary } from '@/api/meta'

const router = useRouter()
const forms = ref<FormSummary[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    forms.value = await listFormsApi()
  } catch (e) {
    ElMessage.error('加载表单清单失败：' + (e as Error).message)
  } finally {
    loading.value = false
  }
})

function open(formKey: string) {
  router.push(`/document/${formKey}`)
}
</script>

<template>
  <div v-loading="loading" class="xy-page">
    <el-card shadow="never">
      <template #header>
        <div class="xy-header">
          <span>单据填报</span>
          <el-tag type="info" size="small">共 {{ forms.length }} 张已发布表单</el-tag>
        </div>
      </template>

      <el-empty v-if="!loading && forms.length === 0" description="还没有已发布的表单">
        <div class="xy-empty-tip">
          表单需要先在设计器里定义并发布。<br />
          （设计器尚未实现，目前只能通过发布接口创建 —— 这是第 1 步之后的下一块。）
        </div>
      </el-empty>

      <el-row v-else :gutter="16">
        <el-col v-for="form in forms" :key="form.formKey" :span="8">
          <el-card class="xy-form-card" shadow="hover" @click="open(form.formKey)">
            <div class="xy-form-name">{{ form.name ?? form.formKey }}</div>
            <div class="xy-form-meta">
              <el-tag size="small" type="info">{{ form.formKey }}</el-tag>
              <el-tag size="small">v{{ form.version }}</el-tag>
              <el-tag v-if="form.category" size="small" type="warning">{{ form.category }}</el-tag>
            </div>
          </el-card>
        </el-col>
      </el-row>
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
.xy-form-card {
  cursor: pointer;
  margin-bottom: 16px;
}
.xy-form-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}
.xy-form-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.xy-empty-tip {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.8;
}
</style>
