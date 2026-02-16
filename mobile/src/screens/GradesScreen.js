import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Searchbar, Text, Surface, Card, Button, TextInput, Portal, Modal } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

const GradesScreen = () => {
  const [grades, setGrades] = useState([]);
  const [filteredGrades, setFilteredGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [prelim, setPrelim] = useState('');
  const [midterm, setMidterm] = useState('');
  const [final, setFinal] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchGrades = async () => {
    try {
      const response = await client.get('/api/admin/grades');
      setGrades(response.data || []);
      applySearch(response.data || [], searchQuery);
    } catch (error) {
      console.error('Failed to fetch grades:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchGrades();
    }, [])
  );

  const applySearch = (data, query) => {
    if (!query) {
      setFilteredGrades(data);
      return;
    }
    const lowerQuery = query.toLowerCase();
    const filtered = data.filter(
      (g) =>
        g.first_name?.toLowerCase().includes(lowerQuery) ||
        g.last_name?.toLowerCase().includes(lowerQuery) ||
        g.student_id?.toLowerCase().includes(lowerQuery)
    );
    setFilteredGrades(filtered);
  };

  const onSearch = (query) => {
    setSearchQuery(query);
    applySearch(grades, query);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchGrades();
  };

  const openEditModal = (grade) => {
    setSelectedGrade(grade);
    setPrelim(grade.prelim_score?.toString() || '0');
    setMidterm(grade.midterm_score?.toString() || '0');
    setFinal(grade.final_score?.toString() || '0');
    setEditModalVisible(true);
  };

  const handleSaveScores = async () => {
    if (!selectedGrade) return;

    const prelimNum = parseFloat(prelim) || 0;
    const midtermNum = parseFloat(midterm) || 0;
    const finalNum = parseFloat(final) || 0;

    if (prelimNum < 0 || prelimNum > 100 || midtermNum < 0 || midtermNum > 100 || finalNum < 0 || finalNum > 100) {
      Alert.alert('Error', 'Scores must be between 0 and 100');
      return;
    }

    setSubmitting(true);
    try {
      await client.put(`/api/admin/grades/${selectedGrade.cadet_id}/scores`, {
        prelim_score: prelimNum,
        midterm_score: midtermNum,
        final_score: finalNum,
      });
      Alert.alert('Success', 'Scores updated successfully');
      setEditModalVisible(false);
      fetchGrades();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to update scores');
    } finally {
      setSubmitting(false);
    }
  };

  const transmute = (grade) => {
    if (!grade || grade < 75) return '5.00';
    if (grade >= 98) return '1.00';
    if (grade >= 95) return '1.25';
    if (grade >= 92) return '1.50';
    if (grade >= 89) return '1.75';
    if (grade >= 86) return '2.00';
    if (grade >= 83) return '2.25';
    if (grade >= 80) return '2.50';
    if (grade >= 77) return '2.75';
    return '3.00';
  };

  if (loading) {
    return <LoadingSpinner message="Loading grades..." />;
  }

  const renderGradeCard = ({ item }) => {
    const fullName = [item.rank, item.first_name, item.last_name].filter(Boolean).join(' ');

    return (
      <Card style={styles.gradeCard}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.nameContainer}>
              <Text variant="titleMedium" style={styles.name}>
                {fullName}
              </Text>
              <Text variant="bodySmall" style={styles.studentId}>
                {item.student_id}
              </Text>
            </View>
            {item.status && ['DO', 'INC', 'T'].includes(item.status) && (
              <Surface style={[styles.statusBadge, { backgroundColor: item.status === 'DO' ? '#f44336' : '#ff9800' }]} elevation={0}>
                <Text style={styles.statusText}>{item.status}</Text>
              </Surface>
            )}
          </View>

          <View style={styles.scoresRow}>
            <ScoreBox label="Prelim" value={item.prelim_score || 0} />
            <ScoreBox label="Midterm" value={item.midterm_score || 0} />
            <ScoreBox label="Final" value={item.final_score || 0} />
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.pointsContainer}>
              <Text variant="bodySmall">Merit: <Text style={styles.meritText}>{item.merit_points || 0}</Text></Text>
              <Text variant="bodySmall">Demerit: <Text style={styles.demeritText}>{item.demerit_points || 0}</Text></Text>
            </View>
            <View style={styles.finalContainer}>
              <Text variant="bodySmall">Final Grade</Text>
              <Text variant="titleLarge" style={styles.finalGrade}>
                {item.final_grade?.toFixed(2) || '-'}
              </Text>
              <Text variant="bodySmall" style={styles.transmuted}>
                ({transmute(item.final_grade)})
              </Text>
            </View>
          </View>
        </Card.Content>
        <Card.Actions>
          <Button mode="outlined" onPress={() => openEditModal(item)}>
            Edit Scores
          </Button>
        </Card.Actions>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Surface style={styles.header} elevation={0}>
        <Searchbar
          placeholder="Search by name or ID..."
          onChangeText={onSearch}
          value={searchQuery}
          style={styles.searchbar}
        />
      </Surface>

      <FlatList
        data={filteredGrades}
        keyExtractor={(item) => item.cadet_id?.toString() || item.student_id}
        renderItem={renderGradeCard}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="bodyLarge" style={styles.emptyText}>No grades found</Text>
          </View>
        }
      />

      <Portal>
        <Modal
          visible={editModalVisible}
          onDismiss={() => setEditModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            Edit Scores
          </Text>
          <Text variant="bodyMedium" style={styles.modalSubtitle}>
            {selectedGrade?.first_name} {selectedGrade?.last_name}
          </Text>
          <TextInput
            label="Prelim Score (0-100)"
            value={prelim}
            onChangeText={setPrelim}
            keyboardType="numeric"
            mode="outlined"
            style={styles.modalInput}
          />
          <TextInput
            label="Midterm Score (0-100)"
            value={midterm}
            onChangeText={setMidterm}
            keyboardType="numeric"
            mode="outlined"
            style={styles.modalInput}
          />
          <TextInput
            label="Final Score (0-100)"
            value={final}
            onChangeText={setFinal}
            keyboardType="numeric"
            mode="outlined"
            style={styles.modalInput}
          />
          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={() => setEditModalVisible(false)}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleSaveScores} loading={submitting} disabled={submitting}>
              Save
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
};

const ScoreBox = ({ label, value }) => (
  <View style={styles.scoreBox}>
    <Text variant="bodySmall" style={styles.scoreLabel}>{label}</Text>
    <Text variant="titleMedium" style={styles.scoreValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchbar: {
    elevation: 0,
    backgroundColor: '#f5f5f5',
  },
  list: {
    padding: 16,
  },
  gradeCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  nameContainer: {
    flex: 1,
  },
  name: {
    fontWeight: '600',
  },
  studentId: {
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  scoreBox: {
    alignItems: 'center',
  },
  scoreLabel: {
    color: '#666',
  },
  scoreValue: {
    fontWeight: 'bold',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsContainer: {
    flex: 1,
  },
  meritText: {
    color: '#4caf50',
    fontWeight: 'bold',
  },
  demeritText: {
    color: '#f44336',
    fontWeight: 'bold',
  },
  finalContainer: {
    alignItems: 'center',
  },
  finalGrade: {
    fontWeight: 'bold',
    color: '#1976d2',
  },
  transmuted: {
    color: '#666',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#666',
  },
  modal: {
    backgroundColor: '#fff',
    padding: 24,
    margin: 20,
    borderRadius: 12,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
  },
  modalInput: {
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});

export default GradesScreen;
