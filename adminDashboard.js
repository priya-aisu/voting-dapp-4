import { contractAddress, contractABI } from './config.js';
let web3, votingContract;

if (window.ethereum) {
    web3 = new Web3(window.ethereum);
    window.ethereum.request({ method: 'eth_requestAccounts' })
        .then(accounts => console.log('Connected account:', accounts[0]))
        .catch(_error => alert('MetaMask connection denied.'));
} else {
    alert('Please install MetaMask to use this dApp.');
}

votingContract = new web3.eth.Contract(contractABI, contractAddress);
const dialog = document.getElementById('party-pincode-time-dialog');
const submitButton = document.getElementById('submitPartyPincodeTime');
const closeButton = document.getElementById('closeDialog');

document.addEventListener('DOMContentLoaded', () => {
    const viewResultsPopup = document.getElementById('view-results-popup');
    const partyPincodePopup = document.getElementById('party-pincode-popup');
    const pincodePopup = document.getElementById('pincode-popup');
   
    // Show popup for "View Results"
    document.getElementById('view-results-button').addEventListener('click', () => {
        viewResultsPopup.style.display = 'block';
        document.body.classList.add('show-overlay');
    });

    // Close "View Results" popup
    document.getElementById('close-popup-button').addEventListener('click', () => {
        viewResultsPopup.style.display = 'none';
        document.body.classList.remove('show-overlay');
    });

    
    document.getElementById('total-votes-button').addEventListener('click', async () => {
        try {
           
            const { 0: partyIds, 1: votes } = await votingContract.methods.getTotalVotes().call();
    
            // Fetch partyNames for each partyId from the database
            const results = [];
            for (let i = 0; i < partyIds.length; i++) {
                const partyId = partyIds[i].toString().trim();
                const votesCount = votes[i].toString();
                //console.log('partyId',partyId )
    
                // Fetch the party name from your API
                console.log('partyId:', partyId, 'Type of partyId:', typeof partyId);
                const partyID=Number(partyId);
                console.log('partyID:', partyID, 'Type of partyID:', typeof partyID);
                const response = await fetch(`http://localhost:3000/party-name/${partyID}`);
                console.log('response',response);
                if (!response.ok) {
                    throw new Error('Failed to fetch party name');
                }
                const partyData = await response.json();
                const partyName = partyData.partyName || 'Unknown'; // Fallback if no party name found
    
                // Push the result with partyId, partyName, and votes
                results.push({ partyId, partyName, votes: votesCount });
            }
             // Sort results in descending order by votes
             results.sort((a, b) => b.votes - a.votes);
             const winner = results[0];
             const winnerAnnouncement = `Winner: ${winner.partyName} (Party ID: ${winner.partyId}) with ${winner.votes} votes`;
    
            // Store the results in localStorage
            localStorage.setItem('results', JSON.stringify({ type: 'Total Votes', data: results, winner: winnerAnnouncement }));
            window.location.href = './results.html';
        } catch (error) {
            console.error('Error fetching total votes:', error);
            alert('Failed to fetch total votes. Please try again.');
        }
    });
    
    
    document.getElementById('close-party-pincode-popup').addEventListener('click', () => {
        partyPincodePopup.style.display = 'none';
    });

    document.getElementById('submit-party-pincode-button').addEventListener('click', async () => {
        const partyId = document.getElementById('partyId').value;
        const pincode = document.getElementById('pincode').value;
    
        const votes = await votingContract.methods.getTotalVotesByPartyAndPincode(partyId, pincode).call();
        const results = [{ partyId, pincode, votes: votes.toString() }];
        results.sort((a, b) => b.votes - a.votes);
    
        localStorage.setItem('results', JSON.stringify({ type: `Votes for Party ${partyId} in Pincode ${pincode}`, data: results }));
        window.location.href = './results.html';
    });

    // Show "Votes by Pincode" popup
    document.getElementById('votes-by-pincode-button').addEventListener('click', () => {
        viewResultsPopup.style.display = 'none';
        pincodePopup.style.display = 'block';
    });

    // Show "Votes by Pincode" popup
    document.getElementById('votes-by-party-and-pincode-button').addEventListener('click', () => {
        viewResultsPopup.style.display = 'none';
        partyPincodePopup .style.display = 'block';
    });

    // Close "Votes by Pincode" popup
    document.getElementById('close-pincode-popup').addEventListener('click', () => {
        pincodePopup.style.display = 'none';
    });

    document.getElementById('submit-pincode-button').addEventListener('click', async () => {
        const pincode = document.getElementById('pincode-only').value;
    
        const { 0: partyIds, 1: votes } = await votingContract.methods.getVotesByPincode(pincode).call();
        const results = partyIds.map((id, i) => ({ partyId: id.toString(), votes: votes[i].toString() }));
    
        localStorage.setItem('results', JSON.stringify({ type: `Votes in Pincode ${pincode}`, data: results }));
        window.location.href = './results.html';
    });

    // Open the dialog when the button is clicked
document.getElementById('time-interval-popup').addEventListener('click', () => {
    dialog.showModal(); // Show the dialog box
});

// Close the dialog when clicking "Close"
closeButton.addEventListener('click', () => {
    dialog.close();
});
document.getElementById('submitPartyPincodeTime').addEventListener('click', async () => {
    const timeInterval = document.getElementById('timeIntervalSelect').value;
    
    // Convert time interval to UNIX timestamps
    const [startHour, endHour] = timeInterval.split('-').map(Number);
    const now = new Date();
    const startTime = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, 0, 0).getTime() / 1000);
    const endTime = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, 0, 0).getTime() / 1000);

    try {
        // Call the smart contract function
        const { 0: partyIds, 1: voteCounts, 2: pincodeCounts } = await votingContract.methods
            .getTotalVotesByPartyPincodeAndTime(startTime, endTime)
            .call();

        // Prepare results
        const results = [];
        for (let i = 0; i < partyIds.length; i++) {
            results.push({
                partyId: partyIds[i].toString(),
                votes: voteCounts[i].toString(),
                //pincodeVotes: pincodeCounts[i].toString(),
            });
        }

        // Sort results in descending order by votes
        results.sort((a, b) => b.votes - a.votes);

        // Store in localStorage and redirect to results page
        localStorage.setItem(
            'results',
            JSON.stringify({ type: `Votes from ${timeInterval.replace('-', ' to ')}`, data: results })
        );
        window.location.href = './results.html';
    } catch (error) {
        console.error('Error fetching votes:', error);
        alert('Failed to fetch votes. Please try again.');
    }

    // Close the dialog after submission
    document.getElementById('party-pincode-time-dialog').close();
});

