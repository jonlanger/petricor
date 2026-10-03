# User flows

Personas come from the original Petricor research: Dr. Alex Morgan (senior microbiologist), Dr. Emily Thompson (senior mycologist), Dr. Jane Miller (environmental mycologist), Dr. Michael Brown (lab director), plus a lab technician (Sam Ortiz). Research showed that trust in the physical workflow comes first, so the device flow is linear, interruptible and verifiable at every step.

## On the instrument (`/device`)

```mermaid
flowchart TD
  L[Lock screen<br/>tap badge] --> H{Device state}
  H -->|idle| HOME[Home: chamber status, recent runs<br/>New run · UV-C]
  HOME --> P[1 Protocol]
  P --> S[2 Samples<br/>pick from queue or register]
  S --> PR[3 Print labels]
  PR --> SC[4 Scan each dish at side reader<br/>unknown barcodes rejected]
  SC --> LD[5 Load<br/>carousel presents each pocket at the door]
  LD --> ST[6 Close door → Start<br/>baseline image set]
  ST --> RUN[Incubation dashboard<br/>progress · T/RH · next image set<br/>under-the-camera view · carousel map]
  RUN --> DD[Dish detail<br/>4 channels · colonies · presumptive IDs]
  RUN -->|done| UL[Complete → open door → Dishes removed]
  UL --> UV[Close door → UV-C cycle] --> HOME
  H -->|any| SV[Service: reservoir, HEPA, UV-C, labels, speed]
```

What a person does with their hands is kept in the **At the bench** panel, not on the touchscreen: lifting the door, taking printed labels, presenting dishes to the reader, refilling the reservoir. That keeps the touchscreen honest about what it can and can't control.

Error states the UI handles: door open during incubation (warning banner, alarm suppression while recovering), temperature deviation (critical banner), reservoir low, scanning an unknown barcode, loading before scanning, starting with the door open, and abort (with confirmation).

## In the cloud (`/app`)

| Persona | Primary path |
|---|---|
| Technician | Overview → live run → dish → back to bench. Samples to register and check custody. |
| Senior microbiologist | Overview **Review queue** → Run → timelapse, colonies, environment → **Approve / Request changes** → Report / CSV |
| Mycologist | Run → colony detail (diameter over time, radial rate, alternatives) → Species reference (growth model, GBIF, Commons) → Mycelium lab |
| Lab director | Overview KPIs → Instruments (fleet, consumables, offline queue) → Audit trail → Settings (roles, protocols, integrations) |

Every review, alert acknowledgement and run lifecycle event lands in the append-only audit trail.
