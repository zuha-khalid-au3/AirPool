const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const AppConfig = require('../models/AppConfig');
const User = require('../models/User');
const logger = require('./logger');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/airpool');
    logger.info('Connected to MongoDB for seeding');

    // Seed App Configuration
    const configs = [
      {
        key: 'theme_primary_color',
        category: 'theme',
        value: '#0284C7',
        description: 'Primary brand color (Sky Blue)',
      },
      {
        key: 'theme_secondary_color',
        category: 'theme',
        value: '#0F172A',
        description: 'Secondary color (Slate Dark)',
      },
      {
        key: 'theme_success_color',
        category: 'theme',
        value: '#10B981',
        description: 'Success/Verified color (Emerald)',
      },
      {
        key: 'theme_warning_color',
        category: 'theme',
        value: '#F59E0B',
        description: 'Warning/Pending color (Amber)',
      },
      {
        key: 'max_pool_capacity',
        category: 'general',
        value: 4,
        description: 'Default maximum members per pool',
      },
      {
        key: 'pool_expiry_hours',
        category: 'general',
        value: 6,
        description: 'Hours after arrival when pool expires',
      },
      {
        key: 'supported_airports',
        category: 'airports',
        value: [
          { code: 'VNS', name: 'Lal Bahadur Shastri International Airport', city: 'Varanasi', state: 'UP', active: true },
          { code: 'DEL', name: 'Indira Gandhi International Airport', city: 'New Delhi', state: 'Delhi', active: true },
          { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', state: 'Maharashtra', active: true },
          { code: 'BLR', name: 'Kempegowda International Airport', city: 'Bengaluru', state: 'Karnataka', active: true },
          { code: 'HYD', name: 'Rajiv Gandhi International Airport', city: 'Hyderabad', state: 'Telangana', active: true },
          { code: 'MAA', name: 'Chennai International Airport', city: 'Chennai', state: 'Tamil Nadu', active: true },
          { code: 'CCU', name: 'Netaji Subhas Chandra Bose International Airport', city: 'Kolkata', state: 'West Bengal', active: true },
          { code: 'LKO', name: 'Chaudhary Charan Singh International Airport', city: 'Lucknow', state: 'UP', active: true },
          { code: 'JAI', name: 'Jaipur International Airport', city: 'Jaipur', state: 'Rajasthan', active: true },
          { code: 'PAT', name: 'Jay Prakash Narayan International Airport', city: 'Patna', state: 'Bihar', active: true },
        ],
        description: 'List of supported airports',
      },
      {
        key: 'vehicle_types',
        category: 'vehicles',
        value: [
          { id: 'auto_rickshaw', name: 'Auto Rickshaw', maxPassengers: 3, estimatedRatePerKm: 12, icon: 'rickshaw' },
          { id: 'sedan', name: 'Sedan (Cab)', maxPassengers: 4, estimatedRatePerKm: 18, icon: 'car' },
          { id: 'suv', name: 'SUV', maxPassengers: 6, estimatedRatePerKm: 25, icon: 'suv' },
          { id: 'any', name: 'Any Available', maxPassengers: 4, estimatedRatePerKm: 15, icon: 'any' },
        ],
        description: 'Available vehicle types for pooling',
      },
      {
        key: 'active_announcements',
        category: 'announcements',
        value: [
          {
            id: 'welcome',
            title: 'Welcome to AirPool!',
            message: 'Save money and make friends by sharing rides from the airport.',
            type: 'info',
            active: true,
          },
        ],
        description: 'Active announcement banners',
      },
      {
        key: 'enable_ble_mesh',
        category: 'feature_flags',
        value: true,
        description: 'Enable BLE mesh networking for in-flight communication',
      },
      {
        key: 'enable_digiyatra',
        category: 'feature_flags',
        value: false,
        description: 'Enable DigiYatra integration for identity verification',
      },
      {
        key: 'enable_live_location',
        category: 'feature_flags',
        value: true,
        description: 'Enable live location sharing post-landing',
      },
      {
        key: 'enable_female_only_pools',
        category: 'feature_flags',
        value: true,
        description: 'Allow creation of female-only ride pools',
      },
    ];

    for (const config of configs) {
      await AppConfig.findOneAndUpdate(
        { key: config.key },
        config,
        { upsert: true, new: true }
      );
    }
    logger.info(`Seeded ${configs.length} app configurations`);

    // Create default admin user
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      await User.create({
        phone: '9999999999',
        countryCode: '+91',
        name: 'AirPool Admin',
        email: process.env.ADMIN_EMAIL || 'admin@airpool.app',
        role: 'admin',
        isVerified: true,
        kycStatus: 'approved',
        trustScore: 100,
      });
      logger.info('Default admin user created');
    }

    logger.info('Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedData();
