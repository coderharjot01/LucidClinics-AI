// frontend/app.js

document.addEventListener("DOMContentLoaded", () => {
    const isReportPage = document.getElementById("risk-gauge-ring") !== null;
    const isIntakePage = document.getElementById("diagnostics-form") !== null;

    // Enable navigation link to report across all pages if a previous analysis exists
    const navReportLink = document.getElementById("nav-report-link");
    if (navReportLink && localStorage.getItem("last_analysis")) {
        navReportLink.href = "report.html";
        navReportLink.style.opacity = "1";
        navReportLink.style.cursor = "pointer";
    }

    if (isReportPage) {
        initReportPage();
    } else if (isIntakePage) {
        initIntakePage();
    }
});

/**
 * INTAKE PAGE LOGIC
 */
function initIntakePage() {
    const form = document.getElementById("diagnostics-form");
    const autofillBtn = document.getElementById("autofill-btn");
    const loadingOverlay = document.getElementById("loading-overlay");

    // Stepper & Wizard Navigation Logic
    let currentStep = 1;
    const steps = document.querySelectorAll(".stepper-step");
    const panes = document.querySelectorAll(".wizard-step-pane");
    const stepLines = document.querySelectorAll(".step-line");

    function showStep(stepNum) {
        currentStep = stepNum;
        
        // Toggle step panes visibility
        panes.forEach(pane => {
            pane.classList.remove("active");
        });
        const activePane = document.getElementById(`step-pane-${stepNum}`);
        if (activePane) activePane.classList.add("active");

        // Update Stepper header states
        steps.forEach(step => {
            const stepVal = parseInt(step.getAttribute("data-step"), 10);
            step.classList.remove("active", "completed");
            if (stepVal === currentStep) {
                step.classList.add("active");
            } else if (stepVal < currentStep) {
                step.classList.add("completed");
            }
        });

        // Update progress connector lines
        stepLines.forEach((line, idx) => {
            line.classList.remove("completed");
            if (idx < currentStep - 1) {
                line.classList.add("completed");
            }
        });

        // Sync and refresh the final review table when reaching Step 4
        if (currentStep === 4) {
            updateReviewTableSummary();
        }
    }

    // Wire up Next / Back navigation buttons
    const nextButtons = document.querySelectorAll(".btn-next");
    nextButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            if (currentStep < 4) {
                showStep(currentStep + 1);
            }
        });
    });

    const prevButtons = document.querySelectorAll(".btn-prev");
    prevButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            if (currentStep > 1) {
                showStep(currentStep - 1);
            }
        });
    });

    // List of input IDs to sync with their display labels
    const sliders = [
        { id: "pregnancies", isFloat: false },
        { id: "glucose", isFloat: false },
        { id: "blood_pressure", isFloat: false },
        { id: "skin_thickness", isFloat: false },
        { id: "insulin", isFloat: false },
        { id: "bmi", isFloat: true },
        { id: "diabetes_pedigree", isFloat: true, decimals: 3 },
        { id: "age", isFloat: false }
    ];

    // Initialize/Sync Slider displays
    sliders.forEach(slider => {
        const inputEl = document.getElementById(slider.id);
        const displayEl = document.getElementById(`${slider.id}-val`);

        if (inputEl && displayEl) {
            // Setup listener
            inputEl.addEventListener("input", (e) => {
                const cb = document.querySelector(`.unknown-checkbox[data-target="${slider.id}"]`);
                if (cb && cb.checked) {
                    displayEl.textContent = "Unknown";
                    return;
                }
                
                let val = parseFloat(e.target.value);
                if (slider.isFloat) {
                    displayEl.textContent = val.toFixed(slider.decimals || 1);
                } else {
                    displayEl.textContent = parseInt(val, 10);
                }
            });
            // Initial trigger
            inputEl.dispatchEvent(new Event("input"));
        }
    });

    // Listen for Unknown checkbox changes
    const unknownCheckboxes = document.querySelectorAll(".unknown-checkbox");
    unknownCheckboxes.forEach(cb => {
        cb.addEventListener("change", (e) => {
            const targetId = e.target.getAttribute("data-target");
            const inputEl = document.getElementById(targetId);
            const displayEl = document.getElementById(`${targetId}-val`);

            if (e.target.checked) {
                inputEl.disabled = true;
                displayEl.textContent = "Unknown";
                displayEl.classList.add("unknown");
            } else {
                inputEl.disabled = false;
                displayEl.classList.remove("unknown");
                // Trigger input update to restore slider value display
                inputEl.dispatchEvent(new Event("input"));
            }
        });
    });

    // Biological Sex Custom logic (Disabling pregnancies for Males)
    const sexSelect = document.getElementById("patient_sex");
    const pregnanciesInput = document.getElementById("pregnancies");
    const pregnanciesDisplay = document.getElementById("pregnancies-val");
    const pregUnknownCheck = document.getElementById("pregnancies-unknown");
    const pregUnknownContainer = document.getElementById("preg-unknown-container");
    const pregHelpText = document.getElementById("pregnancies-help-text");

    if (sexSelect && pregnanciesInput) {
        sexSelect.addEventListener("change", (e) => {
            const sexValue = e.target.value;
            if (sexValue === "male") {
                // Set pregnancies to 0, disable slider and hide unknown checkbox
                pregnanciesInput.value = 0;
                pregnanciesInput.disabled = true;
                
                if (pregUnknownCheck) {
                    pregUnknownCheck.checked = false;
                    pregUnknownCheck.disabled = true;
                }
                if (pregUnknownContainer) {
                    pregUnknownContainer.style.display = "none";
                }
                if (pregnanciesDisplay) {
                    pregnanciesDisplay.textContent = "0";
                    pregnanciesDisplay.classList.remove("unknown");
                }
                if (pregHelpText) {
                    pregHelpText.textContent = "Not applicable (Male record auto-zeroed)";
                    pregHelpText.style.color = "var(--color-teal)";
                }
            } else {
                // Re-enable and restore defaults
                pregnanciesInput.disabled = false;
                if (pregUnknownCheck) {
                    pregUnknownCheck.disabled = false;
                }
                if (pregUnknownContainer) {
                    pregUnknownContainer.style.display = "flex";
                }
                if (pregHelpText) {
                    pregHelpText.textContent = "Number of times pregnant";
                    pregHelpText.style.color = "var(--color-text-muted)";
                }
                pregnanciesInput.dispatchEvent(new Event("input"));
            }
        });
    }

    // Synchronize review table displays
    function updateReviewTableSummary() {
        // Sex
        const sexVal = sexSelect ? sexSelect.options[sexSelect.selectedIndex].text : "Female";
        const trSex = document.querySelector('tr[data-summary-target="sex"]');
        if (trSex) trSex.querySelector('.val').textContent = sexVal;

        // Sliders
        sliders.forEach(slider => {
            const tr = document.querySelector(`tr[data-summary-target="${slider.id}"]`);
            if (!tr) return;

            const isUnknownChecked = document.querySelector(`.unknown-checkbox[data-target="${slider.id}"]`)?.checked;
            
            if (isUnknownChecked) {
                tr.classList.add("row-unknown");
                tr.querySelector('.val').textContent = "Unknown (Excluded)";
            } else {
                tr.classList.remove("row-unknown");
                const sliderVal = parseFloat(document.getElementById(slider.id).value);
                const suffix = slider.id === "age" ? " yrs" : (slider.id === "glucose" || slider.id === "insulin" ? " mg/dL" : "");
                
                if (slider.isFloat) {
                    tr.querySelector('.val').textContent = sliderVal.toFixed(slider.decimals || 1) + suffix;
                } else {
                    tr.querySelector('.val').textContent = parseInt(sliderVal, 10) + suffix;
                }
            }
        });
    }

    // Autofill Demo Data
    autofillBtn.addEventListener("click", () => {
        const demoValues = {
            pregnancies: 6,
            glucose: 148,
            blood_pressure: 72,
            skin_thickness: 35,
            insulin: 155,
            bmi: 33.6,
            diabetes_pedigree: 0.627,
            age: 50
        };

        // Reset sex to female
        if (sexSelect) {
            sexSelect.value = "female";
            sexSelect.dispatchEvent(new Event("change"));
        }

        // Reset unknown checkboxes on autofill
        unknownCheckboxes.forEach(cb => {
            cb.checked = false;
            cb.dispatchEvent(new Event("change"));
        });

        Object.keys(demoValues).forEach(key => {
            const inputEl = document.getElementById(key);
            if (inputEl) {
                inputEl.value = demoValues[key];
                inputEl.dispatchEvent(new Event("input"));
            }
        });
        
        updateReviewTableSummary();
    });

    // Form Submission
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // Show loading screen
        loadingOverlay.classList.add("show");

        // Helper to get value or null if checked as unknown
        const getVal = (id, isFloat) => {
            if (id === "pregnancies" && sexSelect && sexSelect.value === "male") {
                return 0;
            }
            const cb = document.querySelector(`.unknown-checkbox[data-target="${id}"]`);
            if (cb && cb.checked) {
                return null;
            }
            const val = document.getElementById(id).value;
            return isFloat ? parseFloat(val) : parseInt(val, 10);
        };

        // Construct request payload matching FastAPI PatientDataInput
        const payload = {
            pregnancies: getVal("pregnancies", false),
            glucose: getVal("glucose", false),
            blood_pressure: getVal("blood_pressure", false),
            skin_thickness: getVal("skin_thickness", false),
            insulin: getVal("insulin", false),
            bmi: getVal("bmi", true),
            diabetes_pedigree: getVal("diabetes_pedigree", true),
            age: getVal("age", false)
        };

        try {
            const response = await fetch("/api/v1/predict", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Server responded with an error.");
            }

            const data = await response.json();

            // Save results and input details to localStorage
            localStorage.setItem("last_analysis", JSON.stringify(data));
            localStorage.setItem("last_inputs", JSON.stringify(payload));
            localStorage.setItem("patient_sex", sexSelect ? sexSelect.value : "female");

            // Redirect after a brief transition delay for visual comfort
            setTimeout(() => {
                window.location.href = "report.html";
            }, 1000);

        } catch (error) {
            console.error("Analysis Request Failed:", error);
            loadingOverlay.classList.remove("show");
            alert(`Unable to run analysis.\n\nError: ${error.message}\n\nPlease verify that the FastAPI backend server is active by running "python main.py" in your backend directory.`);
        }
    });

    // Default start at step 1
    showStep(1);
}

