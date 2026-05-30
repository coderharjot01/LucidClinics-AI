# LucidClinics AI — Project Execution & Updates Journal

This file contains a detailed record of the modifications, command history, and troubleshooting steps executed to build and run the LucidClinics AI prediction engine.

---

## 1. Commands Run (Execution Timeline)

The following commands were run in the terminal to set up the system, install dependencies, resolve conflicts, and run the service:

1. **Initial Dependency Installation**
   ```bash
   pip install xgboost pandas scikit-learn joblib shap
   ```
   *Installs the core ML libraries needed to train the model and generate SHAP values.*

2. **File System Reorganization**
   ```bash
   # Renamed dataset file to match training script expectations
   mv "diabetes (1).csv" "diabetes.csv"

   # Created the backend directory and moved the serialized model
   mkdir -p backend
   mv xgboost_diabetes_model.pkl backend/
   ```

3. **Web Server Dependencies**
   ```bash
   pip install fastapi uvicorn pydantic
   ```
   *Installs the web server framework and data validation libraries for the API backend.*

4. **SHAP Compatibility Bug Fix (Downgrading XGBoost)**
   During initial startup, uvicorn failed with `ValueError: could not convert string to float: '[5E-1]'` due to an incompatibility between XGBoost 3.0.0+ and the SHAP model parser.
   ```bash
   # Downgraded XGBoost to v2.x.x
   pip install "xgboost<3.0.0"

   # Re-trained the model to generate a compatible serialization file
   python train_model.py

   # Moved the updated model file into the backend folder
   mv xgboost_diabetes_model.pkl backend/
   ```

5. **Conflicting Process Management**
   Port 8000 was occupied by a stale process (`backend.app:app`).
   ```bash
   # Identified the conflicting process
   lsof -i :8000
   # Output: COMMAND PID 14014

   # Terminated the process
   kill -9 14014
   ```

6. **Serving the Unified Application**
   ```bash
   # Created a directory for UI screenshots
   mkdir -p assets

   # Started the final unified server
   cd backend
   python main.py
   ```
   *The server is currently running as a background daemon at `http://127.0.0.1:8000`.*

---

## 2. Code Updates & Modifications

### A. Model Retraining (`train_model.py`)
- Adjusted python dependencies to lock `xgboost==2.1.4`.
- Re-ran model training to generate a serialized `xgboost_diabetes_model.pkl` compatible with SHAP's parser.

### B. FastAPI Microservice (`backend/main.py`)
- **Loaded Model & Explainer**: Loads `xgboost_diabetes_model.pkl` using `joblib` and initializes a `shap.TreeExplainer`.
- **Created Endpoints**: Exposes `POST /api/v1/predict` validating input against `PatientDataInput` schema. Computes binary outcomes, risk probabilities, and raw SHAP feature values.
- **Enabled Frontend Hosting**: Mounted `StaticFiles(directory="../frontend", html=True)` at the root path `/` to host and serve the static files from the FastAPI app directly.

### C. Diagnostics Intake Form (`frontend/index.html`)
- Structured a responsive patient intake dashboard layout with Outfit typography and glassmorphic panels.
- Configured 8 numeric input sliders with real-time feedback values.
- Implemented an "Autofill High Risk Demo" button for easy testing.
- Added a full-screen loading spinner to block actions during inference fetch requests.

### D. Stylesheet (`frontend/style.css`)
- Styled a medical dashboard using slate dark tones, glowing borders, and neon indicators.
- Created styled horizontal SHAP bar rows with vertical axes and custom margins.
- Structured an animated SVG risk gauge with dynamic circular strokes.
- Configured a print stylesheet (`@media print`) that removes background colors, buttons, and decorations to export clean, printer-friendly black-and-white PDFs.

### E. Application Logic (`frontend/app.js`)
- Synced slider interactions with text readouts.
- Set up form triggers that POST JSON configurations to relative endpoint `/api/v1/predict`.
- Configured local storage (`localStorage`) to pass model metrics and SHAP matrices to the report page.
- Programmed dynamic SVG progress animations and custom SHAP bar calculators on the report page.
- Created advisory lists reflecting patient risk values and drivers.
