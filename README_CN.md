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
  <img alt="Android" src="https://img.shields.io/badge/Android-APK%20侧载-5a8f61?style=flat-square" />
  <img alt="Mode" src="https://img.shields.io/badge/Mode-Local--First-7c5cff?style=flat-square" />
  <img alt="Storage" src="https://img.shields.io/badge/Storage-SQLite-4767d8?style=flat-square" />
</p>

<p align="center">
  一个本地优先的应用，用脑图和轻量 To-Do 清单把自己的“为什么”一直放在眼前。
</p>

## 安装方式

Whybrary 当前走的是“直接下载并安装”的发布方式，不走任何应用商店。

- Windows：从 GitHub Releases 下载 `-setup.exe`，双击安装
  - 如果系统缺少 WebView2，安装器会在安装过程中拉取微软官方 bootstrapper
- macOS：下载 `.dmg`，打开后把 Whybrary 拖进 `Applications`
- Linux：
  - Debian / Ubuntu：下载 `.deb` 安装包
  - Fedora / RHEL / openSUSE：下载 `.rpm` 安装包
  - 便携备选：使用 `.AppImage`
- Android：构建或分发签名后的 `.apk`，通过侧载安装

发布资产下载地址：

- GitHub Releases：`https://github.com/Zw-awa/whybrary/releases`

如果当前平台的构建还没有签名，系统第一次打开时可能会额外询问信任确认。这和是否上架应用商店是两件事。

## 在线预览

- GitHub Pages 在线预览：`https://zw-awa.github.io/whybrary/`
- 浏览器预览版主要用于快速试用和 JSON 导入导出

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
- 在脑图旁维护简短的单行 To-Do
- 切换白天与夜晚主题
- 使用移动端布局，包括底部导航、触控友好的脑图操作，以及应用内确认弹层
- 全程离线，并用本地 SQLite 持久化数据
- 在浏览器预览版中导入和导出可携带的 JSON 快照

## 当前工程状态

Whybrary 已经可用，当前仍在持续打磨交互和工程结构。

- 前端：React + TypeScript
- 应用容器：Tauri v2
- 持久化：带 schema version 的本地 SQLite 快照存储（`PRAGMA user_version`）
- 脑图渲染：本地 DOM + SVG + 应用内力导向模拟
- 当前每轮改动的基本验收脚本：
  - `npm run test`
  - `npm run build`
  - `cargo test --manifest-path src-tauri/Cargo.toml --lib`

## 测试与 CI

当前自动化验证分成三层：

- 前端测试：`89` 个 Vitest 用例，覆盖 `App`、`BrainCanvas`、持久化、默认值、快照传输、工作区 reducer/diff 和力导向逻辑
- Rust 持久化测试：`11` 个 SQLite 相关测试，覆盖空库加载、快照 round-trip、旧数据清理、active space 清理、schema version 初始化、v1 -> v2 迁移、增量 mutation、revision 冲突和未来版本拒绝
- 真实 Tauri runtime 烟测：单独的 Linux CI job 会在 `xvfb` 下启动真实 Tauri 应用，写入真实 SQLite 文件，生成 smoke report 后退出

当前 GitHub Actions workflow：

- `ci.yml`
  - web checks
  - Rust checks
  - Linux Tauri runtime smoke
- `pages.yml`
  - 构建并部署 GitHub Pages 浏览器预览版
- `release.yml`
  - 校验 tag 版本
  - 创建 draft GitHub release
  - 上传直接下载式桌面发布包：
    - Windows：`nsis`
    - macOS：`dmg`
    - Linux：`deb`、`rpm`、`appimage`
  - 桌面端当前默认以 unsigned 方式构建（`--no-sign`）

## 发布教程

如果你是维护者，想发布一个新版本：

1. 先同步更新这三个文件里的版本号：
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`
2. 本地执行：

```bash
npm install
npm run test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

3. 提交并推送：

```bash
git add .
git commit -m "Prepare vX.Y.Z release"
git push
```

4. 创建并推送 tag：

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

5. 等待 `release.yml` workflow 执行完成。
6. 打开 draft GitHub release，检查上传的资产，然后手动点发布。

### 桌面端本地打包快捷命令

```bash
npm run desktop:win
npm run desktop:mac
npm run desktop:linux
```

平台说明：

- `desktop:win` 需要在 Windows 上执行
- `desktop:mac` 需要在 macOS 上执行
- `desktop:linux` 需要在 Linux 上执行
- 跨平台桌面发布默认由 GitHub Actions 的 release workflow 完成

### Android 本地打包快捷命令

```bash
npm run android:prepare
npm run android:build:apk
npm run android:sign:apk
npm run android:build:signed
npm run android:dev
```

推荐的 Android 流程：

1. `npm run android:prepare`
   - 初始化 `src-tauri/gen/android`
   - 读取你已经设置好的 `JAVA_HOME` / `ANDROID_HOME` / `ANDROID_SDK_ROOT` / `NDK_HOME`
   - 自动把生成工程里的 Gradle wrapper 和 Maven 仓库改成“镜像优先”
2. `npm run android:build:apk`
   - 再次应用同一套固定 Android 环境
   - 保留本地 vendor 的 `tauri-android` 模块，不再让 Tauri CLI 在构建前把它覆盖回去
   - 再次确保镜像配置存在
   - 直接调用生成好的 Android Gradle 工程
   - 当前默认构建 `arm64` release APK，与本地现成的 Rust Android 产物保持一致
   - 将默认的 `app-*.apk` 复制成 Whybrary 的稳定命名文件
3. `npm run android:sign:apk`
   - 从环境变量读取签名输入
   - 执行 `zipalign` 和 `apksigner`
   - 产出 `whybrary-<version>-arm64-release.apk`

本地说明：

- 本地执行 `android:sign:apk` 前，需要先在当前终端设置这 4 个签名环境变量
- GitHub Actions 的 Android 发布 job 会从仓库 secrets 注入同名变量

签名所需环境变量：

- `ANDROID_KEYSTORE_PATH`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

镜像策略：

- Gradle 分发包：腾讯云镜像
- Maven 仓库：
  - 本地默认：阿里云镜像优先，保留官方 `google()` / `mavenCentral()` 作为回退
  - GitHub Actions 默认：官方 `google()` / `mavenCentral()` 优先，保留阿里云镜像作为回退
- Android SDK 自动下载：关闭，避免本地构建时长时间卡在远程 package manifests 查询

要求的环境变量：

- `JAVA_HOME`
- `ANDROID_HOME`
- `ANDROID_SDK_ROOT`
- `NDK_HOME`

脚本会在项目内使用这些缓存目录：

- `.gradle-android-user-home`
- `.kotlin-daemon`
- `.tmp`

Android 当前默认仍是本地打包与侧载分发，需要你先准备 Android Studio、SDK/NDK 和 Rust Android targets。

## 隐私

- 没有账号
- 没有同步
- 没有上传
- 不依赖联网服务
- 数据只保留在你的设备上
- 在 GitHub Pages 预览版中，数据默认只保留在当前浏览器，除非你主动导出 JSON

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

## 浏览器预览版数据流

Web 预览版当前是“快速试用 + JSON 可迁移”的设计：

- 当前数据保存在浏览器 localStorage
- 可以导出带 metadata 的 JSON 快照
- 可以导入当前导出格式，也兼容旧的原始 snapshot JSON
- 提供浏览器本地数据重置入口

## 发布说明

- 变更记录：[CHANGELOG.md](./CHANGELOG.md)
- 发布流程：[RELEASING.md](./RELEASING.md)

## 开源协议

MIT，作者 `Zw-awa`。
