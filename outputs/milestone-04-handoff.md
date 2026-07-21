# LearnSphere AI — Milestone 4 handoff

## Completed

- Learner-profile API: `GET /api/v1/learners/{learner_id}/profile`
- Attempt-recording API: `POST /api/v1/learning/attempts`
- Topic mastery based on accuracy and confidence calibration
- Structured misconception insight: label, why, correction, and a verification question
- A deliberate seasonality detector for the distance-to-Sun misconception; a safe general fallback for other topics

## Validation

The pure learning engine compiled and passed the key scenario: a confident but incorrect seasons answer was classified as `Distance-to-Sun misconception`, recorded as one attempt, and added to the profile’s misconception count.

## Current limitation

Profile data is in process memory. The next and final hackathon milestone should swap this repository for PostgreSQL and add a seeded two-minute demo journey.
