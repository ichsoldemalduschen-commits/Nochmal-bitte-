import React from 'react';
import {
  CompanionChatSheet,
  CompanionStageOne,
  ConversationMessage,
  useVoiceSession,
  VoiceModalProps,
  VoicePhase
} from './companion';

export type { ConversationMessage, VoiceModalProps, VoicePhase };

export const VoiceModal: React.FC<VoiceModalProps> = (props) => {
  const session = useVoiceSession(props);

  if (!props.open) return null;

  if (session.currentStage === 1) {
    return (
      <CompanionStageOne
        activeProjectName={props.activeProjectName}
        resolvedProjectId={session.resolvedProjectId}
        userApiKey={props.userApiKey}
        offlineAudioBufferEnabled={props.offlineAudioBufferEnabled !== false}
        effectiveOfflineMemos={session.effectiveOfflineMemos}
        onSaveOfflineMemos={session.handleSaveOfflineMemos}
        projectColor={session.projectColor}
        accentColor={session.accentColor}
        glowColor={session.glowColor}
        silenceLineColor={session.silenceLineColor}
        progressPercent={session.progressPercent}
        hasSpokenText={session.hasSpokenText}
        transcript={session.transcript}
        isListening={session.isListening}
        isProcessing={session.isProcessing}
        isSpeaking={session.isSpeaking}
        isCooldown={session.isCooldown}
        showSlowThinkingNotice={session.showSlowThinkingNotice}
        wakeLockActive={session.wakeLockActive}
        shareIntakeNotice={session.shareIntakeNotice}
        voiceStatusNotice={session.voiceStatusNotice}
        showStage1TextInput={session.showStage1TextInput}
        lastAssistantMsg={session.lastAssistantMsg}
        lastAction={session.lastAction}
        canUndoLastAction={Boolean(
          session.lastAction &&
            !session.lastAction.undone &&
            session.lastAssistantMsg?.logId &&
            props.onUndoAiAction
        )}
        onUpdateStage={session.updateStage}
        onManualMicToggle={session.handleManualMicToggle}
        onToggleStage1TextInput={session.handleToggleStage1TextInput}
        onOpenQuickFan={props.onOpenQuickFan}
        onUndoLastAction={() => {
          if (session.lastAssistantMsg?.logId && session.lastAction) {
            session.handleUndoAction(
              session.lastAssistantMsg.id,
              session.lastAssistantMsg.logId,
              session.lastAction.actionId
            );
          }
        }}
        onTranscriptChange={session.handleTranscriptChange}
        onSubmitTranscript={session.handleSubmitTranscript}
        onTouchStartY={session.handleStage1TouchStart}
        onTouchEndY={session.handleStage1TouchEnd}
      />
    );
  }

  return (
    <CompanionChatSheet
      activeProjectName={props.activeProjectName}
      activeProjects={session.activeProjects}
      resolvedProjectId={session.resolvedProjectId}
      userApiKey={props.userApiKey}
      offlineAudioBufferEnabled={props.offlineAudioBufferEnabled !== false}
      effectiveOfflineMemos={session.effectiveOfflineMemos}
      onSaveOfflineMemos={session.handleSaveOfflineMemos}
      messages={session.messages}
      transcript={session.transcript}
      attachment={session.attachment}
      hasSpokenText={session.hasSpokenText}
      isListening={session.isListening}
      isProcessing={session.isProcessing}
      isSpeaking={session.isSpeaking}
      showSlowThinkingNotice={session.showSlowThinkingNotice}
      wakeLockActive={session.wakeLockActive}
      aiMode={session.aiMode}
      ttsActive={session.ttsActive}
      upscaleNotice={session.upscaleNotice}
      shareIntakeNotice={session.shareIntakeNotice}
      voiceStatusNotice={session.voiceStatusNotice}
      speechNotice={session.speechNotice}
      quickCommands={session.prefs.quickCommands}
      organicMotion={Boolean(session.prefs.organicMotion)}
      messageToolsEnabled={session.messageToolsEnabled}
      quickChipsEnabled={session.quickChipsEnabled}
      projectColor={session.projectColor}
      progressPercent={session.progressPercent}
      silenceLineColor={session.silenceLineColor}
      scrollEndRef={session.scrollEndRef}
      onUpdateStage={session.updateStage}
      onHeaderTouchStart={session.handleHeaderTouchStart}
      onHeaderTouchEnd={session.handleHeaderTouchEnd}
      onToggleAiMode={session.handleToggleAiMode}
      onToggleTts={session.handleToggleTts}
      onClearMessages={session.handleClearMessages}
      onSubmitTranscript={session.handleSubmitTranscript}
      onFileUpload={session.handleFileUpload}
      onClearAttachment={session.clearAttachment}
      onTranscriptChange={session.handleTranscriptChange}
      onManualMicToggle={session.handleManualMicToggle}
      onJumpToAction={props.onJumpToAction}
      onMoveAiAction={props.onMoveAiAction}
      onUndoAction={session.handleUndoAction}
      hasUndoHandler={Boolean(props.onUndoAiAction)}
      onRetryMessage={session.handleRetryMessage}
      onParkAsNote={session.handleParkMessageAsNote}
      onSaveAsInfo={session.handleSaveMessageAsInfo}
      onSpeakMessage={session.speakAssistantMessage}
      onEditPrompt={session.loadPromptIntoComposer}
      onReprocessPrompt={(promptText, mode) =>
        session.reprocessPrompt(promptText, mode ? { mode } : undefined)
      }
      onExportChatTranscript={session.exportChatTranscript}
      onSaveChatAsKnowledge={session.saveChatAsProjectKnowledge}
    />
  );
};
