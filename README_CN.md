<h1 align="center">Whybrary</h1>

<p align="center">
  <img src="./assets/whybrary-mark.svg" width="92" alt="Whybrary 图标" />
</p>

<p align="center">
  <a href="./README.md"><strong>English</strong></a>
  ·
  <a href="./README_CN.md"><strong>简体中文</strong></a>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-c97838?style=flat-square" />
  <img alt="Status" src="https://img.shields.io/badge/Status-Work%20in%20Progress-b38b2a?style=flat-square" />
  <img alt="Desktop" src="https://img.shields.io/badge/Desktop-Tauri%20v2-1f8f88?style=flat-square" />
  <img alt="Rust" src="https://img.shields.io/badge/Rust-Backend-2c2018?style=flat-square" />
  <img alt="React" src="https://img.shields.io/badge/React-Frontend-4d9ecf?style=flat-square" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-UI%20Logic-356fa8?style=flat-square" />
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-Local%20Storage-4f7d95?style=flat-square" />
  <img alt="Mode" src="https://img.shields.io/badge/Mode-Local--First-5b8f5a?style=flat-square" />
</p>

<p align="center">
  一个纯本地桌面应用，用可视化神经元脑图和轻量 To-Do 清单来整理个人“为什么”。
</p>

## Whybrary 是什么

Whybrary 是一个围绕两条核心工作流设计的个人桌面应用：

- 把动机、原因、方向整理成可以连接的可视化脑图
- 把这些原因继续落到简短、可勾选的行动清单里

这个项目会刻意保持克制。它不是长笔记系统，不是协作产品，也不是云服务。

## 适合谁

Whybrary 适合这些人：

- 更习惯用简短原因而不是长篇日记来整理思路的人
- 希望自己手动构建脑图，而不是依赖自动生成知识图谱的人
- 希望个人数据完全掌握在本地的人

## 核心原则

- 纯本地优先：数据默认只留在你的机器上
- 轻量表达：只保留短理由和单行任务，不做重型笔记
- 可视连接：每个想法都能被命名、拖拽、连接
- 可演进：当前数据模型为后续更丰富甚至 3D 的脑图体验预留空间

## 当前功能

- 多个独立 Space
- 明暗双主题
- 本地 SQLite 持久化
- 神经元节点创建、命名、拖拽、连线
- 单行 To-Do 清单
- 完成状态的整条划线动画
- To-Do 面板右下角可拖拽悬浮操作区：
  - 回到顶部
  - 跳到首个未完成项
  - 跳到下一个未完成项

## 隐私说明

- 没有账号系统
- 不依赖联网服务
- 不包含数据上传逻辑
- 当前版本不做云同步

## 技术栈

- 桌面框架：`Tauri v2`
- 后端：`Rust`
- 前端：`React + TypeScript + Vite`
- 本地存储：`SQLite`
- 脑图画布：`React Flow`

## 开始使用

### 环境要求

- Rust stable toolchain
- Node.js 20+
- npm
- Visual Studio C++ Build Tools
- WebView2 Runtime

### 安装依赖

```bash
npm install
```

### 生成应用图标

```bash
npm run tauri:icon
```

### 启动开发环境

```bash
npm run tauri dev
```

## 数据保存方式

Whybrary 通过 Tauri 后端把应用数据保存到本地 SQLite。  
如果前端脱离 Tauri 单独预览，为了开发方便，会临时回退到浏览器本地存储。

## 项目结构

```text
whybrary/
├─ assets/              # README 资源与图标源文件
├─ src/                 # React 前端
├─ src-tauri/           # Tauri + Rust + SQLite
├─ private-docs/        # 私有工作记录，不进 git
├─ README.md
├─ README_CN.md
└─ LICENSE
```

## 路线图

1. 完成脑图与 To-Do 的可用首版
2. 稳定 SQLite 数据结构和迁移策略
3. 打磨拖拽反馈、动效和键盘操作
4. 为后续沉浸式 3D 脑图准备渲染层升级路径

## 开源协议

MIT，作者 `Zw-awa`。
