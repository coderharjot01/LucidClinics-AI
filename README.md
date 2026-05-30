# LucidClinics AI — Clinical Risk Diagnostics & Explainability Portal

LucidClinics AI is a high-fidelity web application combining machine learning classification with clinical explainability. By connecting a production-ready **FastAPI microservice** to a beautiful **glassmorphic dashboard**, users can estimate diabetes risks using XGBoost and interpret the model's decisions in real-time via **SHAP (Shapley Additive exPlanations)** game theory.

---

## 📸 Interface Screenshots

### 1. Diagnostics Intake Landing Page
The patient diagnostics portal allows clinicians to enter metabolic attributes (e.g. glucose, BMI, blood pressure) through interactive, validated sliders with a dark glassmorphic design.

![Intake Portal](assets/landing_page.png)

### 2. Clinical Risk & Explainability Report Page
Generates a circular SVG risk gauge with dynamic severity warnings, lists primary risk drivers, displays clinical recommendations, and draws a horizontal SHAP bar chart detailing how much each parameter affected the final risk score.

![Clinical Report](assets/report_page.png)

---

## ⚙️ Architecture & Directory Structure

The project separates backend services (ML execution, model serving) from frontend visuals (HTML, CSS, JS):

```text
NEXCARE/
├── backend/
│   ├── main.py                     # FastAPI application serving static pages & prediction API
│   └── xgboost_diabetes_model.pkl  # Serialized XGBoost model file
├── frontend/
│   ├── index.html                  # Landing page containing patient diagnostics form
│   ├── report.html                 # Clinical risk summary and SHAP graphs
│   ├── style.css                   # Theme tokens, gauges, and print sheets
│   └── app.js                      # API connectors, storage, and visual drawing
├── assets/
│   ├── landing_page.png            # Landing page UI mockup
│   └── report_page.png             # Report page UI mockup
├── train_model.py                  # Training script for the XGBoost classifier
├── diabetes.csv                    # Cleaned training dataset
├── README.md                       # Project overview and run guide (this file)
└── UPDATES.md                      # Detailed command log and update journal
```

---

## 🛠️ Technology Stack

- **Machine Learning Core**:
  - `XGBoost` (v2.1.4): Dynamic ensemble classification.
  - `SHAP` (v0.49.1): Shapley values explaining individual contributions.
  - `Scikit-Learn`: Split-validation and stratified scaling.
  - `Joblib`: Serialization wrapper.
  - `Pandas` & `Numpy`: Analytical pipelines.
- **Backend API**:
  - `FastAPI`: High-speed microservice routing.
  - `Pydantic` (v2.x): Intake schema validation.
  - `Uvicorn`: Local ASGI web server.
- **Frontend Dashboard**:
  - `HTML5` & `Vanilla CSS`: Custom grids, glassmorphism overlays, and transition animations.
  - `Vanilla JS`: Async fetch operations, browser cache handling (`localStorage`), and layout rendering.

---

## 🚀 How to Run locally

### 1. Install Dependencies
Make sure you have python installed, and run:
```bash
pip install xgboost==2.1.4 pandas scikit-learn joblib shap fastapi uvicorn pydantic
```

### 2. Start the Backend API & Frontend Server
Navigate to the root workspace directory and start the server:
```bash
cd backend
python main.py
```
*The FastAPI application will start, load the ML model, and mount the static folder.*

### 3. Open in Browser
Visit the locally served link in your browser:
👉 **[http://127.0.0.1:8000/](http://127.0.0.1:8000/)**

---

## 🖨️ Clinical Export & PDF Generation
When on the report page, click **Export Report (PDF)** or press `Cmd + P` / `Ctrl + P`. A custom print stylesheet will strip out dark background colors and navigation menus, leaving a clean, high-contrast, black-and-white layout suitable for clinical medical records or sharing with patients.
