document.addEventListener('DOMContentLoaded', () => {
    const codeInput = document.getElementById('codeInput');
    const loginBtn = document.getElementById('loginBtn');
    const statusMessage = document.getElementById('statusMessage');
    const dashboard = document.getElementById('dashboard');
    const inputGroup = document.querySelector('.input-group');
    const logoP = document.querySelector('.logo p');
    const playerNameSpan = document.getElementById('playerName');
    const logoutBtn = document.getElementById('logoutBtn');

    // Auto-format the code input to add dashes (e.g., 1111-2222-...)
    codeInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/-/g, '').replace(/[^0-9]/g, '');
        if (value.length > 16) value = value.slice(0, 16);
        
        const match = value.match(/.{1,4}/g);
        if (match) {
            e.target.value = match.join('-');
        } else {
            e.target.value = value;
        }
    });

    loginBtn.addEventListener('click', async () => {
        const code = codeInput.value;
        if (code.length !== 19) {
            showMessage("Please enter a valid 16-digit code.", false);
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = "Connecting...";
        showMessage("", false);

        try {
            // Call the local backend (adjust URL in production)
            const response = await fetch('https://build-ur-base-web.onrender.com/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code: code })
            });

            const data = await response.json();

            if (data.success) {
                // Login successful
                inputGroup.classList.add('hidden');
                logoP.classList.add('hidden');
                
                playerNameSpan.textContent = data.user.username;
                
                // Show dashboard
                dashboard.classList.remove('hidden');
            } else {
                // Invalid code
                showMessage(data.error || "Login failed.", false);
            }
        } catch (err) {
            console.error(err);
            showMessage("Server is offline. Is node.js running?", false);
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = "Connect";
        }
    });

    logoutBtn.addEventListener('click', () => {
        dashboard.classList.add('hidden');
        inputGroup.classList.remove('hidden');
        logoP.classList.remove('hidden');
        codeInput.value = "";
        showMessage("Logged out successfully.", true);
    });

    function showMessage(msg, isSuccess) {
        statusMessage.textContent = msg;
        if (isSuccess) {
            statusMessage.classList.add('success');
        } else {
            statusMessage.classList.remove('success');
        }
    }
});
