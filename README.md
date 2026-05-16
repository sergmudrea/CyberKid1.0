# 🧠 CyberKid

**An educational puzzle game that teaches programming from ages 3 to 99.**

*"Learn to think like a developer — by playing."*

![Version](https://img.shields.io/badge/version-1.0.0--beta-green)
![License](https://img.shields.io/badge/license-AGPL--3.0%20%2B%20Commercial-yellow)
![Platform](https://img.shields.io/badge/platform-Web%20%7C%20Android%20%7C%20iOS-blue)

---

## 📋 Table of Contents

1. [About](#-about)
2. [Philosophy](#-philosophy)
3. [Target Audience & Learning Modes](#-target-audience--learning-modes)
4. [Worlds & Progression](#-worlds--progression)
5. [Core Mechanics (45+)](#-core-mechanics-45)
6. [Four Ways to Solve](#-four-ways-to-solve)
7. [Exploration Mode](#-exploration-mode)
8. [Technical Architecture](#-technical-architecture)
9. [Installation (Licensed Users Only)](#-installation-licensed-users-only)
10. [Development Guide](#-development-guide)
11. [Testing](#-testing)
12. [Deployment](#-deployment)
13. [Monetization](#-monetization)
14. [License](#-license)
15. [Contact](#-contact)
16. [Credits](#-credits)

---

## 🎮 About

**CyberKid** is a groundbreaking educational puzzle game that teaches programming concepts through interactive gameplay. Players control a robot on a grid-based level, using a visual programming language (drag-and-drop commands) to navigate obstacles, collect coins, and solve increasingly complex puzzles. Every game mechanic corresponds to a real programming concept — from simple sequences to object-oriented programming and parallelism.

With over **2500+ built-in levels** across 6 themed worlds and an infinite Arcade of user-generated content, CyberKid adapts to learners from preschool (age 3) to professional developers (age 99+).

### Key Features

- ✅ **45+ unique game mechanics**, each teaching a specific programming concept
- ✅ **4 learning modes** (Kiddo, Scholar, Dev Student, Developer) with adaptive UI
- ✅ **2500+ procedurally generated levels** with guaranteed solvability
- ✅ **Four solution paths** per level (Easy, Mid, Hard, Backdoor) rewarding creativity
- ✅ **Exploration Mode** – free roam to inspect levels without penalty (max 2 stars)
- ✅ **Built-in level editor (Sandbox Maker)** – create and share your own levels
- ✅ **Arcade** – community levels with rating, search, and filters
- ✅ **Full offline support** (PWA + service worker)
- ✅ **Cross-platform** – Web, Android (Capacitor), iOS (Capacitor)
- ✅ **Developer Mode** – see real Python/JavaScript code for each command

---

## 🧠 Philosophy

Traditional programming education fails because it separates **learning from doing**. Students read about variables, write `x = 5` in a vacuum, and never understand *why* these concepts matter.

CyberKid takes the opposite approach: **embodied programming**. Every programming concept is mapped to a tangible, spatial mechanic:

| Game Mechanic | Programming Concept |
|---------------|---------------------|
| Brick pushed into a pit | Conditional problem-solving (if hole → fill) |
| Conveyor belt | Event-driven programming / automatic loops |
| Key and door | Authentication & authorization |
| Black Box (input → output) | Pure functions (SISO, MIMO) |
| Mama Hedgehog + babies | Classes, inheritance, polymorphism |
| Clone (Doppelganger) | Parallelism (fork/join) |
| Drill / Hook / Bait | Creative problem-solving, exploits, backdoors |
| Exploration Mode (P key) | Reading documentation before coding |

> **A child who pushes a brick into a pit to create a bridge understands conditional logic at a deeper level than a student who writes `if (hole) { fill(); }`. The body learns before the mind names.**

---

## 🎯 Target Audience & Learning Modes

| Mode | Age | Features |
|------|-----|----------|
| **Kiddo** | 3–5 years | Icons only, voice prompts, no text |
| **Scholar** | 6–9 years | Icons + native language explanations |
| **Dev Student** | 10–14 years | Explanations + Python/JavaScript syntax |
| **Developer** | 15+ years | Syntax only, Script Mode (full code editor) |

**Graduate outcome (1000+ levels completed):** Junior Developer level knowledge:
- Confident use of loops, conditions, functions
- Understanding of OOP (classes, inheritance, polymorphism)
- Basic data structures (arrays, stacks, queues)
- Debugging skills (fail → analyze → fix)
- Creative problem-solving (backdoors, alternative solutions)

---

## 🗺️ Worlds & Progression

| # | World | Levels | Grid Size | Concepts | Difficulty |
|---|-------|--------|-----------|----------|------------|
| 1 | **Meadow** 🌾 | 500 | 5×5 → 8×7 | Movement, sequences, pits, bricks, FOR loops | 1–15 |
| 2 | **Ocean** 🌊 | 500 | 6×6 → 10×9 | Walls, conveyors, springs, IF conditions | 15–30 |
| 3 | **Clouds** ☁️ | 500 | 7×7 → 12×10 | Wings, teleports, Black Box functions | 30–50 |
| 4 | **Fairytale** 🏰 | 500 | 8×8 → 14×12 | Keys, doors, sorters, riddles, WHILE loops | 50–70 |
| 5 | **Volcano** 🌋 | 500 | 10×10 → 18×15 | Monsters, cloning, OOP, cores, rockets | 70–90 |
| 6 | **Arcade** 🎮 | ∞ | 5×5 → 20×20 | User-generated content, Sandbox Maker | Any |
| ★ | **Bonus** ⭐ | 3000+ | 10×10 → 20×20 | Hidden mechanics, neuro-stabilizers, mirrors | 90–100 |

### Difficulty Scaling Formula

Grid size = minSize + (maxSize - minSize) × (levelNum / totalLevels)
Obstacle density = startDensity + (endDensity - startDensity) × progress
Optimal steps = baseMoves + movesPerLevel × levelNum (capped)
text


---

## ⚙️ Core Mechanics (45+)

### Terrain & Environment (11)
1. **Platform** – walkable ground (basic movement)
2. **Sky** – empty space (boundaries)
3. **Pit (Hole)** – fatal fall (obstacle avoidance)
4. **Brick** – pushable block (object manipulation)
5. **Wall** – impassable barrier (path planning)
6. **Fake Wall** – passable illusion (debugging)
7. **Ladder** – vertical climbing (multi-axis navigation)
8. **Floating Platform** – moving ground (dynamic environments)
9. **Magnet** – pull/push force (external forces)
10. **Mirror** – reflection (recursion)
11. **Sensor** – detection trigger (event-driven)

### Transport (6)
12. **Conveyor (4 dir)** – automatic movement (event loops)
13. **Spring** – launches player (jump mechanics)
14. **Teleport** – instant transport (GOTO)
15. **Escalator** – directional conveyor (one-way data flow)
16. **Rocket** – fast travel (optimized paths)
17. **Wing** – flight over pits (privilege escalation)

### Items & Inventory (8)
18. **Coin** – goal object (return value)
19. **Key** – unlocks doors (authentication)
20. **Locked/Unlocked Door** – conditional passage (authorization)
21. **Corn** – monster food (resource management)
22. **Core** – monster weapon (resource as tool)
23. **Drill** – wall destruction (privileged operation)
24. **Hook** – pull to wall (shortcuts)
25. **Bait** – monster distraction (exception handling)

### Creatures & AI (7)
26. **Patrol Monster** – moves on path (predictable behavior)
27. **Chase Monster** – pursues player (reactive behavior)
28. **Tameable Monster** – becomes ally when fed (state mutation)
29. **Phased Monster** – semi-invisible (edge cases)
30. **Zombie** – infects on contact (error propagation)
31. **Boss Monster** – requires strategy (complex problem-solving)
32. **Mama Hedgehog** – class definition (OOP)

### Logic & Control (7)
33. **Black Box (SISO/SIMO/MISO/MIMO)** – function abstraction
34. **Lever** – toggle switch (boolean state)
35. **Button** – momentary trigger (event handlers)
36. **Timer** – delayed action (setTimeout)
37. **Riddle** – conditional puzzle (logic gates)
38. **Clock** – time-based event (CRON)
39. **Sorter** – inventory organization (sorting algorithms)

### Advanced / Hidden (6+)
40. **Clone** – duplicate player (parallelism, fork)
41. **Join** – merge clones (parallelism, join)
42. **Ride** – mount tamed monster (composition)
43. **Throw** – ranged attack (remote execution)
44. **Scan** – reveal hidden objects (debugging)
45. **Neuro-Stabilizer** – fuzzy logic (AI/ML)
46+ **Backdoors** – hidden shortcuts (creative thinking)

---

## 🚪 Four Ways to Solve

Every level has **4 validated solutions** (precomputed by BFS):

| Path | Exploration Allowed | Stars | Description |
|------|---------------------|-------|-------------|
| **Easy** | ✅ | 1–2★ | Long, brute force, safe |
| **Mid** | ✅ | 2★ | Faster, requires thinking |
| **Hard (Optimal)** | ❌ | 3★ | Minimum steps, perfect execution |
| **Backdoor** | Limited* | 1–3★ black | Hidden shortcut using drill/hook/bait |

\* With Exploration Mode, black stars reduced by 1.

### Star Calculation Formula

```python
if exploration_used:
    stars = min(2, 2 if steps <= optimal else 1)
elif steps <= optimal:
    stars = 3
elif steps <= optimal * 1.5:
    stars = 2
else:
    stars = 1

🔍 Exploration Mode (P Key)

Press P (or tap magnifying glass button) to enter free exploration.

What you can do:

    Walk freely (arrows / swipe / tap)

    Inspect items (marked "examined")

    See monster patrol paths (frozen, semitransparent)

    Read "Senior Engineer" notes on walls

    Discover hidden objects (fake walls flicker)

What you cannot do:

    Collect coins (inactive, shows "Program me")

    Complete the level

    Die (pits/monsters just bounce you back)

Cost: Maximum 2 stars in this attempt.
Warning on first P press: "Your reward will be limited to 2 stars. Continue?"
🏛 Technical Architecture
Technology Stack
Layer	Technology	Version
Game Engine	Phaser	3.80+
Language	TypeScript (strict)	5.0+
Build Tool	Vite	5.0+
Mobile	Capacitor	6.0+
Testing	Jest + ts-jest	29.0+
PWA	Workbox	7.0+
Level Generator	Node.js + TypeScript	20.x
Container	Docker + Nginx	latest
Project Structure
text

cyberkid/
├── src/
│   ├── main.ts                 # Entry point
│   ├── types/                  # TypeScript interfaces & enums
│   ├── core/                   # EventBus
│   ├── managers/               # Settings, Progress, Save, Level, Unlock
│   ├── modules/                # Pathfinder, ExecutionEngine, CommandPanel, etc.
│   ├── scenes/                 # All Phaser scenes
│   └── data/                   # worlds.json, syntax.json
├── tools/generator/            # Level generation CLI
├── public/                     # Static assets & icons
├── dist/                       # Build output
├── capacitor.config.ts
├── vite.config.ts
├── tsconfig.json
├── package.json
├── docker-compose.yml
└── nginx.conf

Key Modules

    EventBus – Central communication hub (singleton Phaser EventEmitter)

    LevelManager – Dynamic level loading with caching (import.meta.glob)

    ProgressManager – Player progress (stars, achievements, world unlocks)

    SaveManager – Multiple save slots, auto-save, session restore

    UnlockManager – IAP integration (Google Play Billing simulation)

    Pathfinder – BFS engine supporting 45+ mechanics

    ExecutionEngine – Command execution state machine (loops, conditions, functions, OOP)

    CommandPanel – Drag-and-drop visual programming UI (4 learning modes)

    HintSystem – Timed contextual hints (tiers 1–5)

    ExplorationMode – Ghost mode with monster freezing

    SandboxMaker – Level editor with tile palette and object placement

⚙️ Installation (Licensed Users Only)

After obtaining a commercial license and access to private repository:
bash

# Clone repository (requires VPN + license key)
git clone https://github.com/[private]/cyberkid-core.git
cd cyberkid-core

# Install dependencies
npm install

# Configure license key
cp .env.example .env
# Add your key: LICENSE_KEY=xxxx-xxxx-xxxx-xxxx

# Generate levels (for all worlds)
npm run generate:levels -- --world meadow --count 500
npm run generate:levels -- --world ocean --count 500
npm run generate:levels -- --world clouds --count 500
npm run generate:levels -- --world fairytale --count 500
npm run generate:levels -- --world volcano --count 500
npm run generate:levels -- --world bonus --count 3000

# Run development server
npm run dev

# Build for production
npm run build

# Build for Android
npm run build:android
npx cap open android

⚠️ NOTE: The build will not run without a valid license key (cryptographic signature check).
🧪 Testing
bash

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Coverage thresholds (≥70%):
# - Branches: 70%
# - Functions: 70%
# - Lines: 70%
# - Statements: 70%

Test suites:

    managers/*.test.ts – Settings, Progress, Save, Level, Unlock

    modules/*.test.ts – Pathfinder, ExecutionEngine, Player, LevelMap, CommandPanel, HintSystem, ExplorationMode

    scenes/*.test.ts – MainMenu, WorldMap, LevelSelect, GameScene, VictoryScreen, Settings, Stats, Paywall, SandboxScene, ArcadeBrowser

🚀 Deployment
Web (Vercel / Netlify / static hosting)
bash

npm run build
# dist/ folder is ready to deploy

Docker (production)
bash

docker-compose up -d
# Serves on http://localhost:8080

Android (Capacitor)
bash

npm run build:android
# Open android/ folder in Android Studio

iOS (Capacitor)
bash

npm run build:ios
# Open ios/ folder in Xcode

💰 Monetization

CyberKid follows an ethical monetization model – never blocking learning.
Free Content

    ✅ World 1 (Meadow): 500 levels – fully free

    ✅ Arcade World: Infinite UGC – fully free

    ✅ All learning modes (Kiddo through Developer)

    ✅ Sandbox Maker – level editor – fully free

    ✅ Offline play – no internet required

Premium Content (One-Time Purchase)
Product	Price	Content
Ocean World	$2.99	500 levels, walls & conveyors
Clouds World	$2.99	500 levels, wings & teleports
Fairytale World	$3.99	500 levels, keys & riddles
Volcano World	$4.99	500 levels, OOP & cloning
Bonus World	$9.99	3000+ hidden levels
Remove Ads	$4.99	No ads in menu screens
Premium Monthly	$4.99	All worlds while active
Premium Yearly	$39.99	All worlds while active
Ethical Principles

    No pay-to-win – Stars are earned, not bought

    No ads during learning – Ads only in menu screens

    No data selling – All progress stored locally

    No dark patterns – Clear pricing, no confusing UI

    Subscription optional – One-time purchases also available

📄 License

AGPL-3.0 + Commercial – dual licensing model.
License Type	Price	What it gives
AGPL-3.0 (view only)	Free	Read-only access to this README
Developer	$99/year	Code access, non-commercial use
Indie Studio	$499/year	Commercial use, support
Enterprise	$4,999/year	Full rights, modification, SLA
Educational	$199/year	Up to 500 students, materials

For commercial licenses: schkyola@gmail.com
📞 Contact
Inquiry	Email
Commercial licenses	schkyola@gmail.com
Legal questions	schkyola@gmail.com
Partnerships	schkyola@gmail.com

Legal entity: CyberKid Technologies LLC
🙏 Credits

    Game Design & Development: CyberKid Technologies LLC

    Research & Pedagogy: sergmudrea

    Special thanks: All playtesters and early supporters

📜 Changelog
v1.0.0-beta (planned Q3 2026)

    Full release (App Store, Google Play)

    All 6 worlds + Bonus

    Arcade with UGC

    Sandbox Maker

v0.5.0-alpha (Q1 2026)

    All worlds (Meadow, Ocean, Clouds, Fairytale, Volcano, Bonus)

    Level generator with BFS validation

    Save system with multiple slots

    Exploration Mode

v0.1.0-alpha (Q3 2025)

    First playable prototype (Meadow only)

    Core mechanics (move, push, hole, brick)

    Basic command panel

❓ FAQ

Q: Can I make a YouTube review of the game?
A: Yes, reviews are allowed without a license. Please link to the official website.

Q: Can I write my own game with similar mechanics?
A: The mechanics are proprietary. A research license (AGPL view-only) is available for study.

Q: Can I translate the game into another language?
A: Yes, translations are welcome and paid. Contact partners@cyberkid.game.

Q: Where can I download a demo?
A: No demo yet. Full release planned for Q3 2026.

Q: Is there a teacher dashboard?
A: Planned for future release (classroom mode).

Q: Does the game track personal data?
A: No. All progress is stored locally. No accounts required.
🔒 Privacy Policy

The game does not collect personal data without explicit consent. Only stored data:

    Player progress (local storage)

    User-generated levels (Arcade) – only with permission

GDPR / COPPA compliant.
🚫 Prohibited

    ❌ Copying mechanics into commercial products

    ❌ Reverse engineering binary builds

    ❌ Distributing license keys

    ❌ Creating clones with altered names

    ❌ Using the name "CyberKid" without permission

Violations result in DMCA takedowns, domain blocks, and legal action.
🧠 Final Words

CyberKid is not a game that teaches programming. It is a programming environment disguised as a game.

The 45+ mechanics are not arbitrary — each one maps to a real concept that professional developers use daily. The four learning modes are not cosmetic — they represent fundamentally different cognitive stages. The BFS pathfinder is not just a validator — it is a silent tutor that always knows the optimal path.

This project tests a simple hypothesis: If you remove syntax, remove fear of failure, and replace instruction with exploration — will people learn to think like programmers?

The 2500+ generated levels and infinite Arcade are the laboratory. The players are the subjects.

The answer is still being written.

© 2025, CyberKid Technologies LLC. All rights reserved.

Verification hash: a7f3c8e2b1d9a4e6f8c3b7a1e9d5f2c4b6a8d1e3f7c9b2a4d6e8f1c3a5b7d9
