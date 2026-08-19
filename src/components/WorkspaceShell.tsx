import { useCallback } from 'react';
import { BrainCanvas } from './BrainCanvas';
import { GuidedTutorial } from './GuidedTutorial';
import { WhyTodoPanel } from './WhyTodoPanel';
import { WorkspaceBanners } from './WorkspaceBanners';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceMobileNavigation } from './WorkspaceMobileNavigation';
import { WorkspaceSidebarHost } from './WorkspaceSidebarHost';
import { useAppLayout } from './useAppLayout';
import type { WorkspaceShellModel } from './workspaceShellModel';

type WorkspaceShellProps = {
  model: WorkspaceShellModel;
};

export function WorkspaceShell({ model }: WorkspaceShellProps) {
  const layout = useAppLayout(model.tutorial.visible, model.tutorial.step);
  const { isMobile, setIsSidebarOpen, setMobileView, toggleExpandedPanel } = layout;
  const { activeSpace, snapshot } = model.data;
  const showMap = !isMobile || layout.mobileView === 'map';
  const showTodo = !isMobile || layout.mobileView === 'todo';
  const isOverlayInfoOpen = !isMobile && layout.isMapInfoOpen && layout.expandedPanel === 'map';
  const isRailInfoOpen = !isMobile && layout.isMapInfoOpen && layout.expandedPanel === null;
  const closeAndShowMap = useCallback(() => {
    if (isMobile) setMobileView('map');
    setIsSidebarOpen(false);
  }, [isMobile, setIsSidebarOpen, setMobileView]);
  const openSpaces = useCallback(() => setIsSidebarOpen(true), [setIsSidebarOpen]);
  const closeSpaces = useCallback(() => setIsSidebarOpen(false), [setIsSidebarOpen]);
  const toggleTodoExpanded = useCallback(() => toggleExpandedPanel('todo'), [toggleExpandedPanel]);
  const toggleMapExpanded = useCallback(() => toggleExpandedPanel('map'), [toggleExpandedPanel]);

  return (
    <div
      className={`app-shell app-shell--${layout.layoutMode} ${layout.expandedPanel ? 'is-panel-expanded' : ''} ${isRailInfoOpen ? 'is-info-open' : ''} ${isOverlayInfoOpen ? 'is-overlay-info-open' : ''}`}
    >
      {!layout.isMobile ? (
        <div className="app-rail">
          <div className="app-rail__spaces">
            <WorkspaceSidebarHost
              model={model}
              onClose={closeSpaces}
              onNavigateToMap={closeAndShowMap}
            />
          </div>
          <aside className="app-rail__details">
            <div className="app-rail__details-host" ref={layout.setInfoPortalTarget} />
          </aside>
        </div>
      ) : null}
      <main className={`workspace ${layout.expandedPanel ? 'workspace--panel-expanded' : ''}`}>
        <WorkspaceHeader
          activeSpace={activeSpace}
          isMobile={layout.isMobile}
          locale={snapshot.locale}
          onOpenSpaces={openSpaces}
        />
        <WorkspaceBanners
          bannerMessage={model.ui.bannerMessage}
          locale={snapshot.locale}
          persistence={model.persistence}
        />
        <div
          className={`workspace__grid ${showMap && showTodo ? '' : 'workspace__grid--single'} ${layout.expandedPanel ? `workspace__grid--${layout.expandedPanel}-expanded` : ''} ${isRailInfoOpen ? 'workspace__grid--info-open' : ''}`}
        >
          {showTodo ? (
            <WhyTodoPanel
              advancedEnabled={model.ui.advancedEnabled}
              isExpanded={layout.expandedPanel === 'todo'}
              isMobile={layout.isMobile}
              locale={snapshot.locale}
              onAddTodo={model.todos.add}
              onChangeTodoText={model.todos.update}
              onDeleteTodo={model.todos.delete}
              onTodoMetadataChange={model.todos.updateMetadata}
              onToggleExpanded={isMobile ? undefined : toggleTodoExpanded}
              onToggleTodo={model.todos.toggle}
              todos={activeSpace.todos}
            />
          ) : null}
          {showMap ? (
            <BrainCanvas
              advancedEnabled={model.ui.advancedEnabled}
              editingNodeId={model.ui.editingNodeId}
              edges={activeSpace.edges}
              isEditMode={model.ui.isMapEditing}
              isExpanded={layout.expandedPanel === 'map'}
              isInfoOpen={layout.isMapInfoOpen}
              isMobile={layout.isMobile}
              infoPortalTarget={
                isOverlayInfoOpen ? layout.expandedInfoPortalTarget : layout.infoPortalTarget
              }
              locale={snapshot.locale}
              nodes={activeSpace.nodes}
              onAddNeuron={model.map.addNode}
              onDeleteNodes={model.map.deleteNodes}
              onFinishRenameNode={model.map.finishRenameNode}
              onInfoOpenChange={layout.setIsMapInfoOpen}
              onNodeLabelChange={model.map.renameNode}
              onNodeMetadataChange={model.map.updateNodeMetadata}
              onPersistNodePositions={model.map.persistNodePositions}
              onRequestDeleteNodes={model.map.requestDeleteNodes}
              onStartRenameNode={model.map.startRenameNode}
              onToggleConnection={model.map.toggleConnection}
              onToggleEditMode={model.map.toggleEditing}
              onToggleExpanded={isMobile ? undefined : toggleMapExpanded}
              onViewportChange={model.map.updateViewport}
              viewport={activeSpace.viewport}
            />
          ) : null}
        </div>
        {model.tutorial.visible ? (
          <GuidedTutorial
            locale={snapshot.locale}
            onBack={model.tutorial.back}
            onExit={model.tutorial.exit}
            onNext={model.tutorial.next}
            step={model.tutorial.step}
          />
        ) : null}
      </main>
      {!layout.isMobile ? (
        <aside className="expanded-info-drawer">
          <div className="expanded-info-drawer__host" ref={layout.setExpandedInfoPortalTarget} />
        </aside>
      ) : null}
      {layout.isMobile ? (
        <>
          <WorkspaceMobileNavigation
            isSidebarOpen={layout.isSidebarOpen}
            locale={snapshot.locale}
            mobileView={layout.mobileView}
            onOpenSpaces={openSpaces}
            onSelectView={layout.setMobileView}
          />
          {layout.isSidebarOpen ? (
            <div className="sheet-backdrop" onClick={closeSpaces} role="presentation">
              <div className="sheet-shell" onClick={(event) => event.stopPropagation()}>
                <WorkspaceSidebarHost
                  drawer
                  model={model}
                  onClose={closeSpaces}
                  onNavigateToMap={closeAndShowMap}
                />
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
