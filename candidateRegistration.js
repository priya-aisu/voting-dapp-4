import { contractAddress, contractABI } from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const candidateForm = document.getElementById('candidate-form');

    
    let web3;
    let contract;

    async function initWeb3() {
        if (window.ethereum) {
            web3 = new Web3(window.ethereum);
            await window.ethereum.request({ method: 'eth_requestAccounts' });
        } else {
            console.error('MetaMask is not installed!');
            alert('Please install MetaMask to interact with the blockchain.');
            return;
        }

        const accounts = await web3.eth.getAccounts();
        console.log('Connected account:', accounts[0]);

        
        contract = new web3.eth.Contract(contractABI, contractAddress);
    }

    
    candidateForm.addEventListener('submit', async (e) => {
        e.preventDefault();

       
        const partyName = document.getElementById('party-name').value;
        const pincode = document.getElementById('pincode').value;
        const candidateName = document.getElementById('candidate-name').value;
        const aadharNumber = document.getElementById('aadhar-number').value;
        const partyID = document.getElementById('party-id').value;
        const candidateId = document.getElementById('candidate-id').value;

        if (!web3 || !contract) {
            alert('Blockchain connection is not initialized.');
            return;
        }

        try {
            const accounts = await web3.eth.getAccounts();
            const owner = accounts[0]; 

         
            console.log('Adding candidate to blockchain...');
            await contract.methods
                .addCandidate(candidateName, parseInt(partyID), pincode)
                .send({ from: owner });

            console.log('Candidate added to blockchain successfully.');

          
            console.log('Saving candidate to the server...');
            const response = await fetch('http://localhost:3000/register-candidate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    partyName,
                    pincode,
                    candidateName,
                    aadharNumber,
                    partyID,
                    candidateId
                }),
            });

            const data = await response.json();

            if (response.ok) {
                alert('Candidate registered successfully in both blockchain and server!');
                console.log('Server response:', data);
                candidateForm.reset();
            } else {
                alert(`Server error: ${data.message}`);
                console.error('Server error:', data);
            }
        } catch (error) {
            console.error('Error registering candidate:', error);
            alert('An error occurred while registering the candidate. Check the console for details.');
        }
    });

    await initWeb3();
});
