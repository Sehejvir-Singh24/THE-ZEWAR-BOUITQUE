const mongoose = require('mongoose');
require('dotenv').config();

const uri = 'mongodb://sehejvir:QEYAdh84Uenlbv8q@ac-jkw3nc5-shard-00-00.v0ibxsa.mongodb.net:27017,ac-jkw3nc5-shard-00-01.v0ibxsa.mongodb.net:27017,ac-jkw3nc5-shard-00-02.v0ibxsa.mongodb.net:27017/zewar-boutique?ssl=true&replicaSet=atlas-yafl7p-shard-0&authSource=admin&retryWrites=true&w=majority&appName=the-zewar-boutique';

console.log('Connecting...');
mongoose.connect(uri)
    .then(() => {
        console.log('✅ Successfully connected!');
        mongoose.connection.close();
    })
    .catch(err => {
        console.error('❌ Error:', err);
    });
