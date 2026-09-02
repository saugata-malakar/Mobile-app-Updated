// ===== Configuration =====
const API_BASE_URL = window.location.origin; // Use same origin (same port)

// ===== DOM Elements =====
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const selectFileBtn = document.getElementById('selectFileBtn');
const previewContainer = document.getElementById('previewContainer');
const previewImage = document.getElementById('previewImage');
const removeImageBtn = document.getElementById('removeImageBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultsSection = document.getElementById('resultsSection');
const loadingOverlay = document.getElementById('loadingOverlay');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// ===== State =====
let selectedFile = null;
let analysisResults = null;

// ===== Navigation =====
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Remove active class from all links
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        
        // Add active class to clicked link
        this.classList.add('active');
        
        // Smooth scroll to section
        const targetId = this.getAttribute('href');
        const targetSection = document.querySelector(targetId);
        if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// ===== File Upload Handlers =====
selectFileBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    handleFileSelect(e.target.files[0]);
});

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
});

// Handle file selection
function handleFileSelect(file) {
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
        showToast('File size must be less than 10MB', 'error');
        return;
    }
    
    selectedFile = file;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result;
        document.querySelector('.upload-content').style.display = 'none';
        previewContainer.style.display = 'block';
        analyzeBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

// Remove image
removeImageBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    previewImage.src = '';
    document.querySelector('.upload-content').style.display = 'block';
    previewContainer.style.display = 'none';
    analyzeBtn.disabled = true;
    resultsSection.style.display = 'none';
});

// ===== Analysis =====
analyzeBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        showToast('Please select an image first', 'error');
        return;
    }
    
    // Show loading
    loadingOverlay.classList.add('active');
    
    try {
        // Create form data
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        // Record start time
        const startTime = Date.now();
        
        console.log('Sending request to:', `${API_BASE_URL}/api/v1/wound/predict`);
        console.log('File:', selectedFile.name, selectedFile.type, selectedFile.size);
        
        // Make API request
        const response = await fetch(`${API_BASE_URL}/api/v1/wound/predict`, {
            method: 'POST',
            body: formData
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        // Calculate processing time
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', errorText);
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('API Response:', data);
        
        // Store results
        analysisResults = {
            ...data,
            processingTime,
            imageSize: formatFileSize(selectedFile.size),
            analysisDate: new Date().toLocaleString()
        };
        
        // Display results
        displayResults(analysisResults);
        
        // Show success message
        showToast('Analysis completed successfully!', 'success');
        
    } catch (error) {
        console.error('Analysis error:', error);
        showToast(`Analysis failed: ${error.message}`, 'error');
    } finally {
        loadingOverlay.classList.remove('active');
    }
});

// Display results
function displayResults(results) {
    // Show results section
    resultsSection.style.display = 'block';
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Main classification
    const classification = results.prediction || results.class || 'Unknown';
    const confidence = results.confidence || results.probability || 0;
    
    document.getElementById('classificationResult').textContent = classification;
    document.getElementById('confidenceValue').textContent = `${(confidence * 100).toFixed(2)}%`;
    
    // Animate confidence bar
    setTimeout(() => {
        document.getElementById('confidenceFill').style.width = `${confidence * 100}%`;
    }, 100);
    
    // Details
    document.getElementById('processingTime').textContent = `${results.processingTime}s`;
    document.getElementById('imageSize').textContent = results.imageSize;
    document.getElementById('analysisDate').textContent = results.analysisDate;
    
    // Recommendations
    displayRecommendations(classification, confidence);
    
    // All predictions
    if (results.all_predictions || results.probabilities) {
        displayAllPredictions(results.all_predictions || results.probabilities);
    }
}

// Display recommendations
function displayRecommendations(classification, confidence) {
    const recommendationsList = document.getElementById('recommendationsList');
    recommendationsList.innerHTML = '';
    
    let recommendations = [];
    
    if (classification.toLowerCase().includes('ulcer') || classification.toLowerCase().includes('abnormal')) {
        recommendations = [
            'Consult with a healthcare professional immediately',
            'Keep the wound clean and dry',
            'Monitor for signs of infection (redness, swelling, discharge)',
            'Avoid putting pressure on the affected area',
            'Follow prescribed treatment plan carefully',
            'Schedule regular follow-up appointments'
        ];
    } else {
        recommendations = [
            'Continue regular foot care routine',
            'Monitor for any changes in skin condition',
            'Maintain good blood sugar control',
            'Wear comfortable, well-fitting shoes',
            'Inspect feet daily for any abnormalities',
            'Schedule routine check-ups with healthcare provider'
        ];
    }
    
    if (confidence < 0.7) {
        recommendations.unshift('⚠️ Low confidence score - consider getting a second opinion');
    }
    
    recommendations.forEach(rec => {
        const li = document.createElement('li');
        li.textContent = rec;
        recommendationsList.appendChild(li);
    });
}

