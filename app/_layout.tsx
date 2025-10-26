import { Stack } from 'expo-router';
import { Image } from 'react-native';
import DisclaimerModal from './disclaimer_modal';

export default function Layout() {
  return (
    <>
      <Stack>
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: true,
            headerTitle: () => (
              <Image
                source={require('../assets/images/gaitaware_header_text.png')}
                style={{ width: 140, height: 36 }}
                resizeMode="contain"
              />
            ),
            headerTitleAlign: 'center',
            headerStyle: { backgroundColor: '#fff' },
          }} 
        />
      </Stack>

      {/* Render the modal outside the Stack so it's not treated as a Screen child */}
      <DisclaimerModal />
    </>
  );
}