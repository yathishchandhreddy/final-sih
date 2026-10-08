# ⚖️ NAWI-Report — Digital Legal Metrology Workflow System

> **Smart India Hackathon (SIH) Project**  
> Team: **Hack Horizon**

## 📌 Problem Statement

Legal Metrology laboratories perform testing and verification of **Non-Automatic Weighing Instruments (NAWI)** according to prescribed standards and regulations. However, many existing workflows depend on manual documentation, disconnected processes, paper-based records, and repetitive calculations.

This can result in:

- Manual errors in test calculations
- Time-consuming report preparation
- Difficulty maintaining audit trails
- Lack of transparency in the testing process
- Difficulty verifying tester identity and location
- Risk of unauthorized modification of reports
- Inefficient communication between applicants, testers, engineers, inspectors, and approving authorities

There is a need for a **secure, standardized, traceable, and digital workflow** that can manage the complete lifecycle of NAWI testing and report generation.

---

# 💡 Our Solution

**NAWI-Report** is a digital Legal Metrology workflow platform designed to streamline the complete NAWI testing and report-generation process.

The system brings together:

**Applicant → Tester → Engineer/Calibrator → Inspector → Approving Authority**

into a single controlled digital workflow.

It combines:

- 📋 Digital test workflows
- 🧮 Automated calculation engines
- 📍 GPS-based field verification
- 🤳 Tester identity verification
- 📄 Automated report generation
- 🔐 Secure report sealing
- 📝 Complete audit trails
- 👥 Role-based access control
- ✅ Rule-based PASS/FAIL evaluation

The objective is to reduce manual work while improving **accuracy, transparency, traceability, and compliance**.

---

# 🎯 Key Objectives

1. Digitize the complete NAWI testing workflow.
2. Reduce manual calculation and documentation errors.
3. Automatically evaluate test results according to applicable rules.
4. Track every stage of the report lifecycle.
5. Verify field personnel through identity and location information.
6. Generate standardized digital reports.
7. Maintain tamper-evident records and audit trails.
8. Improve transparency between stakeholders.
9. Reduce report-generation time.
10. Provide a scalable platform for Legal Metrology laboratories.

---

# 👥 User Roles

### 👤 Applicant / Instrument Owner

- Submit instrument details
- Provide testing information
- Track application status
- View generated reports

### 🧑‍🔬 Sub-Inspector / Tester

- Receive assigned instruments
- Perform field/laboratory tests
- Capture GPS information
- Perform identity verification
- Enter test observations
- Submit test results

### 👨‍🔧 Engineer / Calibrator

- Manage calibration standards
- Record standard equipment details
- Perform calibration-related activities
- Validate measurement data

### 👮 Inspector

- Review submitted test results
- Verify compliance
- Inspect supporting information
- Approve or reject reports

### 🛡️ Admin / Approving Authority

- Manage users and roles
- Configure system rules
- Review reports
- Approve final reports
- Apply secure report sealing
- Monitor audit logs

---

# 🔄 Digital Workflow

```text
Applicant
   ↓
Instrument Registration
   ↓
Test Assignment
   ↓
Tester Verification
   ├── Identity Verification
   └── GPS Verification
   ↓
NAWI Testing
   ↓
Automated Calculations
   ↓
Rule-Based Evaluation
   ↓
Engineer / Calibrator Review
   ↓
Inspector Verification
   ↓
Approving Authority
   ↓
Secure Report Sealing
   ↓
Final Digital Report
```

---

# 🧮 Automated Calculation Engine

NAWI test results should not depend on manually deciding whether an instrument passes or fails.

NAWI-Report uses a **rule-based calculation engine** to process test observations and determine compliance.

The system is designed around relevant requirements of:

**OIML R 76-1:2006**

including applicable test procedures and evaluation requirements such as:

- A.4.4
- A.4.5
- A.4.6
- A.4.7
- A.4.8

The calculation engine processes test observations and generates the corresponding evaluation.

### Example

```text
Test Input
    ↓
Validation
    ↓
Calculation
    ↓
Tolerance / Requirement Check
    ↓
Automatic Evaluation
    ↓
PASS / FAIL
```

This minimizes human calculation errors and ensures consistent evaluation.

---

# 📍 GPS & Field Verification

For field-based testing, the system can record:

- Tester location
- Testing location
- Timestamp
- Assignment information

This provides additional evidence that the assigned test was performed at the expected location.

---

# 🤳 Identity Verification

The platform incorporates tester identity verification to reduce unauthorized use of accounts during field testing.

The system can perform verification before important testing activities.

A verification result is stored along with the corresponding workflow event.

---

# 🔐 Security & Audit Trail

Security and traceability are important because Legal Metrology reports can have regulatory significance.

NAWI-Report maintains:

- Role-based access control
- User authentication
- Timestamped activities
- Workflow history
- Audit logs
- Report version tracking
- Secure report sealing
- SHA-256 based integrity verification

### Report Integrity

```text
Generated Report
       ↓
SHA-256 Hash
       ↓
Integrity Seal
       ↓
Final Digital Report
```

Any modification after sealing can therefore be detected by comparing the generated hash.

---

# 📄 Digital Report Generation

