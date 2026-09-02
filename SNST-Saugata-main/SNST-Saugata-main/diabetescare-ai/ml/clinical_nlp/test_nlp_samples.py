"""
Test Clinical NLP Pipeline with Sample Doctor Notes
Week 4 - Saugata Malakar

Tests the spaCy NLP pipeline on 10 realistic doctor consultation notes
to verify entity extraction accuracy.
"""

import json
from clinical_nlp_pipeline import ClinicalNLPPipeline


# Sample doctor notes for testing
SAMPLE_NOTES = [
    # Case 1: Moderate ulcer with infection
    {
        "case_id": "CASE_001",
        "note": """
58-year-old male diabetic patient presents with chronic ulcer on left foot, 
plantar surface near the first toe. Wound measuring 3x2 cm with surrounding 
cellulitis extending approximately 4 cm. Purulent discharge noted with foul odor. 
Patient reports fever since yesterday.

Physical exam reveals erythema, warmth, and tenderness. Wound probing shows 
depth extending to tendon level. No exposed bone palpable.

Assessment: Wagner Grade 2 diabetic foot ulcer with signs of active infection.

Plan:
- Start broad spectrum IV antibiotics (Piperacillin-Tazobactam)
- Arrange surgical debridement for tomorrow
- Daily dressing changes with silver foam dressing
- Non-weight bearing on left foot, wheelchair for mobility
- X-ray left foot to rule out osteomyelitis
- Optimize glycemic control, target HbA1c <7%
- Refer to vascular surgery for arterial assessment
        """
    },
    
    # Case 2: Severe ulcer requiring amputation
    {
        "case_id": "CASE_002",
        "note": """
67-year-old female with 20-year history of diabetes. Presents with gangrenous 
changes to right great toe and forefoot. Black necrotic tissue covering entire 
great toe with proximal spread. Patient reports severe pain despite analgesics.

Examination shows extensive gangrene with signs of sepsis - tachycardia, 
hypotension, elevated WBC 18,000. Foul malodorous discharge from wound margins.

Assessment: Wagner Grade 5 - extensive foot gangrene with systemic sepsis.

Immediate plan:
- Admit to hospital immediately
- IV antibiotics - Vancomycin + Meropenem
- Consult vascular surgery urgently
- Blood cultures, inflammatory markers
- Arrange below knee amputation within 24 hours
- ICU monitoring for sepsis management
        """
    },
    
    # Case 3: Healing ulcer with good progress
    {
        "case_id": "CASE_003",
        "note": """
52-year-old male with diabetic foot ulcer on right heel, under follow-up for 
4 weeks. Wound showing excellent granulation tissue, healthy pink appearance. 
Size reduced from 4x3 cm to 2x1 cm. No signs of infection.

Patient compliant with offloading using cast boot. HbA1c improved from 9.2% 
to 7.4% with insulin adjustment.

Assessment: Healing well, Wagner Grade 1 improving.

Plan:
- Continue current wound dressing with hydrogel
- Continue offloading with cast boot for 2 more weeks
- Weekly dressing changes
- Follow up in 1 week
- No antibiotics needed
        """
    },
    
    # Case 4: New ulcer requiring urgent care
    {
        "case_id": "CASE_004",
        "note": """
Patient presents with 3-day history of new ulcer on left lateral malleolus. 
Erythema spreading rapidly, now covering entire ankle region. Hot to touch, 
fluctuant area suggesting abscess formation.

Diabetic for 15 years, poor control (HbA1c 11.2%). Peripheral neuropathy present.

Assessment: Acute infected ulcer with abscess, likely cellulitis.

Urgent plan:
- Admit for IV antibiotics
- Incision and drainage of abscess
- Sharp debridement of necrotic tissue
- Daily dressing with silver-impregnated foam
- Strict blood glucose monitoring
- MRI scan to rule out deep abscess or osteomyelitis
- Infectious disease consult
        """
    },
    
    # Case 5: Multiple ulcers, complex case
    {
        "case_id": "CASE_005",
        "note": """
75-year-old diabetic with multiple ulcers: right second toe, left heel, and 
left midfoot plantar surface. All wounds showing signs of infection with 
purulent discharge. Patient has significant peripheral vascular disease.

Right second toe shows extensive necrosis, likely requiring toe amputation. 
Left heel ulcer 5x4 cm with exposed bone, concerning for osteomyelitis.

Assessment: Multiple Wagner Grade 3-4 ulcers with vascular compromise.

Comprehensive plan:
- Hospital admission
- Pan-culture from all wound sites
- Start empiric IV antibiotics - Vancomycin + Piperacillin-Tazobactam
- Vascular surgery consult for arterial revascularization
- Bone biopsy from left heel for osteomyelitis diagnosis
- Right second toe amputation planned
- Negative pressure wound therapy (VAC) for left heel post-debridement
- Podiatry involvement for long-term foot care
        """
    },
    
    # Case 6: Post-operative follow-up
    {
        "case_id": "CASE_006",
        "note": """
Post-operative day 7 following left fifth toe amputation. Surgical site healing 
well, no signs of infection. Suture line intact, minimal serous drainage.

Patient ambulating with offloading shoe. Pain controlled with oral analgesics.

Assessment: Post-amputation, healing well.

Plan:
- Continue daily dressing changes
- Remove sutures in 1 week
- Continue oral antibiotics (Augmentin) for 3 more days
- Gradual weight bearing as tolerated
- Physical therapy referral
- Follow up in 1 week for suture removal
        """
    },
    
    # Case 7: Early stage ulcer
    {
        "case_id": "CASE_007",
        "note": """
45-year-old male diabetic presents with small superficial ulcer on right dorsal 
foot, over second metatarsal head. Wound 1x1 cm, clean base, no signs of 
infection. Patient noticed yesterday after removing tight shoes.

Good pulses palpable, no neuropathy detected.

Assessment: Wagner Grade 1 superficial ulcer, low infection risk.

Plan:
- Wound cleansing with saline
- Hydrogel dressing
- Proper footwear education
- Weekly dressing changes
- No antibiotics needed at this time
- Monitor for any signs of infection
- Follow up in 2 weeks
        """
    },
    
    # Case 8: Infected ulcer with osteomyelitis
    {
        "case_id": "CASE_008",
        "note": """
62-year-old diabetic with chronic ulcer on right heel, present for 6 months. 
Despite multiple debridements and antibiotics, wound not improving. Recent 
X-ray shows bone erosion suggestive of osteomyelitis.

Probe-to-bone test positive. Surrounding cellulitis with erythema, indurated 
margins, and malodorous discharge.

Assessment: Wagner Grade 3 with confirmed osteomyelitis.

Aggressive plan:
- MRI to define extent of bone infection
- Infectious disease consultation
- Prolonged IV antibiotic therapy (6-8 weeks) - Vancomycin + Ceftriaxone
- Consider surgical resection of infected bone
- PICC line placement for long-term IV access
- Hyperbaric oxygen therapy referral
- Strict glucose control, insulin pump consideration
        """
    },
    
    # Case 9: Ulcer with good vascular supply
    {
        "case_id": "CASE_009",
        "note": """
55-year-old diabetic with ulcer on left instep, medial aspect. Wound 2x2 cm, 
clean granulation tissue visible. Doppler shows good arterial flow, palpable 
pedal pulses bilaterally.

Patient has been compliant with total contact cast for 3 weeks. Wound reducing 
in size appropriately.

Assessment: Wagner Grade 1, healing progressing well with good vascular supply.

Plan:
- Continue total contact cast
- Weekly monitoring
- Continue current dressing regimen (foam dressing)
- No antibiotics required
- Optimize nutrition with protein supplementation
- Follow up weekly for cast changes
        """
    },
    
    # Case 10: Complex case with multiple comorbidities
    {
        "case_id": "CASE_010",
        "note": """
70-year-old diabetic patient with end-stage renal disease on dialysis. Presents 
with ulcer on right plantar surface, fourth metatarsal head. Wound 3x2 cm with 
slough covering 60% of wound bed. Surrounding area showing early cellulitis.

Patient also has congestive heart failure and peripheral vascular disease. 
Recent HbA1c 9.8%.

Assessment: Wagner Grade 2 ulcer in high-risk patient with multiple comorbidities.

Multidisciplinary plan:
- Nephrology - coordinate antibiotic dosing with dialysis schedule
- Cardiology - optimize heart failure management before any procedures
- Start IV antibiotics with renal dosing - Vancomycin (post-dialysis)
- Gentle debridement of slough tissue
- Offloading with wheelchair, no weight bearing
- Daily dressing changes
- Vascular assessment for possible revascularization
- Palliative care consult for complex case management
- Strict fluid balance monitoring
- Weekly multidisciplinary team meetings
        """
    }
]


