# backend/main.py
import os
import json
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import joblib
import pandas as pd
import numpy as np
import shap
from google import genai
from google.genai import types
from google.genai import errors

app = FastAPI(
    title="LucidClinics AI Advanced Core",
    version="2.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Initialize Engines & Clients on Startup
try:
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Load ML Engine
    model_path = os.path.join(backend_dir, "xgboost_diabetes_model.pkl")
    model = joblib.load(model_path)
    explainer = shap.TreeExplainer(model)
    
    # Load Clinical Guidelines dataset directly
    guidelines_path = os.path.join(backend_dir, "guidelines.json")
    with open(guidelines_path, "r") as f:
        guidelines_db = json.load(f)
    print("Clinical Guidelines loaded successfully.")
    
    # Initialize Google Gemini Client (Requires GEMINI_API_KEY env variable set)
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        ai_client = genai.Client()
        print("Google GenAI SDK Client initialized successfully.")
    else:
        ai_client = None
        print("WARNING: GEMINI_API_KEY not found in environment. Running with local fallback narrative simulator.")
except Exception as e:
    raise RuntimeError(f"Initialization Failed: {str(e)}")


# 2. Pydantic Data Schema
class PatientDataInput(BaseModel):
    pregnancies: Optional[int] = Field(default=None, ge=0)
    glucose: Optional[float] = Field(default=None, ge=0, le=300)
    blood_pressure: Optional[float] = Field(default=None, ge=0, le=200)
    skin_thickness: Optional[float] = Field(default=None, ge=0, le=100)
    insulin: Optional[float] = Field(default=None, ge=0, le=900)
    bmi: Optional[float] = Field(default=None, ge=0, le=70)
    diabetes_pedigree: Optional[float] = Field(default=None, ge=0)
    age: Optional[int] = Field(default=None, ge=0, le=120)


# 3. Main Business Logic Route
@app.post("/api/v1/predict", tags=["Clinical AI Analytics"])
async def predict_risk_and_narrate(patient: PatientDataInput):
    try:
        # A. Process Tabular Data through XGBoost Model
        patient_dict = {
            "Pregnancies": [patient.pregnancies if patient.pregnancies is not None else np.nan],
            "Glucose": [patient.glucose if patient.glucose is not None else np.nan],
            "BloodPressure": [patient.blood_pressure if patient.blood_pressure is not None else np.nan],
            "SkinThickness": [patient.skin_thickness if patient.skin_thickness is not None else np.nan],
            "Insulin": [patient.insulin if patient.insulin is not None else np.nan],
            "BMI": [patient.bmi if patient.bmi is not None else np.nan],
            "DiabetesPedigreeFunction": [patient.diabetes_pedigree if patient.diabetes_pedigree is not None else np.nan],
            "Age": [patient.age if patient.age is not None else np.nan]
        }
        input_df = pd.DataFrame(patient_dict)
        risk_probability = float(model.predict_proba(input_df)[0][1]) * 100

        # B. Compute SHAP explainability to find primary risk driver
        shap_values = explainer(input_df)
        feature_contributions = {col: float(shap_values.values[0][idx]) for idx, col in enumerate(input_df.columns)}
        
        # Determine the #1 metric pushing risk upwards from the KNOWN features
        known_features = [col for col in input_df.columns if not pd.isna(input_df[col].iloc[0])]
        if known_features:
            primary_driver = max(known_features, key=lambda col: feature_contributions[col])
        else:
            primary_driver = max(feature_contributions, key=feature_contributions.get)
        
        # C. Direct Mapping Layer: Retrieve Medical Guidelines matching our top risk driver
        # Map primary risk factor feature names to category keys in guidelines.json
        driver_mapping = {
            "Pregnancies": "BMI",
            "Glucose": "Glucose",
            "BloodPressure": "Glucose",
            "SkinThickness": "BMI",
            "Insulin": "Glucose",
            "BMI": "BMI",
            "DiabetesPedigreeFunction": "Age",
            "Age": "Age"
        }
        category = driver_mapping.get(primary_driver, "Glucose")
        guideline_data = guidelines_db.get(category, guidelines_db["Glucose"])
        retrieved_guideline = "\n".join(guideline_data["recommendations"])

        # D. GenAI Integration Layer: Construct the Prompt with Guardrails
        system_instruction = (
            "You are a secure Clinical AI Scribe. Translate raw diagnostic numbers and "
            "verified medical guidelines into a highly structured, empathetic summary for the patient. "
            "CRITICAL: You are strictly forbidden from fabricating data or giving prescriptions. "
            "You must ground your advice entirely inside the provided Context Guidelines. "
            "Always output a medical disclaimer at the bottom."
        )
        
        # Format unknown parameters cleanly for GenAI prompt
        age_str = f"{patient.age}" if patient.age is not None else "Unknown"
        bmi_str = f"{patient.bmi}" if patient.bmi is not None else "Unknown"
        glucose_str = f"{patient.glucose}" if patient.glucose is not None else "Unknown"

        user_prompt = f"""
        Patient Metrics:
        - Age: {age_str}
        - BMI: {bmi_str}
        - Glucose Level: {glucose_str}
        
        Analysis Metrics:
        - ML Evaluated Diabetes Risk Score: {round(risk_probability, 2)}%
        - Primary Statistical Risk Factor: {primary_driver}
        
        Context Guidelines (Ground Truth):
        {retrieved_guideline}
        
        Generate a 3-bullet-point patient report detailing:
        1. A clear statement summarizing their current calculated risk profile.
        2. A breakdown of how their '{primary_driver}' impactfully affected this score.
        3. Factual, actionable steps strictly matching the Context Guidelines.
        """

        # AI narrative generation is disabled to optimize portal response latency and Sandbox speed
        patient_narrative = "AI consult narrative generation disabled to optimize portal latency."

        # Return the consolidated enterprise-grade response
        return {
            "status": "success",
            "metrics": {
                "risk_percentage": round(risk_probability, 2),
                "primary_driver": primary_driver
            },
            "clinical_grounding": {
                "retrieved_guideline_used": retrieved_guideline
            },
            "ai_patient_report": patient_narrative,
            "explainability": {
                "raw_shap_contributions": feature_contributions,
                "primary_risk_drivers": [primary_driver]
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"System Process Exception: {str(e)}")

# Mount static files to serve the frontend at the root
from fastapi.staticfiles import StaticFiles

frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
