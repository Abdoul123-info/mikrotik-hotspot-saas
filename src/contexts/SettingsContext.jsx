import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

const DEFAULT_SETTINGS = {
  appName: 'MikroTik Hotspot Manager',
  currencySymbol: 'FCFA',
  currencyPosition: 'after', // 'before' or 'after'
  language: 'FR',
  ticketFooter: 'Merci de votre visite !',
  businessName: 'Mon Entreprise Hotspot',
  businessAddress: '123 Avenue de la Liberté, Niamey',
  logoBase64: null,
  darkMode: true
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('hspot_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('hspot_settings', JSON.stringify(settings));
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  const updateSettings = (newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const toggleDarkMode = () => {
    setSettings(prev => ({ ...prev, darkMode: !prev.darkMode }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, toggleDarkMode }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
