import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dashmeals.android',
  appName: 'DashMeals',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      resize: 'body',
    },
  },
};

export default config;