/**
 * REPORT PAGE LOGIC
 */
function initReportPage() {
    const analysisStr = localStorage.getItem("last_analysis");
    const inputsStr = localStorage.getItem("last_inputs");
    const patientSex = localStorage.getItem("patient_sex") || "female";

    // Force redirect to Intake if no data exists
    if (!analysisStr || !inputsStr) {
        window.location.href = "intake.html";
        return;
    }

    const data = JSON.parse(analysisStr);
    const inputs = JSON.parse(inputsStr);

    const prediction = data.prediction || {};
    const metrics = data.metrics || {};
    const explainability = data.explainability || {};

    // Generate and display dynamic patient reference details
    const randomId = "PT-" + Math.floor(1000 + Math.random() * 9000) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const ageVal = inputs.age !== null ? `${inputs.age} yrs` : "Unknown";
    const bmiVal = inputs.bmi !== null ? `${inputs.bmi.toFixed(1)} BMI` : "Unknown";
    const sexVal = patientSex.charAt(0).toUpperCase() + patientSex.slice(1);
    
    // Add reference details somewhere in the header dynamically
    const heroP = document.querySelector(".hero p");
    if (heroP) {
        heroP.innerHTML = `Assessment generated for Patient Reference: <strong>${randomId}</strong> (${sexVal}, ${ageVal}, ${bmiVal}).`;
    }

    // 1. Update Core Risk Output Labels
    const riskPercentage = metrics.risk_percentage !== undefined ? metrics.risk_percentage : (prediction.risk_percentage || 0.0);
    const riskPercentValDisplay = document.getElementById("risk-percentage-val");
    if (riskPercentValDisplay) {
        riskPercentValDisplay.textContent = `${riskPercentage.toFixed(1)}%`;
    }
    
    // Set risk classification badge details
    const badge = document.getElementById("risk-badge");
    if (badge) {
        let riskClass = "low";
        let badgeText = "Low Risk";
        let themeColor = "var(--color-success)";

        if (riskPercentage >= 60) {
            riskClass = "high";
            badgeText = "High Risk";
            themeColor = "var(--color-danger)";
        } else if (riskPercentage >= 30) {
            riskClass = "moderate";
            badgeText = "Moderate Risk";
            themeColor = "var(--color-warning)";
        }

        badge.className = `risk-level-badge ${riskClass}`;
        badge.textContent = badgeText;

        // 2. Animate Circular Risk Gauge
        const circle = document.getElementById("risk-gauge-ring");
        if (circle) {
            const radius = circle.r.baseVal.value;
            const circumference = 2 * Math.PI * radius;
            
            // Set stroke configuration
            circle.style.strokeDasharray = `${circumference} ${circumference}`;
            circle.style.stroke = themeColor;
            
            // Animate progress ring load after a slight delay
            setTimeout(() => {
                const offset = circumference - (riskPercentage / 100) * circumference;
                circle.style.strokeDashoffset = offset;
            }, 100);
        }
    }

    // 3. Populate Primary Risk Drivers
    const driversContainer = document.getElementById("primary-drivers-container");
    if (driversContainer) {
        driversContainer.innerHTML = "";
        const primaryDrivers = explainability.primary_risk_drivers;
        
        if (primaryDrivers && primaryDrivers.length > 0 && primaryDrivers[0] !== "None identified") {
            primaryDrivers.forEach(driver => {
                const pill = document.createElement("span");
                pill.className = "driver-pill";
                pill.textContent = getFriendlyName(driver);
                driversContainer.appendChild(pill);
            });
        } else {
            const pill = document.createElement("span");
            pill.className = "driver-pill";
            pill.style.borderColor = "var(--border-color)";
            pill.style.color = "var(--color-text-muted)";
            pill.style.background = "rgba(255,255,255,0.02)";
            pill.textContent = "No Major High-Risk Drivers";
            driversContainer.appendChild(pill);
        }
    }

    // 4. Generate Clinical Recommendation Checklists
    const notesContainer = document.getElementById("clinical-recommendations");
    const carePlanListContainer = document.getElementById("care-plan-list");
    const primaryDrivers = explainability.primary_risk_drivers || [];
    const recommendations = generateRecommendations(primaryDrivers, riskPercentage);

    if (notesContainer) {
        notesContainer.innerHTML = "";
        recommendations.forEach(rec => {
            const li = document.createElement("li");
            li.textContent = rec;
            notesContainer.appendChild(li);
        });
    }

    if (carePlanListContainer) {
        carePlanListContainer.innerHTML = "";
        recommendations.forEach((rec, index) => {
            const item = document.createElement("div");
            item.className = "care-plan-item";
            item.innerHTML = `
                <div class="care-plan-checkbox"></div>
                <div class="care-plan-text">${rec}</div>
            `;
            
            // Interactive toggle state
            item.addEventListener("click", () => {
                item.classList.toggle("completed");
            });

            carePlanListContainer.appendChild(item);
        });
    }

    // 5. Render custom horizontal SHAP Bar Chart
    const shapChartContainer = document.getElementById("shap-chart");
    if (shapChartContainer) {
        renderShapChart(explainability.raw_shap_contributions);
    }

    // 5b. Initialise 3D Anatomy Visualizer (Supports WebGL / Canvas Fallback)
    init3DAnatomy("anatomy-3d-container", riskPercentage);

    // Inject AI consult narrative
    const narrativeContainer = document.getElementById("ai-narrative-text");
    if (narrativeContainer) {
        const narrativeText = data.ai_patient_report || data.clinical_narrative;
        if (narrativeText) {
            narrativeContainer.innerHTML = parseMarkdownToHtml(narrativeText);
        } else {
            narrativeContainer.innerHTML = "<p style='color: var(--color-text-muted);'>No narrative summary available.</p>";
        }
    }

    // 6. Action Button Listeners
    const btnNewTest = document.getElementById("btn-new-test");
    if (btnNewTest) {
        btnNewTest.addEventListener("click", () => {
            window.location.href = "intake.html";
        });
    }

    const btnPrint = document.getElementById("btn-print");
    if (btnPrint) {
        btnPrint.addEventListener("click", () => {
            window.print();
        });
    }
}

