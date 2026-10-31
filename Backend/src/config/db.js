import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('<username>') || uri.includes('<password>')) {
    console.warn('\n⚠️ [MongoDB] MONGODB_URI is not fully configured with your cloud password in .env.');
    console.warn('⚠️ [MongoDB] Please update Backend/.env with your actual MongoDB Atlas password.');
    return null;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      autoIndex: true
    });
    console.log(`✅ [MongoDB] Connected successfully to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ [MongoDB] Connection error: ${error.message}`);
    console.warn('⚠️ [MongoDB] Check your network connection, IP whitelist, and .env credentials.');
    return null;
  }
};

export default connectDB;
