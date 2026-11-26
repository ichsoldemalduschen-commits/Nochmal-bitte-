import React, { useState } from 'react';
import { Cloud, Download, Loader2, Upload } from 'lucide-react';
import { AppStateSnapshot } from '../../types';
import { DESIGN_TOKENS } from '../../config/designTokens';
import {
  CloudSyncConfig,
  loadCloudConfig,
  pullStateFromCloud,
  pushStateToCloud,
  saveCloudConfig
} from '../../services/cloudSyncAndPush';

interface CloudSyncPanelProps {
  fullState?: AppStateSnapshot;
  onReplaceFullStateFromCloud?: (snapshot: AppStateSnapshot) => void;
  onNotify: (msg: string) => void;
  accentColor?: string;
}

/**
 * Geteilte Cloud-Sync-Komponente für Zentrale Bereich 5 und DeepResearchAndAuditModal.
 */
export const CloudSyncPanel: React.FC<CloudSyncPanelProps> = ({
  fullState,
  onReplaceFullStateFromCloud,
  onNotify,
  accentColor = DESIGN_TOKENS.projectPresets.pizzaBandit
}) => {
  const [cloudCfg, setCloudCfg] = useState<CloudSyncConfig>(loadCloudConfig);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  return (
    <div className="p-3.5 rounded-2xl bg-[#242930] border border-white/5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs font-bold text-[#F1F5F9] flex items-center gap-2 min-w-0">
          <Cloud className="w-4 h-4 text-[#14B8A6] shrink-0" />
          <span className="break-words">Echtzeit-Cloud-Sync (Galaxy Z Flip 7 &lt;-&gt; PC)</span>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = {
              ...cloudCfg,
              enabled: !cloudCfg.enabled,
              autoSyncOnChange: !cloudCfg.enabled
            };
            setCloudCfg(next);
            saveCloudConfig(next);
            onNotify(next.enabled ? 'Cloud-Sync aktiviert.' : 'Cloud-Sync deaktiviert.');
          }}
          className="min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold text-white active:scale-95 transition cursor-pointer shrink-0"
          style={{
            backgroundColor: cloudCfg.enabled ? accentColor : '#374151'
          }}
        >
          {cloudCfg.enabled ? 'Aktiv' : 'Aus'}
        </button>
      </div>

      <div className="space-y-2">
        <div className="space-y-1">
          <label className="text-xs text-[#94A3B8] block">Cloud-Endpunkt REST-URL:</label>
          <input
            type="text"
            value={cloudCfg.endpointUrl}
            onChange={(e) => {
              const next = { ...cloudCfg, endpointUrl: e.target.value };
              setCloudCfg(next);
              saveCloudConfig(next);
            }}
            placeholder="https://sync.example.com/api/v1/sync oder Firebase .json"
            className="w-full min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono bg-[#181A1B] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-[#94A3B8] block">Cloud API-Key / Auth-Token (optional):</label>
          <input
            type="password"
            value={cloudCfg.apiKeyOrToken}
            onChange={(e) => {
              const next = { ...cloudCfg, apiKeyOrToken: e.target.value };
              setCloudCfg(next);
              saveCloudConfig(next);
            }}
            placeholder="ws_bandit_geheim oder Bearer-Token..."
            className="w-full min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono bg-[#181A1B] text-[#F1F5F9] border border-white/10 focus:outline-none focus:border-[#14B8A6]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          disabled={isSyncingCloud}
          onClick={async () => {
            if (!fullState) {
              onNotify('Kein Status zum Senden vorhanden.');
              return;
            }
            setIsSyncingCloud(true);
            const res = await pushStateToCloud(fullState);
            setIsSyncingCloud(false);
            setCloudCfg(loadCloudConfig());
            onNotify(res.message);
          }}
          className="min-h-[44px] min-w-0 py-2.5 px-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
          style={{ backgroundColor: accentColor }}
        >
          {isSyncingCloud ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : (
            <Upload className="w-4 h-4 shrink-0" />
          )}
          <span className="break-words">Jetzt hochladen</span>
        </button>

        <button
          type="button"
          disabled={isSyncingCloud}
          onClick={async () => {
            setIsSyncingCloud(true);
            const res = await pullStateFromCloud();
            setIsSyncingCloud(false);
            setCloudCfg(loadCloudConfig());
            if (res.ok && res.snapshot && onReplaceFullStateFromCloud) {
              onReplaceFullStateFromCloud(res.snapshot);
            }
            onNotify(res.message);
          }}
          className="min-h-[44px] min-w-0 py-2.5 px-2.5 rounded-xl text-xs font-bold bg-[#181A1B] text-[#14B8A6] border border-[#14B8A6]/40 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
        >
          {isSyncingCloud ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : (
            <Download className="w-4 h-4 shrink-0" />
          )}
          <span className="break-words">Jetzt herunterladen</span>
        </button>
      </div>

      {cloudCfg.lastSyncedAt && (
        <div className="text-xs text-[#94A3B8] text-center font-mono pt-1 break-words">
          Zuletzt synchronisiert: {cloudCfg.lastSyncedAt}
        </div>
      )}
    </div>
  );
};
