#!/usr/bin/env python3
"""Generates the static HTML pages. Edit the content below, then run:  python3 build.py"""
import json
import time
from html import escape
from pathlib import Path

ROOT = Path(__file__).parent
VERSION = int(time.time())  # appended to the CSS/JS links so browsers load the latest build

NAME = "Alessandra Annoni"
SITE_URL = "https://www.alessandraannoni.it/"
CF_ANALYTICS_TOKEN = "241b9e1f7a294751af2274a98c447858"  # Cloudflare Web Analytics (public, not a secret)  # used for link previews, which need full addresses
EMAIL = "alessandra@annoni.com"
LINKEDIN = "https://www.linkedin.com/in/alessandra-annoni-1a3aa2204/"

NAV = [("About", "about.html"), ("Projects", "index.html"), ("Laboratory", "laboratory.html")]

PROJECTS = {
    "lego-replay": {
        "name": "LEGO Replay",
        "short": "A circular LEGO rental service.",
        "intro": "I designed a circular LEGO rental service that extends the life of bricks and makes it easy to "
                 "borrow, return, and reuse sets — at home, in-store, and for operators.",
        "tags": "Service design, UX/UI, Circular economy, Research, Benchmarking",
        "facts": [
            ("Timeline", "Feb – Dec 2025"),
            ("Team", "individual thesis project"),
            ("My focus", "research, service design, UX/UI, prototyping, testing"),
            ("Tools", "Figma, Adobe Suite"),
        ],
        # The page as a sequence of chapters on a two-column grid: the title on the left, the text on
        # the right. "lead" is the sentence that states the point of the chapter. In "text": a string is
        # a paragraph, a list is a set of numbered points ("Title: description"). The images of each
        # chapter are in FIGMA_MEDIA.
        "story": [
            {
                "title": "Starting point",
                "lead": "Can LEGO leave rental to third parties, when it touches sustainability, experience and "
                        "digital engagement?",
                "text": [
                    "Independent services already let people rent LEGO sets instead of buying them, while "
                    "millions of still-functional toys are thrown away every year. Bricks can be used, taken "
                    "apart and rebuilt many times: a natural fit for a circular model.",
                ],
            },
            {
                "title": "Research",
                "lead": "No one had rented LEGO before, but about half would try.",
                "figures": [
                    ("70", "Survey responses"),
                    ("18–55", "Age range"),
                    ("0", "Had rented LEGO before"),
                    ("~50%", "Would try a rental"),
                ],
                "text": [
                    "People expect one to three sets a month, home delivery and pickup, and an app with "
                    "reminders. A benchmark of five rental services showed what an official one must get "
                    "right: trust in quality, clear policies, reliable logistics.",
                    [
                        "Giulia, 23 — young adult: Limited budget and space; renting lets her build regularly "
                        "without commitment.",
                        "Luca, 36 — millennial parent: Rotating sets keeps his son’s play fresh without cost, "
                        "clutter or waste.",
                    ],
                ],
            },
            {
                "title": "Concept",
                "lead": "Rental and trade-in in a single circular system, inside LEGO’s existing ecosystem.",
                "text": [
                    "Users rent sets through the LEGO website and app, and return underused ones for points or "
                    "credit. Returned sets are inspected, refurbished and put back into circulation; "
                    "incomplete ones become spare parts.",
                ],
            },
            {
                "title": "Key design decisions",
                "lead": "Trust comes first: people need to know what has been done to the set they receive.",
                "text": [[
                    "Quality as a service promise: clear cleaning standards and A/B/C set grading.",
                    "Service logic before UI: the full lifecycle mapped before designing screens.",
                    "Trust mechanics over punishment: credits for timely, complete returns.",
                    "Return-ready packaging: modular containers and labels for fast sorting.",
                ]],
            },
            {
                "title": "Digital integration",
                "lead": "How can rental and trade-in be added to LEGO.com and the Builder app without "
                        "fragmenting the experience?",
                "text": [
                    "Replay reuses existing LEGO patterns — cards, filters, checkout, account pages — so rental "
                    "and trade-in live inside the current system.",
                    [
                        "First rental: compare plans, pick a set, confirm in the familiar checkout.",
                        "Active rental: one card with dates, a countdown and quick actions.",
                        "Trade-in: mark the condition, choose shipping or drop-off, get a timeline for credit.",
                    ],
                ],
            },
            {
                "title": "Usability testing",
                "lead": "The circular idea works only if the journey is crystal clear.",
                "figures": [
                    ("10", "Participants"),
                    ("3", "Scenarios tested"),
                    ("40–50", "Minutes per session"),
                ],
                "text": [
                    "Ten participants with mixed LEGO familiarity tried three scenarios: first rental, rental "
                    "management and trade-in, in moderated sessions. The renting path was hard to find and trade-in lacked a “what happens next” step. Making "
                    "entry points and confirmations more visible reduced confusion, and one shared points "
                    "system made returning sets feel like unlocking the next build.",
                ],
            },
            {
                "title": "Limits and next steps",
                "lead": "Encouraging results, from a small prototype-based study.",
                "text": [
                    "No real payments or live operations yet. The next step is a geo-limited pilot with a "
                    "reduced catalogue, tracking turnaround, damage, packaging reuse and churn.",
                ],
            },
        ],
    },
    "opta": {
        "name": "Opta",
        "short": "A tactile-first shared-car HMI.",
        "intro": "I designed an HMI concept for a shared “third-space” car in collaboration with Italdesign, "
                 "tailored to an average user who values practicality, comfort, and affordability—combining a "
                 "modern infotainment system with intuitive, low-distraction interaction through physical "
                 "controls and voice.",
        "tags": "Human–Machine Interaction, UX/UI, Research, Prototyping",
        "facts": [
            ("Timeline", "Sept – Dec 2024"),
            ("Team", "6 (interactive designers, architects, computer engineer)"),
            ("My focus", "Ideation, wireframing, prototyping"),
            ("Tools", "Figma, Arduino, ProtoPie"),
            ("Methods", "Literature review, shadowing, interviews, focus group, scenario building, "
                        "wireframing, low-fi prototyping, user testing (Madness Test)"),
        ],
        "story": [
            {
                "title": "Starting point",
                "lead": "Design a shared-car HMI that feels modern and engaging, but stays simple, safe, and "
                        "tactile.",
                "text": [
                    "As automotive experiences become increasingly screen-based, drivers face higher cognitive "
                    "load and distraction. Shared mobility within small trusted circles adds new needs: "
                    "personalization, quick handover between users, and a car that feels like a “third space” "
                    "beyond home and work.",
                    "A literature review, shadowing, interviews and a focus group pointed to the same pain "
                    "points: complex interfaces and touchscreen overuse.",
                ],
            },
            {
                "title": "Outcome",
                "lead": "A coherent HMI and companion app experience for a shared vehicle service.",
                "text": [[
                    "Personalized journeys: users set the atmosphere for each trip and quickly return to defaults.",
                    "Dual interaction model: key functions controlled via a physical knob or voice assistant.",
                    "Clear information hierarchy: only the most relevant driving and comfort information is "
                    "surfaced.",
                ],
                    "In the Madness Test, participants placed in a narrative set ten years ahead used both the "
                    "app and the physical knob: it confirmed a strong preference for intuitive physical "
                    "controls.",
                ],
            },
            {
                "title": "Key design decisions",
                "lead": "Physical-first interaction, to reduce distraction.",
                "text": [[
                    "Knob-based navigation: primary in-car actions on the knob, with touch as secondary.",
                    "Mode clarity: driving modes and sections are instantly recognizable and easy to scan.",
                    "Shared-use readiness: fast personalization, simple reset, clear vehicle status.",
                    "Essentials always accessible: navigation and climate without deep menus.",
                    "Passenger-friendly features: interaction that does not interfere with driving tasks.",
                ]],
            },
        ],
    },
    "threads-of-silk": {
        "name": "Threads of Silk",
        "short": "Community storytelling across touchpoints.",
        "intro": "I designed a three-touchpoint storytelling system for the Silk Museum in Como, turning donated "
                 "artefacts into a visible network of community stories — in the museum, online, and for staff.",
        "tags": "UX/UI, Research, Multi-touchpoint experience",
        "facts": [
            ("Timeline", "Feb – Jun 2024"),
            ("Team", "5 (graphic designers, product designers, psychologists)"),
            ("My focus", "UX research, IA, interaction design, UI design, prototyping, user testing"),
            ("Tools", "Figma, Adobe Suite"),
            ("Methods", "On-site observation, personas + scenarios, card sorting, affinity mapping, "
                        "wireframing, prototype testing"),
        ],
        "process_in": "Starting point",
        "story": [
            {
                "title": "Starting point",
                "lead": "Bring the community’s stories to the surface and connect them to the collection.",
                "text": [
                    "The Silk Museum preserves Como’s silk heritage, but the people behind it stay invisible. "
                    "Over three visits we saw that the narrative centres on a single figure, Giannino Brenna, "
                    "while more than 90% of the objects on display were donated by local people.",
                    "I took part in the on-site research and in defining three personas — Curious Visitors, "
                    "the Silk Community and Museum Staff — which guided every design choice.",
                ],
            },
            {
                "title": "Concept",
                "lead": "How might we make the community’s heritage visible?",
                "text": [
                    "By collecting, preserving and sharing the stories behind the objects, for three different "
                    "audiences:",
                    [
                        "Curious Visitors: tourists drawn to silk culture, often looking for a personal "
                        "connection or a touch of nostalgia.",
                        "Silk Community: locals with family ties to Como’s silk history, who value legacy and "
                        "belonging.",
                        "Museum Staff: curators dedicated to preserving the museum’s heritage.",
                    ],
                ],
            },
            {
                "title": "Outcome",
                "lead": "A connected system that turns individual memories into a navigable network of "
                        "narratives.",
                "text": [[
                    "Explore (in-museum, 32”): visitors browse stories, follow links between people and "
                    "objects, and find those objects in the museum.",
                    "Submit (website): locals and visitors share stories and media beyond the museum walls.",
                    "Organize (staff tool): staff review, tag and approve submissions, and create events "
                    "around stories.",
                ],
                    "I worked on the information architecture of the three touchpoints, designed wireframes "
                    "and navigation models, and then the final interface.",
                ],
            },
            {
                "title": "How it works",
                "lead": "One loop across three touchpoints.",
                "text": [
                    "A story travels from the website to the museum screen, and each one leads to the "
                    "author’s profile and their other stories.",
                ],
                "steps": [
                    ("Submit · website", "Locals and visitors share a story with related media."),
                    ("Organize · staff tool", "Staff review, tag and approve it, and link it to museum objects."),
                    ("Explore · museum screen", "Visitors find it on the 32” screen, connected to people and objects."),
                ],
            },
            {
                "title": "Key design decisions",
                "lead": "Stories are a network to explore, not isolated posts.",
                "text": [[
                    "Taxonomy before UI: a card sorting with 5 participants on 24 stories produced about 40 "
                    "tags, which an affinity map reduced to 8 macro-groups.",
                    "Connection-first exploration: every story links to related stories, objects and authors, "
                    "to encourage serendipity.",
                    "Designed for a shared 32” screen: quick, standing use and groups, with progressive "
                    "disclosure to handle long content.",
                ],
                    "We tested a low-fidelity prototype with people close to the three personas to check "
                    "functionality and navigation before the final design.",
                ],
            },
            {
                "title": "Why it matters",
                "lead": "Giving a voice to the hidden heroes of Como’s silk industry.",
                "text": [
                    "By letting people share their own stories, the platform brings to light the people and "
                    "connections behind the collection, keeps silk culture alive from one generation to the "
                    "next and strengthens the bonds within the silk community.",
                ],
            },
        ],
    },
    "mediant": {
        "name": "MEDIANT",
        "short": "An AI assistant for medical visits.",
        "intro": "I designed an AI-powered platform that reduces documentation burden during medical visits, "
                 "helping doctors stay focused on patient communication while keeping records accurate and "
                 "complete.",
        "tags": "AI platform design, UX/UI, Service design, Healthcare",
        "facts": [
            ("Timeline", "Feb – Jun 2024"),
            ("Team", "5 people (graphic designers, architect, IT specialist)"),
            ("My focus", "ideation, AI research, user research, UX/UI design, testing"),
            ("Tools", "Figma, Adobe Suite"),
            ("Methods", "Desk research, brainwriting, benchmarking + case studies, in-depth interviews with "
                        "doctors, How Might We framing, information architecture, wireframing + prototyping, "
                        "UX testing"),
        ],
        "story": [
            {
                "title": "Starting point",
                "lead": "Keep the visit patient-centered, without sacrificing clinical accuracy.",
                "text": [
                    "Research on the Italian healthcare system revealed a recurring issue: doctors’ workflows "
                    "are slowed down by time-consuming documentation, so visit time shifts from listening and "
                    "dialogue to note-taking.",
                    "Desk research, brainwriting and in-depth interviews with doctors led to one question: how "
                    "might we develop an AI-driven ecosystem that enables a deeper focus on patient and doctor "
                    "communication during visits?",
                ],
            },
            {
                "title": "Outcome",
                "lead": "A service concept and interface system made of two coordinated touchpoints.",
                "text": [[
                    "Doctor platform (web): a dashboard for appointments, patients and medical histories, with "
                    "voice notes and AI-generated visit summaries.",
                    "Patient app (mobile): secure access to health information, appointment booking, health "
                    "data monitoring and a voice assistant.",
                ],
                    "The two sides exchange information continuously: the doctor easily finds patient "
                    "information, which the patient keeps updated through the app.",
                ],
            },
            {
                "title": "Key design decisions",
                "lead": "The patient-centered visit as the core KPI.",
                "text": [[
                    "Real-time capture: voice notes and AI-generated documentation reduce manual typing.",
                    "One shared logic: doctor and patient experiences built on the same data structure.",
                    "Data sources as a constraint: each feature designed around the availability and "
                    "reliability of its data.",
                    "Atomic design system: consistent components across a complex platform.",
                ]],
            },
        ],
    },
    "apopsi": {
        "name": "Apopsi",
        "short": "Culture clubs for Gen Z in Milan.",
        "intro": "I designed a multi-touchpoint campaign and app for Milan that helps Gen Z reconnect with "
                 "cinema, theatre, and literature through community-driven discovery and in-person clubs.",
        "tags": "Graphic design, UX/UI, App design, Community building, Cultural engagement",
        "facts": [
            ("Timeline", "Sep 2022 – Jan 2023"),
            ("Team", "5 people"),
            ("My focus", "UX/UI design, user research, prototyping, usability testing"),
            ("Tools", "Adobe Suite, Figma"),
            ("Methods", "Desk research, field research, concept development, information architecture, "
                        "wireframing and UI design, atomic design system, prototyping, usability testing"),
        ],
        "story": [
            {
                "title": "Starting point",
                "lead": "Turn culture into something social, accessible, and habit-forming.",
                "text": [
                    "Milan offers a wide cultural landscape, but many young people (10–18) rarely engage with "
                    "cinemas, theatres, libraries, and bookstores. Existing initiatives often fail to speak "
                    "their language.",
                    "Desk and field research showed that their exposure to literature and theatre is mostly "
                    "mediated by school rather than by direct participation.",
                ],
            },
            {
                "title": "Outcome",
                "lead": "An ecosystem that connects visibility in the city, digital participation, and "
                        "in-person meetups.",
                "text": [[
                    "Discover (app): a feed of films, shows and books, with reviews and an “Upcoming” list.",
                    "Explore (Extra): behind-the-scenes content, trivia, interviews and club updates.",
                    "Contribute (Upload): reviews, ratings and posts personalized with stickers.",
                    "Activate (city touchpoints): posters and QR-code stickers in high-traffic areas such as "
                    "Garibaldi, Centrale and Piola.",
                    "Connect (clubs): cinema, theatre and book clubs that turn digital interest into real "
                    "interaction.",
                ],
                    "User testing with Figma prototypes showed a smooth login, and pointed to improvements for "
                    "content filtering and profile navigation.",
                ],
            },
            {
                "title": "Key design decisions",
                "lead": "Community first: sharing and peer influence rather than passive consumption.",
                "text": [[
                    "Multiple entry points: QR-based posters turn curiosity into immediate action.",
                    "Clear content architecture: discover, deepen, contribute, and manage profile.",
                    "Consistent visual language: Atomic Design across the app and communication assets.",
                    "Testing-driven iteration: usability tests validated onboarding and improved filtering "
                    "and profile navigation.",
                ]],
            },
        ],
    },
}

