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

    // Auto-login if code is saved
    const savedCode = localStorage.getItem('roblox_web_code');
    if (savedCode) {
        codeInput.value = savedCode;
        performLogin(savedCode);
    }

    loginBtn.addEventListener('click', () => {
        const code = codeInput.value;
        if (code.length !== 19) {
            showMessage("Please enter a valid 16-digit code.", false);
            return;
        }
        performLogin(code);
    });

    async function performLogin(code) {
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
                // Save code to local storage so user stays logged in
                localStorage.setItem('roblox_web_code', code);

                // Login successful
                inputGroup.classList.add('hidden');
                logoP.classList.add('hidden');
                
                playerNameSpan.textContent = data.user.username;
                
                if (data.user.avatarUrl) {
                    document.querySelector('.avatar-placeholder').style.backgroundImage = `url('${data.user.avatarUrl}')`;
                }

                // Show dashboard
                dashboard.classList.remove('hidden');
            } else {
                // Invalid code (maybe server restarted and lost it, so we remove it from storage)
                localStorage.removeItem('roblox_web_code');
                showMessage(data.error || "Login failed.", false);
                inputGroup.classList.remove('hidden');
                logoP.classList.remove('hidden');
                dashboard.classList.add('hidden');
            }
        } catch (err) {
            console.error(err);
            showMessage("Server is offline or unreachable.", false);
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = "Connect";
        }
    }

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('roblox_web_code');
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
