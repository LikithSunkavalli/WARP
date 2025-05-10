document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded - index.html");

    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;

    if (!themeToggle) {
        console.error("Theme toggle button not found!");
        return;
    }

    let isLightMode = body.classList.contains('light-mode');
    themeToggle.innerHTML = isLightMode 
        ? '<i class="fas fa-moon"></i> Dark Mode' 
        : '<i class="fas fa-sun"></i> Light Mode';

    themeToggle.addEventListener('click', () => {
        isLightMode = !isLightMode;
        if (isLightMode) {
            body.classList.add('light-mode');
            body.style.backgroundColor = '#d8d8d2';
            body.style.color = '#1e293b';
        } else {
            body.classList.remove('light-mode');
            body.style.backgroundColor = '#1e293b';
            body.style.color = '#f8fafc';
        }
        themeToggle.innerHTML = isLightMode 
            ? '<i class="fas fa-moon"></i> Dark Mode' 
            : '<i class="fas fa-sun"></i> Light Mode';
        console.log("Theme toggled to:", isLightMode ? 'light' : 'dark');
        console.log("Body classes:", body.classList.toString());
        console.log("Computed background-color:", window.getComputedStyle(body).backgroundColor);

        requestAnimationFrame(() => {
            body.style.transition = 'none';
            body.offsetHeight;
            body.style.transition = 'background-color 0.6s ease-out, color 0.6s ease-out';
        });
    });

    // Card Animation on Scroll
    const cards = document.querySelectorAll('.card');
    function checkCards() {
        const triggerBottom = window.innerHeight * 0.8;
        cards.forEach(card => {
            const cardTop = card.getBoundingClientRect().top;
            if (cardTop < triggerBottom) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });
    }
    window.addEventListener('scroll', checkCards);
    checkCards();

    // Animate Stats and Testimonials on Scroll
    const stats = document.querySelectorAll('.stat-card');
    const testimonials = document.querySelectorAll('.testimonial-card');
    const animateOnScroll = elements => {
        const triggerBottom = window.innerHeight * 0.8;
        elements.forEach(element => {
            const { top } = element.getBoundingClientRect();
            if (top < triggerBottom) {
                element.style.transform = 'translateY(0)';
                element.style.opacity = '1';
            } else {
                element.style.transform = 'translateY(50px)';
                element.style.opacity = '0';
            }
        });
    };

    stats.forEach(stat => {
        stat.style.transition = 'transform 0.6s ease-out, opacity 0.6s ease-out';
    });
    testimonials.forEach(testimonial => {
        testimonial.style.transition = 'transform 0.6s ease-out, opacity 0.6s ease-out';
    });
    window.addEventListener('scroll', () => {
        animateOnScroll(stats);
        animateOnScroll(testimonials);
    });
    animateOnScroll(stats);
    animateOnScroll(testimonials);

    // Natural Falling Leaves Animation
    const leaves = document.querySelectorAll('.falling-leaf');
    leaves.forEach(leaf => {
        const leftPos = Math.random() * 100;
        leaf.style.left = `${leftPos}%`;
        const duration = 10 + Math.random() * 10;
        const delay = Math.random() * 5;
        const size = 15 + Math.random() * 10;
        leaf.style.width = `${size}px`;
        leaf.style.height = `${size}px`;
        const animationName = leaf.classList.contains('green-leaf') ? 'fallingGreen' : 'fallingDry';
        leaf.style.animation = `${animationName} ${duration}s linear ${delay}s infinite`;
    });

    // Report Here Button Scroll
    const reportHereBtn = document.getElementById('reportHereBtn');
    reportHereBtn.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('#report-issue').scrollIntoView({ behavior: 'smooth' });
    });

    // Map Initialization
    let map, marker;

    function initMap(lat = 20.5937, lng = 78.9629) {
        const mapElement = document.getElementById("map");
        if (!mapElement) {
            console.error("Map element not found!");
            return;
        }

        mapElement.style.display = "block";
        mapElement.style.height = "300px";

        try {
            map = L.map("map").setView([lat, lng], 15);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "© OpenStreetMap contributors",
            }).addTo(map);
            marker = L.marker([lat, lng], { draggable: true })
                .addTo(map)
                .bindPopup("Drag to adjust location")
                .openPopup();
            updateCoordinates(lat, lng);

            marker.on("dragend", function (event) {
                let position = marker.getLatLng();
                updateCoordinates(position.lat, position.lng);
            });

            console.log("Map initialized successfully at:", lat, lng);
        } catch (error) {
            console.error("Error initializing map:", error);
        }
    }

    function updateCoordinates(lat, lng) {
        document.getElementById("location").value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }

    document.getElementById("location").addEventListener("change", async function () {
        const location = this.value;
        if (location) {
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`
                );
                const data = await response.json();
                if (data.length > 0) {
                    const { lat, lon } = data[0];
                    if (map) {
                        map.setView([parseFloat(lat), parseFloat(lon)], 15);
                        marker.setLatLng([parseFloat(lat), parseFloat(lon)]);
                    } else {
                        initMap(parseFloat(lat), parseFloat(lon));
                    }
                    updateCoordinates(parseFloat(lat), parseFloat(lon));
                } else {
                    alert("Location not found. Please enter a valid address.");
                }
            } catch (error) {
                console.error("Error fetching location:", error);
                alert("Failed to fetch location. Please try again.");
            }
        }
    });

    // EmailJS Initialization and Form Submission
    emailjs.init('mHOKmkvlGWOsdMT-b');

    document.getElementById("reportForm").addEventListener("submit", function (event) {
        event.preventDefault();

        const messageStatus = document.getElementById("message");
        messageStatus.innerText = "Sending...";
        messageStatus.className = "message-status";

        const serviceID = 'service_vmmgyoc';
        const templateID = 'template_kcueexf';

        emailjs.sendForm(serviceID, templateID, this)
            .then(() => {
                messageStatus.innerText = "Report submitted successfully!";
                messageStatus.className = "message-status success";
                this.reset();
                document.getElementById("map").style.display = "none";
                if (map) {
                    map.remove();
                    map = null;
                }
            }, (error) => {
                console.error("EmailJS Error:", error);
                messageStatus.innerText = "Failed to send report: " + error.text;
                messageStatus.className = "message-status error";
            });
    });

    // Initialize map
    initMap();
});