# Internship under NDA: the page describes the process and my role, without showing the designs.
PROJECTS["logitech"] = {
    "name": "Logitech",
    "short": "Account experience for Logitech’s gaming software.",
    "intro": "During my three-month UX internship at Logitech G, I contributed to the evolution of the G HUB Account "
             "experience, focusing on understanding player needs, improving information architecture, and exploring "
             "more intuitive ways for users to interact with their gaming ecosystem.\n\n"
             "My work spanned research, concept development, rapid prototyping, and usability testing, in "
             "collaboration with the Logitech G team.",
    "disclaimer": "This project is protected by NDA. The case study focuses on my role, design approach, and "
                  "learnings, without disclosing confidential work.",
    "tags": "UX/UI Design, User Research, Prototyping, AI-assisted prototyping",
    "facts": [
        ("Role", "UX Design Intern"),
        ("Timeline", "Jun – Aug 2026"),
        ("Team", "Logitech G team in Cork, with Logitech teams in other regions"),
        ("My focus", "Competitive analysis, user research, information architecture, prototyping, usability testing"),
        ("Tools", "Figma, Replit, Claude"),
        ("Methods", "Competitive benchmarking, cross-regional research, ideation workshop, information "
                    "architecture, AI-assisted prototyping, usability testing, iterative design"),
    ],
    "story": [
        {
            "title": "Discovery",
            "lead": "Understanding the landscape before defining the problem.",
            "text": [
                "I started by benchmarking gaming platforms and software ecosystems to see how they approach "
                "accounts, profiles and personalization. The aim was to build a shared reference of patterns and "
                "player expectations before discussing solutions.",
                "Because G HUB serves an international audience, I worked with Logitech colleagues in other regions "
                "to understand how expectations vary across markets. Their perspectives shaped the questions I "
                "brought into the next phase.",
            ],
        },
        {
            "title": "Definition",
            "lead": "Turning insights into a clear structure.",
            "text": [
                "I organised a brainstorming session with the team to explore player needs and opportunities, then "
                "grouped the findings into themes. I used them to define the information architecture of the "
                "Account experience: what players need to find first, and how content should be organised.",
            ],
        },
        {
            "title": "Prototyping and validation",
            "lead": "Prototyping to explore, testing to learn.",
            "text": [
                "I used Replit to build an interactive prototype quickly, so I could explore flows in a realistic "
                "way rather than through static screens. Within a three-month internship, this made it possible to "
                "put a working concept in front of users early.",
                "I ran usability sessions with 10 participants, gathered their feedback and used it to refine the "
                "experience before the final prototype.",
            ],
        },
        {
            "title": "Key Takeaways",
            "takeaways": [
                ("Designing within a complex ecosystem",
                 "Learned to approach UX challenges by considering the relationships between different features, "
                 "user needs, and product constraints."),
                ("Turning research into structure",
                 "Strengthened my ability to translate qualitative insights into clear information architecture "
                 "and design directions."),
                ("Prototyping to learn",
                 "Explored how rapid, AI-assisted prototyping can support early validation and faster design "
                 "iterations."),
                ("Cross-functional collaboration",
                 "Gained experience communicating design decisions, incorporating feedback, and working within an "
                 "international product team."),
            ],
            "text": [],
        },
    ],
}

