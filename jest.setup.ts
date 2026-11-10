/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()), notificationAsync: jest.fn(() => Promise.resolve()), NotificationFeedbackType: {} }));
jest.mock('react-native-reanimated', () => require('./tests/mocks/reanimated'));
