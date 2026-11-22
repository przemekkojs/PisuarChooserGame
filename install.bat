npm run apk -w @pisuar/game
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r apps\game\android\app\build\outputs\apk\debug\app-debug.apk