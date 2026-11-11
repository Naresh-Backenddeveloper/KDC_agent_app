/* global jest */
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const passthrough = (v) => v;
  const animation = { duration: () => animation };
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c) => c },
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => false,
    FadeInUp: { duration: () => undefined },
    FadeOutUp: { duration: () => undefined },
    withTiming: passthrough,
    withRepeat: passthrough,
    interpolate: () => 0,
    Easing: { bezier: () => passthrough, linear: passthrough },
    SlideInDown: { duration: () => undefined },
  };
});
jest.mock('react-native-worklets', () => ({}));
jest.mock('react-native-camera-kit', () => {
  const { View } = require('react-native');
  return { Camera: View, CameraType: { Back: 'back', Front: 'front' } };
});
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));
jest.mock('react-native-qrcode-svg', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View };
});
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('react-native-nitro-modules', () => ({ NitroModules: {} }));
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return { GestureHandlerRootView: View };
});
jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => (name === '__esModule' ? true : () => null) }));
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return new Proxy({ __esModule: true, default: View }, { get: (t, name) => (name in t ? t[name] : View) });
});
