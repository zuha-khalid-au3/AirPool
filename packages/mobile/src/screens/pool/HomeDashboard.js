import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { usePoolStore } from '../../store/poolStore';
import { useConfigStore } from '../../store/configStore';
import { filterActivePools, getPoolId } from '../../utils/pool';
import { colors, shadows } from '../../theme/colors';

function StatusBadge({ status }) {
  const stylesByStatus = {
    open: { bg: colors.successSoft, text: colors.success, label: 'Open' },
    full: { bg: colors.warningSoft, text: colors.warning, label: 'Full' },
    in_progress: { bg: colors.primarySoft, text: colors.primary, label: 'In progress' },
  };

  const badge = stylesByStatus[status] || stylesByStatus.open;

  return (
    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
      <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
    </View>
  );
}

export default function HomeDashboard({ navigation }) {
  const { user } = useAuthStore();
  const { myPools, fetchMyPools } = usePoolStore();
  const { announcements } = useConfigStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMyPools();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchMyPools();
    } finally {
      setRefreshing(false);
    }
  };

  const activePools = useMemo(() => filterActivePools(myPools), [myPools]);
  const firstName = user?.name?.split(' ')[0] || 'Traveller';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primaryLight}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroRow}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroGreeting}>Welcome back,</Text>
              <Text style={styles.heroName}>{firstName}</Text>
              <Text style={styles.heroSubtitle}>Ready for your next shared ride?</Text>
            </View>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.85}
            >
              <Text style={styles.profileEmoji}>👤</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.trustCard}>
            <View style={styles.trustLeft}>
              <Text style={styles.trustStar}>⭐</Text>
              <View>
                <Text style={styles.trustLabel}>Trust score</Text>
                <Text style={styles.trustValue}>{user?.trustScore || 50}/100</Text>
              </View>
            </View>
            {user?.isVerified && (
              <View style={styles.verifiedPill}>
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>
        </View>

        {announcements.length > 0 && (
          <View style={styles.section}>
            {announcements.map((announcement) => (
              <View key={announcement.id || announcement.title} style={styles.announcementCard}>
                <Text style={styles.announcementTitle}>{announcement.title}</Text>
                <Text style={styles.announcementBody}>{announcement.message}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionCard, styles.actionCardPrimary]}
              onPress={() => navigation.navigate('CreatePool')}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIcon, styles.actionIconPrimary]}>
                <Text style={styles.actionEmoji}>➕</Text>
              </View>
              <Text style={styles.actionTitle}>Create pool</Text>
              <Text style={styles.actionSubtitle}>Start a ride group</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, styles.actionCardSuccess]}
              onPress={() => navigation.navigate('JoinPool')}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIcon, styles.actionIconSuccess]}>
                <Text style={styles.actionEmoji}>🔍</Text>
              </View>
              <Text style={styles.actionTitle}>Join pool</Text>
              <Text style={styles.actionSubtitle}>Find travellers</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Your active pools</Text>
            {activePools.length > 0 && (
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{activePools.length}</Text>
              </View>
            )}
          </View>

          {activePools.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🛫</Text>
              <Text style={styles.emptyTitle}>No active pools yet</Text>
              <Text style={styles.emptySubtitle}>
                Create or join a pool before your next flight and split the cab fare.
              </Text>
            </View>
          ) : (
            activePools.map((pool) => {
              const poolId = getPoolId(pool);
              const activeMembers =
                pool.members?.filter((member) => member.status === 'active').length || 0;

              return (
                <TouchableOpacity
                  key={poolId}
                  style={styles.poolCard}
                  onPress={() => navigation.navigate('PoolDetails', { poolId })}
                  activeOpacity={0.88}
                >
                  <View style={styles.poolAccent} />
                  <View style={styles.poolContent}>
                    <View style={styles.poolTopRow}>
                      <View style={styles.poolTitleWrap}>
                        <Text style={styles.poolDestination} numberOfLines={1}>
                          {pool.destination?.name || 'Destination'}
                        </Text>
                        <Text style={styles.poolMeta} numberOfLines={1}>
                          {pool.flightNumber || 'Flight'} · {pool.arrivalAirport?.code || 'Airport'}
                        </Text>
                      </View>
                      <StatusBadge status={pool.status} />
                    </View>

                    <View style={styles.poolFooter}>
                      <Text style={styles.poolStat}>
                        👥 {activeMembers}/{pool.maxMembers}
                      </Text>
                      <Text style={styles.poolDot}>•</Text>
                      <Text style={styles.poolStat}>
                        🚗 {(pool.vehicleType || 'sedan').replace('_', ' ')}
                      </Text>
                      {pool.estimatedCostPerPerson > 0 && (
                        <>
                          <Text style={styles.poolDot}>•</Text>
                          <Text style={styles.poolPrice}>₹{pool.estimatedCostPerPerson}</Text>
                        </>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {!user?.isVerified && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.verifyCard}
              onPress={() => navigation.navigate('Profile', { screen: 'DocumentHub' })}
              activeOpacity={0.88}
            >
              <Text style={styles.verifyEmoji}>📄</Text>
              <View style={styles.verifyCopy}>
                <Text style={styles.verifyTitle}>Complete verification</Text>
                <Text style={styles.verifySubtitle}>
                  Upload your ID to unlock all features and build trust.
                </Text>
              </View>
              <Text style={styles.verifyArrow}>→</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.secondaryBg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  hero: {
    backgroundColor: colors.gradientTop,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(56, 189, 248, 0.22)',
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  heroGreeting: {
    color: colors.primaryMuted,
    fontSize: 15,
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 4,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    marginTop: 6,
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  profileEmoji: {
    fontSize: 20,
  },
  trustCard: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  trustLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trustStar: {
    fontSize: 22,
    marginRight: 12,
  },
  trustLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
  },
  trustValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  verifiedPill: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  verifiedText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: colors.secondary,
    fontSize: 20,
    fontWeight: '800',
  },
  countPill: {
    marginLeft: 10,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  countPillText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  announcementCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  announcementTitle: {
    color: colors.primaryDark,
    fontWeight: '700',
    fontSize: 15,
  },
  announcementBody: {
    color: colors.primary,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.secondaryCard,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    ...shadows.card,
  },
  actionCardPrimary: {
    borderColor: '#BAE6FD',
  },
  actionCardSuccess: {
    borderColor: '#BBF7D0',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  actionIconPrimary: {
    backgroundColor: colors.primarySoft,
  },
  actionIconSuccess: {
    backgroundColor: colors.successSoft,
  },
  actionEmoji: {
    fontSize: 22,
  },
  actionTitle: {
    color: colors.secondary,
    fontSize: 16,
    fontWeight: '800',
  },
  actionSubtitle: {
    color: colors.secondaryMuted,
    fontSize: 13,
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: colors.secondaryCard,
    borderRadius: 22,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
    ...shadows.soft,
  },
  emptyEmoji: {
    fontSize: 42,
    marginBottom: 12,
  },
  emptyTitle: {
    color: colors.secondarySoft,
    fontSize: 17,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: colors.secondaryMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
  },
  poolCard: {
    flexDirection: 'row',
    backgroundColor: colors.secondaryCard,
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
    ...shadows.card,
  },
  poolAccent: {
    width: 5,
    backgroundColor: colors.primary,
  },
  poolContent: {
    flex: 1,
    padding: 16,
  },
  poolTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  poolTitleWrap: {
    flex: 1,
    paddingRight: 10,
  },
  poolDestination: {
    color: colors.secondary,
    fontSize: 17,
    fontWeight: '800',
  },
  poolMeta: {
    color: colors.secondaryMuted,
    fontSize: 13,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  poolFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.secondaryBorder,
  },
  poolStat: {
    color: colors.secondaryMuted,
    fontSize: 13,
  },
  poolDot: {
    color: '#CBD5E1',
    marginHorizontal: 8,
  },
  poolPrice: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
  },
  verifyCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.22)',
  },
  verifyEmoji: {
    fontSize: 28,
    marginRight: 14,
  },
  verifyCopy: {
    flex: 1,
  },
  verifyTitle: {
    color: colors.secondary,
    fontSize: 16,
    fontWeight: '800',
  },
  verifySubtitle: {
    color: colors.secondaryMuted,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 19,
  },
  verifyArrow: {
    color: colors.warning,
    fontSize: 22,
    fontWeight: '700',
    marginLeft: 8,
  },
});