# Each project's main colour, used in its charts: (accent, light tint).
ACCENTS = {
    "lego-replay": ("#e3000b", "#fde6e7"),
    "opta": ("#c13bd0", "#f8ebfa"),
    "threads-of-silk": ("#d9532b", "#fbebe5"),
    "mediant": ("#1a3f96", "#e8edf7"),
    "apopsi": ("#d81f5b", "#fce8ef"),
    "logitech": ("#12b5a0", "#e6f7f4"),
}

# How each project unfolded: one card per phase, shown after the overview.
PROCESS = {
    "lego-replay": [
        ("Research", "A survey with 70 people and a benchmark of 5 rental services."),
        ("Personas & journeys", "Giulia and Luca, mapped before, during and after a rental."),
        ("Concept", "Rental and trade-in in one circular system."),
        ("Prototypes", "Website and app flows inside LEGO’s ecosystem."),
        ("Usability testing", "10 participants, 3 scenarios."),
    ],
    "opta": [
        ("Research", "Literature review, shadowing, interviews and a focus group."),
        ("Scenarios", "Research insights turned into user scenarios."),
        ("Experience", "A personalized journey for the shared car."),
        ("Madness Test", "The app and the knob, tested in a story set ten years ahead."),
        ("Interface", "Wireframes and prototypes for the app and the dashboard."),
    ],
    "threads-of-silk": [
        ("Research", "3 on-site visits at the Silk Museum."),
        ("Personas", "3 user groups with different needs."),
        ("Card sorting", "24 stories, 5 participants, 8 macro-groups."),
        ("Architecture", "IA and wireframes for 3 touchpoints."),
        ("Testing", "A low-fidelity prototype with target users."),
    ],
    "mediant": [
        ("Research", "Desk research, brainwriting and interviews with doctors."),
        ("How Might We", "Five scenarios, one chosen to start from."),
        ("Ideation", "The needs of patient and doctor during a visit."),
        ("Concept", "Service structure, data sources and AI core."),
        ("Design", "Information architecture, wireframes and an atomic design system."),
    ],
    "apopsi": [
        ("Research", "Desk and field research on Gen Z and culture in Milan."),
        ("Concept", "A campaign and an app built around community."),
        ("Architecture", "Discover, deepen, contribute and manage profile."),
        ("Design", "Wireframes, UI and an atomic design system."),
        ("Testing", "Usability tests with Figma prototypes."),
    ],
    "logitech": [
        ("Benchmarking", "Competitive analysis of gaming platforms."),
        ("Global research", "Insights from Logitech teams in other regions."),
        ("Users & structure", "User needs, ideation and information architecture."),
        ("Prototype", "An interactive, AI-assisted prototype in Replit."),
        ("Testing", "Usability tests with 10 participants and iteration."),
    ],
}

