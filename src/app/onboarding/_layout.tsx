import { Stack } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';

export const unstable_settings = { anchor: 'index' };

export default function OnboardingLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
