const mongoose = require('mongoose');

const appConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['theme', 'feature_flags', 'airports', 'vehicles', 'announcements', 'general'],
      required: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

appConfigSchema.index({ category: 1, isActive: 1 });
appConfigSchema.index({ key: 1 });

// Static method to get config by key
appConfigSchema.statics.getConfig = async function (key) {
  const config = await this.findOne({ key, isActive: true });
  return config ? config.value : null;
};

// Static method to get all configs by category
appConfigSchema.statics.getByCategory = async function (category) {
  const configs = await this.find({ category, isActive: true });
  const result = {};
  configs.forEach((c) => {
    result[c.key] = c.value;
  });
  return result;
};

// Static method to set config
appConfigSchema.statics.setConfig = async function (key, category, value, description = '') {
  return this.findOneAndUpdate(
    { key },
    { key, category, value, description, isActive: true },
    { upsert: true, new: true }
  );
};

const AppConfig = mongoose.model('AppConfig', appConfigSchema);

module.exports = AppConfig;
