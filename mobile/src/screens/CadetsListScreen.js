import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Searchbar, Text, Chip, Surface } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import client from '../api/client';
import CadetListItem from '../components/CadetListItem';
import LoadingSpinner from '../components/LoadingSpinner';

const CadetsListScreen = ({ navigation }) => {
  const [cadets, setCadets] = useState([]);
  const [filteredCadets, setFilteredCadets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  const fetchCadets = async () => {
    try {
      const response = await client.get('/api/admin/cadets');
      setCadets(response.data || []);
      applyFilters(response.data || [], searchQuery, selectedFilter);
    } catch (error) {
      console.error('Failed to fetch cadets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCadets();
    }, [])
  );

  const applyFilters = (data, query, filter) => {
    let filtered = [...data];

    // Apply search
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.first_name?.toLowerCase().includes(lowerQuery) ||
          c.last_name?.toLowerCase().includes(lowerQuery) ||
          c.student_id?.toLowerCase().includes(lowerQuery) ||
          c.company?.toLowerCase().includes(lowerQuery)
      );
    }

    // Apply status filter
    if (filter !== 'all') {
      if (filter === 'active') {
        filtered = filtered.filter((c) => !['DO', 'INC', 'T'].includes(c.status));
      } else {
        filtered = filtered.filter((c) => c.status === filter);
      }
    }

    setFilteredCadets(filtered);
  };

  const onSearch = (query) => {
    setSearchQuery(query);
    applyFilters(cadets, query, selectedFilter);
  };

  const onFilterChange = (filter) => {
    setSelectedFilter(filter);
    applyFilters(cadets, searchQuery, filter);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCadets();
  };

  const onCadetPress = (cadet) => {
    navigation.navigate('CadetDetail', { cadet });
  };

  if (loading) {
    return <LoadingSpinner message="Loading cadets..." />;
  }

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'DO', label: 'Dropped' },
    { key: 'INC', label: 'Incomplete' },
  ];

  return (
    <View style={styles.container}>
      <Surface style={styles.header} elevation={0}>
        <Searchbar
          placeholder="Search cadets..."
          onChangeText={onSearch}
          value={searchQuery}
          style={styles.searchbar}
        />
        <View style={styles.filters}>
          {filters.map((filter) => (
            <Chip
              key={filter.key}
              selected={selectedFilter === filter.key}
              onPress={() => onFilterChange(filter.key)}
              style={styles.chip}
              mode={selectedFilter === filter.key ? 'flat' : 'outlined'}
            >
              {filter.label}
            </Chip>
          ))}
        </View>
      </Surface>

      <FlatList
        data={filteredCadets}
        keyExtractor={(item) => item.id?.toString() || item.student_id}
        renderItem={({ item }) => (
          <CadetListItem cadet={item} onPress={() => onCadetPress(item)} />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="bodyLarge" style={styles.emptyText}>
              No cadets found
            </Text>
          </View>
        }
      />
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
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchbar: {
    elevation: 0,
    backgroundColor: '#f5f5f5',
  },
  filters: {
    flexDirection: 'row',
    marginTop: 12,
    flexWrap: 'wrap',
  },
  chip: {
    marginRight: 8,
    marginBottom: 4,
  },
  list: {
    paddingVertical: 8,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#666',
  },
});

export default CadetsListScreen;
