import type { AppLocale } from '../types';

type AppCopy = {
  appName: string;
  nav: {
    map: string;
    todo: string;
    spaces: string;
  };
  status: {
    booting: string;
    saving: string;
    saved: string;
    error: string;
  };
  sidebar: {
    drawerTitle: string;
    closeSpaces: string;
    newSpace: string;
    exportJson: string;
    importJson: string;
    resetBrowserData: string;
    settings: string;
    useLightTheme: string;
    useDarkTheme: string;
    spaces: string;
    current: string;
    delete: string;
    name: string;
    untitledSpace: string;
    pointsOpen: (points: number, open: number) => string;
  };
  workspace: {
    points: (count: number) => string;
    openTasks: (count: number) => string;
    webPreviewSubhead: string;
    spacesButton: string;
  };
  loading: {
    title: string;
    body: string;
  };
  banners: {
    exported: string;
    imported: string;
    reset: string;
  };
  notices: {
    importFailedTitle: string;
    importFailedMessage: string;
  };
  dialogs: {
    close: string;
    cancel: string;
    resetBrowserTitle: string;
    resetBrowserMessage: string;
    resetBrowserConfirm: string;
    deleteSpaceTitle: string;
    deleteSpaceMessage: (name: string) => string;
    deleteSpaceConfirm: string;
    deleteNodesTitle: string;
    deleteNodesMessage: (count: number, preview: string, suffix: string) => string;
    deleteNodesConfirmSingle: string;
    deleteNodesConfirmMultiple: string;
  };
  todo: {
    title: string;
    addPlaceholder: string;
    add: string;
    markOpen: string;
    markCompleted: string;
    emptyTask: string;
    deleteTodo: string;
    remove: string;
    dockTop: string;
    dockFirstOpen: string;
    dockNextOpen: string;
    dockTopTitle: string;
    dockFirstOpenTitle: string;
    dockNextOpenTitle: string;
    expandPanel: string;
    restorePanel: string;
  };
  map: {
    title: string;
    showInfo: string;
    hideInfo: string;
    done: string;
    editContent: string;
    edit: string;
    linkModeOn: string;
    linkModeOff: string;
    linkOn: string;
    link: string;
    newPoint: string;
    editingEnabled: string;
    viewingMode: string;
    rename: string;
    delete: string;
    clear: string;
    untitled: string;
    expandPanel: string;
    restorePanel: string;
  };
  info: {
    nodes: (count: number) => string;
    links: (count: number) => string;
    close: string;
    multiOn: string;
    multiOff: string;
    selectAll: string;
    clear: string;
    deleteSelected: string;
    untitledNode: (index: number) => string;
  };
  welcome: {
    regionLabel: string;
    eyebrow: string;
    title: string;
    body: string;
    startEditing: string;
    close: string;
    importJson: string;
    exportJson: string;
    stepMapTitle: string;
    stepMapBody: string;
    stepTodoTitle: string;
    stepTodoBody: string;
    stepSpacesTitle: string;
    stepSpacesBody: string;
  };
  settings: {
    title: string;
    button: string;
    tutorialTitle: string;
    tutorialBody: string;
    tutorialButton: string;
    languageTitle: string;
    languageBody: string;
    languageEnglish: string;
    languageChinese: string;
    aboutTitle: string;
    aboutLead: string;
    authorLabel: string;
    authorValue: string;
    githubLabel: string;
    githubValue: string;
    pricingLabel: string;
    pricingValue: string;
    licenseLabel: string;
    licenseValue: string;
    privacyLabel: string;
    privacyValue: string;
    close: string;
  };
};

