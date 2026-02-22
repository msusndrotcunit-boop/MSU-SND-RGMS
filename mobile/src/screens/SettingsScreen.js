import React from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { Surface, Text, Card, Button, List, Divider, Avatar } from 'react-native-paper';
import { LogOut, User, Globe, Info, Shield } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

const SettingsScreen = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const openWebApp = () => {
    Linking.openURL('http://localhost:8000');
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profile Section */}
      <Surface style={styles.profileSection} elevation={2}>
        <Avatar.Icon size={80} icon="account" style={styles.avatar} />
        <Text variant="headlineSmall" style={styles.username}>
          {user?.username || 'Admin'}
        </Text>
        <Text variant="bodyMedium" style={styles.role}>
          Administrator
        </Text>
      </Surface>

      {/* Account Card */}
      <Card style={styles.card}>
        <Card.Title
          title="Account"
          left={(props) => <User {...props} size={24} color="#1976d2" />}
        />
        <Card.Content>
          <List.Item
            title="Username"
            description={user?.username || '-'}
            left={(props) => <List.Icon {...props} icon="account" />}
          />
          <Divider />
          <List.Item
            title="Email"
            description={user?.email || 'Not set'}
            left={(props) => <List.Icon {...props} icon="email" />}
          />
          <Divider />
          <List.Item
            title="Role"
            description="Admin"
            left={(props) => <List.Icon {...props} icon="shield-account" />}
          />
        </Card.Content>
      </Card>

      {/* App Info Card */}
      <Card style={styles.card}>
        <Card.Title
          title="Application"
          left={(props) => <Info {...props} size={24} color="#1976d2" />}
        />
        <Card.Content>
          <List.Item
            title="App Version"
            description="1.0.0"
            left={(props) => <List.Icon {...props} icon="information" />}
          />
          <Divider />
          <List.Item
            title="Open Web App"
            description="Access full features in browser"
            left={(props) => <List.Icon {...props} icon="web" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={openWebApp}
          />
        </Card.Content>
      </Card>

      {/* About Card */}
      <Card style={styles.card}>
        <Card.Title
          title="About"
          left={(props) => <Shield {...props} size={24} color="#1976d2" />}
        />
        <Card.Content>
          <Text variant="bodyMedium" style={styles.aboutText}>
            ROTC Grading Management System - Mobile Admin Portal
          </Text>
          <Text variant="bodySmall" style={styles.aboutSubtext}>
            Manage cadets, grades, and attendance on the go.
          </Text>
        </Card.Content>
      </Card>

      {/* Logout Button */}
      <Button
        mode="contained"
        onPress={handleLogout}
        style={styles.logoutButton}
        buttonColor="#f44336"
        icon={() => <LogOut size={20} color="#fff" />}
      >
        Logout
      </Button>

      <View style={styles.footer}>
        <Text variant="bodySmall" style={styles.footerText}>
          MSU-SND ROTC Unit
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  profileSection: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: '#1976d2',
  },
  username: {
    marginTop: 12,
    fontWeight: 'bold',
  },
  role: {
    color: '#666',
    marginTop: 4,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  aboutText: {
    marginBottom: 8,
  },
  aboutSubtext: {
    color: '#666',
  },
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 8,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    color: '#999',
  },
});

export default SettingsScreen;
