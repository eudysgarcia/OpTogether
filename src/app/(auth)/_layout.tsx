import { Stack } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';

export const unstable_settings = { anchor: 'sign-in' };

export default function AuthLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
