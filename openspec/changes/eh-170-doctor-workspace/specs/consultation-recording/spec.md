# Spec Delta

## Purpose

Define a consented Dictaphone workflow that turns a consultation recording into a source-preserving draft note and requires clinician review before the note becomes part of a patient's medical record.

## ADDED Requirements

### Requirement: Recording requires consultation context and consent
A recording SHALL be associated with an authorized clinic consultation and patient Profile before capture begins. The system SHALL require the applicable recording consent state and SHALL not start capture when consent is absent, expired, or revoked.

#### Scenario: Recording starts after consent
- **WHEN** an authorized clinician starts a recording for a consultation with valid consent
- **THEN** the system creates a recording session bound to that consultation and patient
- **AND** the session indicates that audio capture is active

#### Scenario: Recording consent is unavailable
- **WHEN** a clinician starts recording without valid consent
- **THEN** the system refuses capture
- **AND** it stores no audio bytes or transcript for that attempt
- **AND** the UI explains that consent is required

### Requirement: Recording lifecycle is explicit
The Dictaphone SHALL expose distinct states for recording, upload, transcription, review, completion, cancellation, and failure. A failed or cancelled state SHALL not be presented as a completed medical note.

#### Scenario: Transcription is processing
- **WHEN** an audio upload has been accepted and transcription has not completed
- **THEN** the recording shows a processing state
- **AND** no draft note is presented as final

#### Scenario: Processing fails
- **WHEN** audio upload or transcription fails
- **THEN** the recording shows a recoverable failure state with a retry or discard action
- **AND** the failed response does not expose raw provider errors or unrelated patient data

### Requirement: Transcription preserves source provenance
A successful transcription SHALL retain recording identity, consultation identity, creation time, processing state, source language or locale when known, and a stable link to the source audio under the authorized retention policy. The transcript SHALL remain a draft source and SHALL not silently replace the original audio state.

#### Scenario: Transcript is produced
- **WHEN** transcription completes successfully
- **THEN** the system stores the transcript as a draft linked to the recording and consultation
- **AND** the clinician can distinguish transcript content from reviewed medical-note content

#### Scenario: Transcript is unavailable
- **WHEN** the source audio remains available but transcription is unavailable
- **THEN** the consultation shows the recording failure or unavailable state
- **AND** it does not fabricate a note from missing transcript content

### Requirement: Structured notes are source-grounded drafts
The system MAY create a structured consultation-note candidate from the transcript, but each factual field SHALL retain a source reference or an explicit unavailable state. Missing information SHALL remain missing. The candidate SHALL not introduce a diagnosis, treatment direction, urgency instruction, or other unsupported clinical directive.

#### Scenario: Candidate note contains supported content
- **WHEN** the transcript contains content that maps to an allowed consultation-note field
- **THEN** the candidate preserves the source reference and the extracted wording or structured value
- **AND** the candidate is marked as awaiting clinician review

#### Scenario: Candidate contains unsupported medical direction
- **WHEN** transcription or structuring produces an unsupported diagnosis, treatment, or urgency directive
- **THEN** the candidate rejects or removes that content
- **AND** the review surface shows a safe limitation instead of publishing it as a fact

### Requirement: Clinician review is required before persistence
A structured consultation-note candidate SHALL not become a final medical record until an authorized clinician reviews, edits, and explicitly saves it. The final note SHALL retain author, reviewer, review time, source references, and revision history.

#### Scenario: Clinician approves a note
- **WHEN** an authorized clinician reviews the candidate and saves the corrected note
- **THEN** the system marks the note as reviewed
- **AND** the final note is available only through the consultation and patient access scopes
- **AND** the original transcript remains distinguishable from the reviewed note

#### Scenario: Clinician leaves the candidate unreviewed
- **WHEN** a clinician exits without approving the candidate
- **THEN** the candidate remains a draft
- **AND** it is not presented as a final medical record or shared as an approved clinical note

### Requirement: Audio and note retention are independently controlled
The system SHALL support separate retention and deletion decisions for source audio, transcript drafts, and reviewed consultation notes. Deleting audio SHALL not silently delete a reviewed note whose source references and retention policy permit it, and deleting the consultation SHALL remove or invalidate its derived artifacts according to the declared lifecycle.

#### Scenario: Audio is deleted after review
- **WHEN** policy or an authorized clinician deletes source audio after a note is reviewed
- **THEN** the reviewed note remains only if its retention policy permits
- **AND** the note marks the audio source as unavailable
- **AND** no deleted audio bytes can be retrieved
