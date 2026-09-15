<script setup lang="ts">
import { computed, markRaw, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  Aim,
  Cellphone,
  Connection,
  Finished,
  Grid,
  Iphone,
  Key,
  Lock,
  Message,
  User,
} from '@element-plus/icons-vue'
import BrandLogo from '@/components/BrandLogo.vue'
import GraphicCaptcha from '@/components/GraphicCaptcha.vue'
import { useAuthStore } from '@/stores/auth'
import { sendSmsCodeApi, type LoginType } from '@/api/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const REMEMBER_KEY = 'xy_remember_user'

const loginType = ref<LoginType>('password')
const loading = ref(false)
const smsCounting = ref(0)
const formRef = ref<FormInstance>()
const captchaRef = ref<InstanceType<typeof GraphicCaptcha> | null>(null)
const agreed = ref(true)

const form = reactive({
  username: '',
  password: '',
  mobile: '',
  smsCode: '',
  captcha: '',
  rememberMe: false,
})

const tabs: Array<{ label: string; value: LoginType }> = [
  { label: '账号登录', value: 'password' },
  { label: '手机验证码', value: 'sms' },
]

const tabIndex = computed(() => tabs.findIndex((t) => t.value === loginType.value))

const features = [
  {
    icon: markRaw(Grid),
    title: '低代码表单引擎',
    desc: '表单、流程、报表自助配置，随项目灵活调整',
  },
  {
    icon: markRaw(Cellphone),
    title: '移动端离线填报',
    desc: '旁站、见证取样、隐蔽验收，无信号现场也能用',
  },
  {
    icon: markRaw(Aim),
    title: '焊口全生命周期追溯',
    desc: '扫码即查焊接、无损检测与整改记录',
  },
  {
    icon: markRaw(Finished),
    title: '审批与签章全过程留痕',
    desc: '满足工程归档、审计与责任追溯要求',
  },
]

/** 图形验证码校验器（本地 Canvas 版；接入后端后改为服务端校验） */
const captchaValidator = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback(new Error('请输入图形验证码'))
    return
  }
  if (!captchaRef.value?.validate(value)) {
    callback(new Error('图形验证码不正确'))
    return
  }
  callback()
}

