import { contractAddress, contractABI } from './config.js';
const signinForm = document.getElementById('signin-form');

let web3;
let votingContract;

async function goBack() {
    window.location.href = "index.html"; // Change "index.html" to your actual home page
}

async function initializeWeb3() {
    if (window.ethereum) {
        try {
            web3 = new Web3(window.ethereum); 
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            console.log('Web3 initialized');
            
            votingContract = new web3.eth.Contract(contractABI, contractAddress);
            console.log("Connected to contract:", votingContract);
        } catch (error) {
            console.error('Error initializing Web3:', error);
            alert('Failed to connect to MetaMask.');
        }
    } else {
        alert('MetaMask is not installed. Please install it.');
    }
}

window.addEventListener('load', initializeWeb3);
window.addEventListener('load', () => {
    // Restore form data if returning from enroll.html
    const savedData = JSON.parse(localStorage.getItem('formData'));
    const enrolled = localStorage.getItem('enrollmentStatus') === 'true';

    if (savedData) {
        for (const [key, value] of Object.entries(savedData)) {
            const input = document.querySelector(`[name="${key}"]`);
            if (input) input.value = value;
        }
    }

    // Enable the submit button if enrollment was successful
    const submitBtn = document.getElementById('submit');
    if (submitBtn && enrolled) {
        submitBtn.disabled = false;
    }
});

const showToast = (message) => {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.className = 'show';
    setTimeout(() => { toast.className = toast.className.replace('show', ''); }, 3000);
};

const generateHash = (voterID, metamaskAddress) => {
    const combinedData = `${voterID.trim().toLowerCase()}-${metamaskAddress.trim().toLowerCase()}-${thumbprintHash.trim().toLowerCase()}`;
    return crypto.createHash('sha256').update(combinedData).digest('hex');
};

const uploadData = async (voterID, metamaskAddress) => {
    if (!voterID || !metamaskAddress) {
        showToast('voter id  or metamask address is missing');
        return;
    }

    try {
        const res = await fetch('http://localhost:3000/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voterID, metamaskAddress})
        });

        const data = await res.json();
        if (data.status === 'success') {
            console.log(`✅ Uploaded Hash: ${data.hash}`);
            showToast(`Uploaded Hash: ${data.hash}`);
            return data.hash;
        } else {
            showToast('Upload failed');
            return null;
        }
    } catch (error) {
        showToast('Upload failed due to network error');
        return null;
    }
};

signinForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!web3 || !votingContract) {
        alert('Blockchain connection not established. Please ensure MetaMask is connected.');
        return;
    }

    const dobInput = document.getElementById('dob').value;
    const dob = new Date(dobInput);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    const isBirthdayPassed =
        today.getMonth() > dob.getMonth() ||
        (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());

    if (age < 18 || (age === 18 && !isBirthdayPassed)) {
        alert('You must be at least 18 years old to sign up.');
        return;
    }
   
    const aadharInput = document.getElementById('aadhar').value;
    if (!/^\d{12}$/.test(aadharInput)) {
        alert('Aadhaar number must be exactly 12 digits.');
        return;
    }

    const mobileInput = document.getElementById('mobile').value;
    if (!/^\d{10}$/.test(mobileInput)) {
        alert('Mobile number must contain exactly 10 digits.');
        return;
    }

    const emailInput = document.getElementById('email').value.trim();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailInput || !emailRegex.test(emailInput)) {
        alert('Please enter a valid email address.');
        return;
    }


    const formData = new FormData(signinForm);
    const data = Object.fromEntries(formData.entries());
    console.log('data',data);
    const accounts = await web3.eth.getAccounts();
    const metamaskAddress = accounts[0];
    console.log('metamaskAddress',metamaskAddress);
    const voterID = data.voterId;
    console.log('data',data);
    //const thumbprintHash = data.thumbprintHash;

    

        try {
        const accounts = await web3.eth.getAccounts();
        console.log('Accounts:', accounts);

               
        await votingContract.methods
            .registerVoter( parseInt(data.voterId),data.name)
            .send({ from: accounts[0] })
            .on('receipt', (receipt) => {
                console.log('Transaction Receipt:', receipt);
                alert('Voter registered successfully on blockchain.');
            });

            const uploadedHash = await uploadData(voterID, metamaskAddress);
            if (!uploadedHash) {
                alert('Failed to upload data to IPFS.');
                return;
            }
            

        // Save voter data to MongoDB
        fetch('http://localhost:3000/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        })
            .then((response) => response.json())
            .then((result) => {
                if (result.success) {
                    // Send confirmation email
                    fetch('http://localhost:3000/sendConfirmationEmail', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            email: data.email,
                            voterId: data.voterId,
                        }),
                    })
                    .then((emailRes) => emailRes.json())
                    .then((emailResult) => {
                        if (emailResult.success) {
                            alert('Account created and confirmation email sent!');
                        } else {
                            alert('Account created, but failed to send confirmation email.');
                        }
                        window.location.href = 'login.html'; // Redirect to login page either way
                    })
                    .catch((emailErr) => {
                        console.error('Email error:', emailErr);
                        alert('Account created, but there was an error sending the confirmation email.');
                        window.location.href = 'login.html';
                    });
                } else {
                    alert(result.message || 'An error occurred. Please try again.');
                }
            })
            .catch((error) => {
                console.error('Error saving to MongoDB:', error);
                alert('Failed to save voter data to the database.');
            });
    } catch (error) {
        console.error('Error registering voter on blockchain:', error);
        alert('Failed to register voter on blockchain. Please try again.');
    }
});
document.getElementById('enroll-btn').addEventListener('click', handleEnroll);


async function handleEnroll() {
    const formData = new FormData(signinForm);
    const data = Object.fromEntries(formData.entries());

    // Store form data
    localStorage.setItem('voterId', data.voterId);
    localStorage.setItem('formData', JSON.stringify(data));
    localStorage.setItem('enrollmentStatus', 'false');

    // Check uniqueness
    try {
        const response = await fetch('http://localhost:3000/check-voter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                voterId: data.voterId, 
                aadhar: data.aadhar, 
                email: data.email, 
                username: data.username
            })
        });

        const result = await response.json();

        if (!result.success) {
            alert(`Duplicate found in: ${result.conflicts.join(', ')}. Please use different values.`);
            return;
        }

        // All good — proceed to enroll
        window.location.href = "enrollThumbprint.html";

    } catch (error) {
        console.error('Error checking voter ID:', error);
        alert('Error checking voter data. Please try again.');
    }
}

// Handle confirm on navigation
function confirmNavigationAndClear(targetUrl) {
    const confirmLeave = confirm("Are you sure you want to leave this page? Your filled details will be lost.");
    if (confirmLeave) {
        localStorage.removeItem("signupFormData");
        localStorage.removeItem("formData");
        localStorage.removeItem("enrollmentStatus");
        window.location.href = targetUrl;
    }
}

document.getElementById('back-button').addEventListener('click', (e) => {
    e.preventDefault();
    confirmNavigationAndClear("login.html");
});

document.getElementById('home-button').addEventListener('click', (e) => {
    e.preventDefault();
    confirmNavigationAndClear("index.html");
});



