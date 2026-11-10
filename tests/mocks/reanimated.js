/* Mock mínimo de Reanimated para pruebas de componentes (sin animaciones). */
const { View, Text, Image, ScrollView } = require('react-native');
const chain = () => new Proxy(function () {}, { get: () => chain(), apply: () => chain() });
const Animated = {
  View, Text, Image, ScrollView,
  createAnimatedComponent: (c) => c,
};
module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  useSharedValue: (v) => ({ value: v }),
  useAnimatedStyle: (fn) => fn(),
  useAnimatedProps: (fn) => fn(),
  withTiming: (v) => v,
  withSpring: (v) => v,
  withRepeat: (v) => v,
  withSequence: (...v) => v[v.length - 1],
  Easing: { out: () => () => 0, cubic: () => 0 },
  FadeIn: chain(), FadeOut: chain(), FadeInUp: chain(), FadeOutUp: chain(), FadeInDown: chain(), FadeInRight: chain(),
  SlideInDown: chain(), SlideOutDown: chain(), ZoomIn: chain(), LinearTransition: chain(),
};
