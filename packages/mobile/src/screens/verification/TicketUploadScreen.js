import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import api from '../../services/api';

export default function TicketUploadScreen({ navigation }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedFile(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to take a photo of your ticket.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedFile({
          uri: result.assets[0].uri,
          name: `ticket_${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
          size: result.assets[0].fileSize,
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      Alert.alert('No File', 'Please select or capture your flight ticket first');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('ticket', {
        uri: selectedFile.uri,
        name: selectedFile.name || 'ticket.pdf',
        type: selectedFile.mimeType || 'application/pdf',
      });

      const response = await api.post('/tickets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        },
      });

      const ticketId = response.data.data.ticket.id;
      Alert.alert(
        'Upload Successful!',
        'Your ticket is being processed. We\'ll extract flight details automatically.',
        [
          {
            text: 'View Details',
            onPress: () => navigation.navigate('OCRConfirm', { ticketId }),
          },
          { text: 'Done', onPress: () => navigation.goBack() },
        ]
      );
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Upload failed. Please try again.';
      Alert.alert('Upload Failed', message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-4">
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <Text className="text-primary text-lg">← Back</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-secondary-900">Upload Ticket</Text>
        </View>

        {/* Upload Area */}
        <View className="flex-1 justify-center">
          {selectedFile ? (
            <View className="items-center">
              {selectedFile.mimeType?.startsWith('image') ? (
                <Image
                  source={{ uri: selectedFile.uri }}
                  className="w-64 h-80 rounded-xl mb-4"
                  resizeMode="contain"
                />
              ) : (
                <View className="w-64 h-80 bg-secondary-50 rounded-xl items-center justify-center mb-4 border-2 border-secondary-200">
                  <Text className="text-5xl mb-3">📄</Text>
                  <Text className="text-secondary-700 font-medium">PDF Document</Text>
                </View>
              )}
              <Text className="text-secondary-700 font-medium">{selectedFile.name}</Text>
              <Text className="text-secondary-400 text-sm mt-1">
                {selectedFile.size ? `${(selectedFile.size / 1024).toFixed(1)} KB` : ''}
              </Text>

              <TouchableOpacity
                className="mt-4"
                onPress={() => setSelectedFile(null)}
              >
                <Text className="text-danger font-medium">Remove & Choose Another</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="items-center">
              <View className="w-full border-2 border-dashed border-secondary-300 rounded-2xl p-10 items-center mb-6">
                <Text className="text-5xl mb-4">🎫</Text>
                <Text className="text-secondary-700 font-bold text-lg">Upload Flight Ticket</Text>
                <Text className="text-secondary-400 text-center mt-2">
                  Upload your boarding pass, e-ticket PDF, or take a photo
                </Text>
              </View>

              {/* Upload Options */}
              <TouchableOpacity
                className="bg-primary w-full py-4 rounded-xl items-center mb-3"
                onPress={pickDocument}
                activeOpacity={0.8}
              >
                <Text className="text-white text-lg font-semibold">📁 Choose File</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="border-2 border-primary w-full py-4 rounded-xl items-center"
                onPress={takePhoto}
                activeOpacity={0.8}
              >
                <Text className="text-primary text-lg font-semibold">📷 Take Photo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Upload Button */}
        {selectedFile && (
          <View className="pb-8">
            {isUploading && (
              <View className="mb-4">
                <View className="bg-secondary-100 rounded-full h-2 mb-2">
                  <View
                    className="bg-primary rounded-full h-2"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </View>
                <Text className="text-secondary-500 text-center text-sm">
                  Uploading... {uploadProgress}%
                </Text>
              </View>
            )}

            <TouchableOpacity
              className={`w-full py-4 rounded-xl items-center ${
                isUploading ? 'bg-secondary-200' : 'bg-primary'
              }`}
              onPress={handleUpload}
              disabled={isUploading}
              activeOpacity={0.8}
            >
              {isUploading ? (
                <ActivityIndicator color="#64748B" />
              ) : (
                <Text className="text-white text-lg font-semibold">Upload & Process</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Info */}
        <View className="bg-primary-50 rounded-xl p-4 mb-6">
          <Text className="text-primary-700 text-sm leading-5">
            💡 Our OCR engine will automatically extract your flight number, airport, and timing.
            You can review and correct the details after processing.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
