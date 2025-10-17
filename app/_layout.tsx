import { Stack } from 'expo-router';
import { Image } from 'react-native';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen 
        name="(tabs)" 
        options={{ 
          headerShown: true,
          headerTitle: () => (
            <Image
              source={require('../assets/images/gaitaware_header_text.png')}
              style={{ width: 140, height: 36, resizeMode: 'contain' }}
            />
          ),
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#fff', height: 88 },
        }} 
      />
    </Stack>
  );
}