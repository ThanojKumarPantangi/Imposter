import mongoose from 'mongoose';

const appConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'GLOBAL_APP_CONFIG',
      index: true
    },
    server: {
      enabled: {
        type: Boolean,
        default: true
      },
      message: {
        type: String,
        default: ''
      }
    },
    appUpdate: {
      enabled: {
        type: Boolean,
        default: false
      },
      latestVersionCode: {
        type: Number,
        default: 1
      },
      updateUrl: {
        type: String,
        default: ''
      },
      title: {
        type: String,
        default: ''
      },
      message: {
        type: String,
        default: ''
      }
    },
    version: {
      type: Number,
      default: 1
    }
  },
  {
    timestamps: true
  }
);

export const AppConfig = mongoose.model('AppConfig', appConfigSchema);
export default AppConfig;
