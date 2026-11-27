import React from 'react';
import {
  CustomMeta,
  EventSalesLog,
  PluginDefinition,
  Project,
  SmartHomeSwitchItem
} from '../../types';
import { SmartHomeQuickPanel } from './SmartHomeQuickPanel';

interface ExtrasViewProps {
  activeProject: Project;
  activePlugins: PluginDefinition[];
  gastroCartBridgeEnabled?: boolean;
  smartHomeEnabled?: boolean;
  smartHomeSwitches?: SmartHomeSwitchItem[];
  haWebhookUrl?: string;
  onTriggerSmartHomeSwitch?: (switchId: string, triggeredAt: string) => void;
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
  gastroCartBridgeEnabled = true,
  smartHomeEnabled = false,
  smartHomeSwitches = [],
  haWebhookUrl = '',
  onTriggerSmartHomeSwitch,
  onUpdateProjectMeta,
  onAddCartItems,
  onRecordEventSale,
  onNotify
}) => {
  const openCartTitles = (activeProject.cart || [])
    .filter((item) => !item.completed)
    .map((item) => item.title);

  return (
    <section className="space-y-4">
      <SmartHomeQuickPanel
        smartHomeEnabled={smartHomeEnabled}
        switches={smartHomeSwitches}
        haWebhookUrl={haWebhookUrl}
        onSwitchTriggered={(switchId, triggeredAt) =>
          onTriggerSmartHomeSwitch?.(switchId, triggeredAt)
        }
      />

      {activePlugins.map((plugin) => (
        <div key={plugin.id} className="rounded-3xl overflow-hidden shadow-xl">
          {plugin.render({
            project: activeProject,
            onUpdateProjectMeta: (patch) =>
              onUpdateProjectMeta(activeProject.id, patch),
            onAddCartItems: (items) => onAddCartItems(activeProject.id, items),
            onRecordEventSale,
            onNotify,
            gastroCartBridgeEnabled,
            openCartTitles,
            onAddRestockItemsToCart: (items) => onAddCartItems(activeProject.id, items)
          })}
        </div>
      ))}
    </section>
  );
};
