
const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
    candidateId: Number,
    partyName: String,
    pincode: String,
    candidateName: String,
    aadharNumber: String,
    partyID: Number,
    voteCount: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('candidates', candidateSchema);