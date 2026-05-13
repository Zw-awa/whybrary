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
- 持久化：本地 SQLite 快照存储
- 脑图渲染：本地 DOM + SVG + 应用内力导向模拟
- 当前每轮改动的基本验收脚本：
  - `npm run lint`
  - `npm run test`
  - `npm run build`

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

## 常用脚本

```bash
npm run lint
npm run test
npm run build
npm run tauri dev
```

## 开源协议

MIT，作者 `Zw-awa`。
