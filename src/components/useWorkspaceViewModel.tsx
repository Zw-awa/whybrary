import { useCallback, useEffect, useMemo, useState } from 'react';
import { createOfficialPluginRegistry } from '../plugins';
import type { AppDialogState } from './AppDialog';
import { getCopy } from '../lib/i18n';
import type { AppLocale, AppSnapshot, BrainNode, Space, ThemeMode } from '../types';
import type { TutorialStep } from './GuidedTutorial';
import type { WorkspaceShellModel } from './workspaceShellModel';
import { useSnapshotTransferController } from './useSnapshotTransferController';

const ADVANCED_FEATURES_KEY = 'whybrary.ui.advancedFeatures';

type Commands = {
  preferences: {
    markTutorialSeen: () => void;
    setLocale: (locale: AppLocale) => void;
    setTheme: (theme: ThemeMode) => void;
    toggleTheme: () => void;
  };
  spaces: {
    create: () => Space;
    delete: (id: string) => void;
    rename: (id: string, name: string) => void;
    select: (id: string) => void;
  };
  map: {
    addNode: (position?: BrainNode['position']) => BrainNode;
    deleteNodes: (ids: string[]) => void;
    renameNode: (id: string, label: string) => void;
    setNodePositions: (nodes: BrainNode[]) => void;
    setViewport: (viewport: Space['viewport']) => void;
    toggleConnection: (source: string, target: string) => void;
    updateNodeMetadata: WorkspaceShellModel['map']['updateNodeMetadata'];
  };
  todos: {
    add: (text: string) => void;
    delete: (id: string) => void;
    toggle: (id: string) => void;
    update: (id: string, text: string) => void;
    updateMetadata: WorkspaceShellModel['todos']['updateMetadata'];
  };
};

type Controller = {
  canRedo: boolean;
  canUndo: boolean;
  getSnapshot: () => AppSnapshot;
  redo: () => void;
  replaceSnapshot: (snapshot: AppSnapshot) => void;
  undo: () => void;
};

type Tutorial = {
  advance: (step: TutorialStep) => void;
  back: () => void;
  requestClose: () => void;
  resolveClose: (snapshot: AppSnapshot, keepExample: boolean) => void;
  showTutorial: boolean;
  start: (snapshot: AppSnapshot) => void;
  step: TutorialStep;
};

type Persistence = {
  discardPreviewFallback: () => void;
  error: unknown;
  previewFallback: AppSnapshot | null;
  recoverPreviewFallback: () => void;
  retry: () => void;
  status: 'loading' | 'saved' | 'saving' | 'error';
};

type UseWorkspaceViewModelArgs = {
  activeSpace: Space;
  commands: Commands;
  controller: Controller;
  persistence: Persistence;
  snapshot: AppSnapshot;
  tutorial: Tutorial;
};

function saveStatusLabel(status: 'booting' | 'saving' | 'saved' | 'error', locale: AppLocale) {
  const copy = getCopy(locale);
  return copy.status[status === 'booting' ? 'booting' : status];
}