const copy: Record<AppLocale, AppCopy> = {
  en: {
    appName: 'Whybrary',
    nav: {
      map: 'Map',
      todo: 'To-Do',
      spaces: 'Spaces',
    },
    status: {
      booting: 'Booting',
      saving: 'Saving locally',
      saved: 'Saved locally',
      error: 'Save fallback active',
    },
    sidebar: {
      drawerTitle: 'Spaces',
      closeSpaces: 'Close spaces',
      newSpace: 'New Space',
      exportJson: 'Export JSON',
      importJson: 'Import JSON',
      resetBrowserData: 'Reset Browser Data',
      settings: 'Settings',
      useLightTheme: 'Use Light Theme',
      useDarkTheme: 'Use Dark Theme',
      spaces: 'Spaces',
      current: 'Current',
      delete: 'Delete',
      name: 'Name',
      untitledSpace: 'Untitled Space',
      pointsOpen: (points, open) => `${points} points · ${open} open`,
    },
    workspace: {
      points: (count) => `${count} points`,
      openTasks: (count) => `${count} open tasks`,
      webPreviewSubhead: 'Web preview mode. Your data stays in this browser unless you export JSON.',
      spacesButton: 'Spaces',
    },
    loading: {
      title: 'Preparing your local space...',
      body: 'Booting the graph, loading the list, and opening the SQLite snapshot.',
    },
    banners: {
      exported: 'Snapshot exported as JSON.',
      imported: 'Snapshot imported successfully.',
      reset: 'Browser-local snapshot reset.',
    },
    notices: {
      importFailedTitle: 'Import failed',
      importFailedMessage: 'Please choose a valid Whybrary JSON snapshot.',
    },
    dialogs: {
      close: 'Close',
      cancel: 'Cancel',
      resetBrowserTitle: 'Reset browser data',
      resetBrowserMessage: 'Clear the browser-local Whybrary snapshot and replace it with a fresh default space?',
      resetBrowserConfirm: 'Reset Data',
      deleteSpaceTitle: 'Delete current space',
      deleteSpaceMessage: (name) => `Delete "${name}"?`,
      deleteSpaceConfirm: 'Delete Space',
      deleteNodesTitle: 'Delete selected nodes',
      deleteNodesMessage: (count, preview, suffix) =>
        `Delete ${count} selected node${count > 1 ? 's' : ''}? ${preview}${suffix}`,
      deleteNodesConfirmSingle: 'Delete Node',
      deleteNodesConfirmMultiple: 'Delete Nodes',
    },
    todo: {
      title: 'To-Do',
      addPlaceholder: 'Add one short task...',
      add: 'Add',
      markOpen: 'Mark as open',
      markCompleted: 'Mark as completed',
      emptyTask: 'Empty task',
      deleteTodo: 'Delete todo',
      remove: 'Remove',
      dockTop: 'Top',
      dockFirstOpen: 'First Open',
      dockNextOpen: 'Next Open',
      dockTopTitle: 'Back to top',
      dockFirstOpenTitle: 'Jump to the first open todo',
      dockNextOpenTitle: 'Jump to the next open todo',
      expandPanel: 'Expand To-Do',
      restorePanel: 'Restore layout',
    },
    map: {
      title: 'Mind Map',
      showInfo: 'Show Info',
      hideInfo: 'Hide Info',
      done: 'Done',
      editContent: 'Edit Content',
      edit: 'Edit',
      linkModeOn: 'Link Mode Enabled',
      linkModeOff: 'Enable Link Mode',
      linkOn: 'Link Mode Enabled',
      link: 'Link',
      newPoint: 'New Point',
      editingEnabled: 'Editing enabled',
      viewingMode: 'Viewing mode',
      rename: 'Rename',
      delete: 'Delete',
      clear: 'Clear',
      untitled: 'Untitled',
      expandPanel: 'Expand map',
      restorePanel: 'Restore layout',
    },
    info: {
      nodes: (count) => `${count} nodes`,
      links: (count) => `${count} links`,
      close: 'Close',
      multiOn: 'Multi On',
      multiOff: 'Multi Off',
      selectAll: 'Select All',
      clear: 'Clear',
      deleteSelected: 'Delete Selected',
      untitledNode: (index) => `Untitled ${index}`,
    },
    welcome: {
      regionLabel: 'Whybrary quick tutorial',
      eyebrow: 'Quick tutorial',
      title: 'See the whole app in under a minute.',
      body: 'Whybrary keeps one small mind map and one small to-do list side by side so your reasons and next actions stay visible together.',
      startEditing: 'Start Editing',
      close: 'Close',
      importJson: 'Import Existing JSON',
      exportJson: 'Export Current JSON',
      stepMapTitle: 'Map',
      stepMapBody: 'Add short nodes, drag them, and connect related reasons so the structure stays easy to scan.',
      stepTodoTitle: 'To-Do',
      stepTodoBody: 'Keep only short next actions. Open tasks stay beside the map so ideas turn into visible steps.',
      stepSpacesTitle: 'Spaces',
      stepSpacesBody: 'Use spaces to separate different topics. You can switch them from the sidebar or the mobile spaces sheet.',
    },
    settings: {
      title: 'Settings',
      button: 'Settings',
      tutorialTitle: 'Tutorial',
      tutorialBody: 'Open the quick tutorial again if you want a fast reminder of the main workflow.',
      tutorialButton: 'Open Tutorial',
      languageTitle: 'Language',
      languageBody: 'Choose the display language used across the app interface.',
      languageEnglish: 'English',
      languageChinese: '简体中文',
      aboutTitle: 'About',
      aboutLead: 'Whybrary is a local-first open source app for keeping your reasons and next actions visible.',
      authorLabel: 'Author',
      authorValue: 'Zw-awa',
      githubLabel: 'GitHub',
      githubValue: 'github.com/Zw-awa/whybrary',
      pricingLabel: 'Pricing',
      pricingValue: 'This app will not charge users any fee.',
      licenseLabel: 'License',
      licenseValue: 'This project is fully open source under the MIT license.',
      privacyLabel: 'Data',
      privacyValue: 'No account, no sync, no upload. Your data stays on your device unless you export it yourself.',
      close: 'Close',
    },
  },
  zh: {
    appName: 'Whybrary',
    nav: {
      map: '脑图',
      todo: '待办',
      spaces: '空间',
    },
    status: {
      booting: '正在启动',
      saving: '正在保存到本地',
      saved: '已保存到本地',
      error: '已启用保存回退',
    },
    sidebar: {
      drawerTitle: '空间',
      closeSpaces: '关闭空间面板',
      newSpace: '新建空间',
      exportJson: '导出 JSON',
      importJson: '导入 JSON',
      resetBrowserData: '重置浏览器数据',
      settings: '设置',
      useLightTheme: '切换为浅色主题',
      useDarkTheme: '切换为深色主题',
      spaces: '空间',
      current: '当前空间',
      delete: '删除',
      name: '名称',
      untitledSpace: '未命名空间',
      pointsOpen: (points, open) => `${points} 个节点 · ${open} 个未完成`,
    },
    workspace: {
      points: (count) => `${count} 个节点`,
      openTasks: (count) => `${count} 个未完成事项`,
      webPreviewSubhead: '当前是网页预览模式。除非你主动导出 JSON，否则数据只保留在当前浏览器中。',
      spacesButton: '空间',
    },
    loading: {
      title: '正在准备你的本地空间...',
      body: '正在启动脑图、加载列表，并打开 SQLite 快照。',
    },
    banners: {
      exported: '已导出 JSON 快照。',
      imported: '已成功导入快照。',
      reset: '已重置浏览器本地快照。',
    },
    notices: {
      importFailedTitle: '导入失败',
      importFailedMessage: '请选择有效的 Whybrary JSON 快照文件。',
    },
    dialogs: {
      close: '关闭',
      cancel: '取消',
      resetBrowserTitle: '重置浏览器数据',
      resetBrowserMessage: '清除当前浏览器中的 Whybrary 本地快照，并替换成一个新的默认空间？',
      resetBrowserConfirm: '重置数据',
      deleteSpaceTitle: '删除当前空间',
      deleteSpaceMessage: (name) => `确定删除“${name}”吗？`,
      deleteSpaceConfirm: '删除空间',
      deleteNodesTitle: '删除选中节点',
      deleteNodesMessage: (count, preview, suffix) =>
        `确定删除 ${count} 个选中节点吗？${preview}${suffix}`,
      deleteNodesConfirmSingle: '删除节点',
      deleteNodesConfirmMultiple: '删除节点',
    },
    todo: {
      title: '待办',
      addPlaceholder: '添加一条简短任务...',
      add: '添加',
      markOpen: '标记为未完成',
      markCompleted: '标记为已完成',
      emptyTask: '空任务',
      deleteTodo: '删除待办',
      remove: '移除',
      dockTop: '顶部',
      dockFirstOpen: '首个未完',
      dockNextOpen: '下个未完',
      dockTopTitle: '回到顶部',
      dockFirstOpenTitle: '跳转到首个未完成待办',
      dockNextOpenTitle: '跳转到下一个未完成待办',
      expandPanel: '放大待办',
      restorePanel: '还原布局',
    },
    map: {
      title: '脑图',
      showInfo: '显示信息',
      hideInfo: '隐藏信息',
      done: '完成',
      editContent: '编辑内容',
      edit: '编辑',
      linkModeOn: '连线模式已打开',
      linkModeOff: '开启连线模式',
      linkOn: '连线模式已打开',
      link: '连线',
      newPoint: '新建节点',
      editingEnabled: '已开启编辑',
      viewingMode: '查看模式',
      rename: '重命名',
      delete: '删除',
      clear: '清除',
      untitled: '未命名',
      expandPanel: '放大脑图',
      restorePanel: '还原布局',
    },
    info: {
      nodes: (count) => `${count} 个节点`,
      links: (count) => `${count} 条连线`,
      close: '关闭',
      multiOn: '多选开启',
      multiOff: '多选关闭',
      selectAll: '全选',
      clear: '清除',
      deleteSelected: '删除选中项',
      untitledNode: (index) => `未命名 ${index}`,
    },
    welcome: {
      regionLabel: 'Whybrary 快速教程',
      eyebrow: '快速教程',
      title: '不到一分钟，看完整个应用怎么用。',
      body: 'Whybrary 把一个小型脑图和一个小型待办并排放在一起，让你的原因和下一步行动始终同时可见。',
      startEditing: '开始编辑',
      close: '关闭',
      importJson: '导入已有 JSON',
      exportJson: '导出当前 JSON',
      stepMapTitle: '脑图',
      stepMapBody: '添加简短节点、拖动位置，再把相关原因连起来，让结构始终一眼能看懂。',
      stepTodoTitle: '待办',
      stepTodoBody: '只保留简短的下一步行动。未完成事项会一直和脑图放在一起，方便把想法变成动作。',
      stepSpacesTitle: '空间',
      stepSpacesBody: '用空间分开不同主题。你可以在侧边栏或移动端空间面板里切换它们。',
    },
    settings: {
      title: '设置',
      button: '设置',
      tutorialTitle: '教程',
      tutorialBody: '如果你想快速回顾主要操作，可以随时重新打开这份简短教程。',
      tutorialButton: '打开教程',
      languageTitle: '语言',
      languageBody: '选择整个应用界面使用的显示语言。',
      languageEnglish: 'English',
      languageChinese: '简体中文',
      aboutTitle: '关于',
      aboutLead: 'Whybrary 是一个本地优先的开源应用，用来让你的原因和下一步行动始终保持可见。',
      authorLabel: '作者',
      authorValue: 'Zw-awa',
      githubLabel: 'GitHub',
      githubValue: 'github.com/Zw-awa/whybrary',
      pricingLabel: '收费',
      pricingValue: '这个应用不会向用户收取任何费用。',
      licenseLabel: '开源协议',
      licenseValue: '这个项目完全开源，采用 MIT 许可证。',
      privacyLabel: '数据',
      privacyValue: '没有账号，没有同步，没有上传。除非你自己导出，否则数据只保留在你的设备上。',
      close: '关闭',
    },
  },
};

export function getCopy(locale: AppLocale): AppCopy {
  return copy[locale] ?? copy.en;
}
// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
