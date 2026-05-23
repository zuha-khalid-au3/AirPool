import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function TrustScoreScreen({ navigation }) {
  const { user } = useAuthStore();
  const [scoreData, setScoreData] = useState(null);

  useEffect(() => {
    fetchTrustScore();
  }, []);

  const fetchTrustScore = async () => {
    try {
      const response = await api.get('/users/trust-score');
      setScoreData(response.data.data);
    } catch (error) {
      console.warn('Failed to fetch trust score:', error.message);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-success';
    if (score >= 50) return 'text-warning';
    return 'text-danger';
  };

  const getScoreBg = (score) => {
    if (score >= 80) return 'bg-success/10';
    if (score >= 50) return 'bg-warning/10';
    return 'bg-danger/10';
  };

  const score = scoreData?.trustScore || user?.trustScore || 50;

  return (
    <SafeAreaView className="flex-1 bg-secondary-50">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="bg-white px-6 pt-4 pb-6 border-b border-secondary-100">
          <View className="flex-row items-center mb-6">
            <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
              <Text className="text-primary text-lg">← Back</Text>
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-secondary-900">Trust Score</Text>
          </View>

          {/* Score Circle */}
          <View className="items-center">
            <View className={`w-32 h-32 rounded-full items-center justify-center ${getScoreBg(score)}`}>
              <Text className={`text-5xl font-bold ${getScoreColor(score)}`}>{score}</Text>
              <Text className="text-secondary-400 text-sm">/100</Text>
            </View>
            <Text className="text-secondary-700 font-medium mt-4 text-lg">
              {score >= 80 ? 'Excellent' : score >= 50 ? 'Good' : 'Needs Improvement'}
            </Text>
          </View>
        </View>

        {/* Score Breakdown */}
        <View className="px-6 mt-6">
          <Text className="text-secondary-900 font-bold text-lg mb-4">Score Breakdown</Text>

          <ScoreItem
            title="Rides Completed"
            value={scoreData?.completedRides || 0}
            total={scoreData?.totalRides || 0}
            description="Complete rides to build trust"
            icon="✅"
          />
          <ScoreItem
            title="Completion Rate"
            value={`${scoreData?.completionRate || 100}%`}
            description="Percentage of rides you showed up for"
            icon="📊"
          />
          <ScoreItem
            title="No-Shows"
            value={scoreData?.noShows || 0}
            description="Times you didn't show up (reduces score)"
            icon="❌"
            negative
          />
          <ScoreItem
            title="Account Verified"
            value={user?.isVerified ? 'Yes' : 'No'}
            description="KYC verification adds +20 to score"
            icon="🛡️"
          />
        </View>

        {/* How to Improve */}
        <View className="px-6 mt-6 mb-8">
          <Text className="text-secondary-900 font-bold text-lg mb-4">How to Improve</Text>
          <View className="bg-white rounded-2xl p-5 border border-secondary-100">
            <TipItem text="Complete your KYC verification (+20 points)" />
            <TipItem text="Complete rides without cancelling (+5 per ride)" />
            <TipItem text="Get positive ratings from co-passengers (+2 per rating)" />
            <TipItem text="Upload verified flight tickets (+3 per ticket)" />
            <TipItem text="Avoid no-shows (-10 per no-show)" negative />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ScoreItem({ title, value, total, description, icon, negative }) {
  return (
    <View className="bg-white rounded-xl p-4 mb-3 border border-secondary-100">
      <View className="flex-row items-center">
        <Text className="text-xl mr-3">{icon}</Text>
        <View className="flex-1">
          <Text className="text-secondary-900 font-medium">{title}</Text>
          <Text className="text-secondary-400 text-sm">{description}</Text>
        </View>
        <Text className={`font-bold text-lg ${negative ? 'text-danger' : 'text-secondary-900'}`}>
          {value}{total ? `/${total}` : ''}
        </Text>
      </View>
    </View>
  );
}

function TipItem({ text, negative }) {
  return (
    <View className="flex-row items-start mb-3">
      <Text className={`mr-2 ${negative ? 'text-danger' : 'text-success'}`}>
        {negative ? '⚠️' : '💡'}
      </Text>
      <Text className="text-secondary-600 flex-1 text-sm">{text}</Text>
    </View>
  );
}
