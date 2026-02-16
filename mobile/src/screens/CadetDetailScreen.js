import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Surface,
  Text,
  Card,
  Button,
  Avatar,
  Divider,
  TextInput,
  Portal,
  Modal,
} from 'react-native-paper';
import { User, Award, MinusCircle, BookOpen } from 'lucide-react-native';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

const CadetDetailScreen = ({ route, navigation }) => {
  const { cadet } = route.params;
  const [grades, setGrades] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('merit');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchGrades();
  }, []);

  const fetchGrades = async () => {
    try {
      const response = await client.get('/api/admin/grades');
      const cadetGrade = response.data?.find((g) => g.cadet_id === cadet.id);
      setGrades(cadetGrade || null);
    } catch (error) {
      console.error('Failed to fetch grades:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (type) => {
    setModalType(type);
    setPoints('');
    setReason('');
    setModalVisible(true);
  };

  const handleSubmitPoints = async () => {
    if (!points || !reason.trim()) {
      Alert.alert('Error', 'Please enter points and reason');
      return;
    }

    const pointsNum = parseInt(points, 10);
    if (isNaN(pointsNum) || pointsNum <= 0) {
      Alert.alert('Error', 'Please enter a valid number of points');
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = modalType === 'merit' 
        ? `/api/admin/grades/${cadet.id}/merit`
        : `/api/admin/grades/${cadet.id}/demerit`;

      await client.post(endpoint, {
        points: pointsNum,
        reason: reason.trim(),
      });

      Alert.alert('Success', `${modalType === 'merit' ? 'Merit' : 'Demerit'} points added`);
      setModalVisible(false);
      fetchGrades();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to add points');
    } finally {
      setSubmitting(false);
    }
  };

  const fullName = [
    cadet.rank,
    cadet.first_name,
    cadet.middle_name,
    cadet.last_name,
    cadet.suffix_name,
  ]
    .filter(Boolean)
    .join(' ');

  const initials = `${cadet.first_name?.[0] || ''}${cadet.last_name?.[0] || ''}`.toUpperCase();

  if (loading) {
    return <LoadingSpinner message="Loading cadet details..." />;
  }

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <Surface style={styles.profileHeader} elevation={2}>
        <Avatar.Text size={80} label={initials} style={styles.avatar} />
        <Text variant="headlineSmall" style={styles.name}>
          {fullName}
        </Text>
        <Text variant="bodyMedium" style={styles.studentId}>
          {cadet.student_id}
        </Text>
        {cadet.status && ['DO', 'INC', 'T'].includes(cadet.status) && (
          <Surface style={[styles.statusBadge, { backgroundColor: cadet.status === 'DO' ? '#f44336' : '#ff9800' }]} elevation={0}>
            <Text style={styles.statusText}>
              {cadet.status === 'DO' ? 'Dropped' : cadet.status === 'INC' ? 'Incomplete' : 'Transferred'}
            </Text>
          </Surface>
        )}
      </Surface>

      {/* Info Card */}
      <Card style={styles.card}>
        <Card.Title title="Cadet Information" left={(props) => <User {...props} size={24} />} />
        <Card.Content>
          <InfoRow label="Course" value={cadet.course} />
          <InfoRow label="Year Level" value={cadet.year_level} />
          <InfoRow label="Battalion" value={cadet.battalion} />
          <InfoRow label="Company" value={cadet.company} />
          <InfoRow label="Platoon" value={cadet.platoon} />
          <InfoRow label="Email" value={cadet.email} />
          <InfoRow label="Contact" value={cadet.contact_number} />
        </Card.Content>
      </Card>

      {/* Grades Card */}
      <Card style={styles.card}>
        <Card.Title title="Grades & Points" left={(props) => <BookOpen {...props} size={24} />} />
        <Card.Content>
          <View style={styles.gradesRow}>
            <GradeBox label="Prelim" value={grades?.prelim_score || 0} />
            <GradeBox label="Midterm" value={grades?.midterm_score || 0} />
            <GradeBox label="Final" value={grades?.final_score || 0} />
          </View>
          <Divider style={styles.divider} />
          <View style={styles.pointsRow}>
            <PointsBox
              label="Merit"
              value={grades?.merit_points || 0}
              color="#4caf50"
            />
            <PointsBox
              label="Demerit"
              value={grades?.demerit_points || 0}
              color="#f44336"
            />
          </View>
          {grades?.final_grade && (
            <Surface style={styles.finalGrade} elevation={0}>
              <Text variant="bodyMedium">Final Grade</Text>
              <Text variant="headlineMedium" style={styles.finalGradeValue}>
                {grades.final_grade?.toFixed(2)}
              </Text>
            </Surface>
          )}
        </Card.Content>
        <Card.Actions>
          <Button
            mode="contained"
            onPress={() => openModal('merit')}
            style={styles.meritButton}
            icon={() => <Award size={18} color="#fff" />}
          >
            Add Merit
          </Button>
          <Button
            mode="contained"
            onPress={() => openModal('demerit')}
            style={styles.demeritButton}
            icon={() => <MinusCircle size={18} color="#fff" />}
          >
            Add Demerit
          </Button>
        </Card.Actions>
      </Card>

      {/* Points Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            Add {modalType === 'merit' ? 'Merit' : 'Demerit'} Points
          </Text>
          <TextInput
            label="Points"
            value={points}
            onChangeText={setPoints}
            keyboardType="numeric"
            mode="outlined"
            style={styles.modalInput}
          />
          <TextInput
            label="Reason"
            value={reason}
            onChangeText={setReason}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.modalInput}
          />
          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={() => setModalVisible(false)}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmitPoints}
              loading={submitting}
              disabled={submitting}
              style={{
                backgroundColor: modalType === 'merit' ? '#4caf50' : '#f44336',
              }}
            >
              Submit
            </Button>
          </View>
        </Modal>
      </Portal>
    </ScrollView>
  );
};

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text variant="bodyMedium" style={styles.infoLabel}>
      {label}
    </Text>
    <Text variant="bodyMedium" style={styles.infoValue}>
      {value || '-'}
    </Text>
  </View>
);

const GradeBox = ({ label, value }) => (
  <View style={styles.gradeBox}>
    <Text variant="bodySmall" style={styles.gradeLabel}>
      {label}
    </Text>
    <Text variant="titleLarge" style={styles.gradeValue}>
      {value}
    </Text>
  </View>
);

const PointsBox = ({ label, value, color }) => (
  <View style={[styles.pointsBox, { borderColor: color }]}>
    <Text variant="bodySmall" style={[styles.pointsLabel, { color }]}>
      {label}
    </Text>
    <Text variant="headlineSmall" style={[styles.pointsValue, { color }]}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  profileHeader: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: '#1976d2',
  },
  name: {
    marginTop: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  studentId: {
    color: '#666',
    marginTop: 4,
  },
  statusBadge: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    color: '#666',
  },
  infoValue: {
    fontWeight: '500',
  },
  gradesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
  },
  gradeBox: {
    alignItems: 'center',
  },
  gradeLabel: {
    color: '#666',
  },
  gradeValue: {
    fontWeight: 'bold',
    marginTop: 4,
  },
  divider: {
    marginVertical: 16,
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  pointsBox: {
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    minWidth: 100,
  },
  pointsLabel: {
    fontWeight: '500',
  },
  pointsValue: {
    fontWeight: 'bold',
    marginTop: 4,
  },
  finalGrade: {
    alignItems: 'center',
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  finalGradeValue: {
    fontWeight: 'bold',
    color: '#1976d2',
  },
  meritButton: {
    backgroundColor: '#4caf50',
    flex: 1,
    marginRight: 8,
  },
  demeritButton: {
    backgroundColor: '#f44336',
    flex: 1,
  },
  modal: {
    backgroundColor: '#fff',
    padding: 24,
    margin: 20,
    borderRadius: 12,
  },
  modalTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export default CadetDetailScreen;
