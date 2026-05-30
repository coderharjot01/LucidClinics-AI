# LucidClinics AI — Concepts & Glossary Guide

This guide breaks down every technical concept, keyword, and library used in the **LucidClinics AI** application. It is designed to act as an educational manual and interview preparation sheet.

---

## 1. Machine Learning & Model Training Concepts

### XGBoost (eXtreme Gradient Boosting)
*   **What it is**: An optimized distributed gradient boosting library. It is one of the most powerful and popular algorithms for structured (tabular) data.
*   **How it works**: It builds an ensemble of weak decision trees sequentially. Each new tree is trained to correct the prediction errors (residuals) made by the previous trees using a gradient descent optimization algorithm on a defined loss function.

### SHAP (Shapley Additive exPlanations)
*   **What it is**: A game-theoretic approach to explain the output of any machine learning model.
*   **How it works**: It treats each feature as a "player" in a cooperative game where the prediction is the "payout". SHAP calculates the average marginal contribution of each feature across all possible feature combinations. 
*   **Why it's important**: Traditional model evaluations show global feature importance, but SHAP gives **local explanations**—showing exactly which features pushed a specific patient's risk higher or lower, and by how much.

### TreeExplainer
*   **What it is**: A specific explainer class in the `shap` library optimized for tree-based models (like XGBoost, LightGBM, CatBoost, and Random Forest).
*   **Why it's used**: Computing exact Shapley values is normally NP-hard (exponential time complexity). `TreeExplainer` uses a specialized algorithm that reduces the computational complexity to polynomial time, enabling instantaneous calculations during live web requests.

### Class Imbalance
*   **What it is**: A dataset scenario where one class significantly outnumbers the other. In diabetes datasets, healthy cases (class 0) are usually much more common than diabetic cases (class 1).
*   **Why it's a problem**: Uncompensated models will bias towards predicting the majority class to get high baseline accuracy, ignoring the minority class.

### `scale_pos_weight`
*   **What it is**: An XGBoost training parameter used to control the balance of positive and negative weights.
*   **Math**: `scale_pos_weight = total_negative_samples / total_positive_samples`
*   **Why it's used**: It tells the algorithm to penalize classification errors on the positive class (diabetic patients) more heavily, forcing the model to learn minor class features.

### Stratified Split (`stratify=y` in `train_test_split`)
*   **What it is**: A data-splitting technique where the split maintains the original class distribution in both sets.
*   **Why it's used**: If a dataset has 35% diabetic patients, setting `stratify=y` ensures that the training set and testing set both contain exactly 35% diabetic cases. This prevents skewing validation statistics.

### F1-Score
*   **What it is**: The harmonic mean of **Precision** (out of all predicted positives, how many were true) and **Recall** (out of all actual positives, how many were caught).
*   **Why it's used**: In medical diagnostics, simple accuracy is a misleading metric. If 95% of a group is healthy, a dummy model that always predicts "healthy" is 95% accurate but catches 0% of the sick. F1-score balances both precision and recall, making it the industry standard for evaluating imbalanced medical classifiers.

### Model Serialization (`joblib.dump` / `joblib.load`)
*   **What it is**: The process of converting an active Python object (like our trained XGBoost classifier) into a binary byte-stream file (`.pkl`) to save it on disk, and reconstructing it later in a different process.
*   **Why it's used**: Training takes time and data. By serializing, we train the model once, save it, and load it instantly in our FastAPI production server without retraining.

---

## 2. Backend API Terms (FastAPI & Uvicorn)

### FastAPI
*   **What it is**: A modern, high-performance web framework for building APIs with Python.
*   **Why it's used**: It is built on ASGI (Asynchronous Server Gateway Interface), making it extremely fast. It automatically generates interactive OpenAPI/Swagger documentation (`/docs`) and integrates native data validation.

### Uvicorn
*   **What it is**: A lightning-fast ASGI web server implementation for Python.
*   **Why it's used**: While FastAPI defines the routing and logic, Uvicorn acts as the network wrapper that listens for incoming HTTP requests and feeds them to the FastAPI application.

### Pydantic (`BaseModel` & `Field`)
*   **What they are**: Pydantic is a data validation and settings management library using Python type annotations.
*   **`BaseModel`**: A base class for creating validated schemas. If a request body doesn't match the schema, FastAPI automatically rejects it with a `422 Unprocessable Entity` error.
*   **`Field`**: Allows adding validation metadata to fields, such as `ge=0` (greater than or equal to 0), `le=300` (less than or equal to 300), and descriptions.

### CORS (`CORSMiddleware`)
*   **What it is**: Cross-Origin Resource Sharing. A browser security mechanism that restricts scripts on a webpage from making requests to a different domain than the one that served the webpage.
*   **Why it's used**: By configuring `allow_origins=["*"]`, we permit web clients hosted on other ports (or domains) to query our backend's prediction routes.

### Static File Mounting (`app.mount` / `StaticFiles`)
*   **What it is**: Instructing the web server to map folder paths directly to URL endpoints.
*   **Why it's used**: We mount `/` to the `frontend/` directory. This tells FastAPI: "If a request does not match my `/api` endpoints, check if there is a matching HTML, CSS, or JS file in the frontend folder and serve it." This hosts the entire application on a single port.

---

## 3. Frontend & Visual Design Concepts

### Glassmorphism
*   **What it is**: A visual design trend characterized by translucent, frosted-glass-like cards.
*   **CSS Properties**: `background: rgba(255,255,255,0.05)`, `backdrop-filter: blur(16px)`, and thin, semi-transparent borders.
*   **Why it's used**: Gives the medical UI a premium, clinical, futuristic aesthetic.

### CSS Custom Properties (`:root` variables)
*   **What they are**: Variables defined in CSS (e.g. `--color-teal: #00f5d4`) that can be reused throughout the stylesheet.
*   **Why they are used**: Centralizes colors, gradients, and font declarations, making the interface easily themeable (e.g., swapping to a light mode).

### SVG Stroke Dasharray & Dashoffset (Risk Gauge)
*   **How it works**: To animate a circular progress bar:
    1. Draw a circle using SVG `<circle>`.
    2. Set `stroke-dasharray` to the circle's circumference ($2\pi r$). This splits the stroke into a single long dash and gap.
    3. Shift the dash using `stroke-dashoffset`. By setting the offset to `circumference - (percentage / 100) * circumference`, only the matching percentage of the circle is filled.
*   **Why it's used**: Creates high-performance, responsive vector graphics animations without heavy Javascript canvas libraries.

### `localStorage`
*   **What it is**: A web storage object that allows developers to save key-value string pairs in the user's web browser cache.
*   **Why it's used**: When the user submits the diagnostics form, the API response is saved in `localStorage`. The script then redirects to `report.html`, which retrieves and reads the data. This passes data smoothly between separate static pages without database overhead.

### Print Media Queries (`@media print`)
*   **What it is**: A CSS block that only applies when a user prints the document or exports it to PDF.
*   **Why it's used**: It hides background neons, navigation headers, and buttons, converting the dark-themed UI into a clean, black-and-white grid suitable for clinical reports or hard copies.
