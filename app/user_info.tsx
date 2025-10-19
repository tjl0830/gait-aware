import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

function UserInfo() {
  const [formData, setFormData] = useState({
    profilePicture: '',
    name: '',
    gender: '',
    age: '',
    notes: ''
  });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 4],
      quality: 1,
    });

    if (!result.canceled && result.assets[0].uri) {
      setFormData(prev => ({
        ...prev,
        profilePicture: result.assets[0].uri
      }));
    }
  };

  const handleSubmit = () => {
    console.log('Form submitted:', formData);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Step 2: Fill User Info</Text>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Profile Picture</Text>
        <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
          <Text>Select Image</Text>
        </TouchableOpacity>
        {formData.profilePicture ? (
          <Image 
            source={{ uri: formData.profilePicture }}
            style={styles.preview}
          />
        ) : null}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={formData.name}
          onChangeText={(value) => setFormData(prev => ({ ...prev, name: value }))}
          placeholder="Enter your name"
        />
      </View>

      <View style={[styles.formGroup, styles.row]}>
        <View style={[styles.column, { flex: 1, marginRight: 10 }]}>
          <Text style={styles.label}>Gender</Text>
          <Picker
            selectedValue={formData.gender}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, gender: value }))
            }
            style={styles.picker}
          >
            <Picker.Item label="Select gender" value="" />
            <Picker.Item label="Male" value="male" />
            <Picker.Item label="Female" value="female" />
          </Picker>
        </View>

        <View style={[styles.column, { flex: 1, marginLeft: 10 }]}>
          <Text style={styles.label}>Age</Text>
          <TextInput
            style={styles.input}
            value={formData.age}
            onChangeText={(value) =>
              setFormData((prev) => ({ ...prev, age: value }))
            }
            keyboardType="numeric"
            placeholder="Enter your age"
          />
        </View>
      </View>


      <View style={styles.formGroup}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.notes}
          onChangeText={(value) => setFormData(prev => ({ ...prev, notes: value }))}
          multiline={true}
          numberOfLines={4}
          placeholder="Enter notes"
        />
      </View>

      <TouchableOpacity 
        style={styles.button}
        // onPress={handleSubmit}
      >
        <Text style={styles.buttonText}>Next Step</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center', // Add this to center children horizontally
    marginTop: 20,
    maxWidth: 600,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 20,
    width: '100%', // Add this to make the form group take full width
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 10,
    fontSize: 16,
    width: '100%', // Add this to make inputs take full width
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
  },
  preview: {
    width: 200,
    height: 200,
    marginTop: 10,
    borderRadius: 4,
    alignSelf: 'center', // Add this to center the image
  },
  imagePicker: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    alignItems: 'center',
  },
  // button: {
  //   backgroundColor: '#0070f3',
  //   padding: 15,
  //   borderRadius: 4,
  //   alignItems: 'center',
  //   marginTop: 20,
  // },
  // buttonText: {
  //   color: 'white',
  //   fontSize: 16,
  //   fontWeight: '500',
  // },

  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  column: {
    flex: 1,
  },

});

export default UserInfo;