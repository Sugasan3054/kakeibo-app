import { useContext } from 'react';
import { SettingsContext } from '../contexts/SettingsContext';

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return {
    settings: context.settings,
    loading: context.loading,
    inMemoryKey: context.inMemoryKey,
    updateSettings: context.updateSettings,
    setPasscode: context.setPasscode,
    changePasscode: context.changePasscode,
    removePasscode: context.removePasscode,
    reload: context.reloadSettings,
  };
}