/**
 * Simple parser to convert Markdown into HTML elements
 */
function parseMarkdownToHtml(markdown) {
    if (!markdown) return "";
    
    // Replace headers and bold texts
    let processed = markdown
        .replace(/### (.*)/g, '<h3>$1</h3>')
        .replace(/#### (.*)/g, '<h4>$1</h4>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
    const lines = processed.split('\n');
    let inList = false;
    let htmlOutput = "";
    
    lines.forEach(line => {
        let trimmed = line.trim();
        if (trimmed.startsWith('- ')) {
            if (!inList) {
                htmlOutput += "<ul>";
                inList = true;
            }
            htmlOutput += `<li>${trimmed.substring(2)}</li>`;
        } else {
            if (inList) {
                htmlOutput += "</ul>";
                inList = false;
            }
            if (trimmed) {
                if (trimmed.startsWith('<h3') || trimmed.startsWith('<h4') || trimmed.startsWith('<ul') || trimmed.startsWith('<li')) {
                    htmlOutput += trimmed;
                } else {
                    htmlOutput += `<p>${trimmed}</p>`;
                }
            }
        }
    });
    
    if (inList) {
        htmlOutput += "</ul>";
    }
    
    return htmlOutput;
}

/**
 * Utility to map dataframe feature keys to reader-friendly terms
 */
function getFriendlyName(key) {
    const mappings = {
        Pregnancies: "Pregnancies",
        Glucose: "Glucose Level",
        BloodPressure: "Blood Pressure",
        SkinThickness: "Skin Fold Thickness",
        Insulin: "2-Hour Insulin",
        BMI: "Body Mass Index",
        DiabetesPedigreeFunction: "Pedigree (Genetic Index)",
        Age: "Patient Age"
    };
    return mappings[key] || key;
}

/**
 * Generate medical context recommendations based on specific SHAP risk drivers
 */
function generateRecommendations(drivers, score) {
    const recs = [];

    if (score >= 60) {
        recs.push("Schedule a comprehensive diagnostic evaluation, including HbA1c and fasting plasma glucose tests, to confirm clinical status.");
        recs.push("Recommend immediate review by an endocrinologist and a registered dietitian to establish glycemic control programs.");
    } else if (score >= 30) {
        recs.push("Recommend regular diagnostic screenings (every 6 to 12 months) to monitor glycemic variations.");
        recs.push("Encourage preventive lifestyle modifications focusing on dietary fiber intake and moderate physical exercise.");
    } else {
        recs.push("Maintain standard wellness evaluations and routine checkups.");
        recs.push("Advise maintaining stable healthy nutrition and balanced physical activities.");
    }

    // Specific feature checks
    drivers.forEach(driver => {
        if (driver === "Glucose") {
            recs.push("Prioritize restriction of high-glycemic carbohydrates and monitor blood sugar levels pre- and post-meals.");
        }
        if (driver === "BMI") {
            recs.push("Collaborate on weight management pathways targeting a 5-10% gradual reduction in body mass.");
        }
        if (driver === "BloodPressure") {
            recs.push("Adopt dietary patterns (such as DASH diet) aimed at reducing sodium intake and managing blood pressure below 130/80 mm Hg.");
        }
        if (driver === "DiabetesPedigreeFunction") {
            recs.push("Consider family medical counseling to evaluate genetic patterns of endocrine complications.");
        }
    });

    return recs;
}

/**
 * Render the SHAP Explanation Chart using HTML/CSS
 */
function renderShapChart(contributions) {
    const container = document.getElementById("shap-chart");
    if (!container) return;
    
    container.innerHTML = "";

    // Find the maximum absolute SHAP value to normalize the width calculations
    let maxAbsValue = 0.05; // Set base minimum to avoid division by zero
    Object.keys(contributions).forEach(key => {
        const val = Math.abs(contributions[key]);
        if (val > maxAbsValue) {
            maxAbsValue = val;
        }
    });

    // Generate bar rows for each feature
    Object.keys(contributions).forEach((key, index) => {
        const value = contributions[key];
        const isPositive = value >= 0;
        
        // Calculate width percentage relative to half the chart width (50%)
        // We cap the max percentage width at 48% to leave margins
        const percentageWidth = Math.min((Math.abs(value) / maxAbsValue) * 48, 48);

        const row = document.createElement("div");
        row.className = "shap-bar-row";

        // 1. Label
        const label = document.createElement("div");
        label.className = "shap-bar-label";
        label.textContent = getFriendlyName(key);
        row.appendChild(label);

        // 2. Bar Wrapper
        const barWrapper = document.createElement("div");
        barWrapper.className = "shap-bar-wrapper";

        // Center line
        const axis = document.createElement("div");
        axis.className = "shap-bar-axis";
        barWrapper.appendChild(axis);

        // Horizontal filling bar
        const fill = document.createElement("div");
        fill.className = `shap-bar-fill ${isPositive ? 'positive' : 'negative'}`;
        // Set width 0 initially to trigger CSS transition animation
        fill.style.width = "0%";
        barWrapper.appendChild(fill);
        row.appendChild(barWrapper);

        // 3. Value indicator
        const valueDisplay = document.createElement("div");
        valueDisplay.className = `shap-bar-value ${isPositive ? 'positive' : 'negative'}`;
        valueDisplay.textContent = (isPositive ? "+" : "") + value.toFixed(3);
        row.appendChild(valueDisplay);

        container.appendChild(row);

        // Animate the widths sequentially
        setTimeout(() => {
            fill.style.width = `${percentageWidth}%`;
        }, 100 + (index * 80)); // Cascading delay effect
    });
}

/**
 * 3D ANATOMICAL / METABOLIC SIMULATION (Three.js WebGL with HTML5 Canvas Fallback)
 */
function init3DAnatomy(containerId, riskScore) {
    const container = document.getElementById(containerId);
    const statusText = document.getElementById("visualizer-status-text");
    if (!container) return;
    
    // Clear container
    container.innerHTML = "";

    // Determine simulation profile based on risk
    let themeColor = 0x00f5d4; // teal default
    let speedMultiplier = 1.0;
    let particleBehavior = "normal"; // normal, warning, severe
    let statusMsg = "";
    let statusClass = "";

    if (riskScore >= 60) {
        themeColor = 0xef4444; // red
        speedMultiplier = 2.5; // frantic
        particleBehavior = "severe";
        statusMsg = "Status: High Glycemic Load — Severe Insulin Resistance";
        statusClass = "status-high";
    } else if (riskScore >= 30) {
        themeColor = 0xf59e0b; // amber
        speedMultiplier = 1.6;
        particleBehavior = "warning";
        statusMsg = "Status: Borderline Glycemic Stress — Impaired Sensitivity";
        statusClass = "status-moderate";
    } else {
        themeColor = 0x10b981; // green
        speedMultiplier = 0.8; // calm
        particleBehavior = "normal";
        statusMsg = "Status: Healthy Glycemic Flow — Optimal Endocrine Activity";
        statusClass = "status-low";
    }

    if (statusText) {
        statusText.textContent = statusMsg;
        statusText.className = "visualizer-status " + statusClass;
    }

    // Fallback: If Three.js fails to load, use high-fidelity HTML5 Canvas 2D 3D-projection engine
    if (typeof THREE === "undefined") {
        console.warn("Three.js not loaded. Initialising custom WebGL Canvas 2D 3D-projection engine fallback.");
        runCanvas2DFallback(container, speedMultiplier, themeColor, particleBehavior);
        return;
    }

    try {
        // Setup Three.js Scene
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x060910, 0.05);

        // Setup Camera
        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.z = 6.5;

        // Setup WebGL Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setClearColor(0x000000, 0); // Transparent canvas background
        container.appendChild(renderer.domElement);

        // Group to hold all objects (allows easy drag-to-rotate)
        const mainGroup = new THREE.Group();
        scene.add(mainGroup);

        // 1. Create Central Cell/Organ Structure (Metabolic Receptor Node)
        const organGroup = new THREE.Group();
        mainGroup.add(organGroup);

        // Inner glowing core
        const coreGeo = new THREE.IcosahedronGeometry(1.1, 2);
        const coreMat = new THREE.MeshBasicMaterial({
            color: themeColor,
            wireframe: true,
            transparent: true,
            opacity: 0.15
        });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        organGroup.add(coreMesh);

        // Middle structure - solid with phong shading
        const midGeo = new THREE.IcosahedronGeometry(0.8, 1);
        const midMat = new THREE.MeshPhongMaterial({
            color: themeColor,
            emissive: themeColor,
            emissiveIntensity: 0.15,
            shininess: 100,
            flatShading: true,
            transparent: true,
            opacity: 0.85
        });
        const midMesh = new THREE.Mesh(midGeo, midMat);
        organGroup.add(midMesh);

        // Outer wireframe orbit rings
        const ringGeo = new THREE.TorusGeometry(1.4, 0.02, 8, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            color: themeColor,
            transparent: true,
            opacity: 0.3
        });
        
        const ring1 = new THREE.Mesh(ringGeo, ringMat);
        const ring2 = new THREE.Mesh(ringGeo, ringMat);
        ring2.rotation.x = Math.PI / 2;
        const ring3 = new THREE.Mesh(ringGeo, ringMat);
        ring3.rotation.y = Math.PI / 4;
        
        organGroup.add(ring1);
        organGroup.add(ring2);
        organGroup.add(ring3);

        // 2. Create Floating Particles System (Glucose and Insulin Molecules)
        const particleCount = 120;
        const particleGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3); // For blue and purple tinting
        const initialData = []; // Store speed, radius, angle, axis info for custom orbits

        // Color definitions for blue (0x00bbf9) and purple (0x7209b7)
        const colorBlue = new THREE.Color(0x00bbf9);
        const colorPurple = new THREE.Color(0x7209b7);

        for (let i = 0; i < particleCount; i++) {
            // Orbit parameters
            const radius = 1.5 + Math.random() * 2.5;
            const angle = Math.random() * Math.PI * 2;
            const speed = (0.01 + Math.random() * 0.02) * speedMultiplier;
            const yOffset = (Math.random() - 0.5) * 1.5;
            
            initialData.push({ radius, angle, speed, yOffset });

            // Calculate initial cartesian coordinates
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = yOffset;

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            // Randomly assign blue or purple
            const pColor = Math.random() > 0.5 ? colorBlue : colorPurple;
            colors[i * 3] = pColor.r;
            colors[i * 3 + 1] = pColor.g;
            colors[i * 3 + 2] = pColor.b;
        }

        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Custom glowing point material (using white texture so vertex colors can tint it)
        const pTexture = createCircleTexture();
        const particleMat = new THREE.PointsMaterial({
            size: 0.15,
            map: pTexture,
            vertexColors: true, // Enable vertex colors!
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.8
        });

        const particleSystem = new THREE.Points(particleGeo, particleMat);
        mainGroup.add(particleSystem);

        // 3. Add Ambient & Directional Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight1.position.set(5, 5, 5);
        scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(themeColor, 0.6);
        dirLight2.position.set(-5, -5, -5);
        scene.add(dirLight2);

        // Point light inside the core for central glow
        const pointLight = new THREE.PointLight(themeColor, 1.5, 10);
        pointLight.position.set(0, 0, 0);
        scene.add(pointLight);

        // Helper: Canvas Texture for Circle Particles (White gradient, tinted by vertex colors)
        function createCircleTexture() {
            const pCanvas = document.createElement('canvas');
            pCanvas.width = 16;
            pCanvas.height = 16;
            const ctx = pCanvas.getContext('2d');
            const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
            
            grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
            grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 16, 16);
            
            return new THREE.CanvasTexture(pCanvas);
        }

        // 4. Mouse Drag Navigation Controls (Custom Rotation Handler)
        let isDragging = false;
        let prevMouseX = 0;
        let prevMouseY = 0;

        container.addEventListener('mousedown', (e) => {
            isDragging = true;
            prevMouseX = e.clientX;
            prevMouseY = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - prevMouseX;
            const deltaY = e.clientY - prevMouseY;
            
            mainGroup.rotation.y += deltaX * 0.007;
            mainGroup.rotation.x += deltaY * 0.007;
            
            prevMouseX = e.clientX;
            prevMouseY = e.clientY;
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Touch Support for mobile drag
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isDragging = true;
                prevMouseX = e.touches[0].clientX;
                prevMouseY = e.touches[0].clientY;
            }
        });

        window.addEventListener('touchmove', (e) => {
            if (!isDragging || e.touches.length !== 1) return;
            const deltaX = e.touches[0].clientX - prevMouseX;
            const deltaY = e.touches[0].clientY - prevMouseY;
            
            mainGroup.rotation.y += deltaX * 0.007;
            mainGroup.rotation.x += deltaY * 0.007;
            
            prevMouseX = e.touches[0].clientX;
            prevMouseY = e.touches[0].clientY;
        });

        window.addEventListener('touchend', () => {
            isDragging = false;
        });

        // 5. Animation Render Loop
        let animationFrameId;
        const positionsArr = particleGeo.attributes.position.array;
        let time = 0;

        function animate() {
            animationFrameId = requestAnimationFrame(animate);
            time += 0.01;

            // A. Slowly rotate central core & orbit rings
            coreMesh.rotation.y -= 0.002 * speedMultiplier;
            midMesh.rotation.y += 0.005 * speedMultiplier;
            midMesh.rotation.x += 0.002 * speedMultiplier;
            
            ring1.rotation.z += 0.001 * speedMultiplier;
            ring2.rotation.z -= 0.001 * speedMultiplier;
            ring3.rotation.z += 0.002 * speedMultiplier;

            // B. Animate Orbiting Particles
            for (let i = 0; i < particleCount; i++) {
                const data = initialData[i];
                
                if (particleBehavior === "severe") {
                    // Erratic, congested, shaking clustered motion
                    data.angle += data.speed * 1.5;
                    const noiseX = Math.sin(time * 5 + i) * 0.06;
                    const noiseY = Math.cos(time * 7 + i) * 0.06;
                    const noiseZ = Math.sin(time * 3 + i) * 0.06;
                    
                    const curRadius = data.radius * (0.8 + Math.sin(time + i) * 0.15);
                    positionsArr[i * 3] = Math.cos(data.angle) * curRadius + noiseX;
                    positionsArr[i * 3 + 1] = data.yOffset + noiseY;
                    positionsArr[i * 3 + 2] = Math.sin(data.angle) * curRadius + noiseZ;
                } 
                else if (particleBehavior === "warning") {
                    // Moderately dense, slightly irregular orbits
                    data.angle += data.speed;
                    const curRadius = data.radius * (0.95 + Math.sin(time * 0.5 + i) * 0.05);
                    positionsArr[i * 3] = Math.cos(data.angle) * curRadius;
                    positionsArr[i * 3 + 1] = data.yOffset + Math.sin(time + i) * 0.05;
                    positionsArr[i * 3 + 2] = Math.sin(data.angle) * curRadius;
                } 
                else {
                    // Normal: Clean, smooth, laminar circular orbits
                    data.angle += data.speed * 0.8;
                    positionsArr[i * 3] = Math.cos(data.angle) * data.radius;
                    positionsArr[i * 3 + 1] = data.yOffset;
                    positionsArr[i * 3 + 2] = Math.sin(data.angle) * data.radius;
                }
            }
            
            particleGeo.attributes.position.needsUpdate = true;

            // C. Slow default rotation if not user-dragging
            if (!isDragging) {
                mainGroup.rotation.y += 0.001;
            }

            renderer.render(scene, camera);
        }

        animate();

        // 6. Handle Container Resize (Dynamic Aspect Ratio adjustment)
        const resizeObserver = new ResizeObserver(() => {
            if (!container.clientWidth || !container.clientHeight) return;
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        });
        
        resizeObserver.observe(container);

        // Stop animation loop when container is removed from DOM (memory leak safeguard)
        const destroyCheckInterval = setInterval(() => {
            if (!document.body.contains(container)) {
                cancelAnimationFrame(animationFrameId);
                resizeObserver.disconnect();
                clearInterval(destroyCheckInterval);
            }
        }, 2000);

    } catch (e) {
        console.error("Three.js WebGL error, running Canvas 2D fallback instead: ", e);
        runCanvas2DFallback(container, speedMultiplier, themeColor, particleBehavior);
    }
}

