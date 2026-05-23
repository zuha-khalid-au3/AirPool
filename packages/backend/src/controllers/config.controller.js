const AppConfig = require('../models/AppConfig');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

const CACHE_TTL = 300; // 5 minutes cache

// Get full app configuration (Server-Driven UI)
const getAppConfig = async (req, res, next) => {
  try {
    const redis = getRedisClient();
    const cacheKey = 'app_config:full';

    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
    }

    // Fetch all active configs
    const configs = await AppConfig.find({ isActive: true });
    const configMap = {};

    configs.forEach((config) => {
      if (!configMap[config.category]) {
        configMap[config.category] = {};
      }
      configMap[config.category][config.key] = config.value;
    });

    // Cache the result
    await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(configMap));

    res.status(200).json({
      success: true,
      data: configMap,
      cached: false,
    });
  } catch (error) {
    next(error);
  }
};

// Get supported airports
const getSupportedAirports = async (req, res, next) => {
  try {
    const airports = await AppConfig.getConfig('supported_airports');

    res.status(200).json({
      success: true,
      data: {
        airports: airports || getDefaultAirports(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get vehicle types
const getVehicleTypes = async (req, res, next) => {
  try {
    const vehicles = await AppConfig.getConfig('vehicle_types');

    res.status(200).json({
      success: true,
      data: {
        vehicles: vehicles || getDefaultVehicleTypes(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get announcements
const getAnnouncements = async (req, res, next) => {
  try {
    const announcements = await AppConfig.getConfig('active_announcements');

    res.status(200).json({
      success: true,
      data: {
        announcements: announcements || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get feature flags
const getFeatureFlags = async (req, res, next) => {
  try {
    const flags = await AppConfig.getByCategory('feature_flags');

    res.status(200).json({
      success: true,
      data: { features: flags },
    });
  } catch (error) {
    next(error);
  }
};

// Default data fallbacks
function getDefaultAirports() {
  return [
    { code: 'VNS', name: 'Lal Bahadur Shastri International Airport', city: 'Varanasi', state: 'UP', coordinates: { lat: 25.4524, lng: 82.8593 } },
    { code: 'DEL', name: 'Indira Gandhi International Airport', city: 'New Delhi', state: 'Delhi', coordinates: { lat: 28.5562, lng: 77.1000 } },
    { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', state: 'Maharashtra', coordinates: { lat: 19.0896, lng: 72.8656 } },
    { code: 'BLR', name: 'Kempegowda International Airport', city: 'Bengaluru', state: 'Karnataka', coordinates: { lat: 13.1986, lng: 77.7066 } },
    { code: 'HYD', name: 'Rajiv Gandhi International Airport', city: 'Hyderabad', state: 'Telangana', coordinates: { lat: 17.2403, lng: 78.4294 } },
    { code: 'MAA', name: 'Chennai International Airport', city: 'Chennai', state: 'Tamil Nadu', coordinates: { lat: 12.9941, lng: 80.1709 } },
    { code: 'CCU', name: 'Netaji Subhas Chandra Bose International Airport', city: 'Kolkata', state: 'West Bengal', coordinates: { lat: 22.6547, lng: 88.4467 } },
    { code: 'LKO', name: 'Chaudhary Charan Singh International Airport', city: 'Lucknow', state: 'UP', coordinates: { lat: 26.7606, lng: 80.8893 } },
    { code: 'JAI', name: 'Jaipur International Airport', city: 'Jaipur', state: 'Rajasthan', coordinates: { lat: 26.8242, lng: 75.8122 } },
    { code: 'PAT', name: 'Jay Prakash Narayan International Airport', city: 'Patna', state: 'Bihar', coordinates: { lat: 25.5913, lng: 85.0880 } },
  ];
}

function getDefaultVehicleTypes() {
  return [
    { id: 'auto_rickshaw', name: 'Auto Rickshaw', maxPassengers: 3, icon: 'auto', estimatedRatePerKm: 12 },
    { id: 'sedan', name: 'Sedan (Cab)', maxPassengers: 4, icon: 'car', estimatedRatePerKm: 18 },
    { id: 'suv', name: 'SUV', maxPassengers: 6, icon: 'suv', estimatedRatePerKm: 25 },
    { id: 'any', name: 'Any Available', maxPassengers: 4, icon: 'any', estimatedRatePerKm: 15 },
  ];
}

module.exports = {
  getAppConfig,
  getSupportedAirports,
  getVehicleTypes,
  getAnnouncements,
  getFeatureFlags,
};