const rules = computed<FormRules>(() => {
  if (loginType.value === 'password') {
    return {
      username: [
        { required: true, message: '请输入用户名', trigger: 'blur' },
        { min: 3, max: 32, message: '用户名长度为 3 ~ 32 个字符', trigger: 'blur' },
      ],
      password: [
        { required: true, message: '请输入密码', trigger: 'blur' },
        { min: 6, max: 32, message: '密码长度为 6 ~ 32 个字符', trigger: 'blur' },
      ],
      captcha: [{ validator: captchaValidator, trigger: 'blur' }],
    }
  }
  return {
    mobile: [
      { required: true, message: '请输入手机号', trigger: 'blur' },
      { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' },
    ],
    smsCode: [
      { required: true, message: '请输入短信验证码', trigger: 'blur' },
      { pattern: /^\d{6}$/, message: '短信验证码为 6 位数字', trigger: 'blur' },
    ],
    captcha: [{ validator: captchaValidator, trigger: 'blur' }],
  }
})

function switchType(type: LoginType) {
  if (loginType.value === type) return
  loginType.value = type
  formRef.value?.clearValidate()
}

function resetCaptcha() {
  form.captcha = ''
  captchaRef.value?.refresh()
}

async function handleSendSms() {
  if (!/^1[3-9]\d{9}$/.test(form.mobile)) {
    ElMessage.warning('请先输入正确的手机号')
    return
  }
  try {
    await sendSmsCodeApi(form.mobile)
    ElMessage.success('验证码已发送，请注意查收')
    smsCounting.value = 60
    const timer = window.setInterval(() => {
      smsCounting.value -= 1
      if (smsCounting.value <= 0) window.clearInterval(timer)
    }, 1000)
  } catch {
    // 错误提示已由请求拦截器统一处理
  }
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  if (!agreed.value) {
    ElMessage.warning('请先阅读并同意《服务条款》与《隐私政策》')
    return
  }

  loading.value = true
  try {
    await auth.login({
      type: loginType.value,
      username: form.username,
      password: form.password,
      mobile: form.mobile,
      smsCode: form.smsCode,
      captcha: form.captcha,
      captchaKey: 'local-canvas',
      rememberMe: form.rememberMe,
    })

    if (form.rememberMe) {
      localStorage.setItem(REMEMBER_KEY, form.username)
    } else {
      localStorage.removeItem(REMEMBER_KEY)
    }

    ElMessage.success('登录成功')
    const redirect = (route.query.redirect as string) || '/'
    await router.replace(redirect)
  } catch (error) {
    // 登录失败必须换一张验证码，避免被暴力猜测
    resetCaptcha()
    const message = error instanceof Error ? error.message : ''
    if (message && !message.includes('Network')) {
      ElMessage.error(message)
    }
  } finally {
    loading.value = false
  }
}

function handleForgot() {
  ElMessage.info('请联系系统管理员或拨打技术服务热线重置密码')
}

function handleSso() {
  ElMessage.info('统一身份认证登录待对接业主 SSO 后开放')
}

onMounted(() => {
  const remembered = localStorage.getItem(REMEMBER_KEY)
  if (remembered) {
    form.username = remembered
    form.rememberMe = true
  }
})
</script>

<template>
  <div class="login-page">
    <!-- ============ 左：品牌区 ============ -->
    <aside class="brand-panel">
      <div class="brand-decor" aria-hidden="true">
        <!-- 管线示意图 -->
        <svg class="pipeline" viewBox="0 0 620 420" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M-20 330 H180 L240 270 H420 L470 220 H640"
            stroke="rgba(255,255,255,0.10)"
            stroke-width="16"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M-20 330 H180 L240 270 H420 L470 220 H640"
            stroke="rgba(255,255,255,0.16)"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle cx="180" cy="330" r="9" stroke="rgba(255,255,255,0.22)" stroke-width="2" />
          <circle cx="420" cy="270" r="9" stroke="rgba(255,255,255,0.22)" stroke-width="2" />
          <circle cx="470" cy="220" r="9" stroke="rgba(255,159,28,0.45)" stroke-width="2" />
          <path d="M240 270 V200 M600 330 V240" stroke="rgba(255,255,255,0.10)" stroke-width="12" stroke-linecap="round" />
        </svg>
      </div>

      <header class="brand-head">
        <BrandLogo :size="46" light />
        <div class="brand-titles">
          <h1>石油工程监理数字化平台</h1>
          <p>PETROLEUM ENGINEERING SUPERVISION PLATFORM</p>
        </div>
      </header>

      <div class="brand-body">
        <h2>全流程在线 · 全过程留痕 · 全要素协同</h2>
        <p class="brand-desc">
          面向长输管道、油气田地面工程、炼化装置的监理业务一体化平台，
          以低代码能力支撑多项目、多业主的差异化业务配置。
        </p>

        <ul class="feature-list">
          <li v-for="item in features" :key="item.title">
            <span class="feature-icon">
              <el-icon><component :is="item.icon" /></el-icon>
            </span>
            <div class="feature-text">
              <strong>{{ item.title }}</strong>
              <span>{{ item.desc }}</span>
            </div>
          </li>
        </ul>
      </div>

      <footer class="brand-foot">
        <span class="dot" />平台版本 v0.1.0 &nbsp;·&nbsp; 技术服务热线 400-000-0000
      </footer>
    </aside>

    <!-- ============ 右：登录表单 ============ -->
    <main class="form-panel">
      <div class="form-card">
        <header class="form-head">
          <h3>欢迎登录</h3>
          <p>请使用您的平台账号登录系统</p>
        </header>

        <!-- 登录方式切换 -->
        <div class="login-tabs" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            role="tab"
            class="tab-item"
            :class="{ active: loginType === tab.value }"
            :aria-selected="loginType === tab.value"
            @click="switchType(tab.value)"
          >
            {{ tab.label }}
          </button>
          <span class="tab-ink" :style="{ transform: `translateX(${tabIndex * 100}%)` }" />
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          size="large"
          label-position="top"
          @keyup.enter="handleSubmit"
        >
          <!-- 账号密码 -->
          <template v-if="loginType === 'password'">
            <el-form-item prop="username">
              <el-input
                v-model.trim="form.username"
                placeholder="请输入用户名"
                :prefix-icon="User"
                clearable
                autocomplete="username"
              />
            </el-form-item>
            <el-form-item prop="password">
              <el-input
                v-model="form.password"
                type="password"
                placeholder="请输入密码"
                :prefix-icon="Lock"
                show-password
                autocomplete="current-password"
              />
            </el-form-item>
          </template>

          <!-- 手机验证码 -->
          <template v-else>
            <el-form-item prop="mobile">
              <el-input
                v-model.trim="form.mobile"
                placeholder="请输入手机号"
                :prefix-icon="Iphone"
                maxlength="11"
                clearable
              />
            </el-form-item>
            <el-form-item prop="smsCode">
              <div class="inline-row">
                <el-input v-model.trim="form.smsCode" placeholder="请输入短信验证码" :prefix-icon="Message" maxlength="6" />
                <el-button class="inline-btn" :disabled="smsCounting > 0" @click="handleSendSms">
                  {{ smsCounting > 0 ? `${smsCounting}s 后重发` : '获取验证码' }}
                </el-button>
              </div>
            </el-form-item>
          </template>

          <!-- 图形验证码 -->
          <el-form-item prop="captcha">
            <div class="inline-row">
              <el-input
                v-model.trim="form.captcha"
                placeholder="请输入图形验证码"
                :prefix-icon="Key"
                maxlength="4"
              />
              <GraphicCaptcha ref="captchaRef" :width="112" :height="44" />
            </div>
          </el-form-item>

          <div class="form-extra">
            <el-checkbox v-model="form.rememberMe">记住我</el-checkbox>
            <a href="javascript:void(0)" @click="handleForgot">忘记密码？</a>
          </div>

          <el-button type="primary" class="submit-btn" :loading="loading" @click="handleSubmit">
            {{ loading ? '登录中' : '登 录' }}
          </el-button>

          <el-checkbox v-model="agreed" class="agree-box">
            我已阅读并同意
            <a href="javascript:void(0)">《服务条款》</a>
            与
            <a href="javascript:void(0)">《隐私政策》</a>
          </el-checkbox>
        </el-form>

        <div class="sso-divider">
          <span class="line" />
          <span class="text">其他登录方式</span>
          <span class="line" />
        </div>

        <button type="button" class="sso-btn" @click="handleSso">
          <el-icon><Connection /></el-icon>
          统一身份认证登录（业主 SSO）
        </button>
      </div>

      <footer class="form-foot">
        © 2025 兴油工程监理有限公司 · 建议使用 Chrome / Edge 内核浏览器访问
      </footer>
    </main>
  </div>
</template>

<style scoped lang="scss">
.login-page {
  display: flex;
  min-height: 100vh;
  background: #fff;
}

/* ================= 品牌区 ================= */
.brand-panel {
  position: relative;
  flex: 1 1 58%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 40px;
  padding: 56px 6% 40px;
  overflow: hidden;
  color: #fff;
  background:
    radial-gradient(circle at 14% 16%, rgba(255, 159, 28, 0.16), transparent 46%),
    radial-gradient(circle at 88% 88%, rgba(42, 111, 191, 0.42), transparent 52%),
    linear-gradient(140deg, #071c33 0%, #0f3358 48%, #1b5299 100%);

  /* 工程网格纹理 */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
    background-size: 46px 46px;
    mask-image: linear-gradient(160deg, #000 10%, transparent 78%);
    -webkit-mask-image: linear-gradient(160deg, #000 10%, transparent 78%);
    pointer-events: none;
  }
}

.brand-decor {
  position: absolute;
  inset: 0;
  pointer-events: none;

  .pipeline {
    position: absolute;
    right: -6%;
    bottom: -4%;
    width: 92%;
    max-width: 720px;
    opacity: 0.9;
  }
}

.brand-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;

  .brand-titles {
    min-width: 0;

    h1 {
      margin: 0;
      font-size: 21px;
      font-weight: 600;
      letter-spacing: 1.5px;
      line-height: 1.3;
    }

    p {
      margin: 6px 0 0;
      font-size: 9.5px;
      letter-spacing: 1.9px;
      color: rgba(255, 255, 255, 0.48);
      white-space: nowrap;
    }
  }
}

.brand-body {
  position: relative;
  max-width: 560px;

  h2 {
    margin: 0;
    font-size: clamp(26px, 2.5vw, 34px);
    font-weight: 600;
    line-height: 1.45;
    letter-spacing: 1px;
  }

  .brand-desc {
    margin: 18px 0 0;
    font-size: 14px;
    line-height: 1.9;
    color: rgba(255, 255, 255, 0.62);
  }
}

.feature-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin: 36px 0 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 14px;
    border-radius: var(--xy-radius);
    background: rgba(255, 255, 255, 0.055);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(2px);
    transition:
      background 0.25s,
      transform 0.25s;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
      transform: translateY(-2px);
    }
  }

  .feature-icon {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    color: var(--xy-amber-400);
    background: rgba(255, 159, 28, 0.14);
    font-size: 17px;
  }

  .feature-text {
    min-width: 0;

    strong {
      display: block;
      font-size: 13.5px;
      font-weight: 600;
      line-height: 1.5;
    }

    span {
      display: block;
      margin-top: 4px;
      font-size: 12px;
      line-height: 1.7;
      color: rgba(255, 255, 255, 0.5);
    }
  }
}

