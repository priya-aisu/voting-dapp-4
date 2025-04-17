//import mongoose from 'mongoose'; // Ensure Mongoose is imported
import { contractAddress, contractABI } from './config.js';
//import { candidateSchema } from './models/candidates.js'; // Import the schema

// Compile the schema into a model
//const candidates = mongoose.model('candidates', candidateSchema); // Assign model

let web3;
if (window.ethereum) {
    web3 = new Web3(window.ethereum);
    window.ethereum.request({ method: 'eth_requestAccounts' })
        .then(accounts => {
            console.log('Connected account:', accounts[0]);
        })
        .catch(error => {
            console.error('User denied account access:', error);
            alert('Please enable MetaMask to use this dApp.');
        });
} else {
    console.error('MetaMask not detected!');
    alert('Please install MetaMask to use this dApp.');
}

async function startFingerprintVerification(voterId) {
    return new Promise(async (resolve, reject) => {
        createFingerprintModal();
        const messageBox = document.getElementById('fingerprint-messages');

        // 1. Trigger verification
        await fetch('http://localhost:3000/fingerprint/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voterId })  // Send voterId to Arduino
        });

        // 2. Poll for messages
        const interval = setInterval(async () => {
            try {
                const res = await fetch('http://localhost:3000/serial/messages');
                const data = await res.json();

                if (data.messages) {
                    const allMessages = data.messages.join('\n');
                    messageBox.textContent = allMessages;

                    if (allMessages.includes('VERIFY_SUCCESS')) {
                        const match = allMessages.match(/Fingerprint matched with ID: (\d+)/);
                        if (match) {
                            const verifiedId = parseInt(match[1]);
                            clearInterval(interval);
                            resolve(verifiedId);
                        }
                    } else if (allMessages.includes('Fingerprint not found')) {
                        clearInterval(interval);
                        reject(new Error('Fingerprint not found or not registered.'));
                    }
                }
            } catch (err) {
                clearInterval(interval);
                reject(err);
            }
        }, 1000);
    });
}

// Create and inject modal for fingerprint messages
function createFingerprintModal() {
    const existing = document.getElementById('fingerprint-modal');
    if (existing) return; // Avoid duplicates

    const modal = document.createElement('div');
    modal.id = 'fingerprint-modal';
    modal.style = `
        position: fixed; top: 20%; left: 50%; transform: translateX(-50%);
        background: white; padding: 20px; border: 2px solid #444;
        z-index: 1000; width: 400px; max-height: 300px; overflow-y: auto;
        box-shadow: 0 0 10px rgba(0,0,0,0.5); border-radius: 10px;
    `;

    modal.innerHTML = `
        <h3 style="margin-top:0;">🔒 Fingerprint Verification</h3>
        <pre id="fingerprint-messages" style="background:#f0f0f0; padding:10px; height:150px; overflow:auto;"></pre>
        <button id="close-fingerprint-modal" style="margin-top:10px;">Close</button>
    `;

    document.body.appendChild(modal);

    document.getElementById('close-fingerprint-modal').onclick = () => {
        fetch('http://localhost:3000/serial/clear', {
            method: 'POST'
          });
        modal.remove();
    };
}


const votingContract = new web3.eth.Contract(contractABI, contractAddress);

export async function vote(candidateId) {

    try {
        await fetch('http://localhost:3000/serial/clear', { method: 'POST' });
        console.log('Serial messages cleared after vote.');
      } catch (err) {
        console.error('Error clearing serial messages after vote:', err);
      }
      
    try {
        const aadharNumber = localStorage.getItem('aadhar');
        if (!aadharNumber) {
            alert('Aadhar number not found. Please log in again.');
            return;
        }

         // ✅ Step 0: Fetch email & voterId using aadhar
         const userInfoRes = await fetch(`http://localhost:3000/get-user-info/${aadharNumber}`);
         const userInfo = await userInfoRes.json();
 
         if (!userInfoRes.ok || !userInfo.email || !userInfo.voterId) {
             alert('Failed to fetch user info. Please try again.');
             return;
         }
 
         const email = userInfo.email;
         const voterIdNumber = parseInt(userInfo.voterId, 10);
         if (isNaN(voterIdNumber)) {
             alert('Invalid voter ID retrieved.');
             return;
         }
 

        // ✅ Step 1: Send OTP and retrieve email & voterId
        const sendOtpRes = await fetch('http://localhost:3000/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const sendOtpData = await sendOtpRes.json();

        if (sendOtpData.status !== 'success') {
            alert('Failed to send OTP: ' + sendOtpData.message);
            return;
        }

        const enteredOtp = prompt(`OTP sent to your registered email. Please enter the OTP:`);

        if (!enteredOtp) {
            alert('OTP is required to continue.');
            return;
        }

        // ✅ Step 2: Verify OTP
        const verifyRes = await fetch('http://localhost:3000/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp: enteredOtp })
        });

        const verifyData = await verifyRes.json();
        console.log('verifyData.status',verifyData.status);

        if (verifyData.status !== 'success') {
            alert('Invalid OTP. Please try again.');
            return;
        }

        try {
            const verifiedId = await startFingerprintVerification(voterIdNumber);
        
            if (verifiedId !== voterIdNumber) {
                alert(`❌ Fingerprint ID (${verifiedId}) does not match your Voter ID (${voterIdNumber}). Voting blocked.`);
                return;
            }
        
            alert('✅ Fingerprint verified! Proceeding to vote...');
        
        } catch (err) {
            alert('❌ Fingerprint verification failed: ' + err.message);
            return;
        }           
       
        // Retrieve partyId, pincode, and voterId for the candidate
        const { partyID, pincode } = await getPartyIdAndPincodeByCandidateId(candidateId);
        if (!partyID || !pincode) {
            alert('Failed to retrieve partyId, pincode, or voterId for the selected candidate.');
            return;
        }
                
        const accounts = await web3.eth.getAccounts();
        await votingContract.methods
            .vote(voterIdNumber, parseInt(partyID), pincode)
            .send({ from: accounts[0] }) // Corrected method call
            .on('receipt', (receipt) => {
                console.log('Transaction Receipt:', receipt);
                alert('Vote cast successfully!');
            });

            try {
                const response = await fetch('http://localhost:3000/update-vote-status', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ voterId: voterIdNumber }),
                });
                

                const data = await response.json();
                if (response.ok) {
                    console.log('Vote status updated:', data);
                } else {
                    console.error('Failed to update vote status:', data.message);
                }
            } catch (error) {
                console.error('Error updating vote status:', error);
                alert('Failed to update vote status. Please try again.');
            }
        
    } catch (error) {
        console.error('Error casting vote:', error);
        alert('Failed to cast vote. Please try again.');
    }
}

async function getPartyIdAndPincodeByCandidateId(candidateId) {
    try {
        console.log('candidateId',candidateId);
        const response = await fetch(`http://localhost:3000/candidate/${candidateId}`);
        console.log('response',response);
        if (!response.ok) throw new Error('Failed to fetch candidate data');
        const candidate = await response.json();
        console.log('candidate',candidate);
        return { partyID: candidate.partyID, pincode: candidate.pincode };
    } catch (error) {
        console.error(error);
        return { partyID: null, pincode: null};
    }
}
