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

    // 1. Create and bind global Spotlight Cursor Glow
    const cursorGlow = document.createElement("div");
    cursorGlow.className = "cursor-glow";
    document.body.appendChild(cursorGlow);

    window.addEventListener("mousemove", (e) => {
        cursorGlow.style.opacity = "1";
        requestAnimationFrame(() => {
            cursorGlow.style.left = `${e.clientX}px`;
            cursorGlow.style.top = `${e.clientY}px`;
        });
    });

    window.addEventListener("mouseout", () => {
        cursorGlow.style.opacity = "0";
    });

    // 2. Bind 3D mouse tilt handlers to all glassmorphic cards
    const cards = document.querySelectorAll(".card, .stat-card");
    cards.forEach(card => {
        card.addEventListener("mousemove", (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            // snappier tilt transitions on mousemove
            card.style.transition = 'transform 0.1s ease-out, box-shadow 0.3s ease';
            
            const rotateY = ((x - centerX) / centerX) * 5;
            const rotateX = ((centerY - y) / centerY) * 5;
            
            const pctX = (x / rect.width) * 100;
            const pctY = (y / rect.height) * 100;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
            card.style.backgroundImage = `radial-gradient(circle at ${pctX}% ${pctY}%, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0) 60%), var(--bg-card)`;
        });
        
        card.addEventListener("mouseleave", () => {
            card.style.transition = 'var(--transition-smooth)';
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
            card.style.backgroundImage = 'none';
        });
    });

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

    function showStep(stepNum, direction = 'next') {
        const prevStep = currentStep;
        currentStep = stepNum;
        
        const prevPane = document.querySelector(".wizard-step-pane.active") || document.getElementById(`step-pane-${prevStep}`);
        const activePane = document.getElementById(`step-pane-${stepNum}`);

        if (prevPane && prevPane !== activePane) {
            // Apply slide-out animation to the current pane
            const outClass = direction === 'next' ? 'pane-slide-out-left' : 'pane-slide-out-right';
            const inClass = direction === 'next' ? 'pane-slide-in-right' : 'pane-slide-in-left';
            
            prevPane.classList.add(outClass);
            
            // Lock form card dimensions during animation to avoid layout jumping
            const formCard = document.getElementById("form-card");
            if (formCard) {
                formCard.style.minHeight = `${formCard.offsetHeight}px`;
            }

            setTimeout(() => {
                prevPane.classList.remove("active", outClass);
                
                if (activePane) {
                    activePane.classList.add("active", inClass);
                    
                    // Clean up the inClass after animation completes
                    setTimeout(() => {
                        activePane.classList.remove(inClass);
                        if (formCard) {
                            formCard.style.minHeight = ""; // Reset locked height
                        }
                    }, 250);
                }
            }, 220);
        } else {
            // Initial load, no animations
            panes.forEach(pane => {
                pane.classList.remove("active");
            });
            if (activePane) activePane.classList.add("active");
        }

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
                showStep(currentStep + 1, 'next');
            }
        });
    });

    const prevButtons = document.querySelectorAll(".btn-prev");
    prevButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            if (currentStep > 1) {
                showStep(currentStep - 1, 'prev');
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

    // Helper to update slider track gradient and value display glow based on thresholds
    function updateSliderGlow(sliderId, value, min, max, displayEl, inputEl) {
        const pct = ((value - min) / (max - min)) * 100;
        let color = "var(--color-teal)"; // Green/teal default
        let glowColor = "rgba(0, 245, 212, 0.35)";
        
        if (sliderId === "glucose") {
            if (value > 125) {
                color = "var(--color-danger)";
                glowColor = "rgba(239, 68, 68, 0.35)";
            } else if (value > 99) {
                color = "var(--color-warning)";
                glowColor = "rgba(245, 158, 11, 0.35)";
            }
        } else if (sliderId === "bmi") {
            if (value >= 30) {
                color = "var(--color-danger)";
                glowColor = "rgba(239, 68, 68, 0.35)";
            } else if (value >= 25) {
                color = "var(--color-warning)";
                glowColor = "rgba(245, 158, 11, 0.35)";
            }
        } else if (sliderId === "blood_pressure") {
            if (value >= 90) {
                color = "var(--color-danger)";
                glowColor = "rgba(239, 68, 68, 0.35)";
            } else if (value >= 80) {
                color = "var(--color-warning)";
                glowColor = "rgba(245, 158, 11, 0.35)";
            }
        } else if (sliderId === "insulin") {
            if (value > 250) {
                color = "var(--color-danger)";
                glowColor = "rgba(239, 68, 68, 0.35)";
            } else if (value > 140) {
                color = "var(--color-warning)";
                glowColor = "rgba(245, 158, 11, 0.35)";
            }
        } else if (sliderId === "age") {
            if (value >= 50) {
                color = "var(--color-danger)";
                glowColor = "rgba(239, 68, 68, 0.35)";
            } else if (value >= 35) {
                color = "var(--color-warning)";
                glowColor = "rgba(245, 158, 11, 0.35)";
            }
        } else if (sliderId === "pregnancies") {
            if (value > 6) {
                color = "var(--color-danger)";
                glowColor = "rgba(239, 68, 68, 0.35)";
            } else if (value > 3) {
                color = "var(--color-warning)";
                glowColor = "rgba(245, 158, 11, 0.35)";
            }
        } else if (sliderId === "skin_thickness") {
            if (value >= 30) {
                color = "var(--color-danger)";
                glowColor = "rgba(239, 68, 68, 0.35)";
            } else if (value >= 20) {
                color = "var(--color-warning)";
                glowColor = "rgba(245, 158, 11, 0.35)";
            }
        } else if (sliderId === "diabetes_pedigree") {
            if (value > 0.7) {
                color = "var(--color-danger)";
                glowColor = "rgba(239, 68, 68, 0.35)";
            } else if (value > 0.35) {
                color = "var(--color-warning)";
                glowColor = "rgba(245, 158, 11, 0.35)";
            }
        }

        inputEl.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%, rgba(255, 255, 255, 0.1) 100%)`;
        displayEl.style.borderColor = color;
        displayEl.style.color = color;
        displayEl.style.boxShadow = `0 0 10px ${glowColor}`;

        const indicatorEl = document.getElementById(`${sliderId}-indicator`);
        if (indicatorEl) {
            indicatorEl.className = "status-indicator-dot";
            if (color === "var(--color-danger)") {
                indicatorEl.classList.add("status-critical");
            } else if (color === "var(--color-warning)") {
                indicatorEl.classList.add("status-borderline");
            } else {
                indicatorEl.classList.add("status-optimal");
            }
        }
    }

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
                    displayEl.style.borderColor = "";
                    displayEl.style.color = "";
                    displayEl.style.boxShadow = "";
                    inputEl.style.background = "";
                    const indicatorEl = document.getElementById(`${slider.id}-indicator`);
                    if (indicatorEl) {
                        indicatorEl.className = "status-indicator-dot status-unknown";
                    }
                    return;
                }
                
                let val = parseFloat(e.target.value);
                if (slider.isFloat) {
                    displayEl.textContent = val.toFixed(slider.decimals || 1);
                } else {
                    displayEl.textContent = parseInt(val, 10);
                }

                // Update dynamic colors and glows
                const min = parseFloat(inputEl.min) || 0;
                const max = parseFloat(inputEl.max) || 100;
                updateSliderGlow(slider.id, val, min, max, displayEl, inputEl);
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
            const indicatorEl = document.getElementById(`${targetId}-indicator`);

            if (e.target.checked) {
                inputEl.disabled = true;
                displayEl.textContent = "Unknown";
                displayEl.classList.add("unknown");
                if (indicatorEl) {
                    indicatorEl.className = "status-indicator-dot status-unknown";
                }
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
                const pregIndicator = document.getElementById("pregnancies-indicator");
                if (pregIndicator) {
                    pregIndicator.className = "status-indicator-dot status-unknown";
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

    // Initial page load layout updates
    updateReportUIData(data, inputs, patientSex);

    // 1. Initialise Speech Synthesis for the AI consult narrative
    initSpeechScribe();

    // 2. Initialise What-If Sandbox sliders
    initSandboxPanel(inputs, patientSex);
}

/**
 * Update report screen DOM elements with analysis results
 */
function updateReportUIData(data, inputs, patientSex) {
    const prediction = data.prediction || {};
    const metrics = data.metrics || {};
    const explainability = data.explainability || {};

    // Generate and display dynamic patient reference details
    const randomId = "PT-" + Math.floor(1000 + Math.random() * 9000) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const ageVal = inputs.age !== null && inputs.age !== undefined ? `${inputs.age} yrs` : "Unknown";
    const bmiVal = inputs.bmi !== null && inputs.bmi !== undefined ? `${inputs.bmi.toFixed(1)} BMI` : "Unknown";
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
    let themeColor = "var(--color-success)";
    if (badge) {
        let riskClass = "low";
        let badgeText = "Low Risk";

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
    }

    // 2. Animate Circular Risk Gauge
    const circle = document.getElementById("risk-gauge-ring");
    if (circle) {
        const radius = circle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        
        // Set stroke configuration
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.stroke = themeColor;
        
        // Animate progress ring load
        const offset = circumference - (riskPercentage / 100) * circumference;
        circle.style.strokeDashoffset = offset;
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
                updateCarePlanProgress();
            });

            carePlanListContainer.appendChild(item);
        });
        updateCarePlanProgress(); // Initial progress calculation
    }

    // 5. Render custom horizontal SHAP Bar Chart
    const shapChartContainer = document.getElementById("shap-chart");
    if (shapChartContainer) {
        renderShapChart(explainability.raw_shap_contributions);
    }

    // 6. Initialise 3D Anatomy Visualizer (WebGL / Canvas Fallback)
    init3DAnatomy("anatomy-3d-container", riskPercentage);

    // 7. Inject AI consult narrative
    const narrativeContainer = document.getElementById("ai-narrative-text");
    if (narrativeContainer) {
        const narrativeText = data.ai_patient_report || data.clinical_narrative;
        if (narrativeText) {
            narrativeContainer.innerHTML = parseMarkdownToHtml(narrativeText);
        } else {
            narrativeContainer.innerHTML = "<p style='color: var(--color-text-muted);'>No narrative summary available.</p>";
        }
    }

    // 8. Action Button Listeners (Only bind once on initial page load)
    const btnNewTest = document.getElementById("btn-new-test");
    if (btnNewTest && !btnNewTest.dataset.bound) {
        btnNewTest.dataset.bound = "true";
        btnNewTest.addEventListener("click", () => {
            window.location.href = "intake.html";
        });
    }

    const btnPrint = document.getElementById("btn-print");
    if (btnPrint && !btnPrint.dataset.bound) {
        btnPrint.dataset.bound = "true";
        btnPrint.addEventListener("click", () => {
            window.print();
        });
    }
}

/**
 * Update circular progress display in pathway checklist
 */
function updateCarePlanProgress() {
    const list = document.getElementById("care-plan-list");
    const progressFill = document.getElementById("care-progress-fill");
    const progressPctText = document.getElementById("care-progress-pct");
    if (!list || !progressFill || !progressPctText) return;
    
    const items = list.querySelectorAll(".care-plan-item");
    const total = items.length;
    if (total === 0) {
        progressFill.style.width = "0%";
        progressPctText.textContent = "0% Completed";
        return;
    }
    
    const completed = list.querySelectorAll(".care-plan-item.completed").length;
    const pct = Math.round((completed / total) * 100);
    
    progressFill.style.width = `${pct}%`;
    progressPctText.textContent = `${pct}% Completed`;
}

/**
 * Build dynamic controls for clinical sandbox mode
 */
function initSandboxPanel(inputs, patientSex) {
    const sandboxGrid = document.getElementById("sandbox-grid");
    if (!sandboxGrid) return;
    
    sandboxGrid.innerHTML = "";
    
    const sandboxMetrics = [
        { id: "pregnancies", label: "Pregnancies", min: 0, max: 17, step: 1, isFloat: false },
        { id: "glucose", label: "Plasma Glucose (mg/dL)", min: 0, max: 300, step: 1, isFloat: false },
        { id: "blood_pressure", label: "Diastolic BP (mmHg)", min: 0, max: 200, step: 1, isFloat: false },
        { id: "skin_thickness", label: "Skin Fold Thickness (mm)", min: 0, max: 100, step: 1, isFloat: false },
        { id: "insulin", label: "2-Hour Insulin (mu U/ml)", min: 0, max: 900, step: 5, isFloat: false },
        { id: "bmi", label: "Body Mass Index (BMI)", min: 0, max: 70, step: 0.1, isFloat: true },
        { id: "diabetes_pedigree", label: "Pedigree Score", min: 0.05, max: 2.5, step: 0.001, isFloat: true, decimals: 3 },
        { id: "age", label: "Patient Age (yrs)", min: 0, max: 120, step: 1, isFloat: false }
    ];
    
    const isMale = patientSex === "male";
    
    function getDemoDefault(id) {
        const defaults = {
            pregnancies: 3,
            glucose: 120,
            blood_pressure: 72,
            skin_thickness: 23,
            insulin: 80,
            bmi: 32.0,
            diabetes_pedigree: 0.372,
            age: 29
        };
        return defaults[id];
    }
    
    sandboxMetrics.forEach(m => {
        const isPreg = m.id === "pregnancies";
        const initVal = isPreg && isMale ? 0 : (inputs[m.id] !== null && inputs[m.id] !== undefined ? inputs[m.id] : getDemoDefault(m.id));
        const disabledAttr = isPreg && isMale ? "disabled" : "";
        
        const row = document.createElement("div");
        row.className = "sandbox-slider-row";
        if (isPreg && isMale) {
            row.style.display = "none";
        }
        
        row.innerHTML = `
            <div class="sandbox-label-container">
                <span class="sandbox-label">
                    <span class="status-indicator-dot" id="sandbox-${m.id}-indicator"></span>
                    <span>${m.label}</span>
                </span>
                <span class="sandbox-value" id="sandbox-${m.id}-val">${m.isFloat ? initVal.toFixed(m.decimals || 1) : initVal}</span>
            </div>
            <div class="slider-container">
                <input type="range" id="sandbox-${m.id}" min="${m.min}" max="${m.max}" step="${m.step}" value="${initVal}" ${disabledAttr} class="form-slider">
            </div>
        `;
        sandboxGrid.appendChild(row);
        
        // Dynamic event listeners for sandbox sliders
        const sliderInput = document.getElementById(`sandbox-${m.id}`);
        const valueDisplay = document.getElementById(`sandbox-${m.id}-val`);
        
        if (sliderInput && valueDisplay) {
            sliderInput.addEventListener("input", (e) => {
                let val = parseFloat(e.target.value);
                if (m.isFloat) {
                    valueDisplay.textContent = val.toFixed(m.decimals || 1);
                } else {
                    valueDisplay.textContent = parseInt(val, 10);
                }
                updateSandboxSliderGlow(m.id, val, m.min, m.max);
                triggerSandboxRecalc();
            });
            // Trigger initial styling
            updateSandboxSliderGlow(m.id, parseFloat(sliderInput.value), m.min, m.max);
        }
    });

    // Debounce timer for sandbox API triggers
    let sandboxTimeout;
    function triggerSandboxRecalc() {
        clearTimeout(sandboxTimeout);
        sandboxTimeout = setTimeout(runSandboxRecalc, 350);
    }
    
    async function runSandboxRecalc() {
        const payload = {
            pregnancies: isMale ? 0 : parseInt(document.getElementById("sandbox-pregnancies").value),
            glucose: parseFloat(document.getElementById("sandbox-glucose").value),
            blood_pressure: parseFloat(document.getElementById("sandbox-blood_pressure").value),
            skin_thickness: parseFloat(document.getElementById("sandbox-skin_thickness").value),
            insulin: parseFloat(document.getElementById("sandbox-insulin").value),
            bmi: parseFloat(document.getElementById("sandbox-bmi").value),
            diabetes_pedigree: parseFloat(document.getElementById("sandbox-diabetes_pedigree").value),
            age: parseInt(document.getElementById("sandbox-age").value)
        };
        
        // Show subtle visual working indicator inside Sandbox card
        const resetBtn = document.getElementById("sandbox-reset-btn");
        if (resetBtn) resetBtn.textContent = "Recalculating...";
        
        try {
            const response = await fetch("/api/v1/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) throw new Error("Sandbox fetch error");
            const data = await response.json();
            
            // Redraw dashboard components reactively!
            updateReportUIData(data, payload, patientSex);
            
            // Inform user sandbox recalculation is complete
            if (resetBtn) resetBtn.textContent = "Reset Intake";
        } catch (e) {
            console.error("Sandbox recalculation failed: ", e);
            if (resetBtn) resetBtn.textContent = "Recalc Error";
        }
    }
    
    // Bind reset button
    const resetBtn = document.getElementById("sandbox-reset-btn");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            sandboxMetrics.forEach(m => {
                const isPreg = m.id === "pregnancies";
                const initVal = isPreg && isMale ? 0 : (inputs[m.id] !== null && inputs[m.id] !== undefined ? inputs[m.id] : getDemoDefault(m.id));
                const inputEl = document.getElementById(`sandbox-${m.id}`);
                if (inputEl) {
                    inputEl.value = initVal;
                    // Trigger input event to update label text and glow
                    inputEl.dispatchEvent(new Event("input"));
                }
            });
            triggerSandboxRecalc();
        });
    }
}

/**
 * Handle visual background and glow tracking for Sandbox sliders
 */
function updateSandboxSliderGlow(id, val, min, max) {
    const inputEl = document.getElementById(`sandbox-${id}`);
    const displayEl = document.getElementById(`sandbox-${id}-val`);
    const indicatorEl = document.getElementById(`sandbox-${id}-indicator`);
    if (!inputEl || !displayEl) return;
    
    const pct = ((val - min) / (max - min)) * 100;
    let color = "var(--color-teal)"; // Green/teal default
    let indicatorClass = "status-optimal";
    
    if (id === "glucose") {
        if (val > 125) { color = "var(--color-danger)"; indicatorClass = "status-critical"; }
        else if (val > 99) { color = "var(--color-warning)"; indicatorClass = "status-borderline"; }
    } else if (id === "bmi") {
        if (val >= 30) { color = "var(--color-danger)"; indicatorClass = "status-critical"; }
        else if (val >= 25) { color = "var(--color-warning)"; indicatorClass = "status-borderline"; }
    } else if (id === "blood_pressure") {
        if (val >= 90) { color = "var(--color-danger)"; indicatorClass = "status-critical"; }
        else if (val >= 80) { color = "var(--color-warning)"; indicatorClass = "status-borderline"; }
    } else if (id === "insulin") {
        if (val > 250) { color = "var(--color-danger)"; indicatorClass = "status-critical"; }
        else if (val > 140) { color = "var(--color-warning)"; indicatorClass = "status-borderline"; }
    } else if (id === "age") {
        if (val >= 50) { color = "var(--color-danger)"; indicatorClass = "status-critical"; }
        else if (val >= 35) { color = "var(--color-warning)"; indicatorClass = "status-borderline"; }
    } else if (id === "pregnancies") {
        if (val > 6) { color = "var(--color-danger)"; indicatorClass = "status-critical"; }
        else if (val > 3) { color = "var(--color-warning)"; indicatorClass = "status-borderline"; }
    } else if (id === "skin_thickness") {
        if (val >= 30) { color = "var(--color-danger)"; indicatorClass = "status-critical"; }
        else if (val >= 20) { color = "var(--color-warning)"; indicatorClass = "status-borderline"; }
    } else if (id === "diabetes_pedigree") {
        if (val > 0.7) { color = "var(--color-danger)"; indicatorClass = "status-critical"; }
        else if (val > 0.35) { color = "var(--color-warning)"; indicatorClass = "status-borderline"; }
    }

    inputEl.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%, rgba(255, 255, 255, 0.1) 100%)`;
    displayEl.style.color = color;
    if (indicatorEl) {
        indicatorEl.className = `status-indicator-dot ${indicatorClass}`;
    }
}

