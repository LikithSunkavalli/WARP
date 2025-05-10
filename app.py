from flask import Flask, render_template, request, jsonify, send_file, session, redirect, url_for, send_from_directory
from flask_session import Session  # For server-side session management
import pandas as pd
import numpy as np
import requests
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import os
import io
import datetime
import textwrap
import re

app = Flask(__name__)

# Session configuration
app.secret_key = "your-secret-key-here"  # Replace with a secure key (e.g., os.urandom(24).hex())
app.config["SESSION_TYPE"] = "filesystem"  # Use filesystem for session storage
Session(app)

# Configure uploads folder
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Load Excel file once at startup
excel_file = "updated_merged.xlsx"
df = pd.read_excel(excel_file)
df.columns = df.columns.str.strip()

# Define column names
LAT_COL = "Latitude"
LON_COL = "Longitude"
WATER_TABLE_COL = "WaterTableLevel"
DISTRICT_COL = "Distict"

# Google Gemini API Configuration
GEMINI_API_KEY = "YOUR-GEMINI-API-KEY"
GEMINI_API_URL = "YOUR-GEMINI-API-URL"

# Your existing Gemini functions (unchanged)
def get_gemini_groundwater_data(lat, lon, district, water_table_level):
    prompt = (
        f"Given the latitude {lat}, longitude {lon}, in {district} district, "
        f"the estimated groundwater level is {water_table_level} meters. "
        f"Using all geological, hydrological, and environmental factors specific to this location, "
        f"determine the most **precise** groundwater depth. "
        f"Ensure the range is **as small as possible**, ideally within 1-5 meters. "
        f"Strictly output only the numerical value (e.g., '7.2' or '6.8 to 8.1'). "
        f"Do not include any text, explanations, or units—only the raw number."
    )
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    headers = {"Content-Type": "application/json"}
    response = requests.post(GEMINI_API_URL, json=payload, params={"key": GEMINI_API_KEY}, headers=headers)
    if response.status_code == 200:
        try:
            data = response.json()
            return data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "Data Not Available")
        except Exception:
            return "Data Not Available"
    else:
        return f"Error fetching data from Gemini: {response.status_code} - {response.text}"

def find_nearest_water_table(lat, lon):
    if df.empty:
        return {"error": "Water table data not available."}
    df["Distance"] = np.sqrt((df[LAT_COL] - lat) ** 2 + (df[LON_COL] - lon) ** 2)
    nearest_row = df.loc[df["Distance"].idxmin()]
    district = nearest_row.get(DISTRICT_COL, "Unknown District")
    water_table_level = nearest_row.get(WATER_TABLE_COL, "Data Not Available")
    refined_water_table = get_gemini_groundwater_data(lat, lon, district, water_table_level)
    return {
        "latitude": nearest_row.get(LAT_COL, "Unknown"),
        "longitude": nearest_row.get(LON_COL, "Unknown"),
        "water_table_level": water_table_level,
        "district": district,
        "refined_water_table": refined_water_table
    }

