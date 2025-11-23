import { Picker } from "@react-native-picker/picker";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

interface UserInfoProps {
  initialData?: {
    name: string;
    gender: string;
    age: string;
    notes: string;
  };
  onChange?: (data: {
    name: string;
    gender: string;
    age: string;
    notes: string;
  }) => void;
}

function UserInfo({ initialData, onChange }: UserInfoProps = {}) {
  const [formData, setFormData] = useState({
    name: "",
    gender: "",
    age: "",
    notes: "",
  });

  // Initialize with initialData if provided
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  return (
    <View style={styles.container}>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={formData.name}
          onChangeText={(value) => {
            const newData = { ...formData, name: value };
            setFormData(newData);
            onChange?.(newData);
          }}
          placeholder="e.g., John Doe"
          placeholderTextColor="#999"
        />
      </View>

      <View style={[styles.formGroup, styles.row]}>
        <View style={[styles.column, { flex: 1, marginRight: 10 }]}>
          <Text style={styles.label}>Gender</Text>
          <Picker
            selectedValue={formData.gender}
            onValueChange={(value) => {
              const newData = { ...formData, gender: value };
              setFormData(newData);
              onChange?.(newData);
            }}
            style={styles.picker}
          >
            <Picker.Item label="Select" value="" />
            <Picker.Item label="Male" value="Male" />
            <Picker.Item label="Female" value="Female" />
            <Picker.Item label="Other" value="Other" />
          </Picker>
        </View>

        <View style={[styles.column, { flex: 1, marginLeft: 10 }]}>
          <Text style={styles.label}>Age</Text>
          <TextInput
            style={styles.input}
            value={formData.age}
            onChangeText={(value) => {
              const newData = { ...formData, age: value };
              setFormData(newData);
              onChange?.(newData);
            }}
            keyboardType="numeric"
            placeholder="e.g., 65"
            placeholderTextColor="#999"
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Additional Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.notes}
          onChangeText={(value) => {
            const newData = { ...formData, notes: value };
            setFormData(newData);
            onChange?.(newData);
          }}
          multiline={true}
          numberOfLines={4}
          placeholder="e.g., Left knee pain, recent surgery, etc."
          placeholderTextColor="#999"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignSelf: "center",
    marginTop: 8,
    maxWidth: 600,
  },
  formGroup: {
    marginBottom: 20,
    width: "100%",
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: "500",
    color: "#333",
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    width: "100%",
    backgroundColor: "#fff",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  picker: {
    borderWidth: 1.5,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  column: {
    flex: 1,
  },
});

export default UserInfo;
