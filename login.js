document.getElementById('login-button').addEventListener('click', async () => {
    const aadhar = document.getElementById('aadhar').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;

    if (!aadhar || !password || !username) {
        alert('Please enter all required fields.');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, aadhar, password }),
        });

        const result = await response.json();
        console.log('Response:', response);
        console.log('Result:', result);

        if (response.ok && result.user) {
            const voterID = result.user.voterId;
            console.log(voterID);
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            const metamaskAddress = accounts[0];
            console.log('metamaskAddress',metamaskAddress);

            const verificationResponse = await fetch('http://localhost:3000/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voterID, metamaskAddress })
            });

            const verificationResult = await verificationResponse.json();
            console.log('verificationResult',verificationResult);

            if (verificationResponse.ok && verificationResult.status === 'success') {
                console.log(`✅ Voter verified with CID: ${verificationResult.cid}`);
                alert('Voter verified successfully!');
                localStorage.setItem('aadhar', aadhar);
                localStorage.setItem('userPincode', result.user.pincode);
                console.log("User Pincode stored:", result.user.pincode);
                alert('Login successful!');
                
                if (username === 'admin') {
                    window.location.href = './adminDashboard.html';
                } else {
                    window.location.href = './parties.html';
                }
            } else {
                alert('Voter verification failed. Access denied.');
            }
        } else {
            alert(result.message || 'Invalid username or password.');
        }
    } catch (error) {
        console.error('Error during login:', error);
        alert('An error occurred. Please try again.');
    }
});

document.getElementById('vote-button').addEventListener('click', () => {
    if (localStorage.getItem('aadhar') && localStorage.getItem('userPincode')) {
        window.location.href = './candidateDisplay.html';
    } else {
        alert('Please log in first.');
    }
});
