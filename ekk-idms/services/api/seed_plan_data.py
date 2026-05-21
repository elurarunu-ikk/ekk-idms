import uuid
import random
from datetime import date, datetime, timedelta
from database import SessionLocal
from models.plan_data import PlanData

# Configuration
PROJECT_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
STAGES = ["Subgrade", "Sub-base", "Base", "Prime", "Surface"]
STAGE_CODES = {
    "Subgrade": "SG",
    "Sub-base": "SB",
    "Base": "BS",
    "Prime": "PR",
    "Surface": "SF",
}
CONTRACTORS = [
    "ABC Construction Sdn Bhd",
    "Rapid Build Contractors",
    "Mega Civil Works",
    "Pioneer Road Builders",
]
ROAD_SIDES = ["Left", "Right", "Both"]
ROAD_SIDE_WEIGHTS = [20, 20, 60]  # weights for Left, Right, Both

SECTION_SIZE = 0.5  # km
TOTAL_LENGTH = 25.0  # km
PROJECT_START = date(2025, 1, 1)
PROJECT_END = date(2025, 12, 31)

DAYS_PER_STAGE = 60
TOTAL_SECTIONS = int(TOTAL_LENGTH / SECTION_SIZE)


def seed():
    """Generate and insert plan data records."""
    db = SessionLocal()
    try:
        print("Generating plan data for 5 stages x 50 sections...")
        
        records = []
        
        for stage_index, stage in enumerate(STAGES):
            stage_code = STAGE_CODES[stage]
            stage_start = PROJECT_START + timedelta(days=stage_index * DAYS_PER_STAGE)
            
            # Days per section within a stage
            days_per_section = DAYS_PER_STAGE / TOTAL_SECTIONS
            
            for section_index in range(TOTAL_SECTIONS):
                chainage_from = section_index * SECTION_SIZE
                chainage_to = chainage_from + SECTION_SIZE
                planned_qty_lm = (chainage_to - chainage_from) * 1000
                
                activity_code = f"RD-{stage_code}-{section_index:03d}"
                contractor_name = CONTRACTORS[section_index % len(CONTRACTORS)]
                road_side = random.choices(ROAD_SIDES, weights=ROAD_SIDE_WEIGHTS)[0]
                
                # Target dates
                section_start = stage_start + timedelta(days=section_index * days_per_section)
                section_end = section_start + timedelta(days=max(7, days_per_section))
                
                record = PlanData(
                    id=uuid.uuid4(),
                    project_id=PROJECT_ID,
                    activity_code=activity_code,
                    chainage_from=chainage_from,
                    chainage_to=chainage_to,
                    stage=stage,
                    planned_qty_lm=planned_qty_lm,
                    target_start=section_start,
                    target_end=section_end,
                    contractor_name=contractor_name,
                    road_side=road_side,
                    is_active=True,
                )
                records.append(record)
        
        print(f"Inserting {len(records)} records...")
        db.add_all(records)
        db.commit()
        db.close()
        
        print("\nDone!")
        print(f"Project ID: {PROJECT_ID}")
        print("Use this project_id in all test capture entries")
        print("\nSummary:")
        print(f"  Total records: {len(records)}")
        print(f"  Stages: {len(STAGES)}")
        print(f"  Sections: {TOTAL_SECTIONS}")
        print(f"  Total planned LM: {TOTAL_SECTIONS * 500.0}")
        print(f"  Chainage range: 0.0 km to 25.0 km")

    except Exception as e:
        db.rollback()
        db.close()
        print(f"Error seeding plan data: {str(e)}")
        raise


if __name__ == "__main__":
    seed()
