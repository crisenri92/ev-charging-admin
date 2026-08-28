# Configuración de App Nativa (Capacitor)

## Prerequisitos
```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android @capacitor/push-notifications @capacitor/splash-screen
npx cap init
```

## Build y plataformas
```bash
# Build Next.js como static export
# En next.config.js agregar: output: 'export'
npm run build

# Agregar plataformas
npx cap add ios
npx cap add android

# Sincronizar web assets
npx cap sync

# Abrir en Xcode / Android Studio
npx cap open ios
npx cap open android
```

## Notas importantes
- El `capacitor.config.ts` apunta a la URL de Railway en `server.url`
- Esto permite usar la PWA existente sin necesidad de static export
- Para distribución en App Store necesitarás certificados Apple Developer
- Para Play Store necesitarás cuenta Google Play Console

## Push Notifications
- iOS: Requiere certificado APNs en Apple Developer portal
- Android: Requiere Firebase project y google-services.json

## Íconos y Splash Screen
- Genera íconos con: `npx @capacitor/assets generate`
- Coloca un logo 1024x1024px en `resources/icon.png`
- Splash screen 2732x2732px en `resources/splash.png`
