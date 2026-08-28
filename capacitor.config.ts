import type { CapacitorConfig } from '@capacitor/core'

const config: CapacitorConfig = {
  appId: 'com.evcharging.app',
  appName: 'EV Charging',
  webDir: 'out',
  server: {
    // Use live URL during development so you don't need to rebuild native
    url: 'https://ev-charging-admin-production.up.railway.app/mobile',
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#111827',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#111827',
  },
}

export default config