Instead of manually preparing reports, the platform generates structured digital reports containing:

- Instrument information
- Manufacturer details
- Model and serial number
- Test conditions
- Test observations
- Reference standards
- Calculated results
- Compliance evaluation
- Tester information
- Location information
- Timestamps
- Approval information
- Audit information

The system can support generation of:

- **PDF reports**
- **Editable Word documents**

---

# 🏗️ System Architecture

```text
                  ┌─────────────────────┐
                  │       Users         │
                  │ Applicant / Tester  │
                  │ Engineer / Inspector│
                  │ Admin / Authority   │
                  └──────────┬──────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │   Web Application   │
                  └──────────┬──────────┘
                             │
             ┌───────────────┼────────────────┐
             ▼               ▼                ▼
      ┌────────────┐  ┌─────────────┐  ┌──────────────┐
      │ Workflow   │  │ Calculation │  │ Verification │
      │ Management │  │   Engine    │  │   Services   │
      └────────────┘  └─────────────┘  └──────────────┘
             │               │                │
             └───────────────┼────────────────┘
                             ▼
                  ┌─────────────────────┐
                  │ Report Generation   │
                  │ & Digital Sealing   │
                  └──────────┬──────────┘
                             ▼
                  ┌─────────────────────┐
                  │ Audit & Data Store │
                  └─────────────────────┘
```

---

# 🛠️ Major Modules

| Module | Purpose |
|---|---|
| Authentication | Secure user login |
| Role Management | Control user permissions |
| Application Management | Register testing requests |
| Instrument Management | Maintain instrument details |
| Assignment Management | Assign tests to personnel |
| Identity Verification | Verify tester identity |
| GPS Verification | Record testing location |
| Testing Module | Record observations |
| Calculation Engine | Perform automated calculations |
| Compliance Engine | Determine evaluation |
| Report Generator | Generate digital reports |
| Approval Workflow | Manage review and approval |
| Audit Trail | Track every important activity |
| Digital Sealing | Protect report integrity |
| Admin Dashboard | System management |

---

# 📊 Advantages

### Before NAWI-Report

```text
Manual Forms
     ↓
Manual Calculations
     ↓
Manual Report Preparation
     ↓
Physical Verification
     ↓
Multiple Review Stages
     ↓
Paper / Disconnected Records
```

### With NAWI-Report

```text
Digital Application
       ↓
Digital Testing
       ↓
Automated Calculations
       ↓
Automatic Evaluation
       ↓
Digital Review
       ↓
Secure Digital Report
       ↓
Auditable Record
```

### Key Benefits

✅ Reduced paperwork  
✅ Reduced calculation errors  
✅ Faster report generation  
✅ Better traceability  
✅ Improved transparency  
✅ Secure report integrity  
✅ Centralized workflow  
✅ Easier auditing  
✅ Standardized reporting  
✅ Scalable architecture  

---

# 🌐 Technology Stack

The project can be implemented using modern web technologies such as:

### Frontend

- React
- Vite
- JavaScript / TypeScript
- HTML5
- CSS3

### Backend

- REST APIs
- Server-side application logic
- Database services

### Database

- PostgreSQL / Supabase

### AI / Intelligent Components

- Face/identity verification
- Rule-based evaluation
- Intelligent workflow assistance

### Security

- Authentication
- Role-Based Access Control (RBAC)
- SHA-256 integrity hashing
- Audit logging

### Document Processing

- PDF generation
- Editable Word document generation

---

# 📁 Project Structure

```text
NAWI-Report/
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── modules/
│   ├── services/
│   ├── calculations/
│   ├── reports/
│   └── utils/
│
├── public/
│
├── database/
│
├── documentation/
│
├── README.md
├── package.json
└── vite.config.js
```

---

# 🚀 Future Enhancements

- 📱 Mobile application for field inspectors
- 🌐 Multi-state Legal Metrology deployment
- 🔗 Government system integration
- 📡 Offline-first field testing
- 🧠 AI-assisted anomaly detection
- 📊 Advanced analytics dashboards
- 🔎 QR-based report verification
- 🌍 Multi-language support
- ☁️ Government cloud deployment
- 🔐 Digital Signature integration

---

# 🎯 Expected Impact

NAWI-Report aims to transform the traditional NAWI testing process from a **manual, fragmented workflow into a secure, digital, traceable ecosystem**.

The platform can help Legal Metrology laboratories:

> **Test faster → Calculate accurately → Review efficiently → Generate securely → Audit transparently**

---

# 👨‍💻 Team

## Hack Horizon

**Smart India Hackathon Team**

We are a student team focused on building practical technology solutions for real-world government and industry problems.

---

# 📜 Compliance Reference

The system is designed with reference to:

**OIML R 76-1:2006 — Non-automatic weighing instruments — Part 1: Metrological and technical requirements — Tests**

> The software is intended to assist the workflow and calculations; final regulatory decisions remain subject to the applicable Legal Metrology authority, standards, procedures, and verification requirements.

---

# ⭐ Project Vision

**NAWI-Report — Digitizing Trust in Legal Metrology.**

From **manual testing records** to **secure, traceable, intelligent digital reports**.
