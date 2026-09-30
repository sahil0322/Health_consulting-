"""
Populates a fresh dev database with data that mirrors the frontend's
mock data (same patient names, same sample consultation) so the two
sides visibly match up when you wire them together.

Run with: python -m app.seed
"""
from datetime import date

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models.consultation import ClaimCategory, ClaimDecision, Consultation, ConsultationStatus
from app.models.consultation import AIClaim, TranscriptLine
from app.models.facility import Facility
from app.models.patient import Patient
from app.models.user import User


def run() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).first():
            print("Database already has data — skipping seed.")
            return

        doctor = User(
            email="r.sharma@consult.dev",
            hashed_password=hash_password("devpassword123"),
            full_name="Dr. R. Sharma",
            role="doctor",
        )
        db.add(doctor)

        lab = Facility(name="PathLab Diagnostics", kind="lab")
        pharmacy = Facility(name="Apollo Pharmacy \u2014 MG Road", kind="pharmacy")
        db.add_all([lab, pharmacy])
        db.flush()

        lab_staff = User(
            email="lab@pathlab.dev",
            hashed_password=hash_password("devpassword123"),
            full_name="PathLab Front Desk",
            role="facility_staff",
            facility_id=lab.id,
        )
        db.add(lab_staff)

        patient = Patient(
            full_name="Meera Iyer",
            date_of_birth=date(1992, 3, 12),
            sex="female",
            phone="+91 98xxxxxx21",
            address="Pithampur, Madhya Pradesh",
            blood_group="B+",
            allergies=["Penicillin (rash)"],
            chronic_conditions=["Seasonal allergic rhinitis"],
            current_medications=["Cetirizine 10mg, as needed"],
        )
        db.add(patient)
        db.flush()

        consultation = Consultation(
            patient_id=patient.id,
            doctor_id=doctor.id,
            chief_complaint="Sore throat, fever",
            status=ConsultationStatus.READY_FOR_REVIEW,
        )
        db.add(consultation)
        db.flush()

        # Speaker is "dictation" for every line, matching what the real
        # pipeline actually produces: Whisper has no diarization, so
        # there's no doctor/patient split to seed here either — see
        # app/services/ai_pipeline.py.
        lines = [
            "What brings you in today?",
            "I've had a sore throat and fever since yesterday evening.",
            "Any cough, or trouble swallowing?",
            "A little trouble swallowing, no real cough.",
        ]
        line_objs = []
        for i, text in enumerate(lines):
            line = TranscriptLine(consultation_id=consultation.id, sequence=i, speaker="dictation", text=text)
            db.add(line)
            line_objs.append(line)
        db.flush()

        db.add(
            AIClaim(
                consultation_id=consultation.id,
                category=ClaimCategory.SUMMARY,
                text="Sore throat and fever for approximately 18 hours, progressively worsening.",
                decision=ClaimDecision.PENDING,
                source_line_ids=[line_objs[1].id],
            )
        )

        db.commit()
        print("Seeded: 1 doctor, 1 facility staff, 1 patient, 1 consultation.")
        print("Login as doctor: r.sharma@consult.dev / devpassword123")
        print("Login as lab staff: lab@pathlab.dev / devpassword123")
    finally:
        db.close()


if __name__ == "__main__":
    run()
