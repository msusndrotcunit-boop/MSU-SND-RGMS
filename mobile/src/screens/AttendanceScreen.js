import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, Surface, Card, Button, SegmentedButtons, Chip, Menu, Divider } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar, Check, X, Clock, FileText } from 'lucide-react-native';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

const AttendanceScreen = () => {
  const [trainingDays, setTrainingDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchTrainingDays = async () => {
    try {
      const response = await client.get('/api/attendance/days');
      const days = response.data || [];
      setTrainingDays(days);
      if (days.length > 0 && !selectedDay) {
        setSelectedDay(days[0]);
        fetchRecords(days[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch training days:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchRecords = async (dayId) => {
    setLoadingRecords(true);
    try {
      const response = await client.get(`/api/attendance/records/${dayId}`);
      setRecords(response.data || []);
    } catch (error) {
      console.error('Failed to fetch attendance records:', error);
    } finally {
      setLoadingRecords(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTrainingDays();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchTrainingDays();
  };

  const onDaySelect = (day) => {
    setSelectedDay(day);
    fetchRecords(day.id);
  };

  const updateStatus = (cadetId, newStatus) => {
    setRecords((prev) =>
      prev.map((r) =>
        r.cadet_id === cadetId ? { ...r, status: newStatus } : r
      )
    );
  };

  const saveAttendance = async () => {
    if (!selectedDay) return;

    setSaving(true);
    try {
      await client.post('/api/attendance/records', {
        training_day_id: selectedDay.id,
        records: records.map((r) => ({
          cadet_id: r.cadet_id,
          status: r.status || 'absent',
        })),
      });
      Alert.alert('Success', 'Attendance saved successfully');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present':
        return '#4caf50';
      case 'late':
        return '#ff9800';
      case 'excused':
        return '#2196f3';
      default:
        return '#f44336';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'present':
        return Check;
      case 'late':
        return Clock;
      case 'excused':
        return FileText;
      default:
        return X;
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading attendance..." />;
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderRecord = ({ item }) => {
    const fullName = [item.rank, item.first_name, item.last_name].filter(Boolean).join(' ');
    const StatusIcon = getStatusIcon(item.status);

    return (
      <Card style={styles.recordCard}>
        <Card.Content style={styles.recordContent}>
          <View style={styles.recordInfo}>
            <Text variant="titleMedium" numberOfLines={1}>
              {fullName}
            </Text>
            <Text variant="bodySmall" style={styles.studentId}>
              {item.student_id}
            </Text>
          </View>
          <View style={styles.statusButtons}>
            {['present', 'late', 'absent', 'excused'].map((status) => (
              <Chip
                key={status}
                selected={item.status === status}
                onPress={() => updateStatus(item.cadet_id, status)}
                style={[
                  styles.statusChip,
                  item.status === status && { backgroundColor: getStatusColor(status) },
                ]}
                textStyle={item.status === status ? styles.selectedChipText : {}}
                compact
              >
                {status.charAt(0).toUpperCase()}
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>
    );
  };

  const presentCount = records.filter((r) => r.status === 'present').length;
  const lateCount = records.filter((r) => r.status === 'late').length;
  const absentCount = records.filter((r) => r.status === 'absent' || !r.status).length;
  const excusedCount = records.filter((r) => r.status === 'excused').length;

  return (
    <View style={styles.container}>
      {/* Training Days Selector */}
      <Surface style={styles.header} elevation={1}>
        <Text variant="titleMedium" style={styles.headerTitle}>
          Select Training Day
        </Text>
        <FlatList
          horizontal
          data={trainingDays}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <Chip
              selected={selectedDay?.id === item.id}
              onPress={() => onDaySelect(item)}
              style={styles.dayChip}
              icon={() => <Calendar size={16} color={selectedDay?.id === item.id ? '#fff' : '#666'} />}
            >
              {formatDate(item.date)}
            </Chip>
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daysContainer}
        />
      </Surface>

      {/* Summary Stats */}
      {selectedDay && (
        <Surface style={styles.summary} elevation={0}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#4caf50' }]}>{presentCount}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#ff9800' }]}>{lateCount}</Text>
            <Text style={styles.statLabel}>Late</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#f44336' }]}>{absentCount}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#2196f3' }]}>{excusedCount}</Text>
            <Text style={styles.statLabel}>Excused</Text>
          </View>
        </Surface>
      )}

      {/* Records List */}
      {loadingRecords ? (
        <LoadingSpinner message="Loading records..." />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.cadet_id?.toString() || item.student_id}
          renderItem={renderRecord}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text variant="bodyLarge" style={styles.emptyText}>
                {trainingDays.length === 0
                  ? 'No training days created yet'
                  : 'No cadets found'}
              </Text>
            </View>
          }
        />
      )}

      {/* Save Button */}
      {selectedDay && records.length > 0 && (
        <Surface style={styles.footer} elevation={4}>
          <Button
            mode="contained"
            onPress={saveAttendance}
            loading={saving}
            disabled={saving}
            style={styles.saveButton}
          >
            Save Attendance
          </Button>
        </Surface>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
  },
  headerTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  daysContainer: {
    paddingVertical: 4,
  },
  dayChip: {
    marginRight: 8,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  recordCard: {
    marginBottom: 8,
    borderRadius: 8,
  },
  recordContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordInfo: {
    flex: 1,
  },
  studentId: {
    color: '#666',
  },
  statusButtons: {
    flexDirection: 'row',
  },
  statusChip: {
    marginLeft: 4,
  },
  selectedChipText: {
    color: '#fff',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#666',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#fff',
  },
  saveButton: {
    borderRadius: 8,
  },
});

export default AttendanceScreen;
