import 'react-native-gesture-handler';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme, View, ActivityIndicator, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Screens
import NoticesScreen from './src/screens/NoticesScreen';
import LostFoundScreen from './src/screens/LostFoundScreen';
import StudyGroupsScreen from './src/screens/StudyGroupsScreen';
import ResourcesScreen from './src/screens/ResourcesScreen';
import EventsScreen from './src/screens/EventsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LoginScreen from './src/screens/LoginScreen';
import GetStartedScreen from './src/screens/GetStartedScreen';
import SignupScreen from './src/screens/SignupScreen';
import ReportFoundScreen from './src/screens/ReportFoundScreen';
import UploadResourceScreen from './src/screens/UploadResourceScreen';
import ProfileEditScreen from './src/screens/ProfileEditScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

function MainDrawer() {
  const { signOut } = useAuth();
  const CustomDrawerContent = (props: any) => (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1, paddingBottom: 12 }}>
      <DrawerItemList {...props} />
      <View style={{ flex: 1 }} />
      <View style={{ padding: 12 }}>
        <TouchableOpacity style={styles.drawerLogout} onPress={() => signOut()}>
          <Text style={{ color: '#ef4444', fontWeight: '700' }}>Logout</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );

  return (
    <Drawer.Navigator
      initialRouteName="Notices"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: '#0b1220' },
        headerTintColor: '#fff',
        drawerActiveBackgroundColor: '#16233a',
        drawerActiveTintColor: '#dbe5ff',
        drawerInactiveTintColor: '#c8d0e0',
      }}
    >
      <Drawer.Screen name="Notices" component={NoticesScreen} options={{ drawerIcon: ({ color, size }) => (<Ionicons name="notifications-outline" color={color} size={size} />) }} />
      <Drawer.Screen name="Lost & Found" component={LostFoundScreen} options={{ drawerIcon: ({ color, size }) => (<Ionicons name="search-outline" color={color} size={size} />) }} />
      <Drawer.Screen name="Study Groups" component={StudyGroupsScreen} options={{ drawerIcon: ({ color, size }) => (<Ionicons name="people-outline" color={color} size={size} />) }} />
      <Drawer.Screen name="Resources" component={ResourcesScreen} options={{ drawerIcon: ({ color, size }) => (<Ionicons name="folder-outline" color={color} size={size} />) }} />
      <Drawer.Screen name="Events" component={EventsScreen} options={{ drawerIcon: ({ color, size }) => (<Ionicons name="calendar-outline" color={color} size={size} />) }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ drawerIcon: ({ color, size }) => (<Ionicons name="settings-outline" color={color} size={size} />) }} />
    </Drawer.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="GetStarted" component={GetStartedScreen} />
    </Stack.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainDrawer} />
      <Stack.Screen name="ReportFound" component={ReportFoundScreen} options={{ headerShown: true, title: 'Report Lost/Found Item', headerStyle: { backgroundColor: '#0b1220' }, headerTintColor: '#fff' }} />
      <Stack.Screen name="UploadResource" component={UploadResourceScreen} options={{ headerShown: true, title: 'Upload Resource', headerStyle: { backgroundColor: '#0b1220' }, headerTintColor: '#fff' }} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} options={{ headerShown: true, title: 'Edit Profile', headerStyle: { backgroundColor: '#0b1220' }, headerTintColor: '#fff' }} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { email, isLoading } = useAuth();
  const scheme = useColorScheme();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b5bfd" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {email ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  drawerLogout: { backgroundColor: '#ffeef0', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
});