def test_nlp_pipeline():
    """Test NLP pipeline on all sample notes"""
    
    print("=" * 80)
    print("CLINICAL NLP PIPELINE TEST")
    print("Week 4 - Saugata Malakar")
    print("=" * 80)
    print()
    
    # Initialize pipeline
    print("Initializing NLP pipeline...")
    pipeline = ClinicalNLPPipeline()
    print("✓ Pipeline ready")
    print()
    
    # Process each sample note
    results = []
    
    for sample in SAMPLE_NOTES:
        print("-" * 80)
        print(f"Processing: {sample['case_id']}")
        print("-" * 80)
        
        # Extract entities
        result = pipeline.process_note(sample['note'], note_id=sample['case_id'])
        results.append(result)
        
        # Display results
        print(f"\n✓ EXTRACTED ENTITIES:")
        print(f"\nWound Locations ({len(result['extracted_entities']['wound_location'])}):")
        for loc in result['extracted_entities']['wound_location']:
            print(f"  • {loc}")
        
        print(f"\nInfection Signs ({len(result['extracted_entities']['infection_sign'])}):")
        for sign in result['extracted_entities']['infection_sign']:
            print(f"  • {sign}")
        
        print(f"\nTreatment Recommendations ({len(result['extracted_entities']['treatment_recommendation'])}):")
        for treatment in result['extracted_entities']['treatment_recommendation']:
            print(f"  • {treatment}")
        
        print()
    
    print("=" * 80)
    print("SUMMARY STATISTICS")
    print("=" * 80)
    
    total_locations = sum(r['entity_count']['wound_locations'] for r in results)
    total_infections = sum(r['entity_count']['infection_signs'] for r in results)
    total_treatments = sum(r['entity_count']['treatment_recommendations'] for r in results)
    
    print(f"Total cases processed: {len(results)}")
    print(f"Total wound locations extracted: {total_locations}")
    print(f"Total infection signs extracted: {total_infections}")
    print(f"Total treatment recommendations extracted: {total_treatments}")
    print()
    
    avg_locations = total_locations / len(results)
    avg_infections = total_infections / len(results)
    avg_treatments = total_treatments / len(results)
    
    print(f"Average per case:")
    print(f"  - Wound locations: {avg_locations:.1f}")
    print(f"  - Infection signs: {avg_infections:.1f}")
    print(f"  - Treatment recommendations: {avg_treatments:.1f}")
    print()
    
    # Save detailed results to JSON
    output_file = "nlp_test_results.json"
    with open(output_file, 'w') as f:
        json.dump(results, indent=2, fp=f)
    
    print(f"✓ Detailed results saved to: {output_file}")
    print()
    
    return results


if __name__ == "__main__":
    test_nlp_pipeline()
