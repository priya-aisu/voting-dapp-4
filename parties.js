document.addEventListener("DOMContentLoaded", async function() {
    try {
        // ✅ Fetch Election Timings from MongoDB
        const response = await fetch('http://localhost:3000/api/election-timings');
        const electionData = await response.json();
        
        if (!electionData) {
            console.error('Election timings not found');
            return;
        }

        const electionStart = electionData.startTime;
        const electionEnd = electionData.endTime;
        const currentTime = Date.now();

        // ✅ Check if Election is Live
        const isElectionLive = currentTime >= electionStart && currentTime <= electionEnd;
        console.log('Election Live:', isElectionLive);

        // ✅ Fetch User's Aadhar Number
        const aadharNumber = localStorage.getItem('aadhar');
        console.log('Aadhar Number:', aadharNumber);

        if (aadharNumber) {
            // ✅ Check if User Already Voted (via Backend API)
            const voteResponse = await fetch(`http://localhost:3000/api/votes/status/${aadharNumber}`);
            if (!voteResponse.ok) {
                console.error('User not found or error in fetching status');
                return;
            }
            const voteData = await voteResponse.json();
            const hasVoted = voteData.hasVoted;

            // ✅ Enable Vote Button If Election is Live & User Hasn't Voted
            const voteButton = document.getElementById('vote-button');
            if (isElectionLive && !hasVoted) {
                voteButton.disabled = false;
            } else {
                voteButton.disabled = true;
            }
        }
    } catch (error) {
        console.error('Error fetching election data:', error);
    }

    // ✅ Handle Vote Button Click
    document.getElementById('vote-button').addEventListener('click', () => {
        if (localStorage.getItem('aadhar') && localStorage.getItem('userPincode')) {
            window.location.href = './candidateDisplay.html';
        } else {
            alert('Please log in first.');
        }
    });

    // ✅ Logout button functionality
document.getElementById("logout-button").addEventListener("click", () => {
    localStorage.removeItem("aadhar");
    localStorage.removeItem("userPincode");
    window.location.href = "./login.html"; // Change to your login page if different
});

});
