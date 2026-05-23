import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function DocumentHubScreen({ navigation }) {
  const { user } = useAuthStore();
  const [kycData, setKycData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchKYCStatus();
  }, []);

  const fetchKYCStatus = async () => {
    try {
      const response = await api.get('/users/kyc/status');
      setKycData(response.data.data);
    } catch (error) {
      console.warn('Failed to fetch KYC status:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#0284C7" />
      </SafeAreaView>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return { bg: 'bg-success/10', text: 'text-success', label: 'Approved' };
      case 'submitted': return { bg: 'bg-warning/10', text: 'text-warning', label: 'Under Review' };
      case 'rejected': return { bg: 'bg-danger/10', text: 'text-danger', label: 'Rejected' };
      default: return { bg: 'bg-secondary-100', text: 'text-secondary-500', label: 'Not Submitted' };
    }
  };

  const kycStatus = getStatusColor(kycData?.kycStatus);

  return (
    <SafeAreaView className="flex-1 bg-secondary-50">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="bg-white px-6 pt-4 pb-6 border-b border-secondary-100">
          <View className="flex-row items-center mb-4">
            <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
              <Text className="text-primary text-lg">← Back</Text>
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-secondary-900">Documents & KYC</Text>
          </View>

          {/* Overall Status */}
          <View className={`${kycStatus.bg} rounded-xl p-4 flex-row items-center`}>
            <Text className="text-xl mr-3">
              {kycData?.kycStatus === 'approved' ? '✅' : kycData?.kycStatus === 'submitted' ? '⏳' : '📋'}
            </Text>
            <View className="flex-1">
              <Text className={`font-bold ${kycStatus.text}`}>
                KYC Status: {kycStatus.label}
              </Text>
              <Text className="text-secondary-500 text-sm mt-1">
                {kycData?.kycStatus === 'approved'
                  ? 'Your identity has been verified'
                  : 'Complete verification to unlock all features'}
              </Text>
            </View>
          </View>
        </View>

        {/* Document Cards */}
        <View className="px-6 mt-6">
          <Text className="text-secondary-900 font-bold text-lg mb-4">Required Documents</Text>

          {/* Government ID */}
          <DocumentCard
            title="Government ID"
            subtitle="Aadhaar Card, PAN, Passport, or Voter ID"
            icon="🪪"
            uploaded={kycData?.documents?.govtId?.uploaded}
            verified={kycData?.documents?.govtId?.verified}
            onPress={() => {}}
          />

          {/* Selfie */}
          <DocumentCard
            title="Selfie Verification"
            subtitle="Take a clear selfie for face matching"
            icon="🤳"
            uploaded={kycData?.documents?.selfie?.uploaded}
            verified={kycData?.documents?.selfie?.verified}
            onPress={() => {}}
          />
        </View>

        {/* Flight Tickets */}
        <View className="px-6 mt-6">
          <Text className="text-secondary-900 font-bold text-lg mb-4">Flight Tickets</Text>

          <TouchableOpacity
            className="bg-white rounded-2xl p-5 border border-secondary-100 flex-row items-center"
            onPress={() => navigation.navigate('TicketUpload')}
            activeOpacity={0.7}
          >
            <View className="w-12 h-12 bg-primary-50 rounded-full items-center justify-center mr-4">
              <Text className="text-xl">🎫</Text>
            </View>
            <View className="flex-1">
              <Text className="text-secondary-900 font-medium">Upload Flight Ticket</Text>
              <Text className="text-secondary-500 text-sm mt-1">
                PDF or photo of your boarding pass / e-ticket
              </Text>
            </View>
            <Text className="text-primary font-bold text-lg">+</Text>
          </TouchableOpacity>
        </View>

        {/* Why Verify */}
        <View className="px-6 mt-6 mb-8">
          <View className="bg-primary-50 rounded-2xl p-5 border border-primary-100">
            <Text className="text-primary-800 font-bold mb-3">Why verify your identity?</Text>
            <BenefitItem text="Build trust with co-passengers (+20 trust score)" />
            <BenefitItem text="Access female-only and verified-only pools" />
            <BenefitItem text="Priority matching with other verified users" />
            <BenefitItem text="Enhanced safety features and SOS support" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DocumentCard({ title, subtitle, icon, uploaded, verified, onPress }) {
  return (
    <TouchableOpacity
      className="bg-white rounded-2xl p-5 mb-3 border border-secondary-100 flex-row items-center"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="w-12 h-12 bg-secondary-50 rounded-full items-center justify-center mr-4">
        <Text className="text-xl">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-secondary-900 font-medium">{title}</Text>
        <Text className="text-secondary-400 text-sm mt-1">{subtitle}</Text>
      </View>
      {verified ? (
        <View className="bg-success/10 px-3 py-1 rounded-full">
          <Text className="text-success text-xs font-medium">✓ Verified</Text>
        </View>
      ) : uploaded ? (
        <View className="bg-warning/10 px-3 py-1 rounded-full">
          <Text className="text-warning text-xs font-medium">Pending</Text>
        </View>
      ) : (
        <View className="bg-secondary-100 px-3 py-1 rounded-full">
          <Text className="text-secondary-500 text-xs font-medium">Upload</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function BenefitItem({ text }) {
  return (
    <View className="flex-row items-center mb-2">
      <Text className="text-primary mr-2">•</Text>
      <Text className="text-primary-700 text-sm flex-1">{text}</Text>
    </View>
  );
}