# Extra visuals for single chapters: key figures and step flows.
CHAPTER_VISUALS = {
    "lego-replay": {
        "Concept": {"steps": [
            ("Rent", "Pick a set on LEGO.com or in the app."),
            ("Return", "Send back underused sets for points or credit."),
            ("Refurbish", "Sets are inspected, cleaned and graded A/B/C."),
            ("Recirculate", "Back in the catalogue; incomplete sets become spare parts."),
        ]},
    },
    "mediant": {
        "Outcome": {"steps": [
            ("Patient · app", "Keeps health data up to date and books visits."),
            ("Mediant · AI core", "Organizes data sources and turns voice notes into documentation."),
            ("Doctor · web platform", "Finds patient information and AI-generated visit summaries."),
        ]},
    },
    "apopsi": {
        "Starting point": {"figures": [("10–18", "Target age"), ("3", "Cultural areas"), ("5", "Touchpoints")]},
        "Outcome": {"steps": [
            ("Activate · city", "Posters and QR stickers in high-traffic stations."),
            ("Discover · app", "A feed of films, shows and books."),
            ("Contribute · app", "Reviews, ratings and posts."),
            ("Connect · clubs", "Cinema, theatre and book clubs, in person."),
        ]},
    },
}
for _slug, _chapters in CHAPTER_VISUALS.items():
    for _chapter in PROJECTS[_slug]["story"]:
        _chapter.update(_chapters.get(_chapter["title"], {}))

PROJECT_ROWS = [["logitech", "lego-replay"], ["threads-of-silk", "opta"], ["mediant", "apopsi"]]
PROJECT_ORDER = [slug for row in PROJECT_ROWS for slug in row]

# Related projects shown at the end of each project page (as in Figma).
RELATED = {
    "logitech": ["opta", "lego-replay"],
    "lego-replay": ["opta", "threads-of-silk"],
    "threads-of-silk": ["mediant", "opta"],
    "opta": ["threads-of-silk", "lego-replay"],
    "mediant": ["apopsi", "lego-replay"],
    "apopsi": ["mediant", "threads-of-silk"],
}

# One-sentence description for each project card on the Projects page.
# Categories on the Projects page, from one fixed vocabulary so projects can be compared:
# UX/UI Design, Research, Service Design, Interaction Design, Visual Design.
CATEGORIES = {
    "logitech": ["UX/UI Design", "Research"],
    "lego-replay": ["Service Design", "UX/UI Design", "Research"],
    "threads-of-silk": ["Interaction Design", "UX/UI Design", "Research"],
    "opta": ["Interaction Design", "UX/UI Design", "Research"],
    "mediant": ["Service Design", "UX/UI Design", "Research"],
    "apopsi": ["Visual Design", "UX/UI Design", "Research"],
}

DESCRIPTIONS = {
    "lego-replay": "A circular rental and trade-in service that extends the life of LEGO sets, online, at home and in-store.",
    "opta": "An HMI for a shared city car, designed with Italdesign, using physical controls and voice to reduce distraction.",
    "threads-of-silk": "A storytelling system for the Silk Museum in Como that brings the community’s stories next to the collection.",
    "mediant": "An AI platform that takes documentation off doctors’ hands, so medical visits stay focused on the patient.",
    "apopsi": "A campaign and an app that bring Gen Z in Milan back to cinema, theatre and books through community clubs.",
    "logitech": "The Account experience of G HUB, Logitech’s gaming software: from competitive research to a validated prototype.",
}

# Images as they are placed in the Figma file, exported with the same crop so they are never stretched.
# "opening" is the wide image under the facts; the other keys are the section an image row follows
# ("Overview" or a chapter title). A row is ("img", file, ratio[, caption[, width]]), where width is the
# share of the column when the image is narrower than it, ("pair", file, file, ratio[, overlay]) or
# ("video", id) for a Vimeo video. An .mp4 file is an animation from Figma, played like a GIF; an overlay
# is an .mp4 placed on the second image of a pair (left, top, width, height in percent, corner radius).
# "card" is the image on the Projects page, cropped to a landscape box.
# How each animation is cropped in Figma: the visible part of the video, as (width, left, height, top)
# in fractions of the video.
VIDEO_CROPS = {
    "threads-of-silk-opening.mp4": (0.8173, 0.09135, 0.7185, 0.13555),
    "threads-of-silk-outcome.mp4": (1, 0, 0.97852, 0.00647),
    "lego-replay-website.mp4": (0.81958, 0.11443, 0.76652, 0.12886),
    "lego-replay-phone.mp4": (0.22384, 0.38774, 0.70623, 0.14143),
}

