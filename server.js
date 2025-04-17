// server.js
const dotenv = require("dotenv");
dotenv.config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const User = require('./models/user');
const bcrypt = require('bcryptjs');
const candidates=require('./models/candidates');
const ElectionTiming = require('./models/electionTiming'); // Import model correctly
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const otpMap = new Map(); // Store OTPs temporarily
const { sendToArduino, listenToSerial } = require('./serialComm');
const app = express();
const server = http.createServer(app);
const { sendEmail } = require('./emailService');
const ipfsOnlyHash = require('ipfs-only-hash');


app.use(bodyParser.json());
app.use(cors());

let recentSerialMessages = [];

// Update your serial listener to store the messages
listenToSerial((message) => {
  console.log('Serial message:', message);
  
  // Save message
  recentSerialMessages.push(message);

  // Keep only the last 50 messages (optional)
  if (recentSerialMessages.length > 50) {
    recentSerialMessages.shift();
  }
});

// Add this endpoint to return the latest messages
app.get('/serial/messages', (req, res) => {
  res.json({ messages: recentSerialMessages });
});

// Example route in server.js
app.post('/serial/clear', (req, res) => {
    recentSerialMessages = []; // or however you store the messages
    res.sendStatus(200);
  });
  


app.post('/fingerprint/enroll', async (req, res) => {
  const { voterId } = req.body;
  if (!voterId) return res.status(400).json({ message: 'voterId is required' });

  try {
    await sendToArduino(`ENROLL:${voterId}`);
    res.json({ message: `Voter ${voterId} enrollment started.` });
  } catch (err) {
    res.status(500).json({ message: 'Enroll failed: ' + err.message });
  }
});//app.use(express.json());
const PORT = 3000;


// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/votingApp', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.log(err));


const generateHash = (voterID, metamaskAddress) => {
        const combinedData = `${String(voterID).trim().toLowerCase()}-${metamaskAddress.trim().toLowerCase()}`;
        const hash = crypto.createHash('sha256').update(combinedData).digest('hex');
        console.log(`Generated Hash for Upload: ${hash}`); // ✅ Logging here
        return hash;
    };
        