def clean_gemini_response(api_result):
    try:
        generated_text = api_result["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        return "No detailed report generated."
    paragraphs = generated_text.split("\n\n")
    return "\n\n".join(textwrap.fill(para, width=80) for para in paragraphs).strip()

def format_text_for_pdf(text):
    text = re.sub(r"\*\*(.*?)\*\*", r"\n<BOLD>\1</BOLD>", text)
    text = re.sub(r"\*(.*?)\*", r"\n<ITALIC>\1</ITALIC>", text)
    return text

def generate_report(lat, lon, district, water_table_level, refined_water_table):
    prompt = (
        f"Title: Environmental and Groundwater Impact Assessment Report of the Dumpyard\n\n"
        f"Objective:\nAnalyze the environmental impact of a dumpyard located at latitude: {lat} and longitude: {lon},\n"
        f"considering its waste composition, height, groundwater level, and rainfall data.\n\n"
        f"Data Provided:\n"
        f"- Dumpyard Location: {lat}, {lon}\n"
        f"- Dumpyard Height: 3 meters\n"
        f"- Waste Composition:\n"
        f"  - Plastics: 30%\n"
        f"  - Biodegradable Waste: 30%\n"
        f"  - Metals: 10%\n"
        f"  - Glass: 10%\n"
        f"  - Other Waste: 20%\n"
        f"- Groundwater Level: {water_table_level} meters\n"
        f"- Refined Groundwater Table Prediction: {refined_water_table}\n"
        f"- Rainfall Data: Analyze the rainfall trends for this location ({lat}, {lon})\n\n"
        f"Report Requirements:\n"
        f"- **Introduction:** Overview of the dumpyard location, size, and waste composition.\n"
        f"- **Impact Analysis:**\n"
        f"  - How plastic waste leads to long-term soil and water contamination.\n"
        f"  - How rainfall infiltrates the dumpyard, affecting groundwater.\n"
        f"  - The role of biodegradable waste in nitrogen pollution and soil degradation.\n"
        f"  - How hazardous chemicals in plastics and other waste affect water quality.\n"
        f"  - Potential risks to human health and local ecosystems.\n"
        f"- **Conclusion & Recommendations:**\n"
        f"  - Whether the dumpyard should be relocated or cleaned.\n"
        f"  - Strategies for waste segregation and water safety measures.\n"
        f"  - Official recommendations for waste management improvements.\n\n"
        f"Generate a formal, structured report based on this data and do not start like the report was generated by you."
    )
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    headers = {"Content-Type": "application/json"}
    try:
        response = requests.post(GEMINI_API_URL, json=payload, params={"key": GEMINI_API_KEY}, headers=headers)
        response.raise_for_status()
        api_result = response.json()
        generated_report = clean_gemini_response(api_result)
    except requests.exceptions.RequestException as e:
        print(f"❌ API Error: {e}")
        generated_report = "No data received from API."
    
    pdf_buffer = io.BytesIO()
    c = canvas.Canvas(pdf_buffer, pagesize=letter)
    def add_text(c, text, x, y, max_width=80):
        wrapped_lines = textwrap.wrap(text, width=max_width)
        for line in wrapped_lines:
            if y < 50:
                c.showPage()
                y = 750
            c.drawString(x, y, line)
            y -= 20
        return y
    
    generated_report = format_text_for_pdf(generated_report)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(100, 750, "Environmental and Groundwater Impact Assessment Report")
    c.setFont("Helvetica", 12)
    y_position = 730
    metadata = (
        f"Date & Time: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"Location: {lat}, {lon} ({district} district)\n"
        f"Groundwater Level: {water_table_level} meters\n"
        f"Refined Groundwater Table: {refined_water_table} meters\n"
        f"Waste Composition:\n"
        f"- Plastics: 30%\n"
        f"- Biodegradable Waste: 30%\n"
        f"- Metals: 10%\n"
        f"- Glass: 10%\n"
        f"- Other Waste: 20%\n"
    )
    y_position = add_text(c, metadata, 100, y_position)
    sections = {
        "Impact Analysis": (
            "- Effects of plastic waste on soil and water contamination.\n"
            "- Impact of rainfall infiltration on groundwater pollution.\n"
            "- Role of nitrogenous biodegradable waste in groundwater degradation.\n"
            "- Presence of hazardous chemicals affecting water quality.\n"
        ),
        "Conclusion & Recommendations": (
            "- Consider relocating or cleaning the dumpyard.\n"
            "- Implement proper waste segregation and treatment.\n"
            "- Ensure water quality monitoring for public health safety.\n"
        ),
        "Generated Report Analysis": generated_report
    }
    for title, content in sections.items():
        c.setFont("Helvetica-Bold", 12)
        y_position = add_text(c, f"\n{title}:", 100, y_position)
        c.setFont("Helvetica", 12)
        y_position = add_text(c, content, 120, y_position)
    c.save()
    pdf_buffer.seek(0)
    return pdf_buffer

# Login page as root
@app.route("/")
def login():
    return render_template("login.html")

# Route to handle login from client-side Firebase
@app.route("/login_handler", methods=["POST"])
def login_handler():
    data = request.get_json()
    user_type = data.get("user_type")
    email = data.get("email")
    
    print(f"Login handler received: user_type={user_type}, email={email}")
    
    if user_type not in ["employee", "public"]:
        print("Invalid user type received")
        return jsonify({"error": "Invalid user type"}), 400
    
    # Store user info in session
    session["user_type"] = user_type
    session["email"] = email
    session["logged_in"] = True
    
    # Determine redirect based on user type
    redirect_url = url_for("index_private") if user_type == "employee" else url_for("index")
    print(f"Redirecting to: {redirect_url}")
    
    return jsonify({"redirect": redirect_url})

# Logout route
@app.route("/logout")
def logout():
    session.pop("user_type", None)
    session.pop("email", None)
    session.pop("logged_in", None)
    return redirect(url_for("login"))

# Private routes for employees
@app.route("/index_private")
def index_private():
    if session.get("logged_in") and session.get("user_type") == "employee":
        return render_template("index_private.html")
    return redirect(url_for("login"))

@app.route("/about_private")
def about_private():
    if session.get("logged_in") and session.get("user_type") == "employee":
        return render_template("about_private.html")
    return redirect(url_for("login"))

@app.route("/services_private")
def services_private():
    if session.get("logged_in") and session.get("user_type") == "employee":
        return render_template("services_private.html")
    return redirect(url_for("login"))

@app.route("/contact_private", methods=["GET", "POST"])
def contact_private():
    if session.get("logged_in") and session.get("user_type") == "employee":
        return render_template("contact_private.html")
    return redirect(url_for("login"))

# Public routes
@app.route("/index")
def index():
    if session.get("logged_in") and session.get("user_type") == "public":
        return render_template("index.html")
    elif session.get("logged_in") and session.get("user_type") == "employee":
        return redirect(url_for("index_private"))
    return redirect(url_for("login"))

@app.route("/about")
def about():
    if session.get("logged_in") and session.get("user_type") == "public":
        return render_template("about.html")
    elif session.get("logged_in") and session.get("user_type") == "employee":
        return redirect(url_for("about_private"))
    return redirect(url_for("login"))

@app.route("/services")
def services():
    if session.get("logged_in") and session.get("user_type") == "public":
        return render_template("services.html")
    elif session.get("logged_in") and session.get("user_type") == "employee":
        return redirect(url_for("services_private"))
    return redirect(url_for("login"))

@app.route("/contact", methods=["GET", "POST"])
def contact():
    if session.get("logged_in") and session.get("user_type") == "public":
        return render_template("contact.html")
    elif session.get("logged_in") and session.get("user_type") == "employee":
        return redirect(url_for("contact_private"))
    return redirect(url_for("login"))

@app.route("/get_water_table", methods=["POST"])
def get_water_table():
    data = request.json
    lat = float(data.get("latitude", 0))
    lon = float(data.get("longitude", 0))
    result = find_nearest_water_table(lat, lon)
    return jsonify(result)

@app.route("/download_report", methods=["POST"])
def download_report():
    try:
        data = request.get_json()
        lat = data.get("lat")
        lon = data.get("lon")
        district = data.get("district")
        water_table = data.get("water_table")
        refined_water_table = data.get("refined_water_table")
        print(f"Received data - Lat: {lat}, Lon: {lon}, District: {district}, Water Table: {water_table}, Refined: {refined_water_table}")
        if not lat or not lon or district is None or water_table is None or refined_water_table is None:
            return jsonify({"error": "Invalid data received"}), 400
        pdf_buffer = generate_report(lat, lon, district, water_table, refined_water_table)
        print("✅ PDF successfully generated.")
        return send_file(
            pdf_buffer,
            as_attachment=True,
            download_name="Groundwater_Report.pdf",
            mimetype="application/pdf"
        )
    except Exception as e:
        print(f"❌ Error generating report: {e}")
        return jsonify({"error": "Failed to generate report"}), 500

# New route to save PDF from frontend
@app.route("/save_pdf", methods=["POST"])
def save_pdf():
    try:
        if 'pdf' not in request.files:
            return jsonify({'error': 'No PDF file provided'}), 400
        
        pdf_file = request.files['pdf']
        filename = pdf_file.filename
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        pdf_file.save(filepath)

        # Generate a local URL
        pdf_url = f"http://localhost:5000/uploads/{filename}"
        return jsonify({'pdf_url': pdf_url}), 200
    except Exception as e:
        print(f"❌ Error saving PDF: {e}")
        return jsonify({'error': 'Failed to save PDF'}), 500

# Route to serve uploaded PDFs
@app.route('/uploads/<filename>')
def serve_pdf(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route("/send_email", methods=["POST"])
def send_email():
    try:
        data = request.get_json()
        email = data.get("email")
        lat = data.get("lat", "0")
        lon = data.get("lon", "0")
        district = data.get("district", "Unknown")
        water_table = data.get("water_table", "N/A")
        refined_water_table = data.get("refined_water_table", "N/A")
        pdf_url = data.get("pdf_url")  # Locally hosted PDF URL from frontend

        if not email or not pdf_url:
            return jsonify({"error": "Email and PDF URL are required"}), 400

        # Email setup
        msg = MIMEMultipart()
        msg["From"] = os.getenv("EMAIL_USER")
        msg["To"] = email
        msg["Subject"] = "Environmental Impact Report - WARP"

        body = (
            f"Dear User,\n\n"
            f"Your Environmental Impact Report is ready. Below are the details:\n\n"
            f"Location: {lat}, {lon} ({district} district)\n"
            f"Groundwater Level: {water_table} meters\n"
            f"Refined Groundwater Table: {refined_water_table}\n\n"
            f"You can download the report here: {pdf_url}\n\n"
            f"Regards,\nWARP Team"
        )
        msg.attach(MIMEText(body, "plain"))

        # Send email
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(os.getenv("EMAIL_USER"), os.getenv("EMAIL_PASS"))
            server.sendmail(msg["From"], msg["To"], msg.as_string())

        print("✅ Email sent successfully!")
        return jsonify({"message": "Email sent successfully!"})
    except smtplib.SMTPAuthenticationError:
        print("❌ SMTP Authentication Error: Check EMAIL_USER and EMAIL_PASS")
        return jsonify({"error": "Authentication failed. Check email credentials."}), 500
    except Exception as e:
        print(f"❌ Error sending email: {e}")
        return jsonify({"error": f"Failed to send email: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True)
