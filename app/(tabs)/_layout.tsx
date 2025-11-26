import FontAwesome from "@expo/vector-icons/FontAwesome";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

const DISCLAIMER_KEY = "gaitaware:disclaimer_accepted";

export default function TabLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasAcceptedDisclaimer, setHasAcceptedDisclaimer] = useState(false);

  useEffect(() => {
    checkDisclaimerStatus();
  }, []);

  const checkDisclaimerStatus = async () => {
    try {
      const accepted = await AsyncStorage.getItem(DISCLAIMER_KEY);
      setHasAcceptedDisclaimer(accepted === "true");
    } catch (error) {
      console.error("Failed to check disclaimer status:", error);
      setHasAcceptedDisclaimer(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading spinner while checking disclaimer status
  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Redirect to disclaimer if not accepted
  if (!hasAcceptedDisclaimer) {
    return <Redirect href="/disclaimer" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "darkblue",
        tabBarStyle: {
          height: 72,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 12 },
        tabBarIconStyle: { marginTop: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: "Home",
          tabBarIcon: ({ color }) => (
            <FontAwesome size={28} name="home" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="glossary"
        options={{
          headerShown: false,
          title: "Glossary",
          tabBarIcon: ({ color }) => (
            <FontAwesome size={28} name="book" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          headerShown: false,
          title: "History",
          tabBarIcon: ({ color }) => (
            <FontAwesome size={28} name="history" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
