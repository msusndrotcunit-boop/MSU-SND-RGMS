import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Surface, Text, Avatar } from 'react-native-paper';
import { ChevronRight } from 'lucide-react-native';

const CadetListItem = ({ cadet, onPress }) => {
  const fullName = [
    cadet.rank,
    cadet.first_name,
    cadet.middle_name,
    cadet.last_name,
    cadet.suffix_name,
  ]
    .filter(Boolean)
    .join(' ');

  const getStatusColor = (status) => {
    switch (status) {
      case 'DO':
        return '#f44336';
      case 'INC':
        return '#ff9800';
      case 'T':
        return '#9e9e9e';
      default:
        return '#4caf50';
    }
  };

  const initials = `${cadet.first_name?.[0] || ''}${cadet.last_name?.[0] || ''}`.toUpperCase();

  return (
    <TouchableOpacity onPress={onPress}>
      <Surface style={styles.container} elevation={1}>
        <Avatar.Text
          size={48}
          label={initials}
          style={styles.avatar}
        />
        <Surface style={styles.info} elevation={0}>
          <Text variant="titleMedium" numberOfLines={1} style={styles.name}>
            {fullName}
          </Text>
          <Text variant="bodySmall" style={styles.details}>
            {cadet.student_id} | {cadet.course} - {cadet.year_level}
          </Text>
          <Text variant="bodySmall" style={styles.company}>
            {cadet.battalion} - {cadet.company}
          </Text>
        </Surface>
        {cadet.status && ['DO', 'INC', 'T'].includes(cadet.status) && (
          <Surface
            style={[styles.statusBadge, { backgroundColor: getStatusColor(cadet.status) }]}
            elevation={0}
          >
            <Text style={styles.statusText}>{cadet.status}</Text>
          </Surface>
        )}
        <ChevronRight size={24} color="#999" />
      </Surface>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  avatar: {
    backgroundColor: '#1976d2',
  },
  info: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: 'transparent',
  },
  name: {
    fontWeight: '600',
  },
  details: {
    color: '#666',
    marginTop: 2,
  },
  company: {
    color: '#999',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default CadetListItem;