FIGMA_MEDIA = {
    "logitech": {
        "card": "logitech-cover.jpg",
        "opening": "logitech-cover.jpg",
    },
    "lego-replay": {
        "card": "lego-replay-opening.jpg",
        "opening": "lego-replay-opening.jpg",
        "Overview": [("img", "lego-replay-overview.jpg", "837 / 477")],
        "Research": [("img", "lego-replay-journey.jpg", "837 / 319",
                      "Giulia — renting a set: before, during and after the rental.")],
        "Key design decisions": [("img", "lego-replay-refurbish.jpg", "837 / 721")],
        "Digital integration": [("pair", "lego-replay-pair-1.jpg", "lego-replay-pair-2.jpg", "410 / 448",
                                  ("lego-replay-phone.mp4", 25.58, 4.97, 48.06, 90.13, "16.26% / 7.92%"))],
        "Limits and next steps": [("img", "lego-replay-website.mp4", "772 / 470", None, 772 / 837)],
    },
    "threads-of-silk": {
        "card": "threads-of-silk-overview.jpg",
        "opening": "threads-of-silk-opening.mp4",
        "Overview": [("img", "threads-of-silk-overview.jpg", "837 / 558")],
        "Concept": [("pair", "threads-of-silk-pair-1.jpg", "threads-of-silk-pair-2.jpg", "403 / 440")],
        "Outcome": [("img", "threads-of-silk-outcome.mp4", "837 / 533")],
        "Key design decisions": [("video", "1011555669")],
    },
    "opta": {
        "card": "opta-opening.jpg",
        "opening": "opta-opening.jpg",
        "Overview": [("img", "opta-overview.jpg", "837 / 477")],
        "Starting point": [("pair", "opta-pair-1.jpg", "opta-pair-2.jpg", "410 / 448")],
        "Outcome": [("pair", "opta-pair-3.jpg", "opta-pair-4.jpg", "410 / 448")],
        "Key design decisions": [("video", "1076657703")],
    },
    "mediant": {
        "card": "mediant-opening.jpg",
        "opening": "mediant-opening.jpg",
        "Starting point": [("pair", "mediant-pair-1.jpg", "mediant-pair-2.jpg", "410 / 448")],
        "Outcome": [("img", "mediant-outcome.jpg", "837 / 540")],
    },
    "apopsi": {
        "card": "apopsi-opening.jpg",
        "opening": "apopsi-opening.jpg",
        "Overview": [("img", "apopsi-overview.jpg", "837 / 477")],
        "Starting point": [("pair", "apopsi-pair-1.jpg", "apopsi-pair-2.jpg", "410 / 448")],
        "Outcome": [("img", "apopsi-outcome.jpg", "837 / 398")],
        "Key design decisions": [("img", "apopsi-decisions-1.jpg", "837 / 471"),
                                 ("img", "apopsi-decisions-2.jpg", "837 / 422"),
                                 ("video", "1005396932")],
    },
}


def animation(file):
    """A Figma animation: a muted looping video, cropped as in Figma."""
    w, l, h, t = VIDEO_CROPS[file]
    style = f"width: {100 / w:.3f}%; height: {100 / h:.3f}%; left: {-l / w * 100:.3f}%; top: {-t / h * 100:.3f}%"
    return (f'<video class="anim" style="{style}" src="assets/video/{file}?v={VERSION}" '
            f'autoplay muted loop playsinline preload="metadata" aria-hidden="true"></video>')


def media(file, alt, ratio, cls="", style="", overlay=None):
    """An image in a box with the ratio it has in Figma, so it fills the box without being stretched."""
    classes = " ".join(c for c in ("media", cls) if c)
    if file.endswith(".mp4"):
        inner = animation(file)
        # A still of the same frame sits behind the video, so the box is never empty while the
        # video loads or when the phone does not autoplay it (e.g. iOS Low Power Mode).
        still = file.replace(".mp4", "-still.jpg")
        if (ROOT / "assets" / "img" / still).exists():
            style = f"background: url(assets/img/{still}?v={VERSION}) center / cover" + ("; " + style if style else "")
    else:
        inner = f'<img src="assets/img/{file}?v={VERSION}" alt="{escape(alt)}" loading="lazy">'
    if overlay:
        o_file, left, top, width, height, radius = overlay
        inner += (f'<div class="anim-overlay" style="left: {left}%; top: {top}%; width: {width}%; '
                  f'height: {height}%; border-radius: {radius}">{animation(o_file)}</div>')
    return f'<div class="{classes}" style="aspect-ratio: {ratio}{"; " + style if style else ""}">{inner}</div>'


def page(filename, title, body, description):
    def current(href):
        # The page itself, or Projects while reading one of the projects.
        if href == filename:
            return ' aria-current="page"'
        if href == "index.html" and filename[:-5] in PROJECTS:
            return ' aria-current="true"'
        return ""

    links = "".join(
        f'<span class="nav-item"><a href="{href}" data-shuffle{current(href)}>{label}</a></span>'
        for label, href in NAV
    )
    plain_links = "".join(f'<a href="{href}">{label}</a>' for label, href in NAV)
    # Link previews (WhatsApp, LinkedIn, Slack...): one image for the whole site; the text is the
    # first sentence of the page description.
    share_image = "assets/share/share.jpg"
    share_text = description.split(". ")[0].rstrip(".") + "."
    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)}</title>
<meta name="description" content="{escape(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{NAME}">
<meta property="og:title" content="{escape(title)}">
<meta property="og:description" content="{escape(share_text)}">
<meta property="og:url" content="{SITE_URL}{"" if filename == "index.html" else filename}">
<meta property="og:image" content="{SITE_URL}{share_image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="assets/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="assets/icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">
<link rel="stylesheet" href="assets/css/style.css?v={VERSION}">
<!-- Cloudflare Web Analytics: cookieless visit statistics -->
<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{{"token": "{CF_ANALYTICS_TOKEN}"}}'></script>
</head>
<body>
<header class="site-header">
  <a class="brand" href="index.html" aria-label="{NAME}"><span data-shuffle>{NAME}</span></a>
  <nav class="nav" aria-label="Main"><div class="nav-links">{links}</div><a href="mailto:{EMAIL}" data-shuffle>Let’s Talk</a></nav>
  <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="menu">Menu</button>
</header>
<div class="menu" id="menu" hidden>
  <div class="menu-top"><a href="index.html">{NAME}</a><button class="menu-close" type="button">Close</button></div>
  <nav class="menu-links" aria-label="Mobile">{plain_links}<a href="mailto:{EMAIL}">Let’s Talk</a></nav>
</div>
<main>
{body}
</main>
<footer class="site-footer">
  <div class="f-top">
    <a class="f-name" href="index.html">{NAME}</a>
    <div class="f-contact"><a href="mailto:{EMAIL}">Email</a><span class="f-sep" aria-hidden="true"></span><a href="{LINKEDIN}" target="_blank" rel="noopener">LinkedIn</a></div>
  </div>
  <p class="f-bottom">© 2026 All Rights Reserved</p>
