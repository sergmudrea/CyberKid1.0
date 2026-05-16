# Arcade Service (Post-MVP)

This directory contains the backend microservice for CyberKid Arcade – community level sharing.

## Features (planned)
- User authentication (optional)
- Level publishing and rating
- Daily featured packs
- Level search and filtering

## Setup (future)
```bash
cd arcade-service
npm install
cp .env.example .env
npm run dev

API Endpoints (planned)

    POST /api/levels – publish a level

    GET /api/levels/featured – get featured levels

    GET /api/levels/search?q=... – search levels

    POST /api/levels/:id/rate – rate a level

    POST /api/levels/:id/play – increment play count

Database (planned)

PostgreSQL with tables:

    users

    levels

    ratings

    plays