/**
 * Voice synthesis clinical narrator console
 */
function initSpeechScribe() {
    const playBtn = document.getElementById("btn-voice-play");
    if (!playBtn) return;
    
    // Check if voice listeners are already bound to prevent double click triggers
    if (playBtn.dataset.speechBound) return;
    playBtn.dataset.speechBound = "true";

    const btnText = playBtn.querySelector(".audio-btn-text");
    const btnIcon = playBtn.querySelector(".audio-icon");
    const soundwave = document.getElementById("soundwave-anim");
    
    let synth = window.speechSynthesis;
    let isSpeaking = false;
    let currentUtterance = null;
    
    playBtn.addEventListener("click", () => {
        if (!synth) {
            alert("Browser Text-to-Speech synthesis is not supported on this device.");
            return;
        }
        
        if (isSpeaking) {
            synth.cancel();
            isSpeaking = false;
            if (btnText) btnText.textContent = "Listen Report";
            if (btnIcon) btnIcon.textContent = "🔊";
            if (soundwave) soundwave.classList.remove("playing");
        } else {
            const narrativeContainer = document.getElementById("ai-narrative-text");
            if (!narrativeContainer) return;
            
            // Clean markdown bold tags and bullet formats for smooth dictation
            const textToRead = narrativeContainer.textContent
                .replace(/[\n\r]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
                
            if (!textToRead || textToRead.startsWith("No narrative")) {
                alert("No clinical description text found to narrate.");
                return;
            }
            
            synth.cancel(); // Stop any other speech
            
            currentUtterance = new SpeechSynthesisUtterance(textToRead);
            
            // Choose a clear English system voice
            const voices = synth.getVoices();
            const voice = voices.find(v => 
                v.name.includes("Google US English") || 
                v.name.includes("Samantha") || 
                v.name.includes("Hazel") ||
                v.lang.startsWith("en-US")
            );
            if (voice) {
                currentUtterance.voice = voice;
            }
            
            currentUtterance.rate = 1.0;
            currentUtterance.pitch = 1.0;
            
            currentUtterance.onstart = () => {
                isSpeaking = true;
                if (btnText) btnText.textContent = "Stop Listening";
                if (btnIcon) btnIcon.textContent = "⏹️";
                if (soundwave) soundwave.classList.add("playing");
            };
            
            currentUtterance.onend = () => {
                isSpeaking = false;
                if (btnText) btnText.textContent = "Listen Report";
                if (btnIcon) btnIcon.textContent = "🔊";
                if (soundwave) soundwave.classList.remove("playing");
            };
            
            currentUtterance.onerror = (e) => {
                console.error("Narrator error:", e);
                isSpeaking = false;
                if (btnText) btnText.textContent = "Listen Report";
                if (btnIcon) btnIcon.textContent = "🔊";
                if (soundwave) soundwave.classList.remove("playing");
            };
            
            synth.speak(currentUtterance);
        }
    });

    // Make sure we stop reading if the user closes/navigates away
    window.addEventListener("beforeunload", () => {
        if (synth) synth.cancel();
    });
}

/**
 * Render the SHAP Explanation Chart using HTML/CSS
 */
function renderShapChart(contributions) {
    const container = document.getElementById("shap-chart");
    if (!container) return;
    
    container.innerHTML = "";

    const inputsStr = localStorage.getItem("last_inputs");
    const inputs = inputsStr ? JSON.parse(inputsStr) : {};

    // Find the maximum absolute SHAP value to normalize the width calculations
    let maxAbsValue = 0.05; // Set base minimum to avoid division by zero
    Object.keys(contributions).forEach(key => {
        const val = Math.abs(contributions[key]);
        if (val > maxAbsValue) {
            maxAbsValue = val;
        }
    });

    const tooltip = document.getElementById("shap-tooltip");

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

        // Tooltip interaction handlers
        row.addEventListener("mouseenter", (e) => {
            if (!tooltip) return;
            
            // Try to read current value from Sandbox slider first, else fallback to initial inputs
            let currentValStr = "Unknown";
            const sandboxInput = document.getElementById(`sandbox-${key.toLowerCase()}`);
            if (sandboxInput) {
                currentValStr = sandboxInput.value;
            } else if (inputs[key.toLowerCase()] !== undefined && inputs[key.toLowerCase()] !== null) {
                currentValStr = inputs[key.toLowerCase()];
            } else {
                // Check exact mapping
                const lowerKey = key.toLowerCase();
                const mappedKeys = {
                    pregnancies: "pregnancies",
                    glucose: "glucose",
                    bloodpressure: "blood_pressure",
                    skinthickness: "skin_thickness",
                    insulin: "insulin",
                    bmi: "bmi",
                    diabetespedigreefunction: "diabetes_pedigree",
                    age: "age"
                };
                const fieldName = mappedKeys[lowerKey];
                if (fieldName && inputs[fieldName] !== undefined && inputs[fieldName] !== null) {
                    currentValStr = inputs[fieldName];
                }
            }

            const definition = getFeatureExplanation(key);
            const friendlyName = getFriendlyName(key);

            tooltip.innerHTML = `
                <div class="shap-tooltip-title">${friendlyName}</div>
                <div class="shap-tooltip-detail"><strong>Patient Value:</strong> ${currentValStr}</div>
                <div class="shap-tooltip-detail" style="margin-top: 0.35rem; color: var(--color-text-main); font-size: 0.8rem;">${definition}</div>
                <div class="shap-tooltip-impact ${isPositive ? 'positive' : 'negative'}" style="margin-top: 0.5rem; font-size: 0.8rem;">
                    <strong>Impact:</strong> ${isPositive ? 'Elevated' : 'Reduced'} Predicted Risk by <strong>${Math.abs(value * 100).toFixed(2)}%</strong>
                </div>
            `;
            tooltip.classList.add("show");
        });

        row.addEventListener("mousemove", (e) => {
            if (!tooltip) return;
            tooltip.style.left = `${e.pageX}px`;
            tooltip.style.top = `${e.pageY}px`;
        });

        row.addEventListener("mouseleave", () => {
            if (!tooltip) return;
            tooltip.classList.remove("show");
        });

        container.appendChild(row);

        // Animate the widths sequentially
        setTimeout(() => {
            fill.style.width = `${percentageWidth}%`;
        }, 100 + (index * 80)); // Cascading delay effect
    });
}

/**
 * Medical clinical explanations of input features for tooltips
 */
function getFeatureExplanation(key) {
    const explanations = {
        Pregnancies: "Reflects parity. High numbers correlate with historical insulin-resistant metabolic states during gestational terms.",
        Glucose: "2-hour oral glucose tolerance test (OGTT). The primary diagnostic indicator for glycemic clearance speed and insulin capacity.",
        BloodPressure: "Diastolic blood pressure. Elevated diastolic tension indicates peripheral vascular resistance and cardiorenal stress.",
        SkinThickness: "Triceps skin fold thickness. Quantitative subcutaneous adipose indicator correlating with systemic fat deposits.",
        Insulin: "2-hour post-glucose serum insulin. High levels show beta-cell stress, hyperinsulinemia, and insulin resistance.",
        BMI: "Body Mass Index. Height-to-weight ratio. High BMI is strongly linked to cellular receptor blockages and metabolic stress.",
        DiabetesPedigreeFunction: "Family pedigree coefficient. Measures genetic predisposition to diabetes based on family health history.",
        Age: "Biological age. Cellular aging rises alongside natural decreases in glycemic clearance rates and insulin receptor sensitivity."
    };
    return explanations[key] || "Clinical metabolic metric evaluated by the machine learning model.";
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
