import { vote } from './vote.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Logout button functionality
    document.getElementById('logout-button').addEventListener('click', () => {
        // Clear localStorage
        localStorage.clear();

        // Redirect to login page
        window.location.href = './login.html';
    });

    const partyLogos = {
        'Party1': 'color.png',
        'Party2': 'cricketball.png',
        'Party3': 'foot.png',
        'Party4': 'redball.png',
        'Party5': 'basket.jpg',
        'Party6': 'gold.png',
        'Party7': 'tvklogo.jpg',
        'Party8': 'ntklogo.jpg'
    };
    // Function to display candidates
    async function displayCandidates() {
        const userPincode = localStorage.getItem('userPincode');
        console.log('userPincode', userPincode);

        const candidatesContainer = document.getElementById('candidates-container');

        if (!userPincode) {
            candidatesContainer.innerHTML = '<p>Pincode not found. Please log in again.</p>';
            return;
        }

        try {
            // Fetch candidates matching the user's pincode
            const response = await fetch(`http://localhost:3000/candidates?pincode=${userPincode}`);
            const candidates = await response.json();

            if (candidates.length > 0) {
                candidatesContainer.innerHTML = `
                    <table>
                        <thead>
                            <tr>
                                <th>Candidate Name</th>
                                <th>Party Name</th>
                                 <th>Party Logo</th>
                                 <th>Vote</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${candidates.map(candidate => {
                                const logo = partyLogos[candidate.partyName] || 'defaultlogo.png'; // Default logo if not found
                                return `
                                    <tr>
                                        <td>${candidate.candidateName}</td>
                                        <td>${candidate.partyName}</td>
                                        <td><img src="./logos/${logo}" alt="${candidate.partyName} Logo" width="50"></td>                                        
                                        <td><button class="vote-button" data-candidate-id="${candidate._id}">Vote</button></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;
                document.querySelectorAll('.vote-button').forEach(button => {
                    button.addEventListener('click', () => {
                        const candidateId = button.getAttribute('data-candidate-id');
                        vote(candidateId); // Call the imported vote function
                    });
                });
            } else {
                candidatesContainer.innerHTML = '<p>No candidates found for your area.</p>';
            }
        } catch (error) {
            console.error('Error fetching candidates:', error);
            candidatesContainer.innerHTML = '<p>An error occurred while fetching candidates.</p>';
        }
    }
    displayCandidates();
    // Fetch election times and check if it's within the election window
    // fetchElectionTimes();
});
