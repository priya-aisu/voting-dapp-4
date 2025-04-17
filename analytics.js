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

votingContract = new web3.eth.Contract(contractABI, contractAddress);// Get elements
const analyticsButton = document.getElementById('analytics-button');
const analyticsPopup = document.getElementById('analytics-popup');
const closeAnalyticsPopup = document.getElementById('close-analytics-popup');

// Get elements for the nested options
const votesByTimeIntervalButton = document.getElementById('votes-by-time-interval');
const numberOfVotesButton = document.getElementById('number-of-votes');
const timeIntervalPopup = document.getElementById('votes-by-time-interval');
const numberOfVotesPopup = document.getElementById('number-of-votes-popup');
const closeTimeIntervalPopup = document.getElementById('close-time-interval-popup');
const closeNumberOfVotesPopup = document.getElementById('close-number-of-votes-popup');
// Get elements for the analytics buttons
const votesByPincodeButton = document.getElementById('votes-by-pincode');
const pincodeInputDiv = document.getElementById('pincode-input');

// Handle opening Analytics pop-up
analyticsButton.addEventListener('click', () => {
    analyticsPopup.style.display = 'block';
});

// Handle closing Analytics pop-up
closeAnalyticsPopup.addEventListener('click', () => {
    analyticsPopup.style.display = 'none';
});



// Handle closing Number of Votes pop-up
closeNumberOfVotesPopup.addEventListener('click', () => {
    numberOfVotesPopup.style.display = 'none';
    analyticsPopup.style.display = 'block';
});

// Handle the "Votes by Pincode" selection
votesByPincodeButton.addEventListener('click', () => {
    // Display the pincode input field
    pincodeInputDiv.style.display = 'block';
});



let chartInstance; // To hold the Chart.js instance

// Handle "Number of Votes" selection
numberOfVotesButton.addEventListener('click', () => {
    analyticsPopup.style.display = 'none';
    pincodeInputDiv.style.display = 'block'; // Show pincode input
    numberOfVotesPopup.style.display = 'none'; // Hide other popups
});

// Handle submit for Number of Votes
document.getElementById('submit-analytics-button').addEventListener('click', async () => {
    const pincode = document.getElementById('analytics-pincode').value.trim();

    try {
        let labels = [];
        let data = [];

        if (pincode) {
            console.log('pincode',pincode);
            // Fetch data for the specific pincode
            const voteCount = await getVotesByPincode(pincode);
            const totalUsers = await getTotalUsersByPincode(pincode);

            labels = ['Total Votes', 'Total Registered Users'];
            data = [voteCount, totalUsers];
        } else {
            // Fetch data for all pincodes
            const totalVotes = await getTotalVotes();
            const totalUsers = await getTotalUsers();

            labels = ['Total Votes Polled', 'Total Registered Users'];
            data = [totalVotes, totalUsers];
        }

        // Update the chart with new data
        updateChart(labels, data);
    } catch (error) {
        console.error('Error fetching analytics:', error);
        alert('Failed to fetch analytics. Please try again.');
    } finally {
        // Reset the input field and hide the popup
        document.getElementById('analytics-pincode').value = '';
        pincodeInputDiv.style.display = 'none';
        analyticsPopup.style.display = 'none';
    }
});

// Function to initialize or update the bar chart
function updateChart(labels, data) {
    const ctx = document.getElementById('votesChart').getContext('2d');

    if (chartInstance) {
        // Update existing chart
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = data;
        chartInstance.update();
    } else {
        // Create a new chart
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Analytics Data',
                    data: data,
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.2)', // Bar colors
                        'rgba(153, 102, 255, 0.2)',
                    ],
                    borderColor: [
                        'rgba(75, 192, 192, 1)', // Bar border colors
                        'rgba(153, 102, 255, 1)',
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                    },
                    tooltip: {
                        enabled: true,
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Count'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Category'
                        }
                    }
                }
            }
        });
    }
}

// Function to get total number of users for a specific pincode
async function getTotalUsersByPincode(pincode) {
    try {
        const response = await fetch(`http://localhost:3000/api/users?filter=pincode&value=${pincode}`);
        if (!response.ok) throw new Error(`Error fetching total users by pincode: ${response.statusText}`);
        const data = await response.json();
        return data.totalUsers; // Assume the backend returns { totalUsers: number }
    } catch (error) {
        console.error('Error in getTotalUsersByPincode:', error);
        throw error;
    }
}

