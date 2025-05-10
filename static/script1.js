document.addEventListener('DOMContentLoaded', () => {
    const API_KEY = "YOUR-API-KEY";
    const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${API_KEY}`;
    let uploadedImages = [];
    let totalResults = [];
    let wasteCategories = ["Plastic", "Paper", "Cardboard", "Degradable", "Non-biodegradable", "E-waste", "Miscellaneous"];
    let averagedResults = {};

    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    themeToggle.addEventListener('click', () => {
        body.classList.toggle('light-mode');
        themeToggle.innerHTML = body.classList.contains('light-mode') 
            ? '<i class="fas fa-moon"></i> Dark Mode' 
            : '<i class="fas fa-sun"></i> Light Mode';
    });

    // Card Animation on Scroll
    const cards = document.querySelectorAll('.card');
    function checkCards() {
        const triggerBottom = window.innerHeight * 0.8;
        cards.forEach(card => {
            const cardTop = card.getBoundingClientRect().top;
            card.classList.toggle('active', cardTop < triggerBottom);
        });
    }
    window.addEventListener('scroll', checkCards);
    window.addEventListener('load', checkCards);

    // Animate Stats and Testimonials on Scroll
    const stats = document.querySelectorAll('.stat-card');
    const testimonials = document.querySelectorAll('.testimonial-card');
    const animateOnScroll = elements => {
        elements.forEach(element => {
            const { top, bottom } = element.getBoundingClientRect();
            if (top < window.innerHeight && bottom > 0) {
                element.style.transform = 'translateY(0)';
                element.style.opacity = '1';
            }
        });
    };
    stats.forEach(stat => {
        stat.style.transform = 'translateY(50px)';
        stat.style.opacity = '0';
        stat.style.transition = 'transform 0.6s ease-out, opacity 0.6s ease-out';
    });
    testimonials.forEach(testimonial => {
        testimonial.style.transform = 'translateY(50px)';
        testimonial.style.opacity = '0';
        testimonial.style.transition = 'transform 0.6s ease-out, opacity 0.6s ease-out';
    });
    window.addEventListener('scroll', () => {
        animateOnScroll(stats);
        animateOnScroll(testimonials);
    });
    animateOnScroll(stats);
    animateOnScroll(testimonials);

    // Map Initialization
    const map = L.map('locationMap', {
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
        scrollWheelZoom: true,
        boxZoom: true,
        keyboard: true,
        zoomControl: true
    }).setView([11.1271, 78.6569], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    let marker = L.marker([11.1271, 78.6569])
        .addTo(map)
        .bindPopup('Tamil Nadu, India')
        .openPopup();

    let latitude = null, longitude = null, district = null, waterTable = null, refinedWaterTable = null;

    function onMapClick(e) {
        latitude = e.latlng.lat.toFixed(6);
        longitude = e.latlng.lng.toFixed(6);

        marker.setLatLng(e.latlng)
            .bindPopup(`Latitude: ${latitude}, Longitude: ${longitude}`)
            .openPopup();

        document.getElementById('coordinates').innerHTML = `Latitude: ${latitude}, Longitude: ${longitude}`;
        document.getElementById('water-table').innerHTML = 'Fetching water table data...';
        document.getElementById('refined-water-table').innerHTML = '';
        document.getElementById('district').innerHTML = '';

        document.getElementById('generateReport').style.display = 'none';
        document.getElementById('emailInput').style.display = 'none';
        document.getElementById('sendEmailButton').style.display = 'none';
        document.getElementById('downloadLink').style.display = 'none';

        fetch('/get_water_table', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude: latitude, longitude: longitude })
        })
        .then(response => response.json())
        .then(data => {
            if (!data) throw new Error('No data received');

            district = data.district;
            waterTable = data.water_table_level;
            refinedWaterTable = data.refined_water_table;

            document.getElementById('district').innerHTML = `District: <strong>${district}</strong>`;
            document.getElementById('water-table').innerHTML = `The groundwater level is: <strong>${waterTable} meters</strong>`;
            document.getElementById('refined-water-table').innerHTML = `Gemini AI Prediction: <strong>${refinedWaterTable}</strong>`;

            document.getElementById('generateReport').style.display = 'block';
            document.getElementById('emailInput').style.display = 'block';
            document.getElementById('sendEmailButton').style.display = 'block';
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('water-table').innerHTML = 'Error fetching data!';
            document.getElementById('district').innerHTML = '';
            document.getElementById('refined-water-table').innerHTML = '';
        });
    }

    // Add Search Control using leaflet-geosearch
    const searchControl = new GeoSearch.GeoSearchControl({
        provider: new GeoSearch.OpenStreetMapProvider({
            params: {
                limit: 5,
                countrycodes: 'IN' // Optional: Restrict to India
            }
        }),
        style: 'bar',
        showMarker: false,
        autoClose: true,
        searchLabel: 'Search for a place',
        retainZoomLevel: false,
        animateZoom: true,
        updateMap: false // Prevent plugin from calling fitBounds
    }).addTo(map);

    // Custom search result handling
    map.on('geosearch/showlocation', function (e) {
        if (!e.location || typeof e.location.y !== 'number' || typeof e.location.x !== 'number') {
            console.error('Invalid search result:', e.location);
            alert('Search failed: Invalid location data. Please try a more specific search term.');
            return;
        }

        const latlng = { lat: e.location.y, lng: e.location.x };
        console.log('Search result:', { lat: latlng.lat, lng: latlng.lng, bounds: e.location.bounds });

        map.setView(latlng, 12);
        onMapClick({ latlng: latlng });
    });

    // Log search errors
    map.on('geosearch/error', function (e) {
        console.error('Search error:', e.error);
        alert('Search failed: ' + e.error.message);
    });

    // Waste Analysis Functionality
    document.getElementById("imageInput").addEventListener("change", function() {
        let files = Array.from(this.files);
        let imageContainer = document.getElementById("imageContainer");
        
        files.forEach((file, index) => {
            let reader = new FileReader();
            reader.onload = function(e) {
                let card = document.createElement("div");
                card.className = "image-card";
                card.id = `card-${index}`;
                card.innerHTML = `
                    <button class="delete-btn">X</button>
                    <img src="${e.target.result}" alt="${file.name}">
                    <p><strong>Image:</strong> ${file.name}</p>
                    <p><strong>Depth:</strong> ${document.getElementById("depthInput").value || 'N/A'} meters</p>
                    <p><strong>Years of Dumping:</strong> ${document.getElementById("yearsInput").value || 'N/A'} years</p>
                    <p><strong>Area:</strong> ${document.getElementById("areaInput").value || 'N/A'} sq. meters</p>
                    <button class="analyze-btn">Analyze</button>
                `;
                imageContainer.appendChild(card);

                card.querySelector(".delete-btn").addEventListener("click", () => deleteImage(index));
                card.querySelector(".analyze-btn").addEventListener("click", () => analyzeSingleImage(index));
            };
            reader.readAsDataURL(file);
            uploadedImages.push(file);
        });
        document.getElementById("analyzeAllBtn").style.display = "block";
    });

    function deleteImage(index) {
        uploadedImages.splice(index, 1);
        let imageContainer = document.getElementById("imageContainer");
        imageContainer.innerHTML = "";
        
        uploadedImages.forEach((file, newIndex) => {
            let reader = new FileReader();
            reader.onload = function(e) {
                let card = document.createElement("div");
                card.className = "image-card";
                card.id = `card-${newIndex}`;
                card.innerHTML = `
                    <button class="delete-btn">X</button>
                    <img src="${e.target.result}" alt="${file.name}">
                    <p><strong>Image:</strong> ${file.name}</p>
                    <p><strong>Depth:</strong> ${document.getElementById("depthInput").value || 'N/A'} meters</p>
                    <p><strong>Years of Dumping:</strong> ${document.getElementById("yearsInput").value || 'N/A'} years</p>
                    <p><strong>Area:</strong> ${document.getElementById("areaInput").value || 'N/A'} sq. meters</p>
                    <button class="analyze-btn">Analyze</button>
                `;
                imageContainer.appendChild(card);

                card.querySelector(".delete-btn").addEventListener("click", () => deleteImage(newIndex));
                card.querySelector(".analyze-btn").addEventListener("click", () => analyzeSingleImage(newIndex));
            };
            reader.readAsDataURL(file);
        });
        
        if (uploadedImages.length === 0) {
            document.getElementById("analyzeAllBtn").style.display = "none";
        }
    }

    async function analyzeSingleImage(index) {
        let file = uploadedImages[index];
        let reader = new FileReader();

        reader.onload = async function() {
            let base64Image = reader.result.split(",")[1];
            let depth = document.getElementById("depthInput").value || 0;
            let years = document.getElementById("yearsInput").value || 0;
            let area = document.getElementById("areaInput").value || 0;

            let payload = {
                "contents": [
                    {
                        "parts": [
                            {
                                "inlineData": {
                                    "mimeType": "image/jpeg",
                                    "data": base64Image
                                }
                            },
                            {
                                "text": `Analyze the given image using the following parameters:

- Depth: ${depth} meters
- Area: ${area} square meters
- Years of dumping: ${years} years

*Task:*
1. Identify and categorize waste into: Plastic, Paper, Cardboard, Degradable, Non-biodegradable (excluding plastic), E-waste, Miscellaneous.
2. Estimate the height of the dump from the images (in meters or feet) and refine it using the provided depth.
3. Use the provided area and refined height/depth to estimate the total volume of the dumpyard.
4. Factor in the years of dumping to adjust for decomposition (e.g., degradable waste reduces over time) and accumulation patterns (e.g., older waste compacted at the bottom).
5. Calculate the percentage of each waste type based on image analysis, estimated volume (area × height/depth), and years.

*Output Format (Strict JSON only, no explanations, no extra text):*
{
  "Plastic": XX,
  "Paper": XX,
  "Cardboard": XX,
  "Degradable": XX,
  "Non-biodegradable": XX,
  "E-waste": XX,
  "Miscellaneous": XX
}
(Sum of all values must be exactly 100%)`
                            }
                        ]
                    }
                ]
            };

            try {
                let response = await fetch(URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                let data = await response.json();
                let responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
                let jsonMatch = responseText.match(/\{[\s\S]*?\}/);
                if (jsonMatch) {
                    let jsonResult = JSON.parse(jsonMatch[0]);
                    totalResults.push(jsonResult);
                    updateAveragedResults();
                }
            } catch (error) {
                console.error("Fetch or JSON error:", error);
            }
        };
        reader.readAsDataURL(file);
    }

    async function analyzeAllImages() {
        document.getElementById("loading").style.display = "block";
        totalResults = [];

        for (let i = 0; i < uploadedImages.length; i++) {
            await analyzeSingleImage(i);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        document.getElementById("loading").style.display = "none";
    }

    function updateAveragedResults() {
        averagedResults = {};
        wasteCategories.forEach(category => averagedResults[category] = 0);
        
        totalResults.forEach(result => {
            wasteCategories.forEach(category => {
                if (result[category] !== undefined) {
                    averagedResults[category] += result[category];
                }
            });
        });
        
        wasteCategories.forEach(category => {
            averagedResults[category] = totalResults.length > 0 
                ? (averagedResults[category] / totalResults.length).toFixed(2) 
                : 0;
        });
        
        let resultDiv = document.getElementById("result");
        resultDiv.innerHTML = `<h3>Final Waste Composition (Averaged):</h3>`;
        wasteCategories.forEach(category => {
            resultDiv.innerHTML += `<p><strong>${category}:</strong> ${averagedResults[category]}%</p>`;
        });
    }

    // Add event listener for Analyze All button
    document.getElementById("analyzeAllBtn").addEventListener("click", analyzeAllImages);

    // Report Generation with Dynamic Waste Composition
    document.getElementById('generateReport').addEventListener('click', function () {
        if (!latitude || !longitude || !district || !waterTable || !refinedWaterTable) {
            alert('Please select a location first!');
            return;
        }

        const generateButton = this;
        const loadingSpinner = document.createElement('div');
        loadingSpinner.id = 'loadingSpinner';
        loadingSpinner.innerHTML = `
            <div style="border: 5px solid #f3f3f3; border-top: 5px solid var(--accent-teal); 
                        border-radius: 50%; width: 50px; height: 50px; 
                        animation: spin 1s linear infinite; margin: 0 auto;"></div>
            <p style="text-align:center; font-weight:bold; margin-top: 10px; color: var(--text-light);">Generating Report...</p>
        `;
        document.body.appendChild(loadingSpinner);

        generateButton.disabled = true;
        generateButton.innerText = 'Generating Report...';

        const wasteComposition = Object.keys(averagedResults).length > 0 
            ? `
                - Plastic: ${averagedResults["Plastic"]}%
                - Paper: ${averagedResults["Paper"]}%
                - Cardboard: ${averagedResults["Cardboard"]}%
                - Degradable: ${averagedResults["Degradable"]}%
                - Non-biodegradable: ${averagedResults["Non-biodegradable"]}%
                - E-waste: ${averagedResults["E-waste"]}%
                - Miscellaneous: ${averagedResults["Miscellaneous"]}%
            `
            : `
                - Plastic: 30%
                - Paper: 20%
                - Cardboard: 10%
                - Degradable: 20%
                - Non-biodegradable: 10%
                - E-waste: 5%
                - Miscellaneous: 5%
            `;

        fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyCxAPLuwEEbnObumhwyya6ReF0JUzu4fkU', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Generate a structured Environmental Impact Report (EIR) for the following location:\n\n
                            - Latitude: ${latitude}, Longitude: ${longitude}\n
                            - District: ${district}\n
                            - Groundwater Level: ${waterTable} meters\n
                            - Refined Groundwater Table: ${refinedWaterTable}\n
                            - Waste Composition:\n${wasteComposition}\n\n
                            Include sections on:\n
                            1. Introduction\n
                            2. Environmental and Groundwater Impact Analysis\n
                            3. Waste Management Recommendations\n
                            4. Conclusion\n
                            Format the report with headings, bullet points, and clear structure.`
                    }]
                }]
            })
        })
        .then(response => response.json())
        .then(geminiData => {
            let reportText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Error: No report content received from Gemini.';
            reportText = reportText
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br/>');

            const { jsPDF } = window.jspdf || window;
            if (!jsPDF) throw new Error('jsPDF is not loaded correctly');
            const doc = new jsPDF();
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text('Environmental Impact Report', 20, 20);
            doc.setFontSize(12);
            doc.text(`Location: ${district} (${latitude}, ${longitude})`, 20, 30);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            let y = 40;
            const plainText = reportText.replace(/<strong>/g, "").replace(/<\/strong>/g, "")
                .replace(/<em>/g, "").replace(/<\/em>/g, "").replace(/<br\/>/g, "\n");
            const lines = doc.splitTextToSize(plainText, 170);
            lines.forEach(line => {
                if (y > 270) { doc.addPage(); y = 20; }
                doc.text(line, 20, y);
                y += 5;
            });

            // Generate PDF Blob and Base64
            const pdfBlob = doc.output('blob');
            const pdfBase64 = doc.output('datauristring').split(',')[1]; // Base64 without prefix
            const pdfUrl = window.URL.createObjectURL(pdfBlob);

            // Display PDF above footer
            const footer = document.querySelector('footer');
            let pdfContainer = document.getElementById('pdfContainer');
            if (!pdfContainer) {
                pdfContainer = document.createElement('div');
                pdfContainer.id = 'pdfContainer';
                pdfContainer.style.cssText = 'margin: 20px auto; width: 80%; height: 500px;';
                footer.parentNode.insertBefore(pdfContainer, footer);
            }
            pdfContainer.innerHTML = `<iframe src="${pdfUrl}" width="100%" height="100%" style="border: none;"></iframe>`;

            // Set download link
            document.getElementById('downloadLink').href = pdfUrl;
            document.getElementById('downloadLink').style.display = 'block';

            // Send PDF to Flask server to save and host
            const formData = new FormData();
            const filename = `report_${district}_${Date.now()}.pdf`;
            formData.append('pdf', pdfBlob, filename);
            fetch('/save_pdf', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                window.generatedPdfUrl = data.pdf_url; // Store local hosted URL
            })
            .catch(error => console.error('Error saving PDF:', error));

            generateButton.disabled = false;
            generateButton.innerText = 'Create Report';
            document.getElementById('loadingSpinner').remove();
        })
        .catch(error => {
            console.error('Error generating report:', error);
            alert('Failed to generate report. Please try again.');
            generateButton.disabled = false;
            generateButton.innerText = 'Create Report';
            document.getElementById('loadingSpinner').remove();
        });
    });

    document.getElementById('sendEmailButton').addEventListener('click', function () {
        const email = document.getElementById('emailInput').value;
        if (!email) {
            alert('Please enter an email address.');
            return;
        }
        if (!latitude || !longitude || !district || !waterTable || !refinedWaterTable) {
            alert('Please select a location first!');
            return;
        }
        if (!window.generatedPdfUrl) {
            alert('Please generate the report first!');
            return;
        }

        const sendButton = this;
        sendButton.disabled = true;
        sendButton.innerText = 'Sending...';

        emailjs.send('service_84k4yan', 'template_sko1cwv', {
            to_email: email,
            district: district,
            lat: latitude,
            lon: longitude,
            water_table: waterTable,
            refined_water_table: refinedWaterTable,
            to_name: email.split('@')[0],
            pdf_link: window.generatedPdfUrl // Local hosted URL
        })
        .then(() => {
            alert('Email sent successfully! Check your inbox for the report link.');
            sendButton.disabled = false;
            sendButton.innerText = 'Send Email';
        })
        .catch(error => {
            console.error('Error sending email:', error);
            alert('Failed to send email. Please try again.');
            sendButton.disabled = false;
            sendButton.innerText = 'Send Email';
        });
    });

    map.on('click', onMapClick);
});
