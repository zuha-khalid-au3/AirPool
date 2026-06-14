import { create } from 'zustand';
import api from '../services/api';
import { dedupePoolsById, getPoolId } from '../utils/pool';

function upsertPool(pools, pool) {
  const id = getPoolId(pool);
  if (!id) return pools;

  const without = pools.filter((item) => getPoolId(item) !== id);
  return dedupePoolsById([pool, ...without]);
}

export const usePoolStore = create((set, get) => ({
  pools: [],
  myPools: [],
  currentPool: null,
  isLoading: false,
  searchFilters: {},

  // Search available pools
  searchPools: async (filters = {}) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams();
      if (filters.flightNumber) params.append('flightNumber', filters.flightNumber);
      if (filters.airportCode) params.append('airportCode', filters.airportCode);
      if (filters.destination) params.append('destination', filters.destination);
      if (filters.vehicleType) params.append('vehicleType', filters.vehicleType);

      const response = await api.get(`/pools/search?${params.toString()}`);
      set({ pools: response.data.data.pools, isLoading: false });
      return response.data.data;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  // Create a new pool
  createPool: async (poolData) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/pools', poolData);
      const newPool = response.data.data.pool;
      set((state) => ({
        myPools: upsertPool(state.myPools, newPool),
        currentPool: newPool,
        isLoading: false,
      }));
      return newPool;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  // Join a pool
  joinPool: async (poolId) => {
    set({ isLoading: true });
    try {
      const response = await api.post(`/pools/${poolId}/join`);
      const updatedPool = response.data.data.pool;
      set((state) => ({
        myPools: upsertPool(state.myPools, updatedPool),
        currentPool: updatedPool,
        pools: state.pools.filter((p) => getPoolId(p) !== getPoolId(updatedPool)),
        isLoading: false,
      }));
      return updatedPool;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  // Leave a pool
  leavePool: async (poolId) => {
    try {
      await api.post(`/pools/${poolId}/leave`);
      set((state) => ({
        myPools: state.myPools.filter((p) => getPoolId(p) !== String(poolId)),
        currentPool: null,
      }));
    } catch (error) {
      throw error;
    }
  },

  // Get pool details
  getPoolDetails: async (poolId) => {
    try {
      const response = await api.get(`/pools/${poolId}`);
      set({ currentPool: response.data.data.pool });
      return response.data.data.pool;
    } catch (error) {
      throw error;
    }
  },

  // Get my pools
  fetchMyPools: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get('/pools/user/my-pools');
      set({ myPools: dedupePoolsById(response.data.data.pools), isLoading: false });
      return response.data.data.pools;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  removeMemberFromPool: async (poolId, userId) => {
    try {
      const response = await api.post(`/pools/${poolId}/members/${userId}/remove`);
      const updatedPool = response.data.data.pool;
      set((state) => ({
        currentPool: updatedPool,
        myPools: upsertPool(state.myPools, updatedPool),
      }));
      return updatedPool;
    } catch (error) {
      throw error;
    }
  },

  // Update pool status
  updatePoolStatus: async (poolId, status) => {
    try {
      const response = await api.patch(`/pools/${poolId}/status`, { status });
      set({ currentPool: response.data.data.pool });
      return response.data.data.pool;
    } catch (error) {
      throw error;
    }
  },

  // Clear current pool
  clearCurrentPool: () => set({ currentPool: null }),
}));