// Route for creating new user
app.post('/register', async (req, res) => {
    try {
        const { name, username, dob, password,  aadhar, mobile, address, pincode,voterId, gender,email } = req.body;
        
        // Validate Age (18+)
        const birthDate = new Date(dob);
        const age = new Date().getFullYear() - birthDate.getFullYear();
        if (age < 18) {
            return res.status(400).json({ message: "You must be at least 18 years old to sign up." });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            name,
            username,
            dob,
            password:hashedPassword,  
            gender,
            aadhar,
            mobile,
            address,
            pincode,
            voterId,
            email
        });

        await newUser.save()
        .then((savedUser) => {
            console.log('Saved user:', savedUser);  // Log saved user to confirm it worked
            res.status(201).json({ success: true, message: 'User created successfully', user: savedUser });
        })
        .catch((error) => {
            console.error('Error saving user:', error);
            if (error.code === 11000) {
                const field = Object.keys(error.keyPattern)[0]; // Get the field that caused the error
                return res.status(400).json({ success: false, message: `Duplicate value for ${field}. This ${field} is already registered.` });
            }
            res.status(500).json({ message: 'Server error', error });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/sendConfirmationEmail', (req, res) => {
    const { email, voterId } = req.body;

    if (!email || !voterId) {
        return res.status(400).json({ success: false, message: 'Email or Voter ID missing.' });
    }

    try {
        // Send confirmation email
        const subject = 'Voter Registration Confirmation';
        const text = `Dear Voter,\n\nThank you for registering with us.\nYour voter ID is: ${voterId}\n\nBest regards,\nElection Commission`;
        console.log('text',text);
        sendEmail(email, subject, text); // Using the reusable sendEmail function

        return res.status(200).json({ success: true, message: 'Confirmation email sent.' });
    } catch (error) {
        console.error('Error sending confirmation email:', error);
        return res.status(500).json({ success: false, message: 'Failed to send confirmation email.' });
    }
});

app.post('/check-voter', async (req, res) => {
    const { voterId, aadhar, email, username } = req.body;

    if (!voterId || !aadhar || !email || !username) {
        return res.status(400).json({ 
            success: false, 
            message: 'voterId, aadhar, email, and username are required.' 
        });
    }

    try {
        const existingUsers = await User.find({
            $or: [
                { voterId },
                { aadhar: aadhar },
                { email },
                { username }
            ]
        });

        let conflictFields = [];

        for (const user of existingUsers) {
            if (String(user.voterId) === String(voterId)) conflictFields.push('voterId');
            if (String(user.aadhar) === String(aadhar)) conflictFields.push('aadhar');
            if (user.email === email) conflictFields.push('email');
            if (user.username === username) conflictFields.push('username');
        }

        if (conflictFields.length > 0) {
            return res.status(409).json({
                success: false,
                message: `${[...new Set(conflictFields)].join(', ')} already in use.`,
                conflicts: [...new Set(conflictFields)]
            });
        }

        return res.status(200).json({ success: true, message: 'Voter details are unique.' });

    } catch (err) {
        console.error('Error checking voter uniqueness:', err);
        return res.status(500).json({ success: false, message: 'Server error checking voter uniqueness.' });
    }
});


app.post('/login', async (req, res) => {
    try {
        const { username, aadhar, password } = req.body;

        // Find user by both username and aadhar
        const user = await User.findOne({ username, aadhar });

        if (!user) {
            return res.status(400).json({ message: 'Invalid username, aadhar, or password' });
        }

        // Compare the entered password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid username, aadhar, or password' });
        }

        // Respond with success and user details
        res.status(200).json({
            message: 'Login successful',
            user: {
                username: user.username,
                aadhar: user.aadhar,
                pincode: user.pincode,
                voterId: user.voterId,
            },
        });
    } catch (error) {
        console.error('Error in login route:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/register-candidate', async (req, res) => {
    try {
        const { partyName, pincode, candidateName, aadharNumber,partyID,candidateId  } = req.body;
        console.log('partyName',partyName);
        console.log('pincode',pincode);
        console.log('candidateName',candidateName);
        console.log('aadharNumber',aadharNumber);
        console.log('partyId',partyID);
        console.log('candidateId',candidateId);


        const exists = await candidates.findOne({ partyName, pincode });
        if (exists) {
            return res.status(400).json({ success: false, message: 'This pincode is already registered under the same party.' });
        }

        const newCandidate = new candidates({ partyName, pincode, candidateName, aadharNumber, partyID, candidateId });
        await newCandidate.save();
        console.log('newCandidate',newCandidate);

        res.status(201).json({ success: true, message: 'Candidate registered successfully', candidate: newCandidate, objectId: newCandidate._id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/update-vote-status', async (req, res) => {
    const { voterId } = req.body;
    console.log('voterId');

    try {
        // Fetch user by voterId
        const user = await User.findOne({ voterId });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // If user has already voted, return an error
        if (user.hasVoted) {
            return res.status(400).json({ message: 'User has already voted' });
        }

        // Update the user's hasVoted field to true
        user.hasVoted = true;
        await user.save();

        res.status(200).json({ message: 'Vote status updated successfully' });
    } catch (error) {
        console.error('Error updating vote status:', error);
        res.status(500).json({ message: 'An error occurred while updating vote status' });
    }
});

app.post('/fingerprint/verify', async (req, res) => {
    try {
      await sendToArduino("VERIFY");
      res.json({ message: 'Verification started.' });
    } catch (err) {
      res.status(500).json({ message: 'Verify failed: ' + err.message });
    }
  });

app.post('/api/save-election-timings', async (req, res) => {
    try {
        const { startTime, endTime } = req.body;

        if (!startTime || !endTime) {
            return res.status(400).json({ message: 'Start and end time are required.' });
        }

        // Remove existing election timings (only one entry should exist)
        await ElectionTiming.deleteMany({});

        // Save new election timing
        const newTiming = new ElectionTiming({
            startTime: new Date(startTime),
            endTime: new Date(endTime)
        });

        await newTiming.save();

        res.status(201).json({ message: 'Election timings saved successfully!' });
    } catch (error) {
        console.error('Error saving election timings:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


app.post('/upload', async (req, res) => {
    const { voterID, metamaskAddress} = req.body;

    if (!voterID ) {
        return res.status(400).json({ status: 'failed', message: 'Missing required voterId' });
    }
    if ( !metamaskAddress) {
        return res.status(400).json({ status: 'failed', message: 'Missing required metamaskAddress ' });
    }

    const groupHash = generateHash(voterID, metamaskAddress);

    try {
        const resPinata = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
            hash: groupHash,  // ✅ Store hash as part of JSON content
            voterID: voterID.trim(),
            metamaskAddress: metamaskAddress.trim(),
            //thumbprintHash: thumbprintHash.trim()
        }, {
            headers: {
                pinata_api_key: process.env.PINATA_API_KEY,
                pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY,
                'Content-Type':'application/json'
            }
        });

        console.log(`Uploaded hash to Pinata: ${groupHash}`);
        return res.json({ status: 'success', hash: groupHash });
    } catch (error) {
        console.error('Error uploading to Pinata:', error);
        return res.status(500).json({ status: 'failed', message: 'Error uploading to Pinata' });
    }
});

app.post('/verify', async (req, res) => {
    const { voterID, metamaskAddress} = req.body;

    if (!voterID ) {
        return res.status(400).json({ status: 'failed', message: 'Missing required voterId' });
    }

    if ( !metamaskAddress) {
        return res.status(400).json({ status: 'failed', message: 'Missing required metamaskAddress' });
    }

    // Generate the hash from the provided details
    const generatedHash = generateHash(voterID, metamaskAddress);
    console.log(`Generated Hash for Verification: ${generatedHash}`); // ✅ Debugging

    try {
        // Fetch list of pinned files from Pinata
        const pinataRes = await axios.get(`https://api.pinata.cloud/data/pinList`, {
            headers: {
                pinata_api_key: process.env.PINATA_API_KEY,
                pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY
            }
        });

        // Get the list of pinned files
        const pinnedData = pinataRes.data.rows;

        // Check each file on IPFS
        for (const item of pinnedData) {
            const ipfsCID = item.ipfs_pin_hash; // ✅ Fetch the CID of stored data
            
            // Retrieve the actual stored JSON from IPFS
            const fileData = await axios.get(`https://gateway.pinata.cloud/ipfs/${ipfsCID}`);
            
            if (fileData.data.hash === generatedHash) {
                console.log(`✅ Match found in CID: ${ipfsCID}`);
                return res.json({ status: 'success', message: 'Voter verified', cid: ipfsCID });
            }
        }

        return res.status(401).json({ status: 'failed', message: 'Voter not found' });

    } catch (error) {
        console.error('❌ Error verifying voter:', error);
        return res.status(500).json({ status: 'failed', message: 'Error retrieving data from IPFS' });
    }
});

app.post('/api/calculate-votes', async (req, res) => {
    try {
        const Candidates = await candidates.find();

        for (let candidate of Candidates) {
            const voteCount = await contract.methods.votesByCandidateId(candidate.candidateId).call();
            await candidates.updateOne(
                { candidateId: candidate.candidateId },
                { $set: { voteCount: parseInt(voteCount) } }
            );
        }

        res.status(200).json({ message: 'Vote counts updated successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to calculate votes.' });
    }
});

app.post('/send-otp', async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: 'Email is required' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpMap.set(email, otp); // Store OTP in memory (you can also store it in DB with expiry time)

    try {
        // Send OTP email
        const subject = 'Your Voting OTP Code';
        const text = `Your OTP for voting is ${otp}. Do not share it with anyone.`;
        await sendEmail(email, subject, text); // Using the reusable sendEmail function

        res.status(200).json({
            status: 'success',
            message: 'OTP sent successfully',
        });
    } catch (error) {
        console.error('Failed to send OTP:', error);
        res.status(500).json({ message: 'Failed to send OTP' });
    }
});


app.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;

    const storedOtp = otpMap.get(email);
    console.log('storedOtp',storedOtp);
    if (storedOtp === otp) {
        otpMap.delete(email); // OTP used, so remove it
        res.status(200).json({ status: 'success', message: 'OTP verified successfully' });
    } else {
        res.status(400).json({ message: 'Invalid or expired OTP' });
    }
});


app.get('/candidates', async (req, res) => {
    try {
        const { pincode } = req.query;

        // Find candidates matching the pincode
        const candidate = await candidates.find({ pincode });

        if (candidate.length > 0) {
            res.status(200).json(candidate);
        } else {
            res.status(404).json({ message: 'No candidates found for this pincode.' });
        }
    } catch (error) {
        console.error('Error fetching candidates:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
app.get('/api/get-voter-gender-stats', async (req, res) => {
    try {
        const maleCount = await User.countDocuments({ gender: 'male', hasVoted: true });
        const femaleCount = await User.countDocuments({ gender: 'female', hasVoted: true });
        const transgenderCount = await User.countDocuments({ gender: 'transgender', hasVoted: true });

        res.json({ male: maleCount, female: femaleCount, transgender: transgenderCount });
    } catch (error) {
        console.error('Error fetching gender stats:', error);
        res.status(500).json({ message: 'Failed to fetch gender stats' });
    }
});


app.get('/candidate/:id', async (req, res) => {
    try {
        // Trim and validate the ID
        const id = req.params.id.trim();

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        // Fetch candidate by ID
        const candidate = await candidates.findById(new mongoose.Types.ObjectId(id));

        if (!candidate) {
            return res.status(404).json({ error: 'Candidate not found' });
        }

        res.json(candidate);
    } catch (error) {
        console.error('Error fetching candidate:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/party-name/:partyID', async (req, res) => {
    const { partyID } = req.params;
    console.log('Received partyId:', partyID);
    try {
        const party = await candidates.findOne({ partyID: partyID });

        if (party) {
            res.json({ partyName: party.partyName });
        } else {
            res.status(404).json({ message: 'Party not found' });
        }
    } catch (error) {
        console.error('Error fetching party:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        if (req.query.filter === 'pincode') {
            const pincode = req.query.value;
            console.log('userpincode',pincode);
            const totalUsers = await User.countDocuments({ pincode });
            console.log('totalUsers',totalUsers);
            res.json({ totalUsers });
        } else {
            const totalUsers = await User.countDocuments({});
            console.log('totalUsers',totalUsers);
            res.json({ totalUsers });
        }
    } catch (error) {
        res.status(500).send('Error fetching users');
    }
});

// API to get total votes
app.get('/api/votes', async (req, res) => {
    try {
        if (req.query.filter === 'pincode') {
            const pincode = req.query.value;
            console.log('pincode',pincode);
            const totalVotes = await User.countDocuments({ pincode, hasVoted: true });
            console.log('totalVotes',totalVotes);
            res.json({ totalVotes });
        } else {
            const totalVotes = await User.countDocuments({ hasVoted: true });
            console.log('totalVotes',totalVotes);
            res.json({ totalVotes });
        }
    } catch (error) {
        res.status(500).send('Error fetching votes');
    }
});

app.get('/api/votes/status/:aadharNumber', async (req, res) => {
    try {
        const { aadharNumber } = req.params;
        console.log('Received Aadhar Number:', aadharNumber);

        const user = await User.findOne({ aadhar: aadharNumber });

        if (!user) {
            console.log('User not found in database');
            return res.status(404).json({ message: 'User not found' });
        }

        // ✅ Correctly return voting status
        res.json({ hasVoted: user.hasVoted });
    } catch (error) {
        console.error('Error fetching voting status:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

//app.use('/api', require('./routes/electionRoutes'));
app.get('/api/election-timings', async (req, res) => {
    try {
        const timing = await ElectionTiming.findOne();
        res.json(timing);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch election timings' });
    }
});


app.get('/get-user-info/:aadhar', async (req, res) => {
    try {
        const aadhar = req.params.aadhar;
        const user = await User.findOne({ aadhar });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json({
            email: user.email, // assuming username = email
            voterId: user.voterId
        });
    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).json({ message: 'Server error' });
    }
});






// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
