"""Portfolio site for Aditya Pratap Singh Takuli."""

from pathlib import Path

from flask import Flask, render_template, send_from_directory

app = Flask(__name__)
BASE_DIR = Path(__file__).resolve().parent

PROFILE = {
    "name": "Aditya Pratap Singh Takuli",
    "short_name": "Aditya",
    "title": "Software Engineer",
    "tagline": (
        "Building backend systems, data-driven models, and agentic AI — "
        "from research to production."
    ),
    "location": "Uttarakhand, India",
    "phone": "+91 8791327956",
    "email": "adityapstakuli@gmail.com",
    "summary": (
        "Software Engineer with hands-on experience building backend systems, "
        "REST APIs, and data-driven models in Python, C++, and SQL. Strong "
        "foundation in DSA, OOP, DBMS, and Operating Systems, with a proven "
        "record of shipping tested, production-grade software. Experienced in "
        "agile delivery, CI/CD, and open-source contribution, with exposure to "
        "AI/ML, agentic systems, and workflow automation."
    ),
    "links": {
        "email": "mailto:adityapstakuli@gmail.com",
        "linkedin": "https://www.linkedin.com/in/adityapstakuli",
        "github": "https://github.com/adityapstakuli",
        "leetcode": "https://leetcode.com/u/adityapstakuli",
        "x": "https://x.com/adityapstakuli",
    },
}

EDUCATION = [
    {
        "school": "Vellore Institute of Technology, Chennai",
        "degree": "B.Tech — Electronics and Communication Engineering",
        "meta": "Aug 2023 – Jul 2027 (Expected) · CGPA 8.34 / 10",
    },
    {
        "school": "St. Theresa Sr. Sec. School (CBSE)",
        "degree": "Class 12: 85% · Class 10: 89.4%",
        "meta": "",
    },
]

SKILLS = {
    "Languages": [
        "Python",
        "C++",
        "C",
        "SQL",
        "Bash/Shell",
        "Git",
    ],
    "Core CS": [
        "DSA",
        "OOP",
        "DBMS",
        "Operating Systems",
        "Networking",
        "Distributed Systems",
    ],
    "Data & Databases": [
        "PostgreSQL",
        "SQLite",
        "MongoDB",
        "Pandas",
        "NumPy",
        "XGBoost",
    ],
    "Backend & Platforms": [
        "FastAPI",
        "REST & WebSocket",
        "Docker",
        "CI/CD",
        "AWS",
        "Linux",
    ],
    "AI/ML & Automation": [
        "PyTorch",
        "Scikit-learn",
        "YOLO",
        "RAG",
        "LangChain",
        "LangGraph",
        "Agentic AI",
    ],
}

EXPERIENCE = [
    {
        "role": "Software Engineer Intern",
        "org": "Staunch Technologies Pvt. Ltd.",
        "dates": "Jan 2026 – Present",
        "points": [
            "Designed and trained detection models on embedded datasets; built scalable data pipelines for generation, preprocessing, and class-imbalance mitigation (mAP@50: 85%).",
            "Delivered a production-ready, hardware-software integrated embedded system with an enterprise banking partner (Indian Bank).",
        ],
    },
    {
        "role": "Samsung PRISM Project Intern",
        "org": "Samsung R&D",
        "dates": "June 2025 – Nov 2025",
        "points": [
            "Built a multi-output XGBoost model forecasting nine microservice performance metrics across 3,042 samples (R² ≈ 0.77).",
            "Quantified a ~3.9× throughput gain (17,522 vs 4,487 req/s) and converted benchmarks into architecture recommendations across 10+ microservices.",
        ],
    },
    {
        "role": "Technical Product Lead",
        "org": "Checkinly (Smart Hospitality Platform)",
        "dates": "June 2025 – Feb 2026",
        "points": [
            "Led end-to-end development; integrated Onfido identity verification and Tuya/TTLock IoT SDKs, cutting manual check-in time by 85–90%.",
            "Ran market and feasibility research that shaped product architecture and go-to-market decisions.",
        ],
    },
    {
        "role": "HPC / Research Intern",
        "org": "CSIR Fourth Paradigm Institute (CSIR-4PI), Bengaluru",
        "dates": "May 2025 – Aug 2025",
        "points": [
            "Designed a hybrid HTTP (REST) + WebSocket network with FastAPI for real-time WLAN data synchronisation (sub-second propagation).",
            "Optimised deep learning models for resource-constrained edge hardware.",
        ],
    },
]

PROJECTS = [
    {
        "name": "LAMDA Analytics",
        "tags": "Python · Temporal Graph Networks · Multi-Agent Systems",
        "blurb": (
            "Real-time supply-chain analytics using Temporal Graph Networks "
            "and a multi-agent architecture for scraping, normalisation, and "
            "analysis. Winner — NOKIA CERONIX National Hackathon (top 5% of 878 teams)."
        ),
    },
    {
        "name": "HSF/prmon — CERN Open Source",
        "tags": "C++ · CLI Tooling · Code Review",
        "blurb": (
            "Merged PR #302: replaced the legacy CLI parser in CERN/HSF "
            "process-monitoring tooling, preserving all 12 CLI options and "
            "passing all 14 tests. Official project contributor."
        ),
    },
    {
        "name": "Gold Detection & Segmentation",
        "tags": "Python · YOLO · OpenCV · SQLite · OCR",
        "blurb": (
            "Real-time detection pipeline with custom YOLO, person-segmentation "
            "for false-positive suppression, OCR weight extraction, and a "
            "SQLite-backed logging GUI."
        ),
    },
]

ACHIEVEMENTS = [
    {"text": "Winner, NOKIA CERONIX National Hackathon (top 5% of 878 teams)"},
    {"text": "2nd Place, CodeInit Hackathon (ACM)"},
    {"text": "Represented VIT Chennai at UK Innovate ’25"},
    {"text": "Official Contributor, CERN HSF/prmon"},
    {
        "text": "Research paper published",
        "link_text": "DOI: 10.1134/S1063782625604522",
        "url": "https://doi.org/10.1134/S1063782625604522",
    },
    {"text": "Indian Patent filed (App. No. 202641053086)"},
    {
        "text": "Certified: Python, C, C++ (IIT Bombay); Generative AI Applications (IBM)"
    },
]


@app.route("/")
def index():
    return render_template(
        "index.html",
        profile=PROFILE,
        education=EDUCATION,
        skills=SKILLS,
        experience=EXPERIENCE,
        projects=PROJECTS,
        achievements=ACHIEVEMENTS,
    )


@app.route("/resume")
def resume():
    return send_from_directory(
        BASE_DIR / "static",
        "Aditya_Pratap_Singh_Takuli_Resume.pdf",
        as_attachment=True,
    )


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