// Function to get total number of users across all pincodes
async function getTotalUsers() {
    try {
        const response = await fetch('http://localhost:3000/api/users');
        if (!response.ok) throw new Error(`Error fetching total users: ${response.statusText}`);
        const data = await response.json();
        return data.totalUsers; // Assume the backend returns { totalUsers: number }
    } catch (error) {
        console.error('Error in getTotalUsers:', error);
        throw error;
    }
}

// Function to get total number of votes across all pincodes
async function getTotalVotes() {
    try {
        const response = await fetch('http://localhost:3000/api/votes');
        if (!response.ok) throw new Error(`Error fetching total votes: ${response.statusText}`);
        const data = await response.json();
        return data.totalVotes; // Assume the backend returns { totalVotes: number }
    } catch (error) {
        console.error('Error in getTotalVotes:', error);
        throw error;
    }
}

// Function to get vote count by pincode
async function getVotesByPincode(pincode) {
    try {
        const response = await fetch(`http://localhost:3000/api/votes?filter=pincode&value=${pincode}`);
        if (!response.ok) throw new Error(`Error fetching votes by pincode: ${response.statusText}`);
        const data = await response.json();
        return data.totalVotes; // Assume the backend returns { totalVotes: number }
    } catch (error) {
        console.error('Error in getVotesByPincode:', error);
        throw error;
    }
}

// Helper function to display data in a table
function displayTable(data, headers, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // Clear previous data
    const table = document.createElement('table');
    const headerRow = document.createElement('tr');

    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    data.forEach(row => {
        const tr = document.createElement('tr');
        row.forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
        });
        table.appendChild(tr);
    });

    container.appendChild(table);
}

/*// Handle "Votes by Time Interval" selection
votesByTimeIntervalButton.addEventListener('click', () => {
    analyticsPopup.style.display = 'none'; // Hide main analytics popup
    timeIntervalPopup.style.display = 'block'; // Show time interval popup
});

// Handle "Votes by Pincode" within time interval
document.getElementById('votes-by-pincode-time').addEventListener('click', async () => {
    const pincode = prompt('Enter Pincode (optional):');
    const intervals = ['6am-10am', '10am-12am', '12am-2am', '2am-6am'];

    try {
        const results = await Promise.all(
            intervals.map((_, index) =>
                votingContract.methods.getVotesByPincodeAndTimeInterval(
                    pincode || '', // Empty string if no pincode provided
                    index * 4,
                    (index + 1) * 4
                ).call()
            )
        );

        const data = results.map((count, i) => [intervals[i], count]);
        displayTable(data, ['Time Interval', 'Votes'], 'votesChart');
    } catch (error) {
        console.error('Error fetching votes by pincode:', error);
        alert('Failed to fetch data. Please try again.');
    } finally {
        timeIntervalPopup.style.display = 'none'; // Close time interval popup
    }
});

// Handle "Votes by Party ID and Pincode"
document.getElementById('votes-by-party-and-pincode-button-time').addEventListener('click', async () => {
    const partyId = prompt('Enter Party ID:');
    const pincode = prompt('Enter Pincode:');
    const intervals = ['6am-10am', '10am-12am', '12am-2am', '2am-6am'];

    try {
        const results = await Promise.all(
            intervals.map((_, index) =>
                votingContract.methods.getVotesByPartyAndPincodeForIntervals(
                    parseInt(partyId),
                    pincode,
                    index * 4,
                    (index + 1) * 4
                ).call()
            )
        );

        const data = results.map((count, i) => [intervals[i], count]);
        displayTable(data, ['Time Interval', 'Votes'], 'votesChart');
    } catch (error) {
        console.error('Error fetching votes by party ID and pincode:', error);
        alert('Failed to fetch data. Please try again.');
    } finally {
        timeIntervalPopup.style.display = 'none'; // Close time interval popup
    }
});

// Handle "Total Votes" within time interval
document.getElementById('total-votes-time-interval').addEventListener('click', async () => {
    const intervals = ['6am-10am', '10am-12am', '12am-2am', '2am-6am'];

    try {
        const results = await votingContract.methods.getVotesForAllPartiesByIntervals().call();
        const data = results.map((result, index) => [intervals[index], ...result]);

        displayTable(data, ['Time Interval', 'Party ID', 'Votes'], 'votesChart');
    } catch (error) {
        console.error('Error fetching total votes by intervals:', error);
        alert('Failed to fetch data. Please try again.');
    } finally {
        timeIntervalPopup.style.display = 'none'; // Close time interval popup
    }
});

// Close the time interval popup
closeTimeIntervalPopup.addEventListener('click', () => {
    timeIntervalPopup.style.display = 'none';
    analyticsPopup.style.display = 'block'; // Return to analytics popup
});*/