export function useWorkspaceViewModel({
  activeSpace,
  commands,
  controller,
  persistence,
  snapshot,
  tutorial,
}: UseWorkspaceViewModelArgs) {
  const {
    preferences: commandPreferences,
    map: commandMap,
    spaces: commandSpaces,
    todos: commandTodos,
  } = commands;
  const { canRedo, canUndo, getSnapshot, redo, replaceSnapshot, undo } = controller;
  const { advance, back, requestClose, resolveClose, showTutorial, start, step } = tutorial;
  const {
    discardPreviewFallback,
    error: persistenceError,
    previewFallback,
    recoverPreviewFallback,
    retry,
    status,
  } = persistence;
  const [advancedEnabled, setAdvancedEnabled] = useState(
    () => window.localStorage.getItem(ADVANCED_FEATURES_KEY) === 'true',
  );
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<AppDialogState>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [isMapEditing, setIsMapEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pluginsActivated, setPluginsActivated] = useState(false);
  const pluginRegistry = useMemo(() => createOfficialPluginRegistry(), []);
  useEffect(() => {
    const dispose = pluginRegistry.activate({
      getSnapshot,
      subscribe: () => () => undefined,
    });
    setPluginsActivated(true);
    return () => {
      dispose();
      setPluginsActivated(false);
    };
  }, [getSnapshot, pluginRegistry]);

  const pluginPanels = useMemo(
    () =>
      !pluginsActivated
        ? []
        : pluginRegistry.listPanels().map((panel) => ({
            panel,
            items: panel.getItems(snapshot, snapshot.locale),
          })),
    [pluginsActivated, pluginRegistry, snapshot],
  );

  const copy = getCopy(snapshot.locale);
  const closeDialog = useCallback(() => setDialogState(null), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const clearMapInteraction = useCallback(() => {
    setIsMapEditing(false);
    setEditingNodeId(null);
  }, []);
  const setAdvancedFeatures = useCallback((enabled: boolean) => {
    setAdvancedEnabled(enabled);
    window.localStorage.setItem(ADVANCED_FEATURES_KEY, String(enabled));
  }, []);

  const openTutorial = useCallback(() => {
    start(snapshot);
    closeSettings();
    clearMapInteraction();
  }, [clearMapInteraction, closeSettings, snapshot, start]);

  const requestTutorialClose = useCallback(() => {
    requestClose();
    setDialogState({
      cancelLabel: copy.tutorial.deleteExample,
      confirmLabel: copy.tutorial.keepExample,
      message: copy.tutorial.exitMessage,
      onCancel: () => {
        resolveClose(getSnapshot(), false);
        closeDialog();
      },
      onConfirm: () => {
        resolveClose(getSnapshot(), true);
        closeDialog();
      },
      title: copy.tutorial.exitTitle,
    });
  }, [
    closeDialog,
    getSnapshot,
    copy.tutorial.deleteExample,
    copy.tutorial.exitMessage,
    copy.tutorial.exitTitle,
    copy.tutorial.keepExample,
    requestClose,
    resolveClose,
  ]);

  const { exportSnapshot, importSnapshot, resetPreview } = useSnapshotTransferController({
    clearMapInteraction,
    closeDialog,
    getSnapshot,
    replaceSnapshot,
    setBannerMessage,
    setDialogState,
    startTutorial: start,
  });

  const createSpace = useCallback(() => {
    commandPreferences.markTutorialSeen();
    commandSpaces.create();
    clearMapInteraction();
  }, [clearMapInteraction, commandPreferences, commandSpaces]);
  const selectSpace = useCallback(
    (id: string) => {
      commandSpaces.select(id);
      clearMapInteraction();
    },
    [clearMapInteraction, commandSpaces],
  );
  const renameActiveSpace = useCallback(
    (name: string) => commandSpaces.rename(activeSpace.id, name),
    [activeSpace.id, commandSpaces],
  );
  const deleteActiveSpace = useCallback(() => {
    setDialogState({
      confirmLabel: copy.dialogs.deleteSpaceConfirm,
      message: copy.dialogs.deleteSpaceMessage(activeSpace.name || copy.sidebar.untitledSpace),
      onConfirm: () => {
        commandSpaces.delete(activeSpace.id);
        closeDialog();
      },
      title: copy.dialogs.deleteSpaceTitle,
      tone: 'danger',
    });
  }, [
    activeSpace.id,
    activeSpace.name,
    closeDialog,
    commandSpaces,
    copy.dialogs,
    copy.sidebar.untitledSpace,
  ]);

  const addNode = useCallback(
    (position?: BrainNode['position']) => {
      const node = commandMap.addNode(position);
      setIsMapEditing(true);
      setEditingNodeId(node.id);
      advance(2);
      return node;
    },
    [advance, commandMap],
  );
  const deleteNodes = useCallback(
    (ids: string[]) => {
      commandMap.deleteNodes(ids);
      advance(5);
    },
    [advance, commandMap],
  );
  const requestDeleteNodes = useCallback(
    (ids: string[], labels: string[]) => {
      const preview = labels.slice(0, 3).join(', ');
      const more = ids.length > 3 ? copy.dialogs.deleteNodesMore(ids.length - 3) : '';
      setDialogState({
        confirmLabel:
          ids.length > 1
            ? copy.dialogs.deleteNodesConfirmMultiple
            : copy.dialogs.deleteNodesConfirmSingle,
        message: copy.dialogs.deleteNodesMessage(ids.length, preview, more),
        onConfirm: () => {
          commandMap.deleteNodes(ids);
          closeDialog();
        },
        title: copy.dialogs.deleteNodesTitle,
        tone: 'danger',
      });
    },
    [closeDialog, commandMap, copy.dialogs],
  );
  const persistNodePositions = useCallback(
    (nodes: BrainNode[]) => {
      commandMap.setNodePositions(nodes);
      advance(3);
    },
    [advance, commandMap],
  );
  const toggleConnection = useCallback(
    (source: string, target: string) => {
      commandMap.toggleConnection(source, target);
      advance(4);
    },
    [advance, commandMap],
  );
  const toggleMapEditing = useCallback(() => {
    setEditingNodeId(null);
    setIsMapEditing((value) => !value);
    advance(1);
  }, [advance]);

  const addTodo = useCallback(
    (text: string) => {
      commandTodos.add(text);
      advance(6);
    },
    [advance, commandTodos],
  );
  const toggleTodo = useCallback(
    (id: string) => {
      commandTodos.toggle(id);
      advance(7);
    },
    [advance, commandTodos],
  );
  const tutorialNext = useCallback(() => advance(0), [advance]);
  const finishRenameNode = useCallback(() => setEditingNodeId(null), []);

  const spaces = useMemo(
    () => ({
      create: createSpace,
      deleteActive: deleteActiveSpace,
      renameActive: renameActiveSpace,
      select: selectSpace,
    }),
    [createSpace, deleteActiveSpace, renameActiveSpace, selectSpace],
  );
  const history = useMemo(
    () => ({
      canRedo,
      canUndo,
      redo,
      undo,
    }),
    [canRedo, canUndo, redo, undo],
  );
  const workspace = useMemo(
    () => ({ exportSnapshot, importSnapshot, openSettings, resetPreview }),
    [exportSnapshot, importSnapshot, openSettings, resetPreview],
  );
  const preferences = useMemo(
    () => ({
      changeLocale: commandPreferences.setLocale,
      toggleTheme: commandPreferences.toggleTheme,
    }),
    [commandPreferences.setLocale, commandPreferences.toggleTheme],
  );
  const map = useMemo(
    () => ({
      addNode,
      deleteNodes,
      finishRenameNode,
      persistNodePositions,
      renameNode: commandMap.renameNode,
      requestDeleteNodes,
      startRenameNode: setEditingNodeId,
      toggleConnection,
      toggleEditing: toggleMapEditing,
      updateNodeMetadata: commandMap.updateNodeMetadata,
      updateViewport: commandMap.setViewport,
    }),
    [
      addNode,
      commandMap.renameNode,
      commandMap.setViewport,
      commandMap.updateNodeMetadata,
      deleteNodes,
      finishRenameNode,
      persistNodePositions,
      requestDeleteNodes,
      toggleConnection,
      toggleMapEditing,
    ],
  );
  const todos = useMemo(
    () => ({
      add: addTodo,
      delete: commandTodos.delete,
      toggle: toggleTodo,
      update: commandTodos.update,
      updateMetadata: commandTodos.updateMetadata,
    }),
    [addTodo, commandTodos.delete, commandTodos.update, commandTodos.updateMetadata, toggleTodo],
  );
  const tutorialModel = useMemo(
    () => ({
      back,
      exit: requestTutorialClose,
      next: tutorialNext,
      step,
      visible: showTutorial,
    }),
    [back, requestTutorialClose, showTutorial, step, tutorialNext],
  );
  const persistenceModel = useMemo(
    () => ({
      discardPreviewFallback,
      error: persistenceError,
      previewFallback,
      recoverPreviewFallback,
      retry,
    }),
    [discardPreviewFallback, persistenceError, previewFallback, recoverPreviewFallback, retry],
  );
  const ui = useMemo(
    () => ({
      advancedEnabled,
      bannerMessage,
      editingNodeId,
      isMapEditing,
      saveLabel: saveStatusLabel(status === 'loading' ? 'booting' : status, snapshot.locale),
    }),
    [advancedEnabled, bannerMessage, editingNodeId, isMapEditing, status, snapshot.locale],
  );
  const data = useMemo(() => ({ activeSpace, snapshot }), [activeSpace, snapshot]);
  const shellModel = useMemo<WorkspaceShellModel>(
    () => ({
      data,
      history,
      map,
      plugins: { panels: pluginPanels },
      persistence: persistenceModel,
      preferences,
      spaces,
      todos,
      tutorial: tutorialModel,
      ui,
      workspace,
    }),
    [
      data,
      history,
      map,
      persistenceModel,
      pluginPanels,
      preferences,
      spaces,
      todos,
      tutorialModel,
      ui,
      workspace,
    ],
  );
  const settings = useMemo(
    () => ({
      advancedEnabled,
      locale: snapshot.locale,
      onAdvancedChange: setAdvancedFeatures,
      onClose: closeSettings,
      onLocaleChange: commandPreferences.setLocale,
      onOpenTutorial: openTutorial,
      onThemeChange: commandPreferences.setTheme,
      open: settingsOpen,
      theme: snapshot.theme,
    }),
    [
      advancedEnabled,
      closeSettings,
      commandPreferences.setLocale,
      commandPreferences.setTheme,
      openTutorial,
      setAdvancedFeatures,
      settingsOpen,
      snapshot.locale,
      snapshot.theme,
    ],
  );

  useEffect(() => {
    if (!bannerMessage) return;
    const timer = window.setTimeout(() => setBannerMessage(null), 2200);
    return () => window.clearTimeout(timer);
  }, [bannerMessage]);

  return { closeDialog, dialogState, settings, shellModel };
}
