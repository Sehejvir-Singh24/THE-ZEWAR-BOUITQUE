const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object
const svc = new Service({
  name: 'Zewar Boutique Server',
  description: 'The Node.js server for Zewar Boutique.',
  script: path.join(__dirname, 'server.js')
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', function() {
  console.log('Service installed successfully!');
  console.log('Starting the Zewar Boutique server service...');
  svc.start();
});

// Listen for the "alreadyinstalled" event
svc.on('alreadyinstalled', function() {
  console.log('This service is already installed.');
});

// Listen for the "start" event
svc.on('start', function() {
  console.log('Service started successfully!');
});

console.log('Installing Zewar Boutique Server as a Windows Service...');
svc.install();