</footer>
<script src="assets/js/main.js?v={VERSION}"></script>
</body>
</html>
"""
    (ROOT / filename).write_text(html, encoding="utf-8")


# Curriculum shown on the About page (as in the Figma About frame).
ABOUT_TEXT = ("I’m Alessandra Annoni, an Interaction and Visual Designer from Milan, Italy, with international "
              "experience across UX/UI, digital products, and immersive technologies, including work at Logitech. I "
              "create intuitive and engaging experiences that go beyond “just UI”, connecting people and technology "
              "across screens, environments, and physical objects. I hold an MSc in Digital and Interaction Design and "
              "a BSc in Communication Design from Politecnico di Milano.")
ABOUT_TAGS = ["Product design", "UX/UI design", "Interaction design"]
CV_SKILLS = [
    ("Design", ["UX/UI Design", "Interaction Design", "Visual Design", "Responsive Design", "Design Systems",
                "Developer Handoff"]),
    ("Research & prototyping", ["User Research", "Usability Testing", "User Flows", "Wireframing",
                                "Information Architecture", "High-Fidelity Prototyping"]),
    ("Tools", ["Figma, ProtoPie", "Adobe Creative Suite", "Unity UI Toolkit, Blender", "Claude, Replit, Magnific",
               "HTML, CSS, JavaScript"]),
    ("Languages", ["Italian — Native", "English — Fluent", "Spanish — Intermediate", "German — Beginner"]),
]
CV_EDUCATION = [
    ("MSc Digital and Interaction Design", ["Politecnico di Milano", "Grade: 110/110 cum laude"], "2023 – 2025"),
    ("Erasmus Exchange", ["IT University of Copenhagen"], "Feb – Aug 2025"),
    ("BSc Communication Design", ["Politecnico di Milano", "Grade: 110/110"], "2020 – 2023"),
]
CV_EXPERIENCE = [
    ("Software UX Design Intern", "Logitech · Cork, Ireland", "Jun – Aug 2026",
     "UX design of G HUB, the gaming software developed by the Logitech G team.",
     ["Account experience, personalization, community and engagement features.",
      "User flows, wireframes, high-fidelity interfaces and prototypes for desktop and mobile.",
      "Usability testing and research synthesis to improve navigation and discoverability.",
      "AI-assisted prototyping with Claude and Replit, together with UX designers and developers."]),
    ("UX/UI Design Intern", "A-LL Creative Technology · Fribourg, Switzerland", "Aug 2025 – Feb 2026",
     "Interfaces for AR/VR applications and product websites.",
     ["Interactive AR/VR interfaces built with Unity UI Toolkit.",
      "Website interfaces and information architecture for clearer product communication.",
      "2D and 3D workflows, combining interaction design, visual design and implementation."]),
    ("UX/UI Designer", "Donna Vino · Denmark, remote", "Jan – Jun 2025",
     "UX/UI for web and mobile platforms: user-centered layouts, interface concepts and visual design.", []),
    ("Graphic Designer", "PLH Italia · Milan, Italy", "Mar 2022 – Jan 2025",
     "Visual communication, digital content and advertising, consistent across channels.",
     ["Campaigns, social media redesign and corporate communication."]),
]
CV_ACTIVITIES = [("Sony Corporation Workshop", "2025"), ("POLIMI x MIT 24-Hour Joint Hackathon", "2024"),
                 ("George Brown College International Workshop", "2024")]


def cv_sections():
    def section(title, content, last=False, stacked=False):
        kind = "cv-sec--stacked" if stacked else ""
        return (f'<section class="grid cv-sec {kind}{" page-end" if last else ""}"><h2 class="cv-heading">{title}</h2>'
                f'<div class="cv-body">{content}</div></section>')

    skills = '<div class="cv-skills">' + "".join(
        f'<div><p class="cv-cat">{escape(cat)}</p><ul>' + "".join(f"<li>{escape(i)}</li>" for i in items) + "</ul></div>"
        for cat, items in CV_SKILLS) + "</div>"
    education = '<ul class="cv-cols">' + "".join(
        f'<li><h3 class="cv-title">{escape(t)}</h3>' + "".join(f'<p class="cv-org">{escape(x)}</p>' for x in lines)
        + f'<p class="cv-when">{escape(when)}</p></li>'
        for t, lines, when in CV_EDUCATION) + "</ul>"
    work = '<ul class="cv-entries">' + "".join(
        f'<li class="cv-entry"><div class="cv-meta"><h3 class="cv-title">{escape(t)}</h3><p class="cv-org">{escape(org)}</p>'
        f'<p class="cv-when">{escape(when)}</p></div><div class="cv-desc"><p>{escape(desc)}</p>'
        + ("".join(f'<p class="cv-point">{escape(x)}</p>' for x in points) if points else "") + "</div></li>"
        for t, org, when, desc, points in CV_EXPERIENCE) + "</ul>"
    activities = '<ul class="cv-cols">' + "".join(
        f'<li><p class="cv-activity">{escape(t)}</p><p class="cv-when">{escape(y)}</p></li>' for t, y in CV_ACTIVITIES) + "</ul>"
    return "".join([
        section("Skills", skills, stacked=True),
        section("Education", education),
        section("Work Experience", work),
        section("Activities", activities, last=True),
    ])


def build_about():
    tags = '<p class="about-tags">' + "".join(f"<span>{escape(t)}</span>" for t in ABOUT_TAGS) + "</p>"
    body = f"""<section class="grid cv-sec cv-sec--intro">
  <div class="cv-intro">
    <p class="about-lede">{escape(ABOUT_TEXT)}</p>
    {tags}
  </div>
</section>
{cv_sections()}"""
    page("about.html", f"About · {NAME}", body, "Interaction and Visual Designer from Milan, with international experience across UX/UI, digital products and immersive technologies.")


# Laboratory: small interactive experiments. Each one is a separate web app published in
# laboratory/<slug>/ (Glitch Cam is built from lab/glitch-cam with `npm run build`).
# An experiment with "url" runs on its own server: laboratory/<slug>/ is then a small waiting page
# that wakes the server and opens the game (see build_lab_wake). "hidden" keeps the card off the
# Laboratory page, e.g. until the server is online.
EXPERIMENTS = [
    {
        "slug": "glitch-cam",
        "name": "Glitch Cam",
        "image": "lab-glitch-cam.svg",
        "desc": "A real-time webcam glitch: as you move, your image breaks into pieces from different moments, "
                "and your open hand pushes the distortion to the max.",
        "tags": ["WebGL", "Computer vision", "Interaction"],
    },
    {
        "slug": "pictionary-ai",
        "name": "Pictionary AI",
        "image": "lab-pictionary-ai.svg",
        "desc": "A drawing game against an AI: you sketch a word and it guesses, then it draws "
                "and you guess. Made for phones.",
        "tags": ["AI", "Drawing", "Game"],
        # Render server that serves the game (lab/pictionary-ai, deploy steps in DEPLOY.md).
        "url": "https://pictionary-ai.onrender.com",
        # Remove once the server is online and a full game works there.
        "hidden": True,
    },
]


def build_laboratory():
    cards = "".join(
        f'<a class="proj-card" href="laboratory/{e["slug"]}/" data-pixel-hover>{media(e["image"], "", "16 / 10")}'
        f'<span class="proj-text"><span class="proj-name">{escape(e["name"])}</span>'
        f'<span class="proj-desc">{escape(e["desc"])}</span>'
        f'<span class="proj-tags">{"".join(f"<span>{escape(t)}</span>" for t in e["tags"])}</span></span></a>'
        for e in EXPERIMENTS
        if not e.get("hidden")
    )
    body = f"""<section class="page-head">
  <h1 class="page-title">Laboratory</h1>
  <p class="lab-lede">Small interactive experiments, built to explore how people and technology can play together. They run in your browser: try them yourself.</p>
