const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const Binding = require('@serialport/bindings-cpp');
SerialPort.Binding = Binding;

const port = new SerialPort({ path: 'COM5', baudRate: 9600 });
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

function sendToArduino(command) {
  return new Promise((resolve, reject) => {
    let timeout = setTimeout(() => reject(new Error('Timeout')), 10000);

    parser.once('data', data => {
      clearTimeout(timeout);
      resolve(data.trim());
    });

    port.write(command + '\n');
  });
}

// New function to stream serial messages
function listenToSerial(callback) {
  parser.on('data', line => {
    console.log('Serial:', line.trim());
    callback(line.trim());
  });
}

module.exports = { sendToArduino, listenToSerial };
