import './global.css';
import React from 'react';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ToastHost } from './src/components/ui/ToastHost';
import { DeviceFrame } from './src/components/ui/DeviceFrame';
import { HeadsUpBanner, OfflineOverlay } from './src/components/agent';

// Raised by NativeWind's interop touching a deprecated React Native export.
LogBox.ignoreLogs([
  'ImageBackground is deprecated',
  'Sending `onAnimatedValueUpdate`',
  '[Reanimated] Dependencies should only be used',
  // Shown when the device has Reduce motion turned on.
  '[Reanimated] Reduced motion setting',
]);

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DeviceFrame>
          <RootNavigator />
          <HeadsUpBanner />
          <ToastHost />
          <OfflineOverlay />
        </DeviceFrame>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