/**
 * High-Fidelity Custom HTML5 Canvas 2D 3D-Projection Engine Fallback
 * (Ensures 3D animations work fully offline/without internet CDN)
 */
function runCanvas2DFallback(container, speedMultiplier, themeColor, particleBehavior) {
    const canvas = document.createElement("canvas");
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    container.appendChild(canvas);
    
    const ctx = canvas.getContext("2d");
    
    const r = (themeColor >> 16) & 255;
    const g = (themeColor >> 8) & 255;
    const b = themeColor & 255;
    const colorStr = `rgb(${r}, ${g}, ${b})`;
    
    let rotationY = 0;
    let rotationX = 0.5; // start slightly tilted
    
    // Create 3D particles orbiting the center
    const particleCount = 100;
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
        const radius = 55 + Math.random() * 65;
        const angle = Math.random() * Math.PI * 2;
        const yOffset = (Math.random() - 0.5) * 60;
        const speed = (0.015 + Math.random() * 0.02) * speedMultiplier;
        
        // Randomly assign glowing blue (0, 187, 249) or glowing purple (114, 9, 183)
        const isBlue = Math.random() > 0.5;
        const color = isBlue ? "rgb(0, 187, 249)" : "rgb(114, 9, 183)";
        
        particles.push({ radius, angle, yOffset, speed, color });
    }
    
    // Orbit rings: define points on 3 circular rings in 3D space
    const ringCount = 3;
    const ringPointsCount = 60;
    const rings = [];
    for (let rIdx = 0; rIdx < ringCount; rIdx++) {
        const points = [];
        const radius = 65;
        for (let pIdx = 0; pIdx < ringPointsCount; pIdx++) {
            const angle = (pIdx / ringPointsCount) * Math.PI * 2;
            let x3d = Math.cos(angle) * radius;
            let z3d = Math.sin(angle) * radius;
            let y3d = 0;
            
            // Tilt each ring in 3D space differently
            if (rIdx === 0) {
                y3d = 0;
            } else if (rIdx === 1) {
                y3d = x3d * 0.5;
                x3d = x3d * 0.86;
            } else {
                y3d = z3d * 0.5;
                z3d = z3d * 0.86;
            }
            
            points.push({ x: x3d, y: y3d, z: z3d });
        }
        rings.push(points);
    }
    
    // Interaction states
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        const rect = canvas.getBoundingClientRect();
        prevMouseX = e.clientX - rect.left;
        prevMouseY = e.clientY - rect.top;
    });
    
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const deltaX = mouseX - prevMouseX;
        const deltaY = mouseY - prevMouseY;
        
        rotationY += deltaX * 0.01;
        rotationX += deltaY * 0.01;
        
        prevMouseX = mouseX;
        prevMouseY = mouseY;
    });
    
    window.addEventListener('mouseup', () => {
        isDragging = false;
    });
    
    // Touch support for mobiles
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            const rect = canvas.getBoundingClientRect();
            prevMouseX = e.touches[0].clientX - rect.left;
            prevMouseY = e.touches[0].clientY - rect.top;
        }
    });
    
    window.addEventListener('touchmove', (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.touches[0].clientX - rect.left;
        const mouseY = e.touches[0].clientY - rect.top;
        
        const deltaX = mouseX - prevMouseX;
        const deltaY = mouseY - prevMouseY;
        
        rotationY += deltaX * 0.01;
        rotationX += deltaY * 0.01;
        
        prevMouseX = mouseX;
        prevMouseY = mouseY;
    });
    
    window.addEventListener('touchend', () => {
        isDragging = false;
    });
    
    let time = 0;
    let animationFrameId;
    
    function draw() {
        animationFrameId = requestAnimationFrame(draw);
        time += 0.01;
        
        if (!isDragging) {
            rotationY += 0.005; // slowly spin
        }
        
        // Deep space background
        ctx.fillStyle = "#080c16";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Grid centers
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        
        // Rotate and project ring points
        const projectedRings = rings.map(ring => {
            return ring.map(p => {
                let x1 = p.x * Math.cos(rotationY) - p.z * Math.sin(rotationY);
                let z1 = p.x * Math.sin(rotationY) + p.z * Math.cos(rotationY);
                let y1 = p.y;
                
                let y2 = y1 * Math.cos(rotationX) - z1 * Math.sin(rotationX);
                let z2 = y1 * Math.sin(rotationX) + z1 * Math.cos(rotationX);
                let x2 = x1;
                
                const scale = 200 / (200 + z2);
                return { x: cx + x2 * scale, y: cy + y2 * scale, z: z2 };
            });
        });
        
        // Rotate and project particles
        const projectedParticles = particles.map((p, idx) => {
            if (particleBehavior === "severe") {
                p.angle += p.speed * 1.5;
            } else if (particleBehavior === "warning") {
                p.angle += p.speed * 1.2;
            } else {
                p.angle += p.speed * 0.8;
            }
            
            let pRadius = p.radius;
            let yOff = p.yOffset;
            
            if (particleBehavior === "severe") {
                pRadius = p.radius * (0.8 + Math.sin(time * 3 + idx) * 0.12);
                yOff += Math.cos(time * 5 + idx) * 3;
            } else if (particleBehavior === "warning") {
                pRadius = p.radius * (0.95 + Math.sin(time + idx) * 0.04);
            }
            
            let x3d = Math.cos(p.angle) * pRadius;
            let z3d = Math.sin(p.angle) * pRadius;
            let y3d = yOff;
            
            let x1 = x3d * Math.cos(rotationY) - z3d * Math.sin(rotationY);
            let z1 = x3d * Math.sin(rotationY) + z3d * Math.cos(rotationY);
            let y1 = y3d;
            
            let y2 = y1 * Math.cos(rotationX) - z1 * Math.sin(rotationX);
            let z2 = y1 * Math.sin(rotationX) + z1 * Math.cos(rotationX);
            let x2 = x1;
            
            const scale = 200 / (200 + z2);
            return { x: cx + x2 * scale, y: cy + y2 * scale, z: z2, color: p.color };
        });
        
        // Depth split (render back particles first, then central structures, then front particles)
        const backParticles = projectedParticles.filter(p => p.z > 0);
        const frontParticles = projectedParticles.filter(p => p.z <= 0);
        
        // Render back particles
        backParticles.forEach(p => {
            drawParticle(ctx, p, p.color);
        });
        
        // Render rings
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.25)`;
        ctx.lineWidth = 1.2;
        projectedRings.forEach(ring => {
            ctx.beginPath();
            ctx.moveTo(ring[0].x, ring[0].y);
            for (let i = 1; i < ring.length; i++) {
                ctx.lineTo(ring[i].x, ring[i].y);
            }
            ctx.closePath();
            ctx.stroke();
        });
        
        // Render glowing endocrine cell core
        const pulse = 1 + Math.sin(time * 2.5) * 0.06;
        const coreRad = 28 * pulse;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRad);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.95)`);
        grad.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.55)`);
        grad.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.15)`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, coreRad, 0, Math.PI * 2);
        ctx.fill();
        
        // Glowing wireframe rings around the core
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.45)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, coreRad * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        
        // Render front particles
        frontParticles.forEach(p => {
            drawParticle(ctx, p, p.color);
        });
    }
    
    function drawParticle(ctx, p, color) {
        const maxZ = 120;
        const depthNorm = (maxZ - p.z) / (2 * maxZ); // 0 (far) to 1 (near)
        
        const size = Math.max(0.5, depthNorm * 3.5 + 1.2);
        const opacity = depthNorm * 0.65 + 0.15;
        
        ctx.fillStyle = color;
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
    
    draw();
    
    // Resize handler
    const resizeObserver = new ResizeObserver(() => {
        if (!container.clientWidth || !container.clientHeight) return;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    });
    resizeObserver.observe(container);
    
    // Cleanup check
    const destroyCheckInterval = setInterval(() => {
        if (!document.body.contains(container)) {
            cancelAnimationFrame(animationFrameId);
            resizeObserver.disconnect();
            clearInterval(destroyCheckInterval);
        }
    }, 2000);
}
