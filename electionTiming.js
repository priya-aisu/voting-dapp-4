const mongoose = require('mongoose');

const ElectionTimingSchema = new mongoose.Schema({
    startTime: Number, // Store timestamps for easier comparison
    endTime: Number
});

module.exports = mongoose.model('ElectionTiming', ElectionTimingSchema);