.brand-foot {
  position: relative;
  display: flex;
  align-items: center;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.42);

  .dot {
    width: 6px;
    height: 6px;
    margin-right: 9px;
    border-radius: 50%;
    background: var(--xy-success);
    box-shadow: 0 0 0 3px rgba(0, 180, 42, 0.18);
  }
}

/* ================= 表单区 ================= */
.form-panel {
  flex: 1 1 42%;
  min-width: 440px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 48px 5%;
  background: linear-gradient(180deg, #ffffff 0%, #fafbfd 100%);
}

.form-card {
  width: 100%;
  max-width: 400px;
}

.form-head {
  margin-bottom: 26px;

  h3 {
    margin: 0;
    font-size: 26px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: var(--xy-text-1);
  }

  p {
    margin: 10px 0 0;
    font-size: 14px;
    color: var(--xy-text-3);
  }
}

/* 登录方式切换 */
.login-tabs {
  position: relative;
  display: flex;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--xy-border);

  .tab-item {
    flex: 1;
    padding: 0 0 12px;
    border: 0;
    background: none;
    font-family: inherit;
    font-size: 15px;
    color: var(--xy-text-3);
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: var(--xy-navy-400);
    }

    &.active {
      color: var(--xy-navy-500);
      font-weight: 600;
    }
  }

  .tab-ink {
    position: absolute;
    bottom: -1px;
    left: 0;
    width: 50%;
    height: 2px;
    border-radius: 2px;
    background: linear-gradient(90deg, var(--xy-navy-500), var(--xy-navy-400));
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

/* 表单控件外观 */
:deep(.el-form-item) {
  margin-bottom: 20px;
}

:deep(.el-input__wrapper) {
  height: 46px;
  padding: 0 14px;
  border-radius: var(--xy-radius);
  background: #fff;
  box-shadow: 0 0 0 1px var(--xy-border) inset;
  transition:
    box-shadow 0.2s,
    background 0.2s;

  &:hover {
    box-shadow: 0 0 0 1px var(--xy-navy-300) inset;
  }

  &.is-focus {
    box-shadow:
      0 0 0 1px var(--xy-navy-500) inset,
      0 0 0 3px rgba(27, 82, 153, 0.1);
  }
}

:deep(.el-input__inner) {
  font-size: 14.5px;
}

:deep(.el-form-item__error) {
  padding-top: 5px;
  font-size: 12.5px;
}

/* 输入框 + 按钮 / 验证码 同行布局 */
.inline-row {
  display: flex;
  gap: 10px;
  width: 100%;
  align-items: center;

  .el-input {
    flex: 1;
    min-width: 0;
  }

  .inline-btn {
    flex-shrink: 0;
    width: 118px;
    height: 46px;
    border-radius: var(--xy-radius);
    font-size: 13.5px;
    color: var(--xy-navy-500);
    border-color: var(--xy-border);

    &:not(.is-disabled):hover {
      color: var(--xy-navy-400);
      border-color: var(--xy-navy-300);
      background: var(--xy-navy-100);
    }

    &.is-disabled {
      color: var(--xy-text-3);
      background: var(--xy-fill-2);
      border-color: var(--xy-border);
    }
  }
}

.form-extra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: -4px 0 18px;

  :deep(.el-checkbox__label) {
    font-size: 13.5px;
    color: var(--xy-text-2);
  }

  a {
    font-size: 13.5px;
  }
}

