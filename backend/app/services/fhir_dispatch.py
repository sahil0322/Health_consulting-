"""
Builds and sends FHIR resources to pharmacy/lab endpoints.

Stubbed — logs instead of making a real network call. Production should:
  1. Build proper FHIR MedicationRequest / ServiceRequest JSON resources
     from the Prescription / DiagnosticOrder rows.
  2. POST to each facility's `fhir_endpoint_url` (see Facility model),
     with retry-with-backoff and a dead-letter queue for failed sends —
     a doctor approving an order and it silently failing to reach the
     pharmacy is the single worst failure mode in this whole system.
  3. Record delivery status back onto the Prescription/DiagnosticOrder
     row so the frontend can show "dispatched" vs "delivery failed"
     rather than just "dispatched" forever.
"""
import logging

from app.models.consultation import Consultation

logger = logging.getLogger("fhir_dispatch")


def send_bundle(consultation: Consultation) -> None:
    logger.info(
        "Would dispatch FHIR bundle for consultation %s (%d prescriptions, %d diagnostic orders) — stubbed, not sent.",
        consultation.id,
        len(consultation.prescriptions),
        len(consultation.orders),
    )
