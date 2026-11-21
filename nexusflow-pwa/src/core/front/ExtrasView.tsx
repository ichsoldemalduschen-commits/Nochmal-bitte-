import React from 'react';
import {
  CustomMeta,
  EventSalesLog,
  PluginContextProps,
  PluginDefinition,
  Project
} from '../../types';

interface ExtrasViewProps {
  activeProject: Project;
  activePlugins: PluginDefinition[];
  onUpdateProjectMeta: (projectId: string, patch: CustomMeta) => void;
  onAddCartItems: (
    projectId: string,
    items: Array<{ title: string; quantity: string; price?: string; reason?: string }>
  ) => void;
  onRecordEventSale: (entry: EventSalesLog) => void;
  onNotify: (msg: string) => void;
}

export const ExtrasView: React.FC<ExtrasViewProps> = ({
  activeProject,
  activePlugins,
  onUpdateProjectMeta,
  onAddCartItems,
  onRecordEventSale,
  onNotify
}) => {
  return (
    <section className="space-y-4">
      {activePlugins.map((plugin) => (
        <div key={plugin.id} className="rounded-3xl overflow-hidden shadow-xl">
          {plugin.render({
            project: activeProject,
            onUpdateProjectMeta: (patch) =>
              onUpdateProjectMeta(activeProject.id, patch),
            onAddCartItems: (items) => onAddCartItems(activeProject.id, items),
            onRecordEventSale,
            onNotify
          })}
        </div>
      ))}
    </section>
  );
};
