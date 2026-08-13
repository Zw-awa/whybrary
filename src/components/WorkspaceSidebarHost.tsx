import { useCallback } from 'react';
import { getCopy } from '../lib/i18n';
import { SpaceSidebar } from './SpaceSidebar';
import type { WorkspaceShellModel } from './workspaceShellModel';

type WorkspaceSidebarHostProps = {
  drawer?: boolean;
  model: WorkspaceShellModel;
  onClose: () => void;
  onNavigateToMap: () => void;
};

export function WorkspaceSidebarHost({
  drawer = false,
  model,
  onClose,
  onNavigateToMap,
}: WorkspaceSidebarHostProps) {
  const { activeSpace, snapshot } = model.data;
  const { create, deleteActive, renameActive, select } = model.spaces;
  const copy = getCopy(snapshot.locale);
  const handleCreate = useCallback(() => {
    create();
    onNavigateToMap();
  }, [create, onNavigateToMap]);
  const handleSelect = useCallback(
    (id: string) => {
      select(id);
      onNavigateToMap();
    },
    [onNavigateToMap, select],
  );

  return (
    <SpaceSidebar
      activeSpaceId={snapshot.activeSpaceId}
      activeSpaceName={activeSpace.name}
      canRedo={model.history.canRedo}
      canUndo={model.history.canUndo}
      drawerTitle={drawer ? copy.sidebar.mobileDrawerTitle : copy.sidebar.drawerTitle}
      isDrawer={drawer}
      locale={snapshot.locale}
      onClose={drawer ? onClose : undefined}
      onCreateSpace={handleCreate}
      onDeleteActiveSpace={deleteActive}
      onExportSnapshot={model.workspace.exportSnapshot}
      onImportSnapshot={model.workspace.importSnapshot}
      onOpenSettings={model.workspace.openSettings}
      onRedo={model.history.redo}
      onRenameActiveSpace={renameActive}
      onResetPreviewData={model.workspace.resetPreview}
      onSelectSpace={handleSelect}
      onToggleTheme={model.preferences.toggleTheme}
      onUndo={model.history.undo}
      saveLabel={model.ui.saveLabel}
      spaces={snapshot.spaces}
      theme={snapshot.theme}
    />
  );
}
