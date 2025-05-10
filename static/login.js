// static/login.js
document.addEventListener('DOMContentLoaded', () => {
    // Theme Toggle (consistent with your script.js)
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    themeToggle.addEventListener('click', () => {
        body.classList.toggle('light-mode');
        themeToggle.innerHTML = body.classList.contains('light-mode') 
            ? '<i class="fas fa-moon"></i> Dark Mode' 
            : '<i class="fas fa-sun"></i> Light Mode';
    });

    // Firebase Login
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('error-message');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                console.log('Logged in:', userCredential.user);
                window.location.href = '/'; // Redirect to home page
            })
            .catch((error) => {
                errorMessage.textContent = `Error: ${error.message}`;
                console.error('Login error:', error.code, error.message);
            });
    });
});