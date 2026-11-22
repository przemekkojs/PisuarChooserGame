# Budowanie wersji Android (Capacitor 6)

## Stan
- Projekt Android wygenerowany (`apps/game/android`, Capacitor 6.2.3, AGP 8.2.1, Gradle 8.2.1, `compileSdk`/`targetSdk` 34, `minSdk` 22).
- `npm run build:android -w @pisuar/game` działa (vite build + `cap sync android`).
- **Debug APK jeszcze NIE zbudowany**: na tej maszynie brakuje komponentów SDK wymaganych przez AGP 8.2.1 (zob. „Wymagania”). Gradle sam ich nie instaluje w ramach tego zadania — trzeba je doinstalować ręcznie.

## Wymagania
- Node 24 / npm 11 (`npm install` w katalogu głównym repo).
- JDK 17 (sprawdzone: 17.0.1, `D:\Program Files\OpenJDK17\jdk-17.0.1`), `JAVA_HOME` wskazuje na niego. Capacitor 6 / AGP 8.2.1 działają na JDK 17; Capacitor 7+ wymaga JDK 21, dlatego wersje przypięte do 6.x. Nie używać starej Javy 8 z `PATH`.
- `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk`.
- Komponenty SDK:
  - **`platforms;android-34`** — BRAK, wymagany (`compileSdk 34`). Zainstalowana `android-37.0` nie wystarcza: AGP 8.2.1 nie rozumie nowego formatu wersji (`Unsupported value: android-37.0`, a przy `compileSdk 37`: `Failed to find target with hash string 'android-37'`).
  - **`build-tools;34.0.0`** — BRAK, domyślna wersja dla AGP 8.2.1 (zainstalowane jest 36.0.0).
  - `platform-tools` (adb) — jest.
  - Instalacja (ręcznie, przez użytkownika):
    ```
    "%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat" "platforms;android-34" "build-tools;34.0.0"
    ```
- **Avast (skanowanie HTTPS)**: Avast podmienia certyfikaty TLS („Avast Web/Mail Shield Root”), a magazyn `cacerts` JDK mu nie ufa → Gradle kończy się błędem `PKIX path building failed`. `-Djavax.net.ssl.trustStoreType=Windows-ROOT` pomaga tylko przy pobieraniu wrappera, nie dla klienta HTTP Gradle. Działające obejście (bez zmian systemowych): kopia `cacerts` z dodanym certyfikatem Avasta, przekazana przez `JAVA_TOOL_OPTIONS` (PowerShell):
  ```powershell
  $dir = "$env:USERPROFILE\.android-build"; New-Item -ItemType Directory -Force $dir | Out-Null
  $c = Get-ChildItem Cert:\CurrentUser\Root | Where-Object { $_.Subject -like '*Avast Web/Mail Shield Root*' } | Select-Object -First 1
  Export-Certificate -Cert $c -FilePath "$dir\avast-root.cer" -Type CERT | Out-Null
  Copy-Item "$env:JAVA_HOME\lib\security\cacerts" "$dir\cacerts-avast.jks"
  & "$env:JAVA_HOME\bin\keytool.exe" -importcert -noprompt -alias avast-web-shield-root -file "$dir\avast-root.cer" -keystore "$dir\cacerts-avast.jks" -storepass changeit
  # w każdej sesji przed budowaniem:
  $env:JAVA_TOOL_OPTIONS = "-Djavax.net.ssl.trustStore=$dir\cacerts-avast.jks -Djavax.net.ssl.trustStorePassword=changeit"
  ```
  Alternatywa: wyłączyć w Avaście skanowanie HTTPS. Po aktualizacji JDK trzeba odtworzyć kopię `cacerts`.

## Polecenia
Z katalogu głównego repo (PowerShell, z ustawionymi `JAVA_HOME`, `ANDROID_HOME` i — przy Avaście — `JAVA_TOOL_OPTIONS`):
```powershell
npm install
npm run build:android -w @pisuar/game   # vite build + cap sync android  (DZIAŁA)
npm run apk -w @pisuar/game             # build:android, potem android\gradlew.bat assembleDebug
```
Sprawdzone ręcznie: `apps\game\android\gradlew.bat assembleDebug` — pobranie Gradle 8.2.1 i zależności Maven działa (z obejściem Avasta), build zatrzymuje się na brakującej platformie SDK (patrz wyżej). Po doinstalowaniu `platforms;android-34` i `build-tools;34.0.0` powinien przejść — **nie sprawdzone**.

Wynik (oczekiwany): `apps/game/android/app/build/outputs/apk/debug/app-debug.apk`.

## Instalacja APK na telefonie (ręcznie)
1. Na telefonie: Opcje programisty → Debugowanie USB; po podłączeniu zaakceptować klucz RSA komputera (obecnie `adb devices` pokazuje urządzenie jako `unauthorized`).
2. `adb install -r apps\game\android\app\build\outputs\apk\debug\app-debug.apk`

## Konfiguracja aplikacji
- `apps/game/capacitor.config.ts`: `appId: 'com.pisuar.chooser'` — **PLACEHOLDER, do potwierdzenia przed pierwszym wysłaniem do Google Play** (później nie da się go zmienić — inny identyfikator = nowa aplikacja), `appName: 'Pisuar Chooser'`, `webDir: 'dist'`.
- `AndroidManifest.xml`: `android:screenOrientation="landscape"` (gra 1920×1080, tryb poziomy).
- `styles.xml`: motywy `AppTheme.NoActionBar` i `AppTheme.NoActionBarLaunch` z `android:windowFullscreen=true` (ukryty pasek stanu; pasek nawigacji systemu zostaje — pełny tryb immersive wymagałby kodu w `MainActivity`).
- Zapis: na urządzeniu `@capacitor/preferences` (`src/nativeStorage.ts`, `capacitorBackend`), w przeglądarce `localStorage`.
- Schowanie aplikacji: `visibilitychange` oraz na Androidzie `App.addListener('appStateChange')` → porzucenie przebiegu i ekran startowy (`src/lifecycle.ts`, jeden handler w `GameScene`). Przycisk Wstecz: domyślnie zamyka aplikację (spec: bez pauzy, świeża gra po ponownym uruchomieniu).

## Znane ostrzeżenia
- Vite: główny chunk ~1,5 MB (Phaser) — limit ostrzeżenia podniesiony w `vite.config.ts`.
- Gradle: `Using flatDir should be avoided` (szablon Capacitora, nieszkodliwe).
- `This version only understands SDK XML versions up to 3 but an SDK XML file of version 4 was encountered` — SDK nowsze niż AGP 8.2.1, nieszkodliwe dla platformy 34.
- Google Play wymaga obecnie wyższego `targetSdk` niż 34 dla nowych aplikacji — przed publikacją (etap 7 / wydanie) trzeba podnieść `targetSdk` (prawdopodobnie razem z AGP/Capacitorem, co może wymagać JDK 21).
