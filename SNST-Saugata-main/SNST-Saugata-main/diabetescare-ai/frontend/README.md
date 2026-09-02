# DiabetesCare AI - Frontend

Modern, responsive web interface for the DiabetesCare AI wound analysis platform.

## 🌟 Features

- **Modern UI/UX**: Clean, professional design with smooth animations
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Real-time Analysis**: Upload wound images and get instant AI-powered results
- **Detailed Reports**: Comprehensive analysis with confidence scores and recommendations
- **Download Reports**: Export analysis results as text reports
- **Interactive Dashboard**: Visual representation of analysis results

## 🚀 Quick Start

### Prerequisites

- Python 3.8+ (for running the simple HTTP server)
- Backend API running on `http://localhost:8000`

### Starting the Frontend

#### Option 1: Using the Batch File (Windows)
```bash
START_FRONTEND.bat
```

#### Option 2: Using Python Directly
```bash
python server.py
```

#### Option 3: Using Any HTTP Server
```bash
# Python 3
python -m http.server 3000

# Node.js (if you have it)
npx http-server -p 3000

# PHP
php -S localhost:3000
```

The frontend will be available at: **http://localhost:3000**

## 📁 Project Structure

```
frontend/
├── index.html          # Main HTML file
├── styles.css          # All CSS styles
├── script.js           # JavaScript functionality
├── server.py           # Simple Python HTTP server
├── START_FRONTEND.bat  # Windows startup script
└── README.md           # This file
```

## 🎨 Design Features

### Color Scheme
- Primary: `#4F46E5` (Indigo)
- Secondary: `#10B981` (Green)
- Danger: `#EF4444` (Red)
- Warning: `#F59E0B` (Amber)

### Sections

1. **Hero Section**
   - Eye-catching introduction
   - Key statistics (98.10% accuracy, <2s analysis time)
   - Call-to-action buttons

2. **Features Section**
   - 6 key features with icons
   - Hover animations
   - Grid layout

3. **Analysis Section**
   - Drag-and-drop file upload
   - Image preview
   - Real-time analysis
   - Detailed results display
   - Downloadable reports

4. **About Section**
   - Technology stack
   - Model statistics
   - Project information

5. **Contact Section**
   - Contact information
   - Contact form
   - Newsletter signup

6. **Footer**
   - Quick links
   - Social media links
   - Newsletter subscription

## 🔧 Configuration

### API Endpoint

The frontend connects to the backend API at `http://localhost:8000` by default.

To change this, edit `script.js`:

```javascript
const API_BASE_URL = 'http://localhost:8000';  // Change this
```

### Supported Image Formats

- JPG/JPEG
- PNG
- Maximum file size: 10MB

## 📊 API Integration

The frontend integrates with the following backend endpoints:

### Health Check
```
GET /health
```

### Wound Analysis
```
POST /api/v1/wound/predict
Content-Type: multipart/form-data
Body: file (image file)
```

**Response Format:**
```json
{
  "prediction": "Abnormal (Ulcer)",
  "confidence": 0.9810,
  "all_predictions": {
    "Abnormal (Ulcer)": 0.9810,
    "Normal (Healthy skin)": 0.0190
  },
  "processing_time": 1.23
}
```

## 🎯 Usage Guide

### Analyzing a Wound Image

1. **Navigate to Analysis Section**
   - Click "Start Analysis" in the hero section
   - Or click "Analyze" in the navigation menu

2. **Upload Image**
   - Click "Select Image" button
   - Or drag and drop an image into the upload area

3. **Analyze**
   - Click "Analyze Wound" button
   - Wait for processing (typically 1-2 seconds)

4. **View Results**
   - See classification result
   - Check confidence score
   - Review recommendations
   - View all class probabilities

5. **Download Report**
   - Click "Download Report" button
   - Save the text report for your records

## 🔒 Security & Privacy

- **No Data Storage**: Images are not stored on the server
- **Secure Transmission**: All data sent over HTTPS (in production)
- **Client-Side Processing**: Image preview handled in browser
- **Privacy First**: No tracking or analytics

## 🌐 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 📱 Mobile Responsive

The interface is fully responsive and works on:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (< 768px)

## 🎨 Customization

### Changing Colors

Edit the CSS variables in `styles.css`:

```css
:root {
    --primary-color: #4F46E5;
    --secondary-color: #10B981;
    --danger-color: #EF4444;
    /* ... more colors */
}
```

### Adding New Sections

1. Add HTML in `index.html`
2. Add styles in `styles.css`
3. Add functionality in `script.js`

## 🐛 Troubleshooting

### Cannot Connect to API

**Problem**: "Cannot connect to backend API" error

**Solutions**:
1. Ensure backend is running on port 8000
2. Check `API_BASE_URL` in `script.js`
3. Verify CORS is enabled in backend
4. Check browser console for errors

### Image Upload Not Working

**Problem**: Image doesn't upload or preview

**Solutions**:
1. Check file size (must be < 10MB)
2. Verify file format (JPG, PNG only)
3. Check browser console for errors
4. Try a different image

### Results Not Displaying

**Problem**: Analysis completes but no results shown

**Solutions**:
1. Check browser console for errors
2. Verify API response format
3. Check network tab in developer tools
4. Ensure JavaScript is enabled

## 📈 Performance

- **Initial Load**: < 1s
- **Image Upload**: Instant (client-side)
- **Analysis Time**: 1-2s (depends on backend)
- **Total Time to Result**: < 3s

## 🔄 Updates & Maintenance

### Updating the Frontend

1. Pull latest changes
2. Clear browser cache
3. Refresh the page

### Adding New Features

1. Update HTML structure
2. Add CSS styles
3. Implement JavaScript functionality
4. Test on multiple devices
5. Update documentation

## 📞 Support

For issues or questions:
- Email: support@diabetescareai.com
- GitHub Issues: [Create an issue]
- Documentation: [Full docs]

## 📄 License

Copyright © 2024 DiabetesCare AI. All rights reserved.

## 🙏 Acknowledgments

- **Icons**: Font Awesome
- **Fonts**: Inter (Google Fonts)
- **Design Inspiration**: Modern medical UI/UX patterns
- **AI Model**: EfficientNet-B0 (PyTorch)

## 🚀 Deployment

### Production Deployment

For production, use a proper web server:

#### Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/frontend;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### Apache
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /path/to/frontend
    
    <Directory /path/to/frontend>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

### Environment Variables

For production, update:
- `API_BASE_URL` to your production API URL
- Enable HTTPS
- Configure proper CORS origins

## 📊 Analytics (Optional)

To add analytics, include in `index.html`:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

## 🎓 Learning Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [PyTorch Documentation](https://pytorch.org/docs/)
- [Modern CSS](https://web.dev/learn/css/)
- [JavaScript ES6+](https://javascript.info/)

---

**Built with ❤️ by the DiabetesCare AI Team**
