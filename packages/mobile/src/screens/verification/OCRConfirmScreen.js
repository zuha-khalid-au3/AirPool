import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

export default function OCRConfirmScreen({ navigation, route }) {
  const { ticketId } = route.params;
  const [ticket, setTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Editable fields
  const [flightNumber, setFlightNumber] = useState('');
  const [airline, setAirline] = useState('');
  const [departureCode, setDepartureCode] = useState('');
  const [arrivalCode, setArrivalCode] = useState('');
  const [pnr, setPnr] = useState('');
  const [passengerName, setPassengerName] = useState('');

  useEffect(() => {
    fetchTicketDetails();
  }, []);

  const fetchTicketDetails = async () => {
    try {
      const response = await api.get(`/tickets/${ticketId}`);
      const ticketData = response.data.data.ticket;
      setTicket(ticketData);

      // Pre-fill with OCR results
      setFlightNumber(ticketData.flightNumber || '');
      setAirline(ticketData.airline || '');
      setDepartureCode(ticketData.departureAirport?.code || '');
      setArrivalCode(ticketData.arrivalAirport?.code || '');
      setPnr(ticketData.pnr || '');
      setPassengerName(ticketData.passengerName || '');
    } catch (error) {
      Alert.alert('Error', 'Failed to load ticket details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!flightNumber.trim() || !arrivalCode.trim()) {
      Alert.alert('Required', 'Flight number and arrival airport are required');
      return;
    }

    setIsSaving(true);
    try {
      await api.patch(`/tickets/${ticketId}`, {
        flightNumber: flightNumber.toUpperCase(),
        airline,
        departureAirport: { code: departureCode.toUpperCase() },
        arrivalAirport: { code: arrivalCode.toUpperCase() },
        pnr: pnr.toUpperCase(),
        passengerName,
      });

      Alert.alert('Verified!', 'Your flight ticket has been confirmed.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to update ticket');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="text-secondary-500 mt-4">Processing your ticket...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-4">
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <Text className="text-primary text-lg">← Back</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-secondary-900">Confirm Details</Text>
        </View>

        {/* OCR Confidence */}
        {ticket?.ocrConfidence && (
          <View className={`rounded-xl p-4 mb-6 ${
            ticket.ocrConfidence >= 85 ? 'bg-success/10' : 'bg-warning/10'
          }`}>
            <Text className={`font-medium ${
              ticket.ocrConfidence >= 85 ? 'text-success' : 'text-warning'
            }`}>
              {ticket.ocrConfidence >= 85
                ? `✓ High confidence OCR (${ticket.ocrConfidence}%)`
                : `⚠ Please verify extracted details (${ticket.ocrConfidence}% confidence)`}
            </Text>
          </View>
        )}

        <Text className="text-secondary-500 mb-6">
          Please review and correct the details extracted from your ticket:
        </Text>

        {/* Editable Fields */}
        <EditableField
          label="Flight Number *"
          value={flightNumber}
          onChangeText={setFlightNumber}
          placeholder="e.g., 6E2341"
          autoCapitalize="characters"
        />
        <EditableField
          label="Airline"
          value={airline}
          onChangeText={setAirline}
          placeholder="e.g., IndiGo"
        />
        <EditableField
          label="PNR / Booking Reference"
          value={pnr}
          onChangeText={setPnr}
          placeholder="e.g., ABC123"
          autoCapitalize="characters"
        />
        <EditableField
          label="Passenger Name"
          value={passengerName}
          onChangeText={setPassengerName}
          placeholder="Name on ticket"
        />

        <View className="flex-row mb-5">
          <View className="flex-1 mr-3">
            <EditableField
              label="From (Airport Code)"
              value={departureCode}
              onChangeText={setDepartureCode}
              placeholder="DEL"
              maxLength={3}
              autoCapitalize="characters"
            />
          </View>
          <View className="flex-1">
            <EditableField
              label="To (Airport Code) *"
              value={arrivalCode}
              onChangeText={setArrivalCode}
              placeholder="VNS"
              maxLength={3}
              autoCapitalize="characters"
            />
          </View>
        </View>

        {/* Confirm Button */}
        <TouchableOpacity
          className="bg-primary w-full py-4 rounded-xl items-center mb-8"
          onPress={handleConfirm}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white text-lg font-semibold">Confirm & Verify</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function EditableField({ label, value, onChangeText, placeholder, maxLength, autoCapitalize }) {
  return (
    <View className="mb-5">
      <Text className="text-secondary-700 font-medium mb-2">{label}</Text>
      <TextInput
        className="border-2 border-secondary-200 rounded-xl px-4 py-3 text-base text-secondary-900"
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize || 'sentences'}
      />
    </View>
  );
}