.submit-btn {
  width: 100%;
  height: 48px;
  border: 0;
  border-radius: var(--xy-radius);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 3px;
  color: #fff;
  background: linear-gradient(135deg, var(--xy-navy-500) 0%, var(--xy-navy-400) 100%);
  box-shadow: var(--xy-shadow-btn);
  transition:
    transform 0.2s,
    box-shadow 0.2s,
    filter 0.2s;

  &:hover:not(.is-loading) {
    filter: brightness(1.08);
    transform: translateY(-1px);
    box-shadow: 0 10px 24px rgba(27, 82, 153, 0.34);
  }

  &:active:not(.is-loading) {
    transform: translateY(0);
  }
}

.agree-box {
  margin-top: 16px;

  :deep(.el-checkbox__label) {
    font-size: 12.5px;
    color: var(--xy-text-3);
  }

  a {
    font-size: 12.5px;
  }
}

/* 其他登录方式 */
.sso-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0 16px;

  .line {
    flex: 1;
    height: 1px;
    background: var(--xy-border);
  }

  .text {
    font-size: 12.5px;
    color: var(--xy-text-3);
    white-space: nowrap;
  }
}

.sso-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 46px;
  border-radius: var(--xy-radius);
  border: 1px solid var(--xy-border);
  background: #fff;
  font-family: inherit;
  font-size: 14px;
  color: var(--xy-text-2);
  cursor: pointer;
  transition:
    border-color 0.2s,
    color 0.2s,
    background 0.2s;

  &:hover {
    color: var(--xy-navy-500);
    border-color: var(--xy-navy-300);
    background: var(--xy-navy-100);
  }
}

.form-foot {
  font-size: 12px;
  color: var(--xy-text-3);
  text-align: center;
  line-height: 1.8;
}

/* ================= 响应式 ================= */
@media (max-width: 1180px) {
  .feature-list {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 960px) {
  .brand-panel {
    display: none;
  }

  .form-panel {
    flex: 1 1 100%;
    min-width: 0;
    padding: 32px 24px;
  }
}

@media (max-width: 420px) {
  .form-head h3 {
    font-size: 23px;
  }

  .inline-row .inline-btn {
    width: 104px;
    font-size: 12.5px;
  }
}
</style>
