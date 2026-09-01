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
    undo: string;
    redo: string;
    spaces: string;
    current: string;
    delete: string;
    name: string;
    untitledSpace: string;
    mobileDrawerTitle: string;
    newSpaceName: (index: number) => string;
    firstSpaceName: string;
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
  persistence: {
    loadFailedTitle: string;
    loadFailedBody: string;
    saveFailed: string;
    retry: string;
    startFresh: string;
    recoverFallback: string;
    discardFallback: string;
    fallbackTitle: string;
    fallbackBody: string;
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
    deleteNodesMessage: (count: number, preview: string, more: string) => string;
    deleteNodesMore: (count: number) => string;
    deleteNodesConfirmSingle: string;
    deleteNodesConfirmMultiple: string;
  };
  tutorial: {
    ariaLabel: string;
    exampleSpace: string;
    exitTitle: string;
    exitMessage: string;
    keepExample: string;
    deleteExample: string;
    back: string;
    exit: string;
    start: string;
    openEditing: string;
    createNode: string;
    completionHint: string;
    steps: readonly { title: string; body: string }[];
    shortcuts: Partial<Record<3 | 5 | 6, { keys: string; label: string }>>;
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
    searchPlaceholder: string;
    clearSearch: string;
    fitToNodes: string;
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
    themeTitle: string;
    themeBody: string;
    themeLight: string;
    themeDark: string;
    themeSystem: string;
    advancedTitle: string;
    advancedBody: string;
    advancedEnable: string;
    pluginsTitle: string;
    pluginsBody: string;
    pluginsEnable: string;
    pluginsRiskTitle: string;
    pluginsRiskBody: string;
    pluginsRiskCancel: string;
    pluginsRiskConfirm: string;
  };
  onboarding: {
    languageTitle: string;
    languageBody: string;
    continue: string;
  };
  advanced: {
    category: string;
    color: string;
    noCategory: string;
    priority: string;
    dueDate: string;
    none: string;
    categories: Record<'idea' | 'reason' | 'question' | 'action', string>;
    colors: Record<'neutral' | 'blue' | 'green' | 'amber' | 'red', string>;
    priorities: Record<'low' | 'medium' | 'high', string>;
  };
  floatingActions: {
    drag: string;
    expand: string;
    minimize: string;
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
      undo: 'Undo',
      redo: 'Redo',
      spaces: 'Spaces',
      current: 'Current',
      delete: 'Delete',
      name: 'Name',
      untitledSpace: 'Untitled Space',
      mobileDrawerTitle: 'Space Library',
      newSpaceName: (index) => `Space ${index}`,
      firstSpaceName: 'My First Space',
      pointsOpen: (points, open) => `${points} points · ${open} open`,
    },
    workspace: {
      points: (count) => `${count} points`,
      openTasks: (count) => `${count} open tasks`,
      webPreviewSubhead:
        'Web preview mode. Your data stays in this browser unless you export JSON.',
      spacesButton: 'Spaces',
    },
    loading: {
      title: 'Preparing your local space...',
      body: 'Booting the graph, loading the list, and opening the SQLite snapshot.',
    },
    persistence: {
      loadFailedTitle: 'Unable to open local data',
      loadFailedBody:
        'Whybrary did not change your existing data. Retry the connection or explicitly start a fresh workspace.',
      saveFailed: 'Changes are not saved yet.',
      retry: 'Retry',
      startFresh: 'Start Fresh',
      recoverFallback: 'Recover Newer Data',
      discardFallback: 'Keep SQLite Data',
      fallbackTitle: 'Newer browser fallback found',
      fallbackBody: 'A previous save could not reach SQLite. Choose which copy to keep.',
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
      resetBrowserMessage:
        'Clear the browser-local Whybrary snapshot and replace it with a fresh default space?',
      resetBrowserConfirm: 'Reset Data',
      deleteSpaceTitle: 'Delete current space',
      deleteSpaceMessage: (name) => `Delete "${name}"?`,
      deleteSpaceConfirm: 'Delete Space',
      deleteNodesTitle: 'Delete selected nodes',
      deleteNodesMessage: (count, preview, suffix) =>
        `Delete ${count} selected node${count > 1 ? 's' : ''}? ${preview}${suffix}`,
      deleteNodesMore: (count) => ` and ${count} more`,
      deleteNodesConfirmSingle: 'Delete Node',
      deleteNodesConfirmMultiple: 'Delete Nodes',
    },
    tutorial: {
      ariaLabel: 'Guided tutorial',
      exampleSpace: 'Tutorial Example',
      exitTitle: 'Finish Tutorial',
      exitMessage: 'Would you like to keep the example space created by the tutorial?',
      keepExample: 'Keep Example',
      deleteExample: 'Delete Example',
      back: 'Back',
      exit: 'Exit',
      start: 'Start',
      openEditing: 'Open Editing',
      createNode: 'Create Node',
      completionHint: 'Complete the highlighted action to continue automatically.',
      steps: [
        {
          title: 'Your spaces',
          body: 'Spaces keep different topics separate. This tutorial uses its own example space.',
        },
        { title: 'Edit the map', body: 'Select Edit Content to reveal node editing tools.' },
        { title: 'Create a node', body: 'Select New Point to add a node to the map.' },
        {
          title: 'Move the idea',
          body: 'Finish naming the new node, then drag it and watch connected ideas respond.',
        },
        { title: 'Connect ideas', body: 'Enable Link Mode, then select two nodes.' },
        {
          title: 'Remove a node',
          body: 'Select a node, then use the nearby Delete action or a keyboard shortcut.',
        },
        {
          title: 'Add a next action',
          body: 'Type a short task, then select Add or use the keyboard shortcut.',
        },
        {
          title: 'Complete the task',
          body: 'Select the task check control to finish the tutorial.',
        },
      ],
      shortcuts: {
        3: { keys: 'Enter', label: 'Finish naming the node' },
        5: { keys: 'Backspace / Delete', label: 'Delete the selected node' },
        6: { keys: 'Enter', label: 'Add the typed todo' },
      },
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
      searchPlaceholder: 'Filter nodes...',
      clearSearch: 'Clear node filter',
      fitToNodes: 'Fit all nodes',
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
      stepMapBody:
        'Add short nodes, drag them, and connect related reasons so the structure stays easy to scan.',
      stepTodoTitle: 'To-Do',
      stepTodoBody:
        'Keep only short next actions. Open tasks stay beside the map so ideas turn into visible steps.',
      stepSpacesTitle: 'Spaces',
      stepSpacesBody:
        'Use spaces to separate different topics. You can switch them from the sidebar or the mobile spaces sheet.',
    },
    settings: {
      title: 'Settings',
      button: 'Settings',
      tutorialTitle: 'Tutorial',
      tutorialBody:
        'Open the quick tutorial again if you want a fast reminder of the main workflow.',
      tutorialButton: 'Open Tutorial',
      languageTitle: 'Language',
      languageBody: 'Choose the display language used across the app interface.',
      languageEnglish: 'English',
      languageChinese: '简体中文',
      aboutTitle: 'About',
      aboutLead:
        'Whybrary is a local-first open source app for keeping your reasons and next actions visible.',
      authorLabel: 'Author',
      authorValue: 'Zw-awa',
      githubLabel: 'GitHub',
      githubValue: 'github.com/Zw-awa/whybrary',
      pricingLabel: 'Pricing',
      pricingValue: 'This app will not charge users any fee.',
      licenseLabel: 'License',
      licenseValue: 'This project is fully open source under the MIT license.',
      privacyLabel: 'Data',
      privacyValue:
        'No account, no sync, no upload. Your data stays on your device unless you export it yourself.',
      close: 'Close',
      themeTitle: 'Appearance',
      themeBody: 'Choose a fixed appearance or follow the system setting.',
      themeLight: 'Light',
      themeDark: 'Dark',
      themeSystem: 'System',
      advancedTitle: 'Advanced fields',
      advancedBody:
        'Reveal optional node classification and task planning fields. Existing workflows stay unchanged when this is off.',
      advancedEnable: 'Show advanced fields',
      pluginsTitle: 'Plugin support',
      pluginsBody:
        'Plugin support is off by default. Only enable it when you choose to use plugins from sources you trust.',
      pluginsEnable: 'Enable plugin support',
      pluginsRiskTitle: 'Enable third-party plugins?',
      pluginsRiskBody:
        'Plugins may run code and access the workspace capabilities you grant them. Install plugins only from sources you trust. You are responsible for your choice to install third-party plugins and for any resulting loss, damage, or data exposure.',
      pluginsRiskCancel: 'Keep disabled',
      pluginsRiskConfirm: 'I understand, enable plugins',
    },
    onboarding: {
      languageTitle: 'Choose your language',
      languageBody: 'Set the interface language before the quick tutorial begins.',
      continue: 'Continue',
    },
    advanced: {
      category: 'Category',
      color: 'Color',
      noCategory: 'No category',
      priority: 'Priority',
      dueDate: 'Due date',
      none: 'None',
      categories: { idea: 'Idea', reason: 'Reason', question: 'Question', action: 'Action' },
      colors: { neutral: 'Neutral', blue: 'Blue', green: 'Green', amber: 'Amber', red: 'Red' },
      priorities: { low: 'Low', medium: 'Medium', high: 'High' },
    },
    floatingActions: {
      drag: 'Drag',
      expand: 'Expand quick actions',
      minimize: 'Minimize quick actions',
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
      undo: '撤销',
      redo: '重做',
      spaces: '空间',
      current: '当前空间',
      delete: '删除',
      name: '名称',
      untitledSpace: '未命名空间',
      mobileDrawerTitle: '空间库',
      newSpaceName: (index) => `空间 ${index}`,
      firstSpaceName: '我的第一个空间',
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
    persistence: {
      loadFailedTitle: '无法打开本地数据',
      loadFailedBody: 'Whybrary 没有修改已有数据。请重试连接，或明确确认后创建全新空间。',
      saveFailed: '修改尚未保存。',
      retry: '重试',
      startFresh: '创建全新空间',
      recoverFallback: '恢复更新的数据',
      discardFallback: '保留 SQLite 数据',
      fallbackTitle: '发现更新的浏览器回退数据',
      fallbackBody: '上一次保存未能写入 SQLite，请选择要保留的副本。',
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
      deleteNodesMore: (count) => `，以及另外 ${count} 个`,
      deleteNodesConfirmSingle: '删除节点',
      deleteNodesConfirmMultiple: '删除节点',
    },
    tutorial: {
      ariaLabel: '新手教程',
      exampleSpace: '教程示例',
      exitTitle: '结束教程',
      exitMessage: '是否保留教程中创建的示例空间？',
      keepExample: '保留示例',
      deleteExample: '删除示例',
      back: '上一步',
      exit: '退出',
      start: '开始',
      openEditing: '打开编辑内容',
      createNode: '新建节点',
      completionHint: '完成高亮区域中的操作后，教程会自动继续。',
      steps: [
        { title: '认识空间', body: '空间可以分开不同主题。本教程会使用独立的示例空间。' },
        { title: '编辑脑图', body: '点击“编辑内容”，显示节点编辑工具。' },
        { title: '创建节点', body: '点击“新建节点”，向脑图添加一个想法。' },
        { title: '移动想法', body: '先完成新节点命名，再拖动它并观察相连节点受到牵拉。' },
        { title: '连接想法', body: '开启连线模式，然后依次选择两个节点。' },
        { title: '删除节点', body: '先选中节点，再点击节点旁的“删除”，也可以使用快捷键。' },
        { title: '添加下一步', body: '输入一条简短任务，再点击“添加”或使用快捷键。' },
        { title: '完成任务', body: '点击待办的完成按钮，结束本次教程。' },
      ],
      shortcuts: {
        3: { keys: 'Enter', label: '完成节点命名' },
        5: { keys: 'Backspace / Delete', label: '删除已选节点' },
        6: { keys: 'Enter', label: '添加已输入的待办' },
      },
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
      searchPlaceholder: '筛选节点...',
      clearSearch: '清除节点筛选',
      fitToNodes: '适应全部节点',
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
      themeTitle: '外观',
      themeBody: '选择固定外观，或跟随系统设置自动切换。',
      themeLight: '浅色',
      themeDark: '深色',
      themeSystem: '跟随系统',
      advancedTitle: '高级字段',
      advancedBody: '显示可选的节点分类与任务规划字段。关闭时不会改变现有工作流。',
      advancedEnable: '显示高级字段',
      pluginsTitle: '插件功能',
      pluginsBody: '插件功能默认关闭。只有在你决定使用来自可信来源的插件时才应开启。',
      pluginsEnable: '启用插件功能',
      pluginsRiskTitle: '启用第三方插件？',
      pluginsRiskBody:
        '插件可能执行代码，并访问你授予它们的工作区能力。请只安装来自可信来源的插件。安装第三方插件是你的自主选择；由此导致的损失、损害或数据暴露，均由你自行承担。',
      pluginsRiskCancel: '保持关闭',
      pluginsRiskConfirm: '我已了解，启用插件',
    },
    onboarding: {
      languageTitle: '选择语言',
      languageBody: '在快速教程开始前设置应用界面语言。',
      continue: '继续',
    },
    advanced: {
      category: '分类',
      color: '颜色',
      noCategory: '无分类',
      priority: '优先级',
      dueDate: '截止日期',
      none: '无',
      categories: { idea: '想法', reason: '原因', question: '问题', action: '行动' },
      colors: { neutral: '中性', blue: '蓝色', green: '绿色', amber: '琥珀色', red: '红色' },
      priorities: { low: '低', medium: '中', high: '高' },
    },
    floatingActions: {
      drag: '拖动',
      expand: '展开快捷操作',
      minimize: '收起快捷操作',
    },
  },
};

export function getCopy(locale: AppLocale): AppCopy {
  return copy[locale] ?? copy.en;
}
// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