// Close dialog on button click
document.getElementById('closeDialog').addEventListener('click', () => {
    document.getElementById('party-pincode-time-dialog').close();
});


   /** 
    document.getElementById('submit-time-interval-button').addEventListener('click', async () => {
        const timeInterval = document.getElementById('timeInterval').value;
        const partyId = document.getElementById('partyId-input').value; 
        const pincode = document.getElementById('pincode-input').value;
        const [startHour, endHour] = timeInterval.split('-').map(time => {
            const [hour, period] = time.split(':');
            return period === 'AM' ? parseInt(hour) : parseInt(hour) + 12;
        });
    
        const startTime = Math.floor(new Date().setHours(startHour, 0, 0, 0) / 1000);
        const endTime = Math.floor(new Date().setHours(endHour, 0, 0, 0) / 1000);
    
        const votes = await votingContract.methods.getVotesByPartyAndPincodeWithinTime(partyId, pincode, startTime, endTime).call();
        const results = [{ partyId, timeInterval, votes: votes.toString() }];
    
        localStorage.setItem('results', JSON.stringify({ type: `Votes for Party ${partyId} from ${timeInterval}`, data: results }));
        window.location.href = './results.html';
    });**/

    // Logout
    document.getElementById('logout-button').addEventListener('click', () => {
        console.log('Logout initiated');
                localStorage.clear();
                window.location.href = './login.html';
    });

    document.getElementById('register-candidate-button').addEventListener('click', () => {
        
        window.location.href = './candidateRegistration.html';
    });

    document.getElementById('gender-analysis-button').addEventListener('click', async () => {
        try {
            // Fetch gender-based vote counts
            const response = await fetch('http://localhost:3000/api/get-voter-gender-stats');
            if (!response.ok) throw new Error('Failed to fetch gender stats');
    
            const { male, female, transgender } = await response.json();
    
            // Display chart container
            document.getElementById('gender-analysis-chart-container').style.display = 'block';
    
            // Get chart context
            const ctx = document.getElementById('genderVotesChart').getContext('2d');
    
            // Destroy previous chart instance if it exists
            if (window.genderChart) {
                window.genderChart.destroy();
            }
    
            // Create bar chart
            window.genderChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Male', 'Female', 'Transgender'],
                    datasets: [{
                        label: 'Votes Count',
                        data: [male, female, transgender],
                        backgroundColor: ['blue', 'pink', 'purple'],
                        borderColor: ['blue', 'pink', 'purple'],
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
    
        } catch (error) {
            console.error('Error fetching gender vote stats:', error);
            alert('Failed to fetch gender-based vote count.');
        }
    });
    
    // Show the Set Election Timings pop-up when the button is clicked
document.getElementById('set-election-timing-button').addEventListener('click', () => {
    document.getElementById('set-election-timing-popup').style.display = 'block';
});

// Close the Set Election Timings pop-up when the close button is clicked
document.getElementById('close-election-popup-button').addEventListener('click', () => {
    document.getElementById('set-election-timing-popup').style.display = 'none';
});


document.getElementById('save-timings-button').addEventListener('click', async () => {
    const startTime = document.getElementById('start-time').value;
    const endTime = document.getElementById('end-time').value;

    if (!startTime || !endTime) {
        alert('Please select both start and end times.');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/save-election-timings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startTime, endTime })
        });

        const data = await response.json();
        if (response.ok) {
            alert('Election timings saved successfully!');
            document.getElementById('set-election-timing-popup').style.display = 'none';
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error saving election timings:', error);
        alert('Failed to save election timings. Please try again.');
    }
});

});