// Display all predictions
function displayAllPredictions(predictions) {
    const predictionsList = document.getElementById('predictionsList');
    predictionsList.innerHTML = '';
    
    // Convert to array if it's an object
    let predArray = [];
    if (Array.isArray(predictions)) {
        predArray = predictions;
    } else if (typeof predictions === 'object') {
        predArray = Object.entries(predictions).map(([label, prob]) => ({
            label,
            probability: prob
        }));
    }
    
    // Sort by probability
    predArray.sort((a, b) => (b.probability || 0) - (a.probability || 0));
    
    // Display each prediction
    predArray.forEach(pred => {
        const probability = pred.probability || 0;
        const label = pred.label || pred.class || 'Unknown';
        
        const item = document.createElement('div');
        item.className = 'prediction-item';
        item.innerHTML = `
            <span class="prediction-label">${label}</span>
            <div class="prediction-bar">
                <div class="prediction-fill" style="width: ${probability * 100}%"></div>
            </div>
            <span class="prediction-value">${(probability * 100).toFixed(2)}%</span>
        `;
        predictionsList.appendChild(item);
    });
}

// ===== Download Report =====
document.getElementById('downloadReportBtn').addEventListener('click', () => {
    if (!analysisResults) {
        showToast('No analysis results to download', 'error');
        return;
    }
    
    // Create report content
    const reportContent = `
DIABETESCARE AI - WOUND ANALYSIS REPORT
========================================

Analysis Date: ${analysisResults.analysisDate}
Processing Time: ${analysisResults.processingTime}s
Image Size: ${analysisResults.imageSize}

CLASSIFICATION RESULTS
----------------------
Primary Classification: ${analysisResults.prediction || analysisResults.class}
Confidence Score: ${((analysisResults.confidence || 0) * 100).toFixed(2)}%

ALL PREDICTIONS
---------------
${formatPredictionsForReport(analysisResults.all_predictions || analysisResults.probabilities)}

RECOMMENDATIONS
---------------
${getRecommendationsText(analysisResults.prediction || analysisResults.class, analysisResults.confidence)}

DISCLAIMER
----------
This analysis is provided for informational purposes only and should not be 
considered as medical advice. Always consult with a qualified healthcare 
professional for proper diagnosis and treatment.

Generated by DiabetesCare AI
© 2024 DiabetesCare AI. All rights reserved.
    `.trim();
    
    // Create and download file
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wound-analysis-report-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Report downloaded successfully!', 'success');
});

// Format predictions for report
function formatPredictionsForReport(predictions) {
    if (!predictions) return 'N/A';
    
    let predArray = [];
    if (Array.isArray(predictions)) {
        predArray = predictions;
    } else if (typeof predictions === 'object') {
        predArray = Object.entries(predictions).map(([label, prob]) => ({
            label,
            probability: prob
        }));
    }
    
    predArray.sort((a, b) => (b.probability || 0) - (a.probability || 0));
    
    return predArray.map(pred => 
        `${pred.label || pred.class}: ${((pred.probability || 0) * 100).toFixed(2)}%`
    ).join('\n');
}

// Get recommendations text
function getRecommendationsText(classification, confidence) {
    const recommendations = [];
    
    if (classification.toLowerCase().includes('ulcer') || classification.toLowerCase().includes('abnormal')) {
        recommendations.push(
            '• Consult with a healthcare professional immediately',
            '• Keep the wound clean and dry',
            '• Monitor for signs of infection',
            '• Avoid putting pressure on the affected area',
            '• Follow prescribed treatment plan carefully'
        );
    } else {
        recommendations.push(
            '• Continue regular foot care routine',
            '• Monitor for any changes in skin condition',
            '• Maintain good blood sugar control',
            '• Wear comfortable, well-fitting shoes',
            '• Schedule routine check-ups'
        );
    }
    
    if (confidence < 0.7) {
        recommendations.unshift('⚠️ Low confidence score - consider getting a second opinion');
    }
    
    return recommendations.join('\n');
}

// ===== Contact Form =====
document.getElementById('contactForm').addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('Message sent successfully! We\'ll get back to you soon.', 'success');
    e.target.reset();
});

// ===== Newsletter Form =====
document.querySelector('.newsletter-form').addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('Thank you for subscribing!', 'success');
    e.target.reset();
});

// ===== Utility Functions =====
function showToast(message, type = 'success') {
    toastMessage.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ===== API Health Check =====
async function checkAPIHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (response.ok) {
            console.log('✅ API is healthy and ready');
        } else {
            console.warn('⚠️ API health check failed');
        }
    } catch (error) {
        console.error('❌ Cannot connect to API:', error);
        showToast('Warning: Cannot connect to backend API. Please ensure the server is running.', 'error');
    }
}

// Check API health on page load
checkAPIHealth();

// ===== Smooth Scroll for Hero Buttons =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ===== Navbar Scroll Effect =====
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        navbar.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1)';
    } else {
        navbar.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    }
    
    lastScroll = currentScroll;
});

// ===== Intersection Observer for Animations =====
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe feature cards
document.querySelectorAll('.feature-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'all 0.6s ease';
    observer.observe(card);
});

console.log('🚀 DiabetesCare AI Frontend Loaded Successfully');
