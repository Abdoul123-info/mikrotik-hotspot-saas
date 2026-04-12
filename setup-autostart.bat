@echo off
:: ============================================================
:: HOTSPOT MANAGER - Démarrage automatique Windows
:: À exécuter UNE SEULE FOIS en tant qu'Administrateur
:: ============================================================

echo [SETUP] Configuration du démarrage automatique...

:: Enregistre le chemin pm2
where pm2 > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] pm2 n'est pas installé. Lancez: npm install -g pm2
    pause
    exit /b 1
)

:: Crée une tâche planifiée Windows qui démarre pm2 au démarrage
schtasks /Create /F /SC ONLOGON /TN "HotspotManagerPM2" /TR "cmd /c \"pm2 resurrect\"" /RL HIGHEST /DELAY 0000:30

echo.
echo [OK] Tâche planifiée créée: HotspotManagerPM2
echo [OK] Le serveur démarrera automatiquement à chaque connexion Windows
echo.
echo Votre Dashboard est accessible sur:
echo   - Ce PC    : http://localhost:3001
echo   - Mobile   : http://[VOTRE-IP-LOCALE]:3001
echo.
pause
