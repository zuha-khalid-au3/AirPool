const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');

const User = require('../models/User');
const FlightTicket = require('../models/FlightTicket');
const RidePool = require('../models/RidePool');
const Message = require('../models/Message');
const AppConfig = require('../models/AppConfig');
const SuspiciousActivity = require('../models/SuspiciousActivity');

const setupAdminPanel = async (app) => {
  const { default: AdminJS } = await import('adminjs');
  const { default: AdminJSExpress } = await import('@adminjs/express');
  const { Database, Resource } = await import('@adminjs/mongoose');

  AdminJS.registerAdapter({ Database, Resource });
  const adminJs = new AdminJS({
    resources: [
      {
        resource: User,
        options: {
          navigation: { name: 'User Management', icon: 'User' },
          listProperties: ['name', 'phone', 'email', 'kycStatus', 'trustScore', 'isBanned', 'createdAt'],
          filterProperties: ['kycStatus', 'isBanned', 'trustScore', 'role'],
          editProperties: ['name', 'email', 'role', 'kycStatus', 'trustScore', 'isBanned', 'banReason'],
          actions: {
            approve_kyc: {
              actionType: 'record',
              component: false,
              handler: async (request, response, context) => {
                const { record } = context;
                await User.findByIdAndUpdate(record.params._id, {
                  kycStatus: 'approved',
                  isVerified: true,
                  'kycDocuments.govtId.verified': true,
                  'kycDocuments.selfie.verified': true,
                });
                return { record: record.toJSON(), msg: 'KYC Approved' };
              },
            },
          },
        },
      },
      {
        resource: FlightTicket,
        options: {
          navigation: { name: 'Flights & Tickets', icon: 'Plane' },
          listProperties: ['user', 'flightNumber', 'arrivalAirport.code', 'arrivalTime', 'verificationStatus'],
          filterProperties: ['verificationStatus', 'flightStatus', 'arrivalAirport.code'],
        },
      },
      {
        resource: RidePool,
        options: {
          navigation: { name: 'Ride Pools', icon: 'Car' },
          listProperties: ['flightNumber', 'arrivalAirport.code', 'destination.name', 'status', 'vehicleType', 'createdAt'],
          filterProperties: ['status', 'vehicleType', 'arrivalAirport.code', 'genderPreference'],
        },
      },
      {
        resource: Message,
        options: {
          navigation: { name: 'Chat & Messages', icon: 'Chat' },
          listProperties: ['chatRoomId', 'sender', 'content', 'messageType', 'createdAt'],
          actions: {
            new: { isAccessible: false },
            edit: { isAccessible: false },
          },
        },
      },
      {
        resource: AppConfig,
        options: {
          navigation: { name: 'App Configuration', icon: 'Settings' },
          listProperties: ['key', 'category', 'description', 'isActive', 'updatedAt'],
          editProperties: ['key', 'category', 'value', 'description', 'isActive'],
        },
      },
      {
        resource: SuspiciousActivity,
        options: {
          navigation: { name: 'Security & Fraud', icon: 'Shield' },
          listProperties: ['user', 'activityType', 'severity', 'status', 'createdAt'],
          filterProperties: ['activityType', 'severity', 'status'],
        },
      },
    ],
    rootPath: '/admin',
    branding: {
      companyName: 'AirPool Admin',
      logo: false,
      softwareBrothers: false,
      theme: {
        colors: {
          primary100: '#0284C7',
          primary80: '#0369A1',
          primary60: '#0EA5E9',
          primary40: '#38BDF8',
          primary20: '#BAE6FD',
          accent: '#10B981',
          love: '#EF4444',
        },
      },
    },
    locale: {
      language: 'en',
      translations: {
        labels: {
          User: 'Users',
          FlightTicket: 'Flight Tickets',
          RidePool: 'Ride Pools',
          Message: 'Messages',
          AppConfig: 'UI Configuration',
          SuspiciousActivity: 'Fraud Alerts',
        },
      },
    },
  });

  // Admin authentication
  const isDev = process.env.NODE_ENV === 'development';
  const sessionStore = isDev
    ? new session.MemoryStore()
    : MongoStore.create({
        client: mongoose.connection.getClient(),
        dbName: mongoose.connection.name,
        collectionName: 'admin_sessions',
      });

  const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
    adminJs,
    {
      authenticate: async (email, password) => {
        const adminEmail = (process.env.ADMIN_EMAIL || 'admin@airpool.app').toLowerCase();
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        const normalizedEmail = (email || '').toLowerCase().trim();

        if (normalizedEmail === adminEmail && password === adminPassword) {
          return { email: adminEmail, role: 'admin' };
        }

        const user = await User.findOne({
          email: normalizedEmail,
          role: { $in: ['admin', 'moderator'] },
        });
        if (user && password === adminPassword) {
          return { email: user.email, role: user.role, id: user._id };
        }

        return null;
      },
      cookieName: 'airpool-admin',
      cookiePassword: process.env.JWT_SECRET || 'airpool-admin-cookie-secret',
    },
    null,
    {
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      secret: process.env.JWT_SECRET || 'airpool-session-secret',
    }
  );

  app.use(adminJs.options.rootPath, adminRouter);

  return adminJs;
};

module.exports = { setupAdminPanel };
