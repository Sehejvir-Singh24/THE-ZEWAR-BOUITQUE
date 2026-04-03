const mongoose = require('mongoose');
require('dotenv').config();

// The standard mongodb:// connection string bypassing the SRV local DNS lookup
const uri = 'mongodb://sehejvir:db_sehej%402401@ac-jkw3nc5-shard-00-00.v0ibxsa.mongodb.net:27017,ac-jkw3nc5-shard-00-01.v0ibxsa.mongodb.net:27017,ac-jkw3nc5-shard-00-02.v0ibxsa.mongodb.net:27017/zewar-boutique?ssl=true&replicaSet=atlas-jkw3nc-shard-0&authSource=admin&retryWrites=true&w=majority&appName=the-zewar-boutique';

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
