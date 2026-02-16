import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Card, Text, useTheme, Surface } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { Users, GraduationCap, Calendar, Award } from 'lucide-react-native';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

const DashboardScreen = () => {
  const [stats, setStats] = useState({
    totalCadets: 0,
    activeCadets: 0,
    trainingDays: 0,
    avgGrade: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const theme = useTheme();

  const fetchStats = async () => {
    try {
      const [cadetsRes, gradesRes, daysRes] = await Promise.all([
        client.get('/api/admin/cadets'),
        client.get('/api/admin/grades'),
        client.get('/api/attendance/days'),
      ]);

      const cadets = cadetsRes.data || [];
      const grades = gradesRes.data || [];
      const days = daysRes.data || [];

      const activeCadets = cadets.filter(c => !['DO', 'T'].includes(c.status)).length;
      
      // Calculate average final grade
      const validGrades = grades.filter(g => g.final_grade && g.final_grade > 0);
      const avgGrade = validGrades.length > 0
        ? validGrades.reduce((sum, g) => sum + g.final_grade, 0) / validGrades.length
        : 0;

      setStats({
        totalCadets: cadets.length,
        activeCadets,
        trainingDays: days.length,
        avgGrade: avgGrade.toFixed(2),
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  if (loading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  const StatCard = ({ icon: Icon, title, value, color, subtitle }) => (
    <Card style={styles.statCard}>
      <Card.Content style={styles.statContent}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <Icon size={28} color={color} />
        </View>
        <Text variant="headlineMedium" style={styles.statValue}>
          {value}
        </Text>
        <Text variant="bodyMedium" style={styles.statTitle}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="bodySmall" style={styles.statSubtitle}>
            {subtitle}
          </Text>
        )}
      </Card.Content>
    </Card>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Surface style={styles.header} elevation={0}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Dashboard
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          ROTC Grading Management Overview
        </Text>
      </Surface>

      <View style={styles.statsGrid}>
        <StatCard
          icon={Users}
          title="Total Cadets"
          value={stats.totalCadets}
          color={theme.colors.primary}
        />
        <StatCard
          icon={GraduationCap}
          title="Active Cadets"
          value={stats.activeCadets}
          color="#4caf50"
        />
        <StatCard
          icon={Calendar}
          title="Training Days"
          value={stats.trainingDays}
          color="#ff9800"
        />
        <StatCard
          icon={Award}
          title="Avg Grade"
          value={stats.avgGrade}
          color="#9c27b0"
          subtitle="Final Grade"
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#666',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    marginBottom: 16,
    borderRadius: 12,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontWeight: 'bold',
  },
  statTitle: {
    color: '#666',
    marginTop: 4,
  },
  statSubtitle: {
    color: '#999',
    marginTop: 2,
  },
});

export default DashboardScreen;
