# train_model.py
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, f1_score
import xgboost as xgb
import joblib

# 1. Load the clinical data
print("Loading clinical data...")
df = pd.read_csv("diabetes.csv")

# Separate features and target
X = df.drop(columns=["Outcome"])
y = df["Outcome"]

# 2. Split into Train/Test sets
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# 3. Handle Class Imbalance & Train Model
# We calculate the scale_pos_weight to help XGBoost handle imbalanced data
num_negative = sum(y_train == 0)
num_positive = sum(y_train == 1)
scale_weight = num_negative / num_positive

print("Training high-performance XGBoost Classifier...")
model = xgb.XGBClassifier(
    n_estimators=100,
    max_depth=5,
    learning_rate=0.1,
    scale_pos_weight=scale_weight,
    random_state=42,
    eval_metric="logloss"
)

model.fit(X_train, y_train)

# 4. Evaluate the Model
y_pred = model.predict(X_test)
print("\n--- Model Evaluation ---")
print(classification_report(y_test, y_pred))
print(f"Final F1-Score: {f1_score(y_test, y_pred):.2f}")

# 5. Serialize (Save) the Trained Model Engine
model_filename = "xgboost_diabetes_model.pkl"
joblib.dump(model, model_filename)
print(f"\nSuccess! Model saved safely to disk as '{model_filename}'")
