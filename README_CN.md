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
  <img alt="Desktop" src="https://img.shields.io/badge/Desktop-Tauri%20v2-4767d8?style=flat-square" />
  <img alt="Local First" src="https://img.shields.io/badge/Mode-Local--First-7c5cff?style=flat-square" />
  <img alt="Offline" src="https://img.shields.io/badge/Network-Offline%20Only-a94f67?style=flat-square" />
  <img alt="Storage" src="https://img.shields.io/badge/Storage-SQLite-4767d8?style=flat-square" />
</p>

<p align="center">
  一个本地优先的桌面应用，用脑图和轻量 To-Do 清单把自己的“为什么”一直放在眼前。
</p>

## 项目简介

Whybrary 只为一个人、一台机器、一个目标而做：让你的原因足够清晰，清晰到可以行动。

它不打算把长笔记、书签和任务堆在一起，而是刻意保持简单：

- 用本地脑图整理动机、原因和方向
- 用轻量清单把这些原因落成短小、可勾选的动作

## 当前能力

- 创建并切换多个独立空间
- 在本地新增节点，并优先在当前视口中心附近生成
- 拖拽节点并持久化节点位置
- 平移和缩放脑图视口
- 通过显式连线模式连接两个节点
- 打开信息面板查看节点位置和连线数量
- 在信息面板中跟踪某个节点，让视口居中到该节点
- 开启多选、全选，并在信息面板中批量删除
- 通过键盘删除当前选择
- 在脑图旁维护简短的单行 To-Do
- 切换白天与夜晚主题
- 全程离线，并用本地 SQLite 持久化数据

## 当前工程状态

Whybrary 已经可用，当前仍在持续打磨交互和工程结构。

- 前端：React + TypeScript
- 桌面容器：Tauri v2
- 持久化：带 schema version 的本地 SQLite 快照存储（`PRAGMA user_version`）
- 脑图渲染：本地 DOM + SVG + 应用内力导向模拟
- 当前每轮改动的基本验收脚本：
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `cargo test --manifest-path src-tauri/Cargo.toml --lib`

## 测试与 CI

当前自动化验证分成三层：

- 前端测试：`41` 个 Vitest 用例，覆盖 `App`、`BrainCanvas`、持久化、默认值和力导向逻辑
- Rust 持久化测试：`8` 个 SQLite 相关测试，覆盖空库加载、快照 round-trip、旧数据清理、active space 清理、schema version 初始化、迁移幂等、旧 schema 迁移和未来版本拒绝
- 真实 Tauri runtime 烟测：单独的 Linux CI job 会在 `xvfb` 下启动真实 Tauri 应用，写入真实 SQLite 文件，生成 smoke report 后退出

当前 GitHub Actions workflow：

- `ci.yml`
  - `web-checks`：lint、test、build
  - `tauri-checks`：`cargo check --tests` 与 `cargo test --lib`
  - `tauri-smoke-linux`：真实 Tauri runtime 烟测
- `release.yml`
  - 基于版本校验的桌面打包发布

## SQLite Schema

当前 SQLite schema 起始版本为：

- `user_version = 1`

迁移规则是显式的：

- 新数据库会初始化到 schema version `1`
- 旧的无版本数据库会经过 `0 -> 1` migration
- 如果数据库 schema 比当前构建更新，会直接拒绝打开，而不是静默兼容

## 发布流程

桌面发布通过推送版本 tag 触发：

```bash
git tag v0.2.0
git push origin v0.2.0
```

发布 workflow 会先校验以下三个文件的版本号与 tag 一致：

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

校验通过后，会创建 draft GitHub release，并构建这些桌面包：

- macOS：`app`、`dmg`
- Linux：`appimage`、`deb`
- Windows：`nsis`

## 隐私

- 没有账号
- 没有同步
- 没有上传
- 不依赖联网服务
- 数据只保留在你的设备上

## 本地运行源码

```bash
npm install
npm run tauri dev
```

## Smoke 模式

仓库内有一条给 CI 使用的真实 Tauri runtime smoke 路径。

相关环境变量：

- `WHYBRARY_TAURI_SMOKE=1`
- `WHYBRARY_APP_DATA_DIR=/path/to/temp/app-data`

在 smoke 模式下，应用会：

- 禁用正常窗口创建
- 把真实快照写入 SQLite
- 通过 Tauri runtime 再读回
- 生成 `smoke-report.json`
- 以成功或失败退出码结束

## 常用脚本

```bash
npm run lint
npm run test
npm run build
npm run tauri dev
```

## 开源协议

MIT，作者 `Zw-awa`。
