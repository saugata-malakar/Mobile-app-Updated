import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def generate_pdf(filename):
    doc = SimpleDocTemplate(filename, pagesize=letter,
                            rightMargin=72, leftMargin=72,
                            topMargin=72, bottomMargin=72)
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Title'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#1A365D'),
        spaceAfter=20
    )
    
    h1_style = ParagraphStyle(
        'Heading1',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#2C5282'),
        spaceBefore=15,
        spaceAfter=10,
        keepWithNext=True
    )
    
    h2_style = ParagraphStyle(
        'Heading2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#4A5568'),
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'BodyText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor('#2D3748'),
        spaceAfter=8
    )
    
    bullet_style = ParagraphStyle(
        'BulletText',
        parent=body_style,
        leftIndent=20,
        firstLineIndent=-10,
        spaceAfter=4
    )

    story = []

    # Title Page
    story.append(Spacer(1, 100))
    story.append(Paragraph("DiabetesCare AI", title_style))
    story.append(Paragraph("ASHA Field Worker Training Manual", ParagraphStyle('SubTitle', parent=styles['Normal'], fontSize=16, leading=20, textColor=colors.HexColor('#718096'), alignment=1)))
    story.append(Spacer(1, 40))
    story.append(Paragraph("A comprehensive guide for rural diabetic foot screening, wound imaging, and clinical referral protocols.", ParagraphStyle('Intro', parent=body_style, fontSize=12, leading=16, alignment=1)))
    story.append(Spacer(1, 150))
    story.append(Paragraph("Indian Institute of Technology Kharagpur<br/>Version 1.0 — June 2026", ParagraphStyle('Footer', parent=body_style, fontSize=9, alignment=1)))
    story.append(PageBreak())

    # Section 1: Introduction to Diabetic Foot Ulcers
    story.append(Paragraph("Section 1: Understanding Diabetic Foot Ulcers (DFUs)", h1_style))
    story.append(Paragraph("Diabetic Foot Ulcers (DFUs) are a severe and common complication of uncontrolled diabetes. They occur primarily due to a combination of nerve damage (neuropathy) and poor blood circulation (peripheral vascular disease). Key information includes:", body_style))
    story.append(Paragraph("• <b>Diabetic Neuropathy:</b> Nerve damage reduces sensation in the feet. Patients may walk on minor injuries, blisters, or foreign objects without feeling pain. This causes unnoticed skin breakdown.", bullet_style))
    story.append(Paragraph("• <b>Peripheral Vascular Disease (PVD):</b> Poor blood circulation delays wound healing. A small cut can quickly expand into a deep ulcer due to lack of oxygen and nutrients in the tissue.", bullet_style))
    story.append(Paragraph("• <b>Deformities:</b> Diabetes can alter foot structure, creating high-pressure zones under the metatarsal heads or heels, which are prone to ulceration.", bullet_style))
    story.append(Spacer(1, 10))

    # Section 2: Wagner Grading System
    story.append(Paragraph("Section 2: The Wagner Grading System", h1_style))
    story.append(Paragraph("ASHA field workers must use the Wagner classification scale to evaluate wound severity. This scale ranges from Grade 0 to Grade 5:", body_style))
    story.append(Paragraph("• <b>Wagner Grade 0:</b> Pre-ulcerative lesion. The skin is intact, but there may be hyperkeratosis (thick calluses), redness, or bony deformities placing the patient at high risk.", bullet_style))
    story.append(Paragraph("• <b>Wagner Grade 1:</b> Superficial ulcer. An open sore that involves only the skin layers (epidermis and dermis) without penetrating into deeper tissues.", bullet_style))
    story.append(Paragraph("• <b>Wagner Grade 2:</b> Deep ulcer. The ulcer penetrates through the skin into the subcutaneous tissue, exposing tendons, ligaments, joint capsules, or bone, but without deep infection or abscess.", bullet_style))
    story.append(Paragraph("• <b>Wagner Grade 3:</b> Deep ulcer with osteomyelitis or joint infection. Typically exhibits pus, localized swelling, foul smell, or a deep abscess.", bullet_style))
    story.append(Paragraph("• <b>Wagner Grade 4:</b> Localized gangrene. Gangrene is present in a specific part of the foot, such as one or more toes or the forefoot.", bullet_style))
    story.append(Paragraph("• <b>Wagner Grade 5:</b> Extensive gangrene. Gangrene involves the entire foot, requiring immediate life-saving amputation.", bullet_style))
    story.append(PageBreak())

    # Section 3: Photography and Scale Coins
    story.append(Paragraph("Section 3: Standardized Wound Photography Protocols", h1_style))
    story.append(Paragraph("Accurate image capture is crucial for the DiabetesCare AI model to estimate wound severity and healing progress. Field workers must follow these rules:", body_style))
    story.append(Paragraph("• <b>Camera Distance:</b> Keep the camera exactly 15 to 20 centimeters away from the foot. Do not hold the camera too close (causing blurry focus) or too far.", bullet_style))
    story.append(Paragraph("• <b>Lighting:</b> Ensure bright, diffuse daylight. Avoid direct glare or harsh shadows. Turn off the phone flash if it causes white hotspots on the wound.", bullet_style))
    story.append(Paragraph("• <b>Camera Angle:</b> Hold the phone parallel to the wound surface (90-degree perpendicular angle). Do not tilt the phone.", bullet_style))
    story.append(Paragraph("• <b>Scale Reference Coin:</b> Place a standard Indian 5-Rupee coin (diameter: 23mm) or 10-Rupee coin (diameter: 27mm) directly adjacent to the wound. The coin must be in the same focus plane as the wound and must not block any part of the ulcer. The AI model uses the coin to convert pixel area into actual square centimeters (cm²).", bullet_style))
    story.append(Spacer(1, 10))

    # Section 4: Clinical Referral and Red Flags
    story.append(Paragraph("Section 4: Referral Guidelines and Clinical Red Flags", h1_style))
    story.append(Paragraph("ASHA workers are the first line of defense. You must know when a patient requires immediate referral to a doctor or PHC (Primary Health Centre):", body_style))
    story.append(Paragraph("• <b>Red Flag 1 - Rapidly Spreading Erythema:</b> Redness spreading outward from the wound edges by more than 2 centimeters in a 24-hour period.", bullet_style))
    story.append(Paragraph("• <b>Red Flag 2 - Systemic Symptoms:</b> High fever (body temperature exceeding 38 degrees Celsius or 100.4 degrees Fahrenheit), chills, or severe vomiting.", bullet_style))
    story.append(Paragraph("• <b>Red Flag 3 - Necrotic Tissue:</b> Any black (eschar) or dark brown tissue, or greyish slough, which indicates dead tissue and requires urgent surgical debridement.", bullet_style))
    story.append(Paragraph("• <b>Red Flag 4 - Foul Odor:</b> A strong, putrid, or sweet smell coming from the wound, which indicates anaerobic bacterial infection.", bullet_style))
    story.append(Paragraph("• <b>Red Flag 5 - Crepitus:</b> A crackling sensation when pressing the skin around the wound, indicating gas-producing bacterial infection.", bullet_style))
    story.append(Paragraph("<b>Referral SLA:</b> Refer all Grade 2 and higher wounds within 24 hours. Refer any red flag symptoms immediately.", body_style))
    story.append(Spacer(1, 10))

    # Section 5: Teleconsultation and Patient Education
    story.append(Paragraph("Section 5: Booking Teleconsults & Patient Education", h1_style))
    story.append(Paragraph("• <b>Teleconsultation:</b> Use the DiabetesCare mobile app to book a consult. Ensure the patient's phone number and consent version are logged. A local doctor will review the AI triage score and video call the ASHA worker and patient.", bullet_style))
    story.append(Paragraph("• <b>Footwear:</b> Advise patients to never walk barefoot, even indoors. Recommend custom soft-insole diabetic footwear.", bullet_style))
    story.append(Paragraph("• <b>Daily Checks:</b> Educate patients to inspect their soles daily using a hand mirror, checking for calluses, cracks, or cuts.", bullet_style))

    doc.build(story)
    print(f"[SUCCESS] PDF generated at: {filename}")

if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    generate_pdf("data/fieldworker_training_manual.pdf")
