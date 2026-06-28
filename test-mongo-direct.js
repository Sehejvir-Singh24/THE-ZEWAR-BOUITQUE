const mongoose = require('mongoose');
require('dotenv').config();

require('dotenv').config();
const uri = process.env.MONGODB_URI || 'mongodb://username:password@cluster...';

console.log('Connecting...');
mongoose.connect(uri)
    .then(() => {
        console.log('✅ Successfully connected!');
        mongoose.connection.close();
    })
    .catch(err => {
        console.error('❌ Error:', err);
    });