</section>
<section class="proj-grid page-end">{cards}</section>"""
    page("laboratory.html", f"Laboratory · {NAME}", body,
         "Small interactive experiments exploring how people and technology can play together.")


def build_lab_wake(e):
    """Waiting page for an experiment hosted on its own server (free hosting sleeps when idle).
    It calls the server's /wake address and opens the game as soon as the server answers."""
    url = e["url"].rstrip("/")
    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{escape(e["name"])} · {NAME}</title>
<meta name="description" content="{escape(e["desc"])}">
<meta name="robots" content="noindex">
<link rel="icon" href="../../assets/icons/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;500;600&display=swap">
<style>
  *, *::before, *::after {{ box-sizing: border-box; }}
  html, body {{ margin: 0; min-height: 100%; background: #E6E6E6; color: #111; font-family: Inter, system-ui, sans-serif; }}
  main {{ min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: 24px 16px; }}
  .card {{ width: 100%; max-width: 360px; border-radius: 24px; overflow: hidden; background: #F5F5F3;
    box-shadow: 0 22px 44px -22px rgba(17, 17, 17, .45); }}
  .head {{ padding: 18px 20px 22px; }}
  .meta {{ font-size: 12px; font-weight: 500; letter-spacing: .05em; text-transform: uppercase; color: rgba(17, 17, 17, .5); }}
  h1 {{ margin: 22px 0 8px; font: 600 36px/1.05 Fraunces, Georgia, serif; letter-spacing: -.015em; }}
  p {{ margin: 0; font-size: 15px; line-height: 1.4; color: rgba(17, 17, 17, .68); }}
  .art {{ height: 140px; display: grid; place-items: center; background: #D3D3D0; }}
  .dots {{ display: flex; gap: 10px; }}
  .dots i {{ width: 12px; height: 12px; border-radius: 50%; background: #111; animation: dot 1.2s ease-in-out infinite; }}
  .dots i:nth-child(2) {{ animation-delay: .15s; }} .dots i:nth-child(3) {{ animation-delay: .3s; }}
  @keyframes dot {{ 0%, 80%, 100% {{ opacity: .25; transform: none; }} 40% {{ opacity: 1; transform: translateY(-6px); }} }}
  .links {{ display: flex; gap: 16px; margin-top: 18px; font-size: 15px; font-weight: 600; }}
  a {{ color: #111; }}
  [hidden] {{ display: none !important; }}
  @media (prefers-reduced-motion: reduce) {{ .dots i {{ animation: none; }} }}
</style>
</head>
<body>
<main>
  <article class="card" aria-live="polite">
    <div class="head">
      <div class="meta">Laboratory · {escape(e["name"])}</div>
      <h1 id="title">Waking up the AI</h1>
      <p id="text">Opening the game…</p>
      <div class="links" id="links" hidden>
        <a href="{url}/">Try again</a>
        <a href="../../laboratory.html">Back to the Laboratory</a>
      </div>
    </div>
    <div class="art" aria-hidden="true"><div class="dots"><i></i><i></i><i></i></div></div>
  </article>
</main>
<script>
  // The game server sleeps when nobody plays (free hosting): call it, wait until it answers,
  // then open the game. After 90 seconds without an answer, show the links instead.
  const GAME = {json.dumps(url)};
  const text = document.getElementById("text");
  const slow = setTimeout(() => {{
    text.textContent = "The game server naps when nobody plays. It takes about a minute to wake up.";
  }}, 4000);
  const ctrl = new AbortController();
  const giveUp = setTimeout(() => ctrl.abort(), 90000);
  fetch(GAME + "/wake", {{ mode: "no-cors", cache: "no-store", signal: ctrl.signal }})
    .then(() => location.replace(GAME + "/"))
    .catch(() => {{
      clearTimeout(slow);
      document.getElementById("title").textContent = "The game is resting";
      text.textContent = "The server didn't wake up this time. Try again in a moment.";
      document.querySelector(".art").hidden = true;
      document.getElementById("links").hidden = false;
    }})
    .finally(() => clearTimeout(giveUp));
</script>
</body>
</html>
"""
    out = ROOT / "laboratory" / e["slug"] / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")


def build_projects():
    cards = "".join(
        f'<a class="proj-card" href="{slug}.html" data-pixel-hover>{media(FIGMA_MEDIA[slug]["card"], "", "16 / 10")}'
        f'<span class="proj-text"><span class="proj-name">{escape(PROJECTS[slug]["name"])}</span>'
        f'<span class="proj-desc">{escape(DESCRIPTIONS[slug])}</span>'
        f'<span class="proj-tags">{"".join(f"<span>{escape(t)}</span>" for t in CATEGORIES[slug])}</span></span></a>'
        for slug in PROJECT_ORDER
    )
    body = f"""<section class="page-head">
  <h1 class="page-title">Index</h1>
</section>
<section class="proj-grid page-end">{cards}</section>"""
    page("index.html", f"{NAME} · UX/UI & Product Designer", body,
         "A collection of digital experiences shaped by curiosity, creativity, and human-centered design.")


def split_lead(text):
    """ "Title: description" -> (title, description); text without a colon has no title."""
    head, sep, tail = text.partition(": ")
    return (head, tail) if sep else ("", text)


def chapter_body(blocks):
    out = []
    for block in blocks:
        if isinstance(block, list):  # numbered points
            items = []
            for i, item in enumerate(block, 1):
                title, text = split_lead(item)
                head = f'<h3 class="point-title">{escape(title)}</h3>' if title else ""
                items.append(f'<li><span class="point-n">{i:02d}</span><div>{head}<p>{escape(text)}</p></div></li>')
            out.append(f'<ol class="points">{"".join(items)}</ol>')
        elif isinstance(block, dict):  # key figures: big number + caption
            cells = "".join(
                f'<div><span class="figure-n">{escape(n)}</span><span class="figure-label">{escape(label)}</span></div>'
                for n, label in block["figures"]
            )
            out.append(f'<div class="figures">{cells}</div>')
        elif isinstance(block, tuple):  # short lines
            out.append('<ul class="cap-list">' + "".join(f"<li>{escape(i)}</li>" for i in block) + "</ul>")
        else:
            out.append(f"<p>{escape(block)}</p>")
    return "".join(out)


def step_flow(steps, label, compact=False):
    """Cards in a row joined by arrows, the last one highlighted; text under the title is optional."""
    cards = "".join(
        f'<li class="{"is-last" if i == len(steps) else ""}"><span class="step-label">{label} {i}</span>'
        f'<h3 class="step-title">{escape(title)}</h3>' + (f'<p class="step-text">{escape(text)}</p>' if text else "") + "</li>"
        for i, (title, text) in enumerate(steps, 1)
    )
    titles_only = " flow--titles" if not any(text for _, text in steps) else ""
    return f'<ol class="flow flow--{len(steps)}{" flow--compact" if compact else ""}{titles_only}">{cards}</ol>'


def build_case(slug):
    p = PROJECTS[slug]
    images = FIGMA_MEDIA[slug]
    n = 0

    def alt():
        nonlocal n
        n += 1
        return f'{p["name"]} — image {n}'

    def section(title, content):
        heading = f'<h2 class="story-h">{escape(title)}</h2>' if title else ""
        return (f'<section class="grid sec-m story-chapter"><div class="col-l">{heading}</div>'
                f'<div class="col-r">{content}</div></section>')

    def image_row(row):
        # Images sit in the right column and run to the edge of the window, as in Figma.
        kind = row[0]
        if kind == "video":
            return (f'<div class="grid"><div class="video col-r bleed">'
                    f'<iframe src="https://player.vimeo.com/video/{row[1]}?dnt=1&amp;title=0&amp;byline=0&amp;portrait=0" '
                    f'title="{escape(p["name"])} — video" allow="fullscreen; picture-in-picture" loading="lazy"></iframe></div></div>')
        if kind == "pair":
            return (f'<div class="grid"><div class="col-r bleed pair-r">'
                    f'{media(row[1], alt(), row[3])}{media(row[2], alt(), row[3], overlay=row[4] if len(row) > 4 else None)}</div></div>')
        caption = row[3] if len(row) > 3 else None
        width = row[4] if len(row) > 4 else None
        figure = media(row[1], alt(), row[2], cls="narrow" if width else "", style=f"width: {width * 100:.2f}%" if width else "")
        caption_html = f'<p class="caption">{escape(caption)}</p>' if caption else ""
        return f'<div class="grid"><div class="col-r bleed">{figure}{caption_html}</div></div>'

    def image_rows(key):
        return "".join(
            f'<div class="story-row {"tile-gap" if k and row[0] == "img" else "sec-m"}">{image_row(row)}</div>'
            for k, row in enumerate(images.get(key, []))
        )

    process = step_flow(PROCESS[slug], "Phase", compact=True) if slug in PROCESS else ""
    process_in = p.get("process_in")  # the chapter that holds the process, when it has no section of its own
    flow = [] if process_in or not process else [section("Process", process)]
    for chapter in p["story"]:
        lead = f'<p class="story-lead">{escape(chapter["lead"])}</p>' if chapter.get("lead") else ""
        if chapter.get("takeaways"):
            # Learnings: numbered items in two columns.
            items = "".join(
                f'<li><span class="takeaway-n">{i:02d}</span><h3 class="takeaway-title">{escape(t)}</h3>'
                f'<p class="takeaway-text">{escape(d)}</p></li>'
                for i, (t, d) in enumerate(chapter["takeaways"], 1)
            )
            flow.append(section(chapter["title"], f'<ol class="takeaways">{items}</ol>'))
            continue
        extra = f'<div class="story-process">{process}</div>' if chapter["title"] == process_in else ""
        flow.append(section(chapter["title"], f'<div class="story-text">{lead}{chapter_body(chapter["text"])}</div>{extra}'))
        if chapter.get("figures"):
            # Key figures as a band of big numbers, each with a small label underneath.
            cells = "".join(
                f'<div class="stat"><span class="stat-n">{escape(n)}</span><span class="stat-label">{escape(label)}</span></div>'
                for n, label in chapter["figures"]
            )
            flow.append(f'<div class="grid sec-m"><div class="col-r stats-r stats-r--{len(chapter["figures"])}">{cells}</div></div>')
        if chapter.get("steps"):
            flow.append(f'<div class="grid sec-m"><div class="col-r">{step_flow(chapter["steps"], "Step")}</div></div>')
        flow.append(image_rows(chapter["title"]))
    # Methods close the project, as a row of tags.
    methods = dict(p.get("facts", [])).get("Methods")
    if methods:
        chips = "".join(f"<li>{escape(m[0].upper() + m[1:])}</li>" for m in methods.split(", "))
        flow.append(section("Methods", f'<ul class="chips">{chips}</ul>'))

    # Closing: related projects, one row each; on hover the row turns grey and an arrow appears.
    related_rows = "".join(
        f'<li><a class="related-row grid" href="{r}.html"><span class="related-text">'
        f'<span class="related-arrow" aria-hidden="true">→</span><span class="related-name">{escape(PROJECTS[r]["name"])}</span> '
        f'<span class="related-short">{escape(PROJECTS[r]["short"])}</span></span></a></li>'
        for r in RELATED[slug]
    )

    # Opening: title, then a row of small labelled facts, then the first image as wide as the content.
    facts = dict(p.get("facts", []))
    fact_items = [("Role", escape(facts["Role"]))] if "Role" in facts else []
    fact_items += [
        ("Timeline", escape(facts["Timeline"])),
        ("Team", escape(facts["Team"])),
        ("My focus", escape(facts["My focus"])),
        ("Disciplines", escape(p["tags"])),
        ("Tools", escape(facts["Tools"])),
    ]
    facts_row = "".join(f'<div class="fact"><dt>{k}</dt><dd>{v}</dd></div>' for k, v in fact_items)
    opener_fig = f'<div class="story-row sec-s"><div class="grid">{media(images["opening"], alt(), "1180 / 675", cls="m12")}</div></div>'

    ledes = p["intro"].split("\n\n")
    intro_html = f'<p class="case-lede">{escape(ledes[0])}</p>' + "".join(f'<p class="case-lede-more">{escape(x)}</p>' for x in ledes[1:])
    if p.get("disclaimer"):
        intro_html += f'<p class="case-note">{escape(p["disclaimer"])}</p>'
    accent, tint = ACCENTS.get(slug, ("#ff5e00", "#fff3ec"))
    body = f"""<style>:root {{ --accent: {accent}; --accent-tint: {tint}; }}</style>
<section class="case-open">
  <h1 class="case-title">{escape(p["name"])}</h1>
  <dl class="grid case-facts case-facts--{len(fact_items)}">{facts_row}</dl>
</section>
{opener_fig}
<section class="grid sec-m case-overview">
  <div class="col-r">
    <p class="label">Overview</p>
    {intro_html}
  </div>
</section>
{image_rows("Overview")}
{"".join(flow)}
<section class="related page-end">
  <div class="grid"><h2 class="related-h m12">Related Projects</h2></div>
  <ul class="related-list">{related_rows}</ul>
</section>"""
    page(f"{slug}.html", f'{p["name"]} · {NAME}', body, p["intro"].replace("\n\n", " "))


if __name__ == "__main__":
    build_about()
    build_projects()
    build_laboratory()
    for e in EXPERIMENTS:
        if e.get("url"):
            build_lab_wake(e)
    for s in PROJECTS:
        build_case(s)
    print("Built", 3 + len(PROJECTS), "pages")
