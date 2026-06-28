const mongoose = require('mongoose');
require('dotenv').config();

// The standard mongodb:// connection string bypassing the SRV local DNS lookup
const uri = process.env.MONGODB_URI || 'mongodb://username:password@cluster...';

console.log('Attempting to connect to MongoDB directly without SRV');

mongoose.connect(uri)
    .then(() => {
        console.log('✅ Successfully connected to MongoDB Atlas');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });
