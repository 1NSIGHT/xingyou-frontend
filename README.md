# 石油工程监理数字化平台 · 前端

Vue 3 + TypeScript + Vite + Element Plus。当前已完成**登录模块**（含认证链路、路由守卫、Mock 接口）。

架构设计文档位于同级目录 `../xingyou-backend/`：

- `石油监理低代码平台-架构设计方案.md` —— 总体架构（业务分析、低代码引擎、流程、移动端、部署）
- `石油监理低代码平台-后端架构设计.md` —— 后端工程级设计（模块边界、认证、拦截器、JSONB 实操）

## 快速开始

```bash
# 国内环境建议先切镜像源
npm config set registry https://registry.npmmirror.com

npm install
npm run dev
```

启动后访问 <http://127.0.0.1:5180>

> Windows 下若提示 `npm.ps1 无法加载文件，因为在此系统上禁止运行脚本`，
> 是 PowerShell 执行策略拦截，改用 `npm.cmd install` / `npm.cmd run dev` 即可。

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器（端口固定 5180） |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run preview` | 预览生产构建产物 |
| `npm run typecheck` | 仅执行 `vue-tsc` 类型检查 |

## 演示账号

当前 `VITE_USE_MOCK=true`，走前端 Mock，**任意用户名 + 6 位以上密码**均可登录。
图形验证码按画布显示内容填写（不区分大小写）。

预置的异常分支方便联调：

| 输入 | 结果 |
| --- | --- |
| 用户名 `locked` | 提示「账号已被锁定，请联系系统管理员」 |
| 手机验证码非 `123456` | 提示「短信验证码不正确」 |

登录成功后跳转 `/`，展示当前用户所属单位、项目与岗位角色。

## 目录结构

```
src/
├── api/
│   ├── request.ts        axios 封装：令牌注入、业务码解包、错误提示
│   └── auth.ts           认证接口（login / me / logout / captcha / sms-code），含 Mock 分支
├── components/
│   ├── BrandLogo.vue     品牌标识（井架 + 管线，纯 SVG）
│   └── GraphicCaptcha.vue 图形验证码（Canvas 绘制，暴露 refresh / validate）
├── router/index.ts       路由与登录守卫（未登录跳 /login 并记录 redirect）
├── stores/auth.ts        Pinia 认证状态：token、用户信息、login / logout
├── styles/index.scss     设计令牌（深海蓝 + 能源橙）与 Element Plus 主题覆盖
├── views/
│   ├── login/index.vue   登录页
│   └── home/index.vue    工作台占位页
├── App.vue
├── main.ts
└── env.d.ts
```

## 登录页说明

**布局**：左侧品牌区（深海蓝渐变 + 工程网格 + 管线示意 SVG + 四条能力卖点），右侧表单区，窄屏（<960px）自动收起品牌区。

**已实现**：

- 双登录方式切换：账号登录 / 手机验证码（带 60 秒倒计时与手机号格式校验）
- 图形验证码：Canvas 本地生成，排除 `0 O 1 I l` 易混淆字符，点击刷新，**登录失败自动换一张**
- 表单校验：必填、长度、手机号与短信码正则、验证码一致性（自定义 validator）
- 记住我：用户名持久化到 `localStorage`
- 密码显隐切换、回车提交、按钮 loading 态
- 服务条款勾选、忘记密码、统一身份认证（业主 SSO）入口占位
- 路由守卫：未登录访问受保护路由自动跳登录并带 `redirect`
- 响应式：1180px 下卖点改单列，960px 下隐藏品牌区，420px 下适配小屏

## 接入后端

后端就绪后将 `.env.development` 的 `VITE_USE_MOCK` 改为 `false`，接口即切到真实地址（`VITE_API_BASE`，默认 `/api`，
开发环境经 Vite 代理到 `http://127.0.0.1:8080`）。

**约定的响应体**（与 `xy-common` 一致）：

```json
{ "code": 0, "message": "ok", "data": { } }
```

`code = 0` 为成功，`code = 401` 表示令牌失效（拦截器清理令牌，路由守卫负责跳转）。

**需要后端提供的接口**：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/login` | 入参见 `LoginParams`，返回 `{ accessToken, refreshToken, expiresIn }` |
| GET | `/api/auth/me` | 返回当前用户、所属单位、当前项目、角色 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/captcha` | 返回 `{ captchaKey, captchaImage }` |
| POST | `/api/auth/sms-code` | 发送短信验证码 |

接入服务端验证码时，把 `GraphicCaptcha.vue` 的本地绘制换成后端图片，`captchaKey` 由 `getCaptchaApi()` 下发
（登录页中目前硬编码为 `'local-canvas'`，需一并替换）。

## 尚未实现（后续迭代）

- 令牌无感刷新（`refreshToken` 已在类型中预留，拦截器未接）
- 按钮级 / 字段级权限指令
- 主框架布局（侧边菜单、标签页、面包屑）
- 低代码表单渲染器（amis）与设计器
- 待办中心、项目台账、报表模块
