<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import BrandLogo from '@/components/BrandLogo.vue'

const router = useRouter()
const auth = useAuthStore()

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '退出确认', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  await auth.logout()
  ElMessage.success('已安全退出')
  await router.replace('/login')
}
</script>

<template>
  <div class="home-page">
    <header class="home-header">
      <div class="header-left">
        <BrandLogo :size="34" />
        <div class="titles">
          <strong>石油工程监理数字化平台</strong>
          <span>工作台</span>
        </div>
      </div>
      <div class="header-right">
        <span class="user-name">{{ auth.displayName }}</span>
        <el-button link @click="handleLogout">退出登录</el-button>
      </div>
    </header>

    <main class="home-main">
      <el-card shadow="never" class="info-card">
        <template #header>
          <span class="card-title">当前登录信息</span>
        </template>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="姓名">{{ auth.userInfo?.realName }}</el-descriptions-item>
          <el-descriptions-item label="账号">{{ auth.userInfo?.username }}</el-descriptions-item>
          <el-descriptions-item label="所属单位">{{ auth.userInfo?.tenantName }}</el-descriptions-item>
          <el-descriptions-item label="当前项目">{{ auth.userInfo?.projectName }}</el-descriptions-item>
          <el-descriptions-item label="岗位角色">
            <el-tag v-for="role in auth.userInfo?.roles" :key="role" size="small" effect="light">
              {{ role }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-alert
        class="tip"
        title="登录链路已跑通"
        type="success"
        :closable="false"
        show-icon
        description="这是登录成功后跳转的占位工作台。后续将在此接入低代码表单引擎、待办中心与项目台账。"
      />
    </main>
  </div>
</template>

<style scoped lang="scss">
.home-page {
  min-height: 100vh;
  background: var(--xy-fill-1);
}

.home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid var(--xy-border);

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .titles {
    display: flex;
    align-items: baseline;
    gap: 10px;

    strong {
      font-size: 16px;
      font-weight: 600;
      color: var(--xy-text-1);
    }

    span {
      font-size: 13px;
      color: var(--xy-text-3);
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 14px;

    .user-name {
      font-size: 14px;
      color: var(--xy-text-2);
    }
  }
}

.home-main {
  max-width: 760px;
  margin: 0 auto;
  padding: 28px 24px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
}

.tip {
  margin-top: 20px;
}

:deep(.el-tag + .el-tag) {
  margin-left: 6px;
}
</style>
