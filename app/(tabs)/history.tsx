import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// lazy-load expo-sqlite only on native platforms to avoid web bundling issues
const dbRef = useRef<any | null>(null);
const sqliteInitAttemptedRef = useRef(false);
const sqliteAvailableDefault = true;

type HistoryItem = {
  id: number;
  gaitType: string;
  note: string | null;
  createdAt: string;
};

export default function Tab() {
  const [gaitType, setGaitType] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sqliteAvailable, setSqliteAvailable] = useState<boolean>(sqliteAvailableDefault);

  useEffect(() => {
    let mounted = true;
    async function prepareDb() {
      if (Platform.OS === 'web') {
        setLoading(false);
        setSqliteAvailable(false);
        return;
      }
      try {
        const SQLite = await import('expo-sqlite'); // dynamic import avoids web bundling issues
        // openDatabase can throw if native module isn't linked
        dbRef.current = SQLite.openDatabase('gaitaware.db');
        setSqliteAvailable(true);
        if (!mounted) return;
        initDb();
        fetchHistory();
      } catch (err) {
        // native module missing or failed to initialize
        console.warn('sqlite import/open error (falling back to in-memory):', err);
        setSqliteAvailable(false);
        setLoading(false);
      }
    }
    prepareDb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function initDb() {
    const db = dbRef.current;
    if (!db) return;
    db.transaction((tx: any) => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gaitType TEXT NOT NULL,
            note TEXT,
            createdAt TEXT NOT NULL
          );`,
        [],
        () => {},
        (_: any, err: any) => {
          console.warn('DB create table error', err);
          return false;
        }
      );
    });
  }

  function fetchHistory() {
    const db = dbRef.current;
    if (!db) {
      setItems([]);
      setLoading(false);
      return;
    }
    db.transaction((tx: any) => {
      tx.executeSql(
        'SELECT * FROM history ORDER BY createdAt DESC;',
        [],
        (_: any, result: any) => {
          // expo-sqlite returns rows._array
          // @ts-ignore
          const rows = result.rows && result.rows._array ? result.rows._array : [];
          setItems(rows as HistoryItem[]);
          setLoading(false);
        },
        (_: any, err: any) => {
          console.warn('fetchHistory error', err);
          setLoading(false);
          return false;
        }
      );
    });
  }

  function addHistory() {
    const trimmed = gaitType.trim();
    if (!trimmed) {
      Alert.alert('Please enter a gait type');
      return;
    }
    const createdAt = new Date().toISOString();

    const db = dbRef.current;
    if (!db) {
      // fallback: keep in-memory only
      const newItem: HistoryItem = {
        id: Math.floor(Math.random() * 1000000),
        gaitType: trimmed,
        note: note.trim() || null,
        createdAt,
      };
      setItems(prev => [newItem, ...prev]);
      setGaitType('');
      setNote('');
      return;
    }

    db.transaction((tx: any) => {
      tx.executeSql(
        'INSERT INTO history (gaitType, note, createdAt) VALUES (?, ?, ?);',
        [trimmed, note.trim() || null, createdAt],
        (_: any, result: any) => {
          const insertId = (result as any).insertId;
          const newItem: HistoryItem = {
            id: insertId,
            gaitType: trimmed,
            note: note.trim() || null,
            createdAt,
          };
          setItems(prev => [newItem, ...prev]);
          setGaitType('');
          setNote('');
        },
        (_: any, err: any) => {
          console.warn('addHistory error', err);
          return false;
        }
      );
    });
  }

  function deleteHistory(id: number) {
    const db = dbRef.current;
    if (!db) {
      setItems(prev => prev.filter(i => i.id !== id));
      return;
    }
    db.transaction((tx: any) => {
      tx.executeSql(
        'DELETE FROM history WHERE id = ?;',
        [id],
        () => {
          setItems(prev => prev.filter(i => i.id !== id));
        },
        (_: any, err: any) => {
          console.warn('deleteHistory error', err);
          return false;
        }
      );
    });
  }

  function clearAll() {
    const db = dbRef.current;
    if (!db) {
      setItems([]);
      return;
    }
    Alert.alert('Clear all', 'Delete all history entries?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          db.transaction((tx: any) => {
            tx.executeSql('DELETE FROM history;', [], () => {
              setItems([]);
            });
          });
        },
      },
    ]);
  }

  function renderItem({ item }: { item: HistoryItem }) {
    const date = new Date(item.createdAt);
    const dateLabel = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <Text style={styles.gaitTitle}>{item.gaitType}</Text>
          {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
          <Text style={styles.date}>{dateLabel}</Text>
        </View>
        <View style={styles.rowRight}>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() =>
              Alert.alert('Delete entry', 'Delete this history entry?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteHistory(item.id) },
              ])
            }
          >
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <View style={styles.header}>
        <Text style={styles.headerText}>History</Text>
        <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {!sqliteAvailable && (
        <View style={styles.sqliteNotice}>
          <Text style={styles.sqliteNoticeText}>Local persistent storage unavailable — data will be temporary.</Text>
        </View>
      )}

      <View style={styles.form}>
        <TextInput
          placeholder="Gait type (e.g. Antalgic)"
          value={gaitType}
          onChangeText={setGaitType}
          style={styles.input}
          placeholderTextColor="#888"
        />
        <TextInput
          placeholder="Note (optional)"
          value={note}
          onChangeText={setNote}
          style={[styles.input, styles.noteInput]}
          placeholderTextColor="#888"
          multiline
        />
        <TouchableOpacity style={styles.addBtn} onPress={addHistory}>
          <Text style={styles.addBtnText}>Add to History</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={i => i.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>{loading ? 'Loading...' : 'No history yet'}</Text>
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 24 },
  header: {
    paddingHorizontal: 20,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: { fontSize: 24, fontWeight: '700' },
  clearBtn: { padding: 6 },
  clearText: { color: '#d00', fontWeight: '600' },
  form: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
    marginHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#000',
    backgroundColor: '#fff',
  },
  noteInput: { marginTop: 8, minHeight: 60, textAlignVertical: 'top' },
  addBtn: { marginTop: 10, backgroundColor: '#0066cc', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  list: { paddingHorizontal: 12, paddingBottom: 48 },
  row: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 10,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  rowLeft: { flex: 1 },
  rowRight: { justifyContent: 'center', alignItems: 'flex-end' },
  gaitTitle: { fontSize: 18, fontWeight: '600' },
  note: { fontSize: 15, color: '#333', marginTop: 4 },
  date: { fontSize: 13, color: '#666', marginTop: 6 },
  deleteBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  deleteText: { color: '#d00', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#666', marginTop: 24, fontSize: 16 },
  sqliteNotice: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#fff6e6',
    borderColor: '#f0d9b5',
    borderWidth: 1,
    padding: 8,
    borderRadius: 6,
  },
  sqliteNoticeText: {
    color: '#7a5a2a',
    fontSize: 13,
  },
});
